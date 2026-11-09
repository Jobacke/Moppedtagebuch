import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Package, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { Sheet, Field, EmptyState, LoadingBlock, DataError } from './ui';
import { todayIso, formatEuro, formatDate, parseAmount } from '../utils/format';

const emptyForm = () => ({ name: '', brand: '', date: todayIso(), price: '', installed: true });

const Accessories = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { data: items, add, update, remove, loading, error: loadError } = useCollection('accessories');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const openNew = () => {
        setForm(emptyForm());
        setEditing('new');
    };

    useEffect(() => {
        if (location.state?.openNew && !loading) {
            openNew();
            navigate(location.pathname, { replace: true, state: null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, loading]);

    const openEdit = (item) => {
        setForm({
            name: item.name || '',
            brand: item.brand || '',
            date: item.date || '',
            price: item.price ? String(item.price).replace('.', ',') : '',
            installed: item.installed !== false
        });
        setEditing(item);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const price = parseAmount(form.price);
        if (!form.name.trim()) return;
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            brand: form.brand.trim(),
            date: form.date,
            price: price ? price.toFixed(2) : '0.00',
            installed: form.installed
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
        if (editing && editing !== 'new' && confirm('Dieses Zubehör wirklich entfernen?')) {
            await remove(editing.id);
            setEditing(null);
        }
    };

    if (loading) return <LoadingBlock />;

    const totalValue = (items || []).reduce((sum, item) => sum + parseAmount(item.price), 0);
    const installedCount = (items || []).filter((i) => i.installed !== false).length;

    return (
        <div className="fade-in">
            <DataError errors={[loadError]} />
            <div className="card-grid" style={{ marginBottom: '1rem' }}>
                <div className="surface">
                    <div className="stat-label">Wert gesamt</div>
                    <div className="stat-value" style={{ marginTop: 6 }}>{formatEuro(totalValue, 0)}</div>
                </div>
                <div className="surface">
                    <div className="stat-label">Teile</div>
                    <div className="stat-value" style={{ marginTop: 6 }}>{items.length}</div>
                    <div className="stat-sub">{installedCount} montiert</div>
                </div>
            </div>

            <button className="primary-btn" onClick={openNew} style={{ marginBottom: '1rem' }}>
                <Plus size={20} /> Zubehör hinzufügen
            </button>

            {items.length === 0 ? (
                <EmptyState icon={<Package size={32} />} title="Noch kein Zubehör" text="Koffer, Navi-Halter, Sturzbügel – erfasse hier deine Umbauten." />
            ) : (
                <div className="list">
                    {items.map((item) => {
                        const installed = item.installed !== false;
                        return (
                            <button key={item.id} type="button" className="list-row" onClick={() => openEdit(item)}>
                                <span className="icon-bubble"><Package size={18} /></span>
                                <span className="list-row-main">
                                    <span className="list-row-title" style={{ display: 'block' }}>{item.name}</span>
                                    <span className="list-row-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ color: installed ? 'var(--ok)' : 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                            {installed ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                            {installed ? 'montiert' : 'offen'}
                                        </span>
                                        {item.brand && <span>· {item.brand}</span>}
                                        {item.date && <span>· {formatDate(item.date)}</span>}
                                    </span>
                                </span>
                                <span className="list-row-value">{formatEuro(item.price)}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <Sheet
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing === 'new' ? 'Neues Zubehör' : 'Zubehör bearbeiten'}
                icon={<Package size={20} />}
            >
                <form onSubmit={handleSave}>
                    <Field label="Bezeichnung">
                        <input className="input-field" type="text" required placeholder="z. B. Topcase 47 L"
                            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </Field>
                    <Field label="Marke / Hersteller">
                        <input className="input-field" type="text" placeholder="z. B. Givi"
                            value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    </Field>
                    <div className="field-row">
                        <Field label="Kaufpreis (€)">
                            <input className="input-field num" type="text" inputMode="decimal" placeholder="0,00"
                                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                        </Field>
                        <Field label="Kaufdatum">
                            <input className="input-field" type="date" value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })} />
                        </Field>
                    </div>
                    <label className="switch">
                        <span style={{ fontWeight: 600 }}>Bereits montiert</span>
                        <input type="checkbox" checked={form.installed} onChange={(e) => setForm({ ...form, installed: e.target.checked })} />
                        <span className="switch-track" aria-hidden="true" />
                    </label>
                    <div className="sheet-actions">
                        <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Speichere …' : 'Speichern'}</button>
                        {editing && editing !== 'new' && (
                            <button type="button" className="danger-btn" onClick={handleDelete}><Trash2 size={18} /> Entfernen</button>
                        )}
                    </div>
                </form>
            </Sheet>
        </div>
    );
};

export default Accessories;
