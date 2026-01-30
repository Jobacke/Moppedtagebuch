import React, { useState } from 'react';
import { Lock } from 'lucide-react';

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

    return (
        <div className="pin-container" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'radial-gradient(circle at center, #2e2e2e, #121212)'
        }}>
            <div className={`lock-icon ${error ? 'shake' : ''}`} style={{
                marginBottom: '2rem',
                color: error ? '#ff4d4f' : 'var(--kawasaki-green)',
                transition: 'color 0.3s'
            }}>
                <Lock size={48} />
            </div>

            <div className="pin-indicator" style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: i < pin.length ? 'var(--kawasaki-green)' : 'rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.2s',
                        transform: i < pin.length ? 'scale(1.2)' : 'scale(1)'
                    }} />
                ))}
            </div>

            <div className="keypad" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.5rem',
                width: '100%',
                maxWidth: '300px'
            }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleInput(num)}
                        className="keypad-btn"
                        style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            fontSize: '1.5rem',
                            border: 'none',
                            backdropFilter: 'blur(10px)',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                    >
                        {num}
                    </button>
                ))}
                <div /> {/* Spacer */}
                <button
                    onClick={() => handleInput(0)}
                    className="keypad-btn"
                    style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        fontSize: '1.5rem',
                        border: 'none',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    className="keypad-btn"
                    style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '1rem',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    DEL
                </button>
            </div>

            <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .shake { animation: shake 0.3s ease-in-out; }
        .keypad-btn:active { background: rgba(105, 190, 40, 0.3) !important; transform: scale(0.95); }
      `}</style>
        </div>
    );
};

export default PinLock;
