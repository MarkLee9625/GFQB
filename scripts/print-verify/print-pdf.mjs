// headless Chrome 把打印 HTML 打成 PDF（A1 台架）。
// 用法: node print-pdf.mjs <input.html> <output.pdf>
// 约束：只走 headless（ headed 会弹窗口），@page 由 CSS 生效，关闭浏览器页眉页脚以保证确定性。
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function resolveBrowser() {
  for (const p of CANDIDATES) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  throw new Error('未找到 Chrome/Edge，可用 CHROME_PATH 环境变量指定');
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('用法: node print-pdf.mjs <input.html> <output.pdf>');
  process.exit(2);
}
const inAbs = path.resolve(input);
const outAbs = path.resolve(output);
if (!fs.existsSync(inAbs)) {
  console.error(`输入不存在: ${inAbs}`);
  process.exit(2);
}

const browser = resolveBrowser();
console.log(`[print-pdf] ${browser}`);
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--log-level=3',
  '--no-pdf-header-footer',
  '--timeout=90000',
  `--print-to-pdf=${outAbs}`,
  pathToFileURL(inAbs).href,
];
const r = spawnSync(browser, args, { encoding: 'utf-8', timeout: 120000 });
if (r.error) {
  console.error(`[print-pdf] 启动失败: ${r.error.message}`);
  process.exit(1);
}
if (r.status !== 0) {
  console.error(`[print-pdf] exit=${r.status}\n${(r.stderr || '').slice(-2000)}`);
  process.exit(1);
}
if (!fs.existsSync(outAbs)) {
  console.error('[print-pdf] PDF 未生成（Chrome 无报错但无产物）');
  process.exit(1);
}
console.log(`[print-pdf] OK ${(fs.statSync(outAbs).size / 1024).toFixed(0)}KB -> ${outAbs}`);
