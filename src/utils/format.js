// Gemeinsame Formatierungs- und Berechnungshilfen

const DE = 'de-DE';

/** Heutiges Datum als YYYY-MM-DD in lokaler Zeit (nicht UTC – sonst kurz nach Mitternacht falsch). */
export function todayIso() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Zahl aus beliebigem KM-String ("12.450 km", "12450") – 0 bei leer/ungültig. */
export function parseKm(value) {
    if (value === null || value === undefined) return 0;
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return 0; // Datum, kein KM-Wert
    return parseInt(str.replace(/\D/g, ''), 10) || 0;
}

export function parseAmount(value) {
    if (value === null || value === undefined || value === '') return 0;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

export function formatNumber(n, digits = 0) {
    return new Intl.NumberFormat(DE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n || 0);
}

export function formatKm(value, { unit = true } = {}) {
    const n = typeof value === 'number' ? value : parseKm(value);
    if (!n) return '–';
    return unit ? `${formatNumber(n)} km` : formatNumber(n);
}

export function formatEuro(value, digits = 2) {
    const n = typeof value === 'number' ? value : parseAmount(value);
    return new Intl.NumberFormat(DE, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(n);
}

export function toDate(value) {
    if (!value) return null;
    const str = String(value);
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const de = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (de) return new Date(Number(de[3]), Number(de[2]) - 1, Number(de[1]));
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, opts) {
    const d = toDate(value);
    if (!d) return value ? String(value) : '';
    return d.toLocaleDateString(DE, opts || { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatMonth(value) {
    const d = toDate(value);
    if (!d) return 'Ohne Datum';
    return d.toLocaleDateString(DE, { month: 'long', year: 'numeric' });
}

/** Tage von heute bis zum Datum (negativ = vergangen). */
export function daysUntil(value) {
    const d = toDate(value);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
}

export function relativeDay(value) {
    const diff = daysUntil(value);
    if (diff === null) return '';
    if (diff === 0) return 'heute';
    if (diff === -1) return 'gestern';
    if (diff === 1) return 'morgen';
    if (diff < 0) return `vor ${Math.abs(diff)} Tagen`;
    return `in ${diff} Tagen`;
}

/** Höchster bekannter KM-Stand aus Technik, Service und Finanzen. */
export function computeCurrentKm(techData, serviceData = [], financeData = []) {
    const tech = parseKm(techData?.currentKm);
    const maxOf = (list) => (list || []).reduce((max, item) => Math.max(max, parseKm(item.km)), 0);
    return Math.max(tech, maxOf(serviceData), maxOf(financeData));
}

/**
 * Service-Status aus Technik-Daten (nextServiceDue = KM) und Service-Einträgen (nextDue = Datum).
 * level: 'ok' | 'warn' | 'danger' | 'unknown'
 */
export function computeServiceStatus(techData, serviceData = [], currentKm = 0) {
    const nextKm = parseKm(techData?.nextServiceDue);
    const logs = [...(serviceData || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const lastService = logs[0] || null;
    const nextDate = logs.find((l) => l.nextDue)?.nextDue || null;

    const lastServiceKm = (serviceData || [])
        .map((l) => parseKm(l.km))
        .filter((km) => km > 0 && (!currentKm || km <= currentKm))
        .reduce((max, km) => Math.max(max, km), 0);

    const remainingKm = nextKm ? nextKm - currentKm : null;
    const daysLeft = nextDate ? daysUntil(nextDate) : null;

    let progress = null;
    if (nextKm && lastServiceKm && nextKm > lastServiceKm) {
        progress = Math.min(1, Math.max(0, (currentKm - lastServiceKm) / (nextKm - lastServiceKm)));
    } else if (remainingKm !== null) {
        progress = remainingKm <= 0 ? 1 : null;
    }

    let level = 'unknown';
    if (remainingKm !== null || daysLeft !== null) {
        level = 'ok';
        if ((remainingKm !== null && remainingKm <= 1000) || (daysLeft !== null && daysLeft <= 30)) level = 'warn';
        if ((remainingKm !== null && remainingKm <= 0) || (daysLeft !== null && daysLeft < 0)) level = 'danger';
    }

    return { nextKm, nextDate, remainingKm, daysLeft, progress, level, lastService, lastServiceKm };
}

export function serviceHeadline(status) {
    if (status.remainingKm !== null) {
        if (status.remainingKm <= 0) return `${formatNumber(Math.abs(status.remainingKm))} km überfällig`;
        return `noch ${formatNumber(status.remainingKm)} km`;
    }
    if (status.daysLeft !== null) {
        if (status.daysLeft < 0) return `seit ${Math.abs(status.daysLeft)} Tagen fällig`;
        return `in ${status.daysLeft} Tagen`;
    }
    return 'nicht geplant';
}

export const STATUS_CLASS = {
    ok: 'status-ok',
    warn: 'status-warn',
    danger: 'status-danger',
    unknown: 'status-neutral'
};
