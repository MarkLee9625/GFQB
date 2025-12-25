import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appPath = path.join(__dirname, 'App.tsx');
const content = fs.readFileSync(appPath, 'utf-8');

// 查找函数开始
const startMarker = 'const generateExportHtml = (options: { useAlternateDesign: boolean }, sortedArticles: Article[], logo: string, sidebarMeta: string) => {';
let startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error('Function start not found');
  process.exit(1);
}

// 从 startIndex 开始，我们需要找到匹配的结束大括号
let braceCount = 0;
let inTemplateString = false;
let escapeNext = false;
let templateChar = null; // '`' 或 '"' 或 "'"
let i = startIndex;
for (; i < content.length; i++) {
  const ch = content[i];
  if (escapeNext) {
    escapeNext = false;
    continue;
  }
  if (ch === '\\') {
    escapeNext = true;
    continue;
  }
  if (!inTemplateString) {
    if (ch === '{') {
      braceCount++;
    } else if (ch === '}') {
      braceCount--;
      if (braceCount === 0) {
        // 找到了匹配的结束大括号
        break;
      }
    } else if (ch === '`' || ch === '"' || ch === "'") {
      inTemplateString = true;
      templateChar = ch;
    }
  } else {
    if (ch === templateChar) {
      inTemplateString = false;
      templateChar = null;
    }
  }
}

const functionCode = content.substring(startIndex, i + 1);
console.log(functionCode);
