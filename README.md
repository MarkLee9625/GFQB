<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SWS 工法情报系统 (Ship Construction Method Information System)

这是一个基于 **React + TypeScript** 的工法情报编辑和管理系统，专为船舶工程与智能制造领域设计。系统支持极其精细的富文本编辑、PDF 开箱即用、智能 AI 辅助、微信文章抓取以及杂志级排版导出。

---

## 🚀 快速开始 (Quick Start)

**前提条件:** 安装 [Node.js](https://nodejs.org/)

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置环境**:
   在根目录创建 `.env.local` 文件，并设置您的 Gemini API 密钥（注意：这是后端代理专用密钥）:
   ```env
   GEMINI_API_KEY=您的_GEMINI_API_KEY
   ```

   **重要安全说明**:
   - API Key 通过后端 BFF 代理服务器安全转发，前端代码不再包含任何 API Key
   - 确保 `.env.local` 文件不被提交到版本控制系统（已配置在 .gitignore 中）

3. **运行开发服务器**:
   ```bash
   npm run dev
   ```

4. **构建生产版本 (离线阅读器模板生成)**:
   ```bash
   npm run build
   ```

---

## 📂 项目架构与文件结构 (Project Architecture)

### 核心目录树
```
工法情报编辑器/
├── .cursorrules                    # Cursor IDE 项目规则
├── .gitignore                      # Git 忽略文件
├── .trae/                          # AI 开发助手技能规范
│   ├── documents/                  # 项目文档
│   │   └── print-feature-review-and-optimization.md  # 打印功能审查与优化计划
│   └── skills/
│       ├── ai-feature-integration/  # AI 功能集成
│       ├── code-style-check/        # 代码风格检查
│       ├── component-creation/      # 组件创建
│       ├── engineering-persona-prompting/ # 工程人设提示
│       ├── export-template-unification/ # 导出模板统一
│       ├── pdf-service-maintenance/ # PDF 服务维护
│       ├── performance-optimization/ # 性能优化
│       ├── react19-features/       # React 19 特性
│       ├── security-best-practices/ # 安全最佳实践
│       └── tailwind4-utilization/  # Tailwind CSS v4 工具类优化
├── App.tsx                         # 应用主入口（逻辑层）
├── index.html                      # HTML 入口
├── index.tsx                       # React 渲染入口
├── package.json                    # 项目依赖与脚本
├── package-lock.json               # 依赖锁文件
├── README.md                       # 项目说明文档
├── tsconfig.json                   # TypeScript 配置
├── vite.config.ts                  # Vite 构建配置
├── vite-env.d.ts                   # Vite 环境类型
├── vitest.config.ts                # Vitest 测试配置
├── server.js                       # BFF 代理服务器
├── styles/                         # 样式目录
│   └── article-renderer.css        # 文章渲染样式
│
├── components/                     # React 组件
│   ├── Editor.tsx                  # 核心富文本编辑器（重构为使用 ArticleRenderer）
│   ├── PaperView.tsx               # 杂志风渲染引擎
│   ├── Sidebar.tsx                 # 侧边栏导航
│   ├── Toolbar.tsx                 # 编辑器工具栏（已重构为下拉菜单式）
│   ├── Icons.tsx                   # 自定义 SVG 图标系统
│   ├── ErrorBoundary.tsx           # React 错误边界
│   ├── LoadingOverlay.tsx          # 加载遮罩组件
│   ├── NavigationCapsule.tsx       # 导航胶囊组件
│   ├── CategoryManagerModal.tsx    # 分类管理弹窗
│   ├── ExportOptionsModal.tsx      # 导出选项弹窗
│   ├── KeyboardShortcutsHelpModal.tsx  # 快捷键帮助弹窗
│   ├── editor/                     # 编辑器模块
│   │   └── hooks/                  # 编辑器相关 Hooks
│   │       ├── useEditorCommands.ts    # 编辑器命令
│   │       ├── useEditorKeyboard.ts    # 键盘快捷键
│   │       ├── useEditorState.ts       # 编辑器状态
│   │       ├── useFileUpload.ts        # 文件上传
│   │       ├── useImageToolbar.ts      # 图片工具栏
│   │       └── useSelectionManager.ts   # 选择管理
│   └── renderers/                  # 渲染器模块
│       ├── ArticleRenderer.tsx     # 文章渲染器
│       ├── BackRenderer.tsx        # 封底渲染器
│       ├── ContentRenderer.tsx     # 内容渲染器
│       ├── CoverRenderer.tsx       # 封面渲染器
│       ├── SharedComponents.tsx    # 共享组件
│       └── index.ts                # 渲染器导出入口
│
├── hooks/                          # 自定义 React Hooks
│   ├── useJournal.ts               # 文章数据管理（IndexedDB CRUD）
│   ├── useBlobManager.ts           # Blob 内存管理
│   ├── useInView.ts                # 视图内检测
│   ├── useMemoryMonitor.ts         # 内存监控
│   ├── useAiFeatures.ts            # AI 功能集成
│   ├── useAppInitialization.ts     # 应用初始化
│   ├── useArticleNavigation.ts     # 文章导航
│   ├── useExportManager.ts         # 导出管理
│   ├── useImportManager.ts         # 导入管理
│   ├── useKeyboardShortcuts.ts      # 快捷键管理
│   └── usePanZoom.ts               # 缩放平移
│
├── services/                       # 业务服务层
│   ├── aiService.ts                # Gemini + DeepSeek AI 服务（含批量评审接口+学术文献编译引擎）
│   ├── db.ts                       # IndexedDB 封装（V2 原子化存储）
│   └── graphCache.ts               # 图谱缓存服务
│
├── scripts/                        # 构建脚本
│   ├── post-build.js               # 构建后处理（资源内联与注入）
│   └── copy-worker.js              # Worker 复制脚本
│
├── src/                            # 源码目录（Vite 主源）
│   ├── index.css                   # 全局样式（含专业中文期刊排版引擎）
│   ├── constants.ts                # 常量定义
│   ├── pdf-worker.d.ts             # PDF Worker 类型定义
│   │
│   ├── components/                 # 源码组件
│   │   ├── AiCurationModal.tsx     # AI全渠道选题工作台（支持多数据源）
│   │   ├── Layout/
│   │   │   └── MainLayout.tsx      # 主布局组件
│   │   └── renderers/              # 源码渲染器
│   │       └── blocks/             # 区块渲染器
│   │           ├── BlockRenderer.tsx
│   │           └── BlockRenderer.test.tsx
│   │
│   ├── services/                   # 源码服务
│   │   ├── export/                 # 导出模块
│   │   │   ├── index.ts            # 导出服务入口
│   │   │   ├── assets.ts           # 导出资源（样式/图片）
│   │   │   ├── templates.ts        # HTML 模板
│   │   │   ├── pdfComponents.tsx   # PDF渲染组件
│   │   │   ├── pdfEngine.ts        # PDF生成引擎
│   │   │   ├── compression.ts      # 高性能数据压缩解压工具
│   │   │   ├── pdf/                # PDF 导出子模块
│   │   │   │   ├── index.ts        # PDF 导出入口
│   │   │   │   ├── pdfStyles.ts    # PDF 样式
│   │   │   │   ├── PdfDocument.tsx
│   │   │   │   ├── PdfCover.tsx
│   │   │   │   ├── PdfBackCover.tsx
│   │   │   │   ├── PdfTOC.tsx
│   │   │   │   └── PdfArticlePage.tsx
│   │   │   ├── print/              # 打印导出子模块
│   │   │   │   └── printableSkeleton.ts  # 打印骨架模板
│   │   │   └── reader/             # 阅读器导出子模块
│   │   │       ├── readerSkeleton.ts     # 阅读器骨架
│   │   │       ├── readerTemplates.ts    # 阅读器模板
│   │   │       └── clientScript.ts      # 客户端脚本
│   │   │
│   │   ├── pdf/                    # PDF 解析模块
│   │   │   ├── index.ts            # PDF 服务入口
│   │   │   ├── wrapper.ts          # PDF.js 封装
│   │   │   └── strategies/         # 解析策略模式
│   │   │       ├── abstract.ts     # 摘要提取策略
│   │   │       ├── keywords.ts     # 关键词提取策略
│   │   │       └── title.ts        # 标题提取策略
│   │   │
│   │   └── fetchers/               # 多源数据抓取引擎
│   │       ├── rssFetcher.ts       # RSS资讯抓取（支持双引擎代理）
│   │       └── patentFetcher.ts    # 专利文献检索
│   │
│   ├── types/                      # 类型定义
│   │   ├── index.ts                # 类型统一导出
│   │   ├── blocks.ts               # 区块类型定义
│   │   ├── models.ts               # 数据模型类型
│   │   ├── ui.ts                   # UI 组件类型
│   │   └── intelligence.ts         # 全渠道情报统一接口定义
│   │
│   ├── utils/                      # 工具函数
│   │   ├── fileHelpers.ts          # 文件操作辅助
│   │   ├── graphRenderer.ts         # 知识图谱渲染引擎
│   │   ├── pasteCleaner.ts         # HTML 粘贴内容净化工具
│   │   ├── blockParser.ts          # 区块解析工具
│   │   ├── blockParser.test.ts     # 区块解析测试
│   │   ├── encoding.ts             # 编码处理工具
│   │   ├── fileHelpers.test.ts     # 文件操作测试
│   │   └── pasteCleaner.test.ts    # 粘贴净化测试
│   │
│   └── __tests__/                  # 测试目录
│       └── testSetup.ts            # 测试环境配置
│
├── public/                         # 静态资源（Vite 公共目录）
│   ├── pdf.min.mjs                 # PDF.js 主库
│   ├── pdf.worker.min.mjs          # PDF.js Worker
│   ├── cmaps/                      # PDF 字体映射（多文件）
│   ├── standard_fonts/             # PDF 标准字体
│   └── wasm/                       # PDF.js WASM 文件
│
└── dist-reader/                    # 离线阅读器构建输出
    ├── index.html                  # 单文件自包含 HTML
    ├── pdf.min.mjs                 # 内联 PDF.js 库
    ├── pdf.worker.min.mjs          # 内联 PDF.js Worker
    ├── cmaps/                      # PDF 字体映射（*.bcmap 多文件）
    ├── standard_fonts/             # PDF 标准字体
    └── wasm/                       # PDF.js WASM 文件
```

### 关键组件说明
*   **编辑器 (`components/Editor.tsx`)**: 核心富文本编辑器，现已重构为使用独立的 ArticleRenderer、CoverRenderer、BackRenderer、ContentRenderer 组件，实现组件职责分离。
*   **渲染引擎 (`components/PaperView.tsx`)**: 负责"杂志风格"与"经典风格"的实时物理排版模拟，使用模块化的渲染器组件。
*   **工具栏 (`components/Toolbar.tsx`)**: 重构为下拉菜单式，包含"数据接入"和"AI情报中枢"两大功能区。
*   **AI选题工作台 (`src/components/AiCurationModal.tsx`)**: 支持微信/MD导入、RSS资讯、专利文献的多源数据筛选。
*   **状态管理 (`hooks/useJournal.ts`)**: 统一的数据流入口，负责 IndexedDB 的并发读写与文章生命周期管理。
*   **导出管理 (`hooks/useExportManager.ts`)**: 统一的导出流程管理，支持阅读版、打印版、PDF 三种导出模式。
*   **导入管理 (`hooks/useImportManager.ts`)**: 统一的导入流程管理，支持微信文章抓取、Markdown 导入等功能。
*   **构建引擎 (`scripts/post-build.js`)**: **项目灵魂**。在构建后自动内联 JS/CSS，并注入 PDF.js 核心及 Worker，实现"单文件自包含 HTML"导出。

---

## 🏗️ 核心技术机制

### 1. 离线阅读版导出原理
本系统采用"量子纠缠"式的架构，导出的阅读器实际上是编辑器自身的受限功能副本：
*   **一键内联**: 通过 `post-build.js` 将所有外部依赖（包括 10MB+ 的 PDF 渲染引擎）转为 Base64 嵌入单个 HTML。
*   **数据注入**: 用户导出时，文章数据、加密图片均通过 Base64 安全注入到模板的 `window` 对象中。
*   **单页路由**: 阅读版采用极简的单页 Hash 路由切换文章。

### 2. AI 全渠道情报矩阵
**统一数据接口**: `src/types/intelligence.ts` 定义了 `UniversalArticleMeta` 接口，统一了微信、RSS、专利、船级社等多种数据源格式。
*   **RSS双引擎抓取**: `src/services/fetchers/rssFetcher.ts` 支持 rss2json API + AllOrigins 代理双引擎，突破跨域限制。
*   **学术文献编译引擎**: `services/aiService.ts` 新增 `translateAndFormatAcademic` 函数，将英文学术论文编译为中文工法报道。
*   **多源筛选工作台**: AI选题工作台支持多数据源切换，使用统一AI评审流程处理不同来源的情报。

### 3. UI 架构优化
*   **工具栏重构**: 采用下拉菜单设计，将"数据接入"和"AI情报中枢"功能分组，解决按钮臃肿问题。
*   **专业中文排版引擎**: `src/index.css` 中内置强制中文期刊排版规则，实现首行缩进2字符、图片居中、标题无缩进等专业排版效果。
*   **响应式交互**: 优化悬浮效果和过渡动画，提升编辑体验。

### 4. AI 智能开发助手 (Agent Skills)
项目在 `.trae/skills` 下内置了一套 AI 协作规范，确保开发过程中架构的优雅与一致性：
*   `code-style-check`: 强化类型安全与 TailwindCSS 规范。
*   `export-template-unification`: 确保编辑器预览与导出版视觉 100% 同位。
*   `performance-optimization`: 专项处理大型 Base64 图片导致的内存压力（Blob Manager）。

---

## ✨ 核心特性

-   **智能抓取**: 微信文章 V5 极速抓取，自动清洗头部干扰与尾部广告。
-   **全渠道数据接入**: 支持微信/MD、RSS全球资讯、专利文献、船级社动态等多源情报抓取。
-   **AI 辅助**: 基于 Gemini-3-Flash 智能提取技术重点 (Why/How/Benefits) 并一键拟定标题。
-   **学术文献编译**: 将英文学术论文自动翻译并重写为专业中文工法报道。
-   **专业中文排版**: 内置强制中文期刊排版引擎，实现首行缩进、两端对齐等专业效果。
-   **杂志排版**: 封面/封底支持实时切换设计风格，支持高清 PDF 附件预览与自动转图。
-   **极端离线**: 导出的情报包不依赖任何网络，所有图片与播放器内核均为内置。

---

## 📅 更新日志 (Changelog)

### v1.7.0 (2026-04-20) - 编辑器组件重构与渲染引擎模块化
*   **【编辑器重构】Phase 2 完成 - 使用 ArticleRenderer**:
    *   将 Editor 组件重构为使用独立的 ArticleRenderer、CoverRenderer、BackRenderer、ContentRenderer 组件
    *   新增 6 个编辑器相关 hooks：useEditorCommands、useEditorKeyboard、useEditorState、useFileUpload、useImageToolbar、useSelectionManager
    *   实现组件职责分离，提升代码可维护性和复用性
*   **【核心 Hooks 扩展】新增多个业务 Hook**:
    *   `useAiFeatures.ts`: AI 功能集成 hook
    *   `useAppInitialization.ts`: 应用初始化 hook
    *   `useArticleNavigation.ts`: 文章导航 hook
    *   `useExportManager.ts`: 导出管理 hook
    *   `useImportManager.ts`: 导入管理 hook
    *   `useKeyboardShortcuts.ts`: 快捷键管理 hook
    *   `usePanZoom.ts`: 缩放平移 hook
*   **【导出模块重构】模块化拆分**:
    *   将 `src/services/export/` 拆分为 `pdf/`、`print/`、`reader/` 三个子模块
    *   `pdf/`: 包含 PdfDocument、PdfCover、PdfBackCover、PdfTOC、PdfArticlePage 等组件
    *   `print/`: 包含 printableSkeleton 模板
    *   `reader/`: 包含 readerSkeleton、readerTemplates、clientScript
*   **【类型系统增强】新增 blocks 类型**:
    *   新增 `src/types/blocks.ts`，定义区块相关类型
    *   新增 `src/types/index.ts` 统一导出所有类型
    *   新增 `src/utils/blockParser.ts` 区块解析工具
    *   新增 `src/utils/encoding.ts` 编码处理工具
*   **【其他更新】**:
    *   新增 `services/graphCache.ts` 图谱缓存服务
    *   新增 `src/constants.ts` 常量定义
    *   新增 `styles/article-renderer.css` 文章渲染样式
    *   新增 Vitest 测试配置和测试文件

### v1.6.5 (2026-04-15) - 测试框架集成与技能文件重构
*   **【测试框架集成】Vitest 单元测试覆盖**:
    *   新增 `vitest.config.ts` 配置文件，集成 Vitest 测试框架，支持 JS DOM 环境模拟。
    *   新增 `src/__tests__/testSetup.ts` 测试设置文件，提供全局 Mock（Image、FileReader 等）。
    *   新增 `src/utils/fileHelpers.test.ts` 单元测试，全面覆盖文件操作辅助函数的各种场景。
    *   新增 `src/utils/pasteCleaner.test.ts` 单元测试，验证 HTML 粘贴净化功能的正确性。
    *   新增 `npm test`、`npm run test:watch`、`npm run test:coverage` 脚本命令，支持测试运行、监听和覆盖率报告。
*   **【技能文件重构】统一技能管理架构**:
    *   将 AI 开发助手技能文件从 `.agent/skills/` 和 `.cline/skills/` 目录统一迁移到 `.trae/skills/` 目录。
    *   保留全部 10 个专业技能模块：AI 功能集成、代码风格检查、组件创建、工程人设提示、导出模板统一、PDF 服务维护、性能优化、React 19 特性、安全最佳实践、Tailwind CSS v4 工具类优化。
    *   简化项目结构，消除冗余文件，提升 AI 协作规范的集中管理效率。
*   **【样式优化】专业中文排版引擎增强**:
    *   在 `src/index.css` 中新增 125+ 行样式规则，进一步强化中文期刊排版效果。
    *   优化字体渲染、行距控制和段落间距，提升阅读体验。
*   **【代码质量提升】组件与 Hook 优化**:
    *   重构 `App.tsx`、`components/Editor.tsx`、`components/PaperView.tsx` 等核心组件，修复已知问题。
    *   优化 `hooks/useBlobManager.ts`、`hooks/useInView.ts`、`hooks/useJournal.ts` 等自定义 Hook，提升性能和稳定性。
    *   更新 `package.json` 依赖，确保开发工具链的兼容性和安全性。

### v1.6.4 (2026-04-14) - 新增智能缓存系统与性能优化工具
*   **【智能缓存系统】Blob 缓存管理**:
    *   新增 `src/services/export/blobCache.ts` 模块，实现 LRU（最近最少使用）缓存策略，用于管理媒体资源的 Blob URL，避免频繁滚动时的重复解码，最大容量为 5 个条目。
    *   提供全局单例缓存实例，支持自动清理过期 Blob URL，防止内存泄漏。
*   **【压缩工具模块】高性能数据压缩**:
    *   新增 `src/services/export/compression.ts` 模块，提供基于浏览器原生 CompressionStream API 的高性能数据压缩解压能力。
    *   支持自动回退到 fflate 库以兼容旧版浏览器，实现流式解压与进度回调。
*   **【粘贴清理工具】HTML 内容净化**:
    *   新增 `src/utils/pasteCleaner.ts` 模块，专门用于清理从微信等来源粘贴的 HTML 内容。
    *   自动移除无关标签（如 script、style、iframe）、剥离内联样式、净化图片链接，并优化段落结构。
*   **【AI 技能扩展】新增三大专业技能**:
    *   在 `.agent/skills/` 下新增 `react19-features/`、`security-best-practices/`、`tailwind4-utilization/` 三个技能目录，强化 React 19 特性集成、安全最佳实践和 Tailwind CSS v4 工具类优化。
*   **【AI 服务恢复】备份与恢复机制**:
    *   新增 `services_aiService_full_old.ts`、`services_aiService_full_old_utf8.ts`、`services_aiService_recovery.ts` 等备份文件，为 AI 服务提供损坏恢复能力。

### v1.6.3 (2026-03-24) - 修复知识图谱引擎启动卡死问题
*   **【编辑器增强】完善数据回流机制**: 
    *   在 `App.tsx` 中增加对 `GRAPH_REQUEST_DATA` 信号的监听，确保在 iframe 无法直接访问父页面 DOM 时，能通过消息机制成功回传图谱数据。
*   **【渲染引擎优化】自愈探测与容错降级**:
    *   为 `graphRenderer.ts` 的宽高探测逻辑增加 10 秒（40次重试）上限，彻底根除因 `display: none` 或布局延迟导致的无限“引擎启动中”循环。
    *   超时后自动采用 800x600 默认尺寸强行打火，并增加详细的控制台自举日志。
*   **【AI 服务加固】两阶段满血提取架构**:
    *   在 `aiService.ts` 中实现“先提取节点、后挖掘关系”的两步走策略。
    *   完美解决了 `deepseek-reasoner` 因推理过程过长导致的 JSON 截断问题，确保 40 个左右的节点及其完整描述能 100% 成功产出。
    *   引入工业级 Stack 栈式自愈引擎，作为应对极端长文提取时的解析兜底。

### v1.6.2 (2026-03-24) - 彻底恢复双端知识图谱动态交互沙盘原生渲染
*   **【重大重构】放弃所有安全规避小聪明，回归原汁原味的、抗净化的 srcdoc 实体降解法**:
    *   **问题重塑**: V1.5.7 尝试使用的 src="data:..." 协议直接触发了在线编辑器的严重 XSS 净化制裁，导致生成的新图谱在一瞬间被清空甚至白屏。而更早版本引发大范围阅读器报错离线不显示的真正原因，竟然是因为在那段用来解压缩 Base64 的引导脚本里使用了一句极其致命的 document.write (在 ile:// 沙盒下被 Chrome 和 Edge 定性为高危拦截)。
    *   **修复决断**: 彻底放弃 eader.ts 对 iframe 进行物理割除或者 display: none 抹除交互逻辑的错误妥协。在 graphRenderer.ts 中，废除一切 data: 协议或 document.write 解压缩机制。采用返璞归真的全量 HTML Entity 字面实体映射转义 (如将 < 全部解析为 &lt;)，硬灌入 srcdoc！
    *   **效果**: 编辑版的图谱重见天日，拥有完整的拖拽展开交互。离线阅读版不再被阉割为干瘪的死板 SVG，同样拥有着原汁原味与线上一致的动态沙盘。同时完美绕过跨源拦截：报错已被封装进静默捕获，丝毫不会中断图谱 D3.js 世界的繁荣绽放。
### v1.6.1 (2026-03-24) - 修复图谱清洗后因历史 CSS 遗留导致的隐身假死
*   **【导出管线】追加无视环境的绝对权重展现样式**:
    *   **问题重塑**: 在 V1.5.7 我们对编辑器旧缓存里残留的 iframe图谱采取了物理阉割，成功清除了错误，却发现在很多机器上连备用的静态 SVG 图谱也一起不显示了。根本原因在于：当初编辑器压入的旧版 HTML 中，用来隐藏 sws-graph-print (即 SVG) 的 CSS 样式块代码各式各样，导致正则解除隐藏的功能未生效，依然被浏览器渲染引擎屏蔽。
    *   **修复决断**: 抛弃容易漏网的基于字符串搜索的正则样板替换。采取直接覆盖策略：在清洗完 DOM 节点后，直接强制在组件尾部追加一枚自带 !important 无效化声明的 <style>，向浏览器总局重新宣告 .sws-graph-print 具备不可争辩的显高层级展示权。
    *   **效果**: 现在图谱重获实体，无论历史图谱是以什么隐藏形态被缓存在数据库中，都能被霸道破解并强袭渲染！
### v1.6.0 (2026-03-24) - 取消默认图片离线内联以防超大包体积假死
*   **【机制回退】解除全量图片的强制离线 Base64 内联**:
    *   **问题重塑**: V1.5.6 引进的双擎抓取逻辑虽然破解了微信防盗链，但也使得 18 篇等全媒体长文导出时生成的内含全量 Base64 的 JSON 骨架尺寸爆涨至 150MB 级别。这种超大规模的单个 HTML 文档或 Blob 的构建，超出了浏览器在前端沙盒中运行的最大内存和正则检索上限，最终导致导出操作执行到 "Using dynamic skeleton template for export" 步骤时发生死寂崩溃 (Crash)。
    *   **修复决断**: 听取用户实际建议，在 services/export/reader.ts 中果断移除了默认将所有在线图片转化为 Base64 内置进 HTML 源码的沉重流程。
    *   **效果**: 现在系统瞬间卸下了数百 MB 的内存重压，恢复了秒级甚至毫秒级的导出响应速度。知识图谱的外科手术式清洗与纯净的 SVG 结构降级逻辑予以全量保留。离线版图片的呈现不再强制化为源码，而需由原有的超链接向线上服务器申请展现。
### v1.5.9 (2026-03-24) - 修复图片处理死锁导致导出按钮失效的问题
*   **【机制重构】重塑离线下载器的 Promise 生命周期控制**:
    *   **问题重塑**: V1.5.6 中引入的双擎图片拉取逻辑，在处理极端防盗链或断网情况时，内部的 Fetch 抛错没有正确被外部基于 FileReader 的新 Promise 捕获，导致异步流陷入永久 Pending 死锁。表现为用户点击导出按钮后无任何反应。
    *   **修复决断**: 彻底重构了 etchImageAsBase64 函数的闭包。由外围一层坚如磐石的 
ew Promise() 统一接管包括 AbortController 倒计时、Fetch Blob 请求流、代理回退以及文件流读取的整条流水线的所有成功与失败的出口。
    *   **效果**: 现在即使遭遇最恶劣的网络图源环境（完全无权访问或断网），导出流也能在 8 秒后精准抛出超时并静默保留原标签，不会阻断整篇文章的离线文件的生成。
### v1.5.8 (2026-03-24) - 修复封面封底滚轮缩放事件报错
*   **【BugFix】解决 Unable to preventDefault inside passive event**:
    *   **问题重塑**: 用户发现在阅读封面大图并尝试用鼠标滚轮缩放图片时，控制台抛出 Passive Event 相关报错。原因是 React 对于 onWheel 绑定默认附加了 { passive: true }，阻止了内部阻止默认滚动行为的意图。
    *   **修复**: 将原本写在 JSX 中的 onWheel 回调重构，改为通过 useRef + useEffect 直接利用浏览器底层 API 挂载非被动的滚轮事件 (ddEventListener('wheel', ..., { passive: false }))。
    *   **效果**: 现在在全屏预览缩放封面图片时，滚轮交互极其丝滑且完美阻止了页面跟着上下抖动，且控制台彻底清爽不再飘红。
### v1.5.7 (2026-03-24) - 清理陈旧文章缓存导致知识图谱离线渲染空白的问题
*   **【导出管线】图谱快照物理阉割及静态重组**:
    *   **问题重塑**: 发现即使将组件 graphRenderer 更新到了完美防御的安全版本，用户在导出文章时发现图谱依然白屏报错。排查发现，原因是 React 的编辑器会在"生成图谱"时直接把带有旧版 iframe 甚至交互错误提示的组件 HTML 作为一个黑盒代码块固化到了 rticle.content 数据流中，并在导出时原封不动地下达给阅读器
    *   **修复决断**: 在 services/export/reader.ts 导出 HTML 的序列化前置环节加入正则拦截。动态寻找编辑器数据流中残留的所有带 iframe / sws-graph-screen 标志的遗迹，以粗放霸道的方式进行"数字消杀"，并强制重置其隐藏属性
    *   **效果**: 无论数据库当初保存的是怎样古老崩坏的含有动态JS沙盘的图谱版本，导出瞬间也只会被无差别降维打击成纯天然极速静态矢量 SVG，永绝后台空屏后患！
### v1.5.6 (2026-03-24) - 修复微信等防盗链图片导出离线版失败问题
*   **【机制重构】引入双擎拉取策略对抗 CORS 跨域与防盗链**:
    *   **问题重塑**: 原有的阅读版 HTML 导出过程在尝试把文章中的外部图片转换为 Base64 时，使用了基础的 
ew Image() 和 Canvas。面对如微信公众号 (mmbiz 服务器) 这样配置了严厉 CORS 跨源策略和防盗链校验的图片资源，会被浏览器底层直接中断抛错，导致该类图表无法被离线化
    *   **架构升级**: 重构底层图像采集引擎为 Fetch Blob 流抓取。一档引擎启用 
o-referrer 剥离身份标识试图直通；若遭遇硬核 CORS 拦截，二档引擎会自动介入，引流至公共 CORS 代理服务器 (corsproxy.io) 中转数据流
    *   **效果**: 高度自治的容错能力。现在即便是最高级别设防的外链图片素材，在导出生成离线 SWS_Reader.html 版时，依然能被顺利捕获并化作 Base64 内联进单体文件，全站图片零遗落点亮离线环境！
### v1.5.5 (2026-03-24) - 利用CSS重写图谱智能降级体系
*   **【稳定器】剥离失效的侦测JS，改用纯全局CSS控制离线组件降级**:
    *   **问题重塑**: 之前的降级方案企图在 React dangerouslySetInnerHTML 中利用内置的 <script> 阻断报错发生，但由于现代 DOM 安全机制，这内联脚本往往会被清洗忽略
    *   **修复决断**: 彻底切除图谱代码中试图操作 DOM 的废弃 JS（防止二次报错）。在生成单一离线文件的源头引擎中（	emplates.ts）直接给顶级标签赋能类名印记 is-offline-reader，辅以强化的 CSS选择器 (.is-offline-reader .sws-graph-print { display: block !important; })
    *   **效果**: 百分之百纯物理防御网——离线环境强制接管渲染降级为SVG，且完全跳脱了易受阻滞的JS解析器，一劳永逸！
### v1.5.4 (2026-03-24) - 彻底重构阅读版知识图谱渲染架构
*   **【架构级重构】彻底根除离线阅读版 ile:// 安全报错**:
    *   **问题重塑**: 尽管此前引入了 data URI 和 sandbox 制约，但在某些高安全性浏览器中，ile:// 环境下只要 DOM 树中存在带有复杂 JS 的 iframe，仍不可避免地会触发严格的安全审查及跨域报错，导致阅读体验不佳
    *   **重构方案**: 引入 **"环境感知智能降级容器"**。图谱渲染器 (graphRenderer.ts) 现在会在客户端执行微型探针脚本。若检测到当前处于离线阅读版环境（ile: 协议或包含阅读器宏变量），则会**在渲染前强制铲除 DOM 中的 iframe 节点**，并将组件无缝降级为**纯静态、无JS的矢量SVG形态**
    *   **效果**: 从物理层面实现了 100% 的安全合规，不仅彻底清零了控制台的 Unsafe attempt to load URL 报错，同时保证了阅读版能在任何极其受限的代码沙箱中展示高清图谱（舍弃了仅在有服务器时可用的动态交互检索功能，以换取极高的稳定性和兼容性）
### v1.5.3 (2026-03-24) - 修复阅读版知识图谱离线交互崩溃
*   **【BugFix】离线双击/通讯报错修复**:
    *   **根因**: 在无服务器（ile:// 协议）离线环境下，浏览器强制执行跨源策略限制，导致知识图谱内点击溯源按钮时 window.parent.postMessage 引发致命崩溃 Unsafe attempt to load URL，进而中断整个 JavaScript 生命周期
    *   **修复**: 对跨帧通信接口采用安全沙箱 	ry...catch 进行异常拦截，确保即便在无法通信的极严浏览器沙盒中，节点双击下钻、知识图谱物理引擎等核心功能仍可正常运行
    *   **安全增强**: 为阅读版嵌入的 <iframe> 补充了 sandbox="allow-scripts allow-same-origin allow-popups" 权限约束
### v1.5.2 (2026-03-24) - 修复阅读版知识图谱无法显示
*   **【BugFix】知识图谱 `file://` 协议兼容性修复**: 修复了导出的阅读版（`.html` 文件）中知识图谱完全空白的 Bug
    *   **根因**: `src/utils/graphRenderer.ts` 原使用 `srcdoc + document.write` 的 Bootstrap 方式加载 iframe 内容。在 `file://` 协议下，此方式被浏览器安全机制阻断，同时触发 `Unsafe attempt to load URL` 安全错误
    *   **修复方案**: 改用 `src="data:text/html;base64,..."` 直接内联方式替代 bootstrap 中间层，彻底规避 `file://` 安全限制
    *   **影响范围**: `src/utils/graphRenderer.ts` 第 791-795 行及第 881 行；编辑版（`http://`）不受影响

### v1.6.2 (2026-03-24) - 彻底恢复双端知识图谱动态交互沙盘原生渲染
*   **【重大重构】放弃所有安全规避小聪明，回归原汁原味的、抗净化的 srcdoc 实体降解法**:
    *   **问题重塑**: V1.5.7 尝试使用的 src="data:..." 协议直接触发了在线编辑器的严重 XSS 净化制裁，导致生成的新图谱在一瞬间被清空甚至白屏。而更早版本引发大范围阅读器报错离线不显示的真正原因，竟然是因为在那段用来解压缩 Base64 的引导脚本里使用了一句极其致命的 document.write (在 ile:// 沙盒下被 Chrome 和 Edge 定性为高危拦截)。
    *   **修复决断**: 彻底放弃 eader.ts 对 iframe 进行物理割除或者 display: none 抹除交互逻辑的错误妥协。在 graphRenderer.ts 中，废除一切 data: 协议或 document.write 解压缩机制。采用返璞归真的全量 HTML Entity 字面实体映射转义 (如将 < 全部解析为 &lt;)，硬灌入 srcdoc！
    *   **效果**: 编辑版的图谱重见天日，拥有完整的拖拽展开交互。离线阅读版不再被阉割为干瘪的死板 SVG，同样拥有着原汁原味与线上一致的动态沙盘。同时完美绕过跨源拦截：报错已被封装进静默捕获，丝毫不会中断图谱 D3.js 世界的繁荣绽放。
### v1.6.1 (2026-03-24) - 修复图谱清洗后因历史 CSS 遗留导致的隐身假死
*   **【导出管线】追加无视环境的绝对权重展现样式**:
    *   **问题重塑**: 在 V1.5.7 我们对编辑器旧缓存里残留的 iframe图谱采取了物理阉割，成功清除了错误，却发现在很多机器上连备用的静态 SVG 图谱也一起不显示了。根本原因在于：当初编辑器压入的旧版 HTML 中，用来隐藏 sws-graph-print (即 SVG) 的 CSS 样式块代码各式各样，导致正则解除隐藏的功能未生效，依然被浏览器渲染引擎屏蔽。
    *   **修复决断**: 抛弃容易漏网的基于字符串搜索的正则样板替换。采取直接覆盖策略：在清洗完 DOM 节点后，直接强制在组件尾部追加一枚自带 !important 无效化声明的 <style>，向浏览器总局重新宣告 .sws-graph-print 具备不可争辩的显高层级展示权。
    *   **效果**: 现在图谱重获实体，无论历史图谱是以什么隐藏形态被缓存在数据库中，都能被霸道破解并强袭渲染！
### v1.6.0 (2026-03-24) - 取消默认图片离线内联以防超大包体积假死
*   **【机制回退】解除全量图片的强制离线 Base64 内联**:
    *   **问题重塑**: V1.5.6 引进的双擎抓取逻辑虽然破解了微信防盗链，但也使得 18 篇等全媒体长文导出时生成的内含全量 Base64 的 JSON 骨架尺寸爆涨至 150MB 级别。这种超大规模的单个 HTML 文档或 Blob 的构建，超出了浏览器在前端沙盒中运行的最大内存和正则检索上限，最终导致导出操作执行到 "Using dynamic skeleton template for export" 步骤时发生死寂崩溃 (Crash)。
    *   **修复决断**: 听取用户实际建议，在 services/export/reader.ts 中果断移除了默认将所有在线图片转化为 Base64 内置进 HTML 源码的沉重流程。
    *   **效果**: 现在系统瞬间卸下了数百 MB 的内存重压，恢复了秒级甚至毫秒级的导出响应速度。知识图谱的外科手术式清洗与纯净的 SVG 结构降级逻辑予以全量保留。离线版图片的呈现不再强制化为源码，而需由原有的超链接向线上服务器申请展现。
### v1.5.9 (2026-03-24) - 修复图片处理死锁导致导出按钮失效的问题
*   **【机制重构】重塑离线下载器的 Promise 生命周期控制**:
    *   **问题重塑**: V1.5.6 中引入的双擎图片拉取逻辑，在处理极端防盗链或断网情况时，内部的 Fetch 抛错没有正确被外部基于 FileReader 的新 Promise 捕获，导致异步流陷入永久 Pending 死锁。表现为用户点击导出按钮后无任何反应。
    *   **修复决断**: 彻底重构了 etchImageAsBase64 函数的闭包。由外围一层坚如磐石的 
ew Promise() 统一接管包括 AbortController 倒计时、Fetch Blob 请求流、代理回退以及文件流读取的整条流水线的所有成功与失败的出口。
    *   **效果**: 现在即使遭遇最恶劣的网络图源环境（完全无权访问或断网），导出流也能在 8 秒后精准抛出超时并静默保留原标签，不会阻断整篇文章的离线文件的生成。
### v1.5.8 (2026-03-24) - 修复封面封底滚轮缩放事件报错
*   **【BugFix】解决 Unable to preventDefault inside passive event**:
    *   **问题重塑**: 用户发现在阅读封面大图并尝试用鼠标滚轮缩放图片时，控制台抛出 Passive Event 相关报错。原因是 React 对于 onWheel 绑定默认附加了 { passive: true }，阻止了内部阻止默认滚动行为的意图。
    *   **修复**: 将原本写在 JSX 中的 onWheel 回调重构，改为通过 useRef + useEffect 直接利用浏览器底层 API 挂载非被动的滚轮事件 (ddEventListener('wheel', ..., { passive: false }))。
    *   **效果**: 现在在全屏预览缩放封面图片时，滚轮交互极其丝滑且完美阻止了页面跟着上下抖动，且控制台彻底清爽不再飘红。
### v1.5.7 (2026-03-24) - 清理陈旧文章缓存导致知识图谱离线渲染空白的问题
*   **【导出管线】图谱快照物理阉割及静态重组**:
    *   **问题重塑**: 发现即使将组件 graphRenderer 更新到了完美防御的安全版本，用户在导出文章时发现图谱依然白屏报错。排查发现，原因是 React 的编辑器会在"生成图谱"时直接把带有旧版 iframe 甚至交互错误提示的组件 HTML 作为一个黑盒代码块固化到了 rticle.content 数据流中，并在导出时原封不动地下达给阅读器
    *   **修复决断**: 在 services/export/reader.ts 导出 HTML 的序列化前置环节加入正则拦截。动态寻找编辑器数据流中残留的所有带 iframe / sws-graph-screen 标志的遗迹，以粗放霸道的方式进行"数字消杀"，并强制重置其隐藏属性
    *   **效果**: 无论数据库当初保存的是怎样古老崩坏的含有动态JS沙盘的图谱版本，导出瞬间也只会被无差别降维打击成纯天然极速静态矢量 SVG，永绝后台空屏后患！
### v1.5.6 (2026-03-24) - 修复微信等防盗链图片导出离线版失败问题
*   **【机制重构】引入双擎拉取策略对抗 CORS 跨域与防盗链**:
    *   **问题重塑**: 原有的阅读版 HTML 导出过程在尝试把文章中的外部图片转换为 Base64 时，使用了基础的 
ew Image() 和 Canvas。面对如微信公众号 (mmbiz 服务器) 这样配置了严厉 CORS 跨源策略和防盗链校验的图片资源，会被浏览器底层直接中断抛错，导致该类图表无法被离线化
    *   **架构升级**: 重构底层图像采集引擎为 Fetch Blob 流抓取。一档引擎启用 
o-referrer 剥离身份标识试图直通；若遭遇硬核 CORS 拦截，二档引擎会自动介入，引流至公共 CORS 代理服务器 (corsproxy.io) 中转数据流
    *   **效果**: 高度自治的容错能力。现在即便是最高级别设防的外链图片素材，在导出生成离线 SWS_Reader.html 版时，依然能被顺利捕获并化作 Base64 内联进单体文件，全站图片零遗落点亮离线环境！
### v1.5.5 (2026-03-24) - 利用CSS重写图谱智能降级体系
*   **【稳定器】剥离失效的侦测JS，改用纯全局CSS控制离线组件降级**:
    *   **问题重塑**: 之前的降级方案企图在 React dangerouslySetInnerHTML 中利用内置的 <script> 阻断报错发生，但由于现代 DOM 安全机制，这内联脚本往往会被清洗忽略
    *   **修复决断**: 彻底切除图谱代码中试图操作 DOM 的废弃 JS（防止二次报错）。在生成单一离线文件的源头引擎中（	emplates.ts）直接给顶级标签赋能类名印记 is-offline-reader，辅以强化的 CSS选择器 (.is-offline-reader .sws-graph-print { display: block !important; })
    *   **效果**: 百分之百纯物理防御网——离线环境强制接管渲染降级为SVG，且完全跳脱了易受阻滞的JS解析器，一劳永逸！
### v1.5.4 (2026-03-24) - 彻底重构阅读版知识图谱渲染架构
*   **【架构级重构】彻底根除离线阅读版 ile:// 安全报错**:
    *   **问题重塑**: 尽管此前引入了 data URI 和 sandbox 制约，但在某些高安全性浏览器中，ile:// 环境下只要 DOM 树中存在带有复杂 JS 的 iframe，仍不可避免地会触发严格的安全审查及跨域报错，导致阅读体验不佳
    *   **重构方案**: 引入 **"环境感知智能降级容器"**。图谱渲染器 (graphRenderer.ts) 现在会在客户端执行微型探针脚本。若检测到当前处于离线阅读版环境（ile: 协议或包含阅读器宏变量），则会**在渲染前强制铲除 DOM 中的 iframe 节点**，并将组件无缝降级为**纯静态、无JS的矢量SVG形态**
    *   **效果**: 从物理层面实现了 100% 的安全合规，不仅彻底清零了控制台的 Unsafe attempt to load URL 报错，同时保证了阅读版能在任何极其受限的代码沙箱中展示高清图谱（舍弃了仅在有服务器时可用的动态交互检索功能，以换取极高的稳定性和兼容性）
### v1.5.3 (2026-03-24) - 修复阅读版知识图谱离线交互崩溃
*   **【BugFix】离线双击/通讯报错修复**:
    *   **根因**: 在无服务器（ile:// 协议）离线环境下，浏览器强制执行跨源策略限制，导致知识图谱内点击溯源按钮时 window.parent.postMessage 引发致命崩溃 Unsafe attempt to load URL，进而中断整个 JavaScript 生命周期
    *   **修复**: 对跨帧通信接口采用安全沙箱 	ry...catch 进行异常拦截，确保即便在无法通信的极严浏览器沙盒中，节点双击下钻、知识图谱物理引擎等核心功能仍可正常运行
    *   **安全增强**: 为阅读版嵌入的 <iframe> 补充了 sandbox="allow-scripts allow-same-origin allow-popups" 权限约束
### v1.5.2 (2026-03-24) - 修复阅读版兼容性
*   **【BugFix 1】知识图谱 `file://` 协议兼容性修复**: 修复了导出的阅读版中知识图谱完全空白的 Bug
    *   **根因**: `src/utils/graphRenderer.ts` 原使用 `srcdoc + document.write` Bootstrap 方式，在 `file://` 协议下被安全机制阻断
    *   **修复**: 改用 `src="data:text/html;base64,..."` 直接内联，兼容 `file://` 与 `http://` 两种协议
*   **【BugFix 2】阅读版在线图片离线可用**: 修复了无网络环境下在线链接图片无法显示的问题
    *   **根因**: `src/services/export/reader.ts` 原直接序列化文章内容，未对在线图片 URL 做处理
    *   **修复**: 在 `src/services/export/utils/media.ts` 新增 `inlineOnlineImages` 函数，导出前批量将所有 `http(s)://` 图片转为 Base64；单图 5 秒超时，失败则静默保留原链接
### v1.5.1 (2026-03-23) - 知识图谱增强与UI架构优化
*   **【知识图谱增强】双向通信架构**: 实现知识图谱与编辑器之间的深度集成
    *   **iframe消息监听**: 在`App.tsx`中新增知识图谱iframe消息监听机制，接收`GRAPH_SEARCH_KEYWORD`信号
    *   **原生查找能力**: 集成浏览器原生Ctrl+F级别查找功能，支持知识图谱节点的全文溯源检索
    *   **双向通信协议**: 建立稳定的iframe跨文档通信协议，实现知识图谱到编辑器的关键词联动
*   **【UI架构优化】工具栏专业重构**:
    *   **工具栏视觉升级**: 完全重构`components/Toolbar.tsx`，采用更专业的图标系统与分组布局
    *   **功能分组优化**: 将工具栏分为6大功能组：核心操作、数据接入、AI情报中枢、视图操作、高级功能、导出与发布
    *   **图标系统集成**: 全面集成自定义SVG图标系统，替代原有的emoji和文本按钮，提升专业度
    *   **悬停效果优化**: 增强下拉菜单的悬停效果与过渡动画，提升用户体验
*   **【知识图谱渲染引擎】性能与功能升级**:
    *   **渲染引擎优化**: 大幅重构`src/utils/graphRenderer.ts`，提升知识图谱渲染性能与稳定性
    *   **节点防重叠算法**: 优化物理引擎布局算法，解决节点重叠问题，提升可视化效果
    *   **交互体验增强**: 强化知识图谱节点的交互反馈，提升技术概念检索效率

### v1.5.0 (2026-03-22) - 全渠道工法情报矩阵上线
*   **【全渠道情报矩阵】多源数据接入引擎**: 实现覆盖微信、RSS、专利、船级社的多维度情报矩阵
    *   **统一数据接口**: 新增 `src/types/intelligence.ts` 定义 `UniversalArticleMeta` 接口，统一所有数据源格式
    *   **RSS双引擎抓取**: 实现 `src/services/fetchers/rssFetcher.ts` 支持 rss2json API + AllOrigins 代理双引擎，突破海外媒体跨域限制
    *   **学术文献编译**: 在 `services/aiService.ts` 中新增 `translateAndFormatAcademic` 函数，将英文学术论文智能编译为中文工法报道
    *   **专利检索支持**: 预留专利API接口框架，支持船舶制造相关专利文献检索
*   **【UI架构优化】工具栏重构与专业排版**:
    *   **工具栏下拉菜单**: 重构 `components/Toolbar.tsx`，将功能按钮分组为"数据接入"和"AI情报中枢"两大下拉菜单
    *   **专业中文排版引擎**: 在 `src/index.css` 中新增强制中文期刊排版规则，实现首行缩进2字符、图片居中、标题无缩进
    *   **AI选题工作台升级**: `src/components/AiCurationModal.tsx` 支持多数据源切换（微信/MD、RSS资讯、专利文献）
*   **【规划文档完善】**:
    *   新增《全渠道工法情报矩阵 (Omni-Channel Intelligence Matrix) 开发规划.md》详细技术方案
    *   更新《AI季度智能选题库 (AI Curation Dashboard) 开发规划.md》为v2.0版本

### v1.4.0 (2026-03-22) - AI季度智能选题库上线
*   **【AI选题总编室】赛博总编引擎**: 正式上线AI季度智能选题库（AI Curation Dashboard），实现"AI辅助筛选 + 总编绝对控制"的黄金法则
    *   **批量Markdown解析**: 支持Shift多选批量导入微信公众号历史文章的Markdown文件，极速解析文章元数据与内容摘要
    *   **AI赛博总编评审**: 集成DeepSeek-Reasoner模型，批量评审文章是否符合《工法情报》硬核技术定位，提供"推荐/淘汰"决策及专业理由
    *   **双栏沙盘工作台**: 实现沉浸式总编工作台界面，左侧淘汰区展示被AI淘汰的非技术文章，右侧推荐区展示符合收录标准的优质技术文章
    *   **总编特权干预**: 支持"强行捞回"淘汰文章至推荐区，实现Human-in-the-loop的最终决策权
    *   **智能标签提取**: AI自动提取每篇文章2-3个核心技术关键词标签，便于分类与检索
*   **【核心算法】AI漏斗引擎升级**: 
    *   **批量评审接口**: 在`services/aiService.ts`中新增`batchEvaluateArticles`方法，支持批量文章AI评审
    *   **工业级JSON解析**: 实现"JSON洗衣机"防御逻辑，对抗大模型输出的格式幻觉，确保系统稳定性
    *   **分批次处理**: 采用5篇/批的批量处理策略，平衡API调用效率与防频控
*   **【用户体验】专业级交互设计**:
    *   **工具栏集成**: 主工具栏新增"🤖 智能选题"渐变按钮，一键开启AI选题总编室
    *   **实时进度反馈**: 实现AI阅卷进度实时显示，用户可清晰了解处理状态
    *   **柔性采纳机制**: 支持多次重复采纳同一文章，避免误操作导致的流程中断
    *   **外部链接直采**: 提供手动粘贴外部文章链接的"强制采纳"功能，绕过AI直接抓取天降神文
*   **【架构优化】模块化设计**:
    *   **独立组件**: `src/components/AiCurationModal.tsx`实现完整选题工作台逻辑
    *   **类型安全**: 定义完整的`WechatArticleMeta`和`AiEvaluationResult`类型体系
    *   **状态管理**: 集成到主应用状态流，支持文章内容一键注入当前期刊编辑流

### v1.3.0 (2026-03-21) - AI期刊引擎升级
*   **【AI期刊引擎】智能升级**: 基于DeepSeek-Reasoner模型的AI期刊引擎全面升级
    *   **卷首语生成器**: 新增AI卷首语生成功能，基于本期所有文章自动撰写500字宏观导读，扮演资深工程期刊主编视角
    *   **智能字数伸缩器**: 实现段落级AI扩写（增加30%）与精简（减少30%）功能，精准控制技术文档篇幅
    *   **全局知识图谱提取**: 从多篇文章中自动提取核心技术概念及其关联性，构建可视化知识图谱
    *   **AI大脑引擎扩建**: 在`services/aiService.ts`中新增三大业务能力的Prompt模板与API接口，强化编译期AI处理
*   **【UI集成】一键智能功能**: 在工具栏和编辑器中集成AI智能功能入口
    *   **工具栏新增**: "✨ 生成本期导读"和"🕸 提取知识图谱"按钮，实现一键生成卷首语和知识图谱
    *   **编辑器新增**: "➕ AI扩写"和"➖ AI精简"按钮，支持选中文本的智能伸缩编辑
    *   **交互体验**: 完整的加载状态提示、错误处理和用户反馈机制
*   **【知识图谱可视化】双模渲染引擎**: 实现静态SVG与动态Canvas双引擎渲染
    *   **静态SVG引擎**: 专为打印优化的知识图谱渲染，确保PDF导出质量
    *   **动态Canvas引擎**: 专为屏幕浏览的交互式沙盘，支持拖拽、悬停提示、全屏沉浸体验
    *   **物理引擎优化**: 打破黑洞效应，实现节点防重叠、引力斥力平衡的稳定布局
*   **【架构优化】编译期AI处理**: 遵循内网使用环境约束
    *   **状态固化**: AI生成内容直接落库保存，导出阅读版时作为纯静态HTML/JSON下发
    *   **零网络依赖**: 确保内网读者100%离线使用，所有可视化内容均为静态资源
    *   **轻量化渲染**: 知识图谱使用纯CSS/DOM和轻量级Canvas渲染，无重型外部依赖

### v1.2.7 (2026-03-21) - 打印排版架构优化与封面/封底UI增强
*   **【打印架构】打印样式系统深度重构**: 彻底解决打印版面的浏览器兼容性问题
    *   **Chrome幻影排版修复**: 重构打印CSS架构，通过"架构级降维打击"彻底解决Chrome浏览器的幻影排版（Phantom Pagination）问题
    *   **元素可见性强制**: 对所有排版元素（`.sws-prose > *`, `.article-body > *`）强制设置`visibility: visible`和`opacity: 1`，确保打印时不会隐式隐藏
    *   **显示模式统一**: 将打印模式下的所有元素强制设置为`display: block`，内联元素设为`display: inline`，解决Flexbox/Grid约束导致的排版截断
    *   **宽幅重置系统**: 彻底打破网页端65ch与max-width定宽约束，消除打印版两侧的巨大白边，实现专业期刊级全幅排版
*   **【封面/封底UI】视觉体验优化**: 提升封面与封底图片的显示效果与交互体验
    *   **图片容器自适应**: 修改封面/封底图片容器为自适应高度（`h-auto`），移除固定高度限制，支持更灵活的图片比例
    *   **响应式交互**: 为经典风格封底添加`group`类，实现更流畅的hover状态与缩放动画
    *   **上传按钮定位**: 修复经典风格封底上传按钮的绝对定位，确保居中显示
    *   **图片阴影优化**: 统一两种设计风格的图片阴影与hover效果，提升视觉一致性
*   **【样式架构】CSS职责分离**: 重构打印样式系统的职责边界
    *   **CSS注入迁移**: 将硬编码的`GLOBAL_PRINT_CSS`从`print.ts`中移除，统一由模板引擎（`templates.ts`）管理
    *   **打印CSS分层**: 将打印样式分为页面重置、元素保护、容器规范三个层级，确保样式的可维护性
    *   **PDF组件字体强化**: 在PDF导出组件中为所有HTML元素显式设置中文字体，确保PDF文档中的中文排版一致性

### v1.2.6 (2026-03-18) - PDF专业导出与打印系统深度重构
*   **【PDF导出系统】React-PDF集成与附件智能合并**: 实现专业级PDF文档生成与导出能力
    *   **React-PDF渲染引擎**: 集成`@react-pdf/renderer`实现高质量PDF文档生成，支持杂志风格与经典风格双设计
    *   **PDF附件智能合并**: 使用`pdf-lib`库将文章内嵌的PDF附件自动合并到主文档中，实现完整技术文档打包
    *   **中文字体完美支持**: 集成NotoSansSC中文字体，确保中文内容在PDF中的清晰显示与排版
    *   **多组件架构**: 实现封面、目录、文章页、封底的模块化组件系统，支持高度定制化
    *   **批量导出功能**: 支持多篇文章一次性导出为完整PDF文档，自动按封面、正文、封底顺序排版
*   **【打印系统】深度重构与排版加固**:
    *   **排版崩坏修复**: 彻底解决A4纸张打印时的排版错乱问题，确保页眉页脚和分页符正确显示
    *   **双重分页冲突解决**: 修复打印预览与打印输出之间的分页不一致问题，实现所见即所得的打印效果
    *   **打印优化选项**: 新增`optimizeForPrint`选项，自动调整图片分辨率、字体大小和边距以适配打印需求
*   **【构建系统】性能优化**:
    *   **构建内存优化**: 将Node.js内存限制提升至4GB（`--max-old-space-size=4096`），避免大型PDF处理时的内存溢出
    *   **构建脚本同步**: 完善Worker脚本同步机制，确保PDF.js相关文件正确复制到构建目录

### v1.2.5 (2026-03-17) - DeepSeek Reasoning 适配与Prompt工程化重构
*   **【AI服务架构】DeepSeek Reasoning 模型深度适配**: 针对DeepSeek-Reasoner模型的架构特性进行专业优化
    *   **128K上下文算力释放**: 大幅放宽字符截断限制，`generateArticleMeta`从10K提升至100K字符，`generateTitleOnly`从5K提升至50K字符
    *   **System-User双轨制协议**: 重构单体Prompt为严格适配Reasoning模型的"System-User"双轨制结构
    *   **Prompt工程化重构**: 剥离指令层与数据层，实现专业船舶工程"技术主编"人设的精细调优
    *   **防御逻辑完整保留**: 完整继承BFF代理架构、安全头部验证和推理标签清洗函数，确保高可用性
*   **【Prompt工程】船舶工程专业人设优化**:
    *   `generateArticleMeta`: 实现标题、摘要、标签的三维专业规范，拒绝学术化和虚词，强调工程实战感
    *   `generateTitleOnly`: 提供简练、专业、无标点的纯文本标题生成，符合工程文档要求
    *   **输出格式标准化**: 严格执行JSON输出规范，确保与现有解析系统的无缝兼容

### v1.2.4 (2026-03-16) - 安全架构升级与BFF代理模式
*   **【安全架构】BFF代理模式**: 实施后端即前端（BFF）代理架构，彻底消除前端API Key硬编码的安全风险
    *   **前端去敏感化**: 移除所有前端代码中的API Key硬编码，AI请求通过本地代理服务器转发
    *   **代理服务器**: 新增 `server.js` 作为BFF代理，负责安全转发Gemini API请求
    *   **暗号鉴权**: 实现自定义请求头部验证机制，防止外部直接调用代理接口盗刷额度
    *   **环境变量安全**: 完善`.gitignore`确保`.env.local`文件被正确忽略，防止敏感配置泄露
*   **【AI服务层】安全重构**:
    *   `services/aiService.ts`: 重构为通过BFF代理调用Gemini API，添加安全请求头部验证
    *   **快速失败机制**: 代理服务器启动时验证环境变量，缺少API Key立即终止服务
    *   **请求限制**: 限制请求体大小为1MB，防止恶意发送超大文本耗尽内存
*   **【配置管理】环境变量优化**:
    *   **安全警告强化**: `.env.example` 添加详细的安全说明，防止误操作
    *   **生产模式**: 支持生产环境下静态资源托管和API路由统一管理

### v1.2.3 (2026-03-16) - AI开发助手集成与性能优化
*   **【AI开发助手】智能协作规范**: 集成 `.agent/skills` AI协作系统，确保开发过程中架构的优雅与一致性
    *   `code-style-check`: 强化类型安全与TailwindCSS规范
    *   `export-template-unification`: 确保编辑器预览与导出版视觉100%同位
    *   `performance-optimization`: 专项处理大型Base64图片导致的内存压力（Blob Manager）
*   **【编辑器优化】媒体处理增强**:
    *   PDF智能提取：自动提取PDF标题、摘要和关键词作为文章元数据
    *   视频/GIF首帧提取：为打印版自动提取视频和GIF首帧，确保打印效果
    *   媒体容器原子化：确保视频、音频等媒体元素可整体删除，提升编辑体验
*   **【导出系统】架构升级**:
    *   双模导出系统：支持阅读版（交互式）和打印版（线性排版）两种导出模式
    *   Base64安全注入：使用Unicode转义解决大容量内容崩溃问题
    *   极速首屏策略：只渲染封面，延迟加载其他内容，提升加载体验

### v1.2.2 (2026-02-13) - 终极体验优化与残留问题修复
*   **【打印系统】全面加固**:
    *   彻底解决了打印版中封面、目录可能丢失的 Bug，确保 A4 纸张排版 100% 还原。
    *   **PDF 图片质量升级**: 将 PDF 转图质量提高至 `0.98`，消除打印时的颗粒感。
    *   **页脚重塑**: 统一了编辑器与打印版的公司 Logo 尺寸与对齐方式。
*   **【阅读器】媒体修复**: 移除了导出模板中错误将视频/GIF 替换为打印占位符的逻辑，**恢复了电子阅读版中视频与动图的正常播放。**
*   **【UI 清理】移除遗留打印**: 删除了编辑器工具栏中已过时的"🖨️ 打印"按钮，引导用户统一使用专门的"打印专用版"导出流程。
*   **【文案统一】**: 全站"摘要/导读"正式更名为"**摘要**"，界面更趋干练。

### v1.2.1 (2026-01-19) - PDF 处理策略分离
*   **双模解析**: 打印版自动转 300DPI 高清图，阅读版保留原件交互预览。
*   **性能提升**: 实现了激进的首屏加载策略，阅读器首屏显示时间优化至近乎 0 延迟。
*   **安全注入**: 数据注入从 Base64 字符串升级为 Unicode 转义，解决大容量内容崩溃问题。

### v1.2.0 (2026-01-15) - 打印隔离系统
*   **打印隔离**: 实现独立的打印页面生成器，彻底解决 SPA 在部分浏览器下的打印分页断层。
*   **兼容性降级**: 导出版脚本进行 ES5 转译，支持内网/低版本工业浏览器。

### v1.1.1 (2026-01-12) - 构建架构 V2
*   **Post-Build Injection**: 废弃多重构建，采用单次构建+静态注入，解决内存溢出崩溃问题。
*   **PDF.js 离线全量注入**: 彻底解决离线环境无法加载 WASM 的痛点。

### v1.1.0 (2026-01-12) - 杂志时代
*   **UI 逻辑剥离**: 重构 `App.tsx`，将布局分发至 `MainLayout`。
*   **杂志风设计**: 引入全新的"杂志封面/封底"模式，支持实时切换。

### v1.0.x (2025-12月)
*   **AI 总结上线**: 集成 Gemini API 提取文章 Why & How。
*   **微信抓取 V4**: 引入噪声剔除算法，自动清理二维码。
*   **IndexedDB V2**: 实现文章级原子化存储，大幅提升大数据量下的稳定性。

---
最后更新：2026-04-15