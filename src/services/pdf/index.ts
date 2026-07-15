import { pdfjsLib, ensurePdfLibLoaded, workerUrl } from './wrapper';
import { extractTitle } from './strategies/title';
import { extractAbstract } from './strategies/abstract';
import { extractKeywords } from './strategies/keywords';
import { compressImage, base64ToUint8Array } from '../../utils/fileHelpers';

const ensurePdfJsReady = async () => {
    await ensurePdfLibLoaded();

    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
            console.log(`[PDF服务] GlobalWorkerOptions 配置成功: ${workerUrl}`);
        }
    }
};

// 初次尝试配置 (不阻塞)
ensurePdfJsReady();

export interface PdfExtractionResult {
    success: boolean;
    abstract?: string | null;
    title?: string | null;
    error?: string;
    pagesCount?: number;
    textLength?: number;
    keywords?: string[];
    fullText?: string; // 【新增】供 64K 图谱引擎生啃的完整纯文本
}

/**
 * PDF 解析主服务：协调各个策略模块
 */
export async function extractAbstractFromPdf(
    pdfData: string,
    maxPages: number = 30,
    timeoutMs: number = 30000
): Promise<PdfExtractionResult> {

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<PdfExtractionResult>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`PDF解析超时 (${timeoutMs}ms)`)), timeoutMs);
    });

    const extractionPromise = (async (): Promise<PdfExtractionResult> => {
        try {
            // 确保 Worker 已配置 (增加 await 解决初始化竞态)
            await ensurePdfJsReady();

            // 冗余检查：确保 workerSrc 已设置
            if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
            }

            if (!pdfjsLib || !pdfjsLib.getDocument) {
                throw new Error('PDF.js 库尚未加载完成，请稍候再试。');
            }

            // 1. 清洗 Base64 数据
            let cleanPdfData = pdfData;
            if (pdfData.includes('base64,')) {
                cleanPdfData = pdfData.split('base64,')[1];
            }

            // 2. 加载文档 - 转换为 Uint8Array 以获得更好的兼容性
            const bytes = base64ToUint8Array(cleanPdfData);

            const loadingTask = pdfjsLib.getDocument({
                data: bytes,
                cMapUrl: window.location.origin + '/cmaps/',
                cMapPacked: true,
                standardFontDataUrl: window.location.origin + '/standard_fonts/',
                wasmUrl: window.location.origin + '/wasm/', // 显式指定 WASM 路径
                disableRange: true,  // 禁用范围请求，强制一次性加载，提高图像解码稳定性
                disableStream: true, // 禁用流式下载
            });

            const pdf = await loadingTask.promise;
            const totalPages = pdf.numPages;
            const pagesToParse = Math.min(maxPages, totalPages);

            let fullText = '';
            console.log(`[PDF服务] 开始解析前 ${pagesToParse} 页...`);

            // 3. 逐页提取文本 (带中英文智能拼接)
            for (let i = 1; i <= pagesToParse; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                const pageText = textContent.items
                    // @ts-ignore
                    .map((item: any) => item.str)
                    .reduce((acc: string, curr: string) => {
                        if (!acc) return curr;
                        const isLastChinese = /[\u4e00-\u9fa5]/.test(acc[acc.length - 1]);
                        const isCurrChinese = /[\u4e00-\u9fa5]/.test(curr[0]);
                        return (isLastChinese && isCurrChinese) ? (acc + curr) : (acc + ' ' + curr);
                    }, '');

                fullText += pageText + '\n\n';
            }

            // 4. 执行策略解析
            const title = await extractTitle(pdf, fullText);
            const abstract = extractAbstract(fullText);
            const keywords = extractKeywords(fullText);

            // 释放资源
            if (loadingTask && loadingTask.destroy) await loadingTask.destroy();

            // 5. 结果校验
            if (fullText.trim().length < 50) {
                throw new Error('未提取到有效文本。此PDF可能是扫描件(图片)或缺少CMap字体文件。');
            }

            return {
                success: true,
                abstract,
                title,
                pagesCount: totalPages,
                textLength: fullText.length,
                keywords,
                fullText, // 【新增】将几万字的原生纯文本交出去
            };

        } catch (error) {
            console.error('[PDF解析错误]:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知PDF解析错误',
            };
        }
    })();

    try {
        const result = await Promise.race([extractionPromise, timeoutPromise]);
        if (timeoutId) clearTimeout(timeoutId);
        return result;
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        return { success: false, error: '操作超时' };
    }
}

/**
 * PDF转图片配置选项
 */
export interface PdfToImageOptions {
    scale?: number;      // 缩放比例，默认2.0（约200 DPI）
    quality?: number;    // JPEG质量，默认0.85
    format?: 'jpeg' | 'png'; // 输出格式，默认jpeg
    onProgress?: (current: number, total: number) => void; // 进度回调
}

/**
 * 将 PDF 转换为图片数组 (用于直接插入正文)
 */
export const convertPdfToImages = async (
    file: File,
    options: PdfToImageOptions = {}
): Promise<string[]> => {
    const {
        scale = 2.0,
        quality = 0.85,
        format = 'jpeg',
        onProgress
    } = options;

    console.log(`[PDF服务] 开始将 ${file.name} 转换为图片，配置:`, { scale, quality, format });

    // 确保 Worker 已配置 (增加 await 解决初始化竞态)
    await ensurePdfJsReady();

    // 冗余检查：确保 workerSrc 已设置
    if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }

    if (!pdfjsLib || !pdfjsLib.getDocument) {
        throw new Error('PDF.js 库尚未加载完成，请稍候再试。');
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: window.location.origin + '/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: window.location.origin + '/standard_fonts/',
        wasmUrl: window.location.origin + '/wasm/',
        disableRange: true,
        disableStream: true,
    });

    let pdf;
    try {
        pdf = await loadingTask.promise;
    } catch (err) {
        console.error('[PDF服务] PDF 加载失败:', err);
        throw new Error('PDF 加载失败，文件可能已损坏或受保护');
    }

    const images: string[] = [];
    const totalPages = pdf.numPages;
    const MAX_PAGES = 50;

    console.log(`[PDF服务] 文件打开成功，共 ${totalPages} 页`);

    for (let i = 1; i <= Math.min(totalPages, MAX_PAGES); i++) {
        try {
            // 调用进度回调
            if (onProgress) {
                onProgress(i, totalPages);
            }

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });

            if (context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // 填充纯白底色
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);

                // @ts-ignore
                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                    canvas: canvas,
                    intent: 'display'
                }).promise;

                // 根据配置生成图片
                const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
                const rawImageData = format === 'png'
                    ? canvas.toDataURL(mimeType)
                    : canvas.toDataURL(mimeType, quality);

                const imageData = await compressImage(rawImageData, 1600, 0.82);

                images.push(imageData);
                console.log(`[PDF服务] 已生成第 ${i} 页图片 (${scale}x 采样，已压缩)`);
            }
        } catch (pageErr) {
            console.warn(`[PDF服务] 第 ${i} 页渲染失败，跳过:`, pageErr);
        }
    }

    try {
        if (loadingTask && loadingTask.destroy) await loadingTask.destroy();
    } catch (e) {
        console.warn('[PDF服务] 销毁任务失败:', e);
    }

    if (images.length === 0) {
        throw new Error('无法从该 PDF 提取任何图片，请确认文件内容是否可读');
    }

    return images;
};
