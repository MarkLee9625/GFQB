/**
 * R4-auto：视频导入自动转码（1080p+ → 720p H.264/AAC MP4）
 *
 * 管线（全浏览器原生 + mp4box 解封装 + mp4-muxer 封装，无需 ffmpeg）：
 *   mp4box 解封装 → WebCodecs 解码 → canvas 缩放 → WebCodecs 重编码 → mp4-muxer 落盘
 *
 * 失败策略：任何环节失败都抛 TranscodeError，调用方 catch 后保留原片（不丢数据）。
 * v1 边界（命中即抛错保原片，均已在文案中说明）：
 *   - 非 H.264(AVC1) 视频轨 / 非 AAC-LC 音频轨（含 avc3、HE-AAC 等近亲，暂不支持）
 *   - 多视频轨 / 多音频轨（只取首条会静默丢轨，宁可不转）
 *   - 含旋转/翻转元数据的视频（tkhd 矩阵非单位阵，或 coded 与 display 尺寸 transposed）
 *   - 输出校验失败（复核无视频轨/时长偏差>5%/音频丢失）
 *   - 分辨率已在 1280x720 盒内（此时直接返回原片，不算失败）
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { createFile, MP4BoxBuffer, type Sample } from 'mp4box';

export const VIDEO_BOX_WIDTH = 1280;
export const VIDEO_BOX_HEIGHT = 720;
export const VIDEO_TARGET_VIDEO_BITRATE = 2_000_000;
export const VIDEO_TARGET_AUDIO_BITRATE = 128_000;
/** 关键帧间隔秒数（按源 fps 折算帧数，保证各帧率 seek 粒度一致） */
export const VIDEO_KEYFRAME_SECONDS = 2.5;
export const TRANSCODE_TIMEOUT_MS = 8 * 60 * 1000;
/** 看门狗：投喂停滞超此时限即失败保原片（防截断文件 UI 假死到 8 分钟超时） */
export const TRANSCODE_STALL_MS = 60 * 1000;

export class TranscodeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'unsupported-env'
      | 'parse-failed'
      | 'unsupported-video-codec'
      | 'unsupported-audio-codec'
      | 'multi-track'
      | 'rotation-flag'
      | 'pipeline-failed'
      | 'invalid-output'
      | 'stalled'
      | 'timeout'
  ) {
    super(message);
    this.name = 'TranscodeError';
  }
}

export interface FitBox {
  width: number;
  height: number;
  /** 缩放比（<=1）；==1 表示已在盒内，无需转码 */
  scale: number;
}

/** 按 1280x720 盒等比适配（偶数对齐，不放大） */
export function fitBox(srcWidth: number, srcHeight: number): FitBox {
  if (!(srcWidth > 0 && srcHeight > 0)) throw new TranscodeError('非法视频尺寸', 'parse-failed');
  const scale = Math.min(1, VIDEO_BOX_WIDTH / srcWidth, VIDEO_BOX_HEIGHT / srcHeight);
  const width = Math.max(2, Math.floor((srcWidth * scale) / 2) * 2);
  const height = Math.max(2, Math.floor((srcHeight * scale) / 2) * 2);
  return { width, height, scale };
}

export function shouldTranscodeVideo(srcWidth: number, srcHeight: number): boolean {
  return fitBox(srcWidth, srcHeight).scale < 1;
}

export function isVideoTranscodeSupported(): boolean {
  return (
    typeof VideoDecoder !== 'undefined' &&
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof AudioDecoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof EncodedVideoChunk !== 'undefined' &&
    typeof EncodedAudioChunk !== 'undefined'
  );
}

export interface TranscodeProgress {
  phase: 'demux' | 'video' | 'audio' | 'mux';
  done: number;
  total: number;
}

export interface TranscodeResult {
  blob: Blob;
  width: number;
  height: number;
  origBytes: number;
  newBytes: number;
  /** false = 未转码（已在盒内 / 转后更大而保留原片），blob 即原文 */
  didTranscode: boolean;
}

interface AvcCBox {
  AVCProfileIndication: number;
  profile_compatibility: number;
  AVCLevelIndication: number;
  lengthSizeMinusOne: number;
  SPS: Array<{ length: number; data: Uint8Array }>;
  PPS: Array<{ length: number; data: Uint8Array }>;
}

