import { useState, useRef, useEffect } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function useStorage() {
    const [progress, setProgress] = useState(0);
    const [bytesInfo, setBytesInfo] = useState({ transferred: 0, total: 0 });
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const { currentUser } = useAuth();
    const smoothTimerRef = useRef(null);
    const realProgressRef = useRef(0);

    useEffect(() => {
        return () => {
            if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
        };
    }, []);

    const uploadFile = async (file) => {
        if (!currentUser) return;

        setError(null);
        setIsUploading(true);
        setProgress(1);
        realProgressRef.current = 1;
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

        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(file.name);
        const contentType = file.type || (isVideo ? 'video/mp4' : 'image/jpeg');

        // Create a unique file name
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `users/${currentUser.uid}/gallery/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, filePath);

        // Upload Task with explicit contentType metadata
        const uploadTask = uploadBytesResumable(storageRef, file, { contentType });

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
                    reject(err);
                },
                async () => {
                    // Upload complete
                    try {
                        realProgressRef.current = 100;
                        setProgress(100);
                        const url = await getDownloadURL(uploadTask.snapshot.ref);

                        // Save reference to Firestore (so we can list it easily)
                        await addDoc(collection(db, `users/${currentUser.uid}/photos`), {
                            url,
                            filePath,
                            name: file.name,
                            mimeType: contentType,
                            mediaType: isVideo ? 'video' : 'image',
                            date: new Date().toISOString()
                        });

                        if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
                        setIsUploading(false);
                        resolve(url);
                    } catch (err) {
                        if (smoothTimerRef.current) clearInterval(smoothTimerRef.current);
                        setError(err);
                        setIsUploading(false);
                        reject(err);
                    }
                }
            );
        });
    };

    const deleteFile = async (id, filePath) => {
        if (!currentUser) return;
        try {
            // 1. Delete from Storage
            const storageRef = ref(storage, filePath);
            await deleteObject(storageRef);

            // 2. Delete from Firestore
            await deleteDoc(doc(db, `users/${currentUser.uid}/photos`, id));
        } catch (err) {
            console.error("Error deleting file:", err);
            // Even if storage delete fails (e.g. not found), try to delete data doc
            await deleteDoc(doc(db, `users/${currentUser.uid}/photos`, id));
            setError(err);
        }
    };

    return { uploadFile, deleteFile, progress, bytesInfo, error, isUploading };
}
