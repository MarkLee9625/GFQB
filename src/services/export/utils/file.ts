/**
 * 工具函数：文件处理
 */

/**
 * 编码内容为Base64
 */
export function encodeContent(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
}

/**
 * 将base64字符串转换为File对象
 */
export function base64ToFile(base64: string, filename: string): File {
    try {
        let mime = 'application/pdf';
        let bstr: string;

        if (base64.includes('base64,')) {
            const arr = base64.split(',');
            mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
            bstr = atob(arr[1]);
        } else {
            // 如果是纯 Base64 字符串
            bstr = atob(base64);
        }

        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    } catch (error) {
        console.error('[Export] base64ToFile 转换失败:', error);
        throw error;
    }
}