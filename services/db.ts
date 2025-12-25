import { Article, CONSTANTS } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

// 使用 Vite 的 ?url 导入 Worker，确保路径正确
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 1. 初始化 Worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  console.log('[DB服务] PDF Worker 初始化成功');
} catch (e) {
  console.error('[DB服务] PDF Worker 初始化失败:', e);
}


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
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        this.connectionState = DBConnectionState.ERROR;
        return reject(new Error("浏览器不支持IndexedDB"));
      }

      this.connectionState = DBConnectionState.CONNECTING;

      const request = indexedDB.open(CONSTANTS.DB_NAME, 3);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (db.objectStoreNames.contains(CONSTANTS.DB_STORE)) {
          db.deleteObjectStore(CONSTANTS.DB_STORE);
        }
        db.createObjectStore(CONSTANTS.DB_STORE);
      };

      request.onsuccess = (e: Event) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        this.connectionState = DBConnectionState.CONNECTED;
        this.retryCount = 0;

        // 添加数据库连接事件监听
        this.db.onerror = (event) => {
          console.error('数据库连接错误:', event);
          this.connectionState = DBConnectionState.ERROR;
        };

        this.db.onclose = () => {
          console.warn('数据库连接关闭');
          this.connectionState = DBConnectionState.DISCONNECTED;
        };

        resolve(this.db);
      };

      request.onerror = (e: Event) => {
        this.connectionState = DBConnectionState.ERROR;
        const error = (e.target as IDBOpenDBRequest).error;
        console.error('数据库初始化失败:', error);

        // 重试逻辑
        if (this.retryCount < this.MAX_RETRIES) {
          this.retryCount++;
          console.log(`第${this.retryCount}次重试数据库连接...`);
          setTimeout(() => {
            this.init().then(resolve).catch(reject);
          }, 1000 * this.retryCount);
        } else {
          reject(new Error(`数据库连接失败，已重试${this.MAX_RETRIES}次: ${error?.message || '未知错误'}`));
        }
      };

      request.onblocked = () => {
        console.warn('数据库连接被阻塞，请关闭其他标签页');
        this.connectionState = DBConnectionState.ERROR;
        reject(new Error('数据库连接被阻塞，请关闭其他标签页'));
      };
    });
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

// 图片压缩优化
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('文件不是图片类型'));
    }

    // 检查文件大小，如果小于阈值直接返回
    const MAX_SIZE_WITHOUT_COMPRESSION = 1024 * 1024; // 1MB
    if (file.size <= MAX_SIZE_WITHOUT_COMPRESSION) {
      fileToDataURL(file).then(resolve).catch(reject);
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('无法获取canvas上下文'));
        }

        const maxWidth = CONSTANTS.IMAGES.MAX_WIDTH;
        const maxHeight = maxWidth * 1.5; // 使用宽度的1.5倍作为最大高度
        let width = img.width;
        let height = img.height;

        // 计算缩放比例
        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const ratio = Math.min(widthRatio, heightRatio);

          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // 设置canvas尺寸
        canvas.width = width;
        canvas.height = height;

        // 优化图片质量
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 根据文件类型选择压缩格式
        let mimeType = 'image/jpeg';
        let quality = CONSTANTS.IMAGES.QUALITY;

        if (file.type === 'image/png') {
          mimeType = 'image/png';
          quality = 0.9; // PNG质量参数不同
        } else if (file.type === 'image/webp') {
          mimeType = 'image/webp';
        }

        try {
          const compressedDataUrl = canvas.toDataURL(mimeType, quality);

          // 验证压缩结果
          if (compressedDataUrl.length < 100) {
            console.warn('压缩后图片数据异常，使用原始数据');
            fileToDataURL(file).then(resolve).catch(reject);
            return;
          }

          resolve(compressedDataUrl);
        } catch (error) {
          console.error('图片压缩失败:', error);
          // 压缩失败时返回原始图片
          fileToDataURL(file).then(resolve).catch(reject);
        }
      };

      img.onerror = () => {
        console.error('图片加载失败');
        reject(new Error('图片加载失败'));
      };
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
};

// 文件转换为DataURL（带内存优化）
export const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('文件为空'));
    }

    // 根据文件类型设置不同的文件大小限制
    let MAX_FILE_SIZE;
    const fileType = file.type.split('/')[0]; // 'image', 'video', 'audio', 'application'

    if (fileType === 'video') {
      MAX_FILE_SIZE = 50 * 1024 * 1024; // 视频文件：50MB
    } else if (fileType === 'audio') {
      MAX_FILE_SIZE = 20 * 1024 * 1024; // 音频文件：20MB
    } else if (fileType === 'image') {
      MAX_FILE_SIZE = 10 * 1024 * 1024; // 图片文件：10MB
    } else if (file.type === 'application/pdf') {
      MAX_FILE_SIZE = 30 * 1024 * 1024; // PDF文件：30MB
    } else {
      MAX_FILE_SIZE = 10 * 1024 * 1024; // 其他文件：10MB
    }

    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      const maxSizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
      return reject(new Error(`${fileType === 'video' ? '视频' : fileType === 'audio' ? '音频' : '文件'}大小超过限制 (${fileSizeMB}MB > ${maxSizeMB}MB)`));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('文件读取结果不是字符串'));
      }
    };

    reader.onerror = (e) => {
      const error = e.target?.error;
      reject(new Error(`文件读取失败: ${error?.message || '未知错误'}`));
    };

    reader.onabort = () => {
      reject(new Error('文件读取被中止'));
    };

    try {
      reader.readAsDataURL(file);
    } catch (error) {
      reject(new Error(`读取文件时发生异常: ${error instanceof Error ? error.message : '未知错误'}`));
    }
  });
};

// Base64转换为Blob（带错误处理和内存优化）
export const base64ToBlob = (dataURI: string): Blob => {
  try {
    if (!dataURI || typeof dataURI !== 'string') {
      console.warn('base64ToBlob: 输入数据无效');
      return new Blob([]);
    }

    const splitIndex = dataURI.indexOf(',');
    if (splitIndex === -1) {
      console.warn('base64ToBlob: 无效的DataURI格式');
      return new Blob([]);
    }

    const base64 = dataURI.substring(splitIndex + 1);

    // 验证base64字符串
    if (!base64 || base64.trim() === '') {
      console.warn('base64ToBlob: base64数据为空');
      return new Blob([]);
    }

    // 清理base64字符串（移除空格和换行）
    const cleanBase64 = base64.replace(/\s/g, '');

    let byteString: string;
    try {
      byteString = atob(cleanBase64);
    } catch (e) {
      console.error('base64ToBlob: base64解码失败', e);
      return new Blob([]);
    }

    // 提取MIME类型
    const mimeMatch = dataURI.match(/data:([^;]+);/);
    const mimeString = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    // 将字节字符串转换为Uint8Array
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }

    // 创建并返回Blob对象
    return new Blob([byteArray], { type: mimeString });
  } catch (error) {
    console.error('base64ToBlob: 转换过程中发生错误', error);
    return new Blob([]);
  }
};

export const convertPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  // @ts-ignore
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const images: string[] = [];
  const totalPages = pdf.numPages;
  const MAX_PAGES = 50; // 安全限制

  for (let i = 1; i <= Math.min(totalPages, MAX_PAGES); i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2倍高清缩放
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      // PDF.js 5.x+ requires the canvas element instead of/in addition to context
      // @ts-ignore
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.8)); // 压缩以优化体积
    }
  }
  return images;
};

