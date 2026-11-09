import React, { useEffect, useState } from 'react';
import { Lock, Delete, KeyRound } from 'lucide-react';
import { getLockout, registerFailedAttempt, resetFailedAttempts } from '../utils/pin';

/**
 * PIN-Tastatur.
 * mode="unlock": onUnlock(pin) → Promise<boolean>
 * mode="setup":  PIN zweimal eingeben → onSetPin(pin) → Promise
 */
const PinLock = ({ mode = 'unlock', onUnlock, onSetPin }) => {
    const isSetup = mode === 'setup';
    const [pin, setPin] = useState('');
    const [firstPin, setFirstPin] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [shake, setShake] = useState(false);
    const [lockUntil, setLockUntil] = useState(() => getLockout().until);
    const [now, setNow] = useState(Date.now());

    const lockedSeconds = Math.max(0, Math.ceil((lockUntil - now) / 1000));

    useEffect(() => {
        if (!lockedSeconds) return undefined;
        const t = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(t);
    }, [lockedSeconds]);

    const fail = (message) => {
        setError(message);
        setShake(true);
        setTimeout(() => {
            setPin('');
            setShake(false);
        }, 600);
    };

    const submit = async (value) => {
        setBusy(true);
        try {
            if (isSetup) {
                if (firstPin === null) {
                    setFirstPin(value);
                    setPin('');
                    return;
                }
                if (value !== firstPin) {
                    setFirstPin(null);
                    fail('PINs stimmen nicht überein – bitte neu festlegen');
                    return;
                }
                await onSetPin(value);
                return;
            }

            const ok = await onUnlock(value);
            if (ok) {
                resetFailedAttempts();
            } else {
                const state = registerFailedAttempt();
                setLockUntil(state.until);
                setNow(Date.now());
                fail(state.until ? 'Zu viele Fehlversuche' : 'Falscher PIN – bitte erneut versuchen');
            }
        } catch (e) {
            console.error('PIN-Fehler:', e);
            fail('Fehler – bitte erneut versuchen');
        } finally {
            setBusy(false);
        }
    };

    const handleInput = (num) => {
        if (busy || lockedSeconds || pin.length >= 4) return;
        if (error) setError('');
        const next = pin + num;
        setPin(next);
        if (next.length === 4) setTimeout(() => submit(next), 120);
    };

    const handleDelete = () => {
        if (!busy) setPin(pin.slice(0, -1));
    };

    // Hardware-Tastatur (Desktop)
    useEffect(() => {
        const onKey = (e) => {
            if (/^\d$/.test(e.key)) handleInput(e.key);
            else if (e.key === 'Backspace') handleDelete();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    let title = 'PIN eingeben';
    if (isSetup) title = firstPin === null ? 'Neuen 4-stelligen PIN festlegen' : 'PIN zur Bestätigung wiederholen';
    if (lockedSeconds) title = `Gesperrt – noch ${lockedSeconds} s`;

    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];
    const disabled = busy || Boolean(lockedSeconds);

    return (
        <div className="pin-container fade-in" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100dvh',
            padding: '2rem 1rem'
        }}>
            <div className={`brand-mark ${shake ? 'shake' : ''}`} style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                marginBottom: '1.25rem',
                color: error ? 'var(--danger)' : 'var(--accent-contrast)'
            }}>
                {isSetup ? <KeyRound size={32} /> : <Lock size={32} />}
            </div>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.4rem' }}>Moppedtagebuch</h2>
            <p style={{ margin: '0 0 0.4rem', textAlign: 'center', color: error || lockedSeconds ? 'var(--danger)' : 'var(--text-secondary)' }} aria-live="polite">
                {lockedSeconds ? title : (error || title)}
            </p>
            <p style={{ margin: '0 0 1.8rem', minHeight: '1.2em', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 300 }}>
                {isSetup ? 'Der PIN wird verschlüsselt in deinem Konto gespeichert.' : ''}
            </p>

            <div style={{ display: 'flex', gap: '1.1rem', marginBottom: '2.5rem' }} aria-label={`${pin.length} von 4 Ziffern`}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: i < pin.length ? 'var(--metal-silver)' : 'transparent',
                        border: '1.5px solid ' + (shake ? 'var(--danger)' : 'var(--metal-300)'),
                        transition: 'all 0.2s',
                        transform: i < pin.length ? 'scale(1.1)' : 'scale(1)'
                    }} />
                ))}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 76px)',
                gap: '1.1rem 1.6rem',
                justifyContent: 'center',
                opacity: lockedSeconds ? 0.4 : 1,
                transition: 'opacity 0.2s'
            }}>
                {keys.map((k, i) => {
                    if (k === null) return <div key={i} />;
                    const isDel = k === 'del';
                    return (
                        <button
                            key={i}
                            disabled={disabled}
                            onClick={() => (isDel ? handleDelete() : handleInput(String(k)))}
                            aria-label={isDel ? 'Letzte Ziffer löschen' : String(k)}
                            className="keypad-btn"
                            style={{
                                width: 76,
                                height: 76,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '1.7rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                background: isDel ? 'transparent' : 'var(--metal-surface)',
                                border: isDel ? 'none' : '1px solid var(--border-strong)',
                                boxShadow: isDel ? 'none' : 'var(--shadow-card)'
                            }}
                        >
                            {isDel ? <Delete size={26} /> : k}
                        </button>
                    );
                })}
            </div>

            <style>{`
        .keypad-btn:active { background: rgba(var(--accent-rgb), 0.22) !important; }
      `}</style>
        </div>
    );
};

export default PinLock;
