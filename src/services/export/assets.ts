import { CONSTANTS } from '../../../types';

export const UNIFIED_STYLES = CONSTANTS.UNIFIED_STYLES;
export const COMPANY_INFO = CONSTANTS.COMPANY_INFO;

// SVG 路径常量
export const SVG_ICONS = {
    MENU: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18v-2H3v2zm0-5v2h18V6H3z",
    FULLSCREEN: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z",
    SEARCH: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    EXTERNAL_LINK: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
    CAMERA: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z",
    ARROW_RIGHT: "M14 5l7 7m0 0l-7 7m7-7H3",
    EXPAND: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5",
    CHEVRON_LEFT: "❮",
    CHEVRON_RIGHT: "❯"
} as const;

// 共有内联样式
export const SHARED_STYLES = `
/* CSS Reset & Basic Layout */
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; background: #f3f4f6; color: #111; height: 100vh; overflow: hidden; display: flex; }
#app-root { display: flex; width: 100%; height: 100%; }

/* Sidebar */
#sidebar { width: 300px; background: #fcfcfc; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; flex-shrink: 0; transition: transform 0.3s; z-index: 50; }
#sidebar.hidden { transform: translateX(-100%); position: absolute; height: 100%; }
.sidebar-header { padding: 45px 30px 20px 30px; border-bottom: 1px dashed transparent; }
.sidebar-header h1 { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", sans-serif; font-size: 22px; color: #111; }
.sidebar-meta { font-size: 11px; color: #9ca3af; padding: 2px 0; margin-top: 5px; border-bottom: 1px dashed rgba(0,0,0,0.05); }
.search-box { padding: 10px 30px 20px 30px; }
.search-input { width: 100%; padding: 8px 12px; background: #f9fafb; border: 1px solid transparent; border-radius: 4px; font-size: 13px; outline: none; }
.search-input:focus { background: white; border-color: #005596; box-shadow: 0 0 0 2px rgba(0,85,150,0.05); }
#article-list { flex: 1; overflow-y: auto; list-style: none; padding: 0 15px; margin: 0; }
.nav-item { padding: 14px 15px; cursor: pointer; border-left: 2px solid transparent; margin-bottom: 2px; border-radius: 4px; transition: all 0.2s; }
.nav-item:hover { background: #f3f4f6; }
.nav-item.active { background: #eff6ff; border-left-color: #005596; }
.nav-item-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px; line-height: 1.4; }
.nav-item-title.special-title { color: #005596; font-weight: 700; }
.nav-item.active .nav-item-title { color: #005596; }
.nav-item-meta { font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
.sidebar-footer { padding: 15px 30px 20px 30px; border-top: 1px solid #e5e7eb; }
.sidebar-logo { max-height: 40px; max-width: 100%; opacity: 0.8; }

/* Main Content Area */
#main { flex: 1; position: relative; overflow-y: auto; overflow-x: hidden; background: #f3f4f6; scroll-behavior: smooth; }
#content-container { min-height: 100%; transition: all 0.3s; }

/* Content Layouts */
.article-wrapper { display: none !important; }
.article-wrapper.active { display: block !important; }
.normal-container { max-width: 850px; margin: 40px auto; background: white; padding: 80px 100px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-height: 1000px; animation: fadeIn 0.5s; }
.immersive-container { width: 100%; min-height: 100vh; background: white; animation: fadeIn 0.5s; display: flex; flex-direction: column; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Cover & Back Roots */
/* Cover & Back Roots */
.cover-root, .normal-back-root { 
    width: 100%; 
    min-height: 100vh; 
    display: flex; 
    flex-direction: column; 
    padding: 30px 50px; 
    border-top: 8px solid #005596; 
    position: relative; 
    overflow: hidden; 
    background: white; 
}
@media print {
    .cover-root, .normal-back-root {
        min-height: 100vh !important;
        height: 100vh;
        page-break-after: always;
    }
}
.ambient-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.3; filter: blur(60px) saturate(180%) brightness(1.05); transform: scale(1.2); z-index: 0; pointer-events: none; transition: opacity 0.7s; }
.tech-grid { position: absolute; inset: 0; opacity: 0.03; background-image: linear-gradient(#005596 1px, transparent 1px), linear-gradient(90deg, #005596 1px, transparent 1px); background-size: 40px 40px; z-index: 0; pointer-events: none; }
.cover-header { border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 15px; position: relative; z-index: 2; width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.cover-sub { font-family: sans-serif; font-size: 10px; font-weight: 800; color: #005596; letter-spacing: 3px; text-transform: uppercase; width: 100%; margin-bottom: 5px; }
.cover-meta { display: flex; gap: 8px; align-items: center; justify-content: flex-start; font-family: sans-serif; text-[#333]; font-size: 12px; font-weight: bold; mt-5px; }
.cover-img-box { flex-grow: 1; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1; min-height: 500px; margin-top: 10px; position: relative; }
.cover-img { width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; position: relative; z-index: 1; shadow-2xl; border-radius: 2px; }
.cover-footer { display: flex; align-items: center; justify-content: space-between; z-index: 2; pt-15px; flex-shrink: 0; mt-15px; width: 100%; relative; }
`;

