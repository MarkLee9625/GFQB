// v2 端到端门（R1-b/R3）：新模板 + 真实 27 篇 → v2 文件 headless 打开 → CDP 断言。
// 断言：①骨架秒开（侧边栏列表出现）②后台索引完成 ③翻篇正文渲染 ④视频/PDF 媒体可用
//       ⑤全文检索有效 ⑥v1 老文件在新阅读器照常打开（兼容）。
// 用法: npm run verify:v2e2e（耗时数分钟：打包+注数+两次 headless 打开）
import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const TMP = path.join(HERE, '.tmp');
const TEMPLATE = path.join(ROOT, 'dist', 'reader-template.html');
const PROJECT = 'C:/Users/MA/OneDrive - stu.just.edu.cn/工法情报收集/2026第3期/SWS_Project_2026-10-20.html';
const PORT = 19223;

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

let portSeq = 0;
async function cdpOpen(file, onReady) {
  const browser = resolveBrowser();
  // 每次新端口：前一个 headless 在 Windows 下退出慢，同端口复用会绑定失败
  const port = PORT + portSeq++;
  const profile = path.join(TMP, `profile-${Date.now()}-${port}`);
  const child = spawn(
    browser,
    [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--log-level=3', `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
      `--user-data-dir=${profile}`, 'about:blank',
    ],
    { stdio: 'ignore' }
  );
  const kill = () => {
    try {
      child.kill();
    } catch { /* ignore */ }
  };
  try {
    let wsUrl = '';
    for (let i = 0; i < 60; i++) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!wsUrl) throw new Error('CDP 连接失败');
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', (e) => reject(e), { once: true });
    });
    let seq = 0;
    const pending = new Map();
    // console.error / pageerror 收集：后台解码失败走 console.error，漏网即假绿
    const pageErrors = [];
    ws.addEventListener('message', (ev) => {
      try {
        const m = JSON.parse(String(ev.data));
        if (m.id && pending.has(m.id)) {
          pending.get(m.id)(m);
          pending.delete(m.id);
        } else if (m.method === 'Runtime.exceptionThrown') {
          pageErrors.push('exception: ' + JSON.stringify(m.params?.exceptionDetails).slice(0, 300));
        } else if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
          pageErrors.push(
            'console.error: ' + (m.params?.args || []).map((a) => String(a?.value ?? a?.description ?? '')).join(' ').slice(0, 300)
          );
        }
      } catch { /* ignore */ }
    });
    const rpc = async (method, params = {}) => {
      const id = ++seq;
      const p = new Promise((resolve, reject) => {
        pending.set(id, resolve);
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error('cdp timeout'));
          }
        }, 30000);
      });
      ws.send(JSON.stringify({ id, method, params }));
      return p;
    };
    const ev = async (expression) => {
      const m = await rpc('Runtime.evaluate', { expression, returnByValue: true });
      if (m?.result?.exceptionDetails) throw new Error('evaluate 异常: ' + JSON.stringify(m.result.exceptionDetails).slice(0, 300));
      return m?.result?.result?.value;
    };
    // 先开事件流再导航：加载期错误（解析/启动失败）才不漏网
    await rpc('Runtime.enable', {});
    await rpc('Page.navigate', { url: pathToFileURL(file).href });
    const out = await onReady(ev, pageErrors);
    try {
      ws.close();
    } catch { /* ignore */ }
    return out;
  } finally {
    kill();
    await new Promise((r) => setTimeout(r, 1000));
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function pollUntil(ev, expr, ok, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    const v = await ev(expr);
    if (ok(v)) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`超时: ${label}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const failures = [];
const note = (ok, msg) => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${msg}`);
  if (!ok) failures.push(msg);
};

// ————— step 0: 模板新鲜度（无 v2 loader 即重建） —————
console.log('—— [0/4] 模板新鲜度');
if (!fs.existsSync(TEMPLATE) || !fs.readFileSync(TEMPLATE, 'utf-8').includes('__SWS_V2_META_B64__')) {
  console.log('  模板无 v2 loader，重建中…');
  let r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'vite.reader.config.ts'], {
    cwd: ROOT, encoding: 'utf-8', timeout: 590000,
  });
  if (r.status !== 0) {
    console.error((r.stderr || '').slice(-2000));
    throw new Error('reader 构建失败');
  }
  r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/post-build.js')], { cwd: ROOT, encoding: 'utf-8', timeout: 590000 });
  if (r.status !== 0) {
    console.error((r.stderr || '').slice(-2000));
    throw new Error('post-build 失败');
  }
  if (!fs.readFileSync(TEMPLATE, 'utf-8').includes('__SWS_V2_META_B64__')) throw new Error('重建后模板仍无 v2');
  console.log('  ✅ 模板已重建（含 v2 loader）');
} else {
  console.log('  ✅ 模板新鲜（含 v2 loader）');
}

