import React, { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';

const Accessories = () => {
    const { data: items, add, remove, loading } = useCollection('accessories');
    const [showForm, setShowForm] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', brand: '', date: '', price: '', installed: true });

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newItem.name || !newItem.price) return;

        await add(newItem);

        setNewItem({ name: '', brand: '', date: '', price: '', installed: true });
        setShowForm(false);
    };

    const handleDelete = async (id) => {
        if (confirm('Zubehör entfernen?')) {
            await remove(id);
        }
    };

    const totalValue = items ? items.reduce((sum, item) => sum + parseFloat(item.price || 0), 0) : 0;

    if (loading) return <div className="loading">Laden...</div>;

    return (
        <div className="section-container fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="section-title">Zubehör</h2>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px 16px', borderRadius: '12px' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>€ {totalValue.toFixed(2)}</span>
                </div>
            </div>

            <button className="primary-btn" onClick={() => setShowForm(!showForm)} style={{ marginBottom: '1.5rem' }}>
                <Plus size={20} /> Neues Zubehör
            </button>

            {showForm && (
                <form onSubmit={handleAdd} className="glass-panel fade-in" style={{ marginBottom: '1.5rem' }}>
                    <input
                        type="text"
                        placeholder="Teilebezeichnung"
                        className="input-field"
                        value={newItem.name}
                        onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Marke / Hersteller"
                        className="input-field"
                        value={newItem.brand}
                        onChange={e => setNewItem({ ...newItem, brand: e.target.value })}
                    />
                    <input
                        type="date"
                        className="input-field"
                        value={newItem.date}
                        onChange={e => setNewItem({ ...newItem, date: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Kaufpreis (€)"
                        className="input-field"
                        value={newItem.price}
                        onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                        step="0.01"
                        required
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={newItem.installed}
                            onChange={e => setNewItem({ ...newItem, installed: e.target.checked })}
                            style={{ width: '20px', height: '20px', accentColor: 'var(--kawasaki-green)' }}
                        />
                        <span>Bereits montiert</span>
                    </label>
                    <button type="submit" className="primary-btn">Speichern</button>
                </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                {items.map((item) => (
                    <div key={item.id} className="glass-panel" style={{ padding: '1rem', position: 'relative' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem', lineHeight: '1.2' }}>{item.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{item.brand}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--kawasaki-green)', fontWeight: 'bold' }}>€ {parseFloat(item.price).toFixed(2)}</div>
                        {item.date && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{item.date}</div>}
                        <button
                            onClick={() => handleDelete(item.id)}
                            style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'none',
                                color: 'rgba(255, 255, 255, 0.3)'
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
                {items.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)' }}>Kein Zubehör eingetragen.</p>}
            </div>
        </div>
    );
};

export default Accessories;
