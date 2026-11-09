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
    getDocsFromServer
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

/*
 * Gemeinsamer Daten-Store: pro Firestore-Pfad genau EIN Live-Listener, egal wie viele
 * Komponenten die Daten nutzen. Manuelle Aktualisierungen laufen je Pfad nacheinander
 * (nie parallel). Fehler werden nicht verschluckt, sondern als `error` weitergegeben.
 */

const entries = new Map();

function getEntry(key) {
    if (!entries.has(key)) {
        entries.set(key, {
            key,
            data: undefined,
            loading: true,
            error: null,
            subscribers: new Set(),
            unsubscribe: null,
            refreshing: null,
            retryTimer: null
        });
    }
    return entries.get(key);
}

function emit(entry) {
    entry.subscribers.forEach((fn) => fn());
}

function setEntry(entry, patch) {
    Object.assign(entry, patch);
    emit(entry);
}

function readCollectionSnapshot(snapshot) {
    const docs = [];
    snapshot.forEach((d) => docs.push({ ...d.data(), id: d.id }));
    return docs;
}

function startListener(entry, spec) {
    if (entry.unsubscribe) return;
    const onError = (err) => {
        console.error(`Firestore-Fehler (${entry.key}):`, err);
        if (entry.unsubscribe) {
            entry.unsubscribe();
            entry.unsubscribe = null;
        }
        setEntry(entry, { error: err, loading: false });
        // Automatisch neu verbinden, solange jemand die Daten braucht
        clearTimeout(entry.retryTimer);
        entry.retryTimer = setTimeout(() => {
            if (entry.subscribers.size) startListener(entry, spec);
        }, 5000);
    };

    if (spec.kind === 'collection') {
        const q = query(collection(db, spec.path), orderBy('date', 'desc'));
        entry.unsubscribe = onSnapshot(
            q,
            (snapshot) => setEntry(entry, { data: readCollectionSnapshot(snapshot), loading: false, error: null }),
            onError
        );
    } else {
        entry.unsubscribe = onSnapshot(
            doc(db, spec.path),
            (snap) => setEntry(entry, { data: snap.exists() ? snap.data() : null, loading: false, error: null }),
            onError
        );
    }
}

function stopListener(entry) {
    clearTimeout(entry.retryTimer);
    if (entry.unsubscribe) {
        entry.unsubscribe();
        entry.unsubscribe = null;
    }
}

async function refreshEntry(entry, spec) {
    if (entry.refreshing) return entry.refreshing;
    entry.refreshing = (async () => {
        try {
            if (spec.kind === 'collection') {
                const q = query(collection(db, spec.path), orderBy('date', 'desc'));
                const snapshot = await getDocsFromServer(q);
                setEntry(entry, { data: readCollectionSnapshot(snapshot), loading: false, error: null });
            } else {
                const snap = await getDocFromServer(doc(db, spec.path));
                setEntry(entry, { data: snap.exists() ? snap.data() : null, loading: false, error: null });
            }
            // Listener nach einem Fehler wieder aufnehmen
            if (!entry.unsubscribe && entry.subscribers.size) startListener(entry, spec);
        } catch (err) {
            // Offline o. Ä.: vorhandene Daten behalten, Listener liefert später nach
            console.warn(`Aktualisierung fehlgeschlagen (${entry.key}):`, err?.code || err);
            if (entry.data === undefined) setEntry(entry, { error: err, loading: false });
        } finally {
            entry.refreshing = null;
        }
    })();
    return entry.refreshing;
}

function refreshAll() {
    entries.forEach((entry) => {
        if (entry.subscribers.size && entry.spec) refreshEntry(entry, entry.spec);
    });
}

// Globale Auslöser – einmalig registriert statt pro Komponente
let globalHandlersInstalled = false;
function installGlobalHandlers() {
    if (globalHandlersInstalled || typeof window === 'undefined') return;
    globalHandlersInstalled = true;
    let last = 0;
    const throttled = () => {
        const now = Date.now();
        if (now - last < 3000) return;
        last = now;
        refreshAll();
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') throttled();
    });
    window.addEventListener('pageshow', throttled);
    window.addEventListener('online', throttled);
    window.addEventListener('mopped-force-refresh', throttled);
}

export function triggerManualFirestoreRefresh() {
    window.dispatchEvent(new CustomEvent('mopped-force-refresh'));
}

function useStoreEntry(spec) {
    const key = spec ? `${spec.kind}:${spec.path}` : null;
    const [, force] = useState(0);

    useEffect(() => {
        if (!spec) return undefined;
        installGlobalHandlers();
        const entry = getEntry(key);
        entry.spec = spec;
        const rerender = () => force((n) => n + 1);
        entry.subscribers.add(rerender);
        startListener(entry, spec);
        rerender();
        return () => {
            entry.subscribers.delete(rerender);
            if (!entry.subscribers.size) {
                // Kurz verzögert stoppen, damit Seitenwechsel keinen Neuaufbau auslöst
                setTimeout(() => {
                    if (!entry.subscribers.size) stopListener(entry);
                }, 30000);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return key ? getEntry(key) : null;
}

export function useCollection(collectionName) {
    const { currentUser } = useAuth();
    const path = currentUser ? `users/${currentUser.uid}/${collectionName}` : null;
    const entry = useStoreEntry(path ? { kind: 'collection', path } : null);

    const refresh = useCallback(() => (entry ? refreshEntry(entry, entry.spec) : Promise.resolve()), [entry]);

    const add = async (item) => {
        if (!path) return;
        await addDoc(collection(db, path), item);
        await refresh();
    };

    const remove = async (id) => {
        if (!path) return;
        await deleteDoc(doc(db, path, id));
        await refresh();
    };

    const update = async (id, patch) => {
        if (!path || !id) return;
        await setDoc(doc(db, path, id), patch, { merge: true });
        await refresh();
    };

    return {
        data: entry?.data || [],
        loading: currentUser ? (entry ? entry.loading : true) : false,
        error: entry?.error || null,
        add,
        remove,
        update,
        refresh
    };
}

export function useDocument(docName) {
    const { currentUser } = useAuth();
    const path = currentUser ? `users/${currentUser.uid}/data/${docName}` : null;
    const entry = useStoreEntry(path ? { kind: 'doc', path } : null);

    const refresh = useCallback(() => (entry ? refreshEntry(entry, entry.spec) : Promise.resolve()), [entry]);

    const update = useCallback(async (newData) => {
        if (!path) return;
        await setDoc(doc(db, path), newData, { merge: true });
        await refresh();
    }, [path, refresh]);

    return {
        data: entry?.data ?? null,
        loading: currentUser ? (entry ? entry.loading : true) : false,
        error: entry?.error || null,
        update,
        refresh
    };
}
