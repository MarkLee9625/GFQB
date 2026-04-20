import { Article } from '../../types/models';
import { CONSTANTS } from '../../constants';
import { getReaderSkeleton } from './templates';
import { saveAs } from 'file-saver';
import { compressData, uint8ArrayToBase64 } from './compression';

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

    // 2. 处理文章数据，保持 PDF 数据以便在离线阅读器中显示
    console.log('[Export] 开始处理文章数据，保留PDF数据以支持离线阅读器...');
    const processedArticles = sortedArticles.map((article, idx) => {
        try {
            const articleCopy = structuredClone ? structuredClone(article) : JSON.parse(JSON.stringify(article));
            
            if (article.category === '封面' && !articleCopy.coverImage) {
                console.warn(`[Export] 文章 #${idx} "${article.title}" (封面) coverImage 为空`);
            }
            if (article.category === '封底' && !articleCopy.backImage) {
                console.warn(`[Export] 文章 #${idx} "${article.title}" (封底) backImage 为空`);
            }
            if (article.pdfData && !articleCopy.pdfData) {
                console.error(`[Export] 文章 #${idx} "${article.title}" pdfData 在深拷贝后丢失！`);
            }
            
            return articleCopy;
        } catch (err) {
            console.warn(`[Export] 文章 "${article.title}" 深拷贝失败，使用浅拷贝:`, err);
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

    console.log('[Export] 开始进行 JSON 序列化 (这是消耗内存的大户)...');
    console.time('json-stringify');
    
    // 【性能优化】直接使用 stringify 生成大字符串
    const rawArticlesJson = JSON.stringify(processedArticles);
    console.timeEnd('json-stringify');
    console.log(`[Export] 序列化完成，字符串长度: ${(rawArticlesJson.length / 1024 / 1024).toFixed(2)} MB。`);
    
    console.time('compress-data');
    const articlesResult = await compressData(rawArticlesJson, 'gzip');
    const articlesB64 = uint8ArrayToBase64(articlesResult.data);
    
    const configJson = JSON.stringify(config);
    const configResult = await compressData(configJson, 'gzip');
    const configB64 = uint8ArrayToBase64(configResult.data);

    const compressionMethod = articlesResult.method === 'none' && configResult.method === 'none' ? 'none' : articlesResult.method;

    console.timeEnd('compress-data');
    console.log(`[Export] 数据压缩完成，原始大小: ${(rawArticlesJson.length / 1024 / 1024).toFixed(2)} MB，压缩后: ${(articlesResult.data.length / 1024 / 1024).toFixed(2)} MB，压缩率: ${((articlesResult.data.length / rawArticlesJson.length) * 100).toFixed(1)}%`);
    console.log(`[Export] 数据 Base64 转码完成。正在拼装 HTML...`);

    // 4. 如果是开发模式 (模板未被替换)，则使用内置的 Skeleton 模板
    if (READER_TEMPLATE === "SWS_READER_TEMPLATE_PLACEHOLDER") {
        console.log("[Export] Using dynamic skeleton template for export...");

        // 生成简易目录 HTML
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

    // 5. 构建环境下，注入到编译好的 READER_TEMPLATE 中 (在 </body> 之前)
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
    metadata: ExportMetadata = {}
): Promise<void> {
    try {
        console.log('[Export] 开始生成阅读版 HTML...');
        
        // 1. 生成 HTML 内容
        const htmlContent = await generateReaderHTML(articles, options, metadata);
        
        // 2. 创建 Blob 并下载
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        
        // 获取当前日期，用于文件名
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        
        // 3. 使用 file-saver 保存文件
        const fileName = `SWS_工法情报_${dateStr}.html`;
        saveAs(blob, fileName);
        
        console.log(`[Export] HTML 文件生成成功: ${fileName}`);
    } catch (error) {
        console.error('[Export] HTML 文件生成失败:', error);
        throw error;
    }
}



