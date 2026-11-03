import React, { useState } from 'react';
import { Plus, Trash2, Fuel } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';

const CATEGORY_LABELS = {
    Fuel: '⛽ Tanken',
    Service: '🔧 Wartung',
    Insurance: '🛡️ Versicherung',
    Tax: '🏛️ Steuer',
    Parts: '🔩 Teile',
    Other: '📦 Sonstiges'
};

function formatDeDate(dateStr) {
    if (!dateStr) return '';
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    return dateStr;
}

const Finance = () => {
    const { data: expenses, add, remove, loading } = useCollection('finance');
    const [newExpense, setNewExpense] = useState(() => ({
        date: new Date().toISOString().split('T')[0],
        station: '',
        desc: '',
        amount: '',
        cat: 'Fuel'
    }));
    const [showForm, setShowForm] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        const cleanAmount = String(newExpense.amount || '').replace(',', '.');
        if (!cleanAmount) return;

        const isFuel = newExpense.cat === 'Fuel';
        const stationName = (newExpense.station || '').trim();
        const customDesc = (newExpense.desc || '').trim();

        const finalDesc = isFuel
            ? (stationName ? `⛽ Tanken • ${stationName}${customDesc ? ` (${customDesc})` : ''}` : (customDesc || '⛽ Tanken'))
            : (customDesc || CATEGORY_LABELS[newExpense.cat] || 'Ausgabe');

        await add({
            date: newExpense.date || new Date().toISOString().split('T')[0],
            station: stationName,
            desc: finalDesc,
            amount: parseFloat(cleanAmount).toFixed(2),
            cat: newExpense.cat
        });

        setNewExpense({
            date: new Date().toISOString().split('T')[0],
            station: '',
            desc: '',
            amount: '',
            cat: 'Fuel'
        });
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
                <h2 className="section-title">Finanzen & Tanken</h2>
                <div style={{ background: 'rgba(105, 190, 40, 0.2)', padding: '8px 16px', borderRadius: '12px' }}>
                    <span style={{ color: 'var(--kawasaki-green)', fontWeight: 'bold' }}>€ {total.toFixed(2)}</span>
                </div>
            </div>

            <button className="primary-btn" onClick={() => setShowForm(!showForm)} style={{ marginBottom: '1.5rem' }}>
                <Plus size={20} /> Neue Tankrechnung / Ausgabe
            </button>

            {showForm && (
                <form onSubmit={handleAdd} className="glass-panel fade-in" style={{ marginBottom: '1.5rem' }}>
                    <select
                        className="input-field"
                        value={newExpense.cat}
                        onChange={e => setNewExpense({ ...newExpense, cat: e.target.value })}
                    >
                        <option value="Fuel">⛽ Tanken</option>
                        <option value="Service">🔧 Wartung</option>
                        <option value="Insurance">🛡️ Versicherung</option>
                        <option value="Tax">🏛️ Steuer</option>
                        <option value="Parts">🔩 Teile</option>
                        <option value="Other">📦 Sonstiges</option>
                    </select>

                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Datum des Tankens / Belegs
                    </label>
                    <input
                        type="date"
                        className="input-field"
                        value={newExpense.date}
                        onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                        required
                    />

                    {newExpense.cat === 'Fuel' && (
                        <>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Tankstelle
                            </label>
                            <input
                                type="text"
                                placeholder="z. B. Aral, Shell, Esso, Jet..."
                                className="input-field"
                                value={newExpense.station}
                                onChange={e => setNewExpense({ ...newExpense, station: e.target.value })}
                                required
                            />
                        </>
                    )}

                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Betrag (€)
                    </label>
                    <input
                        type="number"
                        inputMode="decimal"
                        placeholder="z. B. 28.50"
                        className="input-field"
                        value={newExpense.amount}
                        onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                        step="0.01"
                        required
                    />

                    <input
                        type="text"
                        placeholder={newExpense.cat === 'Fuel' ? 'Notiz (optional)' : 'Beschreibung'}
                        className="input-field"
                        value={newExpense.desc}
                        onChange={e => setNewExpense({ ...newExpense, desc: e.target.value })}
                        required={newExpense.cat !== 'Fuel'}
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
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                    {ex.desc}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    📅 {formatDeDate(ex.date)}
                                    {ex.station ? ` • ⛽ ${ex.station}` : ''}
                                    {ex.km ? ` • 🛣️ ${ex.km} km` : ''}
                                    {!ex.station ? ` • ${CATEGORY_LABELS[ex.cat] || ex.cat}` : ''}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ color: 'var(--kawasaki-green)', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    € {parseFloat(ex.amount).toFixed(2)}
                                </span>
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
