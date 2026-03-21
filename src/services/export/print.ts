import { Article, CONSTANTS } from '../../../types';
import { getPrintableSkeleton } from './templates';
import { convertPdfToImages } from '../pdf';
import { processMediaForPrint } from './utils/media';
import { base64ToFile } from './utils/file';
import { ExportOptions, ExportMetadata } from './reader';


/**
 * 生成打印专用版 HTML
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

    // 2. 生成所有内容
    let bodyHtml = ''; // 移除硬编码的 CSS 注入，统一下放给模板引擎

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
            let processedContent = await processMediaForPrint(article.content || '');
            let pdfHtmlContent = '';

            // 处理 PDF 附件
            if (article.pdfData) {
                try {
                    const pdfFile = base64ToFile(article.pdfData, 'document.pdf');
                    const pdfImages = await convertPdfToImages(pdfFile);

                    // 关键修复：采用模板要求的 pdf-full-page 类名，防止高度逻辑冲突
                    pdfHtmlContent = pdfImages.map((imgData, idx) =>
                        `<div class="print-page-wrapper pdf-full-page">
                            <img src="${imgData}" alt="PDF Page ${idx + 1}" />
                        </div>`
                    ).join('');
                } catch (error) {
                    console.error('[Export] PDF转换失败:', error);
                    processedContent += `<div class="media-print-placeholder" style="margin: 30px 0; padding: 40px; border: 2px dashed #d1d5db; border-radius: 8px; text-align: center; background: #f9fafb;">
                        <p style="color: #6b7280; font-size: 14px; margin: 0;">📄 PDF文档转换失败，请查看阅读版获取完整PDF内容</p>
                    </div>`;
                }
            }

            // 常规文章 HTML
            articleHtml = `
            <div class="print-page-wrapper article-wrapper">
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
