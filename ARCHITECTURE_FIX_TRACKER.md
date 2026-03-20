# 架构重构任务追踪器

## 阶段 1：封面视觉融合与视图大一统
- [x] 1.1 `src/components/PaperView.tsx`: 在原版(Original)设计的 `<LazyImage>` 中追加 `mix-blend-multiply` 类，消除 JPEG 白边。
- [x] 1.2 `src/components/Editor.tsx`: 增加对 `formData.category` (封面/封底) 的条件渲染拦截。
- [x] 1.3 `src/components/Editor.tsx`: 为封面/封底构建专属预览态，引入 `<AmbientBg>`、`<TechGrid>` 并在图片上应用 `mix-blend-multiply`，隐藏默认的 `.sws-prose` 富文本区。

## 阶段 2：打印架构重构 (原生打印与导出修复)
- [x] 2.1 `src/index.css`: 从 `@media print` 的隐藏列表(`display: none`)中移除 `.pdf-viewer-container`，防止原生打印丢失 PDF。
- [x] 2.2 `src/index.css`: 在 `@media print` 顶部添加全局强制解绑约束：`* { overflow: visible !important; max-height: none !important; } body, html, #root { height: auto !important; }`，修复长文章截断问题。
- [x] 2.3 `src/index.css`: 修正 `page-break-inside: avoid` 规则，将其从 `p`, `ul`, `ol`, `li` 中移除，允许段落正常跨页断行，消除巨大空白页。
- [x] 2.4 `src/services/export/print.ts`: 修改 `GLOBAL_PRINT_CSS` 中 `.pdf-full-page` 的硬编码高度。将 `297mm` / `210mm` 改为自适应的 `width: 100% !important; height: 100vh !important; max-height: 297mm !important;`，修复 PDF 导出时的双重空白页。

## 阶段 3：底部导航组件视觉融合
- [x] 3.1 对比 `components/Editor.tsx` 与 `components/PaperView.tsx` 中导航组件的 DOM 挂载位置。
- [x] 3.2 分析问题根源：导航组件位于 App.tsx 中，与 PaperView 组件同级。在编辑模式下，PaperView 底部样式与 NavigationCapsule 的 mt-12 产生视觉断层。
- [x] 3.3 修复 App.tsx 中 PaperView 与 NavigationCapsule 的容器结构，确保连续背景色和无缝隙连接。

---

### 阶段 1 & 2：架构代码执行指令
写入 Tracker 文件后，请读取该文件并开始逐项执行。以下是各步骤的代码修改技术细节要求：

**关于阶段 1 (UI 融合)：**
* 在 `Editor.tsx` 中构造预览态时，请确保使用 `bg-gray-50/50` 作为底层，并正确传递 `article.coverImage` (或 backImage) 给图片和 `AmbientBg` 组件。
* 添加文案提示："请在右侧控制面板上传/更换图片。当前为封面排版专属预览视图。"

**关于阶段 2 (打印修复)：**
* 在 `index.css` 的 `@media print` 块中查找。务必精准移除引发截断和丢失的罪魁祸首。只保留对 `h1, h2, h3, img, table` 的 `page-break-inside: avoid`。

**执行反馈循环：**
每完成 Tracker 中的一个子任务（例如 1.1），请立即使用代码编辑工具将 `ARCHITECTURE_FIX_TRACKER.md` 对应的 `[ ]` 修改为 `[x]` 并保存。然后向我报告该步完成，再继续下一步。

现在，请先创建 `ARCHITECTURE_FIX_TRACKER.md`。