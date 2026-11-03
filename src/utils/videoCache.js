/**
 * Lokaler High-Speed Video-Cache (CacheStorage API + In-Memory ObjectURLs).
 *
 * Warum ist das entscheidend für 100% flüssiges Abspielen bei voller 1080p-Qualität?
 * 1. Direkt beim Hochladen (oder Komprimieren) liegt die fertige MP4-Datei ohnehin lokal im RAM.
 *    Wir legen sie sofort unter ihrer Firebase-URL im persistenten Browser-Cache (`CacheStorage`) ab.
 *    Beim Klick auf Play startet das Video in 0 ms direkt aus dem Gerätespeicher – ohne einen
 *    einzigen Byte neu aus dem Internet laden zu müssen!
 * 2. Öffnet man die Galerie auf einem zweiten Gerät (z. B. iPhone), lädt `warmVideoInCache`
 *    die Videos im Hintergrund in den lokalen Cache vor, während man die Galerie betrachtet.
 */

const CACHE_NAME = 'mopped-video-cache-v2';
const memoryBlobMap = new Map();
const inFlightWarmups = new Map();

function isCacheStorageAvailable() {
    return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Speichert ein Video-Blob/-File unter seiner Cloud-URL im persistenten Gerätespeicher.
 */
export async function cacheVideoBlob(url, blob) {
    if (!url || !blob) return;
    try {
        memoryBlobMap.set(url, blob);
        if (!isCacheStorageAvailable()) return;

        const cache = await window.caches.open(CACHE_NAME);
        const response = new Response(blob, {
            headers: {
                'Content-Type': blob.type || 'video/mp4',
                'Content-Length': String(blob.size || 0),
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
        await cache.put(url, response);
    } catch {
        // Quota oder Private-Browsing ignorieren – Memory-Map greift trotzdem
    }
}

/**
 * Prüft, ob das Video bereits lokal im Cache liegt, und gibt ggf. ein Blob zurück.
 */
export async function getCachedVideoBlob(url) {
    if (!url) return null;

    if (memoryBlobMap.has(url)) {
        return memoryBlobMap.get(url);
    }

    if (!isCacheStorageAvailable()) return null;

    try {
        const cache = await window.caches.open(CACHE_NAME);
        const match = await cache.match(url);
        if (match) {
            const blob = await match.blob();
            if (blob && blob.size > 0) {
                memoryBlobMap.set(url, blob);
                return blob;
            }
        }
    } catch {
        // ignore
    }

    return null;
}

/**
 * Lädt ein Video im Hintergrund leise in den lokalen Cache vor, damit es beim Antippen
 * sofort mit 0 ms Ladezeit lokal abspielt.
 */
export function warmVideoInCache(url) {
    if (!url) return Promise.resolve(null);
    if (memoryBlobMap.has(url)) return Promise.resolve(memoryBlobMap.get(url));
    if (inFlightWarmups.has(url)) return inFlightWarmups.get(url);

    const promise = (async () => {
        try {
            const existing = await getCachedVideoBlob(url);
            if (existing) return existing;

            const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
            if (!response.ok) return null;

            const blob = await response.blob();
            if (blob && blob.size > 0) {
                await cacheVideoBlob(url, blob);
                return blob;
            }
        } catch {
            // Netzwerkfehler im Hintergrund still ignorieren
        } finally {
            inFlightWarmups.delete(url);
        }
        return null;
    })();

    inFlightWarmups.set(url, promise);
    return promise;
}

/**
 * Entfernt ein gelöschtes Video aus dem lokalen Gerätespeicher.
 */
export async function evictVideoFromCache(url) {
    if (!url) return;
    memoryBlobMap.delete(url);
    if (!isCacheStorageAvailable()) return;
    try {
        const cache = await window.caches.open(CACHE_NAME);
        await cache.delete(url);
    } catch {
        // ignore
    }
}
