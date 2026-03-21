# 智能期刊引擎 (AI Journal Engine) 升级开发指南

## 1. 架构设计概览 (Architecture Overview)
本次升级旨在将系统从“富文本编辑器”提升为“AI 驱动的数字期刊引擎”。基于内网使用环境的约束，必须遵循以下三大架构原则：
1. **编译期 AI (Build-time AI)**：所有的 LLM 调用（拟题、摘要、扩写、标签提取）必须在**编辑阶段（外网环境）**完成。
2. **状态固化 (State Solidification)**：AI 生成的所有内容（包括知识图谱数据）必须直接落库保存，导出阅读版时需作为纯静态 HTML/JSON 下发，确保内网读者 100% 零网络依赖。
3. **轻量化渲染 (Zero-Dependency)**：知识图谱和可视化标签云需使用纯 CSS/DOM 或轻量级 Canvas 渲染，严禁引入 ECharts 等重型外部依赖。

---

## 2. 阶段开发任务划分 (Phased Execution Plan)

> **@Cline 执行指令**：请严格按照以下 4 个阶段（Phase）顺序执行。每个阶段完成后，必须暂停并向我汇报，确认无误后再进入下一阶段。

### 🚧 Phase 1: 扩建 AI 大脑引擎 (`src/services/aiService.ts`)
**目标**：在核心服务层新增三大业务能力的 Prompt 模板与 API 接口。

1. **卷首语生成器**：
   - 新增方法：`generateForeword(articlesSummary: string): Promise<string>`
   - **Prompt 要求**：扮演资深工程期刊主编，根据传入的文章标题和摘要列表，撰写 500 字左右的宏观导读。输出格式必须为带 `<p>` 的 HTML 片段。
2. **智能字数伸缩器**：
   - 新增方法：`scaleText(text: string, mode: 'expand' | 'shrink'): Promise<string>`
   - **Prompt 要求**：`expand` 模式下补充专业技术细节扩写 30%；`shrink` 模式下保留核心指标精简 30%。返回纯文本。
3. **全局标签与知识图谱提取器**：
   - 新增方法：`extractGlobalKnowledgeGraph(articlesText: string): Promise<any>`
   - **Prompt 要求**：提取核心技术概念及其关联性，返回标准的 JSON 格式（如 `{ nodes: [...], links: [...] }`）。

### 🚧 Phase 2: 实现“一键卷首语”业务流 (`App.tsx` & `Toolbar.tsx`)
**目标**：打通全局数据，利用所有文章数据自动生成特殊文章。

1. **UI 注入**：在 `Toolbar.tsx` 中新增一个具有视觉辨识度的按钮 `✨ 自动生成卷首语`。
2. **逻辑实现 (`App.tsx`)**：
   - 过滤出当前有内容的正文文章，拼接其 `title` 和 `abstract`。
   - 调用 `aiService.generateForeword`。
   - 获取结果后，调用 `createArticle()` 自动生成一篇新文章：标题设为“本期卷首语”，分类设为“特别报道”。
   - 自动 `setCurrentId` 跳转到该文章预览。

### 🚧 Phase 3: 实现“智能字数伸缩”排版功能 (`Editor.tsx`)
**目标**：实现精细化的段落级 AI 排版控制。

1. **UI 注入**：在 `Editor.tsx` 的富文本格式化工具栏（Formatting Toolbar）中，增加两个操作按钮：`➕ AI 扩写` 和 `➖ AI 精简`。
2. **交互逻辑**：
   - 检查 `window.getSelection()`，若未选中文本，则拦截并提示“请先选中需要伸缩的文本”。
   - 显示局部 Loading 状态。
   - 调用 `aiService.scaleText`。
   - **DOM 替换**：获取结果后，使用 `document.execCommand('insertText', false, aiResult)` 或安全的 Range 替换，无缝覆盖用户原选区。
   - 同步 `setFormData` 更新 React 状态。

### 🚧 Phase 4: 构建静态知识图谱页 (Reader/Export 适配)
**目标**：将提取的标签云数据转化为炫酷的静态可视化页面。

1. **数据生成**：在“导出”动作触发前，或者提供一个手动按钮，调用 `extractGlobalKnowledgeGraph` 生成整本期刊的技术拓扑图 JSON。
2. **静态渲染 (`PaperView.tsx` 或独立的图谱组件)**：
   - 利用原生的 CSS Flex/Grid 布局，或者极简的 D3/原生 Canvas，将 JSON 数据渲染为“知识星空”或“概念拓扑网”。
   - 确保其挂载在类似“封底前一页”或者侧边栏，作为本期期刊的“技术全景图”。

---

## 3. 开发规范与代码标准 (Coding Standards)
- **防御性编程**：在处理 DOM 选区替换时，务必考虑光标丢失问题，必须使用 `saveSelection` 和 `restoreSelection`。
- **状态同步**：所有针对 `contentRef.current.innerHTML` 的原生 DOM 操作，完成后必须同步回 React 的 `formData.content` 中。
- **样式隔离**：新增的 UI 按钮必须复用现有的 Tailwind 类名规范（如 `bg-brand-blue`，`hover:bg-blue-50` 等），保持视觉高度统一。