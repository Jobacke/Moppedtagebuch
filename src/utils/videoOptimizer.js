/**
 * Echte HD-Videokomprimierung (H.264 + AAC + FastStart) direkt im Browser via WebCodecs (`mediabunny`).
 *
 * WICHTIGER FIX (v1.9):
 * In v1.8 hatten wir `copy: false` und `forceTranscode: true` auf der Audiospur gesetzt.
 * Da Apples Safari (auf iPhone & Mac) das WebCodecs-Interface `AudioEncoder` für AAC
 * noch nicht nativ bereitstellt, wurde die gesamte Konvertierung abgebrochen und die
 * 134 MB große Originaldatei unkomprimiert hochgeladen!
 *
 * Lösung in v1.9:
 * 1. Die originale AAC-Tonspur vom iPhone/Mac ist ohnehin winzig (~128 kbps = < 1 MB/Min)
 *    und wird per `copy: { mode: 'preferred' }` 1:1 verlustfrei übernommen!
 * 2. Zusätzlich registrieren wir `@mediabunny/aac-encoder` als Fallback, falls eine
 *    Audiospur doch einmal transkodiert werden muss.
 * 3. Das Video selbst wird per Hardware-`VideoEncoder` (der auf Safari/iOS/macOS und Chrome
 *    voll hardwarebeschleunigt läuft) auf schlanke ~2,2 Mbit/s (720p HD, H.264, FastStart)
 *    eingedampft -> aus 134 MB werden echte ~10–15 MB!
 */

import {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
    canEncodeAudio
} from 'mediabunny';
import { registerAacEncoder } from '@mediabunny/aac-encoder';

let aacEncoderInitialized = false;

async function ensureAacSupport() {
    if (aacEncoderInitialized) return;
    aacEncoderInitialized = true;
    try {
        const nativeAac = await canEncodeAudio('aac');
        if (!nativeAac) {
            registerAacEncoder();
        }
    } catch {
        try {
            registerAacEncoder();
        } catch {
            // ignore
        }
    }
}

const TARGET_VIDEO_BITRATE = 2_200_000; // 2.2 Mbps -> ~16 MB pro Minute Video, startet sofort ohne Puffern
const MAX_VIDEO_DIMENSION = 1280;       // 720p HD (1280x720 bzw. 720x1280 Hochformat)

/**
 * Komprimiert eine Videodatei (Blob oder File) im Browser per Hardware-WebCodecs
 * auf webfreundliches 720p HD MP4 (H.264 + AAC) inkl. FastStart-Header.
 *
 * @param {File|Blob} inputBlob
 * @param {(progress0to100: number) => void} onProgress
 * @returns {Promise<{ file: File, wasCompressed: boolean }>}
 */
export async function transcodeVideoToWebMp4(inputBlob, onProgress) {
    let input = null;
    try {
        await ensureAacSupport();

        input = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(inputBlob)
        });

        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) {
            input.dispose();
            const fastFile = await ensureFastStartMp4(inputBlob);
            return { file: fastFile, wasCompressed: false };
        }

        const duration = (await input.getDurationFromMetadata()) || (await input.computeDuration()) || 0;
        const displayW = (await videoTrack.getDisplayWidth()) || 1280;
        const displayH = (await videoTrack.getDisplayHeight()) || 720;
        const codec = await videoTrack.getCodec();

        // Prüfen, ob das Video bereits klein und web-optimiert ist (< 2.8 Mbps, <= 1280px, H.264, < 18 MB)
        const currentBitrate = duration > 0 ? (inputBlob.size * 8) / duration : Infinity;
        const maxSide = Math.max(displayW, displayH);

        if (
            codec === 'avc' &&
            maxSide <= MAX_VIDEO_DIMENSION &&
            currentBitrate <= 2_800_000 &&
            inputBlob.size < 18 * 1024 * 1024
        ) {
            input.dispose();
            if (onProgress) onProgress(100);
            const fastFile = await ensureFastStartMp4(inputBlob);
            return { file: fastFile, wasCompressed: true };
        }

        // Zielauflösung berechnen (immer gerade Zahlen für H.264!)
        const scale = Math.min(1, MAX_VIDEO_DIMENSION / maxSide);
        const targetW = Math.max(2, Math.round((displayW * scale) / 2) * 2);
        const targetH = Math.max(2, Math.round((displayH * scale) / 2) * 2);

        const runConversion = async (discardAudio = false) => {
            const target = new BufferTarget();
            const output = new Output({
                format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
                target
            });

            const conversion = await Conversion.init({
                input,
                output,
                // WICHTIG: Erlaubt das direkte 1:1-Kopieren der AAC-Audiospur ohne Re-Encoding!
                copy: {
                    mode: 'preferred',
                    shiftTolerance: Infinity
                },
                showWarnings: false,
                video: {
                    codec: 'avc',
                    width: targetW,
                    height: targetH,
                    fit: 'contain',
                    frameRate: 30,
                    keyFrameInterval: 2,
                    hardwareAcceleration: 'no-preference',
                    quality: new Quality({
                        bitrate: TARGET_VIDEO_BITRATE,
                        bitrateMode: 'variable'
                    }),
                    forceTranscode: true
                },
                audio: discardAudio
                    ? { discard: true }
                    : {
                        // Kein forceTranscode! So wird vorhandenes AAC auf iPhone/Mac direkt kopiert
                        // und sonst per @mediabunny/aac-encoder nach AAC gewandelt.
                        codec: 'aac'
                    }
            });

            if (!conversion.isValid) {
                return null;
            }

            conversion.onProgress = (ratio) => {
                if (onProgress) {
                    onProgress(Math.min(99, Math.round((ratio || 0) * 100)));
                }
            };

            await conversion.execute();
            return target.buffer;
        };

        let outputBuffer = await runConversion(false);
        if (!outputBuffer || outputBuffer.byteLength === 0) {
            // Sicherheits-Fallback falls ein exotischer Audio-Track Probleme macht
            outputBuffer = await runConversion(true);
        }

        input.dispose();

        if (outputBuffer && outputBuffer.byteLength > 0) {
            if (onProgress) onProgress(100);
            const rawName = inputBlob.name || 'video.mp4';
            const cleanName = rawName.replace(/\.[^.]+$/, '') + '_hd.mp4';
            const compressedFile = new File([outputBuffer], cleanName, {
                type: 'video/mp4',
                lastModified: Date.now()
            });
            return {
                file: compressedFile,
                wasCompressed: compressedFile.size < inputBlob.size * 0.9
            };
        }
    } catch (err) {
        console.warn('Hardware-Transcoding Fehler:', err);
        if (input && !input.disposed) {
            try {
                input.dispose();
            } catch {
                // ignore
            }
        }
    }

    const fallbackFile = await ensureFastStartMp4(inputBlob);
    return { file: fallbackFile, wasCompressed: false };
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
