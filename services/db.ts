import type { Article } from '../src/types';
import { CONSTANTS } from '../src/constants';
import { extractArticleMedia, type ExtractedMedia, type MediaRecord } from '../src/utils/mediaRefs';
import { toast } from '../src/utils/toast';

// 数据库连接状态
enum DBConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

// 数据库性能监控
interface DBPerformanceMetrics {
  saveTime: number;
  loadTime: number;
  lastOperation: string;
  operationsCount: number;
}

export class DBService {
  private db: IDBDatabase | null = null;
  private connectionState: DBConnectionState = DBConnectionState.DISCONNECTED;
  private performanceMetrics: DBPerformanceMetrics = {
    saveTime: 0,
    loadTime: 0,
    lastOperation: '',
    operationsCount: 0
  };
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private initPromise: Promise<IDBDatabase> | null = null;

  // 获取连接状态
  getConnectionState(): DBConnectionState {
    return this.connectionState;
  }

  // 获取性能指标
  getPerformanceMetrics(): DBPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  // 初始化数据库连接
  init(): Promise<IDBDatabase> {
    if (this.initPromise) return this.initPromise;
    if (this.connectionState === DBConnectionState.CONNECTED && this.db) {
      return Promise.resolve(this.db);
    }

    this.initPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!window.indexedDB) {
        this.connectionState = DBConnectionState.ERROR;
        this.initPromise = null;
        return reject(new Error("浏览器不支持IndexedDB"));
      }

      this.connectionState = DBConnectionState.CONNECTING;

