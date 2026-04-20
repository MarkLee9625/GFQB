# 打印版功能审查与优化计划

## 一、Bug 审查结果

### 🔴 严重 Bug

#### 1. 目录页码完全不准确
- **位置**: [print.ts:41-47](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/print.ts#L41)
- **问题**: 目录页码使用简单序号 `i + 1`，而非实际打印页码。每篇文章可能跨多页，导致页码与实际完全不符。
- **影响**: 打印后无法通过目录定位文章，严重影响专业期刊的实用性。

#### 2. 封底背景图片 URL 未转义（XSS 风险）
- **位置**: [print.ts:142](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/print.ts#L142)
- **问题**: 原版封底 `ambient-bg` 的 `background-image:url()` 未使用 `escapeAttr()` 转义，而封面（第97行）正确使用了转义。
- **影响**: 恶意构造的图片 URL 可能注入 CSS/HTML，存在安全隐患。

#### 3. `includeImages` 选项对打印版无效
- **位置**: [useExportManager.ts:74](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useExportManager.ts#L74) → [print.ts:21-25](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/print.ts#L21)
- **问题**: `generatePrintableHTML` 的 `options` 参数类型是 `ExportOptions`（只有 `useAlternateDesign`），但 `useExportManager` 传入了包含 `includeImages` 和 `optimizeForPrint` 的对象。用户勾选/取消"包含图片数据"对打印版无任何效果。
- **影响**: 用户以为可以控制图片嵌入，实际上选项被静默忽略。

### 🟡 中等 Bug

#### 4. 版权年份硬编码为 2025
- **位置**: [print.ts:128](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/print.ts#L128)
- **问题**: `© 2025 Ship Construction Method` 硬编码年份，跨年后显示错误。
- **修复**: 使用 `new Date().getFullYear()` 动态获取。

#### 5. 打印版工具栏两个按钮功能完全重复
- **位置**: [printableSkeleton.ts:274-279](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/print/printableSkeleton.ts#L274)
- **问题**: "导出PDF / 打印" 和 "快捷键: Ctrl+P" 两个按钮都调用 `window.print()`，功能完全相同，后者无实际意义。
- **修复**: 移除冗余按钮，或改为"关闭预览"等不同功能。

#### 6. 在线图片未内联到打印版
- **位置**: [media.ts:221-268](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/utils/media.ts#L221)
- **问题**: `processMediaForPrint` 只处理视频/GIF/图片尺寸，未调用 `inlineOnlineImages` 将在线图片转为 Base64。打印版 HTML 中的在线图片在离线环境下无法显示。
- **影响**: 用户下载打印版后断网打开，所有在线图片显示为裂图。

#### 7. 打印版骨架中的中文注释乱码
- **位置**: [printableSkeleton.ts:41-192](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/print/printableSkeleton.ts#L41)
- **问题**: 多处中文注释显示为乱码（如 `姝枃鏂囩珷鍦ㄩ瑙堜腑涓嶅己鍒?97mm楂樺高度`），是 UTF-8 编码被错误解码的结果。
- **影响**: 不影响功能，但严重影响代码可维护性。

---

## 二、用户体验问题

### 🔴 严重影响体验

#### 1. 导出选项弹窗文案不准确
- **位置**: [ExportOptionsModal.tsx:48](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/ExportOptionsModal.tsx#L48)
- **问题**: 
  - 标题固定为"导出阅读版选项"（第48行）
  - 确认按钮固定为"导出阅读版"（第186行）
  - 说明文案固定为"导出的HTML文件..."（第167行）
  - 当用户选择"打印专用版"或"PDF文档"时，这些文案具有误导性。

#### 2. 打印版直接下载而非预览
- **位置**: [useExportManager.ts:74-80](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useExportManager.ts#L74)
- **问题**: 打印版导出时直接下载 HTML 文件，用户需要手动找到文件并打开才能看到打印预览。对比阅读版（新窗口打开），体验断裂。
- **建议**: 改为在新标签页中打开预览，用户可直接看到效果并使用 Ctrl+P 打印。

### 🟡 轻微体验问题

#### 3. 打印版文件名不包含期号信息
- **位置**: [useExportManager.ts:75](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useExportManager.ts#L75)
- **问题**: 文件名 `SWS_Printable_2026-04-20.html` 只有日期，没有期号，难以区分不同期。

#### 4. "包含打印适配"选项仅在阅读版显示
- **位置**: [ExportOptionsModal.tsx:145-158](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/ExportOptionsModal.tsx#L145)
- **问题**: "包含打印适配"选项仅在阅读版模式下显示，但打印版和 PDF 版同样需要打印适配，选项展示逻辑不合理。

---

## 三、优化建议

### 🚀 高优先级优化

#### 1. 打印版改为新窗口预览模式
- **当前**: 直接下载 HTML 文件
- **优化**: 在新标签页中打开 Blob URL 预览，用户可直接 Ctrl+P 打印
- **实现**: 修改 `useExportManager.ts` 中打印版分支，使用 `window.open(url, '_blank')` 替代下载逻辑

#### 2. 修复导出选项弹窗动态文案
- **优化**: 根据选择的导出类型动态更新标题、按钮文案和说明
  - 阅读版 → "导出阅读版" / "导出的HTML文件包含所有文章、图片和导航功能"
  - 打印版 → "导出打印版" / "导出适合A4打印的HTML文件，包含所有文章内容"
  - PDF → "导出PDF文档" / "生成标准PDF格式文档，便于分发和归档"

#### 3. 整合 `inlineOnlineImages` 到打印版流程
- **优化**: 在 `processMediaForPrint` 中调用 `inlineOnlineImages`，确保打印版离线可用
- **实现**: 在 `generatePrintableHTML` 中，对 `processedContent` 调用 `inlineOnlineImages`

#### 4. 修复目录页码
- **方案A**: 使用 CSS 计数器 `counter-increment` + `content: counter(page)` 实现自动页码（浏览器打印时自动计算）
- **方案B**: 移除目录中的页码，改为仅显示文章标题列表（简化但实用）
- **推荐**: 方案A，更专业

### 📈 中优先级优化

#### 5. 添加页眉页脚
- 在打印版中添加页眉（期号、日期）和页脚（页码），提升专业期刊感
- 使用 `@page` 的 `@bottom-center` 等规则实现

#### 6. 添加导出进度反馈
- 在生成打印版 HTML 时，如果包含 PDF 转图片等耗时操作，应提供进度反馈
- 可以在 `ExportOptionsModal` 中添加进度条

#### 7. 修复 `includeImages` 选项对打印版的实际控制
- 扩展 `ExportOptions` 类型，使 `includeImages` 在打印版中生效
- 当 `includeImages = false` 时，跳过 `inlineOnlineImages` 和图片压缩

#### 8. 优化知识图谱静态 SVG 布局
- 当前圆形排列可能导致节点文字重叠
- 改进布局算法，增加节点间距，或使用力导向布局的静态版本

### 💡 低优先级优化

#### 9. 修复打印版骨架中文注释乱码
- 将乱码注释替换为正确的中文或英文注释

#### 10. 打印版文件名包含期号
- 从 `sidebarMeta` 或文章数据中提取期号信息

#### 11. 移除冗余打印按钮
- 移除"快捷键: Ctrl+P"按钮，或改为"关闭预览窗口"按钮

---

## 四、实施步骤

### 第一阶段：Bug 修复（必须）

1. **修复封底背景图片 URL 未转义** — `print.ts:142`
2. **修复版权年份硬编码** — `print.ts:128`
3. **修复 `includeImages` 选项对打印版无效** — 扩展 `ExportOptions` 类型
4. **修复导出选项弹窗动态文案** — `ExportOptionsModal.tsx`
5. **修复打印版骨架中文注释乱码** — `printableSkeleton.ts`
6. **移除冗余打印按钮** — `printableSkeleton.ts`

### 第二阶段：体验优化（推荐）

7. **打印版改为新窗口预览** — `useExportManager.ts`
8. **整合 `inlineOnlineImages` 到打印版** — `print.ts` + `media.ts`
9. **修复目录页码** — `print.ts` + `printableSkeleton.ts`
10. **打印版文件名包含期号** — `useExportManager.ts`

### 第三阶段：增强功能（可选）

11. **添加页眉页脚** — `printableSkeleton.ts`
12. **添加导出进度反馈** — `ExportOptionsModal.tsx` + `useExportManager.ts`
13. **优化知识图谱静态 SVG** — `graphRenderer.ts`
