import React, { useState, useEffect } from 'react';
import { Settings, DollarSign, Wrench, Package, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocument, useCollection } from '../hooks/useFirestore';

const Dashboard = () => {
    const navigate = useNavigate();

    // Fetch data
    const { data: techData } = useDocument('technical_data');
    const { data: financeData } = useCollection('finance');
    const { data: serviceData } = useCollection('service');
    const { data: accessoriesData } = useCollection('accessories');

    // Calculate stats
    const totalKm = techData?.currentKm || '---';
    const nextService = techData?.nextServiceDue || '---';

    // Calculate generic expenses
    const financeTotal = financeData?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0;
    const serviceTotal = serviceData?.reduce((sum, item) => sum + parseFloat(item.cost || 0), 0) || 0;
    const accTotal = accessoriesData?.reduce((sum, item) => sum + parseFloat(item.price || 0), 0) || 0;

    const totalExpenses = financeTotal + serviceTotal + accTotal;

    // Determine last ride (or last entry date)
    const allDates = [
        ...(financeData || []).map(d => d.date),
        ...(serviceData || []).map(d => d.date),
        ...(accessoriesData || []).map(d => d.date)
    ].filter(Boolean).sort().reverse();

    const lastActivity = allDates[0] ? new Date(allDates[0]).toLocaleDateString() : 'N/A';

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
                padding: '2rem',
                background: 'linear-gradient(135deg, rgba(105, 190, 40, 0.1), rgba(0, 0, 0, 0))',
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
                    <div className="stat-item">
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