/** 由 avcC 盒构造 VideoDecoder 描述（avcC record 全字节） */
function buildAvcDescription(avcC: AvcCBox): Uint8Array {
  const sps = avcC.SPS[0]?.data;
  const pps = avcC.PPS[0]?.data;
  if (!sps || !pps) throw new TranscodeError('avcC 缺少 SPS/PPS', 'parse-failed');
  const out = new Uint8Array(8 + sps.length + 3 + pps.length);
  const v = new DataView(out.buffer);
  out[0] = 1;
  out[1] = avcC.AVCProfileIndication;
  out[2] = avcC.profile_compatibility;
  out[3] = avcC.AVCLevelIndication;
  out[4] = 0xff;
  out[5] = 0xe1;
  v.setUint16(6, sps.length);
  out.set(sps, 8);
  let o = 8 + sps.length;
  out[o] = 1;
  v.setUint16(o + 1, pps.length);
  out.set(pps, o + 3);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAvcC(trak: any): AvcCBox {
  const avcC = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.avcC;
  if (!avcC?.SPS?.[0]?.data || !avcC?.PPS?.[0]?.data) {
    throw new TranscodeError('无法读取 avcC 描述', 'parse-failed');
  }
  return avcC as AvcCBox;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAacDescription(trak: any): Uint8Array {
  const data = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.esds?.esd?.descs?.[0]?.descs?.[0]?.data;
  if (!(data instanceof Uint8Array) || data.length === 0) {
    throw new TranscodeError('无法读取 AAC 描述（ASC）', 'parse-failed');
  }
  return data;
}

async function decodeQueueDrain(decoder: { decodeQueueSize: number } & EventTarget, max = 8): Promise<void> {
  while (decoder.decodeQueueSize > max) {
    await new Promise<void>((resolve) => decoder.addEventListener('dequeue', () => resolve(), { once: true }));
  }
}

/**
 * 输出校验：复核 mux 产物（视频轨存在且有样本、时长偏差≤5%、音频未丢失）。
 * 截断/乱序/空洞输出即使更小也必须拒收 → 抛 invalid-output 保原片。
 */
async function validateMuxedOutput(
  out: ArrayBuffer,
  expected: { durationSec: number; expectAudio: boolean }
): Promise<void> {
  const info = await new Promise<{ tracks: Array<{ type?: string; nb_samples: number; duration: number; timescale: number }> }>(
    (resolve, reject) => {
      try {
        const f = createFile();
        f.onError = (module: string, message: string) => reject(new Error(`${module} ${message}`));
        f.onReady = (movie) => resolve(movie as unknown as { tracks: Array<{ type?: string; nb_samples: number; duration: number; timescale: number }> });
        f.appendBuffer(MP4BoxBuffer.fromArrayBuffer(out, 0));
        f.flush();
      } catch (e) {
        reject(e);
      }
    }
  );
  const v = info.tracks.find((t) => t.type === 'video');
  if (!v || v.nb_samples <= 0) throw new TranscodeError('输出无有效视频轨', 'invalid-output');
  const outSec = v.duration / v.timescale;
  if (!(outSec > 0) || Math.abs(outSec - expected.durationSec) / Math.max(expected.durationSec, 0.001) > 0.05) {
    throw new TranscodeError(`输出时长异常（${outSec.toFixed(1)}s vs 输入 ${expected.durationSec.toFixed(1)}s）`, 'invalid-output');
  }
  if (expected.expectAudio && !info.tracks.some((t) => t.type === 'audio' && t.nb_samples > 0)) {
    throw new TranscodeError('输出音频轨丢失', 'invalid-output');
  }
}

/**
 * 编码器配置探测：High@L4.0 优先（画质），旧机器硬编仅 Baseline 时降档；
 * 探测不可用/全不支持则返回 High 交由 configure 抛错（→ 保原片，同后果）。
 */
async function pickAvcEncoderConfig(
  width: number,
  height: number,
  bitrate: number,
  framerate: number
): Promise<VideoEncoderConfig> {
  const base = { width, height, bitrate, framerate };
  const probe = VideoEncoder?.isConfigSupported;
  if (typeof probe !== 'function') return { codec: 'avc1.640028', ...base };
  try {
    if ((await probe.call(VideoEncoder, { codec: 'avc1.640028', ...base })).supported) {
      return { codec: 'avc1.640028', ...base };
    }
    if ((await probe.call(VideoEncoder, { codec: 'avc1.42e01f', ...base })).supported) {
      return { codec: 'avc1.42e01f', ...base };
    }
  } catch {
    /* 探测异常不致命，下沉到 configure */
  }
  return { codec: 'avc1.640028', ...base };
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('视频读取结果不是字符串'));
    };
    reader.onerror = () => reject(new Error('视频读取失败'));
    reader.readAsDataURL(blob);
  });
}

