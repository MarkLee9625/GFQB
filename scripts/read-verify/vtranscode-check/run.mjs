// R4-auto 真机验证：esbuild 打包转码模块 → headless Chrome（真 WebCodecs）跑用例矩阵 → CDP 读结果。
// 用例（含负例）：高码率转码 / 720p 直通 / 无音频 / 旋转拒收 / 多轨拒收 / HEVC 拒收 / 损坏文件。
// 被测走 videoFileToDataURL（入库封装），断言事件契约（start/transcoded/kept-original）。
// 用法: npm run verify:vtranscode [只跑用例名过滤]；PORT 用 VTRANSCODE_PORT 覆盖。
// 零第三方依赖（esbuild 复用 vite 自带；CDP 走 node 原生 fetch/WebSocket）。
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const WORK = path.join(HERE, '.tmp');
const FIX = path.join(HERE, 'fixtures');
const PORT = Number(process.env.VTRANSCODE_PORT || 19222);
const CASE_TIMEOUT_MS = 240000;
const ONLY = process.argv[2] || '';

/** 用例矩阵：expect.did=true=转码成功；kept=保留原片（reason 正则匹配拒收文案） */
const CASES = [
  { name: 'hi', file: 'hi.mp4', expect: { did: true, w: 1280, h: 720, smaller: true } },
  { name: 'sd-720p-passthrough', file: 'sd.mp4', expect: { kept: true } },
  { name: 'noaudio', file: 'noaudio.mp4', expect: { did: true, w: 1280, h: 720, smaller: true } },
  { name: 'rot90-refused', file: 'rot90.mp4', expect: { kept: true, reason: /旋转/ } },
  { name: 'dualaudio-refused', file: 'dualaudio.mp4', expect: { kept: true, reason: /多轨/ } },
  { name: 'hevc-refused', file: 'hevc.mp4', expect: { kept: true, reason: /AVC1/ } },
  { name: 'garbage-refused', file: 'garbage.mp4', expect: { kept: true } },
].filter((c) => !ONLY || c.name.includes(ONLY));

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

function resolveBrowser() {
  for (const p of BROWSERS) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  throw new Error('未找到 Chrome');
}

// 1. 打包 + 备料
console.log('—— [1/3] 打包转码模块 + 备料');
fs.mkdirSync(WORK, { recursive: true });
{
  const { build } = await import('esbuild');
  await build({
    entryPoints: [path.join(ROOT, 'src/services/video/transcode.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: path.join(WORK, 'transcode.mjs'),
    logLevel: 'warning',
  });
}
for (const c of CASES) {
  const src = path.join(FIX, c.file);
  if (!fs.existsSync(src)) throw new Error(`fixture 缺失: ${c.file}`);
  fs.copyFileSync(src, path.join(WORK, `case-${c.name}.mp4`));
  fs.writeFileSync(
    path.join(WORK, `t-${c.name}.html`),
    `<!doctype html><meta charset=utf-8><title>RUNNING</title><body><script type="module">
import { videoFileToDataURL, isVideoTranscodeSupported } from './transcode.mjs';
try {
  if (!isVideoTranscodeSupported()) { document.title = 'FAIL unsupported-env'; }
  else {
    const blob = await (await fetch('./case-${c.name}.mp4')).blob();
    const events = [];
    const t0 = Date.now();
    const url = await videoFileToDataURL(blob, (e) => events.push(e));
    document.title = 'DONE ' + JSON.stringify({ events, outBytes: url.length, secs: ((Date.now() - t0) / 1000).toFixed(1) });
  }
} catch (e) { document.title = 'FAIL ' + String((e && e.stack) || e).slice(0, 400); }
<\/script></body></html>`
  );
}

// 2. 起浏览器（单实例多用例，逐用例导航）
console.log('—— [2/3] 启动 headless Chrome');
const browser = resolveBrowser();
const child = spawn(
  browser,
  [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--log-level=3', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*', '--user-data-dir=' + path.join(WORK, 'profile'),
    'about:blank',
  ],
  { stdio: 'ignore', detached: false }
);
const kill = () => {
  try {
    child.kill();
  } catch { /* ignore */ }
};
process.on('exit', kill);

let wsUrl = '';
for (let i = 0; i < 50; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (page) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch { /* retry */ }
  await new Promise((r) => setTimeout(r, 300));
}
if (!wsUrl) {
  kill();
  throw new Error('CDP 连接失败');
}
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', () => resolve(), { once: true });
  ws.addEventListener('error', (e) => reject(e), { once: true });
});
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  try {
    const m = JSON.parse(String(ev.data));
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  } catch { /* ignore */ }
});
function rpc(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, resolve);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('cdp timeout'));
      }
    }, 15000);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// 3. 逐用例
console.log('—— [3/3] 用例矩阵');
const failures = [];
for (const c of CASES) {
  process.stdout.write(`  ${c.name} ... `);
  try {
    await rpc('Page.navigate', { url: pathToFileURL(path.join(WORK, `t-${c.name}.html`)).href });
    const t0 = Date.now();
    let verdict = '';
    while (Date.now() - t0 < CASE_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 2000));
      const m = await rpc('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
      const title = m?.result?.result?.value || '';
      if (title.startsWith('DONE ') || title.startsWith('FAIL')) {
        verdict = title;
        break;
      }
      process.stdout.write('.');
    }
    console.log('');
    if (!verdict) throw new Error('超时');
    if (verdict.startsWith('FAIL')) throw new Error(verdict.slice(5));
    const r = JSON.parse(verdict.slice(5));
    const kinds = (r.events || []).map((e) => e.kind);
    if (!kinds.includes('start')) throw new Error('缺 start 事件');
    const last = r.events[r.events.length - 1];
    if (c.expect.did) {
      if (last?.kind !== 'transcoded') throw new Error(`期望转码成功，实际 ${last?.kind}（${last?.reason || ''}）`);
      if (last.width !== c.expect.w || last.height !== c.expect.h) {
        throw new Error(`期望 ${c.expect.w}x${c.expect.h}，实际 ${last.width}x${last.height}`);
      }
      const origBytes = fs.statSync(path.join(FIX, c.file)).size;
      // data URI 长度 ≈ b64(4/3) + 前缀；转码成功必须显著小于原片 b64
      if (!(r.outBytes < (origBytes * 4) / 3)) throw new Error('输出未变小');
      console.log(`  ✅ ${c.name}（${last.origMB}→${last.newMB}MB，${r.secs}s）`);
    } else {
      if (last?.kind !== 'kept-original') throw new Error(`期望保留原片，实际 ${last?.kind}`);
      if (c.expect.reason && !c.expect.reason.test(last.reason || '')) {
        throw new Error(`拒收文案不匹配：${last.reason}`);
      }
      console.log(`  ✅ ${c.name}（保留原片：${last.reason}，${r.secs}s）`);
    }
  } catch (e) {
    console.log(`  ❌ ${c.name}：${e instanceof Error ? e.message : e}`);
    failures.push(c.name);
  }
}
try {
  ws.close();
} catch { /* ignore */ }
kill();

console.log(failures.length === 0 ? '\n[verify:vtranscode] PASS' : `\n[verify:vtranscode] FAIL —— ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
