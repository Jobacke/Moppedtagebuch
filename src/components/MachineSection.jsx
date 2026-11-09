import React from 'react';
import { useLocation } from 'react-router-dom';
import { Settings2, Package, Camera } from 'lucide-react';
import { PageHeader } from './ui';

const SEGMENTS = [
    { path: '/tech', label: 'Daten', icon: <Settings2 size={16} /> },
    { path: '/accessories', label: 'Zubehör', icon: <Package size={16} /> },
    { path: '/gallery', label: 'Galerie', icon: <Camera size={16} /> },
];

/** Bereich „Maschine“: Technik, Zubehör und Galerie unter einem Tab. */
const MachineSection = ({ children, onNavigate }) => {
    const location = useLocation();

    return (
        <div className="fade-in">
            <PageHeader title="Maschine" subtitle="Technische Daten, Umbauten & Bilder" />
            <div className="segmented" role="tablist" aria-label="Bereich Maschine">
                {SEGMENTS.map((seg) => {
                    const active = location.pathname === seg.path;
                    return (
                        <button
                            key={seg.path}
                            role="tab"
                            aria-selected={active}
                            className={active ? 'active' : ''}
                            onClick={() => onNavigate(seg.path)}
                        >
                            {seg.icon}
                            {seg.label}
                        </button>
                    );
                })}
            </div>
            {children}
        </div>
    );
};

export default MachineSection;
