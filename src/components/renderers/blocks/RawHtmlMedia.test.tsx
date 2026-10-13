/**
 * rawHtml 块内的媒体引用还原（P0-A / 审查阻塞 2）
 *
 * 背景：工具栏「上传视频/音频」插入的是 `<div class="media-container">…<video src="data:…">`，
 * blockParser 把 media-container 判为 rawHtml 块；P0-A 会把块内 data URL 抽成 `sws-media://` 引用。
 * 因此渲染侧必须还原，否则迁移后存量视频/音频在阅读态集体失效。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { db } from '../../../../services/db';
import { clearMediaDataCache } from '../../../../services/mediaStore';
import { BlockRenderer } from './BlockRenderer';

const VIDEO = 'data:video/webm;base64,' + 'V'.repeat(48);

describe('rawHtml 块媒体还原（P0-A）', () => {
  beforeEach(async () => {
    clearMediaDataCache();
    await db.init();
    await db.clearAll();
  });

  it('media-container 内的视频引用在渲染前被还原为 data URL', async () => {
    await db.saveArticle({
      id: 1,
      title: '带视频的文章',
      category: '工法',
      order: 1000,
      content: `<div class="media-container"><video controls src="${VIDEO}"></video></div>`,
    } as never);

    const stored = (await db.getArticles())[0];
    expect(stored.content).not.toContain('base64'); // 库里确实是引用形态

    const block = { id: 'b1', type: 'rawHtml', html: stored.content };
    const { container } = render(<BlockRenderer block={block as never} mode="read" />);

    await waitFor(() => {
      expect(container.querySelector('video')?.getAttribute('src')).toBe(VIDEO);
    });
    expect(container.innerHTML).not.toContain('sws-media://');
  });
});
