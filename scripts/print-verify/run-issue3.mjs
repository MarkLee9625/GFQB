// 第3期端到端复现编排（A4）：
//   prep（工程备份+已打印PDF→映射）→ vitest 真实导出 → headless 打印 → 页图谱 strict+render
// 用法: npm run verify:print:issue3
// 注意：不设 --expect-pages（健康总页数未知，首跑确定基线后再锁）。
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TMP = path.join(HERE, '.tmp');
const ISSUE3_HTML = path.join(TMP, 'issue3.print.html');
const ISSUE3_PDF = path.join(TMP, 'issue3.print.pdf');

function sh(cmd, args, opts = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf-8', timeout: 600000, ...opts });
  return { ...r, secs: ((Date.now() - t0) / 1000).toFixed(1) };
}

function resolvePython() {
  const cands = process.platform === 'win32'
    ? [['python3', []], ['python', []], ['py', ['-3']]]
    : [['python3', []], ['python', []]];
  for (const [cmd, pre] of cands) {
    const probe = sh(cmd, [...pre, '-c', 'import pypdf, fitz, PIL']);
    if (!probe.error && probe.status === 0) return [cmd, pre];
  }
  return null;
}

const py = resolvePython();
if (!py) {
  console.error('未找到可用 python（需 pypdf + pymupdf + pillow）');
  process.exit(2);
}
const [pyCmd, pyPre] = py;

// Step 1: prep
console.log('—— [1/4] issue3-prep（映射+光栅提取）');
{
  const r = sh(pyCmd, [...pyPre, path.join(HERE, 'issue3-prep.py')]);
  console.log((r.stdout || '').slice(-2000));
  if (r.status !== 0 || r.error) {
    console.error(`prep 失败: ${(r.stderr || '').slice(-2000)}`);
    process.exit(1);
  }
}

// Step 2: vitest 真实导出
console.log('—— [2/4] vitest 真实导出（27 篇）');
{
  const vitestBin = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  const r = sh(process.execPath, [vitestBin, 'run', 'src/services/export/print.issue3.test.ts'], {
    env: { ...process.env, ISSUE3_REPRO: '1', WRITE_ISSUE3_HTML: '1' },
  });
  console.log((r.stdout || '').slice(-1500));
  if (r.status !== 0 || r.error) {
    console.error(`导出失败 (${r.secs}s): ${(r.stderr || '').slice(-3000)}`);
    process.exit(1);
  }
  console.log(`issue3.print.html OK (${r.secs}s) ${(fs.statSync(ISSUE3_HTML).size / 1024 / 1024).toFixed(1)}MB`);
}

// Step 3: headless 打印
console.log('—— [3/4] headless Chrome 打 PDF');
{
  const r = sh(process.execPath, [path.join(HERE, 'print-pdf.mjs'), ISSUE3_HTML, ISSUE3_PDF]);
  console.log(r.stdout || '');
  if (r.status !== 0 || r.error) {
    console.error(`打印失败: ${(r.stderr || '').slice(-2000)}`);
    process.exit(1);
  }
}

// Step 4: 页图谱 strict+render（只报告，不设页数期望）
console.log('—— [4/4] 页图谱判定（strict+render）');
{
  const r = sh(pyCmd, [...pyPre, path.join(HERE, 'page-map.py'), ISSUE3_PDF, '--strict', '--render']);
  console.log(r.stdout || '');
  if (r.stderr) console.error(r.stderr.slice(-1000));
  process.exit(r.status === 0 ? 0 : 1);
}
