import { useState, useRef, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ensureFastStartMp4, generateVideoPosterBlob } from '../utils/videoOptimizer';

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

    const uploadFile = async (rawFile) => {
        if (!currentUser || !rawFile) return;

        setError(null);
        setIsUploading(true);
        setProgress(1);
        realProgressRef.current = 1;

        const isVideo = rawFile.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(rawFile.name);
        let file = rawFile;
        let posterBlob = null;

        if (isVideo) {
            setStatusText('Optimiere Video für Sofort-Wiedergabe...');
            const [optimizedFile, thumbBlob] = await Promise.all([
                ensureFastStartMp4(rawFile),
                generateVideoPosterBlob(rawFile)
            ]);
            file = optimizedFile || rawFile;
            posterBlob = thumbBlob;
        }

        setStatusText('Lade Datei hoch');
        setBytesInfo({ transferred: 0, total: file.size || 0 });

        // Smooth visual progress between 256 KB chunk callbacks from Firebase Storage
        if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
        smoothTimerRef.current = setInterval(() => {
            setProgress((prev) => {
                const target = realProgressRef.current;
                if (prev < target) {
                    const step = Math.max(0.6, (target - prev) * 0.25);
                    return Math.min(target, +(prev + step).toFixed(1));
                }
                // Gentle creep while a chunk is in flight so the bar never looks frozen
                if (prev < 95 && prev < target + 8) {
                    return +(prev + 0.25).toFixed(1);
                }
                return prev;
            });
        }, 120);

        const contentType = isVideo ? 'video/mp4' : (file.type || 'image/jpeg');
        const cacheControl = 'public, max-age=31536000, immutable';

        // Create a unique file name
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
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

        // Upload Task with explicit contentType & 1-year browser cache metadata
        const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType,
            cacheControl
        });

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const total = snapshot.totalBytes || file.size || 1;
                    const percentage = Math.min(99, (snapshot.bytesTransferred / total) * 100);
                    realProgressRef.current = Math.max(realProgressRef.current, percentage);
                    setBytesInfo({ transferred: snapshot.bytesTransferred, total });
                },
                (err) => {
                    if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
                    setError(err);
                    setIsUploading(false);
                    setStatusText('');
                    reject(err);
                },
                async () => {
                    // Upload complete
                    try {
                        realProgressRef.current = 100;
                        setProgress(100);
                        const [url, posterUrl] = await Promise.all([
                            getDownloadURL(uploadTask.snapshot.ref),
                            posterUploadPromise
                        ]);

                        // Save reference to Firestore (so we can list it easily)
                        await addDoc(collection(db, `users/${currentUser.uid}/photos`), {
                            url,
                            filePath,
                            ...(posterUrl ? { posterUrl, thumbPath } : {}),
                            name: file.name,
                            mimeType: contentType,
                            mediaType: isVideo ? 'video' : 'image',
                            fastStart: isVideo,
                            date: new Date().toISOString()
                        });

                        if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
                        setIsUploading(false);
                        setStatusText('');
                        resolve(url);
                    } catch (err) {
                        if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
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
     * Erzeugt für bereits hochgeladene Videos nachträglich das Vorschaubild (Poster),
     * damit das Galerie-Raster keine großen Videodateien mehr vorladen muss.
     */
    const ensurePosterForExistingVideo = async (videoItem, capturedBlob) => {
        if (!currentUser || !videoItem?.id || videoItem.posterUrl || !capturedBlob) return;
        try {
            setIsOptimizingId(videoItem.id);
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
        } catch (err) {
            console.warn('Automatisches Thumbnail-Update übersprungen:', err);
        } finally {
            setIsOptimizingId(null);
        }
    };

    const deleteFile = async (id, filePath, thumbPath) => {
        if (!currentUser) return;
        try {
            // 1. Delete from Storage
            if (filePath) {
                const storageRef = ref(storage, filePath);
                await deleteObject(storageRef).catch(() => {});
            }
            if (thumbPath) {
                const thumbRef = ref(storage, thumbPath);
                await deleteObject(thumbRef).catch(() => {});
            }

            // 2. Delete from Firestore
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
        ensurePosterForExistingVideo,
        progress,
        statusText,
        bytesInfo,
        error,
        isUploading,
        isOptimizingId
    };
}
