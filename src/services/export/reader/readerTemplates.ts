﻿﻿import { SHARED_STYLES, MAGAZINE_STYLES, PRINT_STYLES, MISC_STYLES, SEASONAL_STYLES, SVG_ICONS } from '../assets';

export function getReaderTemplates() {
    return `
    <template id="tpl-magazine-cover">
        <div class="magazine-cover">
            <div class="magazine-bg-gradient"></div>
            <div class="magazine-header">
                <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                <div class="magazine-header-divider"></div>
                <div class="relative">
                    <svg class="magazine-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:400px;">
                        <defs><linearGradient id="magazineTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596; stop-opacity:1" /><stop offset="100%" style="stop-color:#003366; stop-opacity:1" /></linearGradient></defs>
                        <text x="50%" y="85" text-anchor="middle" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="90" fill="url(#magazineTitleGradientExport)" letter-spacing="15">工法情报</text>
                    </svg>
                    <div class="magazine-title-underline"></div>
                </div>
                <div class="magazine-meta-container">
                    <div class="magazine-meta-badge" data-field="issueText">NO.01</div>
                    <span style="color:#00559680; font-size:12px;">/</span>
                    <div class="magazine-meta-badge" data-field="dateText">JAN 2025</div>
                </div>
            </div>
            <div class="magazine-image-container"><div class="magazine-image-wrapper"><div class="magazine-image-placeholder" style="height:200px; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">暂无封面图片</div></div></div>
            <div class="magazine-footer"><div class="magazine-footer-text">OFFICIAL PUBLICATION</div><div class="magazine-button">开始阅读<svg style="display:inline-block; vertical-align:middle; margin-left:6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div></div>
        </div>
    </template>

    <template id="tpl-normal-cover">
        <div class="cover-root">
            <div class="tech-grid"></div><div class="ambient-bg"></div>
            <div class="cover-header">
                <div class="cover-sub">Ship Construction Method Information</div>
                <svg class="cover-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:320px;">
                    <defs><linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596"/><stop offset="100%" style="stop-color:#003366"/></linearGradient></defs>
                    <text x="50%" y="85" text-anchor="middle" fill="url(#g1)" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="90" letter-spacing="15">工法情报</text>
                </svg>
                <div class="cover-meta"><span data-field="issueText">NO.01</span> <span style="color:#666; font-size:12px;"></span> <span data-field="dateText">JAN 2025</span></div>
            </div>
            <div class="cover-img-box"><div class="cover-img-placeholder">暂无封面图片</div></div>
            <div class="cover-footer"><div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px);opacity:0.4;"></div><div class="magazine-button">开始阅读<svg style="display:inline-block; vertical-align:middle; margin-left:6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div></div>
        </div>
    </template>

    <template id="tpl-magazine-back">
        <div class="magazine-back-cover">
            <div class="magazine-back-bg" style="background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8));"></div>
            <div class="magazine-back-header">
                <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                <div class="magazine-header-divider"></div>
                <div style="position: relative; transform: rotate(-2deg); transform-origin: left; display: inline-block;">
                    <div class="magazine-back-title">Sailing With Success</div>
                    <div class="magazine-back-title-underline"></div>
                </div>
            </div>
            <div class="magazine-back-image-container"><div class="magazine-image-placeholder" style="width:80%; height:80%; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">暂无封底图片</div></div>
            <div class="magazine-back-footer">
                <div class="magazine-back-left">
                    <div class="magazine-back-company">SWS OFFSHORE</div>
                    <div class="magazine-back-address">Shanghai Waigaoqiao Shipbuilding Co., Ltd.<br/>上海外高桥造船有限公司</div>
                    <div class="magazine-back-copyright">漏 2025 Ship Construction Method Information</div>
                </div>
                <div class="magazine-back-center">
                    <div class="magazine-back-team">
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">编辑部</div><b>椹潕鐞?/b></div>
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">校对</div><b>胡国超</b></div>
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">审核</div><b>傅年生</b></div>
                    </div>
                    <div class="magazine-back-barcode"><div class="magazine-back-barcode-line"></div><div class="magazine-back-barcode-text">ISSN 0000-0000</div></div>
                </div>
                <div class="magazine-back-right"><img data-field="logo" class="magazine-back-logo" alt="Logo" /><div class="magazine-back-info">Official Publication<br/>Volume <span data-field="issueText">01</span>  <span data-field="dateText">JAN 2025</span></div></div>
            </div>
        </div>
    </template>

    <template id="tpl-normal-back">
        <div class="normal-back-root">
            <div class="tech-grid"></div><div class="ambient-bg" data-field="bgStyle"></div>
            <div class="normal-back-header"><div class="normal-back-sub">Ship Construction Method Information</div><h1 class="normal-back-title">Sailing With Success</h1></div>
            <div class="cover-img-box" style="flex-grow:1; min-height:500px;"><div class="cover-img-placeholder">暂无封底图片</div></div>
            <div class="normal-back-footer">
                <div class="normal-back-left">
                    <div class="normal-back-company-short">SWS OFFSHORE</div>
                    <div class="normal-back-company-full"><span>Shanghai Waigaoqiao Shipbuilding Co., Ltd.</span></div>
                </div>
                <div class="normal-back-right">
                    <div class="normal-back-bottom-meta">
                        <div class="flex gap-[4px] whitespace-nowrap"><span>编辑部:</span> <b>椹潕鐞?/b></div>
                        <div class="flex gap-[4px] whitespace-nowrap"><span>校对:</span> <b>胡国超</b></div>
                        <div class="flex gap-[4px] whitespace-nowrap"><span>审核:</span> <b>傅年生</b></div>
                    </div>
                    <img data-field="logo" class="normal-back-logo" style="height:20px; width:auto;" alt="Logo" />
                </div>
            </div>
        </div>
    </template>

    <template id="tpl-article">
        <div class="normal-container">
            <div class="article-header"><h1 data-field="title"></h1><div class="article-meta"><div class="tag-cloud" data-field="tags"></div><span data-field="category-label">分类: <span data-field="category"></span></span></div></div>
            <div class="summary-card"><div class="summary-label">摘要 / 导读</div><p data-field="abstract"></p></div>
            <div class="sws-prose article-body" data-field="content"></div>
        <div data-field="pdf-viewer" style="display: none;">
                <div class="pdf-viewer-container" data-id="pdf-container">
                    <div class="pdf-toolbar"><div class="pdf-toolbar-title">PDF PREVIEW</div><button class="pdf-expand-btn" onclick="app.togglePdfExpand(this)">⛶全屏阅读</button></div>
                    <div style="flex:1; width:100%; position:relative; background: #f3f4f6;"><iframe data-field="pdf-iframe" style="width: 100%; height: 100%; border: none;"></iframe>
<button data-field="pdf-download-btn" style="position: absolute; bottom: 15px; right: 25px; z-index: 9999; background: white; padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 4px; color: #005596; text-decoration: none; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">下载完整 PDF</button></div>
                </div>
            </div>
            
            <div class="article-navigation-mount"></div>
            
            <div class="article-footer-knowledge-base">
                <img data-field="logo" class="footer-logo" alt="" />
                SWS KNOWLEDGE BASE
            </div>
            <div class="article-end-mark">- End of Article -</div>
        </div>
    </template>
    `;
}
