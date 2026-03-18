// 统一导出 - 门面模式（Facade）
export { generateReaderHTML, type ExportOptions, type ExportMetadata } from './reader';
export { generatePrintableHTML } from './print';
export { generateExportHtml } from './data';
export { encodeContent, base64ToFile } from './utils/file';
export { processMediaForPrint, extractVideoFirstFrame, extractGifFirstFrame } from './utils/media';

// PDF 导出引擎
export { exportToPdf, previewPdf, type PdfExportOptions } from './pdfEngine';

// 注意保留 APP_CONFIG 等必要的常量导出
import { CONSTANTS } from '../../../types';
export const APP_CONFIG = {
    company: CONSTANTS.COMPANY_INFO,
    version: '1.0.0'
};


