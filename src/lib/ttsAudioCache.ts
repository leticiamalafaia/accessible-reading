const TTS_CACHE_DB_NAME = "leitura_acessivel_tts_cache_v1";
const TTS_CACHE_STORE = "audio_segments";
const MAX_CACHED_SEGMENTS = 80;

interface CachedAudioRecord {
  key: string;
  audioDataUrl: string;
  lastUsedAt: number;
}

function hashCacheKey(raw: string): string {
  // Compact deterministic FNV-1a 64-bit-ish dual hash + length to keep IndexedDB keys small and fast
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b1;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}-${raw.length}`;
}

function openTtsCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(TTS_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TTS_CACHE_STORE)) {
        const store = db.createObjectStore(TTS_CACHE_STORE, { keyPath: "key" });
        store.createIndex("lastUsedAt", "lastUsedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedTtsAudio(rawKey: string): Promise<string | null> {
  try {
    const db = await openTtsCacheDb();
    const hashedKey = hashCacheKey(rawKey);
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(TTS_CACHE_STORE, "readwrite");
      const store = tx.objectStore(TTS_CACHE_STORE);
      const req = store.get(hashedKey);
      req.onsuccess = () => {
        const record = req.result as CachedAudioRecord | undefined;
        if (record?.audioDataUrl) {
          // Touch LRU timestamp
          store.put({
            key: hashedKey,
            audioDataUrl: record.audioDataUrl,
            lastUsedAt: Date.now(),
          });
          resolve(record.audioDataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveCachedTtsAudio(
  rawKey: string,
  audioDataUrl: string
): Promise<void> {
  try {
    const db = await openTtsCacheDb();
    const hashedKey = hashCacheKey(rawKey);
    await new Promise<void>((resolve) => {
      const tx = db.transaction(TTS_CACHE_STORE, "readwrite");
      const store = tx.objectStore(TTS_CACHE_STORE);
      store.put({
        key: hashedKey,
        audioDataUrl,
        lastUsedAt: Date.now(),
      } satisfies CachedAudioRecord);

      // Trim oldest cached segments if limit exceeded
      const countReq = store.count();
      countReq.onsuccess = () => {
        const excess = countReq.result - MAX_CACHED_SEGMENTS;
        if (excess > 0) {
          let removed = 0;
          const idx = store.index("lastUsedAt");
          const cursorReq = idx.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor && removed < excess) {
              cursor.delete();
              removed += 1;
              cursor.continue();
            }
          };
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-blocking cache write failure (e.g. quota or private browsing)
  }
}

export async function clearTtsAudioCache(): Promise<void> {
  try {
    const db = await openTtsCacheDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(TTS_CACHE_STORE, "readwrite");
      tx.objectStore(TTS_CACHE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore cleanup errors when IndexedDB is unavailable
  }
}
