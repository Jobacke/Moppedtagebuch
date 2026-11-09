import React, { useState, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { useDocument } from '../hooks/useFirestore';
import { LoadingBlock } from './ui';
import { formatKm, formatDate } from '../utils/format';

const DEFAULTS = {
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
};

// Gruppierung & deutsche Bezeichnungen
const GROUPS = [
    {
        title: 'Fahrzeug',
        fields: [
            ['manufacturer', 'Hersteller'],
            ['model', 'Modell'],
            ['year', 'Baujahr'],
            ['licensePlate', 'Kennzeichen'],
            ['vin', 'Fahrgestellnummer']
        ]
    },
    {
        title: 'Laufleistung',
        fields: [
            ['currentKm', 'KM-Stand', 'km'],
            ['nextServiceDue', 'Nächster Service bei', 'km']
        ]
    },
    {
        title: 'Motor & Gewicht',
        fields: [
            ['engine', 'Motor'],
            ['power', 'Leistung'],
            ['torque', 'Drehmoment'],
            ['weight', 'Gewicht'],
            ['fuelCapacity', 'Tankinhalt']
        ]
    },
    {
        title: 'Reifen & Elektrik',
        fields: [
            ['tiresFront', 'Reifen vorne'],
            ['tiresRear', 'Reifen hinten'],
            ['battery', 'Batterie']
        ]
    }
];

const HIDDEN = new Set(['lastUpdated', 'lastUpdatedIso']);
const KNOWN = new Set(GROUPS.flatMap((g) => g.fields.map(([k]) => k)));

const prettify = (key) => {
    const s = key.replace(/([A-Z])/g, ' $1').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

const TechnicalData = () => {
    const { data: remoteData, update, loading } = useDocument('technical_data');
    const [localData, setLocalData] = useState(DEFAULTS);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (remoteData && !isEditing) {
            setLocalData(remoteData);
        }
    }, [remoteData, isEditing]);

    const handleChange = (key, value) => setLocalData((prev) => ({ ...prev, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await update(localData);
            setIsEditing(false);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setLocalData(remoteData || DEFAULTS);
        setIsEditing(false);
    };

    if (loading) return <LoadingBlock rows={6} />;

    const extraFields = Object.keys(localData || {})
        .filter((k) => !KNOWN.has(k) && !HIDDEN.has(k))
        .map((k) => [k, prettify(k)]);
    const groups = extraFields.length ? [...GROUPS, { title: 'Weitere Angaben', fields: extraFields }] : GROUPS;

    const display = (value, unit) => {
        if (value === undefined || value === null || value === '') return '–';
        if (unit === 'km') return formatKm(value);
        return value;
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.25rem' }}>
                {isEditing ? (
                    <>
                        <button className="secondary-btn" onClick={handleCancel} style={{ minHeight: 40 }}>
                            <X size={16} /> Abbrechen
                        </button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ minHeight: 40 }}>
                            <Check size={16} /> {saving ? 'Speichere …' : 'Speichern'}
                        </button>
                    </>
                ) : (
                    <button className="secondary-btn" onClick={() => setIsEditing(true)} style={{ minHeight: 40 }}>
                        <Pencil size={16} /> Bearbeiten
                    </button>
                )}
            </div>

            {groups.map((group) => (
                <div key={group.title}>
                    <div className="group-header"><span>{group.title}</span></div>
                    <div className="list">
                        {group.fields.map(([key, label, unit]) => (
                            <div key={key} className="kv-row">
                                <span className="kv-label">{label}</span>
                                {isEditing ? (
                                    <input
                                        className="kv-input"
                                        type="text"
                                        inputMode={unit === 'km' ? 'numeric' : 'text'}
                                        value={localData?.[key] ?? ''}
                                        onChange={(e) => handleChange(key, e.target.value)}
                                        aria-label={label}
                                    />
                                ) : (
                                    <span className={`kv-value ${unit ? 'num' : ''}`} style={key === 'vin' ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.88rem' } : undefined}>
                                        {display(localData?.[key], unit)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {localData?.lastUpdated && (
                <p className="stat-sub" style={{ textAlign: 'center', marginTop: '1.2rem' }}>
                    KM-Stand zuletzt aktualisiert am {formatDate(localData.lastUpdated)}
                </p>
            )}
        </div>
    );
};

export default TechnicalData;
