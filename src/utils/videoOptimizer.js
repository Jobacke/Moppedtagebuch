/**
 * 1080p Full-HD Video-Optimierung via Hardware-WebCodecs (`mediabunny`).
 *
 * WARUM 50/60-FPS-VIDEOS (231 MB / 87 MB) IN v1.10 UNKOMPRIMIERT BLIEBEN & WIE v1.12 DAS LÖST:
 * 1. H.264 Level 4.0 (`avc1.424028`) Spezifikations-Limit:
 *    `mediabunny` weist der Auflösung `1920x1080` (8.160 Makroblöcke) automatisch H.264 Level 4.0 zu.
 *    Laut H.264-Standard erlaubt Level 4.0 maximal 245.760 Makroblöcke/Sekunde (= exakt 30,1 fps bei 1080p).
 *    Übergibt man bei 1080p `frameRate: 50` oder `60`, lehnt Apples Hardware-VideoEncoder die
 *    Konfiguration sofort als ungültig ab (`supported: false`)!
 *    Deshalb wurde das 24-fps-Video (17,2 MB) komprimiert, während die beiden 50/60-fps-Videos
 *    (231,5 MB und 86,9 MB) unkomprimiert hochgeladen wurden.
 * 2. Lösung in v1.12:
 *    - Wir kodieren 1080p Full-HD (`1920x1080`) konsequent mit Level-4.0-konformen `30 fps` und
 *      hoher Bitrate (~5,8 Mbit/s, fast 3x höher als v1.9 + 2,25x höhere Auflösung!).
 *    - Vollbild-Crop (`crop: { left: 0, top: 0, width, height }`) erzwingt die saubere 8-Bit-SDR
 *      Normalisierung für 10-Bit-HDR-Videos vom iPhone.
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

const MAX_FULLHD_DIMENSION = 1920; // 1080p Full-HD (1920x1080)
const MAX_TARGET_FILE_BYTES = 42 * 1024 * 1024; // ~42 MB Obergrenze für schnelles Streaming

/**
 * Komprimiert eine Videodatei (Blob oder File) im Browser zuverlässig auf scharfes
 * 1080p Full-HD MP4 (H.264 + AAC + FastStart-Header).
 *
 * @param {File|Blob} inputBlob
 * @param {(progress0to100: number) => void} onProgress
 * @returns {Promise<{ file: File, wasCompressed: boolean }>}
 */
