import { Article, CONSTANTS } from '../../../types';
import { getReaderSkeleton } from './templates';

// 引入自动生成的模板 (运行 npm run build 后会更新此文件)
const READER_TEMPLATE = "SWS_READER_TEMPLATE_PLACEHOLDER" as string;

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

/**
 * 生成离线阅读器 HTML
 * 使用构建生成的 Single File App 作为模板，注入数据
 */
export async function generateReaderHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {}
): Promise<string> {
    // 1. 预处理文章 (排序)
    const sortedArticles = [...articles].sort((a, b) => {
        if (a.category === b.category) return 0;
        if (a.category === '封面') return -1;
        if (b.category === '封面') return 1;
        if (a.category === '封底') return 1;
        if (b.category === '封底') return -1;
        return 0;
    });

    // 2. 准备配置项
    const config = {
        company: CONSTANTS.COMPANY_INFO,
        version: '1.0.0',
        alternateDesign: options.useAlternateDesign ?? false,
        logo: metadata.logo || '',
        sidebarMeta: metadata.sidebarMeta || ''
    };

    const articlesJson = JSON.stringify(sortedArticles)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
    const configJson = JSON.stringify(config)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');

    // 3. 如果是开发模式 (模板未被替换)，则使用内置的 Skeleton 模板
    if (READER_TEMPLATE === "SWS_READER_TEMPLATE_PLACEHOLDER") {
        console.log("[Export] Using dynamic skeleton template for export...");

        // 生成简易目录 HTML
        const tocListHtml = sortedArticles
            .filter(a => a.category !== '封面' && a.category !== '封底')
            .map((a, i) => `<li class="toc-item"><span class="toc-title">${a.title}</span><span class="toc-dots"></span><span class="toc-page">${i + 1}</span></li>`)
            .join('');

        return getReaderSkeleton({
            sidebarMeta: config.sidebarMeta,
            logo: config.logo,
            tocListHtml,
            articlesJson,
            configJson
        });
    }

    // 4. 构建环境下，注入到编译好的 READER_TEMPLATE 中 (在 </body> 之前)
    const injectionScript = `
    <script>
    window.__SWS_DATA_ARTICLES__ = ${articlesJson};
    window.__SWS_DATA_CONFIG__ = ${configJson};
    </script>
    `;

    if (READER_TEMPLATE.includes('</body>')) {
        return READER_TEMPLATE.replace('</body>', injectionScript + '</body>');
    } else {
        return READER_TEMPLATE + injectionScript;
    }
}