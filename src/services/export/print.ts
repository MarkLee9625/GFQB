import { Article } from '../../types/models';
import { CONSTANTS } from '../../constants';
import { getPrintableSkeleton } from './print/printableSkeleton';
import { convertPdfToImages } from '../pdf';
import { processMediaForPrint, inlineOnlineImages } from './utils/media';
import { base64ToFile, decodePdfBytes } from './utils/file';
import { ExportOptions, ExportMetadata } from './reader';
import { sortArticlesByPriority } from '../../utils/articleSort';
import { escapeHtml, escapeAttr, getPlainText } from '../../utils/stringUtils';

/** 正文判定阈值：去标签实体后超过此字数才算有实质正文（过滤空段落/残留符号） */
export const PRINT_BODY_TEXT_THRESHOLD = 10;
/** 文章级并发（每篇内部图片内联另有并发 4） */
export const PRINT_ARTICLE_CONCURRENCY = 3;
/** 整刊 PDF 光栅页数上限，超出后按顺序截断并明示 */
export const PRINT_MAX_TOTAL_PDF_PAGES = 150;

/**
 * 提取正文纯文本（供阈值判定）
 * @deprecated 请直接使用 `getPlainText`（utils/stringUtils），此处仅为兼容保留。
 */
export function getPrintablePlainText(html: string): string {
    return getPlainText(html);
}

/** 是否有实质性正文内容 */
export function hasPrintableBodyContent(processedHtml: string): boolean {
    return getPrintablePlainText(processedHtml).length > PRINT_BODY_TEXT_THRESHOLD;
}

interface ProcessedContentArticle {
    article: Article;
    tagsHtml: string;
    processedContent: string;
    hasContent: boolean;
    pdfImages: string[];
    pdfConversionFailed: boolean;
    pdfTruncated: boolean;
}

async function processContentArticle(
    article: Article,
    options: ExportOptions
): Promise<Omit<ProcessedContentArticle, 'pdfTruncated'> & { pdfTruncated: false }> {
    const tagsHtml = (article.tags || []).map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('');
    let processedContent = await processMediaForPrint(article.content || '');
    if (options.includeImages !== false) {
        processedContent = await inlineOnlineImages(processedContent);
    }
    const hasContent = hasPrintableBodyContent(processedContent);

    let pdfImages: string[] = [];
    let pdfConversionFailed = false;
    if (article.pdfData) {
        // 先做一次性兼容校验（DataURI / 裸 base64），避免 base64ToFile 抛错路径不一致
        const validBytes = decodePdfBytes(article.pdfData);
        if (!validBytes) {
            pdfConversionFailed = true;
        } else {
            try {
                const pdfFile = base64ToFile(article.pdfData, 'document.pdf', 'application/pdf');
                pdfImages = await convertPdfToImages(pdfFile);
            } catch (error) {
                pdfConversionFailed = true;
                console.error('[Export] PDF转换失败:', error);
            }
        }
    }
    return { article, tagsHtml, processedContent, hasContent, pdfImages, pdfConversionFailed, pdfTruncated: false as const };
}

