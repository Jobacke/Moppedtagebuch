import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, setDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function useCollection(collectionName) {
    const [data, setData] = useState([]);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, `users/${currentUser.uid}/${collectionName}`), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = [];
            snapshot.forEach(doc => {
                docs.push({ ...doc.data(), id: doc.id });
            });
            setData(docs);
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser, collectionName]);

    const add = async (item) => {
        if (!currentUser) return;
        await addDoc(collection(db, `users/${currentUser.uid}/${collectionName}`), item);
    }

    const remove = async (id) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, `users/${currentUser.uid}/${collectionName}`, id));
    }

    return { data, add, remove, loading };
}

export function useDocument(docName) {
    const [data, setData] = useState(null);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, `users/${currentUser.uid}`, docName), (docSnapshot) => {
            if (docSnapshot.exists()) {
                setData(docSnapshot.data());
            } else {
                setData(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser, docName]);

    const update = async (newData) => {
        if (!currentUser) return;
        await setDoc(doc(db, `users/${currentUser.uid}`, docName), newData, { merge: true });
    }

    return { data, update, loading };
}
