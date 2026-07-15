import { base64ToUint8Array } from '../../../utils/fileHelpers';

/**
 * 文件工具函数
 */

export function base64ToFile(base64: string, fileName: string): File {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const u8arr = base64ToUint8Array(arr[1]);
    return new File([u8arr], fileName, { type: mime });
}

export function encodeContent(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
}
