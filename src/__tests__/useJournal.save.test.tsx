/**
 * useJournal 保存调度测试（P0-B）
 * 覆盖：显式保存即时落盘 / flush 强制落盘 / maxWait 兜底 / pagehide 触发 / 删除取消待落盘
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import 'fake-indexeddb/auto';
import { useJournal } from '../../hooks/useJournal';
import { db } from '../../services/db';

describe('useJournal 保存调度（P0-B）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function mountLoaded() {
    const { result } = renderHook(() => useJournal());
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
  }

  it('显式保存（immediate）跳过防抖立即落盘', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle');

    const id = result.current.articles[0].id;
    await act(async () => {
      result.current.updateArticle(id, { title: '立即保存' }, { immediate: true });
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].title).toBe('立即保存');
  });

  it('防抖窗口内 flushPendingSaves 立即落盘（不等 1s）', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const id = result.current.articles[0].id;
    await act(async () => {
      result.current.updateArticle(id, { title: '防抖中' });
    });
    expect(spy).not.toHaveBeenCalled(); // 仍在防抖窗口内

    await act(async () => {
      await result.current.flushPendingSaves();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].title).toBe('防抖中');
  });

  it('持续编辑时 maxWait 兜底：3 秒内必落盘（纯防抖会永不落盘）', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const id = result.current.articles[0].id;
    // 每 500ms 编辑一次、连续 8 次（共 4s）：纯 1s 防抖会被无限重置而永不落盘
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        result.current.updateArticle(id, { title: `连续编辑 ${i}` });
      });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
    }
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(spy).toHaveBeenCalled();
    // maxWait 生效：最多只应落盘少量次数，而不是每次编辑各存一次
    expect(spy.mock.calls.length).toBeLessThan(4);
  });

  it('pagehide 触发立即落盘（关页不丢最后一次编辑）', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle');

    const id = result.current.articles[0].id;
    await act(async () => {
      result.current.updateArticle(id, { title: '关页前' });
    });
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].title).toBe('关页前');
  });

  it('删除文章会取消其待落盘保存（防抖定时器不复活已删文章）', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    // 先创建一篇普通文章（避开封面/封底不可删规则）
    let createdId = 0;
    await act(async () => {
      const created = await result.current.createArticle({ title: '待删除' });
      createdId = created!.id;
    });
    spy.mockClear();

    await act(async () => {
      result.current.updateArticle(createdId, { title: '编辑后立即删除' });
    });
    await act(async () => {
      await result.current.deleteArticle(createdId);
    });

    // 定时器到点后不得再写回已删除的文章
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    const savedIds = spy.mock.calls.map((c) => Number(c[0].id));
    expect(savedIds).not.toContain(createdId);
  });

  it('整表替换（setArticlesAction）取消全部待落盘保存', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const id = result.current.articles[0].id;
    await act(async () => {
      result.current.updateArticle(id, { title: '将被整表替换' });
    });

    await act(async () => {
      await result.current.setArticlesAction([]);
    });
    spy.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('两阶段保存：第一阶段必须清空旧 blocks（否则阅读态优先 blocks 会显示旧正文）', async () => {
    const result = await mountLoaded();

    let createdId = 0;
    await act(async () => {
      const created = await result.current.createArticle({
        title: '两阶段',
        content: '<p>旧正文</p>',
        blocks: [{ id: 'b1', type: 'paragraph', content: '旧正文' }] as never,
      });
      createdId = created!.id;
    });
    expect(((await db.getArticles()).find(a => a.id === createdId)!.blocks ?? [])).toHaveLength(1);

    // 第一阶段：正文变更 + 显式清空 blocks（useEditorState 的已有文章分支行为）
    await act(async () => {
      result.current.updateArticle(createdId, { content: '<p>新正文</p>', blocks: undefined }, { immediate: true });
    });

    const stored = (await db.getArticles()).find(a => a.id === createdId)!;
    expect(stored.content).toContain('新正文');
    expect(stored.blocks ?? []).toHaveLength(0); // 不得残留旧 blocks
  });

  it('StrictMode 下显式保存只写一次库（副作用不在 state updater 内）', async () => {
    const { result } = renderHook(() => useJournal(), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const spy = vi.spyOn(db, 'saveArticle');
    const id = result.current.articles[0].id;
    await act(async () => {
      result.current.updateArticle(id, { title: 'StrictMode 单写' }, { immediate: true });
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('保存失败会自动重试（state 已等于目标值，用户再点保存会被 bailout 吞掉）', async () => {
    const result = await mountLoaded();
    const spy = vi.spyOn(db, 'saveArticle').mockRejectedValueOnce(new Error('模拟写入失败'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const id = result.current.articles[0].id;
    await act(async () => {
      result.current.updateArticle(id, { title: '失败后重试' }, { immediate: true });
    });
    await act(async () => { await Promise.resolve(); });
    expect(spy).toHaveBeenCalledTimes(1);

    // 重试经防抖入队，推进定时器后应再写一次
    await act(async () => { vi.advanceTimersByTime(1500); });
    await act(async () => { await Promise.resolve(); });
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
