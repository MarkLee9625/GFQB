import { CONSTANTS } from '../../types';

/**
 * 文件转换为DataURL（带内存优化）
 * @param file 
 * @returns 
 */
export const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error('文件为空'));
        }

        // 根据文件类型设置不同的文件大小限制
        let MAX_FILE_SIZE;
        const fileType = file.type.split('/')[0]; // 'image', 'video', 'audio', 'application'

        if (fileType === 'video') {
            MAX_FILE_SIZE = 50 * 1024 * 1024; // 视频文件：50MB
        } else if (fileType === 'audio') {
            MAX_FILE_SIZE = 20 * 1024 * 1024; // 音频文件：20MB
        } else if (fileType === 'image') {
            MAX_FILE_SIZE = 10 * 1024 * 1024; // 图片文件：10MB
        } else if (file.type === 'application/pdf') {
            MAX_FILE_SIZE = 30 * 1024 * 1024; // PDF文件：30MB
        } else {
            MAX_FILE_SIZE = 10 * 1024 * 1024; // 其他文件：10MB
        }

        if (file.size > MAX_FILE_SIZE) {
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
            const maxSizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
            return reject(new Error(`${fileType === 'video' ? '视频' : fileType === 'audio' ? '音频' : '文件'}大小超过限制 (${fileSizeMB}MB > ${maxSizeMB}MB)`));
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
                resolve(result);
            } else {
                reject(new Error('文件读取结果不是字符串'));
            }
        };

        reader.onerror = (e) => {
            const error = e.target?.error;
            reject(new Error(`文件读取失败: ${error?.message || '未知错误'}`));
        };

        reader.onabort = () => {
            reject(new Error('文件读取被中止'));
        };

        try {
            reader.readAsDataURL(file);
        } catch (error) {
            reject(new Error(`读取文件时发生异常: ${error instanceof Error ? error.message : '未知错误'}`));
        }
    });
};

/**
 * 图片压缩优化
 * @param file 
 * @returns 
 */
export const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return reject(new Error('文件不是图片类型'));
        }

        // 检查文件大小，如果小于阈值直接返回
        const MAX_SIZE_WITHOUT_COMPRESSION = 1024 * 1024; // 1MB
        if (file.size <= MAX_SIZE_WITHOUT_COMPRESSION) {
            fileToDataURL(file).then(resolve).catch(reject);
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('无法获取canvas上下文'));
                }

                const maxWidth = CONSTANTS.IMAGES.MAX_WIDTH;
                const maxHeight = maxWidth * 1.5; // 使用宽度的1.5倍作为最大高度
                let width = img.width;
                let height = img.height;

                // 计算缩放比例
                if (width > maxWidth || height > maxHeight) {
                    const widthRatio = maxWidth / width;
                    const heightRatio = maxHeight / height;
                    const ratio = Math.min(widthRatio, heightRatio);

                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                // 设置canvas尺寸
                canvas.width = width;
                canvas.height = height;

                // 优化图片质量
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // 绘制图片
                ctx.drawImage(img, 0, 0, width, height);

                // 根据文件类型选择压缩格式
                let mimeType = 'image/jpeg';
                let quality = CONSTANTS.IMAGES.QUALITY;

                if (file.type === 'image/png') {
                    mimeType = 'image/png';
                    quality = 0.9; // PNG质量参数不同
                } else if (file.type === 'image/webp') {
                    mimeType = 'image/webp';
                }

                try {
                    const compressedDataUrl = canvas.toDataURL(mimeType, quality);

                    // 验证压缩结果
                    if (compressedDataUrl.length < 100) {
                        console.warn('压缩后图片数据异常，使用原始数据');
                        fileToDataURL(file).then(resolve).catch(reject);
                        return;
                    }

                    resolve(compressedDataUrl);
                } catch (error) {
                    console.error('图片压缩失败:', error);
                    // 压缩失败时返回原始图片
                    fileToDataURL(file).then(resolve).catch(reject);
                }
            };

            img.onerror = () => {
                console.error('图片加载失败');
                reject(new Error('图片加载失败'));
            };
        };

        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };

        reader.readAsDataURL(file);
    });
};

/**
 * Base64转换为Blob（带错误处理和内存优化）
 * @param dataURI 
 * @returns 
 */
export const base64ToBlob = (dataURI: string): Blob => {
    try {
        if (!dataURI || typeof dataURI !== 'string') {
            console.warn('base64ToBlob: 输入数据无效');
            return new Blob([]);
        }

        const splitIndex = dataURI.indexOf(',');
        if (splitIndex === -1) {
            console.warn('base64ToBlob: 无效的DataURI格式');
            return new Blob([]);
        }

        const base64 = dataURI.substring(splitIndex + 1);

        // 验证base64字符串
        if (!base64 || base64.trim() === '') {
            console.warn('base64ToBlob: base64数据为空');
            return new Blob([]);
        }

        // 清理base64字符串（移除空格和换行）
        const cleanBase64 = base64.replace(/\s/g, '');

        let byteString: string;
        try {
            byteString = atob(cleanBase64);
        } catch (e) {
            console.error('base64ToBlob: base64解码失败', e);
            return new Blob([]);
        }

        // 提取MIME类型
        const mimeMatch = dataURI.match(/data:([^;]+);/);
        const mimeString = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

        // 将字节字符串转换为Uint8Array
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteArray[i] = byteString.charCodeAt(i);
        }

        // 创建并返回Blob对象
        return new Blob([byteArray], { type: mimeString });
    } catch (error) {
        console.error('base64ToBlob: 转换过程中发生错误', error);
        return new Blob([]);
    }
};

/**
 * 极简 Markdown 转 HTML 转换器（轻量级）
 * @param mdText Markdown 格式文本
 * @returns 转换后的 HTML 字符串
 */
export function parseMarkdownToHtml(mdText: string): string {
  let html = mdText;
  // 处理标题
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  // 处理加粗和斜体
  html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
  // 处理图片 (突破微信防盗链！)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2" alt="$1" referrerpolicy="no-referrer" style="max-width:100%; border-radius:8px; margin:16px auto; display:block;" />');
  // 处理链接
  html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" style="color:#3b82f6;">$1</a>');
  // 处理段落换行 (保留双换行为段落)
  html = html.split('\n\n').map(p => p.trim() ? `<p style="margin-bottom:1em; line-height:1.6;">${p}</p>` : '').join('\n');
  return html;
}
