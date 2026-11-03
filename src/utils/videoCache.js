/**
 * Lokaler High-Speed Video-Cache (CacheStorage API + In-Memory Map).
 *
 * Speichert beim Upload oder bei der Optimierung die fertige MP4-Datei direkt aus dem
 * Arbeitsspeicher im persistenten Browser-Cache (`CacheStorage`).
 * Dadurch startet das Video beim Klick auf Play in 0 ms direkt aus dem Gerätespeicher.
 */

const CACHE_NAME = 'mopped-video-cache-v2';
const memoryBlobMap = new Map();

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
        // Nur Videos bis 80 MB im persistenten CacheStorage ablegen, um Safari-Quota-Fehler zu vermeiden
        if (!isCacheStorageAvailable() || blob.size > 80 * 1024 * 1024) return;

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
