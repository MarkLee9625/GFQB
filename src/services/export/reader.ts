import type { Article } from '../../types';
import { CONSTANTS } from '../../constants';
import { getReaderSkeleton } from './reader/readerSkeleton';
import { saveAs } from 'file-saver';
import { sortArticlesByPriority } from '../../utils/articleSort';
import { escapeHtml } from '../../utils/stringUtils';

export interface ExportOptions {
    useAlternateDesign?: boolean;
    includeImages?: boolean;
    optimizeForPrint?: boolean;
}

export interface ExportMetadata {
    logo?: string;
    sidebarMeta?: string;
    title?: string;
    date?: string;
}

interface WorkerRequest {
    type: 'START_EXPORT';
    articles: Article[];
    options: ExportOptions;
    metadata: ExportMetadata;
    companyInfo: typeof CONSTANTS.COMPANY_INFO;
}

interface WorkerResponse {
    type: 'EXPORT_COMPLETE';
    articlesB64: string;
    configB64: string;
    compressionMethod: string;
}

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
 * 优化深拷贝策略 - 分离大对象，减少 JS 侧深拷贝峰值
 *
 * 原理：
 * 1. pdfData、coverImage、backImage 是 Base64 字符串，体积巨大（可能数十MB）
 * 2. structuredClone 会对整个对象图进行深拷贝
 * 3. 如果直接深拷贝，内存峰值 = 原对象 + 拷贝对象 = 2x 原始内存
 *
 * 优化：
 * 1. 将大对象引用保存
 * 2. 清空后深拷贝轻量级元数据（标题、分类、标签等）
 * 3. 重新关联大对象引用（非拷贝）
 *
 * 注意：仅降低 JS 侧 structuredClone 的拷贝开销；
 * 后续 postMessage 传输 worker 时大字符串仍会被完整结构化克隆（字符串不可 transfer），
 * 传输阶段峰值仍约 2x。如需进一步降低，需将大字段抽出单独传输。
 */
function optimizeStructuredClone(article: Article): Article {
    const pdfDataRef = article.pdfData;
    const coverImageRef = article.coverImage;
    const backImageRef = article.backImage;

    const articleForClone: Omit<Article, 'pdfData' | 'coverImage' | 'backImage'> = {
        id: article.id,
        title: article.title,
        category: article.category,
        content: article.content,
        date: article.date,
        issueText: article.issueText,
        dateText: article.dateText,
        scale: article.scale,
        posX: article.posX,
        posY: article.posY,
        abstract: article.abstract,
        tags: article.tags,
        order: article.order
    };

    const cloned = structuredClone(articleForClone) as Article;

    cloned.pdfData = pdfDataRef;
    cloned.coverImage = coverImageRef;
    cloned.backImage = backImageRef;

    return cloned;
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
 * 将压缩数据注入阅读版模板。
 * 优先替换 <!--SWS_READER_DATA--> 锚点；兜底使用最后一个 </body>。
 * 必须使用函数式替换：替换串中若出现 $& / $' 等序列，String.replace 会按
 * 特殊模式展开，导致模板被复制进脚本中间并截断（历史踩坑，见 post-build.js）。
 */
function injectDataIntoReader(
    template: string,
    articlesB64: string,
    configB64: string,
    compressionMethod: string
): string {
    const safeArticlesB64 = articlesB64.replace(/<\//g, '<\\/');
    const safeConfigB64 = configB64.replace(/<\//g, '<\\/');

    const injectionScript = `
    <script>
    window.__SWS_DATA_ARTICLES_B64__ = "${safeArticlesB64}";
    window.__SWS_DATA_CONFIG_B64__ = "${safeConfigB64}";
    window.__SWS_COMPRESSION_METHOD__ = "${compressionMethod}";
    </script>
    `;

    if (template.includes('<!--SWS_READER_DATA-->')) {
        return template.replace('<!--SWS_READER_DATA-->', () => injectionScript);
    }
    const lastBodyIdx = template.lastIndexOf('</body>');
    if (lastBodyIdx !== -1) {
        return template.slice(0, lastBodyIdx) + injectionScript + template.slice(lastBodyIdx);
    }
    return template + injectionScript;
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
    const sortedArticles = sortArticlesByPriority(articles);

    console.log('[Export] 开始处理文章数据，保留PDF数据以支持离线阅读器...');
    const processedArticles = sortedArticles.map((article, idx) => {
        try {
            const articleCopy = optimizeStructuredClone(article);

            if (article.category === '封面' && !articleCopy.coverImage) {
                console.warn(`[Export] 文章 #${idx} "${article.title}" (封面) coverImage 为空`);
            }
            if (article.category === '封底' && !articleCopy.backImage) {
                console.warn(`[Export] 文章 #${idx} "${article.title}" (封底) backImage 为空`);
            }
            if (article.pdfData && !articleCopy.pdfData) {
                console.error(`[Export] 文章 #${idx} "${article.title}" pdfData 在优化拷贝后丢失！`);
            }

            return articleCopy;
        } catch (err) {
            console.warn(`[Export] 文章 "${article.title}" 优化拷贝失败，使用浅拷贝:`, err);
            return { ...article };
        }
    });
    console.log('[Export] 文章数据处理完成，PDF数据已保留，准备生成配置...');

    const config = {
        company: CONSTANTS.COMPANY_INFO,
        version: '1.0.0',
        alternateDesign: options.useAlternateDesign ?? false,
        logo: metadata.logo || '',
        sidebarMeta: metadata.sidebarMeta || ''
    };

    console.log('[Export] 开始 Web Worker 导出流程...');

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
                const { articlesB64, configB64, compressionMethod } = data;

                console.log('[Export] Worker 返回数据，准备生成 HTML...');

                (async () => {
                    try {
                        const readerTemplate = await loadReaderTemplate();
                        const htmlContent = readerTemplate
                            ? injectDataIntoReader(readerTemplate, articlesB64, configB64, compressionMethod)
                            : buildReaderHTML(articlesB64, configB64, compressionMethod, processedArticles, options, metadata);

                        worker.terminate();
                        resolve(htmlContent);
                    } catch (err) {
                        worker.terminate();
                        reject(err instanceof Error ? err : new Error(String(err)));
                    }
                })();
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
            articles: processedArticles,
            options,
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
    processedArticles: Article[],
    options: ExportOptions,
    metadata: ExportMetadata
): string {
    const config = {
        company: CONSTANTS.COMPANY_INFO,
        version: '1.0.0',
        alternateDesign: options.useAlternateDesign ?? false,
        logo: metadata.logo || '',
        sidebarMeta: metadata.sidebarMeta || ''
    };

    console.log("[Export] Using dynamic skeleton template for export...");

    const tocListHtml = processedArticles
        .filter(a => a.category !== '封面' && a.category !== '封底')
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
