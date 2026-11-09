import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Fuel, Wrench, Shield, Landmark, Cog, Receipt, Wallet } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { Sheet, PageHeader, Field, EmptyState, LoadingBlock, DataError } from './ui';
import { todayIso, formatEuro, formatDate, formatMonth, formatKm, parseAmount } from '../utils/format';

const CATEGORIES = [
    { value: 'Fuel', label: 'Tanken', icon: Fuel },
    { value: 'Service', label: 'Wartung', icon: Wrench },
    { value: 'Insurance', label: 'Versicherung', icon: Shield },
    { value: 'Tax', label: 'Steuer', icon: Landmark },
    { value: 'Parts', label: 'Teile', icon: Cog },
    { value: 'Other', label: 'Sonstiges', icon: Receipt }
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const emptyForm = () => ({ date: todayIso(), desc: '', amount: '', cat: 'Fuel', km: '' });

const Finance = () => {
    const { data: expenses, add, update, remove, loading, error: loadError } = useCollection('finance');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [filter, setFilter] = useState('all');
    const [editing, setEditing] = useState(null); // null | 'new' | entry
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const years = useMemo(() => {
        const set = new Set((expenses || []).map((e) => String(e.date || '').slice(0, 4)).filter((y) => /^\d{4}$/.test(y)));
        set.add(String(new Date().getFullYear()));
        return [...set].sort().reverse();
    }, [expenses]);

    const inYear = useMemo(
        () => (expenses || []).filter((e) => year === 'all' || String(e.date || '').startsWith(year)),
        [expenses, year]
    );
    const visible = useMemo(() => inYear.filter((e) => filter === 'all' || e.cat === filter), [inYear, filter]);

    const yearTotal = inYear.reduce((s, e) => s + parseAmount(e.amount), 0);
    const byCategory = CATEGORIES.map((c) => ({
        ...c,
        sum: inYear.filter((e) => e.cat === c.value).reduce((s, e) => s + parseAmount(e.amount), 0),
        count: inYear.filter((e) => e.cat === c.value).length
    })).filter((c) => c.sum > 0).sort((a, b) => b.sum - a.sum);
    const maxCat = Math.max(1, ...byCategory.map((c) => c.sum));

    // Nach Monat gruppieren
    const groups = useMemo(() => {
        const map = new Map();
        visible.forEach((e) => {
            const key = String(e.date || '').slice(0, 7) || 'ohne';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(e);
        });
        return [...map.entries()].map(([key, items]) => ({
            key,
            label: formatMonth(items[0]?.date),
            sum: items.reduce((s, e) => s + parseAmount(e.amount), 0),
            items
        }));
    }, [visible]);

    const openNew = () => {
        setForm({ ...emptyForm(), cat: filter !== 'all' ? filter : 'Fuel' });
        setEditing('new');
    };

    const openEdit = (entry) => {
        setForm({
            date: entry.date || todayIso(),
            desc: entry.desc || '',
            amount: entry.amount ? String(entry.amount).replace('.', ',') : '',
            cat: entry.cat || 'Other',
            km: entry.km || ''
        });
        setEditing(entry);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const amount = parseAmount(form.amount);
        if (!amount || !form.desc.trim()) return;
        setSaving(true);
        const payload = {
            date: form.date || todayIso(),
            desc: form.desc.trim(),
            amount: amount.toFixed(2),
            cat: form.cat,
            ...(form.km ? { km: String(form.km).replace(/\D/g, '') } : {})
        };
        try {
            if (editing === 'new') await add(payload);
            else await update(editing.id, payload);
            setEditing(null);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (editing && editing !== 'new' && confirm('Diesen Eintrag wirklich löschen?')) {
            await remove(editing.id);
            setEditing(null);
        }
    };

    if (loading) return <LoadingBlock />;

    const fuelCat = byCategory.find((c) => c.value === 'Fuel');

    return (
        <div className="fade-in">
            <DataError errors={[loadError]} />
            <PageHeader
                title="Kosten"
                subtitle="Tanken, Wartung, Versicherung & mehr"
                action={
                    <button className="icon-btn primary" onClick={openNew} aria-label="Neue Ausgabe erfassen">
                        <Plus size={22} />
                    </button>
                }
            />

            <div className="chip-row" role="tablist" aria-label="Jahr">
                {years.map((y) => (
                    <button key={y} className={`chip ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>
                ))}
                <button className={`chip ${year === 'all' ? 'active' : ''}`} onClick={() => setYear('all')}>Gesamt</button>
            </div>

            {/* Zusammenfassung */}
            <section className="paint-panel" style={{ marginTop: '0.6rem' }}>
                <div className="stat-label">{year === 'all' ? 'Alle Ausgaben' : `Ausgaben ${year}`}</div>
                <div className="stat-value" style={{ fontSize: '2.2rem', marginTop: 4 }}>{formatEuro(yearTotal)}</div>
                {fuelCat && (
                    <div className="stat-sub" style={{ marginTop: 4 }}>
                        {fuelCat.count}× getankt · Ø {formatEuro(fuelCat.sum / fuelCat.count)} pro Tankstopp
                    </div>
                )}
                {byCategory.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: '1.1rem' }}>
                        {byCategory.map((c) => {
                            const Icon = c.icon;
                            return (
                                <div key={c.value}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: 5 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--metal-200)' }}>
                                            <Icon size={14} /> {c.label}
                                        </span>
                                        <span className="num" style={{ fontWeight: 600 }}>{formatEuro(c.sum)}</span>
                                    </div>
                                    <div className="progress" style={{ height: 6 }}>
                                        <span style={{ width: `${(c.sum / maxCat) * 100}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Kategorie-Filter */}
            <div className="chip-row" style={{ marginTop: '1.2rem' }} aria-label="Kategorie">
                <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Alle</button>
                {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    return (
                        <button key={c.value} className={`chip ${filter === c.value ? 'active' : ''}`} onClick={() => setFilter(c.value)}>
                            <Icon size={14} /> {c.label}
                        </button>
                    );
                })}
            </div>

            {groups.length === 0 ? (
                <div style={{ marginTop: '1rem' }}>
                    <EmptyState
                        icon={<Wallet size={32} />}
                        title="Keine Einträge"
                        text={filter === 'all' ? 'Für diesen Zeitraum ist noch nichts erfasst.' : 'In dieser Kategorie gibt es hier keine Einträge.'}
                        action={<button className="btn-primary" onClick={openNew}><Plus size={18} /> Ausgabe erfassen</button>}
                    />
                </div>
            ) : (
                groups.map((g) => (
                    <div key={g.key}>
                        <div className="group-header">
                            <span>{g.label}</span>
                            <span className="num">{formatEuro(g.sum)}</span>
                        </div>
                        <div className="list">
                            {g.items.map((ex) => {
                                const Icon = (CAT[ex.cat] || CAT.Other).icon;
                                return (
                                    <button key={ex.id} type="button" className="list-row" onClick={() => openEdit(ex)}>
                                        <span className="icon-bubble"><Icon size={18} /></span>
                                        <span className="list-row-main">
                                            <span className="list-row-title" style={{ display: 'block' }}>{ex.desc}</span>
                                            <span className="list-row-sub" style={{ display: 'block' }}>
                                                {formatDate(ex.date)} · {(CAT[ex.cat] || { label: ex.cat }).label}
                                                {ex.km ? ` · ${formatKm(ex.km)}` : ''}
                                            </span>
                                        </span>
                                        <span className="list-row-value">{formatEuro(ex.amount)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}

            <Sheet
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing === 'new' ? 'Neue Ausgabe' : 'Ausgabe bearbeiten'}
                icon={<Wallet size={20} />}
            >
                <form onSubmit={handleSave}>
                    <Field label="Kategorie">
                        <div className="chip-grid">
                            {CATEGORIES.map((c) => {
                                const Icon = c.icon;
                                return (
                                    <button key={c.value} type="button" className={`chip ${form.cat === c.value ? 'active' : ''}`} onClick={() => setForm({ ...form, cat: c.value })}>
                                        <Icon size={14} /> {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </Field>
                    <div className="field-row">
                        <Field label="Betrag (€)">
                            <input className="input-field num" type="text" inputMode="decimal" placeholder="0,00" required
                                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                        </Field>
                        <Field label="Datum">
                            <input className="input-field" type="date" required value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })} />
                        </Field>
                    </div>
                    <Field label={form.cat === 'Fuel' ? 'Tankstelle' : 'Beschreibung'}>
                        <input className="input-field" type="text" required
                            placeholder={form.cat === 'Fuel' ? 'z. B. Shell Himmelkron' : 'Wofür?'}
                            value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
                    </Field>
                    <Field label="KM-Stand (optional)">
                        <input className="input-field num" type="text" inputMode="numeric" placeholder="z. B. 12450"
                            value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
                    </Field>
                    <div className="sheet-actions">
                        <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Speichere …' : 'Speichern'}</button>
                        {editing && editing !== 'new' && (
                            <button type="button" className="danger-btn" onClick={handleDelete}><Trash2 size={18} /> Löschen</button>
                        )}
                    </div>
                </form>
            </Sheet>
        </div>
    );
};

export default Finance;
