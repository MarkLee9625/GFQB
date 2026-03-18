import { CONSTANTS } from '../../../../types';

/**
 * 从视频URL提取第一帧作为base64图片
 */
export async function extractVideoFirstFrame(videoUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        video.onloadeddata = () => {
            // 设置时间为0.1秒，确保加载了有效帧
            video.currentTime = 0.1;
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法获取Canvas上下文'));
                    return;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64Image = canvas.toDataURL('image/jpeg', 0.8);
                resolve(base64Image);
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

        // 设置超时
        setTimeout(() => {
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
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法获取Canvas上下文'));
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const base64Image = canvas.toDataURL('image/png', 0.9);
                resolve(base64Image);
            } catch (error) {
                console.error('提取GIF首帧失败:', error);
                reject(error);
            }
        };

        img.onerror = () => {
            reject(new Error('GIF加载失败'));
        };

        // 设置超时
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

    for (const match of videoMatches) {
        const videoTag = match[0];
        const videoSrc = match[1];

        try {
            console.log('正在提取视频首帧:', videoSrc);
            const firstFrameBase64 = await extractVideoFirstFrame(videoSrc);
            const imgTag = `<img src="${firstFrameBase64}" alt="视频首帧" style="max-width: 100%; height: auto; display: block; margin: 20px auto; border: 2px solid #e5e7eb; border-radius: 8px;" />`;
            processedContent = processedContent.replace(videoTag, imgTag);
        } catch (error) {
            console.warn('视频首帧提取失败，使用占位符:', error);
            // 使用占位符
            const placeholder = `<div class="media-print-placeholder"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><polygon points="10 8 16 12 10 16 10 8"></polygon></svg><div style="margin-top: 10px; color: #666; font-size: 14px;">此处为视频资源，请查阅电子版</div></div>`;
            processedContent = processedContent.replace(videoTag, placeholder);
        }
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