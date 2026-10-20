import { describe, it, expect, vi } from 'vitest';
import {
  TranscodeError,
  fitBox,
  isVideoTranscodeSupported,
  shouldTranscodeVideo,
  transcodeVideoTo720p,
  videoFileToDataURL,
  type VideoImportEvent,
} from './transcode';

// 真 FileReader（全局 testSetup 的是永不回调的 mock，这里覆盖成本地可用版）
class LocalFileReader {
  result: string | null = null;
  onload: ((this: unknown, ev: unknown) => void) | null = null;
  onerror: ((this: unknown, ev: unknown) => void) | null = null;
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      queueMicrotask(() => this.onload?.call(this, {}));
    });
  }
  abort() {}
}
vi.stubGlobal('FileReader', LocalFileReader);

describe('fitBox / shouldTranscodeVideo（R4-auto 纯决策）', () => {
  it('1080p 横屏 → 1280x720', () => {
    expect(fitBox(1920, 1080)).toEqual({ width: 1280, height: 720, scale: expect.any(Number) });
    expect(shouldTranscodeVideo(1920, 1080)).toBe(true);
  });

  it('1080p 竖屏 → 按盒适配（偶数对齐）', () => {
    const r = fitBox(1080, 1920);
    expect(r.height).toBe(720);
    expect(r.width % 2).toBe(0);
    expect(r.width).toBeLessThanOrEqual(1280);
    expect(shouldTranscodeVideo(1080, 1920)).toBe(true);
  });

  it('720p 及以下原样（不转）', () => {
    expect(fitBox(1280, 720)).toEqual({ width: 1280, height: 720, scale: 1 });
    expect(fitBox(640, 480).scale).toBe(1);
    expect(shouldTranscodeVideo(1280, 720)).toBe(false);
    expect(shouldTranscodeVideo(640, 480)).toBe(false);
  });

  it('非法尺寸抛 TranscodeError', () => {
    expect(() => fitBox(0, 1080)).toThrow(TranscodeError);
  });
});

describe('降级路径（jsdom 无 WebCodecs）', () => {
  it('isVideoTranscodeSupported 为 false', () => {
    expect(isVideoTranscodeSupported()).toBe(false);
  });

  it('transcodeVideoTo720p 明确拒绝（unsupported-env）', async () => {
    const err = await transcodeVideoTo720p(new Blob(['x'], { type: 'video/mp4' })).catch((e) => e);
    expect(err).toBeInstanceOf(TranscodeError);
    expect((err as TranscodeError).code).toBe('unsupported-env');
  });

  it('videoFileToDataURL 回退保留原片（无事件、不断链）', async () => {
    const events: VideoImportEvent[] = [];
    const url = await videoFileToDataURL(new Blob(['hello-video'], { type: 'video/mp4' }), (e) => events.push(e));
    expect(url).toBe(`data:video/mp4;base64,${Buffer.from('hello-video').toString('base64')}`);
    expect(events).toEqual([]);
  });
});
