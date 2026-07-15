// scripts/copy-worker.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义要复制的资源列表
const resources = [
    {
        src: '../node_modules/pdfjs-dist/build/pdf.min.mjs',
        dest: 'pdf.min.mjs',
        type: 'file'
    },
    {
        src: '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
        dest: 'pdf.worker.min.mjs',
        type: 'file'
    },
    {
        src: '../node_modules/pdfjs-dist/cmaps',
        dest: 'cmaps',
        type: 'dir'
    },
    {
        src: '../node_modules/pdfjs-dist/standard_fonts',
        dest: 'standard_fonts',
        type: 'dir'
    },
    {
        src: '../node_modules/pdfjs-dist/wasm',
        dest: 'wasm',
        type: 'dir'
    }
];

const publicDir = path.resolve(__dirname, '../public');

async function main() {
    console.log('🚀 开始同步 PDF 资源...');

    // 确保 public 目录存在
    if (!fs.existsSync(publicDir)) {
        console.log('创建 public 目录...');
        fs.mkdirSync(publicDir, { recursive: true });
    }

    for (const resource of resources) {
        const sourcePath = path.resolve(__dirname, resource.src);
        const destPath = path.join(publicDir, resource.dest);

        console.log(`\n📦 处理: ${resource.dest}`);
        console.log(`   源: ${sourcePath}`);

        try {
            if (!fs.existsSync(sourcePath)) {
                console.error(`   ⚠️ 源路径不存在，跳过: ${sourcePath}`);
                continue;
            }

            if (resource.type === 'file') {
                copyFileSafe(sourcePath, destPath);
            } else {
                copyDirSafe(sourcePath, destPath);
            }
            console.log(`   ✅ 成功`);
        } catch (err) {
            console.error(`   ❌ 失败: ${err.message}`);
            // 我们不抛出错误，而是尽可能完成其他资源的同步
        }
    }

    // 同步 d3.min.js 到 public/（供知识图谱 iframe 外部引用）
    console.log('\n📦 同步 D3 库...');
    const d3Src = path.resolve(__dirname, '../node_modules/d3/dist/d3.min.js');
    const d3Dest = path.join(publicDir, 'd3.min.js');
    if (fs.existsSync(d3Src)) {
        copyFileSafe(d3Src, d3Dest);
        console.log('   ✅ d3.min.js 已同步');
    } else {
        console.warn('   ⚠️ d3.min.js 未找到，跳过');
    }

    console.log('\n✨ 同步脚本执行完毕。Errors were logged if any occurred.');
}

function copyFileSafe(src, dest) {
    // 如果目标存在，尝试删除
    if (fs.existsSync(dest)) {
        try {
            fs.unlinkSync(dest);
        } catch (e) {
            console.warn(`   ⚠️ 无法删除旧文件 (可能被占用)，将尝试覆盖: ${e.message}`);
        }
    }
    fs.copyFileSync(src, dest);
}

function copyDirSafe(src, dest) {
    // 确保目标目录存在
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        try {
            if (entry.isDirectory()) {
                copyDirSafe(srcPath, destPath);
            } else {
                copyFileSafe(srcPath, destPath);
            }
        } catch (err) {
            console.warn(`   ⚠️ 复制单个文件失败 [${entry.name}]: ${err.message}`);
        }
    }
}

// 执行主函数并处理顶层错误
main().catch(err => {
    console.error('💥 脚本发生致命错误:', err);
    process.exit(1);
});
