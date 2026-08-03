---
name: export-data
description: 数据导出 — Reader离线阅读器 / 打印版 / PDF / 项目文件
---

执行三种导出模式之一，或导入已有项目文件。

## 导出类型

### 1. Reader 离线阅读器
- 生成完全自包含的 HTML 文件
- 包含所有文章、图片、样式、PDF.js 引擎
- 支持全文搜索、知识图谱交互
- 通过 `exportReaderHTML()` 生成 + post-build 注入
- 入口: `useExportManager` → `openExportOptionsModal()`

### 2. 打印版
- 生成专门优化的打印 HTML
- 严格 A4 物理分页 (`@page size: A4 portrait`)
- 隐藏所有交互 UI，确保纯内容渲染
- 通过 `generatePrintableHTML()` 生成
- 入口: `Toolbar` → 导出按钮

### 3. PDF 导出
- 基于 `@react-pdf/renderer` 生成 PDF
- 支持封面/封底/目录/文章内容
- 有设计模式切换（原版/杂志风）
- 通过 `exportToPdf()` 生成
- 入口: `ExportOptionsModal`

### 4. 项目文件导出
- 将全部数据打包为 `.html` 文件（内含 JSON data）
- 支持重新导入恢复
- 入口: `Toolbar` → 下载项目文件

## 导入
- 支持导入 `.json` 或 `.html`（读取 HTML 注释中的 DATA）
- 入口: `useImportManager.handleImport()`
