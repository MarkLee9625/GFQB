export function getReaderTemplates() {
    return `
    <template id="tpl-magazine-cover">
        <div class="magazine-cover">
            <div class="magazine-bg-gradient"></div>
            <div class="cover-image-layer"><div class="magazine-image-wrapper"><div class="magazine-image-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);background:rgba(0,0,0,0.2);">暂无封面图片</div></div></div>
            <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.6));"></div>
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
                    <span style="color:rgba(0,85,150,0.4); font-size:12px;">/</span>
                    <div class="magazine-meta-badge" data-field="dateText">JAN 2025</div>
                </div>
            </div>
            <div class="magazine-footer"><div class="magazine-footer-text">OFFICIAL PUBLICATION</div><div class="magazine-button">开始阅读<svg style="display:inline-block; vertical-align:middle; margin-left:6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div></div>
        </div>
    </template>

    <template id="tpl-normal-cover">
        <div class="cover-root">
            <div class="tech-grid"></div><div class="ambient-bg"></div>
            <div class="cover-image-layer"><div class="cover-img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f3f4f6;">暂无封面图片</div></div>
            <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.7));"></div>
            <div class="cover-header">
                <div class="cover-sub">Ship Construction Method Information</div>
                <svg class="cover-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:320px;">
                    <text x="50%" y="85" text-anchor="middle" fill="#005596" font-family="'PingFang SC','Microsoft YaHei','SimHei',sans-serif" font-weight="bold" font-size="90" letter-spacing="15" stroke="rgba(255,255,255,0.4)" stroke-width="2">工法情报</text>
                </svg>
                <div class="cover-meta"><span data-field="issueText">NO.01</span> <span style="color:rgba(0,85,150,0.4); font-size:12px;">·</span> <span data-field="dateText">JAN 2025</span></div>
            </div>
            <div class="cover-footer"><div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px);opacity:0.6;"></div><div class="magazine-button">开始阅读<svg style="display:inline-block; vertical-align:middle; margin-left:6px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div></div>
        </div>
    </template>

    <template id="tpl-magazine-back">
        <div class="magazine-back-cover">
            <div class="magazine-back-bg" style="background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8));"></div>
            <div class="cover-image-layer"><div class="magazine-image-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);background:rgba(0,0,0,0.2);">暂无封底图片</div></div>
            <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05), transparent 40%, rgba(0,0,0,0.7));"></div>
            <div class="magazine-back-header">
                <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
                <div class="magazine-header-divider"></div>
                <div style="position: relative; transform: rotate(-2deg); transform-origin: left; display: inline-block;">
                    <div class="magazine-back-title">Sailing With Success</div>
                    <div class="magazine-back-title-underline"></div>
                </div>
            </div>
            <div style="position:absolute;bottom:0;left:0;right:0;z-index:2;height:160px;background:linear-gradient(to top,rgba(255,255,255,0.8),rgba(255,255,255,0.2),transparent);pointer-events:none;"></div>
            <div class="magazine-back-footer">
                <div class="magazine-back-left">
                    <div class="magazine-back-company">SWS OFFSHORE</div>
                    <div class="magazine-back-address">Shanghai Waigaoqiao Shipbuilding Co., Ltd.<br/>上海外高桥造船海洋工程有限公司</div>
                    <div class="magazine-back-copyright">© 2025 Ship Construction Method Information</div>
                </div>
                <div class="magazine-back-center">
                    <div class="magazine-back-team">
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">编辑</div><b>马李琛</b></div>
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">校对</div><b>胡国超</b></div>
                        <div class="magazine-back-team-item"><div class="magazine-back-team-label">审核</div><b>储年生</b></div>
                    </div>
                    <div class="magazine-back-barcode"><div class="magazine-back-barcode-line"></div><div class="magazine-back-barcode-text">ISSN 0000-0000</div></div>
                </div>
                <div class="magazine-back-right"><img data-field="logo" class="magazine-back-logo" alt="Logo" /><div class="magazine-back-info">Official Publication<br/>Volume <span data-field="issueText">01</span> · <span data-field="dateText">JAN 2025</span></div></div>
            </div>
        </div>
    </template>

    <template id="tpl-normal-back">
        <div class="normal-back-root">
            <div class="tech-grid"></div><div class="ambient-bg" data-field="bgStyle"></div>
            <div class="cover-image-layer"><div class="cover-img-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;background:#f3f4f6;">暂无封底图片</div></div>
            <div class="cover-overlay" style="background:linear-gradient(to bottom, rgba(0,0,0,0.05), transparent 40%, rgba(0,0,0,0.8));"></div>
            <div class="normal-back-header" style="position:absolute;top:0;left:0;right:0;z-index:3;padding:30px 50px;">
                <div class="normal-back-sub" style="color:#005596;text-shadow:0 1px 3px rgba(255,255,255,0.8);">Ship Construction Method Information</div>
                <h1 class="normal-back-title" style="color:#005596;-webkit-text-fill-color:#005596;background:none;text-shadow:0 1px 4px rgba(255,255,255,0.8);">Sailing With Success</h1>
            </div>
            <div style="position:absolute;bottom:0;left:0;right:0;z-index:2;height:140px;background:linear-gradient(to top,rgba(255,255,255,0.8),rgba(255,255,255,0.2),transparent);pointer-events:none;"></div>
            <div class="normal-back-footer" style="position:absolute;bottom:0;left:0;right:0;z-index:3;padding:0 50px 25px;">
                <div class="normal-back-left">
                    <div class="normal-back-company-short" style="color:rgba(0,85,150,0.7);">SWS OFFSHORE</div>
                    <div class="normal-back-company-full" style="color:rgba(0,85,150,0.5);">
                        <span>Shanghai Waigaoqiao Shipbuilding Co., Ltd.</span><br/>
                        <span>上海外高桥造船海洋工程有限公司</span>
                    </div>
                </div>
                <div class="normal-back-center">
                    <div class="normal-back-bottom-meta" style="display:flex;gap:20px;color:rgba(0,85,150,0.8);font-size:11px;align-items:center;text-shadow:0 1px 3px rgba(255,255,255,0.6);">
                        <div class="flex gap-[4px] whitespace-nowrap"><span style="color:rgba(0,85,150,0.6);">编辑:</span> <b style="color:#005596;">马李琛</b></div>
                        <div class="flex gap-[4px] whitespace-nowrap"><span style="color:rgba(0,85,150,0.6);">校对:</span> <b style="color:#005596;">胡国超</b></div>
                        <div class="flex gap-[4px] whitespace-nowrap"><span style="color:rgba(0,85,150,0.6);">审核:</span> <b style="color:#005596;">储年生</b></div>
                    </div>
                </div>
                <div class="normal-back-right">
                    <img data-field="logo" class="normal-back-logo" style="height:20px; width:auto; filter:brightness(0) saturate(100%) invert(28%) sepia(98%) saturate(1235%) hue-rotate(190deg); opacity:0.8;" alt="Logo" />
                    <div class="normal-back-info" style="font-size: 10px; color: rgba(0,85,150,0.5); margin-top: 5px; text-align: right; text-shadow:0 1px 3px rgba(255,255,255,0.6);">
                        Official Publication<br/>
                        Volume <span data-field="issueText">01</span> · <span data-field="dateText">JAN 2025</span>
                    </div>
                </div>
            </div>
        </div>
    </template>

    <template id="tpl-article">
        <div class="normal-container">
            <div class="article-header"><h1 data-field="title"></h1><div class="article-meta"><div class="tag-cloud" data-field="tags"></div><span data-field="category-label">分类: <span data-field="category"></span></span></div></div>
            <div class="summary-card"><div class="summary-label">摘要</div><p data-field="abstract"></p></div>
            <div class="sws-prose article-body" data-field="content"></div>
        <div data-field="pdf-viewer" style="display: none;">
                <div class="pdf-viewer-container" data-id="pdf-container">
                    <div class="pdf-toolbar"><div class="pdf-toolbar-title">PDF PREVIEW</div><div style="display:flex;align-items:center;gap:8px;"><button data-field="pdf-download-btn" style="background:rgba(0,85,150,0.1);border:1px solid rgba(0,85,150,0.2);border-radius:6px;padding:6px 12px;font-size:11px;font-weight:bold;color:#005596;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;white-space:nowrap;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>下载完整 PDF</button><button class="pdf-expand-btn" onclick="app.togglePdfExpand(this)">⛶全屏阅读</button></div></div>
                    <div style="flex:1; width:100%; position:relative; background: #f3f4f6;"><iframe data-field="pdf-iframe" style="width: 100%; height: 100%; border: none;"></iframe></div>
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