function renderCover(article: Article, alternateDesign: boolean): string {
    const isMagazine = alternateDesign;
    const issueText = escapeHtml(article.issueText || 'NO.01');
    const dateText = escapeHtml(article.dateText || 'JAN 2025');
    const hasCover = !!article.coverImage;
    const coverImageHtml = hasCover
        ? `<img src="${escapeAttr(article.coverImage ?? '')}" alt="Cover" style="width:100%;height:100%;object-fit:cover;display:block;" />`
        : '<div class="cover-img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f3f4f6;">暂无封面图片</div>';
    // 背景模糊层在有封面图时完全被不透明的 cover-image-layer 遮住，去掉可省下一份 base64 体积
    const ambientStyle = hasCover ? '' : '';

    if (isMagazine) {
        return `
        <div class="print-page-wrapper cover-page">
            <div class="magazine-cover">
                <div class="magazine-bg-gradient"></div>
                <div class="cover-image-layer">${coverImageHtml}</div>
                <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.6) 100%);"></div>
                <div class="magazine-header">
                    <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                    <div class="magazine-header-divider"></div>
                    <h1 style="font-size:60px; color:#005596; margin:0; font-weight:900; letter-spacing:10px; text-shadow:0 1px 4px rgba(255,255,255,0.8);">工法情报</h1>
                    <div class="magazine-meta-container">
                        <div class="magazine-meta-badge">${issueText}</div>
                        <span style="color:rgba(0,85,150,0.4); font-size:12px;">•</span>
                        <div class="magazine-meta-badge">${dateText}</div>
                    </div>
                </div>
                <div class="magazine-footer"><div class="magazine-footer-text">OFFICIAL PUBLICATION</div></div>
            </div>
        </div>`;
    }
    return `
    <div class="print-page-wrapper cover-page">
        <div class="cover-root">
            <div class="tech-grid"></div>
            <div class="ambient-bg" style="${ambientStyle}"></div>
            <div class="cover-image-layer">${coverImageHtml}</div>
            <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.7) 100%);"></div>
            <div class="cover-header" style="padding:30px 50px;">
                <div class="cover-sub">Ship Construction Method Information</div>
                <h1 style="font-size:60px; color:#005596; margin:0; font-weight:900; letter-spacing:10px; text-shadow:0 1px 4px rgba(255,255,255,0.8);">工法情报</h1>
                <div class="cover-meta"><span>${issueText}</span> <span style="color:rgba(0,85,150,0.4); font-size:12px;">·</span> <span>${dateText}</span></div>
            </div>
            <div class="cover-footer"><div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px);opacity:0.6;"></div></div>
        </div>
    </div>`;
}

function renderBackCover(article: Article, alternateDesign: boolean, logo: string): string {
    const isMagazine = alternateDesign;
    const hasBack = !!article.backImage;
    const backImageHtml = hasBack
        ? `<img src="${escapeAttr(article.backImage ?? '')}" alt="Back" style="width:100%;height:100%;object-fit:cover;display:block;" />`
        : '<div class="cover-img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f3f4f6;">暂无封底图片</div>';
    const company = CONSTANTS.COMPANY_INFO;
    const ambientStyle = hasBack ? '' : '';

    if (isMagazine) {
        return `
        <div class="print-page-wrapper back-page">
            <div class="magazine-back-cover">
                <div class="magazine-back-bg"></div>
                <div class="cover-image-layer">${backImageHtml}</div>
                <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.7) 100%);"></div>
                <div class="magazine-back-header">
                    <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                    <div class="magazine-header-divider"></div>
                    <div class="magazine-back-title" style="color:#005596;text-shadow:0 2px 8px rgba(255,255,255,0.6);">Sailing With Success</div>
                </div>
                <div class="magazine-back-footer">
                    <div class="magazine-back-left">
                        <div class="magazine-back-company">${company.EN_SHORT}</div>
                        <div class="magazine-back-address">${company.EN_FULL}<br/>${company.ZH_FULL}</div>
                        <div class="magazine-back-copyright">© ${new Date().getFullYear()} Ship Construction Method</div>
                    </div>
                    <div class="magazine-back-right">
                        ${logo ? `<img src="${logo}" class="magazine-back-logo" />` : ''}
                        <div class="magazine-back-info">Official Publication<br/>Volume ${escapeHtml(article.issueText || '01')} · ${escapeHtml(article.dateText || 'JAN 2025')}</div>
                    </div>
                </div>
            </div>
        </div>`;
    }
    return `
    <div class="print-page-wrapper back-page">
        <div class="normal-back-root">
            <div class="tech-grid"></div>
            <div class="ambient-bg" style="${ambientStyle}"></div>
            <div class="cover-image-layer">${backImageHtml}</div>
            <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.8) 100%);"></div>
            <div class="normal-back-header" style="padding:30px 50px; z-index:3;">
                <div class="normal-back-sub" style="color:#005596; text-shadow:0 1px 3px rgba(255,255,255,0.8);">Ship Construction Method Information</div>
                <h1 class="normal-back-title" style="color:#005596; -webkit-text-fill-color:#005596; background:none; text-shadow:0 1px 4px rgba(255,255,255,0.8);">Sailing With Success</h1>
            </div>
            <div class="normal-back-footer" style="position:absolute; bottom:0; left:0; right:0; z-index:3; padding:0 50px 25px;">
                <div class="normal-back-left">
                    <div class="normal-back-company-short" style="color:rgba(0,85,150,0.7);">${company.EN_SHORT}</div>
                    <div class="normal-back-company-full" style="color:rgba(0,85,150,0.5);">${company.ZH_FULL}</div>
                </div>
                <div class="normal-back-right">
                    ${logo ? `<img src="${logo}" class="normal-back-logo" style="height:20px; width:auto; filter:brightness(0) saturate(100%) invert(28%) sepia(98%) saturate(1235%) hue-rotate(190deg); opacity:0.8;" />` : ''}
                </div>
            </div>
        </div>
    </div>`;
}