// ————— step 1: 打包注数器 + 注数 —————
console.log('—— [1/4] 注数（v2 全量 27 篇 + v1 子集）');
fs.mkdirSync(TMP, { recursive: true });
{
  const { build } = await import('esbuild');
  await build({
    entryPoints: [path.join(HERE, 'mkdata.entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: path.join(TMP, 'mkdata.mjs'),
    logLevel: 'warning',
  });
}
const V2HTML = path.join(TMP, 'v2e2e.v2.html');
const V1HTML = path.join(TMP, 'v2e2e.v1.html');
for (const [fmt, proj, out, sub] of [['v2', PROJECT, V2HTML, ''], ['v1', PROJECT, V1HTML, '5']]) {
  const r = spawnSync(process.execPath, [path.join(TMP, 'mkdata.mjs'), fmt, proj, TEMPLATE, out, sub].filter(Boolean), {
    cwd: ROOT, encoding: 'utf-8', timeout: 590000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=6144' },
  });
  console.log('  ' + (r.stdout || '').trim().split('\n').join('\n  '));
  if (r.status !== 0) {
    console.error((r.stderr || '').slice(-3000));
    throw new Error(`注数失败: ${fmt}`);
  }
}

// ————— step 2: v2 打开断言 —————
console.log('—— [2/4] v2 打开断言');
await cdpOpen(V2HTML, async (ev, pageErrors) => {
  // ① 骨架秒开（__T0 在导航后计时，不含浏览器启动）
  await pollUntil(ev, `document.querySelectorAll('aside ul li').length`, (n) => n >= 25, 60000, '侧边栏列表出现');
  const shellMs = await ev(`window.__T0 ? Date.now() - window.__T0 : -1`);
  note(shellMs >= 0 && shellMs < 15000, `骨架出现 ${shellMs}ms（<15s，100MB 解析+渲染）`);
  const liCount = await ev(`document.querySelectorAll('aside ul li').length`);
  note(liCount === 27, `侧边栏 27 篇（得 ${liCount}）`);
  const badges = await ev(`[...document.querySelectorAll('aside ul li')].filter(li => li.textContent.includes('PDF')).length`);
  note(badges === 5, `PDF 角标 5 篇（得 ${badges}，外壳 hasPdf 生效）`);

  // ② 后台索引完成且零失败
  await pollUntil(ev, `!document.body.textContent.includes('全文索引加载中')`, Boolean, 240000, '后台索引完成');
  const hasFailedText = await ev(`document.body.textContent.includes('索引失败')`);
  note(!hasFailedText, '索引零失败（无失败提示）');

  // ③ 翻篇正文渲染（含视频篇媒体回填）
  await ev(`[...document.querySelectorAll('aside ul li')].find(li => li.textContent.includes('HD现代重工建成全球首批')).click()`);
  await pollUntil(ev, `!!document.querySelector('.sws-prose, .article-body')`, Boolean, 30000, '正文渲染');
  const videoSrc = await ev(`(document.querySelector('video')||{}).src || ''`);
  note(videoSrc.startsWith('data:video'), `视频 data URI 回填（${(videoSrc.length / 1048576).toFixed(1)}MB）`);

  // ④ 全文检索穿透：命中数必须大于纯标题命中数（否则"只搜标题也绿"）
  await ev(`(()=>{const i=document.querySelector('aside input');const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');d.set.call(i,'焊接');i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await new Promise((r) => setTimeout(r, 800));
  const hitCount = await ev(`document.querySelectorAll('aside ul li').length`);
  note(hitCount > 0 && hitCount < 27, `检索“焊接”命中 ${hitCount} 篇（0< n <27）`);
  // 清空检索恢复全量，数标题含词篇数：总命中必须大于它（否则正文没参与）
  await ev(`(()=>{const i=document.querySelector('aside input');const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value');d.set.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await new Promise((r) => setTimeout(r, 800));
  const titleOnly = await ev(
    `[...document.querySelectorAll('aside ul li')].filter(li => li.textContent.includes('焊接')).length`
  );
  note(hitCount > titleOnly, `正文参与检索（总命中 ${hitCount} > 标题命中 ${titleOnly}）`);

  // ⑤ 全程无 console.error / pageerror
  note(pageErrors.length === 0, pageErrors.length === 0 ? '零页面错误' : `页面错误 ${pageErrors.length} 条：${pageErrors[0]}`);
});

// ————— step 3: v1 兼容 —————
console.log('—— [3/4] v1 老文件兼容');
await cdpOpen(V1HTML, async (ev, pageErrors) => {
  await pollUntil(ev, `document.querySelectorAll('aside ul li').length`, (n) => n >= 5, 90000, 'v1 列表出现');
  const n = await ev(`document.querySelectorAll('aside ul li').length`);
  note(n === 7, `v1 子集 7 篇渲染（得 ${n}）`);
  // 封面主题有 magazine/default 两套 class 体系，断言主滚动区文本量（与主题无关）
  await pollUntil(ev, `((document.querySelector('.overscroll-none')||{}).textContent||'').length`, (n) => n > 50, 30000, 'v1 首篇渲染');
  note(true, 'v1 首篇渲染');
  note(pageErrors.length === 0, pageErrors.length === 0 ? 'v1 零页面错误' : `v1 页面错误：${pageErrors[0]}`);
});

console.log(failures.length === 0 ? '\n[verify:v2e2e] PASS' : `\n[verify:v2e2e] FAIL —— ${failures.length} 项`);
process.exit(failures.length === 0 ? 0 : 1);
