import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';

const Finance = () => {
    const { data: expenses, add, remove, loading } = useCollection('finance');
    const [newExpense, setNewExpense] = useState({ date: '', desc: '', amount: '', cat: 'Fuel' });
    const [showForm, setShowForm] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newExpense.amount || !newExpense.desc) return;

        await add(newExpense);

        setNewExpense({ date: '', desc: '', amount: '', cat: 'Fuel' });
        setShowForm(false);
    };

    const handleDelete = async (id) => {
        if (confirm('Eintrag löschen?')) {
            await remove(id);
        }
    };

    const total = expenses ? expenses.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) : 0;

    if (loading) return <div className="loading">Laden...</div>;

    return (
        <div className="section-container fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="section-title">Finanzen</h2>
                <div style={{ background: 'rgba(105, 190, 40, 0.2)', padding: '8px 16px', borderRadius: '12px' }}>
                    <span style={{ color: 'var(--kawasaki-green)', fontWeight: 'bold' }}>€ {total.toFixed(2)}</span>
                </div>
            </div>

            <button className="primary-btn" onClick={() => setShowForm(!showForm)} style={{ marginBottom: '1.5rem' }}>
                <Plus size={20} /> Neuer Eintrag
            </button>

            {showForm && (
                <form onSubmit={handleAdd} className="glass-panel fade-in" style={{ marginBottom: '1.5rem' }}>
                    <input
                        type="date"
                        className="input-field"
                        value={newExpense.date}
                        onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Beschreibung"
                        className="input-field"
                        value={newExpense.desc}
                        onChange={e => setNewExpense({ ...newExpense, desc: e.target.value })}
                        required
                    />
                    <select
                        className="input-field"
                        value={newExpense.cat}
                        onChange={e => setNewExpense({ ...newExpense, cat: e.target.value })}
                    >
                        <option value="Fuel">Tanken</option>
                        <option value="Service">Wartung</option>
                        <option value="Insurance">Versicherung</option>
                        <option value="Tax">Steuer</option>
                        <option value="Parts">Teile</option>
                        <option value="Other">Sonstiges</option>
                    </select>
                    <input
                        type="number"
                        placeholder="Betrag (€)"
                        className="input-field"
                        value={newExpense.amount}
                        onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                        step="0.01"
                        required
                    />
                    <button type="submit" className="primary-btn">Speichern</button>
                </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {expenses.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Keine Einträge vorhanden.</p>
                ) : (
                    expenses.map((ex) => (
                        <div key={ex.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{ex.desc}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {ex.date} • {ex.cat}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--kawasaki-green)', fontWeight: 'bold' }}>€ {parseFloat(ex.amount).toFixed(2)}</span>
                                <button onClick={() => handleDelete(ex.id)} style={{ background: 'none', color: '#ff4d4f' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Finance;
