/**
 * 文件工具函数
 */

export function base64ToFile(base64: string, fileName: string): File {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mime });
}

export function encodeContent(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
}

export function decodeContent(encoded: string): string {
    return decodeURIComponent(escape(atob(encoded)));
}
