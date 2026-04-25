import { Article } from '../../types/models';
import { CONSTANTS } from '../../constants';
import { getReaderSkeleton } from './templates';
import { saveAs } from 'file-saver';

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
 * 优化深拷贝策略 - 分离大对象，减少内存峰值
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
 * 内存峰值：~1.2x（少量临时对象 + 引用）
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
        isPublished: article.isPublished,
        order: article.order,
        fontSize: article.fontSize,
        lineHeight: article.lineHeight,
        blocks: article.blocks
    };

    const cloned = structuredClone(articleForClone);

    cloned.pdfData = pdfDataRef;
    cloned.coverImage = coverImageRef;
    cloned.backImage = backImageRef;

    return cloned;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const READER_TEMPLATE = "SWS_READER_TEMPLATE_PLACEHOLDER" as string;

/**
 * 生成离线阅读器 HTML
 * 使用构建生成的 Single File App 作为模板，注入数据
 */
export async function generateReaderHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {},
    onProgress?: (percent: number, message?: string) => void
): Promise<string> {
    const sortedArticles = [...articles].sort((a, b) => {
        if (a.category === b.category) return 0;
        if (a.category === '封面') return -1;
        if (b.category === '封面') return 1;
        if (a.category === '封底') return 1;
        if (b.category === '封底') return -1;
        return 0;
    });

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

            if (data.type === 'EXPORT_COMPLETE') {
                const { articlesB64, configB64, compressionMethod } = data;

                console.log('[Export] Worker 返回数据，准备生成 HTML...');

                const htmlContent = buildReaderHTML(
                    articlesB64,
                    configB64,
                    compressionMethod,
                    processedArticles,
                    options,
                    metadata
                );

                worker.terminate();
                resolve(htmlContent);
            }
        };

        worker.onerror = (error) => {
            worker.terminate();
            console.error('[Export] Worker 错误:', error);
            reject(error);
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

    if (READER_TEMPLATE === "SWS_READER_TEMPLATE_PLACEHOLDER") {
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

    const safeArticlesB64 = articlesB64.replace(/<\//g, '<\\/');
    const safeConfigB64 = configB64.replace(/<\//g, '<\\/');

    const injectionScript = `
    <script>
    window.__SWS_DATA_ARTICLES_B64__ = "${safeArticlesB64}";
    window.__SWS_DATA_CONFIG_B64__ = "${safeConfigB64}";
    window.__SWS_COMPRESSION_METHOD__ = "${compressionMethod}";
    </script>
    `;

    if (READER_TEMPLATE.includes('</body>')) {
        return READER_TEMPLATE.replace('</body>', injectionScript + '</body>');
    } else {
        return READER_TEMPLATE + injectionScript;
    }
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
