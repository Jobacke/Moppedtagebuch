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

        // Path: users/{uid}/{collectionName} (3 segments - Valid for Collection)
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

        // Path: users/{uid}/data/{docName} (4 segments - Valid for Document)
        // We added 'data' intermediate collection to resolve the "odd segments" error
        const unsubscribe = onSnapshot(doc(db, `users/${currentUser.uid}/data`, docName), (docSnapshot) => {
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
        await setDoc(doc(db, `users/${currentUser.uid}/data`, docName), newData, { merge: true });
    }

    return { data, update, loading };
}
