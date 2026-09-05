
import fs from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, '../dist');
const ASSETS_DIR = join(DIST_DIR, 'assets');

// 知识图谱代码生成模板守卫：
// graphEngine.ts / Renderer.ts 通过模板字面量返回 JS 源码字符串（注入 iframe srcdoc），
// 模板内严禁出现反引号（会提前闭合外层模板字面量导致生成代码损坏）。
// 基线为文件内反引号总数；不一致视为回归，直接终止构建。
const GRAPH_TEMPLATE_BASELINES = [
    { file: 'src/utils/graph/graphEngine.ts', backticks: 4 },
    { file: 'src/utils/graph/Renderer.ts', backticks: 2 },
];

function validateGraphTemplates() {
    for (const { file, backticks } of GRAPH_TEMPLATE_BASELINES) {
        const path = resolve(__dirname, '../', file);
        if (!fs.existsSync(path)) continue;
        const content = fs.readFileSync(path, 'utf-8');
        const count = (content.match(/`/g) || []).length;
        if (count !== backticks) {
            console.error(`❌ [安全校验] ${file} 反引号数量 ${count} 与基线 ${backticks} 不一致`);
            console.error('   知识图谱代码注入模板中禁止使用反引号（会提前闭合外层模板字面量）。');
            console.error('   如确需调整，请更新 scripts/post-build.js 基线并人工确认生成代码仍为合法 ES5。');
            process.exit(1);
        }
    }
    console.log('✅ [安全校验] 知识图谱模板反引号基线校验通过');
}

async function main() {
    console.log("🚀 Starting Post-Build Processing...");

    validateGraphTemplates();

    // 1. Read index.html
    const indexHtmlPath = join(DIST_DIR, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
        console.error("❌ dist/index.html not found!");
        process.exit(1);
    }
    let htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');

    // 2. Inline Assets (JS/CSS)
    console.log("📦 Inlining assets into HTML...");

    // Inline CSS
    htmlContent = htmlContent.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (match, url) => {
        const cssPath = join(DIST_DIR, url);
        if (fs.existsSync(cssPath)) {
            console.log(`   - Inlining CSS: ${url}`);
            const css = fs.readFileSync(cssPath, 'utf-8');
            return `<style>${css}</style>`;
        }
        return match;
    });

    // Inline JS (Module)
    // Vite produces <script type="module" crossorigin src="/assets/index-....js"></script>
    htmlContent = htmlContent.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (match, url) => {
        const jsPath = join(DIST_DIR, url);
        if (fs.existsSync(jsPath)) {
            console.log(`   - Inlining JS: ${url}`);
            const js = fs.readFileSync(jsPath, 'utf-8');
            // Remove the import statement or handle it if necessary?
            // Since it's a module, inlining it inside <script type="module"> is fine.
            return `<script type="module">${js}</script>`;
        }
        return match;
    });

    // 3. Inject PDF.js (Manual injection for offline capability)
    // We need to inject pdf.min.js (library) and pdf.worker.min.js (worker)
    // The wrapper.ts expects window.pdfjsLib.
    // So we invoke the library script.

    // Locate pdfjs files in public (now in dist root or public source)
    // Vite copies public to dist.
    const pdfLibPath = resolve(__dirname, '../public/pdf.min.mjs'); // Use source public as dist might be clean
    const pdfWorkerPath = resolve(__dirname, '../public/pdf.worker.min.mjs');

    // We cannot easily inline ES modules that import other things into a single script tag without bundling.
    // pdf.min.mjs likely has imports?
    // User's project uses pdfjs-dist 4/5. 
    // pdf.worker.min.mjs is usually standalone or ESM.

    // Strategy: Read the files as strings and inject them.
    // But if they are ESM, we need <script type="module">.
    if (fs.existsSync(pdfLibPath) && fs.existsSync(pdfWorkerPath)) {
        console.log("📄 Inlining PDF.js library and worker...");
        const pdfLib = fs.readFileSync(pdfLibPath, 'utf-8');
        const pdfWorker = fs.readFileSync(pdfWorkerPath, 'utf-8');

        // Inject before </body>
        // We construct a blob URL for the worker??
        // Or just script injection.
        // If we use wrapper.ts, it looks for window.pdfjsLib.
        // pdf.min.mjs usually exports specific things. It might not set global pdfjsLib if loaded as module.
        // Use a Legacy/UMD build if available? 
        // The user only has .mjs.

        // If loaded as module:
        // <script type="module"> import * as pdfjsLib from '...'; window.pdfjsLib = pdfjsLib; </script>
        // Since we must be offline and "single file", we can use a data URI import or just inline the content.
        // Inline content in module:
        // <script type="module">
        //   // pdf.min.mjs content
        //   ...
        //   import * as _pdfjs from 'self'; // No.
        // </script>

        // Easier: Inject it as a Blob URL?
        // No, just inject code.
        // If pdf.min.mjs is ESM, it has `export`.
        // We can do:
        // <script type="module">
        //    ${pdfLib}
        //    window.pdfjsLib = { ...exports }; // Hard to capture exports.
        // </script>

        // Better: Use `pdf.js` (UMD) from node_modules if available.
        // But let's assume the user setup works with what we have.
        // We will inject the PDF worker code as a Blob URL string constant, and the Lib code as a Module.
        // Wrapper.ts: `window.pdfjsLib || window['pdfjs-dist/build/pdf']`.

        // If we inline `pdf.min.mjs` content into a `<script type="module">`, it works but doesn't expose globals.
        // We can append `window.pdfjsLib = { getDocument, ... }` at the end of the string if we parse exports.
        // Or just:
        // `import * as _p from 'data:text/javascript;base64,...'; window.pdfjsLib = _p;`
        // This works for offline single file!

        const pdfLibB64 = Buffer.from(pdfLib).toString('base64');
        const pdfWorkerB64 = Buffer.from(pdfWorker).toString('base64');

        // Worker needs to be loaded by PDFJS.
        // We can set GlobalWorkerOptions.workerSrc to a data URI of the worker code.

        // We inject a script that sets up PDFJS.
        const pdfSetupScript = `
            <script type="module">
                const pdfLibStyle = document.createElement('style');
                pdfLibStyle.textContent = \`
                    /* inline pdfjs css if needed */
                \`;
                document.head.appendChild(pdfLibStyle);

                // Import PDF Lib from Data URI
                import * as pdfjsLib from 'data:text/javascript;base64,${pdfLibB64}';
                window.pdfjsLib = pdfjsLib;
                
                // Configure Worker (use Uint8Array to avoid UTF-8 encoding corruption)
                const workerBinary = Uint8Array.from(atob("${pdfWorkerB64}"), function(c) { return c.charCodeAt(0); });
                const workerBlob = new Blob([workerBinary], { type: 'text/javascript' });
                const workerUrl = URL.createObjectURL(workerBlob);
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                
                console.log("✅ PDF.js inlined and configured.");
            </script>
         `;

            if (htmlContent.includes('<!--SWS_BODY_INJECT-->')) {
        htmlContent = htmlContent.replace('<!--SWS_BODY_INJECT-->', () => pdfSetupScript);
    } else {
        // 兜底：使用最后一个 </body>（bundle 字符串可能包含 </body>，首个命中会截断脚本）
        const lastBodyIdx = htmlContent.lastIndexOf('</body>');
        if (lastBodyIdx === -1) {
            console.error("❌ No </body> found in index.html, PDF.js inline failed!");
            process.exit(1);
        }
        htmlContent = htmlContent.slice(0, lastBodyIdx) + pdfSetupScript + htmlContent.slice(lastBodyIdx);
    }
    } else {
        // copy-worker.js 已保证 PDF.js 核心资源存在；此处缺失说明构建流程异常，必须失败
        console.error("❌ PDF.js files not found in public/, inline failed!");
        process.exit(1);
    }

    // 4. Inline D3.js for knowledge graph iframes (offline support)
    // 图谱 iframe 通过 window.parent.__SWS_D3_SRC__ 读取（见 graphRenderer.ts loadD3），
    // 无注入时回退 CDN。旧实现匹配 <script src="./d3.min.js"> 从未命中，属于死代码。
    const d3Path = resolve(__dirname, '../public/d3.min.js');
    if (fs.existsSync(d3Path)) {
        console.log("📊 Inlining D3.js for knowledge graph iframes...");
        const d3Code = fs.readFileSync(d3Path, 'utf-8');
        // JSON.stringify 保证 JS 字符串安全；转义 </script> 与 <!-- 防止提前闭合 script 元素
        const d3Json = JSON.stringify(d3Code).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
        const d3InlineScript = `<script>window.__SWS_D3_SRC__=${d3Json};</script>`;
            if (htmlContent.includes('<!--SWS_D3_INJECT-->')) {
        htmlContent = htmlContent.replace('<!--SWS_D3_INJECT-->', () => d3InlineScript);
        console.log("   ✅ D3.js inlined into page global (window.__SWS_D3_SRC__)");
    } else if (htmlContent.includes('<head>')) {
        htmlContent = htmlContent.replace('<head>', `<head>${d3InlineScript}`);
        console.log("   ✅ D3.js inlined into page global (window.__SWS_D3_SRC__, head fallback)");
    } else {
        console.warn("⚠️ No <head> tag found in index.html, skipping D3 inline.");
    }
    } else {
        console.warn("⚠️ d3.min.js not found in public/, knowledge graphs will fall back to CDN.");
    }

    // 5. 处理独立阅读版入口（reader.html）→ 单文件模板
    // 阅读版是精简 React 应用（无编辑器/PDF.js/IndexedDB），导出时由 reader.ts
    // 读取 reader-template.html 并注入数据。不再往编辑器 index.html 内嵌阅读版模板，
    // 避免模板自拷贝导致的体积膨胀与脚本截断问题。
    const readerHtmlPath = join(DIST_DIR, 'reader.html');
    if (fs.existsSync(readerHtmlPath)) {
        let readerHtml = fs.readFileSync(readerHtmlPath, 'utf-8');

        // Inline CSS
        readerHtml = readerHtml.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (match, url) => {
            const cssPath = join(DIST_DIR, url);
            if (fs.existsSync(cssPath)) {
                const css = fs.readFileSync(cssPath, 'utf-8');
                return `<style>${css}</style>`;
            }
            return match;
        });

        // Inline JS（模块）
        readerHtml = readerHtml.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (match, url) => {
            const jsPath = join(DIST_DIR, url);
            if (fs.existsSync(jsPath)) {
                const js = fs.readFileSync(jsPath, 'utf-8');
                return `<script type="module">${js}</script>`;
            }
            return match;
        });

        // Inline D3.js（知识图谱离线支持；阅读版不需要 PDF.js）
        if (fs.existsSync(d3Path)) {
            const d3CodeReader = fs.readFileSync(d3Path, 'utf-8');
            const d3JsonReader = JSON.stringify(d3CodeReader).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
            const d3InlineScriptReader = `<script>window.__SWS_D3_SRC__=${d3JsonReader};</script>`;
            if (readerHtml.includes('<!--SWS_D3_INJECT-->')) {
                readerHtml = readerHtml.replace('<!--SWS_D3_INJECT-->', () => d3InlineScriptReader);
                console.log("   ✅ D3.js inlined into reader template (window.__SWS_D3_SRC__)");
            }
        }

        // 保留 <!--SWS_READER_DATA--> 锚点，导出时由 reader.ts 注入数据
        fs.writeFileSync(readerHtmlPath, readerHtml);
        fs.writeFileSync(join(DIST_DIR, 'reader-template.html'), readerHtml);
        console.log(`✅ Reader entry single-file generated: ${readerHtmlPath} (${readerHtml.length} chars)`);
    } else {
        console.warn("⚠️ dist/reader.html not found, skipping reader template generation.");
    }

    // 6. Write back index.html（编辑器单文件，不再内嵌阅读版模板）
    fs.writeFileSync(indexHtmlPath, htmlContent);
    console.log(`✅ index.html updated (single-file build, ${htmlContent.length} chars)`);

    console.log("🎉 Post-build processing complete.");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
