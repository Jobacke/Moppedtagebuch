import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Wrench } from 'lucide-react';

const Service = () => {
    const [logs, setLogs] = useState([]);
    const [adding, setAdding] = useState(false);
    const [newLog, setNewLog] = useState({ date: '', km: '', work: '', nextDue: '', cost: '' });

    useEffect(() => {
        const saved = localStorage.getItem('mopped_service');
        if (saved) setLogs(JSON.parse(saved));
    }, []);

    const saveLogs = (updated) => {
        setLogs(updated);
        localStorage.setItem('mopped_service', JSON.stringify(updated));
    };

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newLog.work || !newLog.date) return;
        const log = { ...newLog, id: Date.now() };
        saveLogs([log, ...logs]);
        setNewLog({ date: '', km: '', work: '', nextDue: '', cost: '' });
        setAdding(false);
    };

    const handleDelete = (id) => {
        if (confirm('Eintrag löschen?')) {
            saveLogs(logs.filter(l => l.id !== id));
        }
    };

    return (
        <div className="section-container fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="section-title">Wartung & Service</h2>
                <button className="primary-btn" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => setAdding(!adding)}>
                    <Plus size={18} />
                </button>
            </div>

            {adding && (
                <form onSubmit={handleAdd} className="glass-panel fade-in" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <input
                        type="date"
                        className="input-field"
                        value={newLog.date}
                        onChange={e => setNewLog({ ...newLog, date: e.target.value })}
                        required
                    />
                    <input
                        type="number"
                        className="input-field"
                        placeholder="KM Stand"
                        value={newLog.km}
                        onChange={e => setNewLog({ ...newLog, km: e.target.value })}
                    />
                    <textarea
                        className="input-field"
                        placeholder="Durchgeführte Arbeiten"
                        rows={3}
                        value={newLog.work}
                        onChange={e => setNewLog({ ...newLog, work: e.target.value })}
                        required
                    />
                    <input
                        type="date"
                        className="input-field"
                        placeholder="Nächster Service"
                        value={newLog.nextDue}
                        onChange={e => setNewLog({ ...newLog, nextDue: e.target.value })}
                    />
                    <input
                        type="number"
                        className="input-field"
                        placeholder="Kosten (€)"
                        value={newLog.cost}
                        onChange={e => setNewLog({ ...newLog, cost: e.target.value })}
                    />
                    <button type="submit" className="primary-btn">Eintrag Hinzufügen</button>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {logs.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Keine Service-Einträge.</p>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="glass-panel" style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ color: 'var(--kawasaki-green)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> {log.date}
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    {log.km ? `${log.km} km` : ''}
                                </span>
                            </div>
                            <p style={{ margin: '0 0 0.5rem 0', lineHeight: '1.4' }}>{log.work}</p>
                            {log.nextDue && (
                                <div style={{ fontSize: '0.8rem', color: 'orange', marginTop: '0.5rem' }}>
                                    Nächster Check: {log.nextDue}
                                </div>
                            )}
                            {log.cost && (
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.2rem', fontWeight: 'bold' }}>
                                    Kosten: € {log.cost}
                                </div>
                            )}
                            <button
                                onClick={() => handleDelete(log.id)}
                                style={{
                                    position: 'absolute',
                                    top: '1rem',
                                    right: '1rem',
                                    background: 'none',
                                    color: 'rgba(255, 255, 255, 0.3)'
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Service;