export const MAGAZINE_STYLES = `
/* Magazine Style Classes */
.magazine-cover { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; background: white; text-align: left; position: relative; overflow: hidden; }
.magazine-bg-gradient { position: absolute; inset: 0; z-index: 0; background: linear-gradient(to bottom right, #eff6ff, white, #f9fafb); }
.magazine-header { display: flex; flex-direction: column; align-items: flex-start; z-index: 2; margin-bottom: 25px; flex-shrink: 0; width: 100%; position: relative; }
.magazine-header-title { font-family: sans-serif; font-size: 9px; font-weight: 900; color: #005596; letter-spacing: 4px; text-transform: uppercase; width: 100%; margin-bottom: 2px; }
.magazine-header-divider { height: 1px; width: 100%; background: linear-gradient(to right, transparent, #00559680, transparent); margin-bottom: 15px; }
.magazine-title-underline { position: absolute; bottom: -2px; left: 0; width: 64px; height: 1px; background: linear-gradient(to right, #005596, transparent); }
.magazine-meta-container { display: flex; gap: 15px; align-items: center; justify-content: flex-start; font-family: sans-serif; color: #333; font-size: 11px; font-weight: bold; margin-top: 15px; }
.magazine-meta-badge { min-width: 60px; text-align: center; padding: 4px 8px; border-radius: 9999px; border: 1px solid rgba(0,85,150,0.3); background: rgba(255,255,255,0.5); backdrop-filter: blur(4px); }
.magazine-image-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1; width: 100%; min-height: 520px; margin-top: 5px; position: relative; }
.magazine-image-wrapper { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: visible; }
.magazine-image { width: auto; height: auto; max-width: 85%; max-height: 85%; object-fit: contain; position: relative; z-index: 1; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.4); border-radius: 4px; transition: all 0.3s; }
.magazine-footer { display: flex; align-items: center; justify-content: space-between; z-index: 2; padding-top: 20px; flex-shrink: 0; margin-top: 20px; width: 100%; position: relative; }
.magazine-footer-text { font-size: 9px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
.magazine-button { font-size: 11px; font-weight: bold; color: white; background: linear-gradient(to right, #005596, #003366); display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px 16px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-transform: uppercase; letter-spacing: 2px; transition: all 0.2s; }
.magazine-button:hover { opacity: 0.9; transform: translateX(4px); }
.magazine-back-cover { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; background: white; text-align: left; position: relative; overflow: hidden; }
.magazine-back-bg { position: absolute; inset: 0; z-index: 0; background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8)); }
.magazine-back-header { display: flex; flex-direction: column; align-items: flex-start; z-index: 2; margin-bottom: 25px; flex-shrink: 0; width: 100%; position: relative; }
.magazine-back-title { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", serif; font-size: 64px; font-weight: 900; letter-spacing: -2px; line-height: 0.9; margin-bottom: 5px; font-style: italic; background: linear-gradient(to bottom, #005596, #003366); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: transparent; }
.magazine-back-title-underline { position: absolute; bottom: -12px; left: 0; width: 96px; height: 3px; background: linear-gradient(to right, #005596, transparent); transform: rotate(2deg); }
.magazine-back-image-container { flex-grow: 1; width: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: visible; min-height: 520px; margin-bottom: 25px; }
.magazine-back-image { width: auto; height: auto; max-width: 80%; max-height: 80%; object-fit: contain; box-shadow: 0 20px 50px -10px rgba(0,0,0,0.3); border-radius: 8px; transition: all 0.3s; }
.magazine-back-footer { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; z-index: 2; flex-shrink: 0; position: relative; }
.magazine-back-left { display: flex; flex-direction: column; gap: 8px; max-width: 40%; }
.magazine-back-company { font-size: 11px; color: #6b7280; letter-spacing: 1px; font-weight: bold; text-transform: uppercase; }
.magazine-back-address { font-size: 10px; color: #9ca3af; line-height: 1.4; white-space: nowrap; }
.magazine-back-copyright { margin-top: 10px; font-size: 9px; color: #9ca3af; }
.magazine-back-center { display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; }
.magazine-back-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; font-size: 11px; color: #4b5563; font-family: sans-serif; }
.magazine-back-team-item { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.magazine-back-team-item b { font-weight: 700; color: #111; }
.magazine-back-team-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; }
.magazine-back-barcode { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 5px; width: 100%; }
.magazine-back-barcode-line { height: 2px; width: 100%; background: linear-gradient(to right, transparent, #d1d5db, transparent); }
.magazine-back-barcode-text { font-size: 8px; color: #9ca3af; letter-spacing: 3px; }
.magazine-back-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.magazine-back-logo { height: 25px; width: auto; }
.magazine-back-logo-underline { position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, #00559680, transparent); }
.magazine-back-info { font-size: 9px; color: #9ca3af; text-align: right; }
.magazine-decoration-circle { position: absolute; top: 80px; left: 40px; width: 12px; height: 12px; border: 2px solid rgba(0,85,150,0.2); border-radius: 50%; }
.magazine-decoration-square { position: absolute; bottom: 80px; right: 40px; width: 8px; height: 8px; border: 1px solid rgba(0,85,150,0.2); }
.magazine-decoration-line { position: absolute; top: 160px; right: 80px; width: 24px; height: 1px; background: linear-gradient(to right, transparent, #00559630); }
`;

