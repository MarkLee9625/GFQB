import { Article } from '../../types/models';
import { CONSTANTS } from '../../constants';
import { getPrintableSkeleton } from './print/printableSkeleton';
import { convertPdfToImages } from '../pdf';
import { processMediaForPrint, inlineOnlineImages } from './utils/media';
import { base64ToFile } from './utils/file';
import { ExportOptions, ExportMetadata } from './reader';
import { sortArticlesByPriority } from '../../utils/articleSort';
import { escapeHtml, escapeAttr } from '../../utils/stringUtils';


/**
 * 生成打印专用版 HTML
 */
export async function generatePrintableHTML(
    articles: Article[],
    options: ExportOptions = {},
    metadata: ExportMetadata = {}
): Promise<string> {
    const sortedArticles = sortArticlesByPriority(articles);

    const alternateDesign = options.useAlternateDesign ?? false;
    const logo = metadata.logo || '';

    // 1. 生成目录
    const tocItems = sortedArticles
        .filter(a => a.category !== '封面' && a.category !== '封底')
        .map((a, i) => `
            <li class="toc-item" data-toc-index="${i}">
                <span class="toc-title">${escapeHtml(a.title)}</span>
                <span class="toc-dots"></span>
                <span class="toc-page-number"></span>
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

    // 2. 生成所有内容
    let bodyHtml = ''; // 移除硬编码的 CSS 注入，统一下放给模板引擎

    for (const article of sortedArticles) {
        let articleHtml = '';

        if (article.category === '封面') {
            const isMagazine = alternateDesign;
            const issueText = article.issueText || 'NO.01';
            const dateText = article.dateText || 'JAN 2025';
            const hasCover = !!article.coverImage;
            const coverImageHtml = hasCover
                ? `<img src="${escapeAttr(article.coverImage ?? "")}" alt="Cover" style="width:100%;height:100%;object-fit:cover;display:block;" />`
                : '<div class="cover-img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f3f4f6;">暂无封面图片</div>';

            if (isMagazine) {
                articleHtml = `
                <div class="print-page-wrapper">
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
            } else {
                articleHtml = `
                <div class="print-page-wrapper">
                    <div class="cover-root">
                        <div class="tech-grid"></div>
                        <div class="ambient-bg" style="${article.coverImage ? `background-image:url(${escapeAttr(article.coverImage)});` : ''}"></div>
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
        } else if (article.category === '封底') {
            const isMagazine = alternateDesign;
            const hasBack = !!article.backImage;
            const backImageHtml = hasBack
                ? `<img src="${escapeAttr(article.backImage ?? "")}" alt="Back" style="width:100%;height:100%;object-fit:cover;display:block;" />`
                : '<div class="cover-img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f3f4f6;">暂无封底图片</div>';
            const company = CONSTANTS.COMPANY_INFO;

            if (isMagazine) {
                articleHtml = `
                <div class="print-page-wrapper">
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
                        <div class="ambient-bg" style="${article.backImage ? `background-image:url(${escapeAttr(article.backImage)});` : ''}"></div>
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
        } else {
            // 正文文章
            const tagsHtml = (article.tags || []).map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join('');
            let processedContent = await processMediaForPrint(article.content || '');
            if (options.includeImages !== false) {
                processedContent = await inlineOnlineImages(processedContent);
            }
            let pdfHtmlContent = '';

            // 处理 PDF 附件
            let pdfConversionFailed = false;
            if (article.pdfData) {
                try {
                    const pdfFile = base64ToFile(article.pdfData, 'document.pdf');
                    const pdfImages = await convertPdfToImages(pdfFile);

                    pdfHtmlContent = pdfImages.map((imgData, idx) =>
                        `<div class="print-page-wrapper pdf-full-page">
                            <img src="${imgData}" alt="PDF Page ${idx + 1}" />
                        </div>`
                    ).join('');
                } catch (error) {
                    pdfConversionFailed = true;
                    console.error('[Export] PDF转换失败:', error);
                }
            }

            // 判断文章是否有实质性正文内容（解码 HTML 实体后去标签 > 80 字才算有内容）
            const rawText = processedContent
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&[a-z]+;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const hasContent = rawText.length > 80;

            // === 纯 PDF 文章（无正文）===
            if (article.pdfData && !hasContent) {
                if (pdfHtmlContent.length > 0) {
                    // PDF 转换成功：直接输出 PDF 页面图片，不包装任何壳
                    articleHtml = pdfHtmlContent;
                } else {
                    // PDF 转换失败：只输出一行提示，无壳、无结束标记
                    articleHtml = `<div class="print-page-wrapper article-wrapper"><div class="normal-container" style="text-align:center;padding:40px;"><p style="color:#999;font-size:13px;margin:0;">📄 PDF 转换失败，请在阅读版中查看</p></div></div>`;
                }
                bodyHtml += articleHtml;
                continue; // 跳过后续 bodyHtml 拼接（已在上面提前拼好），直接进入下一篇
            }

            // === 常规文章 HTML ===
            articleHtml = `
            <div class="print-page-wrapper article-wrapper">
                <div class="normal-container">
                    <div class="article-header">
                        <h1>${escapeHtml(article.title)}</h1>
                        <div class="article-meta">
                            <div class="tag-cloud">${tagsHtml}</div>
                        </div>
                    </div>
                    ${article.abstract && !pdfConversionFailed ? `<div class="summary-card"><div class="summary-label">摘要</div><p>${escapeHtml(article.abstract)}</p></div>` : ''}
                    ${hasContent ? `<div class="sws-prose">${processedContent}</div>` : ''}
                    ${pdfConversionFailed ? `<div class="media-print-placeholder" style="margin: 30px 0; padding: 40px; border: 2px dashed #d1d5db; border-radius: 8px; text-align: center; background: #f9fafb;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">📄 PDF文档转换失败，请查看阅读版获取完整PDF内容</p>
                    </div>` : ''}
                    <div class="article-footer-knowledge-base">
                        ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                        SWS KNOWLEDGE BASE
                    </div>
                    ${hasContent ? `<div class="article-end-mark">- End of Article -</div>` : ''}
                </div>
            </div>`;

            // 将 PDF 页面衔接在文章末尾
            articleHtml += pdfHtmlContent;
        }
        bodyHtml += articleHtml;

        // 如果是封面，封面后紧跟目录
        if (article.category === '封面') {
            bodyHtml += tocHtml;
        }
    }

    // 最终生成
    return getPrintableSkeleton({
        contentHtml: bodyHtml
    });
}
