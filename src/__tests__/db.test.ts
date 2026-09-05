/**
 * DBService 单元测试
 * 使用 fake-indexeddb 模拟浏览器 IndexedDB 环境
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { DBService } from '../../services/db';
import { CONSTANTS } from '../../src/constants';

// 每个测试类使用独立数据库名，避免状态污染
let counter = 0;
function createService() {
  counter++;
  (CONSTANTS as any).DB_NAME = `TestDB_${counter}`;
  (CONSTANTS as any).DB_STORE = 'test-store';
  return new DBService();
}

describe('DBService', () => {
  describe('init()', () => {
    it('成功初始化数据库连接', async () => {
      const service = createService();
      const db = await service.init();
      expect(db).toBeTruthy();
      expect(service.getConnectionState()).toBe('connected');
    });

    it('重复调用返回缓存实例', async () => {
      const service = createService();
      const db1 = await service.init();
      const db2 = await service.init();
      expect(db1).toBe(db2);
    });
  });

  describe('save() / load()', () => {
    let service: DBService;

    beforeEach(async () => {
      service = createService();
      await service.init();
    });

    it('保存并加载数据', async () => {
      const ok = await service.save('hello-key', 'world');
      expect(ok).toBe(true);
      const val = await service.load<string>('hello-key');
      expect(val).toBe('world');
    });

    it('保存并加载对象', async () => {
      const obj = { id: 1, name: 'test' };
      await service.save('obj', obj);
      const loaded = await service.load<typeof obj>('obj');
      expect(loaded).toEqual(obj);
    });

    it('加载不存在的键返回 undefined', async () => {
      const val = await service.load('nope');
      expect(val).toBeUndefined();
    });
  });

  describe('clearAll()', () => {
    it('清除所有数据', async () => {
      const service = createService();
      await service.init();
      await service.save('k1', 'v1');
      await service.save('k2', 'v2');

      const cleared = await service.clearAll();
      expect(cleared).toBe(true);
      expect(await service.load('k1')).toBeUndefined();
      expect(await service.load('k2')).toBeUndefined();
    });
  });

  describe('getArticles()', () => {
    it('返回空数组当无文章', async () => {
      const service = createService();
      await service.init();
      const articles = await service.getArticles();
      expect(articles).toEqual([]);
    });

    it('只返回 article- 前缀的数据', async () => {
      const service = createService();
      await service.init();
      await service.save('article-1', { id: 1, title: 'A' });
      await service.save('article-2', { id: 2, title: 'B' });
      await service.save('config', { theme: 'dark' });

      const articles = await service.getArticles();
      expect(articles).toHaveLength(2);
      const titles = articles.map((a: any) => a.title).sort();
      expect(titles).toEqual(['A', 'B']);
    });
  });

  describe('saveArticle() / deleteArticle()', () => {
    it('保存并删除文章', async () => {
      const service = createService();
      await service.init();
      await service.saveArticle({ id: 1, title: 'Test', category: '工艺工法', content: 'Hello' } as any);

      expect(await service.getArticles()).toHaveLength(1);

      await service.deleteArticle(1);
      expect(await service.getArticles()).toHaveLength(0);
    });
  });

  describe('getPerformanceMetrics()', () => {
    it('记录操作次数', async () => {
      const service = createService();
      await service.init();
      await service.save('k', 'v');
      await service.load('k');

      const m = service.getPerformanceMetrics();
      expect(m.operationsCount).toBe(2);
      expect(m.lastOperation).toBe('load');
      expect(m.saveTime).toBeGreaterThanOrEqual(0);
      expect(m.loadTime).toBeGreaterThanOrEqual(0);
    });
  });
});
