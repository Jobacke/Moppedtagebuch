import { useState, useRef, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { transcodeVideoToWebMp4, generateVideoPosterBlob } from '../utils/videoOptimizer';
import { cacheVideoBlob, getCachedVideoBlob, evictVideoFromCache } from '../utils/videoCache';

/**
 * Lädt ein bereits in Firebase Storage liegendes Video-Blob herunter.
 *
 * WICHTIGER SAFARI-FIX (v1.11) GEGEN "Load failed":
 * Wenn Safari zuvor ein <video src={url}> ohne CORS-Header geladen hat und der Server
 * `Cache-Control: immutable` sendet, speichert Safari die Antwort ohne CORS-Header im
 * Browser-Cache. Ein anschließendes `fetch(url)` auf exakt dieselbe URL schlägt in Safari
 * sofort mit `TypeError: Load failed` fehl!
 * Durch das Anhängen von `&_cb=${Date.now()}` umgehen wir den vergifteten Safari-Cache
 * garantiert und erhalten von `firebasestorage.googleapis.com` frische `Access-Control-Allow-Origin: *` Header,
 * inklusive Live-Fortschrittsanzeige (MB) per XMLHttpRequest!
 */
async function downloadCloudVideoBlob(videoItem, onProgressBytes) {
    // 1. Prüfen, ob das Video bereits lokal im schnellen Cache liegt
    const cached = await getCachedVideoBlob(videoItem.url);
    if (cached && cached.size > 0) {
        return cached;
    }

    const bustUrl =
        videoItem.url +
        (videoItem.url.includes('?') ? '&' : '?') +
        '_cb=' +
        Date.now();

    // 2. Download per XMLHttpRequest mit Cache-Buster & Live-Fortschritt
    try {
        const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', bustUrl, true);
            xhr.responseType = 'blob';

            xhr.onprogress = (event) => {
                const total = event.lengthComputable && event.total > 0
                    ? event.total
                    : (videoItem.sizeBytes || 0);
                if (onProgressBytes) {
                    onProgressBytes(event.loaded, total);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
                    resolve(xhr.response);
                } else {
                    reject(new Error(`HTTP ${xhr.status}`));
                }
            };

            xhr.onerror = () => reject(new Error('XHR Network Error'));
            xhr.onabort = () => reject(new Error('XHR Aborted'));
            xhr.send();
        });

        if (blob && blob.size > 0) {
            return blob;
        }
    } catch (xhrErr) {
        console.warn('XHR-Download Fallback:', xhrErr);
    }

    // 3. Fallback per fetch mit cache: 'no-store'
    try {
        const res = await fetch(bustUrl, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store'
        });
        if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 0) return blob;
        }
    } catch (fetchErr) {
        console.warn('Fetch-Download Fallback:', fetchErr);
    }

    // 4. Fallback über Firebase Storage SDK getBlob
    if (videoItem.filePath) {
        return await getBlob(ref(storage, videoItem.filePath));
    }

    throw new Error('Video konnte nicht aus dem Cloud-Speicher geladen werden.');
}