function renderPdfPages(articleId: number, images: string[]): string {
    return images.map((imgData, idx) =>
        `<div class="print-page-wrapper pdf-full-page" data-article-id="${articleId}" data-pdf-index="${idx}">
            <img src="${imgData}" alt="PDF Page ${idx + 1}" />
        </div>`
    ).join('');
}

function renderContentArticle(p: ProcessedContentArticle, logo: string): string {
    const { article, tagsHtml, processedContent, hasContent, pdfImages, pdfConversionFailed, pdfTruncated } = p;
    const pdfHtmlContent = renderPdfPages(article.id, pdfImages);
    const truncateNotice = pdfTruncated
        ? `<div class="media-print-placeholder" style="margin: 20px 0; padding: 24px; border: 2px dashed #d1d5db; border-radius: 8px; text-align: center; background: #f9fafb;">
                <p style="color: #6b7280; font-size: 13px; margin: 0;">📄 PDF 页数超出整刊上限，仅打印前 ${pdfImages.length} 页，请查看原文件获取完整内容</p>
            </div>`
        : '';

    // 纯 PDF（无正文）：有摘要则保留标题头，无摘要才直接输出图片
    if (article.pdfData && !hasContent) {
        if (pdfImages.length > 0 && !article.abstract) {
            return pdfHtmlContent + truncateNotice;
        }
        if (pdfImages.length > 0 && article.abstract) {
            return `
            <div class="print-page-wrapper article-wrapper" data-article-id="${article.id}" data-pdf-pages="${pdfImages.length}">
                <div class="normal-container">
                    <div class="article-header">
                        <h1>${escapeHtml(article.title)}</h1>
                        <div class="article-meta"><div class="tag-cloud">${tagsHtml}</div></div>
                    </div>
                    <div class="summary-card"><div class="summary-label">摘要</div><p>${escapeHtml(article.abstract)}</p></div>
                    ${truncateNotice}
                    <div class="article-footer-knowledge-base">
                        ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                        SWS KNOWLEDGE BASE
                    </div>
                </div>
            </div>` + pdfHtmlContent;
        }
        return `<div class="print-page-wrapper article-wrapper" data-article-id="${article.id}" data-pdf-pages="0"><div class="normal-container" style="text-align:center;padding:40px;"><p style="color:#999;font-size:13px;margin:0;">📄 PDF 转换失败，请查看原文件获取完整内容</p></div></div>`;
    }

    return `
    <div class="print-page-wrapper article-wrapper" data-article-id="${article.id}" data-pdf-pages="${pdfImages.length}">
        <div class="normal-container">
            <div class="article-header">
                <h1>${escapeHtml(article.title)}</h1>
                <div class="article-meta">
                    <div class="tag-cloud">${tagsHtml}</div>
                </div>
            </div>
            ${article.abstract ? `<div class="summary-card"><div class="summary-label">摘要</div><p>${escapeHtml(article.abstract)}</p></div>` : ''}
            ${hasContent ? `<div class="sws-prose">${processedContent}</div>` : ''}
            ${pdfConversionFailed ? `<div class="media-print-placeholder" style="margin: 30px 0; padding: 40px; border: 2px dashed #d1d5db; border-radius: 8px; text-align: center; background: #f9fafb;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">📄 PDF文档转换失败，请查看原文件获取完整PDF内容</p>
            </div>` : ''}
            ${truncateNotice}
            <div class="article-footer-knowledge-base">
                ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                SWS KNOWLEDGE BASE
            </div>
            ${hasContent ? `<div class="article-end-mark">- End of Article -</div>` : ''}
        </div>
    </div>` + pdfHtmlContent;
}

/**
 * 生成打印专用版 HTML（打印专用版 → 浏览器打印/另存为 PDF 的唯一路线）
 *
 * 两遍式：先并发处理正文并拿到每篇 PDF 页数，再生成目录并预填起始页码，
 * 客户端脚本按 `data-target-id` 回填校准，不再按下标一一对应。
 */