export type VideoImportEvent =
  | { kind: 'start' }
  | { kind: 'transcoded'; origMB: string; newMB: string; width: number; height: number }
  | { kind: 'kept-original'; reason: string };

/**
 * R4-auto 入库封装：能转则转（720p），任何失败都保留原片。
 * 由 useFileUpload 视频分支调用；事件回调供 UI toast。
 */
export async function videoFileToDataURL(
  file: Blob,
  onEvent?: (e: VideoImportEvent) => void,
  onProgress?: (p: TranscodeProgress) => void
): Promise<string> {
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  if (!isVideoTranscodeSupported()) {
    return blobToDataURL(file);
  }
  onEvent?.({ kind: 'start' });
  try {
    const r = await transcodeVideoTo720p(file, onProgress);
    if (r.didTranscode) {
      onEvent?.({ kind: 'transcoded', origMB: mb(r.origBytes), newMB: mb(r.newBytes), width: r.width, height: r.height });
    } else {
      onEvent?.({ kind: 'kept-original', reason: '已在 720p 内或转后更大' });
    }
    return blobToDataURL(r.blob);
  } catch (e) {
    const reason = e instanceof TranscodeError ? e.message : String(e);
    onEvent?.({ kind: 'kept-original', reason });
    return blobToDataURL(file);
  }
}

