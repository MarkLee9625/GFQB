import { createElement } from 'react';
import { pdf, Font } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import type { Article } from '../../types';
import { MyDocument } from './pdfComponents';
import { base64ToUint8Array } from '../../utils/fileHelpers';

/**
 * @react-pdf/renderer v4.x 字体加载在 Vite ESM 环境中存在惰性加载失效问题：
 * Font.register() 仅注册字体名称，实际 woff2 数据应在渲染时自动获取，
 * 但 Vite 模块上下文中 fetch 可能被推迟或静默跳过，导致 data=null → 输出 0 页空 PDF。
 *
 * 此函数在渲染前手动预取字体二进制数据并注入 FontStore，绕过惰性加载机制。
 */
const FONT_URLS = {
  regular: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.2.9/chinese-simplified-400-normal.woff2',
  bold: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@5.2.9/chinese-simplified-700-normal.woff2',
};

async function preloadFonts(): Promise<void> {
  try {
    const fonts = (Font as any).fontFamilies?.NotoSansSC?.sources as Array<{ src: string; data: ArrayBuffer | null }> | undefined;
    if (!fonts || fonts.length === 0) return;

    // 只对仍未加载的字体源进行预取
    const urlsToFetch = fonts
      .map((s, i) => ({ idx: i, url: s.src as string }))
      .filter(({ idx }) => !fonts[idx].data);

    if (urlsToFetch.length === 0) return;

    const results = await Promise.allSettled(
      urlsToFetch.map(({ url }) =>
        fetch(url, { credentials: 'omit' }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const { idx } = urlsToFetch[i];
      if (result.status === 'fulfilled') {
        fonts[idx].data = result.value;
      } else {
        console.warn('[PDF Engine] 字体预取失败，将使用回退字体:', result.reason);
      }
    }
  } catch (error) {
    // 预取失败不应阻塞导出流程，@react-pdf/renderer 会使用内置回退字体
    console.warn('[PDF Engine] 字体预取异常，将使用回退字体:', error);
  }
}

/**
 * PDF 导出引擎选项
 */
export interface PdfExportOptions {
  /** 是否使用替代设计（杂志风格） */
  useAlternateDesign?: boolean;
  /** Logo Base64 数据 */
  logo?: string;
  /** 包含图片数据 */
  includeImages?: boolean;
  /** 优化打印布局 */
  optimizeForPrint?: boolean;
}

/**
 * 检查是否为有效的 Base64 PDF 数据
 */
function isValidPdfData(data: string): boolean {
    if (!data) return false;
    let rawBase64 = data;
    if (data.includes('base64,')) {
        rawBase64 = data.split('base64,')[1];
    }
    const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
    if (!base64Pattern.test(rawBase64)) return false;
    try {
        const bytes = base64ToUint8Array(rawBase64);
        const header = bytes.slice(0, 4);
        const headerStr = String.fromCharCode(...header);
        return headerStr === '%PDF';
    } catch {
        return false;
    }
}

/**
 * 使用 React-PDF 渲染文档并生成 ArrayBuffer
 */
async function renderDocumentBuffer(articles: Article[], options: PdfExportOptions): Promise<ArrayBuffer> {
  try {
    // 预取字体数据，修复 Vite ESM 下 @react-pdf/renderer 惰性加载失效问题
    await preloadFonts();

    // 创建 React-PDF 文档组件 - 使用直接导入的 createElement，避免 Vite 模块上下文中 createElement 引用差异
    const documentElement = createElement(MyDocument, {
      articles: articles,
      options: {
        useAlternateDesign: options.useAlternateDesign || false,
        logo: options.logo || ''
      }
    });

    // 渲染为 Blob，然后转换为 ArrayBuffer
    const pdfInstance = pdf(documentElement as any);
    const blob = await pdfInstance.toBlob();
    return await blob.arrayBuffer();
  } catch (error) {
    console.error('[PDF Engine] React-PDF 渲染失败:', error);
    throw new Error(`PDF渲染失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 加载并验证 PDF 附件
 */
async function loadPdfAttachment(pdfData: string): Promise<PDFDocument> {
  try {
    // 验证 PDF 数据
    if (!isValidPdfData(pdfData)) {
      throw new Error('无效的PDF数据格式');
    }

    let rawBase64 = pdfData;
    if (pdfData.includes('base64,')) {
        rawBase64 = pdfData.split('base64,')[1];
    }
    const buffer = base64ToUint8Array(rawBase64).buffer;
    const pdfDoc = await PDFDocument.load(buffer);
    
    // 验证 PDF 文档是否有效
    const pageCount = pdfDoc.getPageCount();
    if (pageCount === 0) {
      throw new Error('PDF文档无有效页面');
    }
    
    return pdfDoc;
  } catch (error) {
    console.error('[PDF Engine] PDF附件加载失败:', error);
    throw new Error(`PDF附件加载失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 合并主文档和PDF附件
 */
async function mergeDocuments(mainDoc: PDFDocument, articles: Article[]): Promise<PDFDocument> {
  try {
    // 遍历所有文章，查找并合并 PDF 附件
    for (const article of articles) {
      if (article.pdfData && isValidPdfData(article.pdfData)) {
        try {
          const attachmentDoc = await loadPdfAttachment(article.pdfData);
          const pageCount = attachmentDoc.getPageCount();
          
          // 复制附件页面到主文档
          for (let i = 0; i < pageCount; i++) {
            const [copiedPage] = await mainDoc.copyPages(attachmentDoc, [i]);
            mainDoc.addPage(copiedPage);
          }
          
          console.log(`[PDF Engine] 已合并文章 "${article.title}" 的 PDF 附件（${pageCount} 页）`);
        } catch (attachmentError) {
          console.warn(`[PDF Engine] 文章 "${article.title}" 的PDF附件合并失败:`, attachmentError);
          // 继续处理其他文章，不中断整个导出流程
          continue;
        }
      }
    }
    
    return mainDoc;
  } catch (error) {
    console.error('[PDF Engine] 文档合并失败:', error);
    throw new Error(`文档合并失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 触发浏览器下载PDF文件
 */
function downloadPdfFile(pdfBytes: Uint8Array, fileName: string = '工法情报_导出.pdf'): void {
  try {
    // 创建 Blob - 使用类型断言解决 TypeScript 严格类型检查
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理 URL 对象
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    
    console.log(`[PDF Engine] PDF文件已生成: ${fileName} (${pdfBytes.length} 字节)`);
  } catch (error) {
    console.error('[PDF Engine] PDF下载失败:', error);
    throw new Error(`PDF下载失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 核心导出函数：生成并下载合并后的PDF
 * 
 * @param articles 文章数组
 * @param options 导出选项
 * @returns Promise<void>
 */
export async function exportToPdf(
  articles: Article[],
  options: PdfExportOptions = {}
): Promise<void> {
  try {
    console.log('[PDF Engine] 开始PDF导出流程...');
    
    if (!articles || articles.length === 0) {
      throw new Error('没有可导出的文章');
    }
    
    // 1. 使用 React-PDF 渲染主文档
    console.log('[PDF Engine] 正在渲染React-PDF文档...');
    const mainBuffer = await renderDocumentBuffer(articles, options);
    
    // 2. 加载主文档到 pdf-lib
    console.log('[PDF Engine] 正在加载主文档...');
    const mainDoc = await PDFDocument.load(mainBuffer);
    
    // 3. 合并PDF附件
    console.log('[PDF Engine] 正在合并PDF附件...');
    const mergedDoc = await mergeDocuments(mainDoc, articles);
    
    // 4. 保存最终文档
    console.log('[PDF Engine] 正在保存最终PDF...');
    const pdfBytes = await mergedDoc.save();
    
    // 5. 触发下载
    const fileName = generateFileName(articles, options);
    downloadPdfFile(pdfBytes, fileName);
    
    console.log('[PDF Engine] PDF导出流程完成');
  } catch (error) {
    console.error('[PDF Engine] PDF导出失败:', error);
    throw new Error(`PDF导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成导出文件名
 */
function generateFileName(articles: Article[], options: PdfExportOptions): string {
  try {
    // 查找封面文章以获取期号和日期
    const coverArticle = articles.find(article => article.category === '封面');
    const issueText = coverArticle?.issueText || 'NO-01';
    const dateText = coverArticle?.dateText || (() => {
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      return `${months[new Date().getMonth()]}-${new Date().getFullYear()}`;
    })();
    
    // 清理文本，移除无效字符
    const cleanIssue = issueText.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '-');
    const cleanDate = dateText.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '-');
    
    return `工法情报_${cleanIssue}_${cleanDate}.pdf`;
  } catch {
    // 如果生成文件名失败，返回默认文件名
    return '工法情报_导出.pdf';
  }
}

/**
 * 预览PDF（生成Blob URL，用于iframe预览）
 * 
 * ⚠️ 调用者负责在不需要时调用 URL.revokeObjectURL(url) 释放内存
 * 
 * @param articles 文章数组
 * @param options 导出选项
 * @returns Promise<string> Blob URL（需手动释放）
 */
export async function previewPdf(
  articles: Article[],
  options: PdfExportOptions = {}
): Promise<string> {
  try {
    if (!articles || articles.length === 0) {
      throw new Error('没有可预览的文章');
    }
    
    // 1. 使用 React-PDF 渲染主文档
    const mainBuffer = await renderDocumentBuffer(articles, options);
    
    // 2. 加载主文档到 pdf-lib
    const mainDoc = await PDFDocument.load(mainBuffer);
    
    // 3. 合并PDF附件
    const mergedDoc = await mergeDocuments(mainDoc, articles);
    
    // 4. 保存为字节数组
    const pdfBytes = await mergedDoc.save();
    
    // 5. 创建Blob URL
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    
    console.log(`[PDF Engine] PDF预览URL已生成: ${blobUrl}`);
    return blobUrl;
  } catch (error) {
    console.error('[PDF Engine] PDF预览生成失败:', error);
    throw new Error(`PDF预览生成失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default exportToPdf;