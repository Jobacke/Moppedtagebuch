import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Wrench, CalendarClock, Gauge, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useCollection, useDocument } from '../hooks/useFirestore';
import { Sheet, PageHeader, Field, EmptyState, LoadingBlock } from './ui';
import {
    todayIso, computeCurrentKm, computeServiceStatus, serviceHeadline, STATUS_CLASS,
    formatKm, formatEuro, formatDate, parseKm, parseAmount, relativeDay
} from '../utils/format';

const emptyForm = (km) => ({ date: todayIso(), km: km ? String(km) : '', work: '', nextDue: '', nextDueKm: '', cost: '' });

const Service = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { data: logs, add, update, remove, loading } = useCollection('service');
    const { data: techData, update: updateTechData } = useDocument('technical_data');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(() => emptyForm());
    const [saving, setSaving] = useState(false);

    const currentKm = computeCurrentKm(techData, logs);
    const status = computeServiceStatus(techData, logs, currentKm);

    const openNew = () => {
        setForm(emptyForm(currentKm));
        setEditing('new');
    };

    // Direkt aus der Übersicht „Service erfassen“ geöffnet
    useEffect(() => {
        if (location.state?.openNew && !loading) {
            openNew();
            navigate(location.pathname, { replace: true, state: null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, loading]);

    const openEdit = (log) => {
        setForm({
            date: log.date || todayIso(),
            km: log.km || '',
            work: log.work || '',
            nextDue: log.nextDue || '',
            nextDueKm: '',
            cost: log.cost ? String(log.cost).replace('.', ',') : ''
        });
        setEditing(log);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.work.trim() || !form.date) return;
        setSaving(true);
        const kmClean = String(form.km || '').replace(/\D/g, '');
        const cost = parseAmount(form.cost);
        const payload = {
            date: form.date,
            km: kmClean,
            work: form.work.trim(),
            nextDue: form.nextDue || '',
            cost: cost ? cost.toFixed(2) : ''
        };
        try {
            if (editing === 'new') await add(payload);
            else await update(editing.id, payload);

            // Haupt-KM-Stand und Service-Intervall in den Technik-Daten nachziehen
            const enteredKm = parseKm(kmClean);
            const techKm = parseKm(techData?.currentKm);
            const nextKm = parseKm(form.nextDueKm);
            const patch = {};
            if (enteredKm > 0 && enteredKm >= techKm) {
                Object.assign(patch, { currentKm: String(enteredKm), lastUpdated: form.date, lastUpdatedIso: new Date().toISOString() });
            }
            if (nextKm > 0) patch.nextServiceDue = String(nextKm);
            if (Object.keys(patch).length) await updateTechData({ ...(techData || {}), ...patch });

            setEditing(null);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (editing && editing !== 'new' && confirm('Diesen Service-Eintrag wirklich löschen?')) {
            await remove(editing.id);
            setEditing(null);
        }
    };

    if (loading) return <LoadingBlock />;

    const progressClass = status.level === 'danger' ? 'danger' : status.level === 'warn' ? 'warn' : '';
    const totalCost = (logs || []).reduce((s, l) => s + parseAmount(l.cost), 0);

    return (
        <div className="fade-in">
            <PageHeader
                title="Service"
                subtitle="Digitales Scheckheft"
                action={
                    <button className="icon-btn primary" onClick={openNew} aria-label="Service-Eintrag hinzufügen">
                        <Plus size={22} />
                    </button>
                }
            />

            {/* Status nächster Service */}
            <section className="paint-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="stat-label">Nächster Service</span>
                    <span className={`status-pill ${STATUS_CLASS[status.level]}`}>
                        {status.level === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {status.level === 'ok' ? 'Alles im Plan' : status.level === 'warn' ? 'Bald fällig' : status.level === 'danger' ? 'Überfällig' : 'Nicht geplant'}
                    </span>
                </div>
                <div className="stat-value" style={{ fontSize: '2.1rem', marginTop: 8 }}>{serviceHeadline(status)}</div>
                {status.progress !== null && (
                    <div className={`progress ${progressClass}`} style={{ marginTop: 12 }}>
                        <span style={{ width: `${Math.round(status.progress * 100)}%` }} />
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
                    <div>
                        <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Gauge size={13} /> Fällig bei</div>
                        <div className="num" style={{ fontWeight: 700, marginTop: 2 }}>{status.nextKm ? formatKm(status.nextKm) : '–'}</div>
                    </div>
                    <div>
                        <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CalendarClock size={13} /> Fällig bis</div>
                        <div className="num" style={{ fontWeight: 700, marginTop: 2 }}>{status.nextDate ? formatDate(status.nextDate) : '–'}</div>
                    </div>
                </div>
                {!status.nextKm && !status.nextDate && (
                    <p className="stat-sub" style={{ margin: '0.9rem 0 0' }}>
                        Tipp: Beim nächsten Service-Eintrag „Nächster Service bei km“ ausfüllen – dann zählt die App automatisch herunter.
                    </p>
                )}
            </section>

            <div className="section-title-row">
                <h3 className="section-title">Historie</h3>
                {totalCost > 0 && <span className="stat-sub num">Summe {formatEuro(totalCost)}</span>}
            </div>

            {logs.length === 0 ? (
                <EmptyState
                    icon={<Wrench size={32} />}
                    title="Noch keine Service-Einträge"
                    text="Ölwechsel, Inspektion, Reifen – alles landet hier im Scheckheft."
                    action={<button className="btn-primary" onClick={openNew}><Plus size={18} /> Ersten Eintrag anlegen</button>}
                />
            ) : (
                <div style={{ position: 'relative', paddingLeft: 22 }}>
                    <div style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, borderRadius: 2, background: 'linear-gradient(180deg, var(--metal-300), rgba(255,255,255,0.05))' }} />
                    {logs.map((log, i) => (
                        <div key={log.id} style={{ position: 'relative', marginBottom: '0.7rem' }}>
                            <span style={{
                                position: 'absolute', left: -20, top: 18, width: 12, height: 12, borderRadius: '50%',
                                background: i === 0 ? 'var(--metal-silver)' : 'var(--anthracite-600)',
                                border: '2px solid var(--anthracite-900)', boxShadow: '0 0 0 1px var(--border-strong)'
                            }} />
                            <button type="button" className="surface surface-tappable" onClick={() => openEdit(log)} style={{ width: '100%', textAlign: 'left' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
                                    <span style={{ fontWeight: 700 }}>{formatDate(log.date)}</span>
                                    <span className="stat-sub num">{log.km ? formatKm(log.km) : ''}</span>
                                </div>
                                <p style={{ margin: '0.4rem 0 0', lineHeight: 1.45, color: 'var(--metal-100)', whiteSpace: 'pre-line' }}>{log.work}</p>
                                {(log.cost || log.nextDue) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.7rem' }}>
                                        {log.cost && <span className="status-pill status-neutral num">{formatEuro(log.cost)}</span>}
                                        {log.nextDue && (
                                            <span className={`status-pill ${i === 0 && status.daysLeft !== null && status.daysLeft < 0 ? 'status-danger' : 'status-neutral'}`}>
                                                <CalendarClock size={13} /> Nächster bis {formatDate(log.nextDue)}{i === 0 ? ` (${relativeDay(log.nextDue)})` : ''}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Sheet
                open={editing !== null}
                onClose={() => setEditing(null)}
                title={editing === 'new' ? 'Service eintragen' : 'Service bearbeiten'}
                subtitle={currentKm ? `Aktueller Stand ${formatKm(currentKm)}` : undefined}
                icon={<Wrench size={20} />}
            >
                <form onSubmit={handleSave}>
                    <div className="field-row">
                        <Field label="Datum">
                            <input className="input-field" type="date" required value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })} />
                        </Field>
                        <Field label="KM-Stand">
                            <input className="input-field num" type="text" inputMode="numeric" placeholder="z. B. 12450"
                                value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
                        </Field>
                    </div>
                    <Field label="Durchgeführte Arbeiten">
                        <textarea className="input-field" rows={3} required placeholder="z. B. Ölwechsel inkl. Filter, Kette gereinigt"
                            value={form.work} onChange={(e) => setForm({ ...form, work: e.target.value })} />
                    </Field>
                    <Field label="Kosten (€)">
                        <input className="input-field num" type="text" inputMode="decimal" placeholder="0,00"
                            value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                    </Field>
                    <div className="field-row">
                        <Field label="Nächster Service bei km">
                            <input className="input-field num" type="text" inputMode="numeric"
                                placeholder={status.nextKm ? String(status.nextKm) : 'z. B. 24000'}
                                value={form.nextDueKm} onChange={(e) => setForm({ ...form, nextDueKm: e.target.value })} />
                        </Field>
                        <Field label="… oder bis Datum">
                            <input className="input-field" type="date" value={form.nextDue}
                                onChange={(e) => setForm({ ...form, nextDue: e.target.value })} />
                        </Field>
                    </div>
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

export default Service;
