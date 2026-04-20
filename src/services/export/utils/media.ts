import { CONSTANTS } from '../../../constants';
import { compressImage } from '../../../utils/fileHelpers';

/**
 * 将在线图片URL转换为Base64 Data URI（带超时与跨域容错）
 * 【架构升级】针对微信等开启了严格 CORS 和防盗链的图床进行特化绕过
 */
async function fetchImageAsBase64(url: string, timeoutMs = 8000): Promise<string> {
    return new Promise((resolve, reject) => {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            abortController.abort();
            reject(new Error('图片下载与转码超时'));
        }, timeoutMs);

        const fetchBlob = async (targetUrl: string): Promise<Blob> => {
            const response = await fetch(targetUrl, {
                signal: abortController.signal,
                referrerPolicy: 'no-referrer',
                mode: 'cors'
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.blob();
        };

        const processImage = async () => {
            try {
                let blob: Blob;
                try {
                    blob = await fetchBlob(url);
                } catch (directErr) {
                    console.warn(`[Export] 直接拉取图片失败，正尝试免 CORS 代理: ${url}`);
                    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                    blob = await fetchBlob(proxyUrl);
                }

                const reader = new FileReader();
                reader.onloadend = () => {
                    clearTimeout(timeoutId);
                    resolve(reader.result as string);
                };
                reader.onerror = () => {
                    clearTimeout(timeoutId);
                    reject(new Error('FileReader 读取 Blob 失败'));
                };
                reader.readAsDataURL(blob);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        };

        processImage();
    });
}

/**
 * 将文章 HTML 内容中所有在线图片（http/https）转为 Base64 内联
 * - 跳过已经是 data: 的图片（已内联）
 * - 跳过 blob: URL
 * - 单图最多等待 5 秒，失败则静默保留原 URL（不影响整体导出）
 */
export async function inlineOnlineImages(
    content: string,
    onProgress?: (done: number, total: number) => void
): Promise<string> {
    // 匹配所有 src="http(s)://..." 的 <img> 标签中的图片地址
    const urlRegex = /<img([^>]*?)src=["'](https?:\/\/[^"']+)["']([^>]*?)>/gi;
    const matches: Array<{ full: string; before: string; url: string; after: string }> = [];

    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(content)) !== null) {
        matches.push({ full: m[0], before: m[1], url: m[2], after: m[3] });
    }

    if (matches.length === 0) return content; // 没有在线图片，直接返回

    console.log(`[Export] 检测到 ${matches.length} 张在线图片，开始批量内联...`);

    let processedContent = content;
    let done = 0;
    const CONCURRENCY = 4;

    for (let i = 0; i < matches.length; i += CONCURRENCY) {
        const batch = matches.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
            batch.map(async (match) => {
                const rawBase64 = await fetchImageAsBase64(match.url);
                const base64 = await compressImage(rawBase64, 1200, 0.8).catch(() => rawBase64);
                return { match, base64 };
            })
        );

        for (const result of results) {
            done++;
            if (result.status === 'fulfilled') {
                const { match, base64 } = result.value;
                const newTag = `<img${match.before}src="${base64}"${match.after}>`;
                processedContent = processedContent.replace(match.full, newTag);
                console.log(`[Export] ✅ 图片已内联并压缩 (${done}/${matches.length}): ${match.url.substring(0, 60)}...`);
            } else {
                console.warn(`[Export] ⚠️ 图片内联失败，保留原链接: ${batch[results.indexOf(result)]?.url}`, result.reason);
            }
            if (onProgress) onProgress(done, matches.length);
        }
    }

    console.log(`[Export] 图片内联完成: 成功 ${done}/${matches.length}`);
    return processedContent;
}



/**
 * 从视频URL提取第一帧作为base64图片
 */
export async function extractVideoFirstFrame(videoUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        video.onloadeddata = () => {
            video.currentTime = 0.1;
        };

        video.onseeked = () => {
            try {
                const MAX_DIM = 1200;
                let w = video.videoWidth;
                let h = video.videoHeight;
                if (w > MAX_DIM) { h = Math.floor(h * MAX_DIM / w); w = MAX_DIM; }
                if (h > MAX_DIM) { w = Math.floor(w * MAX_DIM / h); h = MAX_DIM; }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法获取Canvas上下文'));
                    return;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const rawBase64 = canvas.toDataURL('image/jpeg', 0.85);
                compressImage(rawBase64, 1200, 0.8).then(resolve).catch(() => resolve(rawBase64));
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

        const timeoutId = setTimeout(() => {
            video.src = '';
            video.load();
            reject(new Error('视频首帧提取超时'));
        }, 5000);

        video.src = videoUrl;
    });
}

/**
 * 从GIF URL提取第一帧作为base64图片
 */
export async function extractGifFirstFrame(gifUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const MAX_DIM = 1200;
                let w = img.naturalWidth || img.width;
                let h = img.naturalHeight || img.height;
                if (w > MAX_DIM) { h = Math.floor(h * MAX_DIM / w); w = MAX_DIM; }
                if (h > MAX_DIM) { w = Math.floor(w * MAX_DIM / h); h = MAX_DIM; }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法获取Canvas上下文'));
                    return;
                }

                ctx.drawImage(img, 0, 0, w, h);
                const rawBase64 = canvas.toDataURL('image/jpeg', 0.85);
                compressImage(rawBase64, 1200, 0.8).then(resolve).catch(() => resolve(rawBase64));
            } catch (error) {
                console.error('提取GIF首帧失败:', error);
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('GIF加载失败'));
        };

        setTimeout(() => {
            reject(new Error('GIF首帧提取超时'));
        }, 3000);

        img.src = gifUrl;
    });
}

/**
 * 处理文章内容，将视频和GIF替换为首帧图片
 */
export async function processMediaForPrint(content: string): Promise<string> {
    let processedContent = content;

    // 1. 处理视频标签
    const videoRegex = /<video[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/video>/gi;
    const videoMatches = Array.from(content.matchAll(videoRegex));

    const videoPlaceholder = `<div class="media-print-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><polygon points="10 8 16 12 10 16 10 8"></polygon></svg><div class="media-print-placeholder-text">视频，需要观看使用电子版</div></div>`;

    for (const match of videoMatches) {
        processedContent = processedContent.replace(match[0], videoPlaceholder);
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