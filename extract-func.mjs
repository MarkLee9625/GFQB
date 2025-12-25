import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appPath = path.join(__dirname, 'App.tsx');
const content = fs.readFileSync(appPath, 'utf-8');

// 查找函数开始行
const functionStart = 'const generateExportHtml = (options: { useAlternateDesign: boolean }, sortedArticles: Article[], logo: string, sidebarMeta: string) => {';
const startIndex = content.indexOf(functionStart);
if (startIndex === -1) {
  console.error('Function start not found');
  process.exit(1);
}

// 从开始位置搜索匹配的结束大括号
let braceCount = 0;
let inTemplate = false;
let inString = false;
let escape = false;
let quoteChar = null;

for (let i = startIndex; i < content.length; i++) {
  const ch = content[i];
  const nextCh = content[i + 1] || '';

  if (escape) {
    escape = false;
    continue;
  }

  if (ch === '\\') {
    escape = true;
    continue;
  }

  if (!inTemplate && !inString) {
    if (ch === '{') {
      braceCount++;
    } else if (ch === '}') {
      braceCount--;
      if (braceCount === 0) {
        // 找到函数结束
        const functionCode = content.substring(startIndex, i + 1);
        console.log(functionCode);
        break;
      }
    } else if (ch === '`') {
      inTemplate = true;
      quoteChar = '`';
    } else if (ch === '"' || ch === "'") {
      inString = true;
      quoteChar = ch;
    }
  } else {
    if (ch === quoteChar) {
      if (quoteChar === '`' && nextCh === '`') {
        // 模板字符串中的转义 ``
        i++; // 跳过下一个 `
        continue;
      }
      inTemplate = false;
      inString = false;
      quoteChar = null;
    }
  }
}
