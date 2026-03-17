import { Article, CONSTANTS } from '../../../types';
import { getReaderSkeleton, getPrintableSkeleton } from './templates';
import { convertPdfToImages } from '../pdf';

// 引入自动生成的模板 (运行 npm run build 后会更新此文件)
const READER_TEMPLATE = "SWS_READER_TEMPLATE_PLACEHOLDER" as string;

export const APP_CONFIG = {
    company: CONSTANTS.COMPANY_INFO,
    version: '1.0.0'
};

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

function encodeContent(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
}

/**
 * 将base64字符串转换为File对象
 */
function base64ToFile(base64: string, filename: string): File {
    try {
        let mime = 'application/pdf';
        let bstr: string;

        if (base64.includes('base64,')) {
            const arr = base64.split(',');
            mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
            bstr = atob(arr[1]);
        } else {
            // 如果是纯 Base64 字符串
            bstr = atob(base64);
        }

        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    } catch (error) {
        console.error('[Export] base64ToFile 转换失败:', error);
        throw error;
    }
}

/**
 * 从视频URL提取第一帧作为base64图片
 */
async function extractVideoFirstFrame(videoUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        video.onloadeddata = () => {
            // 设置时间为0.1秒，确保加载了有效帧
            video.currentTime = 0.1;
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法获取Canvas上下文'));
                    return;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64Image = canvas.toDataURL('image/jpeg', 0.8);
                resolve(base64Image);
            } catch (error) {
                console.error('提取视频首帧失败:', error);
                reject(error);
            } finally {
                video.src = '';
                video.load();
            }
        };

        video.onerror = () => {
            reject(new Error('视频加载失败'));
        };

        // 设置超时
        setTimeout(() => {
            reject(new Error('视频首帧提取超时'));
        }, 5000);

        video.src = videoUrl;
    });
}

/**
 * 从GIF URL提取第一帧作为base64图片
 */
async function extractGifFirstFrame(gifUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法获取Canvas上下文'));
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const base64Image = canvas.toDataURL('image/png', 0.9);
                resolve(base64Image);
            } catch (error) {
                console.error('提取GIF首帧失败:', error);
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('GIF加载失败'));
        };

        // 设置超时
        setTimeout(() => {
            reject(new Error('GIF首帧提取超时'));
        }, 3000);

        img.src = gifUrl;
    });
}

/**
 * 处理文章内容，将视频和GIF替换为首帧图片
 */
