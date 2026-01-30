import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Bike } from 'lucide-react';

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
        <div className="login-container" style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'radial-gradient(circle at top right, #1a2a1a 0%, var(--bg-primary) 40%)'
        }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    background: 'rgba(105, 190, 40, 0.2)',
                    padding: '20px',
                    borderRadius: '50%',
                    marginBottom: '1.5rem',
                    color: 'var(--kawasaki-green)'
                }}>
                    <Bike size={48} />
                </div>

                <h2 style={{ margin: '0 0 2rem 0', color: 'var(--text-primary)' }}>
                    {isLogin ? 'Willkommen zurück' : 'Konto erstellen'}
                </h2>

                {error && <div style={{
                    background: 'rgba(255, 77, 79, 0.2)',
                    color: '#ff4d4f',
                    padding: '10px',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    width: '100%',
                    textAlign: 'center'
                }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                    <input
                        type="email"
                        ref={emailRef}
                        placeholder="E-Mail Adresse"
                        className="input-field"
                        required
                    />
                    <input
                        type="password"
                        ref={passwordRef}
                        placeholder="Passwort"
                        className="input-field"
                        required
                        minLength="6"
                    />

                    <button disabled={loading} className="primary-btn" type="submit" style={{ marginTop: '1rem' }}>
                        {isLogin ? 'Anmelden' : 'Registrieren'}
                    </button>
                </form>

                <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
                    {isLogin ? 'Kein Konto?' : 'Bereits registriert?'}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        style={{
                            background: 'none',
                            color: 'var(--kawasaki-green)',
                            fontWeight: 'bold',
                            marginLeft: '0.5rem',
                            textDecoration: 'underline'
                        }}
                    >
                        {isLogin ? 'Registrieren' : 'Anmelden'}
                    </button>
                </p>
            </div>
        </div>
    );
}
