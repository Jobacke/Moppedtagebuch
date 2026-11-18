import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import BikeEmblem from '../components/BikeEmblem';

const AuthContext = createContext();

const REQUIRE_AUTH_KEY = 'mopped_require_auth';
const DEFAULT_JOHANNES_USER = {
    uid: 'johannes_default',
    email: 'backhaus.johannes@gmail.com',
    displayName: 'Johannes',
    isDefaultUser: true
};

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

    function signup(email, password) {
        setForceLogin(false);
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        setForceLogin(false);
        return signInWithEmailAndPassword(auth, email, password);
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
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
            if (user) {
                setForceLogin(false);
                try { localStorage.setItem('mopped_last_uid', user.uid); } catch {}
            }
            setLoading(false);
        });

        return unsubscribe;
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
