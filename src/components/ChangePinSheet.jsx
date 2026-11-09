import React, { useState } from 'react';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { useDocument } from '../hooks/useFirestore';
import { Sheet, Field } from './ui';
import { createPinRecord, verifyPin, isValidPin } from '../utils/pin';

const PIN_INPUT = {
    type: 'password',
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 4,
    pattern: '\\d{4}',
    className: 'input-field num',
    style: { letterSpacing: '0.5em', fontSize: '1.3rem', textAlign: 'center' }
};

const ChangePinSheet = ({ open, onClose }) => {
    const { data: security, update } = useDocument('security');
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [repeat, setRepeat] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    const close = () => {
        setCurrent('');
        setNext('');
        setRepeat('');
        setError('');
        setDone(false);
        onClose();
    };

    const digits = (v) => v.replace(/\D/g, '').slice(0, 4);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!isValidPin(next)) return setError('Der neue PIN muss aus genau 4 Ziffern bestehen.');
        if (next !== repeat) return setError('Die neuen PINs stimmen nicht überein.');
        setSaving(true);
        try {
            if (security?.pinHash && !(await verifyPin(current, security))) {
                setError('Der aktuelle PIN ist falsch.');
                return;
            }
            await update(await createPinRecord(next));
            setDone(true);
            setTimeout(close, 1400);
        } catch (err) {
            console.error(err);
            setError('Speichern fehlgeschlagen – bitte erneut versuchen.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={open} onClose={close} title="App-PIN ändern" subtitle="Wird verschlüsselt in deinem Konto gespeichert" icon={<KeyRound size={20} />}>
            {done ? (
                <div className="status-pill status-ok" style={{ display: 'flex', justifyContent: 'center', padding: '1.2rem', borderRadius: 20, fontSize: '1rem' }}>
                    <CheckCircle2 size={20} /> Neuer PIN gespeichert
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {security?.pinHash && (
                        <Field label="Aktueller PIN">
                            <input {...PIN_INPUT} required value={current} onChange={(e) => setCurrent(digits(e.target.value))} />
                        </Field>
                    )}
                    <div className="field-row">
                        <Field label="Neuer PIN">
                            <input {...PIN_INPUT} required value={next} onChange={(e) => setNext(digits(e.target.value))} />
                        </Field>
                        <Field label="Wiederholen">
                            <input {...PIN_INPUT} required value={repeat} onChange={(e) => setRepeat(digits(e.target.value))} />
                        </Field>
                    </div>
                    {error && (
                        <div className="status-pill status-danger" role="alert" style={{ display: 'flex', borderRadius: 14, padding: '10px 12px' }}>
                            {error}
                        </div>
                    )}
                    <div className="sheet-actions">
                        <button type="submit" className="primary-btn" disabled={saving}>
                            {saving ? 'Speichere …' : 'PIN speichern'}
                        </button>
                    </div>
                </form>
            )}
        </Sheet>
    );
};

export default ChangePinSheet;
