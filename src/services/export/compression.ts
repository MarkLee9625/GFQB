/**
 * 压缩与解压工具模块
 * 提供基于浏览器原生 CompressionStream API 的高性能数据压缩解压能力
 * 支持回退到 fflate 库以兼容旧版浏览器
 */

/**
 * 检测浏览器是否支持原生 CompressionStream API
 */
function supportsCompressionStream(): boolean {
    return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * 将 Uint8Array 转换为 Base64 字符串（分块处理避免栈溢出）
 * 针对大数据量优化，避免 "Maximum call stack size exceeded" 错误
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    const chunkSize = 8192; // 8KB 分块
    const len = bytes.length;
    let binary = '';
    
    for (let i = 0; i < len; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
        // 使用 apply 的替代方案，避免参数过多
        binary += String.fromCharCode(...chunk);
    }
    
    return btoa(binary);
}

/**
 * 使用原生 CompressionStream API 压缩数据
 * @param data 要压缩的字符串数据
 * @param format 压缩格式，默认为 'gzip'
 */
async function compressWithNativeAPI(data: string, format: 'gzip' | 'deflate' = 'gzip'): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    
    const compressionStream = new CompressionStream(format);

    const readableStream = new ReadableStream({
        start(controller) {
            controller.enqueue(dataBytes);
            controller.close();
        }
    });
    
    const pipeResult = readableStream.pipeThrough(compressionStream);
    const reader = pipeResult.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value instanceof Uint8Array) {
            chunks.push(value);
            totalSize += value.length;
        }
    }
    
    // 合并所有块
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    
    return result;
}


/**
 * 压缩数据（自动选择原生API或fflate回退）
 * @param data 要压缩的字符串数据
 * @param format 压缩格式，默认为 'gzip'
 */
export interface CompressionResult {
    data: Uint8Array;
    method: 'gzip' | 'deflate' | 'none';
}

/** R2 守卫阈值：单张 PNG 超过此二进制体积即告警（照片类 PNG 应走 WebP） */
export const PNG_GUARD_THRESHOLD_BYTES = 500 * 1024;

/**
 * R2 守卫：统计 JSON 内超阈 PNG data URI 的处数与二进制体积。
 * 纯函数，可单测；调用方（导出 Worker）在主线程外执行，正则一次扫描。
 */
export function countLargePngs(json: string, thresholdBytes = PNG_GUARD_THRESHOLD_BYTES): {
    count: number;
    binBytes: number;
} {
    const re = /data:image\/png;base64,([A-Za-z0-9+/=]+)/g;
    let m: RegExpExecArray | null;
    let count = 0;
    let binBytes = 0;
    const minB64Len = Math.ceil((thresholdBytes * 4) / 3);
    while ((m = re.exec(json)) !== null) {
        if (m[1].length >= minB64Len) {
            count += 1;
            binBytes += (m[1].length * 3) >> 2;
        }
    }
    return { count, binBytes };
}

export async function compressData(data: string, format: 'gzip' | 'deflate' = 'gzip'): Promise<CompressionResult> {
    if (supportsCompressionStream()) {
        console.log('[压缩] 使用原生 CompressionStream API');
        const compressed = await compressWithNativeAPI(data, format);
        return { data: compressed, method: format };
    }
    
    console.log('[压缩] 原生 API 不可用，回退到 fflate');
    try {
        const fflate = await import('fflate');
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        
        const compressed = fflate.gzipSync(dataBytes);
        return { data: compressed, method: format };
    } catch (error) {
        console.error('[压缩] fflate 加载失败，使用未压缩数据', error);
        return { data: new TextEncoder().encode(data), method: 'none' };
    }
}