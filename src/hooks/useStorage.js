import { useState } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function useStorage() {
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const { currentUser } = useAuth();

    const uploadFile = async (file) => {
        if (!currentUser) return;

        setError(null);
        setIsUploading(true);
        setProgress(0);

        // Create a unique file name
        const filePath = `users/${currentUser.uid}/gallery/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);

        // Upload Task
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const percentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(percentage);
                },
                (err) => {
                    setError(err);
                    setIsUploading(false);
                    reject(err);
                },
                async () => {
                    // Upload complete
                    try {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);

                        // Save reference to Firestore (so we can list it easily)
                        await addDoc(collection(db, `users/${currentUser.uid}/photos`), {
                            url,
                            filePath,
                            name: file.name,
                            date: new Date().toISOString()
                        });

                        setIsUploading(false);
                        resolve(url);
                    } catch (err) {
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

    return { uploadFile, deleteFile, progress, error, isUploading };
}
