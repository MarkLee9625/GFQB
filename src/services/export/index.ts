// 统一导出 - 门面模式（Facade）
export { generateReaderHTML, exportReaderHTML, type ExportOptions, type ExportMetadata } from './reader';
export { generatePrintableHTML } from './print';
export { encodeContent, base64ToFile } from './utils/file';
export { processMediaForPrint, extractGifFirstFrame, inlineOnlineImages } from './utils/media';

// PDF 导出引擎
export { exportToPdf, previewPdf, type PdfExportOptions } from './pdfEngine';
