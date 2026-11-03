import { useState, useRef, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { transcodeVideoToWebMp4, generateVideoPosterBlob } from '../utils/videoOptimizer';

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
            setStatusText(`Komprimiere Video (${originalSizeMB} MB → HD-Stream)`);
            const [transcodeResult, thumbBlob] = await Promise.all([
                transcodeVideoToWebMp4(rawFile, (pct) => {
                    // Phase 1: 0% -> 55% = Hardware-Komprimierung
                    const mapped = Math.max(1, Math.round(pct * 0.55));
                    realProgressRef.current = mapped;
                    setProgress(mapped);
                }),
                generateVideoPosterBlob(rawFile)
            ]);
            file = transcodeResult?.file || rawFile;
            wasCompressed = Boolean(transcodeResult?.wasCompressed || file.size < 25 * 1024 * 1024);
            posterBlob = thumbBlob;
        }

        const compressedSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setStatusText(
            isVideo && file.size < rawFile.size
                ? `Lade optimiertes HD-Video hoch (${compressedSizeMB} MB statt ${originalSizeMB} MB)`
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

        // Upload Poster Thumbnail in parallel if available
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

                        await addDoc(collection(db, `users/${currentUser.uid}/photos`), {
                            url,
                            filePath,
                            ...(posterUrl ? { posterUrl, thumbPath } : {}),
                            name: file.name,
                            sizeBytes: file.size,
                            mimeType: contentType,
                            mediaType: isVideo ? 'video' : 'image',
                            webOptimized: isVideo ? wasCompressed : true,
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
     * Optimiert ein bereits hochgeladenes schweres Video (z.B. 134 MB) nachträglich:
     * Lädt es herunter, komprimiert es auf schlankes 720p HD (~2,4 Mbps, FastStart),
     * ersetzt die Datei in Firebase Storage und aktualisiert den Firestore-Eintrag.
     */
    const optimizeExistingVideoInCloud = async (videoItem) => {
        if (!currentUser || !videoItem?.id || !videoItem?.url || isUploading) return null;

        try {
            setError(null);
            setIsUploading(true);
            setIsOptimizingId(videoItem.id);
            setProgress(2);
            realProgressRef.current = 2;
            setBytesInfo({ transferred: 0, total: 0 });
            setStatusText('Lade Original-Video für HD-Komprimierung...');

            const response = await fetch(videoItem.url);
            const rawBlob = await response.blob();
            const originalMB = (rawBlob.size / (1024 * 1024)).toFixed(1);

            setStatusText(`Komprimiere ${originalMB} MB Video auf flüssiges HD...`);
            const [transcodeResult, posterBlob] = await Promise.all([
                transcodeVideoToWebMp4(rawBlob, (pct) => {
                    const mapped = 10 + Math.round(pct * 0.55);
                    realProgressRef.current = mapped;
                    setProgress(mapped);
                }),
                generateVideoPosterBlob(rawBlob)
            ]);

            const finalFile = transcodeResult?.file || rawBlob;
            const wasCompressed = Boolean(transcodeResult?.wasCompressed || finalFile.size < 25 * 1024 * 1024);
            const newMB = (finalFile.size / (1024 * 1024)).toFixed(1);
            setStatusText(`Speichere optimiertes Video (${newMB} MB statt ${originalMB} MB)...`);
            setBytesInfo({ transferred: 0, total: finalFile.size });
            startSmoothProgressTimer();

            const cacheControl = 'public, max-age=31536000, immutable';
            const timestamp = Date.now();
            const newFilePath = `users/${currentUser.uid}/gallery/${timestamp}_hd_${videoItem.id}.mp4`;
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
                        const pct = Math.min(99, 65 + (snap.bytesTransferred / total) * 34);
                        realProgressRef.current = Math.max(realProgressRef.current, pct);
                        setBytesInfo({ transferred: snap.bytesTransferred, total });
                    },
                    reject,
                    async () => {
                        const [newUrl, newPosterUrl] = await Promise.all([
                            getDownloadURL(uploadTask.snapshot.ref),
                            posterUploadPromise
                        ]);

                        const patch = {
                            url: newUrl,
                            filePath: newFilePath,
                            ...(newPosterUrl ? { posterUrl: newPosterUrl, thumbPath: newThumbPath } : {}),
                            sizeBytes: finalFile.size,
                            mimeType: 'video/mp4',
                            mediaType: 'video',
                            webOptimized: wasCompressed
                        };

                        await setDoc(doc(db, `users/${currentUser.uid}/photos`, videoItem.id), patch, { merge: true });

                        // Alte 134-MB-Datei aus dem Cloud-Speicher löschen, um Speicherplatz freizugeben!
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

    const deleteFile = async (id, filePath, thumbPath) => {
        if (!currentUser) return;
        try {
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
