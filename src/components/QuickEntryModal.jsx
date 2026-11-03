import React, { useState, useEffect } from 'react';
import { Zap, X, Check, Fuel, Gauge, Wrench, Package, Plus, Send, Bot, ExternalLink, Copy } from 'lucide-react';

const CATEGORIES = [
    { value: 'Fuel', label: '⛽ Tanken' },
    { value: 'Service', label: '🔧 Wartung' },
    { value: 'Parts', label: '🔩 Teile' },
    { value: 'Other', label: '📦 Sonstiges' },
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
    const [cat, setCat] = useState('Fuel');
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(null);
    const [showBotSetup, setShowBotSetup] = useState(false);
    const [botWebhookUrl, setBotWebhookUrl] = useState(
        () => localStorage.getItem('mopped_bot_webhook_url') || ''
    );
    const [copiedShortcutUrl, setCopiedShortcutUrl] = useState(false);

    // Pre-fill from current techData or URL parameters
    useEffect(() => {
        if (!isOpen) return;

        const today = new Date().toISOString().split('T')[0];
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
        if (!techData && initialParams.addKm) return; // Wait until techData is loaded for relative addKm

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
                targetCat: initialParams.cat || 'Fuel',
                targetDesc: initialParams.desc || '',
                targetDate: initialParams.date || new Date().toISOString().split('T')[0]
            });
        }
    }, [isOpen, initialParams, techData, currentKmNum]);

    const syncToBotWebhook = async (newKm, lastUpdatedDate) => {
        const url = localStorage.getItem('mopped_bot_webhook_url');
        if (!url) return;
        try {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'syncState',
                    currentKm: newKm,
                    nextServiceDue: techData?.nextServiceDue || '52000',
                    licensePlate: techData?.licensePlate || 'M-N 594',
                    lastUpdated: lastUpdatedDate
                })
            });
        } catch (err) {
            console.warn('Bot webhook sync hint:', err);
        }
    };

    const executeSave = async ({ targetKm, targetAmount, targetCat, targetDesc, targetDate }) => {
        setSaving(true);
        try {
            const cleanKm = String(targetKm || '').trim();
            const cleanAmount = String(targetAmount || '').replace(',', '.').trim();
            const numericAmount = parseFloat(cleanAmount);
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
                const categoryLabel = CATEGORIES.find(c => c.value === targetCat)?.label.replace(/^[^\s]+\s/, '') || 'Tanken';
                const finalDesc = targetDesc.trim() || `${categoryLabel}${cleanKm ? ` (${cleanKm} km)` : ''}`;

                await addFinanceEntry({
                    date: targetDate,
                    desc: finalDesc,
                    amount: numericAmount.toFixed(2),
                    cat: targetCat,
                    km: cleanKm || String(currentKmNum || '')
                });

                // Also update lastUpdated on technical_data so the 2-day reminder knows an entry was made
                await updateTechData({
                    ...(techData || {}),
                    ...(cleanKm ? { currentKm: cleanKm } : {}),
                    lastUpdated: targetDate,
                    lastUpdatedIso: new Date().toISOString()
                });

                summaryParts.push(`€ ${numericAmount.toFixed(2)} (${finalDesc})`);
            }

            await syncToBotWebhook(cleanKm || String(currentKmNum || ''), targetDate);

            setSavedSuccess(summaryParts.join(' • ') || 'Eintrag gespeichert!');
            if (onClearParams) onClearParams();

            setTimeout(() => {
                setSavedSuccess(null);
                setAmount('');
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
            targetCat: cat,
            targetDesc: desc,
            targetDate: date
        });
    };

    const handleAddIncrement = (inc) => {
        const base = parseInt(km || currentKmNum || 0, 10);
        setKm(String(base + inc));
    };

    const handleSaveWebhook = () => {
        localStorage.setItem('mopped_bot_webhook_url', botWebhookUrl.trim());
        setShowBotSetup(false);
    };

    if (!isOpen) return null;

    const kmDelta = km && currentKmNum > 0 ? parseInt(km, 10) - currentKmNum : 0;
    const shortcutTemplateUrl = `${window.location.origin}/?quick=1&km={KM}&amount={EURO}&autosave=1`;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.82)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="glass-panel fade-in"
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '1px solid rgba(105, 190, 40, 0.45)',
                    background: 'linear-gradient(160deg, rgba(25, 38, 25, 0.96), rgba(18, 18, 18, 0.98))',
                    padding: '1.5rem',
                    position: 'relative'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            background: 'rgba(105, 190, 40, 0.2)',
                            color: 'var(--kawasaki-green)',
                            padding: '8px',
                            borderRadius: '12px',
                            display: 'flex'
                        }}>
                            <Zap size={22} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                1-Klick Schnelleingabe
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Versys 1000 SE • Aktuell {currentKmNum || '---'} km
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: 'var(--text-secondary)',
                            borderRadius: '50%',
                            width: '34px',
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {savedSuccess ? (
                    <div
                        className="fade-in"
                        style={{
                            textAlign: 'center',
                            padding: '2rem 1rem',
                            background: 'rgba(105, 190, 40, 0.15)',
                            borderRadius: '16px',
                            border: '1px solid var(--kawasaki-green)'
                        }}
                    >
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'var(--kawasaki-green)',
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem auto'
                        }}>
                            <Check size={32} strokeWidth={3} />
                        </div>
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--kawasaki-green)' }}>
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
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Gauge size={15} color="var(--kawasaki-green)" /> Neuer KM-Stand
                                </label>
                                {kmDelta > 0 && (
                                    <span style={{
                                        fontSize: '0.78rem',
                                        background: 'rgba(105, 190, 40, 0.2)',
                                        color: 'var(--kawasaki-green)',
                                        padding: '2px 8px',
                                        borderRadius: '99px',
                                        fontWeight: '600'
                                    }}>
                                        +{kmDelta} km gefahren
                                    </span>
                                )}
                            </div>

                            <input
                                type="number"
                                inputMode="numeric"
                                className="input-field"
                                placeholder={`z. B. ${currentKmNum + 150}`}
                                value={km}
                                onChange={(e) => setKm(e.target.value)}
                                style={{
                                    fontSize: '1.35rem',
                                    fontWeight: '700',
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
                                        style={{
                                            flex: '1 1 auto',
                                            background: 'rgba(105, 190, 40, 0.14)',
                                            border: '1px solid rgba(105, 190, 40, 0.35)',
                                            color: 'var(--kawasaki-green)',
                                            borderRadius: '10px',
                                            padding: '6px 8px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}
                                    >
                                        +{inc} km
                                    </button>
                                ))}
                                {currentKmNum > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setKm(String(currentKmNum))}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.12)',
                                            color: 'var(--text-secondary)',
                                            borderRadius: '10px',
                                            padding: '6px 8px',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Optional Fuel / Expense Section */}
                        <div style={{
                            padding: '1rem',
                            background: 'rgba(0, 0, 0, 0.25)',
                            borderRadius: '14px',
                            border: '1px solid var(--border-color)',
                            marginBottom: '1.2rem'
                        }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.6rem' }}>
                                <Fuel size={15} color="var(--kawasaki-green)" /> Direkt Tanken / Kosten miterfassen (optional)
                            </label>

                            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                {CATEGORIES.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        onClick={() => setCat(c.value)}
                                        style={{
                                            flex: '1 1 45%',
                                            padding: '7px 10px',
                                            borderRadius: '10px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            background: cat === c.value ? 'var(--kawasaki-green)' : 'rgba(255,255,255,0.06)',
                                            color: cat === c.value ? '#000' : 'var(--text-secondary)',
                                            border: cat === c.value ? 'none' : '1px solid rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.6rem' }}>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    placeholder="Betrag €"
                                    className="input-field"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    style={{ marginBottom: 0 }}
                                />
                                <input
                                    type="text"
                                    placeholder="Notiz (optional)"
                                    className="input-field"
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                    style={{ marginBottom: 0 }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Datum:</span>
                            <input
                                type="date"
                                className="input-field"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                style={{ width: 'auto', marginBottom: 0, padding: '6px 10px', fontSize: '0.85rem' }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="primary-btn"
                            disabled={saving}
                            style={{ marginBottom: '0.8rem' }}
                        >
                            <Zap size={18} />
                            {saving ? 'Speichere...' : 'Jetzt speichern'}
                        </button>

                        {/* Bot & Shortcut Info Toggle */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowBotSetup(!showBotSetup)}
                                style={{
                                    background: 'none',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.78rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    width: '100%'
                                }}
                            >
                                <Bot size={14} color="var(--kawasaki-green)" />
                                {showBotSetup ? 'Bot- & Kurzbefehl-Einstellungen ausblenden' : '2-Tage-Bot & Apple Kurzbefehl Kopplung'}
                            </button>

                            {showBotSetup && (
                                <div className="fade-in" style={{
                                    marginTop: '0.75rem',
                                    padding: '0.85rem',
                                    background: 'rgba(0,0,0,0.35)',
                                    borderRadius: '12px',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.45
                                }}>
                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                                        🤖 Google Apps Script 2-Tage-Bot URL (optional):
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                        <input
                                            type="url"
                                            placeholder="https://script.google.com/macros/s/.../exec"
                                            className="input-field"
                                            value={botWebhookUrl}
                                            onChange={(e) => setBotWebhookUrl(e.target.value)}
                                            style={{ marginBottom: 0, fontSize: '0.75rem', padding: '8px' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSaveWebhook}
                                            style={{
                                                background: 'var(--kawasaki-green)',
                                                color: '#000',
                                                borderRadius: '8px',
                                                padding: '0 12px',
                                                fontWeight: '700',
                                                fontSize: '0.75rem'
                                            }}
                                        >
                                            OK
                                        </button>
                                    </div>

                                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                        🍏 Direkt-URL für Apple Kurzbefehle (iPhone & Mac):
                                    </div>
                                    <div style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        padding: '6px 8px',
                                        borderRadius: '8px',
                                        wordBreak: 'break-all',
                                        fontFamily: 'monospace',
                                        fontSize: '0.7rem',
                                        marginBottom: '0.4rem'
                                    }}>
                                        {shortcutTemplateUrl}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(shortcutTemplateUrl);
                                            setCopiedShortcutUrl(true);
                                            setTimeout(() => setCopiedShortcutUrl(false), 2000);
                                        }}
                                        style={{
                                            background: 'rgba(255,255,255,0.1)',
                                            color: 'var(--text-primary)',
                                            padding: '5px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.72rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <Copy size={12} />
                                        {copiedShortcutUrl ? 'Kopiert!' : 'Vorlage kopieren'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default QuickEntryModal;
