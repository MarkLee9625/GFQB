import { Article } from '../src/types/models';
import { CONSTANTS } from '../src/constants';

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

class DBService {
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

      const request = indexedDB.open(CONSTANTS.DB_NAME, 3);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CONSTANTS.DB_STORE)) {
          db.createObjectStore(CONSTANTS.DB_STORE);
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
  save(key: string, value: any): Promise<boolean> {
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
          this.performanceMetrics.saveTime = endTime - startTime;
          this.performanceMetrics.lastOperation = 'save';
          this.performanceMetrics.operationsCount++;
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
  load(key: string): Promise<any> {
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

  // 批量保存（优化性能）
  async saveBatch(items: Array<{ key: string, value: any }>): Promise<boolean[]> {
    if (!this.db) {
      throw new Error("数据库未初始化");
    }

    const results: boolean[] = [];
    const tx = this.db.transaction(CONSTANTS.DB_STORE, "readwrite");
    const store = tx.objectStore(CONSTANTS.DB_STORE);

    const promises = items.map((item, index) => {
      return new Promise<boolean>((resolve) => {
        const request = store.put(item.value, item.key);

        request.onsuccess = () => {
          results[index] = true;
          resolve(true);
        };

        request.onerror = () => {
          results[index] = false;
          resolve(false);
        };
      });
    });

    await Promise.all(promises);
    return results;
  }

  // 清除所有数据
  clearAll(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error("数据库未初始化"));
      }

      const tx = this.db.transaction(CONSTANTS.DB_STORE, "readwrite");
      const request = tx.objectStore(CONSTANTS.DB_STORE).clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (e: Event) => {
        const error = (e.target as IDBRequest).error;
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

  // 保存单篇文章
  async saveArticle(article: Article): Promise<void> {
    await this.save(`article-${article.id}`, article);
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

  // 获取配置
  async getConfig(key: string): Promise<any> {
    return this.load(`config-${key}`);
  }

  // 保存配置
  async saveConfig(key: string, value: any): Promise<void> {
    await this.save(`config-${key}`, value);
  }

  // 原子化：清空并批量保存文章
  async clearAndBulkSaveArticles(articles: Article[]): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("数据库初始化失败");
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
          // 2. 批量写入新文章
          for (const article of articles) {
            store.put(article, `article-${article.id}`);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error("原子化批量保存失败"));
    });
  }

  // 关闭数据库连接
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.connectionState = DBConnectionState.DISCONNECTED;
    }
  }

  // 重新连接数据库
  async reconnect(): Promise<IDBDatabase> {
    this.close();
    return this.init();
  }
}

export const db = new DBService();

// 移除已移动到 utils/fileHelpers.ts 的通用函数: compressImage, fileToDataURL, base64ToBlob
// 移除已移动到 src/services/pdf/index.ts 的 convertPdfToImages 

