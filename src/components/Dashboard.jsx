import React, { useEffect, useMemo } from 'react';
import {
    Wrench, Wallet, Package, Fuel, CheckCircle2, AlertTriangle, ChevronRight,
    Gauge, Camera, Shield, Landmark, Cog, Receipt
} from 'lucide-react';
import { useDocument, useCollection } from '../hooks/useFirestore';
import {
    computeCurrentKm, computeServiceStatus, serviceHeadline, STATUS_CLASS,
    formatKm, formatNumber, formatEuro, formatDate, relativeDay, parseAmount, toDate
} from '../utils/format';
import { LoadingBlock, DataError } from './ui';

const CATEGORY_ICON = {
    Fuel: <Fuel size={18} />,
    Service: <Wrench size={18} />,
    Insurance: <Shield size={18} />,
    Tax: <Landmark size={18} />,
    Parts: <Cog size={18} />,
    Other: <Receipt size={18} />
};

const Dashboard = ({ onOpenQuickEntry, onNavigate }) => {
    const { data: techData, update: updateTechData, loading: techLoading } = useDocument('technical_data');
    const { data: financeData, error: financeError, loading: financeLoading } = useCollection('finance');
    const { data: serviceData, error: serviceError, loading: serviceLoading } = useCollection('service');
    const { data: accessoriesData, error: accError, loading: accLoading } = useCollection('accessories');
    const listsLoading = financeLoading || serviceLoading || accLoading;

    const techKmNum = parseInt(String(techData?.currentKm || '0').replace(/\D/g, ''), 10) || 0;
    const currentKm = computeCurrentKm(techData, serviceData, financeData);

    // Auto-Heal: höherer KM-Stand aus Service/Finanzen → Technik-Daten nachziehen
    useEffect(() => {
        if (techData && currentKm > techKmNum) {
            updateTechData({ ...techData, currentKm: String(currentKm) });
        }
    }, [currentKm, techKmNum, techData, updateTechData]);

    const service = computeServiceStatus(techData, serviceData, currentKm);

    // Kosten
    const thisYear = String(new Date().getFullYear());
    const costs = useMemo(() => {
        const all = [
            ...(financeData || []).map((d) => ({ date: d.date, amount: parseAmount(d.amount) })),
            ...(serviceData || []).map((d) => ({ date: d.date, amount: parseAmount(d.cost) })),
            ...(accessoriesData || []).map((d) => ({ date: d.date, amount: parseAmount(d.price) }))
        ];
        const total = all.reduce((s, x) => s + x.amount, 0);
        const year = all.filter((x) => String(x.date || '').startsWith(thisYear)).reduce((s, x) => s + x.amount, 0);
        return { total, year };
    }, [financeData, serviceData, accessoriesData, thisYear]);

    const lastFuel = (financeData || []).find((d) => d.cat === 'Fuel');

    // Letzte Aktivitäten (gemischt)
    const recent = useMemo(() => {
        const items = [
            ...(financeData || []).map((d) => ({
                id: `f-${d.id}`, date: d.date, title: d.desc || 'Ausgabe', path: '/finance',
                icon: CATEGORY_ICON[d.cat] || CATEGORY_ICON.Other, value: formatEuro(d.amount)
            })),
            ...(serviceData || []).map((d) => ({
                id: `s-${d.id}`, date: d.date, title: d.work || 'Service', path: '/service',
                icon: <Wrench size={18} />, value: d.cost ? formatEuro(d.cost) : formatKm(d.km)
            })),
            ...(accessoriesData || []).map((d) => ({
                id: `a-${d.id}`, date: d.date, title: d.name || 'Zubehör', path: '/accessories',
                icon: <Package size={18} />, value: formatEuro(d.price)
            }))
        ].filter((x) => x.date);
        return items.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
    }, [financeData, serviceData, accessoriesData]);

    // Täglicher KM-Check
    const allDates = [techData?.lastUpdated, ...recent.map((r) => r.date)].filter(Boolean).sort().reverse();
    const lastDate = toDate(allDates[0]);
    let daysSince = null;
    if (lastDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        daysSince = Math.max(0, Math.round((today - lastDate) / 86400000));
    }
    const checkDue = daysSince === null || daysSince >= 1;

    if (techLoading && !techData) return <LoadingBlock rows={4} />;

    const manufacturer = techData?.manufacturer || 'Kawasaki';
    const model = techData?.model || 'Versys 1000 SE';
    const plate = techData?.licensePlate || 'M-N 594';

    return (
        <div className="fade-in">
            <DataError errors={[financeError, serviceError, accError]} />
            {/* Maschine – Lack-Panel */}
            <section className="paint-panel" style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ minWidth: 0 }}>
                        <div className="stat-label">{manufacturer}</div>
                        <h2 style={{ margin: '2px 0 0', fontSize: '1.55rem', fontWeight: 800, lineHeight: 1.15 }}>{model}</h2>
                    </div>
                    <div className="plate" aria-label={`Kennzeichen ${plate}`}>
                        <span className="plate-eu">D</span>
                        <span className="plate-text">{plate}</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onOpenQuickEntry}
                    style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: '1.4rem', padding: 0 }}
                    aria-label="KM-Stand aktualisieren"
                >
                    <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Gauge size={14} /> Kilometerstand
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: 2 }}>
                        <span className="num" style={{
                            fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1,
                            background: 'linear-gradient(180deg, #ffffff 0%, #c4cad1 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
                        }}>
                            {currentKm ? formatNumber(currentKm) : '–'}
                        </span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>km</span>
                    </div>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <span className={`status-pill ${checkDue ? 'status-warn' : 'status-ok'}`}>
                        {checkDue ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        {daysSince === null
                            ? 'Noch kein Eintrag'
                            : daysSince === 0
                                ? 'Heute aktualisiert'
                                : `Zuletzt ${relativeDay(allDates[0])}`}
                    </span>
                    <button type="button" className="btn-primary" onClick={onOpenQuickEntry} style={{ minHeight: 40, padding: '0 1rem' }}>
                        <Gauge size={16} /> KM eintragen
                    </button>
                </div>
            </section>

            {/* Status-Kacheln */}
            <div className="card-grid" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="surface surface-tappable" onClick={() => onNavigate('/service')} style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="stat-label">Service</span>
                        <Wrench size={16} color="var(--text-secondary)" />
                    </div>
                    <div className="stat-value" style={{ marginTop: 8, fontSize: '1.2rem', color: service.level === 'danger' ? 'var(--danger)' : service.level === 'warn' ? 'var(--warn)' : 'var(--text-primary)' }}>
                        {serviceHeadline(service)}
                    </div>
                    {service.progress !== null && (
                        <div className={`progress ${service.level === 'danger' ? 'danger' : service.level === 'warn' ? 'warn' : ''}`} style={{ marginTop: 10 }}>
                            <span style={{ width: `${Math.round(service.progress * 100)}%` }} />
                        </div>
                    )}
                    <div className="stat-sub" style={{ marginTop: 8 }}>
                        {service.nextKm ? `bei ${formatKm(service.nextKm)}` : 'Intervall festlegen'}
                        {service.nextDate ? ` · bis ${formatDate(service.nextDate)}` : ''}
                    </div>
                </button>

                <button type="button" className="surface surface-tappable" onClick={() => onNavigate('/finance')} style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="stat-label">Kosten {thisYear}</span>
                        <Wallet size={16} color="var(--text-secondary)" />
                    </div>
                    <div className="stat-value" style={{ marginTop: 8, fontSize: '1.2rem' }}>{listsLoading ? '…' : formatEuro(costs.year, 0)}</div>
                    <div className="stat-sub" style={{ marginTop: 8 }}>Gesamt {listsLoading ? '…' : formatEuro(costs.total, 0)}</div>
                    <div className="stat-sub" style={{ marginTop: 2 }}>
                        {listsLoading ? 'Lade …' : lastFuel ? `Tanken ${formatDate(lastFuel.date, { day: '2-digit', month: '2-digit' })} · ${formatEuro(lastFuel.amount)}` : 'Noch kein Tankstopp'}
                    </div>
                </button>
            </div>

            {/* Schnellzugriff */}
            <h3 className="section-title">Schnell erfassen</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {[
                    { label: 'Tanken', icon: <Fuel size={20} />, onClick: onOpenQuickEntry },
                    { label: 'Service', icon: <Wrench size={20} />, onClick: () => onNavigate('/service', { state: { openNew: true } }) },
                    { label: 'Zubehör', icon: <Package size={20} />, onClick: () => onNavigate('/accessories', { state: { openNew: true } }) },
                    { label: 'Foto', icon: <Camera size={20} />, onClick: () => onNavigate('/gallery') }
                ].map((a) => (
                    <button key={a.label} type="button" className="surface surface-tappable" onClick={a.onClick}
                        style={{ padding: '0.85rem 0.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                        <span className="icon-bubble" style={{ width: 38, height: 38 }}>{a.icon}</span>
                        {a.label}
                    </button>
                ))}
            </div>

            {/* Letzte Einträge */}
            <div className="section-title-row">
                <h3 className="section-title">Zuletzt</h3>
                <button type="button" className="link-btn" onClick={() => onNavigate('/finance')}>Alle Kosten</button>
            </div>
            {recent.length === 0 ? (
                <div className="empty-state">Noch keine Einträge – starte mit dem ersten KM-Check.</div>
            ) : (
                <div className="list">
                    {recent.map((r) => (
                        <button key={r.id} type="button" className="list-row" onClick={() => onNavigate(r.path)}>
                            <span className="icon-bubble">{r.icon}</span>
                            <span className="list-row-main">
                                <span className="list-row-title" style={{ display: 'block' }}>{r.title}</span>
                                <span className="list-row-sub" style={{ display: 'block' }}>{formatDate(r.date)}</span>
                            </span>
                            <span className="list-row-value">{r.value}</span>
                            <ChevronRight size={16} color="var(--text-tertiary)" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
