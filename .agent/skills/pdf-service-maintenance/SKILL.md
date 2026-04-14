---
name: pdf-service-maintenance
description: 指导如何维护、加固和升级项目的 PDF.js 核心服务。当需要处理 PDF 解析错误、调整渲染质量、配置转换选项或升级库版本时使用。
---

# PDF 服务维护技能 (PDF Service Maintenance)

本技能旨在确保项目中的 PDF.js 集成保持稳定、高性能且版本一致。

## 核心原则
1. **版本严对齐**：核心 API (`pdf.min.mjs`) 与渲染 Worker (`pdf.worker.min.mjs`) 必须保持主版本和次版本完全一致（目前为 v5.4.449）。
2. **异步初始化**：严禁在未 `await ensurePdfJsReady()` 的情况下调用 `getDocument`。
3. **资源路径固定**：Worker 和 WASM 资源必须使用 `window.location.origin` 的绝对路径，严禁在路径中使用随机时间戳（会破坏某些环境的 MJS 解析）。

### 高级配置
```typescript
export interface PdfToImageOptions {
    scale?: number;       // 缩放比例，默认3.0（约300 DPI）
    quality?: number;     // JPEG质量，默认0.98 (0.0-1.0)
    format?: 'jpeg' | 'png'; // 输出格式，默认jpeg
    onProgress?: (current: number, total: number) => void; // 进度回调
    maxPages?: number;    // 最大处理页数，默认50
}

const images = await convertPdfToImages(pdfFile, {
    scale: 4.0,      // 高清晰度（约400 DPI）
    quality: 0.98,   // 高质量标准
    format: 'png',   // PNG格式（无损）
    maxPages: 30,    // 限制处理页数以避免内存溢出
    onProgress: (current, total) => {
        console.log(`转换进度: ${current}/${total}`);
    }
});
```

### 质量与性能权衡
| 配置 | scale | quality | format | 用途 |
|------|-------|---------|--------|------|
| 高质量 | 4.0 | 0.98 | png | 技术文档、图纸 |
| **默认** | **3.0** | **0.98** | **jpeg** | **一般文档（打印优选）** |
| 性能优先 | 2.0 | 0.85 | jpeg | 低内存设备 |
| 极速模式 | 1.5 | 0.75 | jpeg | 移动端快速预览 |

## 关键参数规范
- **渲染采样率 (Scale)**：
  - 默认值：`3.0` (约 300 DPI)。
  - 性能模式：`2.2` (适用于低内存设备)。
  - 高清模式：`4.0` (约 400 DPI)。
  - 极速模式：`1.5` (约 150 DPI，适用于预览)。
- **输出格式**：`image/jpeg`（推荐）或 `image/png`（无损但更大）。
- **压缩质量**：`0.98` (针对 A4 打印优化的极高质量)。
- **最大页数**：默认 `50`，可根据设备性能调整。

## PDF处理策略差异

### 打印版 (Printable)
- **策略**：自动将 PDF 转换为图片并嵌入
- **原因**：打印时避免 PDF 对象无法打印的问题
- **实现**：在 `generatePrintableHTML` 中调用 `convertPdfToImages`

### 阅读版 (Reader)
- **策略**：保留 PDF 原始格式，提供交互式预览
- **原因**：支持缩放、搜索等 PDF 原生功能
- **实现**：直接传递 `pdfData`，由阅读器组件渲染

### 预览版 (Preview)
- **策略**：仅转换前几页为低分辨率图片
- **原因**：快速加载，减少内存使用
- **实现**：设置 `maxPages: 3` 和 `scale: 1.5`

## 常见故障排除
- **UnknownErrorException**: 
  - 检查浏览器控制台。如果提示 "Version mismatch"，请运行 `npm run sync:worker` 同步 `node_modules` 资源。
  - 检查是否缺少 `await` 关键字。
- **内存溢出 (OOM)**:
  - 确保每页渲染后 canvas 均被回收（或复用）。
  - 考虑将 `MAX_PAGES` 限制在 50 页以内。
  - 降低 `scale` 参数（如 2.0）。
  - 使用 `maxPages` 参数限制处理页数。
- **转换质量不佳**:
  - 提升 `scale`（如 4.0）和 `quality`（如 0.95）。
  - 考虑使用 `format: 'png'`。
- **Worker 加载失败**:
  - 检查 `pdf.worker.min.mjs` 路径是否正确。
  - 确保服务器配置允许跨域请求（如果使用 CDN）。

## 开发流程
1. 修改 `scripts/copy-worker.js` 中的资源定义。
2. 执行 `npm run sync:worker` 同步 `public` 目录。
3. 在 `src/services/pdf/index.ts` 中维护核心逻辑。
4. 在 `src/services/export/index.ts` 中调用 PDF 转换功能。

## 版本管理
- **当前推荐版本**：PDF.js v5.4.449
- **升级流程**：
  1. 更新 `package.json` 中的 `pdfjs-dist` 版本
  2. 运行 `npm install` 安装新版本
  3. 运行 `npm run sync:worker` 同步资源
  4. 测试 PDF 转换功能确保正常工作

## 性能优化
- **Canvas 复用**：在处理多页 PDF 时，复用同一个 Canvas 元素，避免频繁创建和销毁 DOM 元素。
- **内存监控**：使用 `useMemoryMonitor` hook 监控内存使用情况，在内存不足时自动调整转换参数。
- **分块处理**：对于大型 PDF，考虑分块处理，避免一次性加载全部页面。