async function processMediaForPrint(content: string): Promise<string> {
    let processedContent = content;

    // 1. 处理视频标签
    const videoRegex = /<video[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/video>/gi;
    const videoMatches = Array.from(content.matchAll(videoRegex));

    for (const match of videoMatches) {
        const videoTag = match[0];
        const videoSrc = match[1];

        try {
            console.log('正在提取视频首帧:', videoSrc);
            const firstFrameBase64 = await extractVideoFirstFrame(videoSrc);
            const imgTag = `<img src="${firstFrameBase64}" alt="视频首帧" style="max-width: 100%; height: auto; display: block; margin: 20px auto; border: 2px solid #e5e7eb; border-radius: 8px;" />`;
            processedContent = processedContent.replace(videoTag, imgTag);
        } catch (error) {
            console.warn('视频首帧提取失败，使用占位符:', error);
            // 使用占位符
            const placeholder = `<div class="media-print-placeholder"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><polygon points="10 8 16 12 10 16 10 8"></polygon></svg><div style="margin-top: 10px; color: #666; font-size: 14px;">此处为视频资源，请查阅电子版</div></div>`;
            processedContent = processedContent.replace(videoTag, placeholder);
        }
    }

    // 2. 处理GIF图片（检测.gif扩展名）
    const gifRegex = /<img[^>]*src=["']([^"']+\.gif[^"']*)["'][^>]*>/gi;
    const gifMatches = Array.from(content.matchAll(gifRegex));

    for (const match of gifMatches) {
        const imgTag = match[0];
        const gifSrc = match[1];

        try {
            console.log('正在提取GIF首帧:', gifSrc);
            const firstFrameBase64 = await extractGifFirstFrame(gifSrc);
            // 替换src，保持其他属性
            const newImgTag = imgTag.replace(/src=["'][^"']+["']/, `src="${firstFrameBase64}"`);
            processedContent = processedContent.replace(imgTag, newImgTag);
        } catch (error) {
            console.warn('GIF首帧提取失败，保留原图:', error);
            // 保留原GIF
        }
    }

    // 3. 彻底清洗富文本数据，开启双维约束，并剥离原生宽高
    const imgRegexAll = /<img([^>]*)>/gi;
    processedContent = processedContent.replace(imgRegexAll, (match, attrs) => {
        // 暴力剥离原生 width 和 height 属性
        let cleanAttrs = attrs.replace(/\b(width|height)=["']?\d+["']?/gi, '');
        
        if (/style=["']([^"']*)["']/i.test(cleanAttrs)) {
            cleanAttrs = cleanAttrs.replace(/style=["']([^"']*)["']/i, 'style="$1; max-width: 100% !important; max-height: 280mm !important; width: auto !important; height: auto !important; box-sizing: border-box; object-fit: contain;"');
        } else {
            cleanAttrs += ' style="max-width: 100% !important; max-height: 280mm !important; width: auto !important; height: auto !important; box-sizing: border-box; object-fit: contain;"';
        }
        return `<img${cleanAttrs}>`;
    });

    return processedContent;
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
        ...APP_CONFIG,
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

/**
 * 生成打印专用版 HTML
 * 这是一个线性排版的长页面，完全去除了冗余的 JS 交互和懒加载
 */
export async function generatePrintableHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {}
): Promise<string> {
    const sortedArticles = [...articles].sort((a, b) => {
        if (a.category === b.category) return 0;
        if (a.category === '封面') return -1;
        if (b.category === '封面') return 1;
        if (a.category === '封底') return 1;
        if (b.category === '封底') return -1;
        return 0;
    });

    const alternateDesign = options.useAlternateDesign ?? false;
    const logo = metadata.logo || '';

    // 1. 生成目录
    const tocItems = sortedArticles
        .filter(a => a.category !== '封面' && a.category !== '封底')
        .map((a, i) => `
            <li class="toc-item">
                <span class="toc-title">${a.title}</span>
                <span class="toc-dots"></span>
                <span class="toc-page-number">${i + 1}</span>
            </li>
        `).join('');

    const tocHtml = `
        <div class="print-page-wrapper toc-page" style="display:block !important;">
            <div class="toc-container">
                <div class="toc-header">
                    <h1>目 录</h1>
                    <div style="font-size:12px; color:#666; margin-top:5px; letter-spacing:2px;">CONTENTS</div>
                </div>
                <ul class="toc-list">${tocItems}</ul>
            </div>
        </div>
    `;

    // 2. 生成所有文章内容
    let bodyHtml = '';

    for (const article of sortedArticles) {
        let articleHtml = '';

        if (article.category === '封面') {
            const isMagazine = alternateDesign;
            const issueText = article.issueText || 'NO.01';
            const dateText = article.dateText || 'JAN 2025';
            const coverImage = article.coverImage ? `<img src="${article.coverImage}" class="${isMagazine ? 'magazine-image' : 'cover-img'}" alt="Cover" />` : '<div class="cover-img-placeholder">暂无封面图片</div>';

            if (isMagazine) {
                articleHtml = `
                <div class="print-page-wrapper">
                    <div class="magazine-cover">
                        <div class="magazine-bg-gradient"></div>
                        <div class="magazine-header">
                            <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                            <div class="magazine-header-divider"></div>
                            <h1 style="font-size: 60px; color:#005596; margin:0; font-weight:900; letter-spacing:10px;">工法情报</h1>
                            <div class="magazine-meta-container">
                                <div class="magazine-meta-badge">${issueText}</div>
                                <span style="color:#00559680; font-size:12px;">•</span>
                                <div class="magazine-meta-badge">${dateText}</div>
                            </div>
                        </div>
                        <div class="magazine-image-container">${coverImage}</div>
                        <div class="magazine-footer"><div class="magazine-footer-text">OFFICIAL PUBLICATION</div></div>
                    </div>
                </div>`;
            } else {
                articleHtml = `
                <div class="print-page-wrapper">
                    <div class="cover-root">
                        <div class="tech-grid"></div>
                        <div class="ambient-bg" style="${article.coverImage ? `background-image:url(${article.coverImage});` : ''}"></div>
                        <div class="cover-header">
                            <div class="cover-sub">Ship Construction Method Information</div>
                            <h1 style="font-size: 60px; color:#005596; margin:0; font-weight:900; letter-spacing:10px;">工法情报</h1>
                            <div class="cover-meta"><span>${issueText}</span> <span style="color:#666; font-size:12px;">·</span> <span>${dateText}</span></div>
                        </div>
                        <div class="cover-img-box">${coverImage}</div>
                        <div class="cover-footer"><div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px);opacity:0.4;"></div></div>
                    </div>
                </div>`;
            }
        } else if (article.category === '封底') {
            const isMagazine = alternateDesign;
            const backImage = article.backImage ? `<img src="${article.backImage}" class="${isMagazine ? 'magazine-back-image' : 'cover-img'}" alt="Back" />` : '<div class="cover-img-placeholder">暂无封底图片</div>';
            const company = CONSTANTS.COMPANY_INFO;

            if (isMagazine) {
                articleHtml = `
                <div class="print-page-wrapper">
                    <div class="magazine-back-cover">
                        <div class="magazine-back-bg"></div>
                        <div class="magazine-back-header">
                            <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                            <div class="magazine-header-divider"></div>
                            <div class="magazine-back-title">Sailing With Success</div>
                        </div>
                        <div class="magazine-back-image-container">${backImage}</div>
                        <div class="magazine-back-footer">
                            <div class="magazine-back-left">
                                <div class="magazine-back-company">${company.EN_SHORT}</div>
                                <div class="magazine-back-address">${company.EN_FULL}<br/>${company.ZH_FULL}</div>
                                <div class="magazine-back-copyright">© 2025 Ship Construction Method</div>
                            </div>
                            <div class="magazine-back-right">
                                ${logo ? `<img src="${logo}" class="magazine-back-logo" />` : ''}
                                <div class="magazine-back-info">Official Publication<br/>Volume ${article.issueText || '01'} · ${article.dateText || 'JAN 2025'}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            } else {
                articleHtml = `
                <div class="print-page-wrapper">
                    <div class="normal-back-root">
                        <div class="tech-grid"></div>
                        <div class="ambient-bg" style="${article.backImage ? `background-image:url(${article.backImage});` : ''}"></div>
                        <div class="normal-back-header">
                            <div class="normal-back-sub">Ship Construction Method Information</div>
                            <h1 class="normal-back-title">Sailing With Success</h1>
                        </div>
                        <div class="cover-img-box">${backImage}</div>
                        <div class="normal-back-footer">
                            <div class="normal-back-left">
                                <div class="normal-back-company-short">${company.EN_SHORT}</div>
                                <div class="normal-back-company-full">${company.ZH_FULL}</div>
                            </div>
                            <div class="normal-back-right">
                                ${logo ? `<img src="${logo}" class="normal-back-logo" style="height:20px; width:auto;" />` : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        } else {
            // 正文文章
            const tagsHtml = (article.tags || []).map(t => `<span class="tag-item">${t}</span>`).join('');

            // 处理文章内容中的视频和GIF，提取首帧
            let processedContent = await processMediaForPrint(article.content || '');

            // 【P0核心功能】处理PDF附件：转换为图片
            if (article.pdfData) {
                try {
                    console.log('[Export] 检测到PDF附件，开始转换为图片...');
                    const pdfFile = base64ToFile(article.pdfData, 'document.pdf');
                    const pdfImages = await convertPdfToImages(pdfFile);

                    console.log(`[Export] PDF转换成功，共${pdfImages.length}页`);

// 生成PDF图片HTML - 修复DPI缩放溢出问题（强化边界约束）
const pdfImagesHtml = pdfImages.map((imgData, idx) =>
    `<div class="pdf-page-container" style="width: 100%; max-width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <img src="${imgData}" class="pdf-page-image" alt="PDF Page ${idx + 1}" style="max-width: 100% !important; max-height: 285mm !important; width: auto !important; height: auto !important; display: block; margin: 0 auto; box-sizing: border-box; object-fit: contain; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" />
    </div>`
).join('');

                    // 将PDF图片追加到内容末尾
                    processedContent += pdfImagesHtml;
                } catch (error) {
                    console.error('[Export] PDF转换失败:', error);
                    // 【P1错误处理】使用占位符降级
                    processedContent += `<div class="media-print-placeholder" style="margin: 30px 0; padding: 40px; border: 2px dashed #d1d5db; border-radius: 8px; text-align: center; background: #f9fafb;">
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" style="margin: 0 auto 15px;">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>
                        </svg>
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">📄 PDF文档转换失败，请查看阅读版获取完整PDF内容</p>
                        <p style="color: #9ca3af; font-size: 12px; margin-top: 8px;">${error instanceof Error ? error.message : '未知错误'}</p>
                    </div>`;
                }
            }

            articleHtml = `
            <div class="print-page-wrapper article-wrapper" style="display:block !important;">
                <div class="normal-container">
                    <div class="article-header">
                        <h1>${article.title}</h1>
                        <div class="article-meta">
                            <div class="tag-cloud">${tagsHtml}</div>
                            <span>分类: ${article.category}</span>
                        </div>
                    </div>
                    ${article.abstract ? `<div class="summary-card"><div class="summary-label">摘要</div><p>${article.abstract}</p></div>` : ''}
                    <div class="sws-prose">${processedContent}</div>
                    <div class="article-footer-knowledge-base">
                        ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                    </div>
                    <div class="article-end-mark">- End of Article -</div>
                </div>
            </div>`;
        }

        bodyHtml += articleHtml;

        // 如果是封面，封面后紧跟目录
        if (article.category === '封面') {
            bodyHtml += tocHtml;
        }
    }

    return getPrintableSkeleton({
        contentHtml: bodyHtml
    });
}

/**
 * 导出项目数据 (用于备份或迁移)
 */
export function generateExportHtml(articles: Article[], config: any): string {
    const data = {
        articles,
        config,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>SWS Project Export</title>
</head>
<body>
    <div id="export-data" style="display:none;">${encodeContent(JSON.stringify(data))}</div>
    <script>
        console.log("Project data exported successfully.");
        // 可以添加一些简单的预览逻辑
    </script>
</body>
</html>`;
}
