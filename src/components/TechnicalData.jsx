import React, { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { useDocument } from '../hooks/useFirestore';

const TechnicalData = () => {
    const { data: remoteData, update, loading } = useDocument('technical_data');
    const [localData, setLocalData] = useState({
        manufacturer: 'Kawasaki',
        model: 'Versys 1000 SE',
        year: '2021',
        licensePlate: 'M-N 594',
        currentKm: '12450',
        nextServiceDue: '15000',
        vin: '',
        engine: '1043 ccm Inline-4',
        power: '120 PS (88 kW)',
        torque: '102 Nm @ 7500 rpm',
        weight: '257 kg',
        fuelCapacity: '21 L',
        tiresFront: '120/70 ZR17',
        tiresRear: '180/55 ZR17',
        battery: 'YTZ10S'
    });

    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (remoteData) {
            setLocalData(remoteData);
        }
    }, [remoteData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        await update(localData);
        setIsEditing(false);
    };

    if (loading) return <div className="loading">Laden...</div>;

    return (
        <div className="section-container fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="section-title">Technische Daten</h2>
                <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    style={{
                        background: 'none',
                        color: isEditing ? 'var(--kawasaki-green)' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    {isEditing ? <Save size={20} /> : <Settings size={20} />}
                    {isEditing ? 'Speichern' : 'Bearbeiten'}
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '1rem' }}>
                {Object.entries(localData).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', width: '40%' }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        {isEditing ? (
                            <input
                                type="text"
                                name={key}
                                value={value}
                                onChange={handleChange}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid var(--kawasaki-green)',
                                    color: 'white',
                                    textAlign: 'right',
                                    width: '55%',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                        ) : (
                            <span style={{ fontWeight: '500', width: '55%', textAlign: 'right' }}>{value || '-'}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TechnicalData;
