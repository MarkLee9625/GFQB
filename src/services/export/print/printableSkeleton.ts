import { SHARED_STYLES, MAGAZINE_STYLES, PRINT_STYLES, MISC_STYLES, SEASONAL_STYLES } from '../assets';

export function getPrintableSkeleton(options: {
    contentHtml: string;
    /** 浏览器标签与另存 PDF 默认文件名来源 */
    title?: string;
}) {
    const docTitle = (options.title || '打印专用版 - 工法情报').replace(/</g, '').slice(0, 120);
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${docTitle}</title>
    <style>
        ${SHARED_STYLES}
        ${MAGAZINE_STYLES}
        ${PRINT_STYLES}
        ${MISC_STYLES}
        ${SEASONAL_STYLES}
        
        /* 强制覆盖部分可能干扰打印的样式 */
        body { 
            background: #525659; 
            margin: 0; 
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow-y: auto !important;
            height: auto !important;
        }

        .print-page-wrapper {
            background: white;
            width: 210mm;
            min-height: 297mm;
            margin-bottom: 30px;
            box-shadow: 0 0 15px rgba(0,0,0,0.3);
            position: relative;
            overflow: hidden;
            flex-shrink: 0;
        }
        .print-page-wrapper.article-wrapper {
            min-height: auto;
            overflow: visible;
        }
        

        @media print {
            /* 1. Page and margin reset — 底部留 12mm；页脚数字以浏览器原生页眉页脚为准，
               @bottom-center 仅 Firefox 系生效，Chrome 下靠用户勾选打印对话框选项 */
            @page {
                size: 210mm 297mm !important;
                margin: 0 0 12mm 0 !important;
            }
            html, body, .print-all {
                display: block !important;
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
            }

            /* 2. Page container reset */
            .print-page-wrapper {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                page-break-before: always !important;
                break-before: page !important;
                overflow: visible !important;
            }
            .print-toolbar ~ .print-page-wrapper:first-of-type,
            body > .print-page-wrapper:first-child,
            .print-page-wrapper.first-page {
                page-break-before: auto !important;
                break-before: auto !important;
            }

            /* 3. Destructive print reset: fix Chrome phantom pagination */
            .normal-container,
            .article-wrapper,
            .sws-prose,
            .article-header,
            .article-body {
                display: block !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow: visible !important;
                position: static !important;
                visibility: visible !important;
                opacity: 1 !important;
                color: #000 !important;
            }
            
            /* Protect inner article content elements */
            .sws-prose > *,
            .article-body > * {
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* Ensure inline text elements display correctly */
            .sws-prose p,
            .sws-prose span,
            .sws-prose strong,
            .sws-prose em,
            .sws-prose a,
            .sws-prose li {
                color: #000 !important;
            }
            
            /* Ensure paragraphs and list items wrap correctly */
            .sws-prose p {
                display: block !important;
                margin: 1em 0 !important;
            }
            
            .sws-prose li {
                display: list-item !important;
            }
            
            /* Fix: ensure span/strong/em stay inline */
            .sws-prose span,
            .sws-prose strong,
            .sws-prose em,
            .sws-prose a {
                display: inline !important;
            }

            /* 3.5 Width reset: break 65ch max-width constraint */
            .normal-container,
            .sws-prose,
            .article-body,
            .article-header {
                width: 100% !important;
                max-width: none !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
            }

            /* Force justified text for professional layout */
            .sws-prose p,
            .sws-prose div {
                max-width: none !important;
                width: 100% !important;
                text-align: justify !important;
            }

            /* 4. Page-specific height and spacing rules */
            .print-page-wrapper.article-wrapper,
            .print-page-wrapper.toc-page {
                padding: 5mm 20mm !important;
                height: auto !important;
                min-height: 0 !important;
            }
            .print-page-wrapper:not(.article-wrapper):not(.pdf-full-page) {
                min-height: 285mm !important;
            }

            /* 5. TOC page fix */
            .print-page-wrapper.toc-page .toc-container {
                justify-content: flex-start !important;
                padding-top: 60px !important;
                overflow: visible !important;
                height: auto !important;
            }

            /* 6. PDF full-page image: contain 保纵横比，打印下高度自适应防溢出 */
            .print-page-wrapper.pdf-full-page {
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow: visible !important;
                background: #fff !important;
                page-break-before: always !important;
                break-before: page !important;
            }
            .pdf-full-page img {
                display: block !important;
                width: 100% !important;
                height: auto !important;
                object-fit: contain !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
            }

            .no-print { display: none !important; }

            /* Ghost line killer: hide empty paragraphs in print */
            .sws-prose p:empty,
            .sws-prose p:has(> br:only-child) {
                display: none !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* Remove top margin from first element in article wrapper */
            .print-page-wrapper.article-wrapper > .normal-container > .article-header {
                margin-top: 0 !important;
                padding-top: 0 !important;
            }
            .print-page-wrapper.article-wrapper > .normal-container > .article-header h1 {
                margin-top: 0 !important;
            }
        }

        /* Print toolbar */
        .print-toolbar {
            width: 210mm;
            max-width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            margin-bottom: 20px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .print-toolbar-content {
            flex: 1;
        }
        .print-toolbar-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .print-toolbar-desc {
            font-size: 13px;
            opacity: 0.95;
            line-height: 1.6;
        }
        .print-btn-group {
            display: flex;
            gap: 12px;
            flex-direction: column;
        }
        .print-btn {
            background: white;
            color: #667eea;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            font-size: 14px;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            white-space: nowrap;
        }
        .print-btn:hover { 
            background: #f0f0f0; 
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .print-btn-secondary {
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 12px;
            padding: 6px 16px;
        }
        .print-btn-secondary:hover {
            background: rgba(255,255,255,0.3);
        }
    </style>
</head>
<body class="print-all">
    <div class="print-toolbar no-print">
        <div class="print-toolbar-content">
            <div class="print-toolbar-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                    <path d="M6 14h12v8H6z"/>
                </svg>
                打印专用预览模式
            </div>
            <div class="print-toolbar-desc">
                📋 <strong>导出为PDF</strong>：点击右侧按钮在打印对话框中选择"另存为PDF"或"Microsoft Print to PDF"<br/>
                🖨️ <strong>直接打印</strong>：选择物理打印机并调整纸张设置为A4
            </div>
        </div>
        <div class="print-btn-group">
            <button class="print-btn" onclick="window.print()">
                📥 导出PDF / 打印
            </button>
        </div>
    </div>

    ${options.contentHtml}

    <script>
        window.onload = function() {
            // 目录页码回填校准：服务端已按 data-target-id 预填（含 PDF 实页），
            // 此处仅在字体/图片就绪后按 id 重新估算正文页数并校准，不再按下标对应。
            function calibrate() {
                try {
                    var MM = 96 / 25.4; // 1mm 对应的 px
            var pageContentPx = 285 * MM; // 一页正文可用高度 285mm (297mm - 12mm 底边距)
            var fontRatio = 0.7; // 屏幕 → 打印 字体缩放比
            var NORMAL_PAD = 160; // normal-container padding top+bottom (80px each)

                    var tocItems = document.querySelectorAll('.toc-item[data-target-id]');
                    if (!tocItems.length) return;
                    var coverCount = document.querySelectorAll('.print-page-wrapper.cover-page').length;
                    var hasToc = !!document.querySelector('.toc-page');
                    var currentPage = coverCount + (hasToc ? 2 : 1);
                    for (var i = 0; i < tocItems.length; i++) {
                        var id = tocItems[i].getAttribute('data-target-id');
                        var numEl = tocItems[i].querySelector('.toc-page-number');
                        if (numEl) numEl.textContent = currentPage;
                        var body = id ? document.querySelector('.print-page-wrapper.article-wrapper[data-article-id="' + id + '"]') : null;
                        var pdfCount = id ? document.querySelectorAll('.print-page-wrapper.pdf-full-page[data-article-id="' + id + '"]').length : 0;
                        var bodyPages = 0;
                        if (body) {
                            var h = body.offsetHeight;
                            var contentH = Math.max(0, h - NORMAL_PAD) * fontRatio;
                            bodyPages = Math.max(1, Math.ceil(contentH / pageContentPx));
                        }
                        if (!body && pdfCount === 0) bodyPages = 1;
                        currentPage += bodyPages + pdfCount;
                    }
                } catch (e) { /* 保留服务端预填页码 */ }
            }
            try {
                var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function(){}) : Promise.resolve();
                var imgs = Array.prototype.slice.call(document.getElementsByTagName('img'));
                var decoded = imgs.map(function(im) {
                    try { return im.decode ? im.decode().catch(function(){}) : Promise.resolve(); }
                    catch (e) { return Promise.resolve(); }
                });
                Promise.all([fontsReady].concat(decoded)).then(function() { setTimeout(calibrate, 50); });
                setTimeout(calibrate, 3000);
            } catch (e) { calibrate(); }
        };
    </script>
</body>
</html>`;
}
