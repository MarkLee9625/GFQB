/**
 * 知识图谱 IndexedDB 缓存服务
 *
 * 将生成的知识图谱结果按文章内容 hash 缓存到 IndexedDB，
 * 避免重复调用 2-3 次 AI API（1-3 分钟），刷新后可直接使用缓存（0 秒）。
 *
 * 【v2 增强 —— LRU 智能淘汰】
 *   - 跟踪每条缓存的访问频次 (accessCount) 和最后访问时间 (lastAccess)
 *   - 淘汰时综合评分：最后访问时间 × 访问频率的对数 × 文章数的对数
 *   - 既保留高频热数据，也保留生成成本高（文章数多）的缓存
 */

const DB_NAME = 'sws-knowledge-graph-cache';
const DB_VERSION = 2; // 升级版本号以触发 onupgradeneeded
const STORE_NAME = 'graphs';
const MAX_CACHE_ENTRIES = 20;

interface CacheEntry {
    hash: string;
    data: unknown;
    timestamp: number;       // 创建时间
    lastAccess: number;      // 最后读取时间（LRU 核心指标）
    accessCount: number;     // 累计访问次数（LFU 辅助指标）
    articleCount: number;    // 生成时的文章数（成本权重）
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

/** 内部：更新缓存的访问统计（非关键路径，失败不阻止读取） */
async function updateAccessStats(db: IDBDatabase, entry: CacheEntry): Promise<void> {
    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        entry.lastAccess = Date.now();
        entry.accessCount = (entry.accessCount || 0) + 1;
        store.put(entry);
    } catch {
        // 非关键操作：访问统计更新失败不影响主流程
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
                    console.log(`[GraphCache] 命中缓存 (hash: ${contentHash}, 生成于 ${new Date(entry.timestamp).toLocaleString()}, ${entry.articleCount} 篇文章, 已访问 ${entry.accessCount || 0} 次)`);
                    // 异步更新访问统计（不阻塞结果返回）
                    updateAccessStats(db, entry);
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
        const now = Date.now();
        const entry: CacheEntry = {
            hash: contentHash,
            data,
            timestamp: now,
            lastAccess: now,
            accessCount: 0,
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

/**
 * LRU 淘汰评分函数
 *
 * 综合三个维度决定缓存的保留价值：
 *   1. lastAccess — 越新访问的缓存越有价值（LRU）
 *   2. accessCount — 访问越频繁的缓存越有价值（LFU），取对数压缩
 *   3. articleCount — 生成成本越高（文章数多）越有价值，取对数压缩
 *
 * 评分越高 → 越应该保留；评分越低 → 越优先淘汰。
 */
function getEvictionScore(entry: CacheEntry): number {
    // 兼容旧版本可能缺失的字段
    const lastAccess = entry.lastAccess || entry.timestamp || 0;
    const accessCount = entry.accessCount || 0;
    const articleCount = entry.articleCount || 1;

    // 频率因子：取对数避免高频条目过度压制其他条目
    const frequencyFactor = 1 + Math.log2(1 + accessCount);
    // 成本因子：文章数越多，重新生成代价越高
    const costFactor = 1 + Math.log2(1 + articleCount);

    return lastAccess * frequencyFactor * costFactor;
}

async function cleanupOldEntries(db: IDBDatabase): Promise<void> {
    try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const entries: CacheEntry[] = request.result;
            if (entries.length > MAX_CACHE_ENTRIES) {
                // 按评分升序排列（低分优先淘汰）
                entries.sort((a, b) => getEvictionScore(a) - getEvictionScore(b));
                const excess = entries.length - MAX_CACHE_ENTRIES;
                // 淘汰低分条目（通常是年代久远、访问少、文章数少的）
                const toDelete = Math.min(excess, Math.ceil(entries.length * 0.3));
                for (let i = 0; i < toDelete; i++) {
                    store.delete(entries[i].hash);
                }
                console.log(`[GraphCache] LRU已清理 ${toDelete} 个条目 (共 ${entries.length} 条，上限 ${MAX_CACHE_ENTRIES})`);
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
