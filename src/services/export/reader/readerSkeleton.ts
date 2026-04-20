import { SHARED_STYLES, MAGAZINE_STYLES, PRINT_STYLES, MISC_STYLES, SEASONAL_STYLES, SVG_ICONS } from '../assets';
import { getReaderTemplates } from './readerTemplates';
import { getClientScript } from './clientScript';

export function getReaderSkeleton(options: {
    sidebarMeta: string;
    logo: string;
    tocListHtml: string;
    articlesJson: string;
    configJson: string;
    compressionMethod: string;
}) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>工法情报阅读器</title>
    <style>
        ${SHARED_STYLES}
        ${MAGAZINE_STYLES}
        ${PRINT_STYLES}
        ${MISC_STYLES}
        ${SEASONAL_STYLES}
    </style>
</head>
<body>
<div id="app-loading" style="position:fixed;top:0;left:0;right:0;bottom:0;background:#f8f9fa;display:flex;align-items:center;justify-content:center;z-index:99999;">
    <div style="text-align:center;">
        <div style="width:60px;height:60px;border:4px solid #e5e7eb;border-top-color:#005596;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px;"></div>
        <div class="progress-text" style="color:#666;font-size:16px;font-family:sans-serif;">正在加载数据...</div>
        <div style="color:#999;font-size:12px;margin-top:8px;">文件较大，请稍候</div>
    </div>
</div>
<style>
@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>

<script>
window.__SWS_DATA_ARTICLES_B64__ = "${options.articlesJson.replace(/<\//g, '<\\/')}";
window.__SWS_DATA_CONFIG_B64__ = "${options.configJson.replace(/<\//g, '<\\/')}";
window.__SWS_COMPRESSION_METHOD__ = "${options.compressionMethod}";
</script>

<div id="app-root">
    <div id="top-controls">
        <button class="control-btn" onclick="app.toggleSidebar()" title="切换侧边栏"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${SVG_ICONS.MENU}"/></svg></button>
        <button class="control-btn" onclick="app.toggleFullscreen()" title="全屏阅读"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${SVG_ICONS.FULLSCREEN}"/></svg></button>
    </div>

    <div id="sidebar">
        <div class="sidebar-header">
            <svg class="sidebar-title-svg" viewBox="0 0 400 60" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:200px;">
                <defs><linearGradient id="sidebarTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596; stop-opacity:1" /><stop offset="100%" style="stop-color:#003366; stop-opacity:1" /></linearGradient></defs>
                <text x="50%" y="45" text-anchor="middle" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="48" fill="url(#sidebarTitleGradientExport)" letter-spacing="10">工法情报</text>
            </svg>
            <div class="sidebar-meta">${options.sidebarMeta}</div>
        </div>
        <div class="search-box"><input type="text" id="search-input" class="search-input" placeholder="搜索文章..." /></div>
        <ul id="article-list"></ul>
        <div class="sidebar-footer">${options.logo ? `<img src="${options.logo}" class="sidebar-logo" />` : ''}</div>
    </div>

    <div id="main">
        <div id="content-container">
            <div id="render-target"></div>
        </div>
    </div>
</div>

${getReaderTemplates()}

<script>
${getClientScript()}
</script>
</body>
</html>`;
}