export const PRINT_STYLES = `
/* --- 打印专用样式 (A4 适配版 - V4 Ultimate) --- */
@media print {
    @page { margin: 0; size: A4 portrait; }
    
    /* 全局重置 */
    *, *:before, *:after {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
        box-sizing: border-box !important;
    }
    
    html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        display: block !important; /* 强制块级布局 */
        overflow: visible !important;
    }

    #app-root, #main, #content-container {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        overflow: visible !important;
    }

    /* 隐藏 UI 组件 */
    #sidebar, #fab-nav, #top-controls, .magazine-button, .fab-btn, .fab-divider, .pdf-viewer-container, .pdf-expand-btn, .bottom-nav, .article-navigation-mount {
        display: none !important;
    }
    
    /* --- 文章容器可见性逻辑 (关键) --- */
    
    /* 默认：所有文章 wrapper 在打印时均为块级显示 */
    .article-wrapper, 
    .toc-page {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        height: auto !important;
        page-break-after: always;
        break-after: page;
        float: none !important;
        position: relative !important;
        left: 0 !important;
        top: 0 !important;
    }

    /* 例外：如果是“打印单页”模式 (body没有print-all类)，则隐藏非激活项 */
    body:not(.print-all) .article-wrapper:not(.active),
    body:not(.print-all) .toc-page {
        display: none !important;
    }
    
    /* --- 目录页样式 (修复一页一条目) --- */
    .toc-container {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important; /* 移除最小高度限制 */
        padding: 2.54cm 3.17cm !important;
        background: white !important;
        overflow: visible !important;
    }
    
    .toc-list {
        display: block !important;
    }

    .toc-item {
        display: flex !important;
        align-items: baseline !important;
        margin-bottom: 0.8em !important; /* 适中的间距 */
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: auto !important;
        break-after: auto !important;
    }
    
    /* --- 正文容器 (A4 页边距模拟) --- */
    .normal-container {
        width: 100% !important;
        padding: 2.54cm 3.17cm !important;
        min-height: 25cm !important; /* 保证高度但允许撑开 */
        background: white !important;
    }
    
    /* --- 封面/封底 (全屏无边距) --- */
    .cover-root, .magazine-cover, .magazine-back-cover, .normal-back-root { 
        width: 210mm !important;
        min-height: 296mm !important; /* 轻微小于297防止溢出 */
        max-height: none !important;  /* 允许溢出，防止切断 */
        height: auto !important;
        margin: 0 !important;
        padding: 40px !important;
        border: none !important;
        display: flex !important; 
        flex-direction: column !important; 
        justify-content: space-between !important; 
        background-color: white !important;
    }

    /* 内部元素保护 */
    .sws-prose p, 
    .sws-prose img, 
    .summary-card, 
    h1, h2, h3, h4, h5, h6 { 
        page-break-inside: avoid; 
        break-inside: avoid; 
    }
    
    .article-header h1 { 
        font-size: 24pt !important; 
        color: #000 !important; 
        text-align: center; 
        page-break-after: avoid; 
    }
    
    /* 媒体占位 */
    video, iframe { display: none !important; }
    .media-print-placeholder { 
        display: block !important; 
        margin: 20px 0; 
        border: 1px dashed #ccc; 
        padding: 20px; 
        text-align: center; 
        page-break-inside: avoid;
        break-inside: avoid;
    }
    
    /* 正文图片样式 - 严格限制尺寸 */
    .sws-prose img { 
        max-width: 100% !important; 
        max-height: 600px !important; /* 限制最大高度，防止超出页面 */
        height: auto !important; 
        width: auto !important;
        display: block !important; 
        margin: 15px auto !important; 
        object-fit: contain !important; /* 保持纵横比 */
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    
    /* 封面/封底图片特殊处理 */
    .cover-img, .magazine-image, .magazine-back-image {
        max-width: 85% !important;
        max-height: 65vh !important; /* 使用vh单位确保不超出页面高度 */
        height: auto !important;
        width: auto !important;
        object-fit: contain !important;
        display: block !important;
        margin: 0 auto !important;
    }
    
    /* 封面/封底图片容器 */
    .cover-img-box, .magazine-image-container, .magazine-back-image-container {
        max-height: 70vh !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden !important;
    }
    
    /* 文章底部Logo尺寸限制 */
    .footer-logo {
        max-height: 25px !important;
        max-width: 80px !important;
        height: auto !important;
        width: auto !important;
        opacity: 0.5 !important;
        display: inline-block !important;
        vertical-align: middle !important;
        margin-right: 8px !important;
        object-fit: contain !important;
    }

    .print-only { display: block !important; }
}
`;

