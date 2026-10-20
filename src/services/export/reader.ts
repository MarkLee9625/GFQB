import type { Article } from '../../types';
import { CONSTANTS, isSpecialCategory } from '../../constants';
import { getReaderSkeleton } from './reader/readerSkeleton';
import { saveAs } from 'file-saver';
import { sortArticlesByPriority } from '../../utils/articleSort';
import { escapeHtml } from '../../utils/stringUtils';
import { resolveArticlesMediaData } from '../../../services/mediaStore';
import { toast } from '../../utils/toast';
import { stripRedundantBlocks } from './v2format';

export interface ExportOptions {
    useAlternateDesign?: boolean;
    includeImages?: boolean;
}

export interface ExportMetadata {
    logo?: string;
    sidebarMeta?: string;
    title?: string;
    date?: string;
}

export type ReaderExportFormat = 'v1' | 'v2';

interface WorkerRequest {
    type: 'START_EXPORT';
    articlesBlob: Blob;
    options: ExportOptions & { format?: ReaderExportFormat };
    metadata: ExportMetadata;
    companyInfo: typeof CONSTANTS.COMPANY_INFO;
}

interface WorkerResponseBase {
    type: 'EXPORT_COMPLETE';
    format: ReaderExportFormat;
    configB64: string;
    compressionMethod: string;
    /** R2 守卫：超阈 PNG 处数/体积（旧 Worker 无此字段，缺省 0） */
    pngLargeCount?: number;
    pngLargeBytes?: number;
}

interface WorkerResponseV1 extends WorkerResponseBase {
    format: 'v1';
    articlesB64: string;
}

interface WorkerResponseV2 extends WorkerResponseBase {
    format: 'v2';
    /** Worker 内拼好的完整注入脚本（主线程只做模板替换，不碰 100MB 数组） */
    injectionScript: string;
}

type WorkerResponse = WorkerResponseV1 | WorkerResponseV2;

interface WorkerProgress {
    type: 'EXPORT_PROGRESS';
    percent: number;
    message?: string;
}

interface WorkerError {
    type: 'EXPORT_ERROR';
    error: string;
}

/**
 * 校验模板是否为真正的阅读版单文件模板。
 *
 * Vite dev 的 SPA fallback 会把未命中路径（如 reader-template.html）以 200
 * 返回开发版 index.html（引用 /@vite/client、/index.tsx、/@react-refresh），
 * 导出的文件在 file:// 下必然被 CORS 拦截。因此必须按内容特征校验，
 * 不能只看 </body>。
 */
export function isValidReaderTemplate(text: string): boolean {
  if (!text || !text.includes('</body>')) return false;
  // 开发版 index.html 特征：命中即拒绝
  if (
    text.includes('/@vite/client') ||
    text.includes('/index.tsx') ||
    text.includes('@react-refresh')
  ) {
    return false;
  }
  // 阅读版模板必须带数据注入锚点（reader.html 与 dist/reader-template.html 均保留）
  return text.includes('<!--SWS_READER_DATA-->') || text.includes('工法情报阅读器');
}

/**
 * 加载阅读版单文件模板（dist/reader-template.html，由 post-build.js 生成）。
 * 模板是精简 React 阅读应用（不含编辑器/PDF.js/IndexedDB）；
 * 兼容旧构建的 window.__SWS_READER_TEMPLATE__ 全局注入；
 * 均不可用时返回 null，由调用方回退到 dev 动态骨架。
 */
async function loadReaderTemplate(): Promise<string | null> {
    const legacy = (globalThis as any)?.__SWS_READER_TEMPLATE__;
    if (typeof legacy === 'string' && isValidReaderTemplate(legacy)) {
        return legacy;
    }
    try {
        const res = await fetch('reader-template.html', { cache: 'no-store' });
        if (res.ok) {
            const text = await res.text();
            return isValidReaderTemplate(text) ? text : null;
        }
    } catch (e) {
        console.warn('[Export] reader-template.html 加载失败，使用动态骨架', e);
    }
    return null;
}

