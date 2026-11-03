/**
 * Echte HD-Videokomprimierung (H.264 + AAC + FastStart) direkt im Browser via WebCodecs (`mediabunny`).
 *
 * Warum hing das 134-MB-Video bisher?
 * - Ein 134 MB großes iPhone-Video hat eine Bitrate von ~25–45 Mbit/s (4K / 60fps).
 *   Um das live ohne Nachladen abzuspielen, müsste die Leitung konstant 4–6 MB pro Sekunde liefern.
 * - Bei deiner Website hatten wir die Videos auf ~2,5 Mbit/s (720p HD, H.264, FastStart) komprimiert,
 *   wodurch aus 134 MB nur noch ca. 10–18 MB werden!
 * - Dieses Modul führt genau diese Komprimierung vollautomatisch beim Upload UND auf Knopfdruck
 *   für bereits hochgeladene Videos durch (nutzt den Hardware-Chip von Mac & iPhone).
 */

import {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    Quality
} from 'mediabunny';

const TARGET_VIDEO_BITRATE = 2_400_000; // 2.4 Mbps -> ~18 MB pro Minute Video, butterweiches Streaming
const TARGET_AUDIO_BITRATE = 128_000;   // 128 kbps AAC
const MAX_VIDEO_DIMENSION = 1280;       // 720p HD (1280x720 bzw. 720x1280 Hochformat)

/**
 * Komprimiert eine Videodatei (Blob oder File) im Browser per Hardware-WebCodecs
 * auf webfreundliches 720p HD MP4 (H.264 + AAC) inkl. FastStart-Header.
 *
 * @param {File|Blob} inputBlob
 * @param {(progress0to100: number) => void} onProgress
 * @returns {Promise<File>}
 */
export async function transcodeVideoToWebMp4(inputBlob, onProgress) {
    let input = null;
    try {
        input = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(inputBlob)
        });

        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) {
            input.dispose();
            return ensureFastStartMp4(inputBlob);
        }

        const duration = (await input.getDurationFromMetadata()) || (await input.computeDuration()) || 0;
        const displayW = (await videoTrack.getDisplayWidth()) || 1280;
        const displayH = (await videoTrack.getDisplayHeight()) || 720;
        const codec = await videoTrack.getCodec();

        // Prüfen, ob das Video bereits klein und web-optimiert ist (< 3.2 Mbps, <= 1280px, H.264)
        const currentBitrate = duration > 0 ? (inputBlob.size * 8) / duration : Infinity;
        const maxSide = Math.max(displayW, displayH);

        if (
            codec === 'avc' &&
            maxSide <= MAX_VIDEO_DIMENSION &&
            currentBitrate <= 3_200_000 &&
            inputBlob.size < 25 * 1024 * 1024
        ) {
            input.dispose();
            if (onProgress) onProgress(100);
            return ensureFastStartMp4(inputBlob);
        }

        // Zielauflösung berechnen (immer gerade Zahlen für H.264!)
        const scale = Math.min(1, MAX_VIDEO_DIMENSION / maxSide);
        const targetW = Math.max(2, Math.round((displayW * scale) / 2) * 2);
        const targetH = Math.max(2, Math.round((displayH * scale) / 2) * 2);

        const target = new BufferTarget();
        const output = new Output({
            format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
            target
        });

        const conversion = await Conversion.init({
            input,
            output,
            copy: false,
            showWarnings: false,
            video: {
                codec: 'avc',
                width: targetW,
                height: targetH,
                frameRate: 30,
                keyFrameInterval: 2,
                hardwareAcceleration: 'no-preference',
                quality: new Quality({
                    bitrate: TARGET_VIDEO_BITRATE,
                    bitrateMode: 'variable'
                }),
                forceTranscode: true
            },
            audio: {
                codec: 'aac',
                numberOfChannels: 2,
                sampleRate: 48000,
                quality: new Quality({
                    bitrate: TARGET_AUDIO_BITRATE
                }),
                forceTranscode: true
            }
        });

        if (!conversion.isValid) {
            input.dispose();
            return ensureFastStartMp4(inputBlob);
        }

        conversion.onProgress = (ratio) => {
            if (onProgress) {
                onProgress(Math.min(99, Math.round((ratio || 0) * 100)));
            }
        };

        await conversion.execute();
        input.dispose();

        if (target.buffer && target.buffer.byteLength > 0) {
            if (onProgress) onProgress(100);
            const rawName = inputBlob.name || 'video.mp4';
            const cleanName = rawName.replace(/\.[^.]+$/, '') + '_hd.mp4';
            return new File([target.buffer], cleanName, {
                type: 'video/mp4',
                lastModified: Date.now()
            });
        }
    } catch (err) {
        console.warn('Hardware-Transcoding Fallback auf FastStart:', err);
        if (input && !input.disposed) {
            try {
                input.dispose();
            } catch {
                // ignore
            }
        }
    }

    return ensureFastStartMp4(inputBlob);
}

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

export async function ensureFastStartMp4(file) {
    try {
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

        if (moovIdx === -1 || mdatIdx === -1 || moovIdx < mdatIdx) {
            return file;
        }

        const moovBox = boxes[moovIdx];
        const moovBuffer = buffer.slice(moovBox.offset, moovBox.offset + moovBox.size);
        const moovView = new DataView(moovBuffer);

        shiftChunkOffsetsInBox(moovView, 8, moovBox.size, moovBox.size);

        const outBytes = new Uint8Array(totalLen);
        let writeOffset = 0;

        for (let i = 0; i < boxes.length; i++) {
            if (i === mdatIdx) {
                outBytes.set(new Uint8Array(moovBuffer), writeOffset);
                writeOffset += moovBox.size;
            }
            if (i === moovIdx) continue;

            const b = boxes[i];
            outBytes.set(new Uint8Array(buffer, b.offset, b.size), writeOffset);
            writeOffset += b.size;
        }

        const cleanName = (file.name || 'video.mp4').replace(/\.(mov|m4v)$/i, '.mp4');
        return new File([outBytes], cleanName, {
            type: 'video/mp4',
            lastModified: Date.now()
        });
    } catch (err) {
        console.warn('FastStart-Optimierung übersprungen:', err);
        return file;
    }
}

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