export const MISC_STYLES = `
/* Navigation & Footer */
.bottom-nav { width: 100%; max-width: 850px; margin: 50px auto 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 0 20px; box-sizing: border-box; }
.article-footer-knowledge-base { margin-top: 50px; pt-20px; border-top: 1px solid #f3f4f6; text-align: center; opacity: 0.4; font-size: 10px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; font-family: sans-serif; padding-top: 20px; }
.footer-logo { height: 25px; opacity: 0.5; display: inline-block; vertical-align: middle; margin-right: 8px; }
.article-end-mark { text-align: center; margin: 40px auto 0; font-size: 10px; color: #e5e7eb; letter-spacing: 2px; }
.nav-card { padding: 20px; border-radius: 16px; background: white; border: 1px solid #f3f4f6; display: flex; flex-direction: column; cursor: pointer; transition: all 0.3s; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.nav-card:hover { border-color: #00559630; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.nav-label { font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
.nav-title { font-size: 14px; font-weight: bold; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 0.3s; }
#top-controls { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
.control-btn { width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4b5563; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: all 0.2s; }
.article-header { margin-bottom: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; }
.article-header h1 { font-family: ui-serif, Georgia, serif; font-size: 32px; color: #111; margin: 0 0 15px 0; line-height: 1.3; font-weight: bold; }
.article-meta { color: #9ca3af; font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px 15px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; align-items: center; margin-top: 4px; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag-item { padding: 1px 8px; background: #f3f4f6; color: #111; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid rgba(209, 213, 219, 0.5); white-space: nowrap; line-height: 1.5; display: inline-block; }
/* Main Article Content (Inherited from Editor's UNIFIED_STYLES) */
${UNIFIED_STYLES}


/* PDF Viewer */
.pdf-viewer-container { width: 100%; height: 85vh !important; min-height: 600px !important; border: 1px solid #e5e7eb; margin-top: 30px; background: #f9fafb; border-radius: 24px; overflow: hidden; position: relative; transition: all 0.3s ease; display: flex; flex-direction: column; }
.pdf-toolbar { height: 48px; background: white; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; user-select: none; }
.pdf-expand-btn { background: rgba(0,85,150,0.1); border: 1px solid rgba(0,85,150,0.2); border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: bold; color: #005596; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }



.normal-back-title { font-size: 36px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin: 0; line-height: 1.2; background: linear-gradient(to bottom, #005596, #003366); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: transparent; font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; }
.normal-back-footer { width: 100%; display: flex; align-items: center; justify-content: space-between; z-index: 2; pt-15px; flex-shrink: 0; margin-top: 15px; position: relative; }
.normal-back-left { display: flex; flex-direction: column; gap: 4px; font-size: 10px; color: #9ca3af; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
.normal-back-left span:last-child { font-weight: normal; font-size: 9px; text-transform: none; letter-spacing: 0; }
.normal-back-right { display: flex; align-items: center; gap: 20px; }
.normal-back-company-short { color: #005596; }
.normal-back-sub { font-family: sans-serif; font-size: 10px; font-weight: 800; color: #005596; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px; }
.normal-back-header { border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 15px; position: relative; z-index: 2; width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
.normal-back-bottom-meta { display: flex; gap: 20px; color: #666; font-size: 11px; font-family: sans-serif; align-items: center; }
.normal-back-bottom-meta b { font-weight: bold; color: #333; }
.normal-back-bottom-meta span { color: #666; }

/* 目录页专业样式 */
.toc-page { 
    width: 100%; 
    min-height: 100vh; 
    background: white; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    padding: 60px 40px;
}
.toc-container { 
    width: 100%; 
    max-width: 700px; 
    margin: 0 auto;
}
.toc-header { 
    text-align: center; 
    margin-bottom: 60px; 
    padding-bottom: 30px;
    border-bottom: 3px double #005596;
    position: relative;
}
.toc-header h1 { 
    font-family: "PingFang SC", "Microsoft YaHei", "SimHei", sans-serif;
    font-size: 48px; 
    font-weight: 900; 
    color: #111; 
    margin: 0 0 15px 0; 
    letter-spacing: 20px;
    text-indent: 20px; /* 补偿letter-spacing */
}
.toc-header h1::before {
    content: "";
    display: block;
    width: 60px;
    height: 4px;
    background: linear-gradient(to right, #005596, transparent);
    margin: 0 auto 20px;
}
.toc-list { 
    list-style: none; 
    padding: 0; 
    margin: 0;
}
.toc-item { 
    display: flex; 
    align-items: baseline; 
    margin-bottom: 18px; 
    padding: 12px 0;
    border-bottom: 1px solid #f3f4f6;
    transition: all 0.2s;
}
.toc-item:hover {
    background: #f9fafb;
    padding-left: 8px;
    padding-right: 8px;
}
.toc-title { 
    font-size: 16px; 
    font-weight: 600; 
    color: #374151;
    white-space: nowrap;
    flex-shrink: 0;
}
.toc-dots { 
    flex: 1; 
    border-bottom: 1px dotted #d1d5db; 
    margin: 0 12px;
    min-width: 30px;
}
.toc-page-number { 
    font-size: 14px; 
    font-weight: 700;
    color: #005596;
    font-family: "Georgia", serif;
    white-space: nowrap;
    flex-shrink: 0;
}


/* Summary Card */
.summary-card { margin-top: 24px; margin-bottom: 32px; padding: 18px 24px; background: #F3F4F6; border-left: 5px solid #005596; border-radius: 6px; animation: fadeIn 0.5s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.summary-label { font-size: 10px; font-weight: 900; color: #005596; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.summary-label::before { content: ""; display: inline-block; width: 3px; height: 12px; background: #005596; border-radius: 2px; }
.summary-card p { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 15px; line-height: 1.7; color: #111827; font-style: italic; }

/* Seasonal Styles */
.spring-cover, .spring-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #fdf2f8, #f0fdf4); }
.summer-cover, .summer-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #fefce8, #eff6ff); }
.autumn-cover, .autumn-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #fff7ed, #f5f5f4); }
.winter-cover, .winter-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #eff6ff, #f8fafc); }

/* Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }
`;

export const SEASONAL_STYLES = `
/* Seasonal Specific Styles - Spring */
.spring-sub { font-family: serif; font-size: 14px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; color: #db2777; text-align: center; }
.spring-title { font-family: serif; font-size: 72px; font-weight: 900; color: #db2777; text-align: center; }
.spring-meta { display: flex; gap: 20px; align-items: center; justify-content: center; background: rgba(255,255,255,0.6); padding: 8px 24px; border-radius: 9999px; margin: 0 auto; }

/* Seasonal Specific Styles - Summer */
.summer-sun { position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(253, 186, 116, 0.2) 0%, rgba(254, 252, 232, 0) 70%); }

/* Seasonal Specific Styles - Winter */
.winter-snow { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(white 2px, transparent 2px); background-size: 50px 50px; opacity: 0.3; pointer-events: none; }
`;