export async function generatePrintableHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {},
    onProgress?: (done: number, total: number) => void
): Promise<string> {
    const sortedArticles = sortArticlesByPriority(articles);

    const alternateDesign = options.useAlternateDesign ?? false;
    const logo = metadata.logo || '';

    const covers = sortedArticles.filter(a => a.category === '封面');
    const backs = sortedArticles.filter(a => a.category === '封底');
    const contents = sortedArticles.filter(a => a.category !== '封面' && a.category !== '封底');

    // 第一遍：并发处理正文（保持原顺序组装）
    const processed: ProcessedContentArticle[] = new Array(contents.length);
    onProgress?.(0, contents.length);
    let finished = 0;
    for (let i = 0; i < contents.length; i += PRINT_ARTICLE_CONCURRENCY) {
        const batch = contents.slice(i, i + PRINT_ARTICLE_CONCURRENCY);
        await Promise.all(batch.map(async (article, bi) => {
            const r = await processContentArticle(article, options);
            processed[i + bi] = { ...r, pdfTruncated: false };
            finished += 1;
            onProgress?.(finished, contents.length);
        }));
    }

    // 刊级 PDF 页数预算：按顺序截断，保证目录页码与实际输出一致
    let pdfBudget = PRINT_MAX_TOTAL_PDF_PAGES;
    for (const p of processed) {
        if (p.pdfImages.length > pdfBudget) {
            p.pdfImages = p.pdfImages.slice(0, Math.max(0, pdfBudget));
            p.pdfTruncated = true;
        }
        pdfBudget = Math.max(0, pdfBudget - p.pdfImages.length);
    }

    // 第二遍：目录（预填起始页：封面各 1 页 + 目录 1 页；正文至少 1 页 + PDF 实页）
    let tocHtml = '';
    if (processed.length > 0) {
        let currentPage = covers.length + 2; // 封面 N 页 + 目录 1 页，首篇正文从此开始
        if (covers.length === 0) currentPage = 2; // 无封面：目录第 1 页，首篇第 2 页
        const tocItems = processed.map(p => {
            const startPage = currentPage;
            const bodyPages = p.hasContent || p.article.abstract ? 1 : 0;
            currentPage += bodyPages + p.pdfImages.length;
            // 纯图片 PDF 无头 wrapper 也至少占其实页数；失败占位占 1 页已含在 bodyPages 中
            if (!p.hasContent && !p.article.abstract && p.pdfImages.length > 0) {
                // bodyPages 为 0，上面已只加 pdf 页数，无需调整
            }
            return `
            <li class="toc-item" data-target-id="${p.article.id}">
                <span class="toc-title">${escapeHtml(p.article.title)}</span>
                <span class="toc-dots"></span>
                <span class="toc-page-number">${startPage}</span>
            </li>`;
        }).join('');
        tocHtml = `
        <div class="print-page-wrapper toc-page" style="display:block !important;">
            <div class="toc-container">
                <div class="toc-header">
                    <h1>目 录</h1>
                    <div style="font-size:12px; color:#666; margin-top:5px; letter-spacing:2px;">CONTENTS</div>
                </div>
                <ul class="toc-list">${tocItems}</ul>
                <div style="font-size:11px;color:#999;text-align:center;margin-top:24px;">页码以实际打印为准</div>
            </div>
        </div>`;
    }

    let bodyHtml = '';
    let firstContentMarked = false;
    const markFirst = (html: string): string => {
        if (firstContentMarked) return html;
        firstContentMarked = true;
        return html.replace('print-page-wrapper ', 'print-page-wrapper first-page ');
    };

    for (const c of covers) bodyHtml += renderCover(c, alternateDesign);
    if (tocHtml) bodyHtml += markFirst(tocHtml);
    for (const p of processed) bodyHtml += markFirst(renderContentArticle(p, logo));
    // 无封面无目录时首篇正文即第一页，markFirst 已处理；有封面时首个内容块仍需取消 break-before
    for (const b of backs) bodyHtml += renderBackCover(b, alternateDesign, logo);

    const coverForName = covers[0];
    const docTitle = coverForName
        ? `打印专用版-${coverForName.issueText || 'NO.01'}-${coverForName.dateText || ''}`
        : '打印专用版-工法情报';

    return getPrintableSkeleton({ contentHtml: bodyHtml, title: docTitle });
}
