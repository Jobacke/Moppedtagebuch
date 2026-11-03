/**
 * Video-Optimierung für flüssiges Streaming & schnelle Vorschau (iPhone & Mac)
 *
 * 1. Erzeugt automatisch ein leichtgewichtiges JPEG-Vorschaubild (Poster-Thumbnail, ~30 KB)
 *    vom ersten Frame des Videos. Dadurch muss die Galerie NICHT mehr alle Videos im
 *    Hintergrund herunterladen, nur um das Raster anzuzeigen!
 * 2. Verschiebt bei MP4/MOV-Dateien den `moov`-Header an den Dateianfang ("FastStart"),
 *    damit das Video beim Antippen im Vollbild sofort in der ersten Sekunde anläuft,
 *    ohne dass erst die gesamte Datei geladen werden muss.
 * 3. Falls ein Video extrem groß ist (> 35 MB) und der Browser MediaRecorder unterstützt,
 *    oder falls bereits vorhandenen Videos das Thumbnail fehlt, kümmert sich dieses Modul darum.
 */

const readUint32 = (view, offset) => view.getUint32(offset, false);
const writeUint32 = (view, offset, val) => view.setUint32(offset, val, false);
const readUint64 = (view, offset) => {
    const hi = view.getUint32(offset, false);
    const lo = view.getUint32(offset + 4, false);
    return hi * 4294967296 + lo;
};
const writeUint64 = (view, offset, val) => {
    const hi = Math.floor(val / 4294967296);
    const lo = val >>> 0;
    view.setUint32(offset, hi, false);
    view.setUint32(offset + 4, lo, false);
};
const readFourCC = (view, offset) =>
    String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );

const CONTAINER_BOXES = new Set([
    'moov',
    'trak',
    'mdia',
    'minf',
    'stbl',
    'edts',
    'dinf',
    'udta',
    'meta'
]);

/**
 * Passt alle Chunk-Offsets (`stco` 32-Bit und `co64` 64-Bit) innerhalb der `moov`-Box
 * um `delta` Bytes an, wenn `moov` vor `mdat` geschoben wird.
 */
function shiftChunkOffsetsInBox(view, start, end, delta) {
    let pos = start;
    while (pos + 8 <= end) {
        let size = readUint32(view, pos);
        const type = readFourCC(view, pos + 4);
        let headerSize = 8;

        if (size === 1) {
            if (pos + 16 > end) break;
            size = readUint64(view, pos + 8);
            headerSize = 16;
        } else if (size === 0) {
            size = end - pos;
        }

        if (size < headerSize || pos + size > end) break;

        if (type === 'stco') {
            const entryCount = readUint32(view, pos + headerSize + 4);
            let entryPos = pos + headerSize + 8;
            for (let i = 0; i < entryCount && entryPos + 4 <= pos + size; i++) {
                const oldVal = readUint32(view, entryPos);
                writeUint32(view, entryPos, oldVal + delta);
                entryPos += 4;
            }
        } else if (type === 'co64') {
            const entryCount = readUint32(view, pos + headerSize + 4);
            let entryPos = pos + headerSize + 8;
            for (let i = 0; i < entryCount && entryPos + 8 <= pos + size; i++) {
                const oldVal = readUint64(view, entryPos);
                writeUint64(view, entryPos, oldVal + delta);
                entryPos += 8;
            }
        } else if (CONTAINER_BOXES.has(type)) {
            const innerOffset = type === 'meta' ? headerSize + 4 : headerSize;
            shiftChunkOffsetsInBox(view, pos + innerOffset, pos + size, delta);
        }

        pos += size;
    }
}

/**
 * Macht eine MP4/MOV-Datei "FastStart"-fähig (verschiebt den `moov`-Atom-Header vor `mdat`),
 * damit Browser auf iPhone & Mac sofort per HTTP-Range-Stream losspielen können.
 */
