import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import BikeEmblem from '../components/BikeEmblem';

const AuthContext = createContext();

const REQUIRE_AUTH_KEY = 'mopped_require_auth';
const AUTO_AUTH_KEY = 'mopped_auto_auth_v1';
const DEFAULT_JOHANNES_USER = {
    uid: 'johannes_default',
    email: 'backhaus.johannes@gmail.com',
    displayName: 'Johannes',
    isDefaultUser: true
};

// Synchronously absorb #board_mopped_auth=... from Board parent window if present
(function absorbBoardHashAuth() {
    if (typeof window === 'undefined') return;
    try {
        const hash = window.location.hash || '';
        const m = hash.match(/[#&]board_mopped_auth=([^&]+)/);
        if (m) {
            const raw = decodeURIComponent(m[1]);
            if (raw) {
                localStorage.setItem(AUTO_AUTH_KEY, raw);
            }
            const cleaned = hash
                .replace(/([#&])board_mopped_auth=[^&]+&?/, '$1')
                .replace(/[?&]+$/, '');
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search + (cleaned === '#' ? '' : cleaned));
        }
    } catch {}
})();

function saveAutoAuth(email, password) {
    if (!email || !password) return;
    try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ e: email.trim(), p: password }))));
        localStorage.setItem(AUTO_AUTH_KEY, encoded);
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'board-storage-set', key: AUTO_AUTH_KEY, value: encoded }, '*');
        }
    } catch {}
}

function getSavedAutoAuth() {
    try {
        const raw = localStorage.getItem(AUTO_AUTH_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (parsed && parsed.e && parsed.p) return parsed;
    } catch {}
    return null;
}

export function isAuthRequired() {
    try { return localStorage.getItem(REQUIRE_AUTH_KEY) === 'true'; } catch { return false; }
}

export function setAuthRequiredStorage(val) {
    try {
        if (val) localStorage.setItem(REQUIRE_AUTH_KEY, 'true');
        else localStorage.removeItem(REQUIRE_AUTH_KEY);
    } catch {}
}

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [requireAuth, setRequireAuthState] = useState(() => isAuthRequired());
    const [forceLogin, setForceLogin] = useState(false);
    const [loading, setLoading] = useState(true);

    const setRequireAuth = (val) => {
        setAuthRequiredStorage(val);
        setRequireAuthState(Boolean(val));
    };

    async function signup(email, password) {
        setForceLogin(false);
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        saveAutoAuth(email, password);
        return cred;
    }

    async function login(email, password) {
        setForceLogin(false);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        saveAutoAuth(email, password);
        return cred;
    }

    async function logout() {
        setForceLogin(true);
        if (firebaseUser) {
            await signOut(auth);
        }
    }

    function skipLogin() {
        setForceLogin(false);
        setRequireAuth(false);
    }

    useEffect(() => {
        let autoLoginAttempted = false;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setFirebaseUser(user);
                setForceLogin(false);
                try {
                    localStorage.setItem('mopped_last_uid', user.uid);
                    const existingEncoded = localStorage.getItem(AUTO_AUTH_KEY);
                    if (existingEncoded && typeof window !== 'undefined' && window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'board-storage-set', key: AUTO_AUTH_KEY, value: existingEncoded }, '*');
                    }
                } catch {}
                setLoading(false);
                return;
            }
            if (!autoLoginAttempted && !isAuthRequired()) {
                autoLoginAttempted = true;
                const saved = getSavedAutoAuth();
                if (saved) {
                    try {
                        await signInWithEmailAndPassword(auth, saved.e, saved.p);
                        return;
                    } catch {
                        // Fall through to default user if background sign-in fails
                    }
                }
            }
            setFirebaseUser(null);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
        const onMessage = async (event) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'board-storage-value' && data.key === AUTO_AUTH_KEY && data.value) {
                try {
                    localStorage.setItem(AUTO_AUTH_KEY, data.value);
                    if (!auth?.currentUser && !isAuthRequired()) {
                        const saved = getSavedAutoAuth();
                        if (saved) {
                            await signInWithEmailAndPassword(auth, saved.e, saved.p);
                        }
                    }
                } catch {}
            }
        };
        window.addEventListener('message', onMessage);
        try {
            window.parent.postMessage({ type: 'board-storage-get', key: AUTO_AUTH_KEY }, '*');
        } catch {}
        return () => window.removeEventListener('message', onMessage);
    }, []);

    const currentUser = firebaseUser || ((!requireAuth && !forceLogin) ? DEFAULT_JOHANNES_USER : null);

    const value = {
        currentUser,
        firebaseUser,
        requireAuth,
        setRequireAuth,
        skipLogin,
        login,
        signup,
        logout
    };

    if (loading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
            }}>
                <div style={{ marginBottom: '1.4rem' }}><BikeEmblem size={170} state="pulse" /></div>
                <p>Lade Moppedtagebuch...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
