// App-PIN: wird nie im Klartext gespeichert.
// Ablage: Firestore users/{uid}/data/security → { pinHash, pinSalt, pinIterations }
// Nur nach Firebase-Login lesbar (Firestore-Regeln). Hash: PBKDF2-SHA-256 mit zufälligem Salt.

const ITERATIONS = 150000;
const enc = (s) => new TextEncoder().encode(s);
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function makeSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
}

export async function hashPin(pin, salt, iterations = ITERATIONS) {
    const key = await crypto.subtle.importKey('raw', enc(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc(salt), iterations, hash: 'SHA-256' },
        key,
        256
    );
    return toHex(bits);
}

export async function createPinRecord(pin) {
    const salt = makeSalt();
    return {
        pinHash: await hashPin(pin, salt),
        pinSalt: salt,
        pinIterations: ITERATIONS,
        pinUpdatedAt: new Date().toISOString()
    };
}

export async function verifyPin(pin, record) {
    if (!record?.pinHash || !record?.pinSalt) return false;
    const hash = await hashPin(pin, record.pinSalt, record.pinIterations || ITERATIONS);
    // Vergleich in konstanter Zeit
    if (hash.length !== record.pinHash.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ record.pinHash.charCodeAt(i);
    return diff === 0;
}

// Schutz gegen Durchprobieren: nach 5 Fehlversuchen steigende Wartezeit
const FAIL_KEY = 'mopped_pin_fails';

export function getLockout() {
    try {
        const { count = 0, until = 0 } = JSON.parse(localStorage.getItem(FAIL_KEY) || '{}');
        return { count, until };
    } catch {
        return { count: 0, until: 0 };
    }
}

export function registerFailedAttempt() {
    const { count } = getLockout();
    const next = count + 1;
    const waitSec = next >= 5 ? Math.min(15 * 60, 30 * 2 ** (next - 5)) : 0;
    const state = { count: next, until: waitSec ? Date.now() + waitSec * 1000 : 0 };
    localStorage.setItem(FAIL_KEY, JSON.stringify(state));
    return state;
}

export function resetFailedAttempts() {
    localStorage.removeItem(FAIL_KEY);
}

export const isValidPin = (pin) => /^\d{4}$/.test(String(pin || ''));
