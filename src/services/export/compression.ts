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
        binary += String.fromCharCode.apply(null, chunk as any);
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
 * 使用原生 DecompressionStream API 解压数据
 * @param compressedBytes 压缩后的字节数据
 * @param format 压缩格式，默认为 'gzip'
 */
async function decompressWithNativeAPI(compressedBytes: Uint8Array, format: 'gzip' | 'deflate' = 'gzip'): Promise<string> {
    const decompressionStream = new DecompressionStream(format);
    
    const readableStream = new ReadableStream({
        start(controller) {
            controller.enqueue(compressedBytes);
            controller.close();
        }
    });
    
    const pipeResult = readableStream.pipeThrough(decompressionStream);
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
    
    return new TextDecoder().decode(result);
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