export function useStorage() {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [bytesInfo, setBytesInfo] = useState({ transferred: 0, total: 0 });
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isOptimizingId, setIsOptimizingId] = useState(null);
    const { currentUser } = useAuth();
    const smoothTimerRef = useRef(null);
    const realProgressRef = useRef(0);

    useEffect(() => {
        return () => {
            if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
        };
    }, []);

    const startSmoothProgressTimer = () => {
        if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
        smoothTimerRef.current = setInterval(() => {
            setProgress((prev) => {
                const target = realProgressRef.current;
                if (prev < target) {
                    const step = Math.max(0.6, (target - prev) * 0.25);
                    return Math.min(target, +(prev + step).toFixed(1));
                }
                if (prev < 95 && prev < target + 6) {
                    return +(prev + 0.2).toFixed(1);
                }
                return prev;
            });
        }, 120);
    };

    const stopSmoothProgressTimer = () => {
        if (smoothTimerRef.current) {
            clearInterval(smoothTimerRef.current);
            smoothTimerRef.current = null;
        }
    };

    const uploadFile = async (rawFile) => {
        if (!currentUser || !rawFile) return;

        setError(null);
        setIsUploading(true);
        setProgress(1);
        realProgressRef.current = 1;
        setBytesInfo({ transferred: 0, total: 0 });

        const isVideo = rawFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(rawFile.name);
        let file = rawFile;
        let wasCompressed = false;
        let posterBlob = null;
        const originalSizeMB = (rawFile.size / (1024 * 1024)).toFixed(1);

        if (isVideo) {
            setStatusText(`Optimiere Video auf 1080p Full-HD (${originalSizeMB} MB)...`);
            const [transcodeResult, thumbBlob] = await Promise.all([
                transcodeVideoToWebMp4(rawFile, (pct) => {
                    // Phase 1: 0% -> 55% = Hardware Full-HD Optimierung
                    const mapped = Math.max(1, Math.round(pct * 0.55));
                    realProgressRef.current = mapped;
                    setProgress(mapped);
                }),
                generateVideoPosterBlob(rawFile)
            ]);
            file = transcodeResult?.file || rawFile;
            wasCompressed = Boolean(transcodeResult?.wasCompressed || file.size < 60 * 1024 * 1024);
            posterBlob = thumbBlob;
        }

        const compressedSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setStatusText(
            isVideo && file.size < rawFile.size
                ? `Lade 1080p Full-HD Video hoch (${compressedSizeMB} MB statt ${originalSizeMB} MB)`
                : 'Lade Datei hoch'
        );
        setBytesInfo({ transferred: 0, total: file.size || 0 });
        startSmoothProgressTimer();

        const contentType = isVideo ? 'video/mp4' : (file.type || 'image/jpeg');
        const cacheControl = 'public, max-age=31536000, immutable';

        const timestamp = Date.now();
        const safeName = (file.name || 'media.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `users/${currentUser.uid}/gallery/${timestamp}_${safeName}`;
        const storageRef = ref(storage, filePath);

        let posterUploadPromise = Promise.resolve(null);
        let thumbPath = null;
        if (posterBlob) {
            thumbPath = `users/${currentUser.uid}/gallery/${timestamp}_thumb.jpg`;
            const thumbRef = ref(storage, thumbPath);
            posterUploadPromise = uploadBytes(thumbRef, posterBlob, {
                contentType: 'image/jpeg',
                cacheControl
            })
                .then((snap) => getDownloadURL(snap.ref))
                .catch(() => null);
        }

        const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType,
            cacheControl
        });

        const baseOffset = isVideo ? 55 : 0;
        const uploadSpan = isVideo ? 44 : 99;

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const total = snapshot.totalBytes || file.size || 1;
                    const ratio = snapshot.bytesTransferred / total;
                    const percentage = Math.min(99, baseOffset + ratio * uploadSpan);
                    realProgressRef.current = Math.max(realProgressRef.current, percentage);
                    setBytesInfo({ transferred: snapshot.bytesTransferred, total });
                },
                (err) => {
                    stopSmoothProgressTimer();
                    setError(err);
                    setIsUploading(false);
                    setStatusText('');
                    reject(err);
                },
                async () => {
                    try {
                        realProgressRef.current = 100;
                        setProgress(100);
                        const [url, posterUrl] = await Promise.all([
                            getDownloadURL(uploadTask.snapshot.ref),
                            posterUploadPromise
                        ]);

                        if (isVideo) {
                            await cacheVideoBlob(url, file);
                        }

                        await addDoc(collection(db, `users/${currentUser.uid}/photos`), {
                            url,
                            filePath,
                            ...(posterUrl ? { posterUrl, thumbPath } : {}),
                            name: file.name,
                            sizeBytes: file.size,
                            mimeType: contentType,
                            mediaType: isVideo ? 'video' : 'image',
                            webOptimized: isVideo ? wasCompressed : true,
                            qualityProfile: isVideo ? '1080p-hq' : 'original',
                            date: new Date().toISOString()
                        });

                        stopSmoothProgressTimer();
                        setIsUploading(false);
                        setStatusText('');
                        resolve(url);
                    } catch (err) {
                        stopSmoothProgressTimer();
                        setError(err);
                        setIsUploading(false);
                        setStatusText('');
                        reject(err);
                    }
                }
            );
        });
    };

    /**
     * Optimiert ein bereits hochgeladenes schweres Video (z.B. 231 MB / 87 MB) nachträglich
     * auf 1080p Full-HD (~35-42 MB, FastStart).
     */
    const optimizeExistingVideoInCloud = async (videoItem) => {
        if (!currentUser || !videoItem?.id || !videoItem?.url || isUploading) return null;

        try {
            setError(null);
            setIsUploading(true);
            setIsOptimizingId(videoItem.id);
            setProgress(1);
            realProgressRef.current = 1;
            setBytesInfo({ transferred: 0, total: videoItem.sizeBytes || 0 });
            setStatusText('Lade Original-Video für 1080p Full-HD Optimierung...');

            const rawBlob = await downloadCloudVideoBlob(videoItem, (loaded, total) => {
                setBytesInfo({ transferred: loaded, total: total || loaded });
                if (total > 0) {
                    const dlPct = Math.min(25, Math.max(1, Math.round((loaded / total) * 25)));
                    realProgressRef.current = dlPct;
                    setProgress(dlPct);
                }
            });

            const originalMB = (rawBlob.size / (1024 * 1024)).toFixed(1);
            setBytesInfo({ transferred: 0, total: 0 });
            setStatusText(`Optimiere ${originalMB} MB Video auf 1080p Full-HD...`);

            const [transcodeResult, posterBlob] = await Promise.all([
                transcodeVideoToWebMp4(rawBlob, (pct) => {
                    const mapped = 25 + Math.round(pct * 0.45);
                    realProgressRef.current = mapped;
                    setProgress(mapped);
                }),
                generateVideoPosterBlob(rawBlob)
            ]);

            const finalFile = transcodeResult?.file || rawBlob;
            const newMB = (finalFile.size / (1024 * 1024)).toFixed(1);
            setStatusText(`Speichere 1080p Full-HD Video (${newMB} MB statt ${originalMB} MB)...`);
            setBytesInfo({ transferred: 0, total: finalFile.size });
            startSmoothProgressTimer();

            const cacheControl = 'public, max-age=31536000, immutable';
            const timestamp = Date.now();
            const newFilePath = `users/${currentUser.uid}/gallery/${timestamp}_fullhd_${videoItem.id}.mp4`;
            const storageRef = ref(storage, newFilePath);

            let posterUploadPromise = Promise.resolve(videoItem.posterUrl || null);
            let newThumbPath = videoItem.thumbPath || null;
            if (posterBlob) {
                newThumbPath = `users/${currentUser.uid}/gallery/${timestamp}_thumb_${videoItem.id}.jpg`;
                const thumbRef = ref(storage, newThumbPath);
                posterUploadPromise = uploadBytes(thumbRef, posterBlob, {
                    contentType: 'image/jpeg',
                    cacheControl
                })
                    .then((snap) => getDownloadURL(snap.ref))
                    .catch(() => videoItem.posterUrl || null);
            }

            const uploadTask = uploadBytesResumable(storageRef, finalFile, {
                contentType: 'video/mp4',
                cacheControl
            });

            const updatedItem = await new Promise((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    (snap) => {
                        const total = snap.totalBytes || finalFile.size || 1;
                        const pct = Math.min(99, 70 + (snap.bytesTransferred / total) * 29);
                        realProgressRef.current = Math.max(realProgressRef.current, pct);
                        setBytesInfo({ transferred: snap.bytesTransferred, total });
                    },
                    reject,
                    async () => {
                        const [newUrl, newPosterUrl] = await Promise.all([
                            getDownloadURL(uploadTask.snapshot.ref),
                            posterUploadPromise
                        ]);

                        await cacheVideoBlob(newUrl, finalFile);
                        if (videoItem.url && videoItem.url !== newUrl) {
                            await evictVideoFromCache(videoItem.url);
                        }

                        const patch = {
                            url: newUrl,
                            filePath: newFilePath,
                            ...(newPosterUrl ? { posterUrl: newPosterUrl, thumbPath: newThumbPath } : {}),
                            sizeBytes: finalFile.size,
                            mimeType: 'video/mp4',
                            mediaType: 'video',
                            webOptimized: true,
                            qualityProfile: '1080p-hq'
                        };

                        await setDoc(doc(db, `users/${currentUser.uid}/photos`, videoItem.id), patch, { merge: true });

                        if (videoItem.filePath && videoItem.filePath !== newFilePath) {
                            await deleteObject(ref(storage, videoItem.filePath)).catch(() => {});
                        }

                        resolve({ ...videoItem, ...patch });
                    }
                );
            });

            stopSmoothProgressTimer();
            setIsUploading(false);
            setIsOptimizingId(null);
            setStatusText('');
            return updatedItem;
        } catch (err) {
            console.error('Fehler bei Video-Komprimierung:', err);
            stopSmoothProgressTimer();
            setError(err);
            setIsUploading(false);
            setIsOptimizingId(null);
            setStatusText('');
            throw err;
        }
    };

    const ensurePosterForExistingVideo = async (videoItem, capturedBlob) => {
        if (!currentUser || !videoItem?.id || videoItem.posterUrl || !capturedBlob) return;
        try {
            const thumbPath = `users/${currentUser.uid}/gallery/${Date.now()}_thumb_${videoItem.id}.jpg`;
            const thumbRef = ref(storage, thumbPath);
            const snap = await uploadBytes(thumbRef, capturedBlob, {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000, immutable'
            });
            const posterUrl = await getDownloadURL(snap.ref);
            await setDoc(
                doc(db, `users/${currentUser.uid}/photos`, videoItem.id),
                { posterUrl, thumbPath },
                { merge: true }
            );
        } catch {
            // ignore
        }
    };

    const deleteFile = async (id, filePath, thumbPath, url) => {
        if (!currentUser) return;
        try {
            if (url) {
                await evictVideoFromCache(url);
            }
            if (filePath) {
                const storageRef = ref(storage, filePath);
                await deleteObject(storageRef).catch(() => {});
            }
            if (thumbPath) {
                const thumbRef = ref(storage, thumbPath);
                await deleteObject(thumbRef).catch(() => {});
            }
            await deleteDoc(doc(db, `users/${currentUser.uid}/photos`, id));
        } catch (err) {
            console.error("Error deleting file:", err);
            await deleteDoc(doc(db, `users/${currentUser.uid}/photos`, id));
            setError(err);
        }
    };

    return {
        uploadFile,
        deleteFile,
        optimizeExistingVideoInCloud,
        ensurePosterForExistingVideo,
        progress,
        statusText,
        bytesInfo,
        error,
        isUploading,
        isOptimizingId
    };
}
