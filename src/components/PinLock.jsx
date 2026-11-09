import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';

const PinLock = ({ onUnlock }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handleInput = (num) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === 4) {
                setTimeout(() => {
                    if (!onUnlock(newPin)) {
                        setError(true);
                        setTimeout(() => {
                            setPin('');
                            setError(false);
                        }, 500);
                    }
                }, 100);
            }
        }
    };

    const handleDelete = () => {
        setPin(pin.slice(0, -1));
    };

    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'];

    return (
        <div className="pin-container fade-in" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100dvh',
            padding: '2rem 1rem'
        }}>
            <div className={`brand-mark ${error ? 'shake' : ''}`} style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                marginBottom: '1.25rem',
                color: error ? 'var(--danger)' : 'var(--accent-contrast)'
            }}>
                <Lock size={32} />
            </div>
            <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.4rem' }}>Moppedtagebuch</h2>
            <p style={{ margin: '0 0 2rem', color: error ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {error ? 'Falscher PIN – bitte erneut versuchen' : 'PIN eingeben'}
            </p>

            <div style={{ display: 'flex', gap: '1.1rem', marginBottom: '2.5rem' }} aria-live="polite" aria-label={`${pin.length} von 4 Ziffern`}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: i < pin.length ? 'var(--metal-silver)' : 'transparent',
                        border: '1.5px solid ' + (error ? 'var(--danger)' : 'var(--metal-300)'),
                        transition: 'all 0.2s',
                        transform: i < pin.length ? 'scale(1.1)' : 'scale(1)'
                    }} />
                ))}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 76px)',
                gap: '1.1rem 1.6rem',
                justifyContent: 'center'
            }}>
                {keys.map((k, i) => {
                    if (k === null) return <div key={i} />;
                    const isDel = k === 'del';
                    return (
                        <button
                            key={i}
                            onClick={() => (isDel ? handleDelete() : handleInput(k))}
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
