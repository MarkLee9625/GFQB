
import fs from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, '../dist');
const ASSETS_DIR = join(DIST_DIR, 'assets');
const PLACEHOLDER = "SWS_READER_TEMPLATE_PLACEHOLDER";

async function main() {
    console.log("🚀 Starting Post-Build Processing...");

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

        htmlContent = htmlContent.replace('</body>', `${pdfSetupScript}</body>`);
    } else {
        console.warn("⚠️ PDF.js files not found in public/, skipping inline.");
    }

    // 4. Inline D3.js for knowledge graph iframes
    const d3Path = resolve(__dirname, '../public/d3.min.js');
    if (fs.existsSync(d3Path)) {
        console.log("📊 Inlining D3.js for knowledge graph iframes...");
        const d3Code = fs.readFileSync(d3Path, 'utf-8');
        // Replace the external D3 script tag with inline version preserving CDN fallback
        const d3InlineScript = '<script>' + d3Code + '<\\/script><script onerror="var s=document.createElement(\'script\');s.src=\'https://d3js.org/d3.v7.min.js\';document.head.appendChild(s);"><\\/script>';
        htmlContent = htmlContent.replace(
            /<script src="\.\/d3\.min\.js" onerror="[^"]*"><\/script>/g,
            d3InlineScript
        );
        console.log("   ✅ D3.js inlined into iframes");
    } else {
        console.warn("⚠️ d3.min.js not found in public/, skipping D3 inline.");
    }

    // 5. Generate Single File Content (Reader Template)
    const singleFileContent = htmlContent;

    // Save the single file reader for debugging/verification
    const readerOutputPath = join(DIST_DIR, 'reader.html');
    fs.writeFileSync(readerOutputPath, singleFileContent);
    console.log(`✅ Single-file reader generated at: ${readerOutputPath}`);

    // 5. Inject into Main Bundle (Replace Placeholder)
    console.log("💉 Injecting reader template into main bundle...");

    // Escape for JS string (JSON.stringify is safest to get a quoted string)
    const escapedContent = JSON.stringify(singleFileContent);
    // JSON.stringify returns "content". We need to replace "SWS...PLACEHOLDER" (which is invalid JSON, just a string in code).
    // In code: `const READER_TEMPLATE = "SWS_...";`
    // We want: `const READER_TEMPLATE = "<html>...";`
    // So we replace `"SWS_READER_TEMPLATE_PLACEHOLDER"` with `escapedContent`.

    const assetsDir = join(DIST_DIR, 'assets');
    const files = fs.readdirSync(assetsDir);
    let injected = false;

    for (const file of files) {
        if (file.endsWith('.js')) {
            const filePath = join(assetsDir, file);
            let content = fs.readFileSync(filePath, 'utf-8');

            if (content.includes(PLACEHOLDER)) {
                console.log(`   - Found placeholder in ${file}`);
                // Replace the quoted placeholder "SWS..." with the quoted content "<html>..."
                // Since JSON.stringify adds quotes, we replace `"SWS_READER_TEMPLATE_PLACEHOLDER"` with `escapedContent`.
                // Note: Minification might remove quotes or change usage.
                // Usually it preserves string literals.
                // We search for the literal string.

                // If minified: `var x="SWS_..."`
                // We replace `"SWS_..."` with `"<html>..."`.

                // If the placeholder in code was `const x = "SWS...";`
                // We look for `"SWS_READER_TEMPLATE_PLACEHOLDER"`.

                const newContent = content.replace(`"${PLACEHOLDER}"`, escapedContent);
                // Also try single quotes just in case terser changed it
                const finalContent = newContent.replace(`'${PLACEHOLDER}'`, escapedContent);

                if (content !== finalContent) {
                    fs.writeFileSync(filePath, finalContent);
                    console.log(`✅ Injected template into ${file}`);
                    injected = true;
                    break; // Assuming only one occurrence
                }
            }
        }
    }

    if (!injected) {
        console.error("❌ Placeholder not found in any JS asset! Template injection failed.");
        process.exit(1);
    }

    console.log("🎉 Post-build processing complete.");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