/**
 * 将注入脚本打进模板：优先 <!--SWS_READER_DATA--> 锚点；兜底最后一个 </body>。
 * 必须使用函数式替换：替换串中若出现 $& / $' 等序列，String.replace 会按
 * 特殊模式展开，导致模板被复制进脚本中间并截断（历史踩坑，见 post-build.js）。
 */
function injectScriptIntoReader(template: string, injectionScript: string): string {
    if (template.includes('<!--SWS_READER_DATA-->')) {
        return template.replace('<!--SWS_READER_DATA-->', () => injectionScript);
    }
    const lastBodyIdx = template.lastIndexOf('</body>');
    if (lastBodyIdx !== -1) {
        return template.slice(0, lastBodyIdx) + injectionScript + template.slice(lastBodyIdx);
    }
    return template + injectionScript;
}

const escapeForScript = (s: string): string => s.replace(/<\//g, '<\\/');

/** v1 注入（整包；仅降级骨架路径使用，生产模板已走 v2） */
function injectDataIntoReader(
    template: string,
    articlesB64: string,
    configB64: string,
    compressionMethod: string
): string {
    const injectionScript = `
    <script>
    window.__SWS_DATA_ARTICLES_B64__ = "${escapeForScript(articlesB64)}";
    window.__SWS_DATA_CONFIG_B64__ = "${escapeForScript(configB64)}";
    window.__SWS_COMPRESSION_METHOD__ = "${compressionMethod}";
    </script>
    `;
    return injectScriptIntoReader(template, injectionScript);
}

/** v2 注入脚本打进模板（脚本由 Worker 拼好，见 v2format.buildV2InjectionScript） */
function injectV2DataIntoReader(template: string, injectionScript: string): string {
    return injectScriptIntoReader(template, injectionScript);
}

/**
 * 文章是否包含知识图谱容器（决定是否内联 D3）。
 * 图谱正文承载于 content HTML 或 rawHtml 块中，均以 knowledge-graph-container 类名标记。
 */
function articlesContainKnowledgeGraph(articles: Article[]): boolean {
  return articles.some(a => {
    if ((a.content || '').includes('knowledge-graph-container')) return true;
    if (a.blocks) {
      return a.blocks.some(b =>
        b.type === 'rawHtml' && (b as { html?: string }).html?.includes('knowledge-graph-container')
      );
    }
    return false;
  });
}

/**
 * 获取 D3 源码：优先编辑器页面全局（生产构建已内联），
 * dev 模式下回退 fetch public/d3.min.js；均失败返回 null（图谱运行时回退 CDN）。
 */
async function fetchD3Source(): Promise<string | null> {
    const inline = (globalThis as any)?.__SWS_D3_SRC__;
    if (typeof inline === 'string' && inline.length > 0) return inline;
    try {
        const res = await fetch('d3.min.js', { cache: 'no-store' });
        if (res.ok) {
            const text = await res.text();
            return text.length > 1000 ? text : null;
        }
    } catch (e) {
        console.warn('[Export] fetch d3.min.js 失败（dev 模式图谱将回退 CDN）', e);
    }
    return null;
}

/**
 * 按需注入 D3（仅当文章正文包含知识图谱容器时）。
 * - 有 D3 源码：替换 <!--SWS_D3_INJECT--> 为 window.__SWS_D3_SRC__ 内联脚本；
 * - 无 D3 源码：移除锚点（图谱 iframe 运行时回退 CDN）。
 * 防止把 ~250KB 的 D3 无条件打进每一份导出的阅读版。
 */
function injectD3IfNeeded(template: string, d3Source: string | null): string {
    const D3_ANCHOR = '<!--SWS_D3_INJECT-->';
    if (!template.includes(D3_ANCHOR)) return template;

    if (!d3Source) {
        return template.replace(D3_ANCHOR, () => '');
    }

    try {
        const safe = JSON.stringify(d3Source).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
        return template.replace(D3_ANCHOR, () => `<script>window.__SWS_D3_SRC__=${safe};</script>`);
    } catch (e) {
        console.warn('[Export] D3 内联失败，跳过（图谱将回退 CDN）', e);
        return template.replace(D3_ANCHOR, () => '');
    }
}

/**
 * 生成本地文章 JSON Blob（经 R-D0 去重后序列化，随后交给 Worker 压缩）。
 * 仅在主线程做一次序列化，不再结构化克隆整个对象图，
 * 避免同步深拷贝几十 MB 大字符串。
 * 序列化后立即释放 JSON 字符串引用（Blob 已持有副本），降低内存峰值。
 */
function serializeArticles(articles: Article[]): Blob {
    const { slim, stripped, kept } = stripRedundantBlocks(articles);
    console.log(`[Export] R-D0 blocks去重: 剥离${stripped}篇/保留${kept}篇`);
    const json = JSON.stringify(slim);
    const blob = new Blob([json], { type: 'application/json' });
    return blob;
}

/**
 * 生成离线阅读器 HTML
 * 优先使用构建生成的精简阅读版模板（reader-template.html）并注入数据；
 * dev 模式模板缺失时回退到动态骨架。
 */
export async function generateReaderHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {},
    onProgress?: (percent: number, message?: string) => void
): Promise<string> {
    // P0-A 防御性还原：阅读器是单 HTML 自包含产物，媒体引用绝不能外泄到导出文件
    articles = await resolveArticlesMediaData(articles);
    const sortedArticles = sortArticlesByPriority(articles);

    console.log('[Export] 开始处理文章数据，保留PDF数据以支持离线阅读器...');
    sortedArticles.forEach((article, idx) => {
        if (article.category === '封面' && !article.coverImage) {
            console.warn(`[Export] 文章 #${idx} "${article.title}" (封面) coverImage 为空`);
        }
        if (article.category === '封底' && !article.backImage) {
            console.warn(`[Export] 文章 #${idx} "${article.title}" (封底) backImage 为空`);
        }
    });
    console.log('[Export] 文章数据处理完成，PDF数据已保留，准备序列化...');

    const blob = serializeArticles(sortedArticles);
    const needsD3 = articlesContainKnowledgeGraph(sortedArticles);
    const d3Source = needsD3 ? await fetchD3Source() : null;
    // v2 选型前置：模板存在 → v2（索引+分块）；缺失 → v1（降级骨架只读 v1，老链路保留演练）
    const readerTemplate = await loadReaderTemplate();
    const format: ReaderExportFormat = readerTemplate ? 'v2' : 'v1';
    console.log(`[Export] 文章序列化完成，导出格式=${format}，准备 Web Worker 导出流程...`);

    return new Promise((resolve, reject) => {
        // 安全超时：5 分钟后自动拒绝，防止 Promise 挂死
        const timeoutMs = 5 * 60 * 1000;
        const timeoutId = setTimeout(() => {
            worker.terminate();
            reject(new Error('导出超时：Worker 在 5 分钟内未完成'));
        }, timeoutMs);

        const worker = new Worker(
            new URL('./reader.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (event: MessageEvent<WorkerResponse | WorkerProgress | WorkerError>) => {
            const data = event.data;

            if (data.type === 'EXPORT_PROGRESS') {
                onProgress?.(data.percent, data.message);
                return;
            }

            if (data.type === 'EXPORT_ERROR') {
                clearTimeout(timeoutId);
                worker.terminate();
                const errMsg = data.error || 'Worker 内部错误';
                console.error('[Export] Worker 报告错误:', errMsg);
                reject(new Error(errMsg));
                return;
            }

            if (data.type === 'EXPORT_COMPLETE') {
                clearTimeout(timeoutId);
                const { configB64, compressionMethod } = data;

                // R2 守卫：大 PNG 告警（照片类 PNG 应走 WebP；gzip 救不了它）
                if ((data.pngLargeCount ?? 0) > 0) {
                    const mb = ((data.pngLargeBytes ?? 0) / 1024 / 1024).toFixed(1);
                    console.warn(`[Export] R2 守卫：检出 ${data.pngLargeCount} 处超 500KB 的 PNG（共 ${mb}MB）`);
                    toast.warning(`检出 ${data.pngLargeCount} 处大 PNG（${mb}MB），建议转 WebP 后重导`);
                }
                // R3 兜底：落到 none 必须响亮（生产构建 drop console，故同时 toast）
                if (compressionMethod === 'none') {
                    console.warn('[Export] R3 兜底：压缩未生效（none），包体积含双重 base64 膨胀');
                    toast.warning('导出压缩未生效，包体积偏大（已回退未压缩模式）');
                }

                console.log('[Export] Worker 返回数据，准备生成 HTML...');

                try {
                    let htmlContent: string;
                    if (data.format === 'v2' && readerTemplate) {
                        htmlContent = injectV2DataIntoReader(readerTemplate, data.injectionScript);
                        htmlContent = injectD3IfNeeded(htmlContent, d3Source);
                    } else if (data.format === 'v1' && readerTemplate) {
                        // 防御：模板存在却收到 v1（理论不可达，旧 Worker 残留时）
                        htmlContent = injectDataIntoReader(readerTemplate, data.articlesB64, configB64, compressionMethod);
                        htmlContent = injectD3IfNeeded(htmlContent, d3Source);
                    } else if (data.format === 'v1') {
                        htmlContent = buildReaderHTML(data.articlesB64, configB64, compressionMethod, sortedArticles, options, metadata);
                    } else {
                        throw new Error('降级骨架不支持 v2 数据（模板缺失但 Worker 返回 v2）');
                    }
                    worker.terminate();
                    resolve(htmlContent);
                } catch (err) {
                    worker.terminate();
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            }
        };

        worker.onerror = (error: Event | ErrorEvent) => {
            clearTimeout(timeoutId);
            worker.terminate();
            // ErrorEvent 有 message 属性，普通 Event 没有
            const errMsg = 'message' in error
                ? (error as ErrorEvent).message
                : `Worker 加载或执行失败 (${error.type})`;
            console.error('[Export] Worker 错误:', errMsg);
            reject(new Error(errMsg));
        };

        const request: WorkerRequest = {
            type: 'START_EXPORT',
            articlesBlob: blob,
            options: { ...options, format },
            metadata,
            companyInfo: CONSTANTS.COMPANY_INFO
        };
        worker.postMessage(request);
    });
}

/**
 * dev 模式回退：无 reader-template.html 时生成 vanilla 动态骨架阅读器。
 */
function buildReaderHTML(
    articlesB64: string,
    configB64: string,
    compressionMethod: string,
    sortedArticles: Article[],
    options: ExportOptions,
    metadata: ExportMetadata
): string {

    const config = {
        sidebarMeta: metadata.sidebarMeta || '',
        logo: metadata.logo || '',
        alternateDesign: options.useAlternateDesign ?? false
    };

    console.log("[Export] Using dynamic skeleton template for export...");

    const tocListHtml = sortedArticles
        .filter(a => !isSpecialCategory(a.category))
        .map((a, i) => `<li class="toc-item"><span class="toc-title">${escapeHtml(a.title)}</span><span class="toc-dots"></span><span class="toc-page">${i + 1}</span></li>`)
        .join('');

    return getReaderSkeleton({
        sidebarMeta: config.sidebarMeta,
        logo: config.logo,
        tocListHtml,
        articlesJson: articlesB64,
        configJson: configB64,
        compressionMethod
    });
}

/**
 * 生成并导出离线阅读器 HTML 文件
 * 内部调用 generateReaderHTML 生成 HTML，然后直接下载 HTML 文件
 */
export async function exportReaderHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {},
    onProgress?: (percent: number, message?: string) => void
): Promise<void> {
    try {
        console.log('[Export] 开始生成阅读版 HTML...');
        onProgress?.(0, '开始导出...');

        const htmlContent = await generateReaderHTML(articles, options, metadata, onProgress);

        onProgress?.(95, '正在生成文件...');
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;

        const fileName = `SWS_工法情报_${dateStr}.html`;
        saveAs(blob, fileName);

        onProgress?.(100, '导出完成');
        console.log(`[Export] HTML 文件生成成功: ${fileName}`);
    } catch (error) {
        console.error('[Export] HTML 文件生成失败:', error);
        throw error;
    }
}
