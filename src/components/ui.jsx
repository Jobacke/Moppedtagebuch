import React, { useEffect } from 'react';
import { X, CloudOff } from 'lucide-react';
import { triggerManualFirestoreRefresh } from '../hooks/useFirestore';

/** Bottom-Sheet im iOS-Stil. Schließt per Hintergrund-Tipp, X oder Escape. */
export function Sheet({ open, onClose, title, subtitle, icon, children }) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="sheet-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
                <div className="sheet-handle" />
                <div className="sheet-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                        {icon && <div className="icon-bubble">{icon}</div>}
                        <div style={{ minWidth: 0 }}>
                            <h3 className="sheet-title">{title}</h3>
                            {subtitle && <p className="sheet-subtitle">{subtitle}</p>}
                        </div>
                    </div>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export function PageHeader({ title, subtitle, action }) {
    return (
        <div className="page-header">
            <div style={{ minWidth: 0 }}>
                <h2 className="page-title">{title}</h2>
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}

export function Field({ label, children }) {
    return (
        <label className="field">
            <span className="field-label">{label}</span>
            {children}
        </label>
    );
}

export function EmptyState({ icon, title, text, action }) {
    return (
        <div className="empty-state">
            {icon}
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
            {text && <div style={{ fontSize: '0.88rem', marginTop: 4 }}>{text}</div>}
            {action && <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>{action}</div>}
        </div>
    );
}

export function LoadingBlock({ rows = 3 }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-busy="true" aria-label="Laden">
            <div className="skeleton" style={{ height: 120 }} />
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 60 }} />
            ))}
        </div>
    );
}

/** Sichtbarer Hinweis, wenn Daten nicht geladen werden konnten – statt stiller „0“. */
export function DataError({ errors = [] }) {
    const err = errors.find(Boolean);
    if (!err) return null;
    return (
        <div className="status-pill status-danger" role="alert"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: '12px 14px', margin: '0.5rem 0 0.75rem', fontWeight: 500 }}>
            <CloudOff size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ flex: 1 }}>
                Daten konnten nicht geladen werden – angezeigte Werte sind unvollständig.
                <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8, marginTop: 2 }}>Fehler: {err.code || err.message || String(err)}</span>
            </span>
            <button type="button" className="link-btn" style={{ color: 'inherit', padding: 0 }} onClick={triggerManualFirestoreRefresh}>Erneut</button>
        </div>
    );
}

