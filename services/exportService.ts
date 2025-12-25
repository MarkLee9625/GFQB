import { Article, CONSTANTS } from '../types';

export interface ExportOptions {
    useAlternateDesign: boolean;
    includeImages: boolean;
    optimizeForPrint: boolean;
}

export interface ExportMetadata {
    logo: string;
    sidebarMeta: string;
}

export const UNIFIED_STYLES = CONSTANTS.UNIFIED_STYLES;
export const COMPANY_INFO = CONSTANTS.COMPANY_INFO;

// SVG 路径常量，用于避免 Babel 解析错误
export const SVG_ICONS = {
    MENU: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18v-2H3v2zm0-5v2h18V6H3z",
    FULLSCREEN: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z",
    PRINT: "M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-2h8zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z",
    PRINT_BOOK: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
    SEARCH: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    EXTERNAL_LINK: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
    CAMERA: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z",
    ARROW_RIGHT: "M14 5l7 7m0 0l-7 7m7-7H3",
    EXPAND: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5",
    CHEVRON_LEFT: "❮",
    CHEVRON_RIGHT: "❯"
} as const;

// 修复：正确的 HTML 转义函数
function escapeHtml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 内容编码函数 (保持不变)
function encodeContent(str: string): string {
    if (typeof btoa === 'undefined') {
        return Buffer.from(str, 'utf8').toString('base64');
    }
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        console.error("Content encoding failed:", e);
        return btoa(str);
    }
}