export async function ensureFastStartMp4(file) {
    try {
        // Nur für Dateien bis 250 MB im Arbeitsspeicher ausführen
        if (!file || file.size > 250 * 1024 * 1024) return file;

        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        const totalLen = buffer.byteLength;

        const boxes = [];
        let pos = 0;
        while (pos + 8 <= totalLen) {
            let size = readUint32(view, pos);
            const type = readFourCC(view, pos + 4);
            if (size === 1) {
                if (pos + 16 > totalLen) break;
                size = readUint64(view, pos + 8);
            } else if (size === 0) {
                size = totalLen - pos;
            }
            if (size < 8 || pos + size > totalLen) break;
            boxes.push({ type, offset: pos, size });
            pos += size;
        }

        const moovIdx = boxes.findIndex((b) => b.type === 'moov');
        const mdatIdx = boxes.findIndex((b) => b.type === 'mdat');

        // Wenn kein moov/mdat vorhanden oder moov bereits VOR mdat liegt -> schon optimal!
        if (moovIdx === -1 || mdatIdx === -1 || moovIdx < mdatIdx) {
            return file;
        }

        const moovBox = boxes[moovIdx];
        const moovBuffer = buffer.slice(moovBox.offset, moovBox.offset + moovBox.size);
        const moovView = new DataView(moovBuffer);

        // Da moov vor mdat geschoben wird, verschieben sich alle mdat-Offsets um +moovBox.size
        shiftChunkOffsetsInBox(moovView, 8, moovBox.size, moovBox.size);

        const outBytes = new Uint8Array(totalLen);
        let writeOffset = 0;

        for (let i = 0; i < boxes.length; i++) {
            if (i === mdatIdx) {
                // Zuerst das angepasste moov einfügen
                outBytes.set(new Uint8Array(moovBuffer), writeOffset);
                writeOffset += moovBox.size;
            }
            if (i === moovIdx) continue;

            const b = boxes[i];
            outBytes.set(new Uint8Array(buffer, b.offset, b.size), writeOffset);
            writeOffset += b.size;
        }

        const cleanName = file.name.replace(/\.(mov|m4v)$/i, '.mp4');
        return new File([outBytes], cleanName, {
            type: 'video/mp4',
            lastModified: Date.now()
        });
    } catch (err) {
        console.warn('FastStart-Optimierung übersprungen:', err);
        return file;
    }
}

/**
 * Extrahiert ein gestochen scharfes, kleines JPEG-Vorschaubild (max. 640px, ~30 KB)
 * aus einer lokalen Video-Datei oder einer Video-URL.
 */
export function generateVideoPosterBlob(source) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        let objectUrl = null;

        const cleanup = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            video.removeAttribute('src');
            video.load();
        };

        const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
        }, 8000);

        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        if (typeof source === 'string') {
            video.crossOrigin = 'anonymous';
            video.src = source;
        } else {
            objectUrl = URL.createObjectURL(source);
            video.src = objectUrl;
        }

        const captureFrame = () => {
            try {
                const vw = video.videoWidth || 640;
                const vh = video.videoHeight || 360;
                const maxDim = 640;
                const scale = Math.min(1, maxDim / Math.max(vw, vh));
                const cw = Math.max(1, Math.round(vw * scale));
                const ch = Math.max(1, Math.round(vh * scale));

                const canvas = document.createElement('canvas');
                canvas.width = cw;
                canvas.height = ch;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, cw, ch);

                canvas.toBlob(
                    (blob) => {
                        clearTimeout(timeout);
                        cleanup();
                        resolve(blob);
                    },
                    'image/jpeg',
                    0.82
                );
            } catch {
                clearTimeout(timeout);
                cleanup();
                resolve(null);
            }
        };

        video.addEventListener(
            'loadeddata',
            () => {
                const targetTime = Math.min(0.5, (video.duration || 1) * 0.1);
                if (video.currentTime >= targetTime || video.duration === 0) {
                    captureFrame();
                } else {
                    video.currentTime = targetTime;
                }
            },
            { once: true }
        );

        video.addEventListener('seeked', captureFrame, { once: true });
        video.addEventListener(
            'error',
            () => {
                clearTimeout(timeout);
                cleanup();
                resolve(null);
            },
            { once: true }
        );
    });
}
