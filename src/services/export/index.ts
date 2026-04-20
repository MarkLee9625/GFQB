// 统一导出 - 门面模式（Facade）
export { generateReaderHTML, exportReaderHTML, type ExportOptions, type ExportMetadata } from './reader';
export { generatePrintableHTML } from './print';
export { encodeContent, base64ToFile } from './utils/file';
export { processMediaForPrint, extractVideoFirstFrame, extractGifFirstFrame, inlineOnlineImages } from './utils/media';

// PDF 导出引擎
export { exportToPdf, previewPdf, type PdfExportOptions } from './pdfEngine';

import { CONSTANTS } from '../../constants';
export const APP_CONFIG = {
    company: CONSTANTS.COMPANY_INFO,
    version: '1.0.0'
};