export async function transcodeVideoToWebMp4(inputBlob, onProgress) {
    let probeInput = null;
    try {
        await ensureAacSupport();

        probeInput = new Input({
            formats: ALL_FORMATS,
            source: new BlobSource(inputBlob)
        });

        const videoTrack = await probeInput.getPrimaryVideoTrack();
        if (!videoTrack) {
            probeInput.dispose();
            const fastFile = await ensureFastStartMp4(inputBlob);
            return { file: fastFile, wasCompressed: false };
        }

        const duration = (await probeInput.getDurationFromMetadata()) || (await probeInput.computeDuration()) || 0;
        const displayW = (await videoTrack.getDisplayWidth()) || 1920;
        const displayH = (await videoTrack.getDisplayHeight()) || 1080;
        const sqW = (await videoTrack.getSquarePixelWidth()) || displayW;
        const sqH = (await videoTrack.getSquarePixelHeight()) || displayH;
        const rotation = (await videoTrack.getRotation()) || 0;
        const [rawOrientedW, rawOrientedH] = rotation % 180 === 0 ? [sqW, sqH] : [sqH, sqW];
        const orientedW = Math.max(2, Math.round(rawOrientedW));
        const orientedH = Math.max(2, Math.round(rawOrientedH));
        const codec = await videoTrack.getCodec();

        probeInput.dispose();
        probeInput = null;

        const currentBitrate = duration > 0 ? (inputBlob.size * 8) / duration : Infinity;
        const maxSide = Math.max(orientedW, orientedH);

        // Wenn das Video bereits H.264, <= 1080p, <= 7,5 Mbit/s und < 45 MB ist:
        // 100% verlustfrei übernehmen und nur FastStart-Header sicherstellen!
        if (
            codec === 'avc' &&
            maxSide <= MAX_FULLHD_DIMENSION &&
            currentBitrate <= 7_500_000 &&
            inputBlob.size < 45 * 1024 * 1024
        ) {
            if (onProgress) onProgress(100);
            const fastFile = await ensureFastStartMp4(inputBlob);
            return { file: fastFile, wasCompressed: true };
        }

        // Optimale Ziel-Bitrate berechnen:
        // - Standard für 1080p Full-HD @ 30fps: ~5,8 Mbit/s (fast 3x höher als v1.9 -> gestochen scharf!)
        // - Gleichzeitig begrenzen wir die Bitrate bei längeren Videos so, dass die Zieldatei
        //   unter ~42 MB bleibt (damit auch ein 231-MB-Video auf kompakte ~35-42 MB schrumpft!).
        const durationSafe = Math.max(1, duration || 30);
        const maxBitrateForTargetSize = Math.floor(((MAX_TARGET_FILE_BYTES * 8) / durationSafe) * 0.90);
        const maxBitrateVsSource = Number.isFinite(currentBitrate)
            ? Math.floor(currentBitrate * 0.72)
            : 5_800_000;

        const targetBitrate = Math.max(
            2_600_000,
            Math.min(5_800_000, maxBitrateForTargetSize, maxBitrateVsSource)
        );

        const runAttempt = async ({ maxDim, fps, bitrate, discardAudio }) => {
            let attemptInput = null;
            try {
                attemptInput = new Input({
                    formats: ALL_FORMATS,
                    source: new BlobSource(inputBlob)
                });

                const scale = Math.min(1, maxDim / maxSide);
                const targetW = Math.max(2, Math.round((orientedW * scale) / 2) * 2);
                const targetH = Math.max(2, Math.round((orientedH * scale) / 2) * 2);

                const target = new BufferTarget();
                const output = new Output({
                    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
                    target
                });

                const conversion = await Conversion.init({
                    input: attemptInput,
                    output,
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
                        // Vollbild-Crop erzwingt `needsRerender = true` in mediabunny,
                        // sodass 10-Bit-HDR-Videos vom iPhone sauber auf 8-Bit SDR normalisiert werden!
                        crop: {
                            left: 0,
                            top: 0,
                            width: orientedW,
                            height: orientedH
                        },
                        frameRate: fps,
                        keyFrameInterval: 3,
                        hardwareAcceleration: 'no-preference',
                        quality: new Quality({
                            bitrate,
                            bitrateMode: 'variable'
                        }),
                        forceTranscode: true
                    },
                    audio: discardAudio
                        ? { discard: true }
                        : {
                            codec: 'aac'
                        }
                });

                const videoDiscarded = (conversion.discardedTracks || []).some(
                    (d) => d.track && typeof d.track.getType === 'function' && d.track.getType() === 'video'
                );

                if (!conversion.isValid || videoDiscarded) {
                    attemptInput.dispose();
                    return null;
                }

                conversion.onProgress = (ratio) => {
                    if (onProgress) {
                        onProgress(Math.min(99, Math.round((ratio || 0) * 100)));
                    }
                };

                await conversion.execute();
                attemptInput.dispose();
                return target.buffer;
            } catch (err) {
                console.warn(`Transcode-Stufe (${maxDim}p @ ${fps}fps) fehlgeschlagen:`, err);
                if (attemptInput && !attemptInput.disposed) {
                    try {
                        attemptInput.dispose();
                    } catch {
                        // ignore
                    }
                }
                return null;
            }
        };

        // 3-stufige H.264 Level-konforme Pipeline (30fps ist zwingend für H.264 Level 4.0 @ 1080p!)
        const stages = [
            { maxDim: 1920, fps: 30, bitrate: targetBitrate, discardAudio: false },
            { maxDim: 1280, fps: 30, bitrate: Math.min(targetBitrate, 4_500_000), discardAudio: false },
            { maxDim: 1280, fps: 30, bitrate: Math.min(targetBitrate, 4_500_000), discardAudio: true }
        ];

        for (const stage of stages) {
            const outputBuffer = await runAttempt(stage);
            if (outputBuffer && outputBuffer.byteLength > 0) {
                if (onProgress) onProgress(100);
                const rawName = inputBlob.name || 'video.mp4';
                const cleanName = rawName.replace(/\.[^.]+$/, '') + '_fullhd.mp4';
                const compressedFile = new File([outputBuffer], cleanName, {
                    type: 'video/mp4',
                    lastModified: Date.now()
                });
                return {
                    file: compressedFile,
                    wasCompressed: true
                };
            }
        }
    } catch (err) {
        console.warn('Hardware-Transcoding Fehler:', err);
        if (probeInput && !probeInput.disposed) {
            try {
                probeInput.dispose();
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
            video.src = source + (source.includes('?') ? '&' : '?') + '_poster=' + Date.now();
        } else {
            objectUrl = URL.createObjectURL(source);
            video.src = objectUrl;
        }

        const captureFrame = () => {
            try {
                const vw = video.videoWidth || 960;
                const vh = video.videoHeight || 540;
                const maxDim = 960;
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
                    0.90
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
