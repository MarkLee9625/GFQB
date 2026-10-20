// 打印验证一键编排（A1 台架 / A4 门）：
//   fixture 生成（真实 generatePrintableHTML）→ headless 打 PDF → 页图谱 strict 判定
// 用法: npm run verify:print
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TMP = path.join(HERE, '.tmp');
const FIXTURE_HTML = path.join(TMP, 'fixture.print.html');
const FIXTURE_PDF = path.join(TMP, 'fixture.print.pdf');

function sh(cmd, args, opts = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 240000,
    ...opts,
  });
  return { ...r, secs: ((Date.now() - t0) / 1000).toFixed(1) };
}

let failed = false;

// Step 1: fixture（直调 vitest 入口，避开 shell/中文路径引号坑）
console.log('—— [1/3] 生成 fixture（真实导出链路）');
{
  const vitestBin = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  if (!fs.existsSync(vitestBin)) {
    console.error('vitest 未安装（缺 node_modules/vitest），先 npm install');
    process.exit(2);
  }
  const r = sh(process.execPath, [vitestBin, 'run', 'src/services/export/print.harness.test.ts'], {
    env: { ...process.env, WRITE_PRINT_FIXTURE: '1' },
  });
  console.log((r.stdout || '').slice(-1500));
  if (r.status !== 0 || r.error) {
    console.error(`fixture 生成失败 (${r.secs}s): ${r.error ? r.error.message : ''}\n${(r.stderr || '').slice(-2000)}`);
    process.exit(1);
  }
  console.log(`fixture OK (${r.secs}s) ${(fs.statSync(FIXTURE_HTML).size / 1024).toFixed(0)}KB`);
}

// Step 2: headless 打印
console.log('—— [2/3] headless Chrome 打 PDF');
{
  const r = sh(process.execPath, [path.join(HERE, 'print-pdf.mjs'), FIXTURE_HTML, FIXTURE_PDF]);
  console.log(r.stdout || '');
  if (r.status !== 0 || r.error) {
    console.error(`打印失败 (${r.secs}s): ${r.error ? r.error.message : ''}\n${(r.stderr || '').slice(-2000)}`);
    process.exit(1);
  }
}

// Step 3: 页图谱 strict 判定（python 解析：python3 → python → py）
console.log('—— [3/3] 页图谱判定（strict）');
{
  const pyCandidates = process.platform === 'win32'
    ? [['python3', []], ['python', []], ['py', ['-3']]]
    : [['python3', []], ['python', []]];
  let tried = [];
  let done = false;
  for (const [cmd, pre] of pyCandidates) {
    // 探测必须含全部依赖（本机存在多解释器，裸 --version 通过不代表依赖齐；
    // --render 强制开启，fitz/PIL 缺一即 traceback，故三合一探测）
    const probe = sh(cmd, [...pre, '-c', 'import pypdf, fitz, PIL']);
    if (probe.error || probe.status !== 0) { tried.push(cmd); continue; }
    // --render 必开：headless 把撕裂两半挂同一 XObject，字节口径失效（见 page-map.py）。
    // --expect-pages=23：健康基线（封面1+目录1+正文一2+头1+PDF15+头1+正文二1+封底1；
    // 撕裂半页若与下篇头同页 render 视其非空，只能靠页数门；A2 修复后锁定）。
    const EXPECT_PAGES = 23;
    const r = sh(cmd, [...pre, path.join(HERE, 'page-map.py'), FIXTURE_PDF,
      '--strict', '--render', '--expect-pages', String(EXPECT_PAGES)]);
    console.log(r.stdout || '');
    if (r.stderr) console.error(r.stderr.slice(-1000));
    if (r.status !== 0) failed = true;
    done = true;
    break;
  }
  if (!done) {
    console.error(`未找到可用 python（试过: ${tried.join(', ')}，且需 pip install pypdf）`);
    process.exit(2);
  }
}

console.log(failed ? '\n[verify:print] FAIL —— 检出空白/残片页' : '\n[verify:print] PASS —— 无空白/残片页');
process.exit(failed ? 1 : 0);
