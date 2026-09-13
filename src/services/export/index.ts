// 统一导出 - 门面模式（Facade）
export { generateReaderHTML, exportReaderHTML, type ExportOptions, type ExportMetadata } from './reader';
// 统一导出 - 门面模式（Facade）
// 说明：直出 PDF 引擎（@react-pdf/renderer）已下线，PDF 统一走“打印专用版 → 浏览器另存为 PDF”；
export { generatePrintableHTML } from './print';
export { splitDataUri, decodePdfBytes } from './utils/file';
