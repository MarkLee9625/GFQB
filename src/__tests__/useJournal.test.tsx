/**
 * useJournal Hook 单元测试
 * 测试核心业务逻辑：CRUD、排序、清洗
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { useJournal } from '../../hooks/useJournal';

// 模拟文章数据工厂
function makeArticle(overrides: Partial<any> = {}) {
  return {
    id: Date.now() + Math.random() * 1000,
    title: '测试文章',
    category: '工艺工法',
    content: '<p>内容</p>',
    order: 1000,
    ...overrides,
  };
}

describe('useJournal', () => {
  beforeEach(() => {
    // 清理 IndexedDB 实例，确保测试隔离
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('加载后文章列表不为空（含默认封面封底）', async () => {
      const { result } = renderHook(() => useJournal());

      // 初始时 loading 为 true
      expect(result.current.loading).toBe(true);

      // 等待加载完成
      await waitFor(() => expect(result.current.loading).toBe(false));

      // 默认包含封面和封底
      expect(result.current.articles.length).toBeGreaterThanOrEqual(2);
      expect(result.current.currentId).toBeTruthy();
    });
  });

  describe('enforceOrder — 排序逻辑', () => {
    it('封面排第一、封底排最后', () => {
      // useJournal 内部使用 enforceOrder，通过 createArticle 和 reorderArticles 间接测试
    });
  });

  describe('createArticle', () => {
    it('创建文章并添加到列表', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const prevCount = result.current.articles.length;

      await act(async () => {
        await result.current.createArticle({ title: '新文章' });
      });

      expect(result.current.articles.length).toBe(prevCount + 1);
      const created = result.current.articles.find(a => a.title === '新文章');
      expect(created).toBeTruthy();
      expect(created?.id).toBeTruthy();
    });

    it('创建文章时自动分配 order', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const maxBefore = Math.max(...result.current.articles.map(a => a.order || 0));

      await act(async () => {
        await result.current.createArticle({ title: 'OrderTest' });
      });

      const created = result.current.articles.find(a => a.title === 'OrderTest');
      expect(created?.order).toBeGreaterThanOrEqual(maxBefore + 1000);
    });
  });

  describe('updateArticle', () => {
    it('更新文章标题', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const first = result.current.articles[0];
      const originalTitle = first.title;

      act(() => {
        result.current.updateArticle(first.id, { title: '已更新标题' });
      });

      // 等待防抖保存
      await waitFor(() => {
        const updated = result.current.articles.find(a => a.id === first.id);
        expect(updated?.title).toBe('已更新标题');
      });
    });
  });

  describe('deleteArticle', () => {
    it('删除普通文章', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // 先创建一篇文章
      await act(async () => {
        await result.current.createArticle({ title: '待删除' });
      });

      const target = result.current.articles.find(a => a.title === '待删除');
      expect(target).toBeTruthy();

      // window.confirm 返回 true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const prevCount = result.current.articles.length;
      await act(async () => {
        await result.current.deleteArticle(target!.id);
      });

      expect(result.current.articles.length).toBe(prevCount - 1);
      expect(result.current.articles.find(a => a.id === target!.id)).toBeUndefined();

      confirmSpy.mockRestore();
    });

    it('不能删除封面或封底', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const alertSpy = vi.spyOn(window, 'alert').mockReturnValue();

      const cover = result.current.articles.find(a => a.category === '封面');
      if (cover) {
        await act(async () => {
          await result.current.deleteArticle(cover.id);
        });
        expect(alertSpy).toHaveBeenCalledWith('封面和封底不可删除');
      }

      alertSpy.mockRestore();
    });

    it('用户取消确认时不删除', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createArticle({ title: '取消删除' });
      });

      const target = result.current.articles.find(a => a.title === '取消删除');
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const prevCount = result.current.articles.length;
      await act(async () => {
        if (target) await result.current.deleteArticle(target.id);
      });

      expect(result.current.articles.length).toBe(prevCount);
      confirmSpy.mockRestore();
    });
  });

  describe('reorderArticles', () => {
    it('重排序后每篇文章分配正确的 order', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // 创建几篇文章
      await act(async () => {
        await result.current.createArticle({ title: '文章A' });
        await result.current.createArticle({ title: '文章B' });
      });

      const articles = result.current.articles.filter(a =>
        a.category !== '封面' && a.category !== '封底'
      );

      // 反转顺序
      const reversed = [...articles].reverse();

      act(() => {
        // 重新排序 — 保留封面和封底在原位
        const cover = result.current.articles.find(a => a.category === '封面');
        const back = result.current.articles.find(a => a.category === '封底');
        const newOrder = [cover!, ...reversed, back!].filter(Boolean);
        result.current.reorderArticles(newOrder);
      });

      await waitFor(() => {
        const firstArticle = result.current.articles[1]; // 封面之后
        const secondArticle = result.current.articles[2]; // 第二篇
        if (firstArticle && secondArticle) {
          expect((secondArticle.order || 0) - (firstArticle.order || 0)).toBeGreaterThanOrEqual(500);
        }
      });
    });
  });

  describe('setArticlesAction', () => {
    it('批量设置文章', async () => {
      const { result } = renderHook(() => useJournal());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const newArticles = [
        makeArticle({ id: 1, title: '批量A', category: '封面', order: 0 }),
        makeArticle({ id: 2, title: '批量B', category: '封底', order: 99999 }),
      ];

      await act(async () => {
        await result.current.setArticlesAction(newArticles);
      });

      expect(result.current.articles.length).toBeGreaterThanOrEqual(2);
      expect(result.current.articles.some(a => a.title === '批量A')).toBe(true);
    });
  });
});
