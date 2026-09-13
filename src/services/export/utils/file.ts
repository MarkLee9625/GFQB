import { base64ToUint8Array } from '../../../utils/fileHelpers';

/**
 * 从 DataURI 或裸 base64 中提取原始 base64 负载与 MIME。
 * 历史数据中 pdfData 可能是 `data:application/pdf;base64,...`，也可能是裸 base64，
 * 此处两种都兼容；非法输入返回 null 而非抛错，由调用方降级为占位提示。
 */
export function splitDataUri(input: string): { mime: string; base64: string } | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) {
        const commaIdx = trimmed.indexOf(',');
        if (commaIdx === -1) return null;
        const header = trimmed.slice(0, commaIdx);
        const base64 = trimmed.slice(commaIdx + 1).replace(/\s/g, '');
        const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
        if (!base64) return null;
        return { mime, base64 };
    }
    const base64 = trimmed.replace(/\s/g, '');
    if (!base64) return null;
    return { mime: 'application/octet-stream', base64 };
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * 校验并解码 PDF 数据（兼容 DataURI / 裸 base64）。
 * 成功返回字节，失败返回 null。供打印链路使用，不抛错。
 */
export function decodePdfBytes(pdfData: string): Uint8Array | null {
    const parts = splitDataUri(pdfData);
    if (!parts) return null;
    // base64 可能很长，分段校验避免一次性正则回溯开销
    const compact = parts.base64;
    if (compact.length % 4 !== 0 || !BASE64_PATTERN.test(compact.slice(0, 1024 * 1024))) return null;
    try {
        const bytes = base64ToUint8Array(compact);
        if (bytes.length < 4) return null;
        const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        return header === '%PDF' ? bytes : null;
    } catch {
        return null;
    }
}

export function base64ToFile(base64: string, fileName: string, fallbackMime = 'application/octet-stream'): File {
    const parts = splitDataUri(base64);
    if (!parts) throw new Error('无效的 base64 数据');
    const mime = parts.mime === 'application/octet-stream' && fallbackMime !== 'application/octet-stream'
        ? fallbackMime
        : parts.mime;
    const u8arr = base64ToUint8Array(parts.base64);
    return new File([u8arr as BlobPart], fileName, { type: mime });
}

export function encodeContent(content: string): string {
    return btoa(unescape(encodeURIComponent(content)));
}
