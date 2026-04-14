/**
 * 智能 Blob 缓存系统 (LRU 实现)
 * 用于管理媒体资源的 Blob URL，避免频繁滚动时的重复解码
 * 采用 LRU (最近最少使用) 淘汰策略，最大容量为 5
 */

export interface BlobCacheEntry {
    blobUrl: string;
    timestamp: number; // 最后访问时间戳
    size: number; // 预估大小（字节）
}

/**
 * LRU 缓存类，用于管理 Blob URL
 */
export class BlobCache {
    private maxSize: number;
    private cache: Map<string, BlobCacheEntry>;
    private totalSize: number;

    /**
     * 创建缓存实例
     * @param maxSize 最大缓存条目数，默认为 5
     */
    constructor(maxSize: number = 5) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.totalSize = 0;
    }

    /**
     * 获取缓存中的 Blob URL
     * @param key 缓存键
     * @returns Blob URL 或 null（如果不存在）
     */
    get(key: string): string | null {
        if (!this.cache.has(key)) {
            return null;
        }

        const entry = this.cache.get(key)!;
        // 更新访问时间
        entry.timestamp = Date.now();
        this.cache.set(key, entry);
        
        return entry.blobUrl;
    }

    /**
     * 将 Blob URL 存入缓存
     * @param key 缓存键
     * @param blobUrl Blob URL
     * @param size 预估大小（字节），用于统计
     */
    set(key: string, blobUrl: string, size: number = 0): void {
        // 如果缓存已满且键不存在，移除最久未使用的项
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        // 如果键已存在，先清理旧的 Blob URL
        if (this.cache.has(key)) {
            const oldEntry = this.cache.get(key)!;
            URL.revokeObjectURL(oldEntry.blobUrl);
            this.totalSize -= oldEntry.size;
        }

        const entry: BlobCacheEntry = {
            blobUrl,
            timestamp: Date.now(),
            size
        };

        this.cache.set(key, entry);
        this.totalSize += size;
    }

    /**
     * 检查缓存中是否存在某个键
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * 从缓存中移除指定项
     * @param key 缓存键
     * @returns 是否成功移除
     */
    delete(key: string): boolean {
        if (!this.cache.has(key)) {
            return false;
        }

        const entry = this.cache.get(key)!;
        URL.revokeObjectURL(entry.blobUrl);
        this.totalSize -= entry.size;
        
        return this.cache.delete(key);
    }

    /**
     * 清除所有缓存项
     */
    clear(): void {
        for (const entry of this.cache.values()) {
            URL.revokeObjectURL(entry.blobUrl);
        }
        
        this.cache.clear();
        this.totalSize = 0;
    }

    /**
     * 获取当前缓存大小（条目数）
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * 获取当前缓存总大小（字节）
     */
    get cacheSize(): number {
        return this.totalSize;
    }

    /**
     * 获取所有缓存键
     */
    get keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * 淘汰最久未使用的缓存项
     * @returns 是否成功淘汰
     */
    private evictOldest(): boolean {
        if (this.cache.size === 0) {
            return false;
        }

        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            return this.delete(oldestKey);
        }

        return false;
    }

    /**
     * 根据文章索引和媒体类型生成缓存键
     * @param articleIndex 文章索引
     * @param mediaType 媒体类型 ('img', 'video', 'iframe')
     * @param mediaIndex 媒体在文章中的索引（可选）
     * @returns 生成的缓存键
     */
    static generateKey(articleIndex: number, mediaType: string, mediaIndex?: number): string {
        if (mediaIndex !== undefined) {
            return `article-${articleIndex}-${mediaType}-${mediaIndex}`;
        }
        return `article-${articleIndex}-${mediaType}`;
    }
}

/**
 * 全局 Blob 缓存实例（单例模式）
 */
let globalBlobCache: BlobCache | null = null;

/**
 * 获取全局 Blob 缓存实例
 */
export function getBlobCache(): BlobCache {
    if (!globalBlobCache) {
        globalBlobCache = new BlobCache(5);
    }
    return globalBlobCache;
}

/**
 * 清理全局 Blob 缓存
 */
export function clearBlobCache(): void {
    if (globalBlobCache) {
        globalBlobCache.clear();
        globalBlobCache = null;
    }
}