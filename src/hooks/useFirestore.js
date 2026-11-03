import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    setDoc,
    orderBy,
    getDocFromServer,
    getDocsFromServer,
    getDoc,
    getDocs
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export function triggerManualFirestoreRefresh() {
    window.dispatchEvent(new CustomEvent('mopped-force-refresh'));
}

export function useCollection(collectionName) {
    const [data, setData] = useState([]);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshTick, setRefreshTick] = useState(0);

    const fetchFreshCollection = useCallback(async () => {
        if (!currentUser) return;
        const q = query(collection(db, `users/${currentUser.uid}/${collectionName}`), orderBy('date', 'desc'));
        try {
            const snapshot = await getDocsFromServer(q);
            const docs = [];
            snapshot.forEach(d => docs.push({ ...d.data(), id: d.id }));
            setData(docs);
            setLoading(false);
        } catch {
            try {
                const snapshot = await getDocs(q);
                const docs = [];
                snapshot.forEach(d => docs.push({ ...d.data(), id: d.id }));
                setData(docs);
                setLoading(false);
            } catch (e) {
                console.warn('Collection fetch error:', e);
            }
        }
    }, [currentUser, collectionName]);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        fetchFreshCollection();

        const q = query(collection(db, `users/${currentUser.uid}/${collectionName}`), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(
            q,
            { includeMetadataChanges: true },
            (snapshot) => {
                const docs = [];
                snapshot.forEach(d => {
                    docs.push({ ...d.data(), id: d.id });
                });
                setData(docs);
                setLoading(false);
            },
            () => {
                fetchFreshCollection();
            }
        );

        const handleWakeUp = () => {
            if (document.visibilityState === 'visible') {
                fetchFreshCollection();
            }
        };

        const handleManualRefresh = () => {
            fetchFreshCollection();
            setRefreshTick(t => t + 1);
        };

        document.addEventListener('visibilitychange', handleWakeUp);
        window.addEventListener('focus', fetchFreshCollection);
        window.addEventListener('pageshow', fetchFreshCollection);
        window.addEventListener('online', fetchFreshCollection);
        window.addEventListener('mopped-force-refresh', handleManualRefresh);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleWakeUp);
            window.removeEventListener('focus', fetchFreshCollection);
            window.removeEventListener('pageshow', fetchFreshCollection);
            window.removeEventListener('online', fetchFreshCollection);
            window.removeEventListener('mopped-force-refresh', handleManualRefresh);
        };
    }, [currentUser, collectionName, fetchFreshCollection, refreshTick]);

    const add = async (item) => {
        if (!currentUser) return;
        await addDoc(collection(db, `users/${currentUser.uid}/${collectionName}`), item);
        await fetchFreshCollection();
    };

    const remove = async (id) => {
        if (!currentUser) return;
        await deleteDoc(doc(db, `users/${currentUser.uid}/${collectionName}`, id));
        await fetchFreshCollection();
    };

    return { data, add, remove, loading, refresh: fetchFreshCollection };
}

export function useDocument(docName) {
    const [data, setData] = useState(null);
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshTick, setRefreshTick] = useState(0);

    const fetchFreshDoc = useCallback(async () => {
        if (!currentUser) return;
        const docRef = doc(db, `users/${currentUser.uid}/data`, docName);
        try {
            const snap = await getDocFromServer(docRef);
            if (snap.exists()) {
                setData(snap.data());
            }
            setLoading(false);
        } catch {
            try {
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setData(snap.data());
                }
                setLoading(false);
            } catch (e) {
                console.warn('Doc fetch error:', e);
            }
        }
    }, [currentUser, docName]);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        fetchFreshDoc();

        const docRef = doc(db, `users/${currentUser.uid}/data`, docName);
        const unsubscribe = onSnapshot(
            docRef,
            { includeMetadataChanges: true },
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    setData(docSnapshot.data());
                } else {
                    setData(null);
                }
                setLoading(false);
            },
            () => {
                fetchFreshDoc();
            }
        );

        const handleWakeUp = () => {
            if (document.visibilityState === 'visible') {
                fetchFreshDoc();
            }
        };

        const handleManualRefresh = () => {
            fetchFreshDoc();
            setRefreshTick(t => t + 1);
        };

        document.addEventListener('visibilitychange', handleWakeUp);
        window.addEventListener('focus', fetchFreshDoc);
        window.addEventListener('pageshow', fetchFreshDoc);
        window.addEventListener('online', fetchFreshDoc);
        window.addEventListener('mopped-force-refresh', handleManualRefresh);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleWakeUp);
            window.removeEventListener('focus', fetchFreshDoc);
            window.removeEventListener('pageshow', fetchFreshDoc);
            window.removeEventListener('online', fetchFreshDoc);
            window.removeEventListener('mopped-force-refresh', handleManualRefresh);
        };
    }, [currentUser, docName, fetchFreshDoc, refreshTick]);

    const update = async (newData) => {
        if (!currentUser) return;
        await setDoc(doc(db, `users/${currentUser.uid}/data`, docName), newData, { merge: true });
        await fetchFreshDoc();
    };

    return { data, update, loading, refresh: fetchFreshDoc };
}