export async function transcodeVideoTo720p(
  file: Blob,
  onProgress?: (p: TranscodeProgress) => void
): Promise<TranscodeResult> {
  if (!isVideoTranscodeSupported()) {
    throw new TranscodeError('当前浏览器不支持 WebCodecs 转码', 'unsupported-env');
  }
  const origBytes = file.size;
  // arrayBuffer 本就是新鲜独占 buffer，直接复用（曾多余 slice 复制 50MB，已删）
  const fileBytes = await file.arrayBuffer();

  return await new Promise<TranscodeResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      fail(new TranscodeError('转码超时', 'timeout'));
    }, TRANSCODE_TIMEOUT_MS);
    // 看门狗：投喂停滞（截断文件/0 样本/mp4box 少吐）60s 即失败，不假死到 8 分钟；
    // 投喂完成进入 flush/mux 后停表，由 8 分钟总超时接管
    let lastFedAt = Date.now();
    let feedingDone = false;
    const watchdog = setInterval(() => {
      if (!settled && !feedingDone && Date.now() - lastFedAt > TRANSCODE_STALL_MS) {
        fail(new TranscodeError('转码停滞（60s 无进展），保留原片', 'stalled'));
      }
    }, 10000);

    let settled = false;
    const clearTimers = () => {
      clearTimeout(timer);
      clearInterval(watchdog);
    };
    const done = (r: TranscodeResult) => {
      if (settled) return;
      settled = true;
      clearTimers();
      cleanup();
      resolve(r);
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      clearTimers();
      cleanup();
      reject(e instanceof Error ? e : new TranscodeError(String(e), 'pipeline-failed'));
    };

    let videoDecoder: VideoDecoder | null = null;
    let videoEncoder: VideoEncoder | null = null;
    let audioDecoder: AudioDecoder | null = null;
    let audioEncoder: AudioEncoder | null = null;
    let mp4ref: { stop?: () => void } | null = null;
    const cleanup = () => {
      try {
        mp4ref?.stop?.();
      } catch {
        /* ignore */
      }
      try {
        videoDecoder?.close();
      } catch {
        /* ignore */
      }
      try {
        videoEncoder?.close();
      } catch {
        /* ignore */
      }
      try {
        audioDecoder?.close();
      } catch {
        /* ignore */
      }
      try {
        audioEncoder?.close();
      } catch {
        /* ignore */
      }
    };

    try {
      const mp4file = createFile();
      mp4ref = mp4file;
      mp4file.onError = (module: string, message: string) =>
        fail(new TranscodeError(`解封装失败: ${module} ${message}`, 'parse-failed'));

      // onReady 两段式（血泪教训）：mp4box 在 appendBuffer/flush 同步流程里触发 onReady
      // 并继续同步派发样本 —— 若在此处 await（如编码器探测），会让出控制权，
      // flush 在 extraction 未就绪时跑完，样本永不到达（表现为 60s 看门狗停滞）。
      // 故：同步前缀完成守卫+muxer+抽取装配+start()，异步后缀只做编解码器装配，
      // 样本先入队列，装配完成后由 pump 串行投喂（串行亦满足 muxer 时间戳递增）。
      mp4file.onReady = (info) => {
        // ---- 同步前缀（禁止 await；守卫失败抛错由外层 fail 承接） ----
        let setup: {
          vTrack: (typeof info.tracks)[number];
          aTrack: (typeof info.tracks)[number] | undefined;
          fit: FitBox;
          dispW: number;
          dispH: number;
          codedW: number;
          codedH: number;
          muxer: Muxer<ArrayBufferTarget>;
          fps: number;
          keyframeInterval: number;
        };
        try {
          // 多轨直接拒收：只取首条会静默丢轨（双摄/双语），宁可保原片
          const nVideo = info.tracks.filter((t) => t.type === 'video').length;
          const nAudio = info.tracks.filter((t) => t.type === 'audio').length;
          if (nVideo > 1 || nAudio > 1) {
            throw new TranscodeError(`多轨视频（${nVideo} 视频轨/${nAudio} 音频轨），保留原片`, 'multi-track');
          }
          const vTrack = info.tracks.find((t) => t.type === 'video');
          if (!vTrack || !vTrack.video) throw new TranscodeError('无视频轨', 'parse-failed');
          if (!/^avc1\./.test(vTrack.codec || '')) {
            throw new TranscodeError(`非 H.264(AVC1) 视频（${vTrack.codec}），本轮保留原片`, 'unsupported-video-codec');
          }
          // 旋转/翻转检测：tkhd 矩阵（16.16 定点 3x3，a=m[0],b=m[1],c=m[3],d=m[4]）。
          // b/c 非零＝旋转，a/d 非正＝翻转/180° —— canvas 路径会丢弃该变换，必须拒收。
          // 另保留 coded/display 转置检查作双保险（部分文件矩阵缺省但尺寸已转置）。
          const mx = vTrack.matrix as unknown as ArrayLike<number> | undefined;
          if (mx && mx.length >= 6) {
            const [a, b] = [mx[0], mx[1]];
            const [c, d] = [mx[3], mx[4]];
            if (b !== 0 || c !== 0 || a <= 0 || d <= 0) {
              throw new TranscodeError('视频含旋转/翻转元数据，保留原片', 'rotation-flag');
            }
          }
          // 取 stsd 可视条目编码尺寸（判旋转用；盒内结构无类型，经真实文件探明）
          const vEntry = (
            mp4file.getTrackById(vTrack.id) as unknown as {
              mdia: { minf: { stbl: { stsd: { entries: Array<{ width: number; height: number }> } } } };
            }
          ).mdia.minf.stbl.stsd.entries[0];
          const codedW = vEntry?.width ?? 0;
          const codedH = vEntry?.height ?? 0;
          const dispW = vTrack.video.width;
          const dispH = vTrack.video.height;
          if (codedW === dispH && codedH === dispW && codedW !== codedH) {
            throw new TranscodeError('视频含旋转元数据，保留原片', 'rotation-flag');
          }

          const fit = fitBox(dispW, dispH);
          if (fit.scale >= 1) {
            done({ blob: file, width: dispW, height: dispH, origBytes, newBytes: origBytes, didTranscode: false });
            return;
          }

          const aTrack = info.tracks.find((t) => t.type === 'audio');
          if (aTrack && !/^mp4a\.40\.2$/.test(aTrack.codec || '')) {
            throw new TranscodeError(`非 AAC-LC 音频（${aTrack.codec}），本轮保留原片`, 'unsupported-audio-codec');
          }

          const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: { codec: 'avc', width: fit.width, height: fit.height },
            ...(aTrack && aTrack.audio
              ? { audio: { codec: 'aac' as const, sampleRate: aTrack.audio.sample_rate, numberOfChannels: aTrack.audio.channel_count } }
              : {}),
            fastStart: 'in-memory',
            // 双轨用跨轨对齐（同源时钟，逐轨归零会引入固定声画漂移）
            firstTimestampBehavior: aTrack ? 'cross-track-offset' : 'offset',
          });

          const fps = vTrack.nb_samples > 0 && vTrack.duration > 0
            ? Math.round((vTrack.nb_samples * vTrack.timescale) / vTrack.duration)
            : 30;
          setup = {
            vTrack,
            aTrack,
            fit,
            dispW,
            dispH,
            codedW,
            codedH,
            muxer,
            fps,
            keyframeInterval: Math.max(30, Math.round(fps * VIDEO_KEYFRAME_SECONDS)),
          };
        } catch (e) {
          fail(e);
          return;
        }
        const { vTrack, aTrack, fit, dispW, dispH, codedW, codedH, muxer, fps, keyframeInterval } = setup;

        const totalSamples = vTrack.nb_samples + (aTrack?.nb_samples ?? 0);
        let fedSamples = 0;
        const report = (phase: TranscodeProgress['phase']) =>
          onProgress?.({ phase, done: fedSamples, total: totalSamples });
        let pending = totalSamples;
        const inputDurationSec = vTrack.duration / vTrack.timescale;

        // 样本队列 + 装配门：onSamples 只入队（同步安全），pump 等编解码器就绪后串行投喂
        const sampleQueue: Array<{ trackId: number; samples: Sample[] }> = [];
        let setupResolve: () => void = () => undefined;
        const setupGate = new Promise<void>((r) => {
          setupResolve = r;
        });
        let pumpRunning = false;
        const finish = async () => {
          feedingDone = true;
          try {
            onProgress?.({ phase: 'mux', done: totalSamples, total: totalSamples });
            await videoDecoder?.flush();
            await videoEncoder?.flush();
            if (audioDecoder) await audioDecoder.flush();
            if (audioEncoder) await audioEncoder.flush();
            muxer.finalize();
            const out = (muxer.target as ArrayBufferTarget).buffer;
            // 输出校验：复核封装产物（视频轨存在/时长偏差≤5%/音频未丢失），
            // 截断/乱序输出即使更小也必须拒收（只看体积的守卫拦不住）
            await validateMuxedOutput(out, { durationSec: inputDurationSec, expectAudio: !!aTrack });
            const blob = new Blob([out], { type: 'video/mp4' });
            // 尺寸守卫：转后更大则保留原片（低码率源常见，见 R4 离线结论）
            if (blob.size >= origBytes) {
              done({ blob: file, width: dispW, height: dispH, origBytes, newBytes: origBytes, didTranscode: false });
            } else {
              done({ blob, width: fit.width, height: fit.height, origBytes, newBytes: blob.size, didTranscode: true });
            }
          } catch (e) {
            fail(e);
          }
        };
        const pump = async () => {
          if (pumpRunning) return;
          pumpRunning = true;
          try {
            await setupGate;
            while (sampleQueue.length > 0 && !settled) {
              const batch = sampleQueue.shift()!;
              const track = batch.trackId === vTrack.id ? vTrack : aTrack;
              if (!track) continue;
              for (const s of batch.samples) {
                if (!s.data) throw new TranscodeError('样本数据缺失', 'parse-failed');
                const timestamp = Math.round((s.cts * 1_000_000) / track.timescale);
                const duration = Math.round((s.duration * 1_000_000) / track.timescale);
                if (batch.trackId === vTrack.id) {
                  await decodeQueueDrain(videoDecoder as VideoDecoder & EventTarget);
                  videoDecoder?.decode(
                    new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp, duration, data: s.data })
                  );
                } else {
                  await decodeQueueDrain(audioDecoder as AudioDecoder & EventTarget);
                  audioDecoder?.decode(new EncodedAudioChunk({ type: 'key', timestamp, duration, data: s.data }));
                }
                fedSamples += 1;
                lastFedAt = Date.now();
                report(batch.trackId === vTrack.id ? 'video' : 'audio');
                pending -= 1;
                if (pending === 0) await finish();
              }
            }
          } catch (e) {
            fail(e);
          } finally {
            pumpRunning = false;
            // 泵退出时若又有新 batch 到达（onSamples 在 finally 后 push），补跑一轮
            if (sampleQueue.length > 0 && !settled) void pump();
          }
        };
        mp4file.onSamples = (trackId: number, _ref: unknown, samples: Sample[]) => {
          sampleQueue.push({ trackId, samples });
          void pump();
        };
        mp4file.setExtractionOptions(vTrack.id, undefined, { nbSamples: vTrack.nb_samples });
        if (aTrack) mp4file.setExtractionOptions(aTrack.id, undefined, { nbSamples: aTrack.nb_samples });
        mp4file.start();

        // ---- 异步后缀：编解码器装配（探测含 await，必须在抽取装配之后） ----
        void (async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = fit.width;
            canvas.height = fit.height;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new TranscodeError('无法创建画布', 'pipeline-failed');
            let frameCount = 0;

            videoEncoder = new VideoEncoder({
              output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
              error: (e) => fail(new TranscodeError(`视频编码失败: ${e.message}`, 'pipeline-failed')),
            });
            videoEncoder.configure(await pickAvcEncoderConfig(fit.width, fit.height, VIDEO_TARGET_VIDEO_BITRATE, fps));

            videoDecoder = new VideoDecoder({
              output: (frame) => {
                try {
                  ctx.drawImage(frame, 0, 0, fit.width, fit.height);
                  const scaled = new VideoFrame(canvas, { timestamp: frame.timestamp ?? 0, duration: frame.duration ?? undefined });
                  frame.close();
                  videoEncoder?.encode(scaled, { keyFrame: frameCount % keyframeInterval === 0 });
                  scaled.close();
                  frameCount += 1;
                } catch (e) {
                  fail(e);
                }
              },
              error: (e) => fail(new TranscodeError(`视频解码失败: ${e.message}`, 'pipeline-failed')),
            });
            videoDecoder.configure({
              codec: vTrack.codec as string,
              codedWidth: codedW || dispW,
              codedHeight: codedH || dispH,
              description: buildAvcDescription(getAvcC(mp4file.getTrackById(vTrack.id))),
            });

            if (aTrack && aTrack.audio) {
              const aTrak = mp4file.getTrackById(aTrack.id);
              audioEncoder = new AudioEncoder({
                output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
                error: (e) => fail(new TranscodeError(`音频编码失败: ${e.message}`, 'pipeline-failed')),
              });
              audioEncoder.configure({
                codec: 'mp4a.40.2',
                sampleRate: aTrack.audio.sample_rate,
                numberOfChannels: aTrack.audio.channel_count,
                bitrate: VIDEO_TARGET_AUDIO_BITRATE,
              });
              audioDecoder = new AudioDecoder({
                output: (audioData) => {
                  try {
                    audioEncoder?.encode(audioData);
                    audioData.close();
                  } catch (e) {
                    fail(e);
                  }
                },
                error: (e) => fail(new TranscodeError(`音频解码失败: ${e.message}`, 'pipeline-failed')),
              });
              audioDecoder.configure({
                codec: 'mp4a.40.2',
                sampleRate: aTrack.audio.sample_rate,
                numberOfChannels: aTrack.audio.channel_count,
                description: getAacDescription(aTrak),
              });
            }
            setupResolve();
            void pump();
          } catch (e) {
            fail(e);
          }
        })();
      };

      onProgress?.({ phase: 'demux', done: 0, total: 1 });
      mp4file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(fileBytes, 0));
      mp4file.flush();
    } catch (e) {
      fail(e);
    }
  });
}
