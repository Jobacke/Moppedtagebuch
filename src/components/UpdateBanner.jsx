import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/* global __APP_BUILD_ID__ */
const CURRENT_BUILD = typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
const MIN_GAP = 60 * 1000;

/**
 * Update-Hinweis: fragt beim Öffnen, beim Zurückkehren in die App und alle 10 Minuten
 * /version.json ab (am Browser-Cache vorbei). Liegt online ein neuerer Stand, erscheint
 * „Neue Version verfügbar“ – ein Tipp lädt sie, ohne dass der Safari-Cache geleert werden muss.
 */
export default function UpdateBanner() {
    const [available, setAvailable] = useState(null);

    useEffect(() => {
        // ?appv=… stammt vom „Neu laden“ – aus der Adresse wieder entfernen
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('appv')) {
                url.searchParams.delete('appv');
                window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
            }
        } catch { /* ignore */ }

        if (CURRENT_BUILD === 'dev') return undefined;
        let lastCheck = 0;
        let cancelled = false;

        const check = async () => {
            const now = Date.now();
            if (now - lastCheck < MIN_GAP) return;
            lastCheck = now;
            try {
                const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${now}`, { cache: 'no-store' });
                if (!r.ok) return;
                const info = await r.json();
                if (!cancelled && info?.build && info.build !== CURRENT_BUILD) setAvailable(info);
            } catch {
                /* offline – später erneut */
            }
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };

        check();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', check);
        const timer = setInterval(check, 10 * 60 * 1000);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', check);
            clearInterval(timer);
        };
    }, []);

    if (!available) return null;

    const reload = () => {
        // Neue Adresse (?appv=…) erzwingt die frische Startseite statt der gespeicherten
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('appv', String(available.build).slice(0, 12));
            window.location.replace(url.toString());
        } catch {
            window.location.reload();
        }
    };

    return (
        <div
            role="status"
            style={{
                position: 'fixed',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 'calc(var(--tabbar-height, 64px) + 22px + env(safe-area-inset-bottom))',
                zIndex: 5500,
                width: 'calc(100% - 28px)',
                maxWidth: '520px',
                background: 'var(--accent, #dfe3e8)',
                color: 'var(--accent-contrast, #15171a)',
                borderRadius: '16px',
                padding: '10px 10px 10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)'
            }}
        >
            <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 700, lineHeight: 1.35 }}>
                Neue Version{available.version ? ` ${available.version}` : ''} verfügbar
            </span>
            <button
                type="button"
                onClick={reload}
                style={{
                    background: 'var(--accent-contrast, #15171a)',
                    color: 'var(--accent, #dfe3e8)',
                    border: 'none',
                    borderRadius: '11px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                }}
            >
                <RefreshCw size={15} />
                Neu laden
            </button>
        </div>
    );
}
