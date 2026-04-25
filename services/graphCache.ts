/**
 * 知识图谱 IndexedDB 缓存服务
 * 
 * 将生成的知识图谱结果按文章内容 hash 缓存到 IndexedDB，
 * 避免重复调用 2-3 次 AI API（1-3 分钟），刷新后可直接使用缓存（0 秒）。
 */

const DB_NAME = 'sws-knowledge-graph-cache';
const DB_VERSION = 1;
const STORE_NAME = 'graphs';
const MAX_CACHE_ENTRIES = 20;

interface CacheEntry {
    hash: string;
    data: unknown;
    timestamp: number;
    articleCount: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
            }
        };
    });
}

export async function contentHash(str: string): Promise<string> {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    } catch {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7FFFFFFF;
        }
        return hash.toString(36);
    }
}

export async function getGraphCache(contentHash: string): Promise<unknown | null> {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(contentHash);
            request.onsuccess = () => {
                const entry: CacheEntry | undefined = request.result;
                if (entry) {
                    console.log(`[GraphCache] 命中缓存 (hash: ${contentHash}, 生成于 ${new Date(entry.timestamp).toLocaleString()}, ${entry.articleCount} 篇文章)`);
                    resolve(entry.data);
                } else {
                    console.log(`[GraphCache] 未命中缓存 (hash: ${contentHash})`);
                    resolve(null);
                }
            };
            request.onerror = () => {
                console.warn('[GraphCache] 读取缓存失败:', request.error);
                resolve(null);
            };
        });
    } catch (err) {
        console.warn('[GraphCache] IndexedDB 不可用，跳过缓存:', err);
        return null;
    }
}

export async function saveGraphCache(contentHash: string, data: unknown, articleCount: number): Promise<void> {
    try {
        const db = await openDB();
        const entry: CacheEntry = {
            hash: contentHash,
            data,
            timestamp: Date.now(),
            articleCount,
        };
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(entry);
            tx.oncomplete = () => {
                console.log(`[GraphCache] 已保存缓存 (hash: ${contentHash}, ${articleCount} 篇文章)`);
                cleanupOldEntries(db);
                resolve();
            };
            tx.onerror = () => {
                console.warn('[GraphCache] 保存缓存失败:', tx.error);
                reject(tx.error);
            };
        });
    } catch (err) {
        console.warn('[GraphCache] IndexedDB 不可用，跳过缓存:', err);
    }
}

async function cleanupOldEntries(db: IDBDatabase): Promise<void> {
    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const entries: CacheEntry[] = request.result;
            if (entries.length > MAX_CACHE_ENTRIES) {
                entries.sort((a, b) => a.timestamp - b.timestamp);
                const toDelete = entries.length - MAX_CACHE_ENTRIES;
                for (let i = 0; i < toDelete; i++) {
                    store.delete(entries[i].hash);
                }
                console.log(`[GraphCache] 已清理 ${toDelete} 个过期缓存条目`);
            }
        };
    } catch (err) {
        console.warn('[GraphCache] 清理过期缓存失败:', err);
    }
}

export async function removeGraphCache(hash: string): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(hash);
            request.onsuccess = () => {
                console.log(`[GraphCache] 已删除缓存 (hash: ${hash})`);
                resolve();
            };
            request.onerror = () => {
                console.warn('[GraphCache] 删除缓存失败:', request.error);
                reject(request.error);
            };
        });
    } catch (err) {
        console.warn('[GraphCache] IndexedDB 不可用，跳过删除缓存:', err);
    }
}

export async function clearGraphCache(): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.warn('[GraphCache] 清理缓存失败:', err);
    }
}
