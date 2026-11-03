import React, { useEffect, useState } from 'react';
import { Settings, DollarSign, Wrench, Package, Zap, CheckCircle2, AlertTriangle, Bot, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocument, useCollection } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { generateBotScriptWithToken } from '../utils/botScriptTemplate';

const Dashboard = ({ onOpenQuickEntry }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [copiedBotScript, setCopiedBotScript] = useState(false);

    // Fetch data
    const { data: techData, update: updateTechData } = useDocument('technical_data');
    const { data: financeData } = useCollection('finance');
    const { data: serviceData } = useCollection('service');
    const { data: accessoriesData } = useCollection('accessories');

    // Calculate highest KM stand across technical_data, service, and finance
    const techKmNum = parseInt(String(techData?.currentKm || '0').replace(/\D/g, ''), 10) || 0;
    const maxServiceKm = (serviceData || []).reduce((max, item) => {
        const val = parseInt(String(item.km || '0').replace(/\D/g, ''), 10) || 0;
        return val > max ? val : max;
    }, 0);
    const maxFinanceKm = (financeData || []).reduce((max, item) => {
        const val = parseInt(String(item.km || '0').replace(/\D/g, ''), 10) || 0;
        return val > max ? val : max;
    }, 0);

    const bestKmNum = Math.max(techKmNum, maxServiceKm, maxFinanceKm);
    const totalKm = bestKmNum > 0 ? String(bestKmNum) : (techData?.currentKm || '---');
    const nextService = techData?.nextServiceDue || '---';

    // Auto-heal technical_data if a higher KM stand was entered in Service or Finance
    useEffect(() => {
        if (techData && bestKmNum > techKmNum) {
            updateTechData({
                ...techData,
                currentKm: String(bestKmNum)
            });
        }
    }, [bestKmNum, techKmNum, techData, updateTechData]);

    const handleCopyConnectedBotScript = async () => {
        const refreshToken = currentUser?.refreshToken || currentUser?.stsTokenManager?.refreshToken || '';
        const uid = currentUser?.uid || '';
        const email = currentUser?.email || 'backhaus.johannes@gmail.com';

        const scriptText = generateBotScriptWithToken({
            refreshToken,
            uid,
            email,
            currentKm: totalKm,
            nextServiceDue: nextService,
            licensePlate: techData?.licensePlate || 'M-N 594'
        });

        try {
            await navigator.clipboard.writeText(scriptText);
            setCopiedBotScript(true);
            setTimeout(() => setCopiedBotScript(false), 4000);
        } catch (err) {
            alert('Kopieren fehlgeschlagen: ' + err.message);
        }
    };

    // Calculate generic expenses
    const financeTotal = financeData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0;
    const serviceTotal = serviceData?.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0) || 0;
    const accTotal = accessoriesData?.reduce((sum, item) => sum + parseFloat(item.price || 0), 0) || 0;

    const totalExpenses = financeTotal + serviceTotal + accTotal;

    // Determine last ride / last entry date (for 2-day reminder rhythm)
    const allDates = [
        techData?.lastUpdated,
        ...(financeData || []).map(d => d.date),
        ...(serviceData || []).map(d => d.date),
        ...(accessoriesData || []).map(d => d.date)
    ].filter(Boolean).sort().reverse();

    const lastDateRaw = allDates[0] || null;
    let daysSinceLastUpdate = null;
    let lastActivityFormatted = 'Noch kein Datum';

    if (lastDateRaw) {
        const parsed = new Date(lastDateRaw);
        if (!isNaN(parsed.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const entryDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            daysSinceLastUpdate = Math.max(0, Math.round((today - entryDay) / (1000 * 60 * 60 * 24)));
            lastActivityFormatted = parsed.toLocaleDateString('de-DE');
        }
    }

    const isDueForTwoDayCheck = daysSinceLastUpdate === null || daysSinceLastUpdate >= 1;

    const cards = [
        { title: 'Technik', icon: <Settings size={32} />, path: '/tech', color: 'rgba(59, 130, 246, 0.2)' },
        { title: 'Finanzen', icon: <DollarSign size={32} />, path: '/finance', color: 'rgba(16, 185, 129, 0.2)' },
        { title: 'Service', icon: <Wrench size={32} />, path: '/service', color: 'rgba(245, 158, 11, 0.2)' },
        { title: 'Zubehör', icon: <Package size={32} />, path: '/accessories', color: 'rgba(239, 68, 68, 0.2)' },
    ];

    return (
        <div className="dashboard fade-in">
            <div className="hero-section" style={{
                marginTop: '1rem',
                marginBottom: '2rem',
                textAlign: 'center',
                padding: '2rem 1.5rem 1.5rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(105, 190, 40, 0.12), rgba(0, 0, 0, 0))',
                borderRadius: '24px',
                border: '1px solid rgba(105, 190, 40, 0.3)'
            }}>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Versys 1000 SE</h2>
                <span style={{
                    background: 'var(--kawasaki-green)',
                    color: '#000',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                }}>{techData?.licensePlate || 'M-N 594'}</span>

                <div className="quick-stats" style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    marginTop: '2rem',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div className="stat-item" onClick={onOpenQuickEntry} style={{ cursor: 'pointer' }} title="Klicken zum Aktualisieren">
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold' }}>{totalKm}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>KM Stand</span>
                    </div>
                    <div className="stat-item">
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold' }}>{nextService}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nächster Service</span>
                    </div>
                    <div className="stat-item">
                        <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold' }}>€ {totalExpenses.toFixed(0)}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gesamtkosten</span>
                    </div>
                </div>

                {/* 2-Day Check Status & 1-Click Quick Entry Button */}
                <div style={{
                    marginTop: '1.5rem',
                    paddingTop: '1.1rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        color: isDueForTwoDayCheck ? '#fbbf24' : 'var(--kawasaki-green)'
                    }}>
                        {isDueForTwoDayCheck ? (
                            <>
                                <AlertTriangle size={15} />
                                <span>
                                    {daysSinceLastUpdate === null
                                        ? '2-Tage-Check aktiv: Jetzt ersten Schnell-Check starten'
                                        : `Letzter Eintrag vor ${daysSinceLastUpdate} Tagen (${lastActivityFormatted}) – KM-Update fällig!`}
                                </span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={15} />
                                <span>
                                    {daysSinceLastUpdate === 0
                                        ? 'Heute bereits aktualisiert – gute Fahrt!'
                                        : `Gestern aktualisiert (${lastActivityFormatted})`}
                                </span>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onOpenQuickEntry}
                        className="primary-btn"
                        style={{
                            padding: '11px 20px',
                            fontSize: '0.92rem',
                            boxShadow: '0 4px 16px rgba(105, 190, 40, 0.25)'
                        }}
                    >
                        <Zap size={18} />
                        Schnell-Eintrag (KM & Tanken)
                    </button>

                    <button
                        type="button"
                        onClick={handleCopyConnectedBotScript}
                        style={{
                            background: copiedBotScript ? 'rgba(105, 190, 40, 0.25)' : 'rgba(255, 255, 255, 0.07)',
                            border: '1px solid rgba(105, 190, 40, 0.45)',
                            color: copiedBotScript ? 'var(--kawasaki-green)' : 'var(--text-primary)',
                            padding: '9px 14px',
                            borderRadius: '999px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                    >
                        {copiedBotScript ? <Check size={15} /> : <Bot size={15} color="var(--kawasaki-green)" />}
                        {copiedBotScript
                            ? 'Fertiger Bot-Code (inkl. Schlüssel) kopiert!'
                            : 'Bot-Code (ohne Passwort) kopieren'}
                    </button>
                </div>
            </div>

            <h3 className="section-title">Bereiche</h3>
            <div className="card-grid">
                {cards.map((card) => (
                    <div
                        key={card.title}
                        className="glass-panel"
                        onClick={() => navigate(card.path)}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            aspectRatio: '1/1',
                            gap: '1rem',
                            transition: 'transform 0.2s, background 0.2s',
                            background: `linear-gradient(135deg, ${card.color}, rgba(30,30,30,0.4))`
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}>
                            {card.icon}
                        </div>
                        <span style={{ fontWeight: '600' }}>{card.title}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
