---
name: export-template-unification
description: 指导如何保持编辑器与导出版阅读器 UI 样式的高度一致。当修改编辑器排版样式、媒体布局或核心配色时使用。
---

# 导出模板一致性同步技能 (Export Template Unification)

本技能旨在消除“双重复写样式”的开发负担，确保阅读版 100% 还原编辑器的视觉体感。

## 核心机制：样式继承
项目采用“单源定义”模式。所有核心排版样式必须定义在 `types.ts` 的 `CONSTANTS.UNIFIED_STYLES` 中。

- **编辑器端**：通过 `<style>{CONSTANTS.UNIFIED_STYLES}</style>` 实时应用排版。
- **阅读器端**：在 `src/services/export/assets.ts` 中通过模板字符串插入 `${UNIFIED_STYLES}`。
- **打印版 (Print Isolation)**：在 `generatePrintableHTML` 中，重点通过静态 CSS 还原 A4 分页逻辑。使用 `.print-page-wrapper` 作为每个物理页面的根容器，并利用 `.no-print` 隐藏不需要打印的 UI 元素。严禁让内部文档流随机分页（必要时使用 `page-break-inside: avoid`）。

## 多媒体打印降维 (Media Fallback)
由于打印不支持动态视频和纯 GIF 动画，在 `src/services/export/index.ts` 中必须启用首帧提取降维：
- **Video/GIF**：导出前利用 `processMediaForPrint` 方法，将其转为静止的首帧图像（Base64）。对于无法转换的媒体或出错场景，必须渲染出一个 `.media-print-placeholder` 提示块，防止打印版大片空白。

## 禁止行为
- **严禁** 在 `src/services/export/assets.ts` 中手动定义针对 `.sws-prose` 的私有媒体约束（如 `max-width`）。
- **严禁** 为了临时修复阅读器样式而避开 `UNIFIED_STYLES` 进行原地修改。

## 同步流程
1. **修改源**：在 `types.ts` 中调整 `UNIFIED_STYLES` 字符串。
2. **注入**：检查 `assets.ts` 中的 `SHARED_STYLES` 是否已包含 `${UNIFIED_STYLES}`。
3. **验证**：执行 `npm run dev` 后的导出，确认样式已生效。

## 文案与名词规范
- **摘要**：严禁使用“摘要/导读”这种复合名词，必须统称为“摘要”。所有占位符和卡片标签必须以此为准。

## 构建一致性
- **开发导出**：基于 `getReaderSkeleton` 模板，由于不经过 Vite 编译，会有微小差异（5%）。
- **生产克隆**：执行 `npm run build` 后，`post-build.js` 会将编译后的 React 真实样式内联，达到 100% 克隆。
