import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bike } from 'lucide-react';

export default function Login() {
    const emailRef = useRef();
    const passwordRef = useRef();
    const { login, signup } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isLogin, setIsLogin] = useState(true);

    async function handleSubmit(e) {
        e.preventDefault();

        try {
            setError('');
            setLoading(true);
            if (isLogin) {
                await login(emailRef.current.value, passwordRef.current.value);
            } else {
                await signup(emailRef.current.value, passwordRef.current.value);
            }
        } catch (err) {
            console.error(err);
            setError('Fehler beim Anmelden: ' + err.message);
        }
        setLoading(false);
    }

    return (
        <div className="fade-in" style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
        }}>
            <div className="paint-panel" style={{ width: '100%', maxWidth: 420, padding: '2rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="brand-mark" style={{ width: 72, height: 72, borderRadius: 24, marginBottom: '1.2rem' }}>
                        <Bike size={36} />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.6rem' }}>{isLogin ? 'Willkommen zurück' : 'Konto erstellen'}</h2>
                    <p style={{ margin: '0.35rem 0 1.6rem', color: 'var(--text-secondary)' }}>Dein Moppedtagebuch – synchron auf allen Geräten</p>
                </div>

                {error && (
                    <div className="status-pill status-danger" role="alert" style={{ display: 'flex', borderRadius: 14, padding: '10px 12px', marginBottom: '1rem', justifyContent: 'center', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <label className="field">
                        <span className="field-label">E-Mail-Adresse</span>
                        <input type="email" ref={emailRef} className="input-field" autoComplete="email" required />
                    </label>
                    <label className="field">
                        <span className="field-label">Passwort</span>
                        <input type="password" ref={passwordRef} className="input-field" autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength="6" />
                    </label>

                    <button disabled={loading} className="primary-btn" type="submit" style={{ marginTop: '0.6rem' }}>
                        {loading ? 'Bitte warten …' : isLogin ? 'Anmelden' : 'Registrieren'}
                    </button>
                </form>

                <p style={{ margin: '1.4rem 0 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {isLogin ? 'Kein Konto?' : 'Bereits registriert?'}
                    <button type="button" className="link-btn" onClick={() => setIsLogin(!isLogin)} style={{ marginLeft: '0.4rem' }}>
                        {isLogin ? 'Registrieren' : 'Anmelden'}
                    </button>
                </p>
            </div>
        </div>
    );
}
