import React, { useState, useEffect } from 'react';
import { X, Check, Fuel, Gauge, Wrench, Cog, Receipt } from 'lucide-react';
import { todayIso, formatNumber } from '../utils/format';

const CATEGORIES = [
    { value: 'Fuel', label: 'Tanken', icon: Fuel },
    { value: 'Service', label: 'Wartung', icon: Wrench },
    { value: 'Parts', label: 'Teile', icon: Cog },
    { value: 'Other', label: 'Sonstiges', icon: Receipt },
];

const QUICK_KM_INCREMENTS = [50, 100, 200, 350, 500];

const QuickEntryModal = ({
    isOpen,
    onClose,
    techData,
    updateTechData,
    addFinanceEntry,
    initialParams = {},
    onClearParams
}) => {
    const currentKmNum = parseInt(techData?.currentKm || '0', 10) || 0;

    const [km, setKm] = useState('');
    const [amount, setAmount] = useState('');
    const [station, setStation] = useState('');
    const [cat, setCat] = useState('Fuel');
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState(() => todayIso());
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(null);

    useEffect(() => {
        if (!isOpen) return;

        const today = todayIso();
        setDate(initialParams.date || today);

        if (initialParams.km) {
            setKm(String(initialParams.km));
        } else if (initialParams.addKm && currentKmNum > 0) {
            setKm(String(currentKmNum + parseInt(initialParams.addKm, 10)));
        } else if (currentKmNum > 0 && !km) {
            setKm(String(currentKmNum));
        }

        if (initialParams.amount) {
            setAmount(String(initialParams.amount).replace(',', '.'));
        }
        if (initialParams.station) {
            setStation(initialParams.station);
        }
        if (initialParams.cat) {
            setCat(initialParams.cat);
        }
        if (initialParams.desc) {
            setDesc(initialParams.desc);
        }
    }, [isOpen, currentKmNum, initialParams]);

    // Handle autosave from 1-click email button or Apple Shortcut
    useEffect(() => {
        if (!isOpen || !initialParams.autosave || saving || savedSuccess) return;
        if (!techData && initialParams.addKm) return;

        const targetKm = initialParams.km
            ? parseInt(initialParams.km, 10)
            : initialParams.addKm && currentKmNum > 0
                ? currentKmNum + parseInt(initialParams.addKm, 10)
                : null;

        const targetAmount = initialParams.amount
            ? parseFloat(String(initialParams.amount).replace(',', '.'))
            : null;

        if (targetKm || targetAmount) {
            executeSave({
                targetKm: targetKm ? String(targetKm) : String(currentKmNum || ''),
                targetAmount: targetAmount ? String(targetAmount) : '',
                targetStation: initialParams.station || '',
                targetCat: initialParams.cat || 'Fuel',
                targetDesc: initialParams.desc || '',
                targetDate: initialParams.date || todayIso()
            });
        }
    }, [isOpen, initialParams, techData, currentKmNum]);

    const executeSave = async ({ targetKm, targetAmount, targetStation, targetCat, targetDesc, targetDate }) => {
        setSaving(true);
        try {
            const cleanKm = String(targetKm || '').trim();
            const cleanAmount = String(targetAmount || '').replace(',', '.').trim();
            const numericAmount = parseFloat(cleanAmount);
            const cleanStation = String(targetStation || '').trim();
            const summaryParts = [];

            if (cleanKm && (!currentKmNum || parseInt(cleanKm, 10) !== currentKmNum || !numericAmount)) {
                await updateTechData({
                    ...(techData || {}),
                    currentKm: cleanKm,
                    lastUpdated: targetDate,
                    lastUpdatedIso: new Date().toISOString()
                });
                const diff = currentKmNum > 0 ? parseInt(cleanKm, 10) - currentKmNum : 0;
                summaryParts.push(
                    diff > 0
                        ? `${cleanKm} km (+${diff} km)`
                        : `${cleanKm} km`
                );
            }

            if (!isNaN(numericAmount) && numericAmount > 0) {
                const isFuel = targetCat === 'Fuel';
                const categoryLabel = CATEGORIES.find(c => c.value === targetCat)?.label || 'Tanken';
                let finalDesc = '';

                if (isFuel) {
                    finalDesc = cleanStation || targetDesc.trim() || 'Tanken';
                } else {
                    finalDesc = targetDesc.trim() || categoryLabel;
                }

                await addFinanceEntry({
                    date: targetDate,
                    desc: finalDesc,
                    amount: numericAmount.toFixed(2),
                    cat: targetCat
                });

                await updateTechData({
                    ...(techData || {}),
                    ...(cleanKm ? { currentKm: cleanKm } : {}),
                    lastUpdated: targetDate,
                    lastUpdatedIso: new Date().toISOString()
                });

                summaryParts.push(`€ ${numericAmount.toFixed(2)} (${finalDesc} am ${targetDate})`);
            }

            setSavedSuccess(summaryParts.join(' • ') || 'Eintrag gespeichert!');
            if (onClearParams) onClearParams();

            setTimeout(() => {
                setSavedSuccess(null);
                setAmount('');
                setStation('');
                setDesc('');
                onClose();
            }, 1600);
        } catch (err) {
            console.error('Fehler beim Schnell-Eintrag:', err);
            alert('Fehler beim Speichern: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await executeSave({
            targetKm: km,
            targetAmount: amount,
            targetStation: station,
            targetCat: cat,
            targetDesc: desc,
            targetDate: date
        });
    };

    const handleAddIncrement = (inc) => {
        const base = parseInt(km || currentKmNum || 0, 10);
        setKm(String(base + inc));
    };

    if (!isOpen) return null;

    const kmDelta = km && currentKmNum > 0 ? parseInt(km, 10) - currentKmNum : 0;

    return (
        <div
            className="sheet-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="sheet" role="dialog" aria-modal="true" aria-label="KM-Stand und Tankrechnung erfassen">
                <div className="sheet-handle" />
                <div className="sheet-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="icon-bubble"><Gauge size={20} /></div>
                        <div>
                            <h3 className="sheet-title">KM & Tanken</h3>
                            <p className="sheet-subtitle num">Aktuell {currentKmNum ? `${formatNumber(currentKmNum)} km` : '–'}</p>
                        </div>
                    </div>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
                        <X size={20} />
                    </button>
                </div>

                {savedSuccess ? (
                    <div
                        className="fade-in"
                        style={{
                            textAlign: 'center',
                            padding: '2rem 1rem',
                            background: 'rgba(var(--ok-rgb), 0.08)',
                            borderRadius: '20px',
                            border: '1px solid rgba(var(--ok-rgb), 0.35)'
                        }}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'var(--ok)',
                            color: 'var(--accent-contrast)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto'
                        }}>
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--ok)' }}>
                            Gespeichert!
                        </h4>
                        <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {savedSuccess}
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {/* KM Section */}
                        <div style={{ marginBottom: '1.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label className="field-label" htmlFor="quick-km">
                                    Neuer KM-Stand
                                </label>
                                {kmDelta > 0 && (
                                    <span className="status-pill status-ok num" style={{ padding: '2px 9px' }}>
                                        +{formatNumber(kmDelta)} km gefahren
                                    </span>
                                )}
                            </div>

                            <input
                                id="quick-km"
                                type="number"
                                inputMode="numeric"
                                className="input-field num"
                                placeholder={`z. B. ${currentKmNum + 150}`}
                                value={km}
                                onChange={(e) => setKm(e.target.value)}
                                style={{
                                    fontSize: '1.8rem',
                                    fontWeight: '800',
                                    minHeight: '64px',
                                    marginBottom: '0.6rem',
                                    textAlign: 'center',
                                    letterSpacing: '0.5px'
                                }}
                            />

                            {/* Quick +KM Pills */}
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {QUICK_KM_INCREMENTS.map((inc) => (
                                    <button
                                        key={inc}
                                        type="button"
                                        onClick={() => handleAddIncrement(inc)}
                                        className="chip"
                                        style={{ flex: '1 1 auto', padding: '0 0.6rem', color: 'var(--text-primary)' }}
                                    >
                                        +{inc} km
                                    </button>
                                ))}
                                {currentKmNum > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setKm(String(currentKmNum))}
                                        className="chip"
                                        style={{ padding: '0 0.7rem' }}
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tankrechnung / Expense Section */}
                        <div style={{
                            padding: '1rem',
                            background: 'rgba(0, 0, 0, 0.22)',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)',
                            marginBottom: '1.2rem'
                        }}>
                            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.7rem' }}>
                                <Fuel size={14} /> Tankrechnung / Ausgabe (optional)
                            </label>

                            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                {CATEGORIES.map((c) => {
                                    const Icon = c.icon;
                                    return (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setCat(c.value)}
                                            className={`chip ${cat === c.value ? 'active' : ''}`}
                                            style={{ flex: '1 1 45%' }}
                                        >
                                            <Icon size={14} /> {c.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    placeholder="Betrag (€)"
                                    className="input-field"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    style={{ marginBottom: 0 }}
                                />
                                <input
                                    type="date"
                                    className="input-field"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    style={{ marginBottom: 0 }}
                                    title="Datum des Tankens"
                                />
                            </div>

                            {cat === 'Fuel' ? (
                                <input
                                    type="text"
                                    placeholder="Tankstelle (z. B. Aral, Shell, Esso...)"
                                    className="input-field"
                                    value={station}
                                    onChange={(e) => setStation(e.target.value)}
                                    style={{ marginBottom: 0 }}
                                />
                            ) : (
                                <input
                                    type="text"
                                    placeholder="Beschreibung / Notiz"
                                    className="input-field"
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                    style={{ marginBottom: 0 }}
                                />
                            )}
                        </div>

                        <button
                            type="submit"
                            className="primary-btn"
                            disabled={saving}
                        >
                            <Check size={20} strokeWidth={2.6} />
                            {saving ? 'Speichere …' : 'Speichern'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default QuickEntryModal;
