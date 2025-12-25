import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appPath = path.join(__dirname, 'App.tsx');
const content = fs.readFileSync(appPath, 'utf-8');

// 查找函数开始
const startMarker = 'const generateExportHtml = (options: { useAlternateDesign: boolean }, sortedArticles: Article[], logo: string, sidebarMeta: string) => {';
let startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.error('Start marker not found');
    process.exit(1);
}

// 初始化计数器
let braceCount = 0;
let inTemplateString = false;
let escapeNext = false;

// 从startIdx开始遍历
let i = startIdx;
for (; i < content.length; i++) {
    const char = content[i];
    
    // 处理转义字符
    if (escapeNext) {
        escapeNext = false;
        continue;
    }
    
    if (char === '\\') {
        escapeNext = true;
        continue;
    }
    
    // 处理模板字符串开始/结束
    if (char === '`') {
        inTemplateString = !inTemplateString;
        continue;
    }
    
    // 如果不在模板字符串中，计算大括号
    if (!inTemplateString) {
        if (char === '{') {
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                // 找到匹配的结束大括号
                break;
            }
        }
    }
}

// 提取函数代码（包括最后的}）
const functionCode = content.substring(startIdx, i + 1);
console.log(functionCode);

// 同时写入文件以便检查
fs.writeFileSync('extracted-function.ts', functionCode, 'utf-8');
console.log('\n\nFunction also saved to extracted-function.ts');