      // v4：新增 media_store（P0-A 媒体资产拆表：文章只存 sws-media:// 引用）
      const request = indexedDB.open(CONSTANTS.DB_NAME, 4);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CONSTANTS.DB_STORE)) {
          db.createObjectStore(CONSTANTS.DB_STORE);
        }
        if (!db.objectStoreNames.contains(CONSTANTS.DB_MEDIA_STORE)) {
          db.createObjectStore(CONSTANTS.DB_MEDIA_STORE);
        }
      };

      request.onsuccess = (e: Event) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        this.connectionState = DBConnectionState.CONNECTED;
        this.retryCount = 0;

        this.db.onerror = (event) => {
          console.error('数据库连接错误:', event);
          this.connectionState = DBConnectionState.ERROR;
        };

        this.db.onclose = () => {
          console.warn('数据库连接关闭');
          this.connectionState = DBConnectionState.DISCONNECTED;
          this.initPromise = null;
        };

        // 其他标签页请求升级 DB 版本时主动让位：否则对方会撞 onblocked 直接失败
        this.db.onversionchange = () => {
          console.warn('数据库版本已变更，关闭当前连接（请刷新页面）');
          this.db?.close();
          this.connectionState = DBConnectionState.DISCONNECTED;
          this.initPromise = null;
        };

        resolve(this.db);
      };

      request.onerror = (e: Event) => {
        this.connectionState = DBConnectionState.ERROR;
        const error = (e.target as IDBOpenDBRequest).error;
        console.error('数据库初始化失败:', error);

        if (this.retryCount < this.MAX_RETRIES) {
          this.retryCount++;
          console.log(`第${this.retryCount}次重试数据库连接...`);
          this.initPromise = null;
          setTimeout(() => {
            this.init().then(resolve).catch(reject);
          }, 1000 * this.retryCount);
        } else {
          this.initPromise = null;
          reject(new Error(`数据库连接失败，已重试${this.MAX_RETRIES}次: ${error?.message || '未知错误'}`));
        }
      };

      request.onblocked = () => {
        console.warn('数据库连接被阻塞，请关闭其他标签页');
        this.connectionState = DBConnectionState.ERROR;
        this.initPromise = null;
        reject(new Error('数据库连接被阻塞，请关闭其他标签页'));
      };
    });

    return this.initPromise;
  }

  // 保存数据（带性能监控）
  save<T>(key: string, value: T): Promise<boolean> {
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error("数据库未初始化"));
      }

      try {
        const tx = this.db.transaction(CONSTANTS.DB_STORE, "readwrite");
        const store = tx.objectStore(CONSTANTS.DB_STORE);
        const request = store.put(value, key);

        request.onsuccess = () => {
          const endTime = performance.now();
          const cost = endTime - startTime;
          this.performanceMetrics.saveTime = cost;
          this.performanceMetrics.lastOperation = 'save';
          this.performanceMetrics.operationsCount++;
          // 慢保存打点：>500ms warn便于定位大 base64/长文瓶颈，调用方已有失败 Toast，此处不打扰用户
          if (cost > 500) {
            console.warn(`[DB] 保存偏慢 ${cost.toFixed(0)}ms key=${key}`);
          }
          resolve(true);
        };

        request.onerror = (e: Event) => {
          const error = (e.target as IDBRequest).error;
          console.error('保存数据失败:', error);
          reject(new Error(`保存失败: ${error?.message || '未知错误'}`));
        };

        tx.onerror = (e: Event) => {
          const error = (e.target as IDBTransaction).error;
          console.error('事务错误:', error);
          reject(new Error(`事务错误: ${error?.message || '未知错误'}`));
        };
      } catch (error) {
        console.error('保存数据时发生异常:', error);
        reject(new Error(`保存异常: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    });
  }

  // 加载数据（带性能监控）
  load<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    return new Promise((resolve) => {
      if (!this.db) {
        console.warn('数据库未初始化，返回null');
        return resolve(null);
      }

      try {
        const tx = this.db.transaction(CONSTANTS.DB_STORE, "readonly");
        const store = tx.objectStore(CONSTANTS.DB_STORE);
        const request = store.get(key);

        request.onsuccess = () => {
          const endTime = performance.now();
          this.performanceMetrics.loadTime = endTime - startTime;
          this.performanceMetrics.lastOperation = 'load';
          this.performanceMetrics.operationsCount++;
          resolve(request.result);
        };

        request.onerror = () => {
          console.warn('加载数据失败，返回null');
          resolve(null);
        };
      } catch (error) {
        console.error('加载数据时发生异常:', error);
        resolve(null);
      }
    });
  }

  // 清除所有数据
  clearAll(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error("数据库未初始化"));
      }

      // 同时清空媒体库，避免残留孤儿媒体占用空间
      const tx = this.db.transaction([CONSTANTS.DB_STORE, CONSTANTS.DB_MEDIA_STORE], "readwrite");
      tx.objectStore(CONSTANTS.DB_STORE).clear();
      tx.objectStore(CONSTANTS.DB_MEDIA_STORE).clear();

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e: Event) => {
        const error = (e.target as IDBTransaction).error;
        reject(new Error(`清除失败: ${error?.message || '未知错误'}`));
      };
    });
  }

  // --- 高级接口 ---

  // 获取所有文章
  async getArticles(): Promise<Article[]> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_STORE, "readonly");
      const store = tx.objectStore(CONSTANTS.DB_STORE);
      const articles: Article[] = [];
      const request = store.openCursor();
      request.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.key.toString().startsWith('article-')) {
            articles.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(articles);
        }
      };
      request.onerror = () => reject(new Error("获取文章列表失败"));
    });
  }

  // 保存单篇文章（P0-A：内联媒体先入 media_store，文章本体只落引用）
  async saveArticle(article: Article): Promise<void> {
    const [slim] = await this.extractAndStoreMedia([article]);
    await this.save(`article-${slim.id}`, slim);
  }

  /**
   * 抽取文章内联媒体并入库（写侧唯一的媒体落库入口）。
   * 顺序保证：媒体先落库、再写文章，引用永不悬空。
   */
  private async extractAndStoreMedia(articles: Article[]): Promise<Article[]> {
    const slimArticles: Article[] = [];
    const pending = new Map<string, ExtractedMedia>();

    for (const article of articles) {
      const result = extractArticleMedia(article as unknown as Record<string, unknown>);
      slimArticles.push(result.article as unknown as Article);
      for (const item of result.media) {
        if (!pending.has(item.hash)) pending.set(item.hash, item);
      }
    }

    if (pending.size > 0) {
      await this.putMediaIfAbsent(Array.from(pending.values()));
    }
    return slimArticles;
  }

  // ---- 媒体库（media_store） ----

  /**
   * 幂等写入媒体：同 hash 已存在则跳过。
   * 内容不一致时保留原记录并告警（不改写，保证引用可复现）——128 位采样哈希下真实碰撞概率可忽略。
   */
  async putMediaIfAbsent(items: ExtractedMedia[]): Promise<void> {
    if (items.length === 0) return;
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_MEDIA_STORE, "readwrite");
      const store = tx.objectStore(CONSTANTS.DB_MEDIA_STORE);

      for (const item of items) {
        const request = store.get(item.hash);
        request.onsuccess = () => {
          const existing = request.result as MediaRecord | undefined;
          if (existing) {
            if (existing.dataUrl !== item.dataUrl) {
              // 128 位采样哈希下真实碰撞可忽略；真撞上时保留原记录（引用可复现），
              // 但要可见告警——静默显示错图且不可恢复是最坏结果（生产构建会 drop console）
              console.warn(`[DB] 媒体哈希碰撞（保留原记录）hash=${item.hash}`);
              toast.warning('检测到媒体哈希碰撞：已保留原记录，若发现图片异常请联系开发者');
            }
            return;
          }
          const record: MediaRecord = { ...item, refCount: 1, createdAt: Date.now() };
          store.put(record, record.hash);
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("媒体写入失败"));
      tx.onabort = () => reject(new Error("媒体写入中止"));
    });
  }

  async getMedia(hash: string): Promise<MediaRecord | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(CONSTANTS.DB_MEDIA_STORE, "readonly");
      const request = tx.objectStore(CONSTANTS.DB_MEDIA_STORE).get(hash);
      request.onsuccess = () => resolve((request.result as MediaRecord | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async getAllMedia(): Promise<MediaRecord[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db!.transaction(CONSTANTS.DB_MEDIA_STORE, "readonly");
      const request = tx.objectStore(CONSTANTS.DB_MEDIA_STORE).getAll();
      request.onsuccess = () => resolve((request.result as MediaRecord[]) ?? []);
      request.onerror = () => resolve([]);
    });
  }

  /** 只读媒体库 key（不含 dataUrl payload）：用于悬空引用检查等轻量场景 */
  async getMediaKeys(): Promise<string[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db!.transaction(CONSTANTS.DB_MEDIA_STORE, "readonly");
      const request = tx.objectStore(CONSTANTS.DB_MEDIA_STORE).getAllKeys();
      request.onsuccess = () => resolve(((request.result as IDBValidKey[]) ?? []).map(String));
      request.onerror = () => resolve([]);
    });
  }

  async putMediaRecords(records: MediaRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_MEDIA_STORE, "readwrite");
      const store = tx.objectStore(CONSTANTS.DB_MEDIA_STORE);
      for (const record of records) store.put(record, record.hash);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("媒体引用计数写入失败"));
    });
  }

  async deleteMedia(hashes: string[]): Promise<void> {
    if (hashes.length === 0) return;
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_MEDIA_STORE, "readwrite");
      const store = tx.objectStore(CONSTANTS.DB_MEDIA_STORE);
      for (const hash of hashes) store.delete(hash);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("媒体删除失败"));
    });
  }

  // 删除单篇文章
  async deleteArticle(id: number): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_STORE, "readwrite");
      const store = tx.objectStore(CONSTANTS.DB_STORE);
      const request = store.delete(`article-${id}`);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("删除文章失败"));
    });
  }

  // 轻量批量 upsert：仅覆盖传入记录，不做全表游标删除，排序拖拽等高频场景用它
  async bulkPutArticles(articles: Article[]): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
    const slimArticles = await this.extractAndStoreMedia(articles);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_STORE, "readwrite");
      const store = tx.objectStore(CONSTANTS.DB_STORE);
      for (const article of slimArticles) {
        store.put(article, `article-${article.id}`);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("批量保存失败"));
    });
  }

  // 原子化：清空并批量保存文章
  async clearAndBulkSaveArticles(articles: Article[]): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
    const slimArticles = await this.extractAndStoreMedia(articles);
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(CONSTANTS.DB_STORE, "readwrite");
      const store = tx.objectStore(CONSTANTS.DB_STORE);

      // 1. 删除所有以 article- 开头的键
      const request = store.openCursor();
      request.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.key.toString().startsWith('article-')) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          // 2. 批量写入新文章（媒体已先行入库）
          for (const article of slimArticles) {
            store.put(article, `article-${article.id}`);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("原子化批量保存失败"));
    });
  }

}

export const db = new DBService();