// 辅助函数：将 URL 转换为 Base64
async function urlToBase64(url: string): Promise<string> {
    if (!url || url.startsWith('data:')) return url;
    try {
        // [Bug Fix] 增加超时处理，防止大文件下载导致导出任务僵死
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        const blob = await response.blob();

        // [Bug 4 修复] 内存保护：单个文件超过 20MB 则跳过 Base64 转换
        const MAX_SIZE = 20 * 1024 * 1024;
        if (blob.size > MAX_SIZE) {
            console.warn(`[Export] File too large to Base64, skipping to save memory: ${url} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
            return url;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('Failed to convert resource to base64:', url, e);
        return url;
    }
}

// 预处理文章数据：下载所有图片并转换为 Base64
// 修复：添加并发控制，避免请求过多导致公众号图片“裂开”
async function processArticlesForExport(articles: Article[]): Promise<Article[]> {
    const CONCURRENCY_LIMIT = 3; // 同时进行的下载请求数
    const processed: Article[] = [];

    // 展平所有需要处理的任务
    interface Task {
        type: 'cover' | 'back' | 'content-img' | 'content-media';
        articleIndex: number;
        element?: HTMLElement;
        url: string;
    }

    const tasks: Task[] = [];
    const newArticles = articles.map(a => ({ ...a }));

    newArticles.forEach((article, index) => {
        if (article.coverImage && !article.coverImage.startsWith('data:')) {
            tasks.push({ type: 'cover', articleIndex: index, url: article.coverImage });
        }
        if (article.backImage && !article.backImage.startsWith('data:')) {
            tasks.push({ type: 'back', articleIndex: index, url: article.backImage });
        }
        if (article.content) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(article.content, 'text/html');

            // 处理图片 (增强：兼容微信 data-src)
            const images = doc.querySelectorAll('img');
            images.forEach(img => {
                const src = img.getAttribute('src') || img.getAttribute('data-src');
                if (src && !src.startsWith('data:')) {
                    // 如果有 data-src 却没 src，先给它一个 src 以便后续替换
                    if (!img.getAttribute('src')) img.setAttribute('src', src);
                    tasks.push({ type: 'content-img', articleIndex: index, element: img, url: src });
                }
            });

            // 处理视频和音频 (Bug 2 修复)
            const media = doc.querySelectorAll('video, audio, source');
            media.forEach(m => {
                const src = m.getAttribute('src');
                if (src && !src.startsWith('data:')) {
                    tasks.push({ type: 'content-media', articleIndex: index, element: m as HTMLElement, url: src });
                }
            });

            // 暂时存回 doc，处理完任务后再更新 content
            (article as any)._doc = doc;
        }
    });

    // 并发执行器
    async function worker(taskQueue: Task[]) {
        while (taskQueue.length > 0) {
            const task = taskQueue.shift();
            if (!task) continue;

            try {
                const base64 = await urlToBase64(task.url);
                const article = newArticles[task.articleIndex];

                if (task.type === 'cover') {
                    article.coverImage = base64;
                } else if (task.type === 'back') {
                    article.backImage = base64;
                } else if (task.type === 'content-img' && task.element) {
                    (task.element as HTMLImageElement).setAttribute('src', base64);
                    (task.element as HTMLImageElement).removeAttribute('onerror');
                } else if (task.type === 'content-media' && task.element) {
                    // 对于视频/音频，如果是 source 标签也要处理
                    task.element.setAttribute('src', base64);
                }
            } catch (e) {
                console.error(`Failed to process task: ${task.type} for article ${task.articleIndex}`, e);
            }
        }
    }

    // 启动指定数量的 worker
    const workers = Array(Math.min(CONCURRENCY_LIMIT, tasks.length))
        .fill(null)
        .map(() => worker(tasks));

    await Promise.all(workers);

    // 完成后清理并更新内容
    return newArticles.map(article => {
        const anyArt = article as any;
        if (anyArt._doc) {
            anyArt.content = anyArt._doc.body.innerHTML;
            delete anyArt._doc;
        }
        return article;
    });
}

// 同步版本的导出HTML生成函数，从App.tsx迁移而来
export function generateExportHtml(
    options: { useAlternateDesign: boolean },
    sortedArticles: Article[],
    logo: string,
    sidebarMeta: string
): string {
    // 使用字符串拼接避免TypeScript将模板字符串解析为JSX
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SWS 工法情报 - 离线阅读版</title>
<style>
/* CSS Reset & Basic Layout */
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; background: #f3f4f6; color: #111; height: 100vh; overflow: hidden; display: flex; }
#app-root { display: flex; width: 100%; height: 100%; }

/* Sidebar */
#sidebar { width: 300px; background: #fcfcfc; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; flex-shrink: 0; transition: transform 0.3s; z-index: 50; }
#sidebar.hidden { transform: translateX(-100%); position: absolute; height: 100%; }
.sidebar-header { padding: 45px 30px 20px 30px; border-bottom: 1px dashed transparent; }
.sidebar-header h1 { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", sans-serif; font-size: 22px; color: #111; }
.sidebar-meta { font-size: 12px; color: #6b7280; padding: 2px 0; margin-top: 5px; border-bottom: 1px dashed #eee; }
.search-box { padding: 10px 30px 20px 30px; }
.search-input { width: 100%; padding: 8px 12px; background: #f9fafb; border: 1px solid transparent; border-radius: 4px; font-size: 13px; outline: none; }
.search-input:focus { background: white; border-color: #005596; box-shadow: 0 0 0 2px rgba(0,85,150,0.05); }
#article-list { flex: 1; overflow-y: auto; list-style: none; padding: 0 15px; margin: 0; }
.nav-item { padding: 14px 15px; cursor: pointer; border-left: 2px solid transparent; margin-bottom: 2px; border-radius: 4px; transition: all 0.2s; }
.nav-item:hover { background: #f3f4f6; }
.nav-item.active { background: #eff6ff; border-left-color: #005596; }
.nav-item-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px; }
.nav-item.active .nav-item-title { color: #005596; }
.nav-item-meta { font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
.sidebar-footer { padding: 15px 30px 20px 30px; border-top: 1px solid #e5e7eb; }
.sidebar-logo { max-height: 40px; max-width: 100%; opacity: 0.8; }

/* Main Content Area */
#main { flex: 1; position: relative; overflow-y: auto; overflow-x: hidden; background: #f3f4f6; scroll-behavior: smooth; }
#content-container { min-height: 100%; transition: all 0.3s; }

/* Styles for Normal Article Container */
.normal-container { max-width: 850px; margin: 40px auto; background: white; padding: 80px 100px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-height: 1000px; animation: fadeIn 0.5s; }
.immersive-container { width: 100%; min-height: 100vh; background: white; animation: fadeIn 0.5s; display: flex; flex-direction: column; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Shared Unified Styles (Injected) */
${UNIFIED_STYLES}

/* Cover & Back Specific Styles (Mimicking PaperView.tsx) */
.cover-root { width: 100%; min-height: 100vh; display: flex; flex-direction: column; padding: 30px 50px; border-top: 8px solid #005596; position: relative; overflow: hidden; background: white; }
.ambient-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.3; filter: blur(60px); transform: scale(1.2); z-index: 0; pointer-events: none; }
.tech-grid { position: absolute; inset: 0; opacity: 0.03; background-image: linear-gradient(#005596 1px, transparent 1px), linear-gradient(90deg, #005596 1px, transparent 1px); background-size: 40px 40px; z-index: 0; pointer-events: none; }
.cover-header { position: relative; z-index: 2; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 15px; }
.cover-sub { font-size: 10px; font-weight: 800; color: #005596; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px; }
.cover-meta { display: flex; gap: 8px; font-size: 12px; font-weight: bold; color: #333; margin-top: 5px; }
.cover-img-box { flex-grow: 1; display: flex; justify-content: center; align-items: center; position: relative; z-index: 1; min-height: 500px; }
.cover-img { max-width: 100%; max-height: 70vh; box-shadow: 0 20px 50px -12px rgba(0,0,0,0.5); border-radius: 2px; }
.cover-footer { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding-top: 15px; margin-top: 15px; }
.back-title { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", sans-serif; font-size: 36px; font-weight: bold; color: #003366; text-transform: uppercase; letter-spacing: 2px; margin: 0; }

/* Magazine Style Classes */
.magazine-cover {
  width: 100%;
  min-height: 840px;
  display: flex;
  flex-direction: column;
  padding: 40px 60px;
  background: white;
  text-align: left;
  position: relative;
  overflow: hidden;
}
.magazine-bg-gradient {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(to bottom right, #ebf8ff, white, #f3f4f6);
}
.magazine-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  z-index: 2;
  margin-bottom: 25px;
  flex-shrink: 0;
  width: 100%;
  position: relative;
}
.magazine-header-title {
  font-family: sans-serif;
  font-size: 9px;
  font-weight: 900;
  color: #005596;
  letter-spacing: 4px;
  text-transform: uppercase;
  width: 100%;
  margin-bottom: 2px;
}
.magazine-header-divider {
  height: 1px;
  width: 100%;
  background: linear-gradient(to right, transparent, #00559680, transparent);
  margin-bottom: 15px;
}
.magazine-main-title {
  font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", sans-serif;
  font-size: 72px;
  font-weight: 900;
  letter-spacing: -1px;
  line-height: 0.85;
  color: #111;
  margin-bottom: 5px;
}
.magazine-title-underline {
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 64px;
  height: 1px;
  background: linear-gradient(to right, #005596, transparent);
}
.magazine-meta-container {
  display: flex;
  gap: 15px;
  align-items: center;
  justify-content: flex-start;
  font-family: sans-serif;
  color: #333;
  font-size: 11px;
  font-weight: bold;
  margin-top: 15px;
}
.magazine-meta-badge {
  min-width: 60px;
  text-align: center;
  padding: 8px;
  border-radius: 9999px;
  border: 1px solid rgba(0,85,150,0.3);
  background: rgba(255,255,255,0.5);
  backdrop-filter: blur(4px);
}
.magazine-image-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1;
  width: 100%;
  min-height: 520px;
  margin-top: 5px;
  position: relative;
}
.magazine-image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
}
.magazine-image {
  width: auto;
  height: auto;
  max-width: 85%;
  max-height: 85%;
  object-fit: contain;
  position: relative;
  z-index: 1;
  box-shadow: 0 25px 60px -15px rgba(0,0,0,0.4);
  border-radius: 4px;
  transition: all 0.3s;
}
.magazine-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 2;
  padding-top: 20px;
  flex-shrink: 0;
  margin-top: 20px;
  width: 100%;
  position: relative;
}
.magazine-footer-text {
  font-size: 9px;
  color: #9ca3af;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-weight: bold;
}
.magazine-button {
  font-size: 11px;
  font-weight: bold;
  color: white;
  background: linear-gradient(to right, #005596, #003366);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,85,150,0.3);
  text-transform: uppercase;
  letter-spacing: 2px;
  transition: all 0.2s;
}
.magazine-button:hover {
  opacity: 0.9;
  transform: translateX(1px);
}
.magazine-back-cover {
  width: 100%;
  min-height: 840px;
  display: flex;
  flex-direction: column;
  padding: 40px 60px;
  background: white;
  text-align: left;
  position: relative;
  overflow: hidden;
}
.magazine-back-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8));
}
.magazine-back-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  z-index: 2;
  margin-bottom: 25px;
  flex-shrink: 0;
  width: 100%;
  position: relative;
}
.magazine-back-title {
  font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", sans-serif;
  font-size: 64px;
  font-weight: 900;
  letter-spacing: -2px;
  line-height: 0.9;
  color: #111;
  margin-bottom: 5px;
  font-style: italic;
  transform: rotate(-2deg);
  transform-origin: left;
}
.magazine-back-title-underline {
  position: absolute;
  bottom: -12px;
  left: 0;
  width: 96px;
  height: 2px;
  background: linear-gradient(to right, #005596, transparent);
}
.magazine-back-image-container {
  flex-grow: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: visible;
  min-height: 520px;
  margin-bottom: 25px;
}
.magazine-back-image {
  width: auto;
  height: auto;
  max-width: 80%;
  max-height: 80%;
  object-fit: contain;
  box-shadow: 0 20px 50px -10px rgba(0,0,0,0.3);
  border-radius: 8px;
  transition: all 0.3s;
}
.magazine-back-footer {
  width: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  z-index: 2;
  flex-shrink: 0;
  position: relative;
}
.magazine-back-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 40%;
}
.magazine-back-company {
  font-size: 11px;
  color: #6b7280;
  letter-spacing: 1px;
  font-weight: bold;
  text-transform: uppercase;
}
.magazine-back-address {
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.4;
}
.magazine-back-copyright {
  margin-top: 10px;
  font-size: 9px;
  color: #9ca3af;
}
.magazine-back-center {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.magazine-back-team {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  font-size: 11px;
  color: #4b5563;
  font-family: sans-serif;
}
.magazine-back-team-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.magazine-back-team-label {
  font-size: 9px;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.magazine-back-barcode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-top: 5px;
}
.magazine-back-barcode-line {
  height: 2px;
  width: 100%;
  background: linear-gradient(to right, transparent, #d1d5db, transparent);
}
.magazine-back-barcode-text {
  font-size: 8px;
  color: #9ca3af;
  letter-spacing: 3px;
}
.magazine-back-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
.magazine-back-logo {
  height: 25px;
  width: auto;
}
.magazine-back-logo-underline {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, #00559680, transparent);
}
.magazine-back-info {
  font-size: 9px;
  color: #9ca3af;
  text-align: right;
}
.magazine-decoration-circle {
  position: absolute;
  top: 80px;
  left: 40px;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0,85,150,0.2);
  border-radius: 50%;
}
.magazine-decoration-square {
  position: absolute;
  bottom: 80px;
  right: 40px;
  width: 8px;
  height: 8px;
  border: 1px solid rgba(0,85,150,0.2);
}
.magazine-decoration-line {
  position: absolute;
  top: 160px;
  right: 80px;
  width: 24px;
  height: 1px;
  background: linear-gradient(to right, transparent, #00559630);
}

/* Bottom Navigation Cards */
.bottom-nav { width: 100%; max-width: 850px; margin: 50px auto 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 0 20px; box-sizing: border-box; }
.nav-card { padding: 20px; border-radius: 16px; background: white; border: 1px solid #f3f4f6; display: flex; flex-direction: column; cursor: pointer; transition: all 0.3s; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.nav-card:hover { border-color: #00559630; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.nav-card.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.nav-label { font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
.nav-title { font-size: 14px; font-weight: bold; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 0.3s; }
.nav-card:hover .nav-title { color: #005596; }
.nav-card.next { text-align: right; align-items: flex-end; }
@media (max-width: 640px) { .bottom-nav { grid-template-columns: 1fr; } }

/* Top Right Controls */
#top-controls { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
.control-btn { width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4b5563; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: all 0.2s; }
.control-btn:hover { color: #005596; transform: scale(1.05); }

/* Article Header in Normal View */
.article-header { margin-bottom: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; }
.article-header h1 { font-family: ui-serif, Georgia, serif; font-size: 32px; color: #111; margin: 0 0 15px 0; line-height: 1.3; font-weight: bold; tracking: 1px; }
.article-meta { color: #9ca3af; font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px 15px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; align-items: center; margin-top: 4px; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag-item { padding: 1px 6px; background: #f3f4f6; color: #111; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid rgba(209, 213, 219, 0.5); white-space: nowrap; line-height: 1.4; display: inline-block; }
.sws-prose { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", sans-serif; font-size: 18px; line-height: 2.0; color: #374151; text-align: justify; }
.pdf-viewer { width: 100%; height: 85vh; min-height: 600px; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 24px; margin-top: 30px; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.pdf-toolbar { height: 48px; background: white; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; user-select: none; }
.pdf-toolbar-title { font-size: 11px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
.pdf-fullscreen-btn { background: rgba(0,85,150,0.1); border: 1px solid rgba(0,85,150,0.2); border-radius: 6px; padding: 6px 12px; font-size: 11px; font-weight: bold; color: #005596; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
.pdf-fullscreen-btn:hover { background: rgba(0,85,150,0.2); }
.pdf-fullscreen-btn:hover { background: #005596; transform: scale(1.05); }
.pdf-open-link { position: absolute; bottom: 16px; right: 16px; z-index: 10; background: white; padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; color: #005596; text-decoration: none; display: flex; align-items: center; gap: 4px; transition: all 0.2s; }
.pdf-open-link:hover { background: #f3f4f6; border-color: #005596; }
.pdf-viewer.expanded { border-radius: 0; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; background: white; }
.end-mark { text-align: center; margin-top: 50px; font-size: 10px; color: #e5e7eb; letter-spacing: 2px; text-transform: uppercase; }

/* Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }

/* --- 打印专用样式 (A4 适配版) --- */
@media print {
    @page { 
        margin: 10mm; /* 标准 A4 边距 */
        size: A4 portrait; 
    }

    /* 强制打印背景色与图形 */
    * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        color-adjust: exact !important;
    }

    /* 基础重置：确保容器不会截断分页 */
    body { background: white !important; height: auto !important; overflow: visible !important; display: block !important; }
    #app-root { display: block !important; height: auto !important; }
    #main, #content-container { 
        overflow: visible !important; 
        height: auto !important; 
        display: block !important; 
        margin: 0 !important; 
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
    }
    
    /* 隐藏交互元素 */
    #sidebar, #fab-nav, #top-controls, .magazine-button, .fab-btn, .fab-divider, .pdf-viewer-container, .pdf-expand-btn, .bottom-nav { 
        display: none !important; 
    }
    
    /* 核心逻辑：区分“打印当前”和“打印全书” */
    body:not(.print-all) .article-wrapper:not(.active) { display: none !important; }
    body:not(.print-all) .toc-page { display: none !important; }

    /* 分页控制：确保封面封底独立成页 */
    .article-wrapper, .toc-page, .normal-container, .immersive-container {
        display: block !important; 
        page-break-after: always; 
        break-after: page; 
        min-height: 0 !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border: none !important;
        padding: 20px 0 !important;
        margin: 0 !important;
    }
    
    /* 封面封底强制铺满 A4 */
    .cover-root, .magazine-cover, .magazine-back-cover, .normal-back-root {
        width: 100% !important; 
        height: 297mm !important; 
        min-height: 297mm !important;
        margin: 0 !important; 
        padding: 0 !important; 
        page-break-after: always; 
        break-after: page;
        border: none !important;
    }

    /* 内容防截断：禁止在图片、段落、卡片中间分页 */
    .sws-prose p, 
    .sws-prose img, 
    .summary-card, 
    .media-print-badge,
    .pdf-print-fallback,
    .pdf-page-container, /* 新增：防止PDF图片被切断 */
    h1, h2, h3 { 
        page-break-inside: avoid; 
        break-inside: avoid; 
    }

    /* 字体优化 */
    .sws-prose p { font-size: 12pt !important; line-height: 1.6 !important; text-align: justify; }
    .article-header h1 { font-size: 24pt !important; color: #000 !important; text-align: center; }

    /* 显示打印专用提示 */
    .print-only { display: block !important; }
    .pdf-print-fallback {
        border: 2px dashed #9ca3af;
        background: #f9fafb;
        padding: 20px;
        margin: 20px 0;
        border-radius: 8px;
        text-align: center;
        font-size: 10pt;
        color: #4b5563;
    }
}
</style>
</head>
<body>
<div id="app-root">
    <div id="top-controls">
        <button class="control-btn" onclick="app.toggleSidebar()" title="切换侧边栏">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${SVG_ICONS.MENU}"/></svg>
        </button>
        <button class="control-btn" onclick="app.toggleFullscreen()" title="全屏阅读">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="${SVG_ICONS.FULLSCREEN}"/></svg>
        </button>
    </div>

    <div id="sidebar">
        <div class="sidebar-header">
            <div class="relative">
              <svg class="sidebar-title-svg" viewBox="0 0 400 60" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:200px;">
                <defs>
                  <linearGradient id="sidebarTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#005596; stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#003366; stop-opacity:1" />
                  </linearGradient>
                </defs>
                <text x="50%" y="45" text-anchor="middle" font-family="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" font-weight="bold" font-size="48" fill="url(#sidebarTitleGradientExport)" letter-spacing="10">工法情报</text>
              </svg>
            </div>
            <div class="sidebar-meta">${sidebarMeta}</div>
        </div>
        <div class="search-box">
            <input type="text" id="search-input" class="search-input" placeholder="Search..." />
        </div>
        <ul id="article-list"></ul>
        <div class="sidebar-footer">
            <div style="font-size: 9px; color: #d1d5db; letter-spacing: 1.5px; font-weight: bold; margin-bottom: 10px;">PRODUCED BY</div>
            ${logo ? `<img src="${logo}" class="sidebar-logo" />` : ''}
        </div>
    </div>
    <div id="main">
        <div id="content-container"></div>
    </div>
    <div id="navigation-root"></div>
</div>

<script>
    const DATA = ${JSON.stringify(sortedArticles)};
    const LOGO = "${logo}";
    
const app = {
    data: DATA,
    currentIndex: 0,
    alternateDesign: ${options.useAlternateDesign}, // 使用传入的选项
    currentBlobUrls: [],
        
        // Memory Optimization: Convert Base64 string to Blob URL
        base64ToBlobUrl(base64) {
            if (!base64) return null;
            if (!base64.startsWith('data:')) return base64;
            try {
                const split = base64.split(',');
                const type = split[0].match(/:(.*?);/)[1];
                const bin = atob(split[1]);
                const len = bin.length;
                const arr = new Uint8Array(len);
                for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
                const blob = new Blob([arr], { type: type });
                const url = URL.createObjectURL(blob);
                this.currentBlobUrls.push(url);
                return url;
            } catch(e) { 
                console.error("Blob conversion failed", e);
                return base64; 
            }
        },

        init() {
            this.renderList();
            this.loadArticle(0);
            
            document.getElementById('search-input').addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                this.renderList(term);
            });
        },
        
        toggleSidebar() {
            const s = document.getElementById('sidebar');
            s.classList.toggle('hidden');
        },

        toggleFullscreen() {
           if (!document.fullscreenElement) {
               document.documentElement.requestFullscreen().catch(err => console.log(err));
           } else {
               document.exitFullscreen();
           }
        },

        renderList(term = '') {
            const listEl = document.getElementById('article-list');
            listEl.innerHTML = '';
            this.data.forEach((item, index) => {
                if (term && !item.title.toLowerCase().includes(term)) return;
                
                const li = document.createElement('li');
                li.className = 'nav-item ' + (index === this.currentIndex ? 'active' : '');
                li.onclick = () => this.loadArticle(index);
                li.innerHTML = \`
                    <div class="nav-item-title">\${item.category === '封面' || item.category === '封底' ? '<span style="color:#005596">['+item.category+']</span> ' : ''}\${item.title}</div>
                    <div class="nav-item-meta"><span>\${item.date || ''}</span></div>
                \`;
                listEl.appendChild(li);
            });
        },

        loadArticle(index) {
            if (index < 0 || index >= this.data.length) return;
            
            // CLEANUP: Revoke old object URLs to free memory before loading new ones
            if (this.currentBlobUrls.length > 0) {
                this.currentBlobUrls.forEach(url => URL.revokeObjectURL(url));
                this.currentBlobUrls = [];
            }

            this.currentIndex = index;
            
            // Update Sidebar Active State
            const items = document.querySelectorAll('.nav-item');
            items.forEach((el, i) => {
                if (i === index) el.classList.add('active');
                else el.classList.remove('active');
            });

            const article = this.data[index];
            const container = document.getElementById('content-container');
            const main = document.getElementById('main');
            
            // Reset Scroll
            main.scrollTop = 0;

            // Render Logic
            if (article.category === '封面') {
                this.renderCover(container, article);
            } else if (article.category === '封底') {
                this.renderBack(container, article);
            } else {
                this.renderNormal(container, article);
            }

            // Sidebar Auto Hide Logic mimics app
            const isSpecial = article.category === '封面' || article.category === '封底';
            const sidebar = document.getElementById('sidebar');
            
            if (isSpecial) {
                sidebar.classList.add('hidden');
                main.style.marginLeft = '0';
            } else {
                sidebar.classList.remove('hidden');
                main.style.marginLeft = '0';
            }
        },

        renderCover(el, article) {
            const imgUrl = this.base64ToBlobUrl(article.coverImage);
                if (this.alternateDesign) {
                    // 杂志风封面设计
                    el.innerHTML = \`
                        <div class="magazine-cover">
                            <div class="magazine-bg-gradient"></div>
                            
                            <div class="magazine-header">
                                <div class="magazine-header-title">
                                    SHIP CONSTRUCTION METHOD
                                </div>
                                <div class="magazine-header-divider"></div>
                                
                                <div class="relative">
                                    <svg class="magazine-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:400px;">
                                        <defs>
                                            <linearGradient id="magazineTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" style="stop-color:#005596; stop-opacity:1" />
                                                <stop offset="100%" style="stop-color:#003366; stop-opacity:1" />
                                            </linearGradient>
                                        </defs>
                                        <text x="50%" y="85" text-anchor="middle" font-family="&apos;PingFang SC&apos;, &apos;Microsoft YaHei&apos;, &apos;SimHei&apos;, &apos;STHeiti&apos;, &apos;Heiti SC&apos;, sans-serif" font-weight="bold" font-size="90" fill="url(#magazineTitleGradientExport)" letter-spacing="15">工法情报</text>
                                    </svg>
                                    <div class="magazine-title-underline"></div>
                                </div>
                                
                                <div class="magazine-meta-container">
                                    <div class="magazine-meta-badge">
                                        \${article.issueText || "NO.01"}
                                    </div>
                                    <span style="color:#00559680; font-size:12px;">•</span>
                                    <div class="magazine-meta-badge">
                                        \${article.dateText || "JAN 2025"}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="magazine-image-container">
                               <div class="magazine-image-wrapper">
                                 \${imgUrl ? \`
                                    <div class="relative">
                                        <img src="\${imgUrl}" alt="Cover" class="magazine-image" />
                                    </div>
                                 \` : \`
                                    <button type="button" style="color:#6b7280; font-size:14px; background:rgba(255,255,255,0.9); backdrop-filter:blur(4px); padding:16px 32px; border:2px dashed #d1d5db; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); cursor:pointer; font-weight:bold; transition:all 0.2s;">
                                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                                            <div style="width:40px; height:40px; border-radius:50%; background:rgba(0,85,150,0.1); display:flex; align-items:center; justify-content:center;">
                                                <svg style="width:20px; height:20px; color:#005596;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="${SVG_ICONS.CAMERA}"></path></svg>
                                            </div>
                                            <span>添加封面图片</span>
                                            <span style="font-size:11px; font-weight:normal; color:#9ca3af;">建议尺寸 1200×1600</span>
                                        </div>
                                    </button>
                                 \`}
                               </div>
                            </div>
                            
                            <div class="magazine-footer">
                                <div class="magazine-footer-text">
                                    OFFICIAL PUBLICATION
                                </div>
                                <div onclick="app.next()" class="magazine-button">
                                    开始阅读 <svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="${SVG_ICONS.ARROW_RIGHT}"></path></svg>
                                </div>
                            </div>
                            
                            <div class="magazine-decoration-circle"></div>
                            <div class="magazine-decoration-square"></div>
                        </div>
                    \`;
            } else {
                // 原版封面设计
                el.innerHTML = \`
                    <div class="cover-root">
                        <div class="tech-grid"></div>
                        \${imgUrl ? \`<div class="ambient-bg" style="background-image: url('\${imgUrl}')"></div>\` : ''}
                        
                        <div class="cover-header">
                            <div class="cover-sub">Ship Construction Method Information</div>
                            <svg class="cover-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:320px;">
                                <defs>
                                    <linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596"/><stop offset="100%" style="stop-color:#003366"/></linearGradient>
                                </defs>
                                <text x="50%" y="85" text-anchor="middle" fill="url(#g1)" font-family="'Songti SC', 'SimSun', 'STSong', serif" font-weight="bold" font-size="90" letter-spacing="15">工法情报</text>
                            </svg>
                            <div class="cover-meta">
                                <span>\${article.issueText || 'NO.01'}</span> <span>·</span> <span>\${article.dateText || 'JAN 2025'}</span>
                            </div>
                        </div>

                        <div class="cover-img-box">
                             \${imgUrl ? \`<img src="\${imgUrl}" class="cover-img" />\` : ''}
                        </div>

                        <div class="cover-footer">
                            <div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px);opacity:0.4;"></div>
                            <div style="font-size:10px;font-weight:bold;color:#005596;cursor:pointer;" onclick="app.next()">开始阅读 ❯</div>
                        </div>
                    </div>
                \`;
            }
        },

        renderBack(el, article) {
            const imgUrl = this.base64ToBlobUrl(article.backImage);
            if (this.alternateDesign) {
                // 杂志风封底设计
                el.innerHTML = \`
                    <div class="magazine-back-cover">
                        <div class="magazine-back-bg"></div>
                        
                        <div class="magazine-back-header">
                            <div class="magazine-header-title">
                                SHIP CONSTRUCTION METHOD
                            </div>
                            <div class="magazine-header-divider"></div>
                            
                            <div class="relative">
                                <h1 class="magazine-back-title" style="background: linear-gradient(to right, #005596, #003366); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                    Sailing With Success
                                </h1>
                                <div class="magazine-back-title-underline"></div>
                            </div>
                        </div>
                        
                        <div class="magazine-back-image-container">
                           <div class="magazine-image-wrapper">
                               \${imgUrl ? \`<div class="relative">
                                        <img src="\${imgUrl}" alt="Back Cover" class="magazine-back-image" />
                                    </div>\` : \`<button type="button" style="color:#6b7280; font-size:14px; background:rgba(255,255,255,0.9); backdrop-filter:blur(4px); padding:16px 32px; border:2px dashed #d1d5db; border-radius:12px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); cursor:pointer; font-weight:bold; transition:all 0.2s;">
                                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                                            <div style="width:40px; height:40px; border-radius:50%; background:rgba(0,85,150,0.1); display:flex; align-items:center; justify-content:center;">
                                                <svg style="width:20px; height:20px; color:#005596;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="${SVG_ICONS.CAMERA}"></path></svg>
                                            </div>
                                            <span>添加封底图片</span>
                                            <span style="font-size:11px; font-weight:normal; color:#9ca3af;">建议尺寸 1200×1600</span>
                                        </div>
                                    </button>\`}
                           </div>
                        </div>
                        
                        <div class="magazine-back-footer">
                            <div class="magazine-back-left">
                                <div class="magazine-back-company">
                                    SWS OFFSHORE
                                </div>
                                <div class="magazine-back-address">
                                    Shanghai Waigaoqiao Shipbuilding Co., Ltd.<br />
                                    上海外高桥造船有限公司
                                </div>
                                <div class="magazine-back-copyright">
                                    © 2025 Ship Construction Method Information
                                </div>
                            </div>
                            
                            <div class="magazine-back-center">
                                <div class="magazine-back-team">
                                    <div class="magazine-back-team-item">
                                        <div class="magazine-back-team-label">编辑</div>
                                        <b>马李琛</b>
                                    </div>
                                    <div class="magazine-back-team-item">
                                        <div class="magazine-back-team-label">校对</div>
                                        <b>胡国超</b>
                                    </div>
                                    <div class="magazine-back-team-item">
                                        <div class="magazine-back-team-label">审核</div>
                                        <b>储年生</b>
                                    </div>
                                </div>
                                
                                <div class="magazine-back-barcode">
                                    <div class="magazine-back-barcode-line"></div>
                                    <div class="magazine-back-barcode-text">ISSN 0000-0000</div>
                                </div>
                            </div>
                            
                            <div class="magazine-back-right">
                                \${LOGO ? \`<div class="relative"><img src="\${LOGO}" class="magazine-back-logo" alt="Logo" /><div class="magazine-back-logo-underline"></div></div>\` : ''}
                                <div class="magazine-back-info">
                                    Official Publication<br />
                                    Volume \${article.issueText || "01"} · \${article.dateText || "JAN 2025"}
                                </div>
                            </div>
                        </div>
                        
                        <div class="magazine-decoration-circle"></div>
                        <div class="magazine-decoration-square"></div>
                    </div>
                \`;
            } else {
                // 原版封底设计
                const backImgHtml = imgUrl ? \`<div class="ambient-bg" style="background-image: url('\${imgUrl}')"></div>\` : '';
                const backImgBoxHtml = imgUrl ? \`<img src="\${imgUrl}" class="cover-img" />\` : '';
                const logoHtml = LOGO ? \`<img src="\${LOGO}" style="height:20px;" />\` : '';
                el.innerHTML = \`
                    <div class="cover-root">
                         <div class="tech-grid"></div>
                        \${backImgHtml}

                        <div class="cover-header">
                            <div class="cover-sub">Ship Construction Method Information</div>
                            <h2 class="back-title">Sailing With Success</h2>
                        </div>

                        <div class="cover-img-box">
                             \${backImgBoxHtml}
                        </div>

                        <div class="cover-footer">
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-size:10px;font-weight:bold;color:#9ca3af;letter-spacing:1px;">SWS OFFSHORE</span>
                                <span style="font-size:9px;color:#9ca3af;">Shanghai Waigaoqiao Shipbuilding Co., Ltd.</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:20px;">
                                 <div style="display:flex; gap:15px; font-size:11px; color:#666; font-family:sans-serif;">
                                    <div style="display:flex; gap:4px; white-space:nowrap;"><span>编辑:</span> <b>马李琛</b></div>
                                    <div style="display:flex; gap:4px; white-space:nowrap;"><span>校对:</span> <b>胡国超</b></div>
                                    <div style="display:flex; gap:4px; white-space:nowrap;"><span>审核:</span> <b>储年生</b></div>
                                 </div>
                                 \${logoHtml}
                            </div>
                        </div>
                    </div>
                \`;
            }
        },

        renderNormal(el, article) {
            const pdfUrl = this.base64ToBlobUrl(article.pdfData);
            el.innerHTML = \`
                <div class="normal-container">
                    <div class="article-header">
                        <h1>\${article.title}</h1>
                        <div class="article-meta">
                            \${article.tags && article.tags.length > 0 ? \`
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6; margin-top:2px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <div class="tag-cloud">
                                    \${article.tags.map(t => \`<span class="tag-item">\${t}</span>\`).join('')}
                                </div>
                            \` : \`<span>分类: \${article.category}</span>\`}
                        </div>
                    </div>
                    
                    <div class="sws-prose article-body">
                        \${article.content}
                    </div>

                    \${pdfUrl ? \`
                        <div class="pdf-viewer" id="pdf-viewer-\${article.id}">
                           <div class="pdf-toolbar">
                               <div class="pdf-toolbar-title">
                                   <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                   PDF PREVIEW
                               </div>
                               <button class="pdf-fullscreen-btn" onclick="app.togglePdfFullscreen('\${article.id}')">
                                   <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="${SVG_ICONS.EXPAND}"></path></svg>
                                   全屏阅读
                               </button>
                           </div>
                           <div style="flex:1; width:100%; position:relative; background: #f3f4f6;">
                               <a class="pdf-open-link" href="\${pdfUrl}" target="_blank" rel="noreferrer">
                                   <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="${SVG_ICONS.EXTERNAL_LINK}"></path></svg>
                                   无法预览？点击打开PDF
                               </a>
                               <object data="\${pdfUrl}" type="application/pdf" style="width:100%;height:100%;display:block;"></object>
                           </div>
                        </div>
                    \` : ''}

                    <div style="width: 100%; margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; box-sizing: border-box; text-align: left;">
                        <a style="text-decoration: none; display: block; \${this.currentIndex === 0 ? 'opacity: 0.3; pointer-events: none;' : 'cursor: pointer;'}" onclick="\${this.currentIndex > 0 ? 'app.prev()' : ''}">
                            <div style="padding: 20px; border-radius: 16px; background: white; border: 1px solid #f3f4f6; display: flex; flex-direction: column; transition: all 0.3s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <div style="font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(180deg);"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                    上一篇
                                </div>
                                <div style="font-size: 14px; font-weight: bold; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    \${this.currentIndex > 0 ? this.data[this.currentIndex - 1].title : '已是第一篇'}
                                </div>
                            </div>
                        </a>
                        <a style="text-decoration: none; display: block; \${this.currentIndex === this.data.length - 1 ? 'opacity: 0.3; pointer-events: none;' : 'cursor: pointer;'}" onclick="\${this.currentIndex < this.data.length - 1 ? 'app.next()' : ''}">
                            <div style="padding: 20px; border-radius: 16px; background: white; border: 1px solid #f3f4f6; display: flex; flex-direction: column; transition: all 0.3s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align: right; align-items: flex-end;">
                                <div style="font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                                    下一篇
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                </div>
                                <div style="font-size: 14px; font-weight: bold; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    \${this.currentIndex < this.data.length - 1 ? this.data[this.currentIndex + 1].title : '已是最后一篇'}
                                </div>
                            </div>
                        </a>
                    </div>

                    <div style="margin-top:50px; padding-top:20px; border-top:1px solid #f3f4f6; text-align:center; opacity:0.4; font-size:10px; color:#9ca3af; letter-spacing:2px; text-transform:uppercase; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;">
                        \${LOGO ? \`<img src="\${LOGO}" style="height:25px; opacity:0.5; vertical-align:middle; margin-right:8px; display:inline-block;" />\` : ''}
                        SWS KNOWLEDGE BASE
                    </div>
                    <div style="text-align:center; margin:40px auto 0; font-size:10px; color:#e5e7eb; letter-spacing:2px; opacity:0.6;">- End of Article -</div>
                </div>
            \`;
        },

        next() {
            if (this.currentIndex < this.data.length - 1) this.loadArticle(this.currentIndex + 1);
        },
        prev() {
            if (this.currentIndex > 0) this.loadArticle(this.currentIndex - 1);
        },
        togglePdfFullscreen(id) {
            const container = document.getElementById('pdf-viewer-' + id);
            if (!container) return;
            
            if (container.classList.contains('expanded')) {
                container.classList.remove('expanded');
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(err => console.log(err));
                }
            } else {
                container.classList.add('expanded');
                if (container.requestFullscreen) {
                    container.requestFullscreen().catch(err => console.log(err));
                }
            }
        }
    };

    app.init();
</script>
</body>
</html>`;
    return html;
}

export async function generateReaderHTML(
    articles: Article[],
    options: ExportOptions,
    metadata: ExportMetadata
): Promise<string> {
    const { logo, sidebarMeta } = metadata;
    const { useAlternateDesign } = options;

    // 预处理：将图片转换为 Base64 (支持离线)
    // 这一步可能比较耗时，但对于导出离线包是必须的
    const processedArticles = await processArticlesForExport(articles);

    const cover = processedArticles.find(a => a.category === '封面');
    const back = processedArticles.find(a => a.category === '封底');
    const normal = processedArticles.filter(a => a.category !== '封面' && a.category !== '封底');

    // 预处理文章数据
    const sortedArticles = [
        ...(cover ? [cover] : []),
        ...normal,
        ...(back ? [back] : [{
            id: 0,
            title: "封底",
            category: "封底",
            content: "",
            backImage: null, // 将使用默认样式
            issueText: cover?.issueText || "NO.01",
            dateText: cover?.dateText || "JAN 2025"
        }])
    ];

    const APP_CONFIG = {
        logo: logo || "",
        company: COMPANY_INFO,
        alternateDesign: useAlternateDesign,
    };

    // 生成目录 HTML
    const tocListHtml = normal.map((article) => `
    <li class="toc-item">
      <span class="toc-title">${escapeHtml(article.title)}</span>
      <span class="toc-dots"></span>
      <span class="toc-cat">${escapeHtml(article.category)}</span>
    </li>
  `).join('');

    // 构建完整的 HTML 字符串
    // 关键修复：所有 HTML 属性中的单引号 ' 均替换为 &apos; 以防止 JS 字符串冲突
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SWS 工法情报 - 离线阅读版</title>
<style>
/* --- 基础布局 --- */
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: #f3f4f6; color: #111; height: 100vh; overflow: hidden; display: flex; }
#app-root { display: flex; width: 100%; height: 100%; }

/* --- 侧边栏 --- */
#sidebar { width: 300px; background: #fcfcfc; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; flex-shrink: 0; transition: transform 0.3s; z-index: 50; }
#sidebar.hidden { transform: translateX(-100%); position: absolute; height: 100%; }
.sidebar-header { padding: 45px 30px 20px 30px; }
.sidebar-meta { font-size: 12px; color: #6b7280; padding: 2px 0; margin-top: 5px; border-bottom: 1px dashed #eee; }
.search-box { padding: 10px 30px 20px 30px; }
.search-input { width: 100%; padding: 8px 12px; background: #f9fafb; border: 1px solid transparent; border-radius: 4px; font-size: 13px; outline: none; }
#article-list { flex: 1; overflow-y: auto; list-style: none; padding: 0 15px; margin: 0; }
.nav-item { padding: 14px 15px; cursor: pointer; border-left: 2px solid transparent; margin-bottom: 2px; border-radius: 4px; transition: all 0.2s; }
.nav-item:hover { background: #f3f4f6; }
.nav-item.active { background: #eff6ff; border-left-color: #005596; }
.nav-item-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 4px; }
.nav-item-meta { font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
.sidebar-footer { padding: 15px 30px 20px 30px; border-top: 1px solid #e5e7eb; }
.sidebar-logo { max-height: 40px; max-width: 100%; opacity: 0.8; }

/* --- 主内容区 --- */
#main { flex: 1; position: relative; overflow-y: auto; background: #f3f4f6; scroll-behavior: smooth; min-height: 0; }
#content-container { min-height: 100%; transition: all 0.3s; display: flex; flex-direction: column; }
.article-wrapper { display: none; width: 100%; }
.article-wrapper.active { display: block; }
/* --- 样式注入 --- */
/* --- 文章底部标记 (与编辑版同步) --- */
.article-footer-info {
  margin-top: 50px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
  text-align: center;
  opacity: 0.4;
  font-size: 10px;
  color: #9ca3af;
  letter-spacing: 2px;
  text-transform: uppercase;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
.article-footer-logo {
  height: 25px;
  opacity: 0.5;
  vertical-align: middle;
  margin-right: 8px;
  display: inline-block;
}
.article-end-mark {
  text-align: center;
  margin: 40px auto 0;
  text-[10px];
  color: #e5e7eb;
  letter-spacing: 2px;
  opacity: 0.6;
}
.normal-container { max-width: 850px; margin: 40px auto; background: white; padding: 80px 100px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-height: 1000px; animation: fadeIn 0.5s; }
.immersive-container { width: 100%; min-height: 100vh; background: white; animation: fadeIn 0.5s; display: flex; flex-direction: column; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.article-header { margin-bottom: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; }
.article-header h1 { font-family: ui-serif, Georgia, serif; font-size: 32px; color: #111; margin: 0 0 15px 0; line-height: 1.3; font-weight: bold; letter-spacing: 1px; }
.article-meta { color: #9ca3af; font-size: 13px; display: flex; flex-wrap: wrap; gap: 8px 15px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; align-items: center; margin-top: 4px; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag-item { padding: 1px 8px; background: #f3f4f6; color: #111; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid rgba(209, 213, 219, 0.5); white-space: nowrap; line-height: 1.5; display: inline-block; }

${UNIFIED_STYLES}

/* --- 封底专用样式 --- */
/* 封底容器：全屏，背景图居中覆盖 */
.reader-back-cover {
  width: 100%;
  height: 100vh; /* 强制全屏高度 */
  background-color: #f3f4f6;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* 内容沉底 */
  align-items: center;
  overflow: hidden;
}

/* 底部信息卡片：半透明白色背景 */
.reader-back-info {
  width: 100%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  padding: 40px 20px 60px; /* 底部留白 */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.05);
}

/* Logo 样式 */
.reader-back-logo {
  height: 40px; /* 限制高度 */
  width: auto;
  object-fit: contain;
  margin-bottom: 16px;
}

/* 文字排版 */
.reader-company-en {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.reader-company-zh {
  font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 16px;
  color: #4b5563;
  margin-bottom: 8px;
}
.reader-copyright {
  font-size: 12px;
  color: #9ca3af;
}

/* --- 封面/封底组件样式 --- */
.cover-root { width: 100%; min-height: 100vh; display: flex; flex-direction: column; padding: 30px 50px; border-top: 8px solid #005596; position: relative; overflow: hidden; background: white; }
.ambient-bg { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.3; filter: blur(60px) saturate(180%) brightness(1.05); transform: scale(1.2); z-index: 0; pointer-events: none; }
.tech-grid { position: absolute; inset: 0; opacity: 0.03; background-image: linear-gradient(#005596 1px, transparent 1px), linear-gradient(90deg, #005596 1px, transparent 1px); background-size: 40px 40px; z-index: 0; pointer-events: none; }
.cover-header { position: relative; z-index: 2; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 15px; }
.cover-sub { font-size: 10px; font-weight: 800; color: #005596; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px; }
.cover-meta { display: flex; gap: 8px; font-size: 12px; font-weight: bold; color: #333; margin-top: 5px; }
.cover-img-box { flex-grow: 1; display: flex; justify-content: center; align-items: center; position: relative; z-index: 1; min-height: 500px; overflow: visible; }
.cover-img { max-width: 100%; max-height: 100%; box-shadow: 0 20px 50px -12px rgba(0,0,0,0.5); border-radius: 2px; object-fit: contain; will-change: transform; transform-origin: center; }
.cover-footer { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding-top: 15px; margin-top: 15px; }
.back-title { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 36px; font-weight: bold; color: #003366; text-transform: uppercase; letter-spacing: 2px; margin: 0; }

/* --- 杂志风样式 --- */
.magazine-cover { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; background: white; text-align: left; position: relative; overflow: hidden; }
.magazine-bg-gradient { position: absolute; inset: 0; z-index: 0; background: linear-gradient(to bottom right, #ebf8ff, white, #f3f4f6); }
.magazine-header { display: flex; flex-direction: column; align-items: flex-start; z-index: 2; margin-bottom: 25px; flex-shrink: 0; width: 100%; position: relative; }
.magazine-header-title { font-family: sans-serif; font-size: 9px; font-weight: 900; color: #005596; letter-spacing: 4px; text-transform: uppercase; width: 100%; margin-bottom: 2px; }
.magazine-header-divider { height: 1px; width: 100%; background: linear-gradient(to right, transparent, #00559680, transparent); margin-bottom: 15px; }
.magazine-title-underline { position: absolute; bottom: -2px; left: 0; width: 64px; height: 1px; background: linear-gradient(to right, #005596, transparent); }
.magazine-meta-container { display: flex; gap: 15px; align-items: center; justify-content: flex-start; font-family: sans-serif; color: #333; font-size: 11px; font-weight: bold; margin-top: 15px; }
.magazine-meta-badge { min-width: 60px; text-align: center; padding: 8px; border-radius: 9999px; border: 1px solid rgba(0,85,150,0.3); background: rgba(255,255,255,0.5); backdrop-filter: blur(4px); }
.magazine-image-container { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1; width: 100%; min-height: 520px; margin-top: 5px; position: relative; }
.magazine-image-wrapper { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: visible; }
.magazine-image { width: auto; height: auto; max-width: 85%; max-height: 85%; object-fit: contain; position: relative; z-index: 1; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.4); border-radius: 4px; transition: all 0.3s; }
.magazine-footer { display: flex; align-items: center; justify-content: space-between; z-index: 2; padding-top: 20px; flex-shrink: 0; margin-top: 20px; width: 100%; position: relative; }
.magazine-footer-text { font-size: 9px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
.magazine-button { font-size: 11px; font-weight: bold; color: white; background: linear-gradient(to right, #005596, #003366); display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,85,150,0.3); text-transform: uppercase; letter-spacing: 2px; transition: all 0.2s; }
.magazine-back-cover { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; background: white; text-align: left; position: relative; overflow: hidden; }
.magazine-back-bg { position: absolute; inset: 0; z-index: 0; background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8)); }
.magazine-back-header { display: flex; flex-direction: column; align-items: flex-start; z-index: 2; margin-bottom: 25px; flex-shrink: 0; width: 100%; position: relative; }
.magazine-back-title { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 64px; font-weight: 900; letter-spacing: -2px; line-height: 0.9; color: #111; margin-bottom: 5px; font-style: italic; transform: rotate(-2deg); transform-origin: left; }
.magazine-back-title-underline { position: absolute; bottom: -12px; left: 0; width: 96px; height: 2px; background: linear-gradient(to right, #005596, transparent); transform: rotate(2deg); }
.magazine-back-image-container { flex-grow: 1; width: 100%; display: flex; align-items: center; justify-content: center; position: relative; overflow: visible; min-height: 520px; margin-bottom: 25px; }
.magazine-back-image { width: auto; height: auto; max-width: 80%; max-height: 80%; object-fit: contain; box-shadow: 0 20px 50px -10px rgba(0,0,0,0.3); border-radius: 8px; transition: all 0.3s; }
.magazine-back-footer { width: 100%; display: flex; align-items: flex-start; justify-content: space-between; z-index: 2; flex-shrink: 0; position: relative; }
.magazine-back-left { display: flex; flex-direction: column; gap: 8px; max-width: 40%; }
.magazine-back-company { font-size: 11px; color: #6b7280; letter-spacing: 1px; font-weight: bold; text-transform: uppercase; }
.magazine-back-address { font-size: 10px; color: #9ca3af; line-height: 1.4; }
.magazine-back-copyright { margin-top: 10px; font-size: 9px; color: #9ca3af; }
.magazine-back-center { display: flex; flex-direction: column; gap: 12px; }
.magazine-back-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; font-size: 11px; color: #4b5563; font-family: sans-serif; }
.magazine-back-team-item { display: flex; flex-direction: column; gap: 2px; }
.magazine-back-team-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; }
.magazine-back-barcode { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-top: 5px; }
.magazine-back-barcode-line { height: 2px; width: 100%; background: linear-gradient(to right, transparent, #d1d5db, transparent); }
.magazine-back-barcode-text { font-size: 8px; color: #9ca3af; letter-spacing: 3px; }
.magazine-back-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.magazine-back-logo { height: 25px; width: auto; }
.magazine-back-logo-underline { position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, #00559680, transparent); }
.magazine-back-info { font-size: 9px; color: #9ca3af; text-align: right; }
.magazine-decoration-circle { position: absolute; top: 80px; left: 40px; width: 12px; height: 12px; border: 2px solid rgba(0,85,150,0.2); border-radius: 50%; }
.magazine-decoration-square { position: absolute; bottom: 80px; right: 40px; width: 8px; height: 8px; border: 1px solid rgba(0,85,150,0.2); }
.magazine-decoration-line { position: absolute; top: 160px; right: 80px; width: 24px; height: 1px; background: linear-gradient(to right, transparent, #00559630); }

/* --- Editor Normal Back Sync --- */
.normal-back-root { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 30px 50px; background: white; text-align: left; border-top: 8px solid #005596; position: relative; overflow: hidden; }
.normal-back-header { width: 100%; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 15px; flex-shrink: 0; position: relative; z-index: 2; }
.normal-back-sub { font-family: sans-serif; font-size: 10px; font-weight: 800; color: #005596; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 5px; }
.normal-back-title { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 36px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; line-height: 1.2; background: linear-gradient(to bottom, #005596, #003366); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #005596; margin: 0; }
.normal-back-footer { width: 100%; display: flex; align-items: center; justify-content: space-between; padding-top: 15px; margin-top: 15px; position: relative; z-index: 2; flex-shrink: 0; }
.normal-back-company-short { font-size: 10px; color: #9ca3af; letter-spacing: 1px; font-weight: bold; text-transform: uppercase; }
.normal-back-company-full { font-size: 9px; font-weight: normal; color: #9ca3af; }
.normal-back-team { display: flex; gap: 15px; font-size: 11px; color: #666; font-family: sans-serif; }
.normal-back-team-item { display: flex; gap: 4px; white-space: nowrap; }
.normal-back-team-item b { font-weight: bold; }
.normal-back-logo { height: 20px; width: auto; display: block; }

/* --- Editor Magazine Back Sync --- */
.mag-back-title-italic { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 64px; font-weight: 900; letter-spacing: -2px; line-height: 0.9; margin-bottom: 5px; font-style: italic; background: linear-gradient(to bottom, #005596, #003366); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #005596; position: relative; }
.mag-back-underline-rotated { position: absolute; bottom: -12px; left: 0; width: 96px; height: 8px; background: linear-gradient(to right, #005596, transparent); transform: rotate(2deg); }
.mag-back-edit-team { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; font-size: 11px; color: #4b5563; font-family: sans-serif; }
.mag-back-edit-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px; }
.mag-back-edit-value { font-weight: bold; }
.mag-back-issn { display: flex; flex-direction: column; align-items: center; gap: 2px; mt: 5px; }

/* Bottom Navigation Cards */
.bottom-nav { width: 100%; margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; box-sizing: border-box; }
.nav-link { text-decoration: none; display: block; }
.nav-card { padding: 20px; border-radius: 16px; background: white; border: 1px solid #f3f4f6; display: flex; flex-direction: column; cursor: pointer; transition: all 0.3s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.nav-card:hover { border-color: #00559630; transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.nav-card.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.nav-card-label { font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
.nav-card-title { font-size: 14px; font-weight: bold; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color 0.3s; }
.nav-card:hover .nav-card-title { color: #005596; }
.nav-card.next { text-align: right; align-items: flex-end; }
@media (max-width: 640px) { .bottom-nav { grid-template-columns: 1fr; } }
#top-controls { position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
.control-btn { width: 40px; height: 40px; border-radius: 50%; background: white; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4b5563; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: all 0.2s; }
.control-btn:hover { color: #005596; transform: scale(1.05); }

/* --- 目录页样式 (默认隐藏，打印显示) --- */
.toc-page { display: none; }
.toc-container { padding: 60px 80px; background: white; min-height: 100vh; }
.toc-header { text-align: center; margin-bottom: 50px; border-bottom: 3px double #005596; padding-bottom: 20px; }
.toc-header h1 { font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 32px; color: #111; margin: 0; letter-spacing: 5px; }
.toc-list { list-style: none; padding: 0; margin: 0; font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif; }
.toc-item { display: flex; align-items: baseline; margin-bottom: 20px; }
.toc-title { font-size: 18px; font-weight: bold; color: #333; max-width: 80%; }
.toc-dots { flex: 1; border-bottom: 1px dotted #999; margin: 0 10px; position: relative; top: -5px; }
.toc-cat { font-size: 14px; color: #666; font-family: sans-serif; }

/* --- 摘要卡片样式 --- */
.summary-card { 
    margin-top: 24px; 
    margin-bottom: 32px; 
    padding: 20px 24px; /* 调整内边距 */
    background: #F3F4F6; /* 加深背景 */
    border-left: 5px solid #005596; /* 加粗边框 */
    border-radius: 6px; 
    animation: fadeIn 0.5s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.summary-card h3 { 
    margin: 0 0 12px 0; 
    font-size: 11px; 
    font-weight: 900; 
    color: #005596; 
    text-transform: uppercase; 
    letter-spacing: 2px; 
    display: flex; 
    align-items: center; 
    gap: 8px; 
}
.summary-card p { 
    margin: 0; 
    /* 复用 types.ts 中的字体栈 */
    font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Arial, sans-serif !important;
    font-weight: 900 !important; /* 强制加粗 */
    font-style: normal !important; /* 取消斜体 */
    font-size: 15px !important; 
    line-height: 1.7 !important; 
    color: #111827 !important; /* 纯黑 */
    text-indent: 0 !important; 
    -webkit-font-smoothing: antialiased;
}

/* --- 打印专用徽标 (默认隐藏) --- */
.print-only { display: none; }
.media-print-badge {
    border: 1px dashed #d1d5db;
    padding: 15px;
    margin: 15px 0;
    background: #f9fafb;
    border-radius: 8px;
    font-size: 12px;
    color: #4b5563;
    text-align: center;
}

/* --- PDF Viewer Styles (Global) --- */
.pdf-viewer-container {
    width: 100%;
    height: 85vh !important;
    min-height: 600px !important;
    border: 1px solid #e5e7eb;
    margin-top: 30px;
    background: #f9fafb;
    border-radius: 24px; /* Sync with Editor style */
    overflow: hidden;
    position: relative;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
}

/* Reader Toolbar Styles */
.pdf-toolbar { height: 48px; background: white; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; flex-shrink: 0; user-select: none; }
.pdf-toolbar-title { font-size: 11px; font-weight: bold; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }

.pdf-viewer-container object {
    width: 100% !important;
    height: 100% !important;
    display: block;
}

/* PDF 全屏展开样式 */
.pdf-viewer-container.expanded {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    z-index: 9999;
    border: none;
    border-radius: 0;
    background: #111;
}

/* 沉浸式模式（Immersive Mode）样式 */
body.immersive-mode #sidebar {
    display: none !important;
}

body.immersive-mode #main {
    margin-left: 0 !important;
    width: 100% !important;
}

body.immersive-mode .normal-container {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 40px 80px !important;
    min-height: 100vh !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    width: 100% !important;
}

/* 适配沉浸模式下的 PDF 容器 */
body.immersive-mode .pdf-viewer-container {
    border-radius: 44px; /* 保持一致性 */
    width: 100% !important;
}

.pdf-expand-btn {
    background: rgba(0,85,150,0.1);
    border: 1px solid rgba(0,85,150,0.2);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: bold;
    color: #005596;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
}
.pdf-expand-btn:hover { background: rgba(0,85,150,0.2); }

.pdf-viewer-container.expanded .pdf-expand-btn {
    top: 20px;
    left: 20px;
    background: #005596;
    color: white;
    border: none;
}

/* --- 打印专用样式 --- */
/* --- 打印专用样式 (A4 适配版) --- */
@media print {
    @page { 
        margin: 10mm; /* 标准 A4 边距 */
        size: A4 portrait; 
    }

    /* 强制打印背景色与图形 */
    * { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        color-adjust: exact !important;
    }

    /* 基础重置：确保容器不会截断分页 */
    body { background: white !important; height: auto !important; overflow: visible !important; display: block !important; }
    #app-root { display: block !important; height: auto !important; }
    #main, #content-container { 
        overflow: visible !important; 
        height: auto !important; 
        display: block !important; 
        margin: 0 !important; 
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
    }
    
    /* 隐藏交互元素 */
    #sidebar, #fab-nav, #top-controls, .magazine-button, .fab-btn, .fab-divider, .pdf-viewer-container, .pdf-expand-btn, .bottom-nav { 
        display: none !important; 
    }
    
    /* 核心逻辑：区分“打印当前”和“打印全书” */
    body:not(.print-all) .article-wrapper:not(.active) { display: none !important; }
    body:not(.print-all) .toc-page { display: none !important; }

    /* 分页控制：确保封面封底独立成页 */
    .article-wrapper, .toc-page, .normal-container, .immersive-container {
        display: block !important; 
        page-break-after: always; 
        break-after: page; 
        min-height: 0 !important;
        height: auto !important;
        overflow: visible !important;
        box-shadow: none !important;
        border: none !important;
        padding: 20px 0 !important;
        margin: 0 !important;
    }
    
    /* 封面封底强制铺满 A4 */
    .cover-root, .magazine-cover, .magazine-back-cover, .normal-back-root {
        width: 100% !important; 
        height: 297mm !important; 
        min-height: 297mm !important;
        margin: 0 !important; 
        padding: 0 !important; 
        page-break-after: always; 
        break-after: page;
        border: none !important;
    }

    /* 内容防截断：禁止在图片、段落、卡片中间分页 */
    .sws-prose p, 
    .sws-prose img, 
    .summary-card, 
    .media-print-badge,
    .pdf-print-fallback,
    .pdf-page-container, /* 新增：防止PDF图片被切断 */
    h1, h2, h3 { 
        page-break-inside: avoid; 
        break-inside: avoid; 
    }

    /* 字体优化 */
    .sws-prose p { font-size: 12pt !important; line-height: 1.6 !important; text-align: justify; }
    .article-header h1 { font-size: 24pt !important; color: #000 !important; text-align: center; }

    /* 显示打印专用提示 */
    .print-only { display: block !important; }
    .pdf-print-fallback {
        border: 2px dashed #9ca3af;
        background: #f9fafb;
        padding: 20px;
        margin: 20px 0;
        border-radius: 8px;
        text-align: center;
        font-size: 10pt;
        color: #4b5563;
    }
}

/* --- Seasonal Styles --- */

/* Spring */
.spring-cover, .spring-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #fdf2f8, #f0fdf4); }
.spring-bg { position: absolute; inset: 0; background: linear-gradient(to bottom right, #fdf2f8, #f0fdf4); z-index: 0; }
.spring-content, .spring-back-content { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; flex-direction: column; }
.spring-deco-1 { position: absolute; top: 0; left: 0; width: 128px; height: 128px; border-bottom-right-radius: 100%; background: linear-gradient(to right, #f472b6, #4ade80); opacity: 0.1; }
.spring-deco-2 { position: absolute; bottom: 0; right: 0; width: 192px; height: 192px; border-top-left-radius: 100%; background: linear-gradient(to right, #f472b6, #4ade80); opacity: 0.1; }
.spring-sub, .spring-back-sub { font-family: serif; font-size: 14px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 8px; color: #db2777; text-align: center; }
.spring-title { font-family: serif; font-size: 72px; font-weight: 900; letter-spacing: 2px; color: #db2777; margin: 5px 0 20px 0; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.spring-meta { display: flex; gap: 20px; align-items: center; justify-content: center; font-family: sans-serif; font-weight: bold; font-size: 12px; color: #4b5563; background: rgba(255,255,255,0.6); padding: 8px 24px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.5); width: fit-content; margin: 0 auto; }
.spring-badge { padding: 4px 8px; border-radius: 4px; }
.spring-img-box { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 500px; padding: 20px 0; }
.spring-img-box img { max-height: 500px; width: auto; max-width: 100%; object-fit: contain; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); border-radius: 16px; border: 4px solid white; background: white; }
.spring-footer { margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.spring-footer-text { font-size: 9px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
.spring-btn { background: #ec4899; color: white; padding: 12px 32px; border-radius: 9999px; font-weight: bold; font-size: 12px; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(236, 72, 153, 0.3); cursor: pointer; transition: transform 0.2s; }
.spring-btn:hover { transform: translateY(-2px); }
/* Spring Back */
.spring-bg-back { position: absolute; inset: 0; background: linear-gradient(to top left, #f0fdf4, white); z-index: 0; }
.spring-back-header { text-align: center; padding-top: 40px; margin-bottom: 30px; }
.spring-back-title { font-family: serif; font-size: 48px; font-weight: bold; color: #166534; font-style: italic; margin: 0; }
.spring-back-img { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 400px; margin-bottom: 25px; }
.spring-back-img img { width: auto; max-width: 80%; height: auto; max-height: 80%; object-fit: contain; transform: rotate(2deg); padding: 8px; background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transition: transform 0.5s; }
.spring-back-img img:hover { transform: rotate(0deg); }
.spring-back-footer { display: flex; flex-direction: column; align-items: center; gap: 24px; padding-bottom: 40px; }
.spring-info-left { text-align: center; }
.spring-company { font-size: 12px; color: #6b7280; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
.spring-copyright { font-size: 10px; color: #9ca3af; }
.spring-logo { height: 32px; opacity: 0.8; }

/* Summer */
.summer-cover, .summer-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #fefce8, #eff6ff); }
.summer-bg { position: absolute; inset: 0; background: linear-gradient(to bottom right, #fefce8, #eff6ff); z-index: 0; }
.summer-sub { font-family: serif; font-size: 14px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 8px; color: #f97316; text-align: center; position: relative; z-index: 1;}
.summer-title { font-family: serif; font-size: 72px; font-weight: 900; letter-spacing: 2px; color: #f97316; margin: 5px 0 20px 0; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative; z-index: 1; }
.summer-meta { display: flex; gap: 20px; align-items: center; justify-content: center; font-family: sans-serif; font-weight: bold; font-size: 12px; color: #4b5563; position: relative; z-index: 1; }
.summer-line { color: #fed7aa; }
.summer-img-box { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 500px; padding: 20px 0; position: relative; z-index: 1; }
.summer-img-box img { max-height: 500px; width: auto; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-radius: 16px; border: 4px solid white; }
.summer-footer { margin-top: 30px; display: flex; justify-content: center; position: relative; z-index: 1; }
.summer-btn { background: #f97316; color: white; padding: 12px 32px; border-radius: 9999px; font-weight: bold; font-size: 12px; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3); }
.summer-sun { position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(253, 186, 116, 0.2) 0%, rgba(254, 252, 232, 0) 70%); z-index: 0; pointer-events: none; }
/* Summer Back */
.summer-bg-back { position: absolute; inset: 0; background: linear-gradient(to top left, #eff6ff, #fefce8); z-index: 0; }
.summer-back-header { text-align: center; padding-top: 40px; margin-bottom: 30px; position: relative; z-index: 1; }
.summer-back-title { font-family: serif; font-size: 48px; font-weight: bold; color: #1e40af; font-style: italic; margin: 0; }
.summer-back-img { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 400px; margin-bottom: 25px; position: relative; z-index: 1; }
.summer-back-img img { width: auto; max-width: 80%; height: auto; max-height: 80%; object-fit: contain; transform: rotate(2deg); padding: 8px; background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.summer-back-footer { display: flex; flex-direction: column; align-items: center; gap: 24px; padding-bottom: 40px; position: relative; z-index: 1; }
.summer-company { font-size: 12px; color: #6b7280; font-weight: bold; letter-spacing: 1px; }
.summer-logo { height: 32px; opacity: 0.8; }

/* Autumn */
.autumn-cover, .autumn-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #fff7ed, #f5f5f4); }
.autumn-bg { position: absolute; inset: 0; background: linear-gradient(to bottom right, #fff7ed, #f5f5f4); z-index: 0; }
.autumn-border { border: 1px solid rgba(217, 119, 6, 0.2); height: 100%; width: 100%; padding: 20px; display: flex; flex-direction: column; position: relative; z-index: 1; }
.autumn-header { text-align: center; margin-bottom: 30px; }
.autumn-sub { font-family: serif; font-size: 14px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 8px; color: #b45309; }
.autumn-title { font-family: serif; font-size: 72px; font-weight: 900; letter-spacing: 2px; color: #b45309; margin: 5px 0 20px 0; }
.autumn-meta { display: flex; gap: 20px; align-items: center; justify-content: center; font-family: sans-serif; font-weight: bold; font-size: 12px; color: #78350f; }
.autumn-icon { font-size: 20px; }
.autumn-img-box { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 500px; padding: 20px 0; }
.autumn-img-box img { max-height: 500px; width: auto; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-radius: 4px; }
.autumn-footer { margin-top: 30px; display: flex; justify-content: center; }
.autumn-btn { background: #d97706; color: white; padding: 12px 32px; border-radius: 4px; font-weight: bold; font-size: 12px; letter-spacing: 1px; }
/* Autumn Back */
.autumn-bg-back { position: absolute; inset: 0; background: linear-gradient(to top left, #fff7ed, #f5f5f4); z-index: 0; }
.autumn-back-border { border: 1px solid rgba(217, 119, 6, 0.2); height: 100%; width: 100%; padding: 20px; display: flex; flex-direction: column; position: relative; z-index: 1; }
.autumn-back-header { font-family: serif; font-size: 48px; font-weight: bold; color: #78350f; font-style: italic; text-align: center; margin-top: 40px; margin-bottom: 30px; }
.autumn-back-img { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 400px; margin-bottom: 25px; }
.autumn-back-img img { width: auto; max-width: 80%; height: auto; max-height: 80%; object-fit: contain; transform: rotate(2deg); padding: 8px; background: white; border-radius: 4px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.autumn-back-footer { display: flex; flex-direction: column; align-items: center; gap: 24px; padding-bottom: 20px; }
.autumn-company { font-size: 12px; color: #78350f; font-weight: bold; letter-spacing: 1px; }
.autumn-logo { height: 32px; opacity: 0.8; }

/* Winter */
.winter-cover, .winter-back { width: 100%; min-height: 840px; display: flex; flex-direction: column; padding: 40px 60px; position: relative; overflow: hidden; background: linear-gradient(to bottom right, #eff6ff, #f8fafc); }
.winter-bg { position: absolute; inset: 0; background: linear-gradient(to bottom right, #eff6ff, #f8fafc); z-index: 0; }
.winter-content, .winter-back { position: relative; z-index: 1; width: 100%; height: 100%; display: flex; flex-direction: column; }
.winter-sub, .winter-back-sub { font-family: serif; font-size: 14px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 8px; color: #1d4ed8; text-align: center; }
.winter-title { font-family: serif; font-size: 72px; font-weight: 900; letter-spacing: 2px; color: #1d4ed8; margin: 5px 0 20px 0; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.winter-meta { display: flex; gap: 20px; align-items: center; justify-content: center; font-family: sans-serif; font-weight: bold; font-size: 12px; color: #4b5563; background: rgba(255,255,255,0.8); padding: 8px 24px; border-radius: 9999px; width: fit-content; margin: 0 auto; }
.winter-img-box { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 500px; padding: 20px 0; }
.winter-img-box img { max-height: 500px; width: auto; max-width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-radius: 16px; border: 4px solid white; }
.winter-footer { margin-top: 30px; display: flex; justify-content: center; }
.winter-btn { background: #2563eb; color: white; padding: 12px 32px; border-radius: 9999px; font-weight: bold; font-size: 12px; letter-spacing: 1px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3); }
.winter-snow { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: radial-gradient(white 2px, transparent 2px); background-size: 50px 50px; opacity: 0.3; pointer-events: none; z-index: 0; }
/* Winter Back */
.winter-bg-back { position: absolute; inset: 0; background: linear-gradient(to top left, #eff6ff, #f8fafc); z-index: 0; }
.winter-back-header { text-align: center; padding-top: 40px; margin-bottom: 30px; position: relative; z-index: 1; }
.winter-back-title { font-family: serif; font-size: 48px; font-weight: bold; color: #1e293b; font-style: italic; margin: 0; }
.winter-back-img { flex-grow: 1; display: flex; justify-content: center; align-items: center; min-height: 400px; margin-bottom: 25px; position: relative; z-index: 1; }
.winter-back-img img { width: auto; max-width: 80%; height: auto; max-height: 80%; object-fit: contain; transform: rotate(2deg); padding: 8px; background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transition: transform 0.5s; }
.winter-back-footer { display: flex; flex-direction: column; align-items: center; gap: 24px; padding-bottom: 40px; position: relative; z-index: 1; }
.winter-company { font-size: 12px; color: #64748b; font-weight: bold; letter-spacing: 1px; }
.winter-logo { height: 32px; opacity: 0.8; }

</style>
</head>
<body>
<div id="app-root">
    <div id="top-controls">
        <button class="control-btn" onclick="if(window.app)app.print(false);else window.print()" title="打印当前页"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 12v2H8v-2h8zm2-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"/></svg></button>
        <button class="control-btn" onclick="if(window.app)app.print(true);else window.print()" title="打印全书"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></button>
        <button class="control-btn" onclick="if(window.app)app.toggleSidebar()" title="切换侧边栏"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18v-2H3v2zm0-5h18v-2H3v2zm0-5v2h18V6H3z"/></svg></button>
        <button class="control-btn" onclick="if(window.app)app.toggleFullscreen()" title="全屏阅读"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg></button>
    </div>
    
    <div id="sidebar">
        <div class="sidebar-header">
            <div class="relative">
              <svg class="sidebar-title-svg" viewBox="0 0 400 60" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:200px;">
                <defs><linearGradient id="sidebarTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#005596; stop-opacity:1" /><stop offset="100%" style="stop-color:#003366; stop-opacity:1" /></linearGradient></defs>
                <text x="50%" y="45" text-anchor="middle" font-family="&apos;PingFang SC&apos;, &apos;Microsoft YaHei&apos;, &apos;SimHei&apos;, &apos;STHeiti&apos;, &apos;Heiti SC&apos;, sans-serif" font-weight="bold" font-size="48" fill="url(#sidebarTitleGradientExport)" letter-spacing="10">工法情报</text>
              </svg>
            </div>
            <div class="sidebar-meta">${sidebarMeta}</div>
        </div>
        <div class="search-box"><input type="text" id="search-input" class="search-input" placeholder="Search..." /></div>
        <ul id="article-list"></ul>
        <div class="sidebar-footer">
            <div style="font-size: 9px; color: #d1d5db; letter-spacing: 1.5px; font-weight: bold; margin-bottom: 10px;">PRODUCED BY</div>
            ${logo ? `<img src="${logo}" class="sidebar-logo" />` : ''}
        </div>
    </div>
    
    <div id="main">
        <div id="content-container">
            <div class="toc-page">
                <div class="toc-container">
                    <div class="toc-header">
                        <h1>目 录</h1>
                        <div style="font-size:12px; color:#666; margin-top:5px; letter-spacing:2px;">CONTENTS</div>
                    </div>
                    <ul class="toc-list">
                        ${tocListHtml}
                    </ul>
                </div>
            </div>
            
            <div id="render-target"></div>
            <div id="navigation-root"></div>
        </div>
    </div>
</div>

<template id="tpl-magazine-cover">
    <div class="magazine-cover">
        <div class="magazine-bg-gradient"></div>
        <div class="magazine-header">
            <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
            <div class="magazine-header-divider"></div>
            <div class="relative">
                <svg class="magazine-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:400px;">
                    <defs>
                        <linearGradient id="magazineTitleGradientExport" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:#005596; stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#003366; stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <text x="50%" y="85" text-anchor="middle" font-family="&apos;PingFang SC&apos;, &apos;Microsoft YaHei&apos;, &apos;SimHei&apos;, &apos;STHeiti&apos;, &apos;Heiti SC&apos;, sans-serif" font-weight="bold" font-size="90" fill="url(#magazineTitleGradientExport)" letter-spacing="15">工法情报</text>
                </svg>
                <div class="magazine-title-underline"></div>
            </div>
            <div class="magazine-meta-container">
                <div class="magazine-meta-badge" data-field="issueText">NO.01</div>
                <span style="color:#00559680; font-size:12px;">•</span>
                <div class="magazine-meta-badge" data-field="dateText">JAN 2025</div>
            </div>
        </div>
        <div class="magazine-image-container">
            <div class="magazine-image-wrapper">
                <div class="magazine-image-placeholder" style="height:200px; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">暂无封面图片</div>
            </div>
        </div>
        <div class="magazine-footer">
            <div class="magazine-footer-text">OFFICIAL PUBLICATION</div>
            <div class="magazine-button">开始阅读</div>
        </div>
        <div class="magazine-decoration-circle"></div>
        <div class="magazine-decoration-square"></div>
    </div>
</template>

<template id="tpl-normal-cover">
    <div class="cover-root">
        <div class="tech-grid"></div>
        <div class="ambient-bg"></div>
        <div class="cover-header">
            <div class="cover-sub">Ship Construction Method Information</div>
            <svg class="cover-title-svg" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet" style="width:100%; max-width:320px;">
                <defs>
                    <linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#005596"/>
                        <stop offset="100%" style="stop-color:#003366"/>
                    </linearGradient>
                </defs>
                <text x="50%" y="85" text-anchor="middle" fill="url(#g1)" font-family="&apos;PingFang SC&apos;, &apos;Microsoft YaHei&apos;, &apos;SimHei&apos;, &apos;STHeiti&apos;, &apos;Heiti SC&apos;, sans-serif" font-weight="bold" font-size="90" letter-spacing="15">工法情报</text>
            </svg>
            <div class="cover-meta">
                <span data-field="issueText">NO.01</span> <span>·</span> <span data-field="dateText">JAN 2025</span>
            </div>
        </div>
            <div class="cover-img-box">
                 <div class="cover-img-placeholder">暂无封面图片</div>
            </div>
        <div class="cover-footer">
            <div style="height:15px;width:80px;background-image:repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px);opacity:0.4;"></div>
            <div class="magazine-button">开始阅读 ❯</div>
        </div>
    </div>
</template>

<template id="tpl-magazine-back">
    <div class="magazine-back-cover">
        <!-- 基础背景 -->
        <div class="magazine-back-bg" style="background: linear-gradient(to top left, rgba(235,248,255,0.8), white, rgba(243,244,246,0.8));"></div>
        
        <!-- 顶部标题 -->
        <div class="magazine-back-header">
            <div class="magazine-header-title">SHIP CONSTRUCTION METHOD</div>
            <div class="magazine-header-divider" style="background: linear-gradient(to right, transparent, rgba(0,85,150,0.3), transparent);"></div>
            
            <div style="position: relative; transform: rotate(-2deg); transform-origin: left;">
                <div class="mag-back-title-italic">Sailing With Success</div>
                <div class="mag-back-underline-rotated"></div>
            </div>
        </div>
        
        <!-- 图片区域 -->
        <div class="magazine-back-image-container">
             <!-- 图片占位符 -->
             <div class="magazine-image-placeholder" style="width:80%; height:80%; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">
                暂无封底图片
             </div>
        </div>
        
        <!-- 底部信息 -->
        <div class="magazine-back-footer">
            <!-- 左侧：公司信息 -->
            <div class="magazine-back-left">
                <div class="magazine-back-company">SWS OFFSHORE</div>
                <div class="magazine-back-address">SHANGHAI WAIGAOQIAO SHIPBUILDING & OFFSHORE CO.,LTD<br/>上海外高桥造船海洋工程有限公司</div>
                <div class="magazine-back-copyright">© 2025 Ship Construction Method Information</div>
            </div>
            
            <!-- 中间：编辑团队 -->
            <div class="magazine-back-center">
                 <div class="mag-back-edit-team">
                    <div class="magazine-back-team-item">
                        <div class="mag-back-edit-label">编辑</div>
                        <div class="mag-back-edit-value">马李琛</div>
                    </div>
                    <div class="magazine-back-team-item">
                        <div class="mag-back-edit-label">校对</div>
                        <div class="mag-back-edit-value">胡国超</div>
                    </div>
                    <div class="magazine-back-team-item">
                        <div class="mag-back-edit-label">审核</div>
                        <div class="mag-back-edit-value">储年生</div>
                    </div>
                 </div>
                 <div class="magazine-back-barcode">
                    <div class="magazine-back-barcode-line"></div>
                    <div class="magazine-back-barcode-text">ISSN 0000-0000</div>
                 </div>
            </div>
            
            <!-- 右侧：Logo和刊号 -->
            <div class="magazine-back-right">
                <img data-field="logo" class="magazine-back-logo" alt="Logo" />
                <div class="magazine-back-logo-underline"></div>
                <div class="magazine-back-info" style="text-align:right;">
                    Official Publication<br/>
                    Volume <span data-field="issueText">01</span> · <span data-field="dateText">JAN 2025</span>
                </div>
            </div>
        </div>
        
        <div class="magazine-decoration-circle"></div>
        <div class="magazine-decoration-square"></div>
        <div class="magazine-decoration-line"></div>
    </div>
</template>

<template id="tpl-normal-back">
    <div class="normal-back-root">
        <!-- 背景 (AmbientBg 和 TechGrid) -->
        <div class="tech-grid"></div>
        <div class="ambient-bg" data-field="bgStyle"></div>

        <!-- 头部 -->
        <div class="normal-back-header">
            <div class="normal-back-sub">Ship Construction Method Information</div>
            <h1 class="normal-back-title">Sailing With Success</h1>
        </div>

        <!-- 图片区 -->
        <div class="cover-img-box" style="flex-grow:1; min-height:500px;">
            <div class="cover-img-placeholder" style="height:200px; display:flex; align-items:center; justify-content:center; color:#999; border:2px dashed #ddd; border-radius:10px;">暂无封底图片</div>
        </div>

        <!-- 底部 -->
        <div class="normal-back-footer">
            <div class="normal-back-left">
                <div class="normal-back-company-short">SWS OFFSHORE</div>
                <div class="normal-back-company-full">SHANGHAI WAIGAOQIAO SHIPBUILDING & OFFSHORE CO.,LTD</div>
            </div>

            <div class="normal-back-right" style="display:flex; align-items:center; gap:20px;">
                <div class="normal-back-team">
                    <div class="normal-back-team-item"><span>编辑:</span><b>马李琛</b></div>
                    <div class="normal-back-team-item"><span>校对:</span><b>胡国超</b></div>
                    <div class="normal-back-team-item"><span>审核:</span><b>储年生</b></div>
                </div>
                <img data-field="logo" class="normal-back-logo" alt="Logo" />
            </div>
        </div>
    </div>
</template>

<template id="tpl-article">
    <div class="normal-container">
        <div class="article-header">
            <h1 data-field="title"></h1>
            <div class="article-meta">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6; margin-top:2px;" data-field="tags-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <div class="tag-cloud" data-field="tags"></div>
                <span data-field="category-label">分类: <span data-field="category"></span></span>
            </div>
        </div>
        <div class="summary-card">
            <h3>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#005596" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                摘要 / 导读
            </h3>
            <p data-field="abstract"></p>
        </div>
        <div class="sws-prose article-body" data-field="content"></div>
        
        <!-- 打印专用媒体提示 -->
        <div class="print-only media-print-badge">
            📌 此处包含多媒体内容（音视频），纸质版无法展示，请通过电子版进行查看。
        </div>
        
        <!-- PDF 查看器 -->
        <div data-field="pdf-viewer" style="display: none;">
            <!-- 打印时的替代提示 (Bug 1/2/Print Optimization) -->
            <div class="print-only pdf-print-fallback">
                <strong style="color:#005596; display:block; margin-bottom:5px; font-size:12pt;">📄 附件：PDF 文档</strong>
                <div>[注] 原文包含互动式附件。</div>
                <div style="font-size: 9pt; margin-top:5px; color:#666;">由于技术限制，嵌入式附件无法直接打印。请在电子版中点击“点击打开PDF”下载后单独打印，或在编辑时选择“插入正文”模式。</div>
            </div>

            <div class="pdf-viewer-container" data-id="pdf-container">
                <div class="pdf-toolbar">
                    <div class="pdf-toolbar-title">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        PDF PREVIEW
                    </div>
                    <button class="pdf-expand-btn" onclick="app.togglePdfExpand(this)">
                        <span class="icon-expand">⛶ 全屏阅读</span>
                    </button>
                </div>
                <div style="flex:1; width:100%; position:relative; background: #f3f4f6;">
                    <object data-field="pdf-object" type="application/pdf" style="width: 100%; height: 100%;">
                        <p style="padding: 40px; text-align: center; color: #6b7280;">
                            无法加载PDF文件，请<a data-field="pdf-link" target="_blank" rel="noreferrer" style="color: #005596; text-decoration: underline;">点击这里</a>下载查看。
                        </p>
                    </object>
                    <a data-field="pdf-link" target="_blank" rel="noreferrer" style="position: absolute; bottom: 15px; right: 25px; z-index: 9999; background: white; padding: 6px 12px; font-size: 12px; border: 1px solid #d1d5db; border-radius: 4px; color: #005596; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-weight: bold; display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        无法预览？点击打开PDF
                    </a>
                </div>
            </div>
        </div>
        
        <div class="article-navigation-mount"></div>

        <div class="article-footer-info">
            <img data-field="logo" class="article-footer-logo" alt="" />
            <span>SWS KNOWLEDGE BASE</span>
        </div>
        <div class="article-end-mark">- End of Article -</div>
    </div>
</template>

<script>
window.__SWS_DATA_ARTICLES_B64__ = "${encodeContent(JSON.stringify(sortedArticles))}";
window.__SWS_DATA_CONFIG_B64__ = "${encodeContent(JSON.stringify(APP_CONFIG))}";
</script>

<script>
    // 辅助函数：Base64 解码
    function safeDecode(b64) {
        if (!b64) return {};
        try {
            return JSON.parse(decodeURIComponent(escape(window.atob(b64))));
        } catch (e) {
            console.error("Data Decode Failed", e);
            return {};
        }
    }

    // 辅助函数：转义 HTML，用于插入文本内容
    function escapeForJS(str) {
        if (str == null) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    const DATA = safeDecode(window.__SWS_DATA_ARTICLES_B64__) || [];
    const CONFIG = safeDecode(window.__SWS_DATA_CONFIG_B64__) || {};
    const APP_COMPANY = CONFIG.company || {};
    const LOGO = CONFIG.logo || "";
    const COMPANY_SHORT = APP_COMPANY.EN_SHORT || "";
    const COMPANY_FULL = APP_COMPANY.EN_FULL || "";
    const ZH_FULL = APP_COMPANY.ZH_FULL || "";

    var app = {
        data: Array.isArray(DATA) ? DATA : [],
        currentIndex: 0,
        alternateDesign: CONFIG.alternateDesign || false,
        currentBlobUrls: [],

        base64ToBlobUrl: function(base64) {
            if (!base64) return null;
            if (!base64.startsWith('data:')) return base64;
            try {
                var split = base64.split(',');
                var type = split[0].match(/:(.*?);/)[1];
                var bin = atob(split[1]);
                var len = bin.length;
                var arr = new Uint8Array(len);
                for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
                var blob = new Blob([arr], { type: type });
                var url = URL.createObjectURL(blob);
                this.currentBlobUrls.push(url);
                return url;
            } catch(e) { console.error("Blob conversion failed", e); return base64; }
        },

        init: function() {
            try {
                this.renderList();
                this.renderAll();
                this.updateView(0);

                var searchInput = document.getElementById('search-input');
                if (searchInput) {
                    searchInput.addEventListener('input', function(e) {
                        var term = e.target.value.toLowerCase();
                        app.renderList(term);
                    });
                }

                // 添加键盘事件监听器，支持左右箭头翻页
                // 添加键盘事件监听器，支持翻页键和箭头键
                document.addEventListener('keydown', function(e) {
                    // 排除输入框
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                    
                    switch(e.key) {
                        case 'ArrowRight':
                        case 'N':            // Vim style
                        case 'PageDown':
                            app.next();
                            e.preventDefault();
                            break;
                        case 'ArrowLeft':
                        case 'P':            // Vim style
                        case 'PageUp':
                            app.prev();
                            e.preventDefault();
                            break;
                        case 'Home':
                            app.scrollToArticle(0);
                            e.preventDefault();
                            break;
                        case 'End':
                            app.scrollToArticle(app.data.length - 1);
                            e.preventDefault();
                            break;
                    }
                });

                // 移除手动滚轮控制，依靠原生滚动
            } catch (err) {
                console.error("App init error", err);
            }
        },

        toggleSidebar: function() {
            document.getElementById('sidebar').classList.toggle('hidden');
        },

        toggleFullscreen: function() {
            var body = document.body;
            var isImmersive = body.classList.toggle('immersive-mode');
            
            // 同时切换浏览器全屏状态 (可选，为了更好体验)
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(function(e){});
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
            
            // 更新按钮状态或图标（如果有的话）
            var btn = document.querySelector('.icon-fullscreen')?.parentElement;
            /* 
               此处逻辑与编辑器保持一致：
               点击全屏 -> 进入 Immersive Mode (隐藏侧边栏 + 内容全宽)
            */
        },

        renderList: function(term) {
            term = term || '';
            var listEl = document.getElementById('article-list');
            if (!listEl) return;
            listEl.innerHTML = '';

            this.data.forEach(function(item, index) {
                if (term && !item.title.toLowerCase().includes(term)) return;
                var li = document.createElement('li');
                li.className = 'nav-item ' + (index === app.currentIndex ? 'active' : '');
                li.id = 'nav-item-' + index;
                li.onclick = function() { app.scrollToArticle(index); };

                var categoryHtml = (item.category === '封面' || item.category === '封底')
                    ? '<span style="color:#005596">[' + escapeForJS(item.category) + ']</span> '
                    : '';

                li.innerHTML = '<div class="nav-item-title">' + categoryHtml + escapeForJS(item.title) + '</div>' +
                               '<div class="nav-item-meta"><span>' + escapeForJS(item.date || '') + '</span></div>';
                listEl.appendChild(li);
            });
        },

        renderAll: function() {
            var container = document.getElementById('render-target');
            if (!container) return;
            container.innerHTML = '';

            this.data.forEach(function(article, index) {
                var wrapper = document.createElement('div');
                wrapper.className = 'article-wrapper';
                wrapper.id = 'article-' + index;
                if (article.category === '封面') app.renderCover(wrapper, article);
                else if (article.category === '封底') app.renderBack(wrapper, article);
                else app.renderNormal(wrapper, article);
                container.appendChild(wrapper);
            });
        },

        getCoverHTML: function(article) {
            // Determine template ID based on design style
            var tplId = this.alternateDesign ? 'tpl-magazine-cover' : 'tpl-normal-cover';
            
            var tpl = document.getElementById(tplId);
            if (!tpl) return ''; // Fallback
            var html = tpl.innerHTML;
            
            // Common replacements
            // Use new RegExp to avoid issues with forward slashes in generated script
            html = html.replace(new RegExp('data-field="issueText">.*?<\\/span>', 'g'), 'data-field="issueText">' + escapeForJS(article.issueText || "NO.01") + '</span>');
            html = html.replace(new RegExp('data-field="dateText">.*?<\\/span>', 'g'), 'data-field="dateText">' + escapeForJS(article.dateText || "JAN 2025") + '</span>');
            
            // Image handling (common logic)
            var imgHtml = '<div class="cover-img-placeholder">暂无封面图片</div>';
            if (article.coverImage) {
                var s = parseFloat(article.scale) || 1;
                var x = parseFloat(article.posX) || 0;
                var y = parseFloat(article.posY) || 0;
                var transformStr = !this.alternateDesign ? ('style="transform-origin: center; transform: translate(' + x + 'px, ' + y + 'px) scale(' + s + ');"') : '';
                imgHtml = '<img src="' + article.coverImage + '" class="cover-img-real" alt="Cover" ' + transformStr + ' />';
            }
            // Replace image placeholder in specific keys if needed, or generic cover-img-placeholder
            // Note: Different templates might have different classes for image container, but logic is similar.
            // Simplified: replace innerHTML of cover-img-box
             var tempDiv = document.createElement('div');
             tempDiv.innerHTML = html;
             var imgBox = tempDiv.querySelector('.cover-img-box');
             if (imgBox) {
                 imgBox.innerHTML = imgHtml;
             }
             
             // Special handling for normal-cover bg-style
             if (tplId === 'tpl-normal-cover') {
                 // Ambient BG logic
                  var bgStyle = '';
                  if (article.coverImage) {
                      bgStyle = 'background-image: url("' + article.coverImage + '");';
                   }
                   var bgDiv = tempDiv.querySelector('.ambient-bg');
                   if(bgDiv) bgDiv.setAttribute('style', bgStyle);
             }
             
             return tempDiv.innerHTML;
        },

        getBackHTML: function(article) {
            // Determine template ID based on design style
            var tplId = this.alternateDesign ? 'tpl-magazine-back' : 'tpl-normal-back';

            var tpl = document.getElementById(tplId);
            if (!tpl) return '';
            var html = tpl.innerHTML;
            
            // Image handling (common)
            var imgHtml = '<div class="cover-img-placeholder">暂无封底图片</div>';
            if (article.backImage) {
               // Use article.backImage directly (it's base64)
               var s = parseFloat(article.scale) || 1;
               var x = parseFloat(article.posX) || 0;
               var y = parseFloat(article.posY) || 0;
               var transformStr = !this.alternateDesign ? ('style="transform-origin: center; transform: translate(' + x + 'px, ' + y + 'px) scale(' + s + ');"') : '';
               imgHtml = '<img src="' + article.backImage + '" class="cover-img-real text-center" alt="Back Cover" style="max-height:80%;" ' + transformStr + ' />';
            }

            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // Inject Image into the correct container
            // Magazine/Seasonal uses .magazine-back-image-container, Normal uses .cover-img-box
            var imgBox = tempDiv.querySelector('.magazine-back-image-container') || tempDiv.querySelector('.cover-img-box');
            if (imgBox) {
                imgBox.innerHTML = imgHtml;
            }
            
            // Ambient BG for normal
            if (tplId === 'tpl-normal-back') {
                 var bgStyle = '';
                 if (article.backImage) {
                     bgStyle = 'background-image: url("' + article.backImage + '");';
                 }
                 var bgDiv = tempDiv.querySelector('.ambient-bg');
                 if(bgDiv) bgDiv.setAttribute('style', bgStyle);
            }
            
            return tempDiv.innerHTML;
        },

        renderCover: function(el, article) {
            var templateId = this.alternateDesign ? 'tpl-magazine-cover' : 'tpl-normal-cover';
            var tpl = document.getElementById(templateId);
            if (!tpl) return;
            var node = tpl.content.cloneNode(true);
            var coverImgUrl = this.base64ToBlobUrl(article.coverImage);
            var issueText = article.issueText || "NO.01";
            var dateText = article.dateText || "JAN 2025";

            var metaBadges = node.querySelectorAll('[data-field="issueText"], [data-field="dateText"]');
            metaBadges.forEach(function(elem) {
                if (elem.dataset.field === 'issueText') elem.textContent = issueText;
                if (elem.dataset.field === 'dateText') elem.textContent = dateText;
            });

            var imagePlaceholder = node.querySelector('.magazine-image-placeholder') || node.querySelector('.cover-img-placeholder');
            if (coverImgUrl) {
                var img = document.createElement('img');
                img.src = coverImgUrl;
                img.className = imagePlaceholder.className.includes('magazine') ? 'magazine-image' : 'cover-img';
                img.alt = "Cover";
                
                // [Sync] Apply Zoom/Position for Normal Design (Bug 1 Fix)
                if (!this.alternateDesign) {
                    var s = parseFloat(article.scale) || 1;
                    var x = parseFloat(article.posX) || 0;
                    var y = parseFloat(article.posY) || 0;
                    img.style.transformOrigin = 'center';
                    img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                    img.style.transition = 'none'; // 离线版不需要初始动画
                }

                if (imagePlaceholder) imagePlaceholder.parentNode.replaceChild(img, imagePlaceholder);

                var ambientBg = node.querySelector('.ambient-bg');
                if (!this.alternateDesign && ambientBg) {
                    ambientBg.style.backgroundImage = 'url(' + coverImgUrl + ')';
                }
            } else if (imagePlaceholder) {
                 imagePlaceholder.style.display = 'flex';
            }

            el.appendChild(node);
            
            // 为“开始阅读”按钮绑定点击事件
            var startBtn = el.querySelector('.magazine-button');
            if (startBtn) {
                startBtn.onclick = function(e) {
                    e.preventDefault();
                    app.next();
                };
            }
        },

        renderBack: function(el, article) {
            var templateId = this.alternateDesign ? 'tpl-magazine-back' : 'tpl-normal-back';
            var tpl = document.getElementById(templateId);
            if (!tpl) return;
            var node = tpl.content.cloneNode(true);
            var backImgUrl = this.base64ToBlobUrl(article.backImage);

            if (this.alternateDesign) {
                // --- 杂志风格封底逻辑 ---
                var fields = node.querySelectorAll('[data-field]');
                fields.forEach(function(elem) {
                    var field = elem.dataset.field;
                    if (field === 'logo') {
                        if (LOGO) elem.src = LOGO;
                        else elem.style.display = 'none';
                    }
                    if (field === 'issueText') elem.textContent = article.issueText || "NO.01";
                    if (field === 'dateText') elem.textContent = article.dateText || "JAN 2025";
                });
                
                // 处理封底图片
                var imgContainer = node.querySelector('.magazine-back-image-container');
                var placeholder = node.querySelector('.magazine-image-placeholder');
                
                if (backImgUrl && imgContainer) {
                    var img = document.createElement('img');
                    img.className = 'magazine-back-image';
                    img.src = backImgUrl;
                    if (placeholder) {
                        imgContainer.replaceChild(img, placeholder);
                    } else {
                        imgContainer.appendChild(img);
                    }
                }
            } else {
                // --- 普通风格封底逻辑 (Sync with Editor) ---
                var fields = node.querySelectorAll('[data-field]');
                fields.forEach(function(elem) {
                    var field = elem.dataset.field;
                    if (field === 'logo') {
                        var imgElem = elem.tagName === 'IMG' ? elem : elem.querySelector('img');
                        if (imgElem) {
                            if (LOGO) imgElem.src = LOGO;
                            else imgElem.style.display = 'none';
                        }
                    }
                });

                // 设置背景图
                var bgContainer = node.querySelector('[data-field="bgStyle"]');
                if (bgContainer && backImgUrl) {
                    // 与 Editor PaperView.tsx 保持一致: opacity 0.3, blur, scale
                    bgContainer.style.backgroundImage = 'url(' + backImgUrl + ')';
                    bgContainer.style.backgroundSize = 'cover';
                    bgContainer.style.backgroundPosition = 'center';
                    bgContainer.style.opacity = '0.3';
                    bgContainer.style.filter = 'blur(60px) saturate(180%) brightness(1.05)';
                    bgContainer.style.transform = 'scale(1.2)';
                }
                
                // 设置中间主图
                var imgContainer = node.querySelector('.cover-img-box');
                var placeholder = node.querySelector('.cover-img-placeholder');
                if (backImgUrl && imgContainer) {
                    var img = document.createElement('img');
                    img.className = 'cover-img'; // 复用封面的类
                    img.src = backImgUrl;
                    img.style.boxShadow = '0 20px 50px -12px rgba(0, 0, 0, 0.5)';
                    
                    // [Sync] Apply Zoom/Position for Normal Design (Bug 1 Fix)
                    if (article.scale !== undefined || article.posX !== undefined || article.posY !== undefined) {
                        var s = parseFloat(article.scale) || 1;
                        var x = parseFloat(article.posX) || 0;
                        var y = parseFloat(article.posY) || 0;
                        img.style.transformOrigin = 'center';
                        img.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + s + ')';
                        img.style.transition = 'none';
                    }
                    
                    if (placeholder) {
                        imgContainer.replaceChild(img, placeholder);
                    } else {
                        imgContainer.appendChild(img);
                    }
                }
            }

            el.appendChild(node);
        },

        renderNormal: function(el, article) {
            var tpl = document.getElementById('tpl-article');
            if (!tpl) return;
            var node = tpl.content.cloneNode(true);

            var fields = node.querySelectorAll('[data-field]');
            fields.forEach(function(elem) {
                var field = elem.dataset.field;
                if (field === 'title') elem.textContent = article.title || '';
                if (field === 'date') elem.textContent = article.date || '';
                if (field === 'category') elem.textContent = article.category || '';
                if (field === 'category-label') {
                    // 如果有标签，隐藏旧的分类标签
                    if (article.tags && article.tags.length > 0) {
                        elem.style.display = 'none';
                    } else {
                        elem.style.display = 'inline-block';
                    }
                }
                if (field === 'tags') {
                    var tagsData = article.tags || [];
                    var tagsArr = Array.isArray(tagsData) ? tagsData : (typeof tagsData === 'string' ? tagsData.split(/[,，\s]+/) : []);
                    tagsArr = tagsArr.filter(function(t) { return t && t.trim() !== ''; });

                    if (tagsArr.length > 0) {
                        var html = tagsArr.map(function(t) {
                            return '<span class="tag-item">' + t.trim() + '</span>';
                        }).join('');
                        elem.innerHTML = html;
                        elem.style.display = 'flex';
                    } else {
                        elem.style.display = 'none';
                    }
                }
                if (field === 'tags-icon') {
                    if (article.tags && article.tags.length > 0) {
                        elem.style.display = 'block';
                    } else {
                        elem.style.display = 'none';
                    }
                }
                if (field === 'abstract') {
                    if (article.abstract) {
                        elem.textContent = article.abstract;
                    } else {
                        elem.parentElement.style.display = 'none';
                    }
                }
                if (field === 'content') {
                    elem.innerHTML = article.content || '';
                    if (article.fontSize) elem.style.fontSize = article.fontSize + 'px';
                    if (article.lineHeight) elem.style.lineHeight = article.lineHeight;
                }
                if (field === 'logo') {
                    var imgElem = elem.tagName === 'IMG' ? elem : elem.querySelector('img');
                    if (imgElem) {
                        if (LOGO) imgElem.src = LOGO;
                        else imgElem.style.display = 'none';
                    }
                }
                // 处理PDF查看器
                if (field === 'pdf-viewer' && article.pdfData) {
                    var pdfContainer = elem;
                    pdfContainer.style.display = 'block';
                    var pdfUrl = this.base64ToBlobUrl(article.pdfData);
                    if (pdfUrl) {
                        var pdfObject = pdfContainer.querySelector('[data-field="pdf-object"]');
                        var pdfLinks = pdfContainer.querySelectorAll('[data-field="pdf-link"]');
                        
                        if (pdfObject) {
                            pdfObject.data = pdfUrl;
                        }
                        
                        // 更新所有PDF链接（包括 object 内部的 fallback 和 外部的按钮）
                        pdfLinks.forEach(function(link) {
                            link.href = pdfUrl;
                        });
                    }
                }
            }.bind(this));

            el.appendChild(node);
        },

        scrollToArticle: function(index) {
            // 更新当前索引
            this.currentIndex = index;
            
            // 更新侧边栏导航项高亮
            document.querySelectorAll('.nav-item').forEach(function(el, i) {
                if (i === index) el.classList.add('active');
                else el.classList.remove('active');
            });
            
            // 隐藏所有文章，只显示当前文章
            document.querySelectorAll('.article-wrapper').forEach(function(el, i) {
                if (i === index) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
            
            // 重置主容器滚动位置
            var mainEl = document.getElementById('main');
            if (mainEl) mainEl.scrollTop = 0;
            
            // 处理翻页渲染
            var article = this.data[index];
            var isSpecial = article.category === '封面' || article.category === '封底';
            
            // 查找内容的翻页挂载点
            var currentWrapper = document.getElementById('article-' + index);
            var navMount = currentWrapper ? currentWrapper.querySelector('.article-navigation-mount') : null;
            
            if (isSpecial || !navMount) {
                if (navMount) navMount.innerHTML = '';
            } else {
                var prevArt = index > 0 ? this.data[index - 1] : null;
                var nextArt = index < this.data.length - 1 ? this.data[index + 1] : null;
                
                var svgArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; transition:transform 0.3s;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
                var svgPrevArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; transform:rotate(180deg); transition:transform 0.3s;"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

                var navHtml = '<div class="bottom-nav">' +
                    '<a class="nav-link ' + (!prevArt ? 'disabled' : '') + '" onclick="' + (prevArt ? 'app.prev()' : '') + '">' +
                        '<div class="nav-card">' +
                            '<div class="nav-card-label">' + svgPrevArrow + ' 上一篇</div>' +
                            '<div class="nav-card-title">' + (prevArt ? escapeForJS(prevArt.title) : '已是第一篇') + '</div>' +
                        '</div>' +
                    '</a>' +
                    '<a class="nav-link next ' + (!nextArt ? 'disabled' : '') + '" onclick="' + (nextArt ? 'app.next()' : '') + '">' +
                        '<div class="nav-card next">' +
                            '<div class="nav-card-label">下一篇 ' + svgArrow + '</div>' +
                            '<div class="nav-card-title">' + (nextArt ? escapeForJS(nextArt.title) : '已是最后一篇') + '</div>' +
                        '</div>' +
                    '</a>' +
                '</div>';

                navMount.innerHTML = navHtml;
            }

            // 处理侧边栏显示/隐藏逻辑
            var sidebar = document.getElementById('sidebar');
            if (isSpecial) {
                sidebar.classList.add('hidden');
            } else {
                sidebar.classList.remove('hidden');
            }
        },

        updateView: function(index) {
            this.scrollToArticle(index);
        },

        next: function() {
            if (this.data.length === 0) return;
            var nextIndex = (this.currentIndex + 1) % this.data.length;
            this.scrollToArticle(nextIndex);
        },

        prev: function() {
            if (this.data.length === 0) return;
            var prevIndex = (this.currentIndex - 1 + this.data.length) % this.data.length;
            this.scrollToArticle(prevIndex);
        },

        print: function(all) {
            if (all) {
                document.body.classList.add('print-all');
            } else {
                document.body.classList.remove('print-all');
            }
            
            // 延迟以确保样式切换渲染完成
            setTimeout(function() {
                window.print();
            }, 300);
        },

        togglePdfExpand: function(btn) {
            var container = btn.closest('.pdf-viewer-container');
            if (!container) return;
            
            var isExpanded = container.classList.contains('expanded');
            var btnText = container.querySelector('.icon-expand') || btn.querySelector('.icon-expand');
            
            if (!isExpanded) {
                // Expanding: Move to body to bypass any stacking contexts/transforms
                var placeholder = document.createElement('div');
                placeholder.className = 'pdf-viewer-placeholder';
                placeholder.style.display = 'none';
                container.parentNode.insertBefore(placeholder, container);
                
                document.body.appendChild(container);
                
                // Force layout recalculation
                void container.offsetWidth;
                
                container.classList.add('expanded');
                container._placeholder = placeholder;
                
                if (btnText) btnText.textContent = '✕ 退出全屏';
                document.body.style.overflow = 'hidden';
            } else {
                // Collapsing: Move back to placeholder
                var placeholder = container._placeholder;
                container.classList.remove('expanded');
                
                if (placeholder && placeholder.parentNode) {
                   placeholder.parentNode.insertBefore(container, placeholder);
                   placeholder.parentNode.removeChild(placeholder);
                }
                
                if (btnText) btnText.textContent = '⛶ 全屏阅读';
                document.body.style.overflow = '';
                delete container._placeholder;
            }
        }
    };
    window.app = app;

    // 监听全屏状态变化（处理 ESC 键退出）
    document.addEventListener('fullscreenchange', function() {
        // 如果当前没有全屏元素（说明退出了全屏）
        if (!document.fullscreenElement) {
            const sidebar = document.getElementById('sidebar');
            const main = document.getElementById('main');
            
            // 1. 强制移除沉浸模式样式
            document.body.classList.remove('immersive-mode');
            
            // 2. 恢复侧边栏显示（退出全屏时自动展开侧边栏）
            if (sidebar) sidebar.classList.remove('hidden');
            
            // 3. 确保主内容区没有侧边栏隐藏的样式
            // 注意：实际样式中主内容区没有 'sidebar-hidden' 类，但保留逻辑以防未来变化
            if (main) main.classList.remove('sidebar-hidden');
            
            // 4. 可选：重置全屏按钮图标状态（如果有的话）
            // 当前 toggleFullscreen 函数没有维护按钮状态，可暂时忽略
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        app.init();
    });
</script>
</body>
</html>`;
    return htmlContent;
}
