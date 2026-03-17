<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SWS 工法情报系统 (Ship Construction Method Information System)

这是一个基于 **React + TypeScript** 的工法情报编辑和管理系统，专为船舶工程与智能制造领域设计。系统支持极其精细的富文本编辑、PDF 开箱即用、智能 AI 辅助、微信文章抓取以及杂志级排版导出。

在 AI Studio 中查看应用: [ai.studio/apps/drive/...](https://ai.studio/apps/drive/139L7v7pTpQDqBY8nzmA_5yAFOrZDtRwe)

---

## 🚀 快速开始 (Quick Start)

**前提条件:** 安装 [Node.js](https://nodejs.org/)

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置环境**:
   在根目录创建 `.env.local` 文件，并设置您的 Gemini API 密钥（注意：这是后端代理专用密钥）：
   ```env
   GEMINI_API_KEY=您的_GEMINI_API_KEY
   ```

   **重要安全说明**：
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
├── App.tsx                         # 应用主入口（逻辑层）
├── index.html                      # HTML 入口
├── index.tsx                       # React 渲染入口
├── package.json                    # 项目依赖与脚本
├── package-lock.json               # 依赖锁文件
├── README.md                       # 项目说明文档
├── tailwind.config.js.bak          # Tailwind 配置备份
├── tsconfig.json                   # TypeScript 配置
├── types.ts                        # 全局类型定义
├── vite.config.ts                  # Vite 构建配置
├── vite-env.d.ts                   # Vite 环境类型
├── metadata.json                   # 项目元数据
├── build_output.txt                # 构建输出日志
├── build_debug.txt                 # 调试构建日志
├── build_detailed_error.txt        # 详细错误日志
├── error_log.txt                   # 错误日志
├── extract*.js / .mjs              # PDF 提取相关脚本
├── test_*.js                       # 测试脚本
│
├── components/                     # React 组件
│   ├── Editor.tsx                  # 核心富文本编辑器
│   ├── PaperView.tsx               # 杂志风渲染引擎
│   ├── PaperView.backup.tsx        # 渲染引擎备份
│   ├── Sidebar.tsx                 # 侧边栏导航
│   ├── Toolbar.tsx                 # 编辑器工具栏
│   ├── Icons.tsx                   # 自定义 SVG 图标系统
│   ├── ErrorBoundary.tsx           # React 错误边界
│   ├── LoadingOverlay.tsx          # 加载遮罩组件
│   ├── NavigationCapsule.tsx       # 导航胶囊组件
│   ├── CategoryManagerModal.tsx    # 分类管理弹窗
│   ├── ExportOptionsModal.tsx      # 导出选项弹窗
│   └── KeyboardShortcutsHelpModal.tsx  # 快捷键帮助弹窗
│
├── hooks/                          # 自定义 React Hooks
│   ├── useJournal.ts               # 文章数据管理（IndexedDB CRUD）
│   ├── useBlobManager.ts           # Blob 内存管理
│   ├── useInView.ts                # 视图内检测
│   └── useMemoryMonitor.ts         # 内存监控
│
├── services/                       # 业务服务层
│   ├── aiService.ts                # Gemini AI 服务
│   ├── db.ts                       # IndexedDB 封装（V2 原子化存储）
│   └── wechatImporter.ts           # 微信文章抓取 V5
│
├── scripts/                        # 构建脚本
│   ├── post-build.js               # 构建后处理（资源内联与注入）
│   └── copy-worker.js              # Worker 复制脚本
│
├── src/                            # 源码目录（Vite 主源）
│   ├── index.css                   # 全局样式
│   ├── pdf-worker.d.ts             # PDF Worker 类型定义
│   │
│   ├── components/                 # 源码组件（部分）
│   │   ├── Toolbar.tsx
│   │   └── Layout/
│   │       └── MainLayout.tsx      # 主布局组件
│   │
│   ├── services/                   # 源码服务
│   │   ├── export/                 # 导出模块
│   │   │   ├── index.ts            # 导出服务入口
│   │   │   ├── assets.ts           # 导出资源（样式/图片）
│   │   │   └── templates.ts        # HTML 模板
│   │   │
│   │   └── pdf/                    # PDF 解析模块
│   │       ├── index.ts            # PDF 服务入口
│   │       ├── wrapper.ts          # PDF.js 封装
│   │       └── strategies/         # 解析策略模式
│   │           ├── abstract.ts     # 摘要提取策略
│   │           ├── keywords.ts     # 关键词提取策略
│   │           └── title.ts        # 标题提取策略
│   │
│   ├── types/                      # 类型定义
│   │   ├── models.ts               # 数据模型类型
│   │   └── ui.ts                   # UI 组件类型
│   │
│   └── utils/                      # 工具函数
│       └── fileHelpers.ts          # 文件操作辅助
│
├── public/                         # 静态资源（Vite 公共目录）
│   ├── pdf.min.mjs                 # PDF.js 主库
│   ├── pdf.worker.min.mjs          # PDF.js Worker
│   ├── cmaps/                      # PDF 字体映射（多文件）
│   ├── standard_fonts/             # PDF 标准字体
│   └── wasm/                       # PDF.js WASM 文件
│
├── dist_test/                      # 测试构建输出
│   ├── index.html                  # 测试 HTML
│   ├── pdf.min.mjs                 # PDF.js 库
│   ├── pdf.worker.min.mjs          # PDF.js Worker
│   ├── assets/                     # 打包资源
│   └── cmaps/                      # PDF 字体映射
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
*   **编辑器 (`components/Editor.tsx`)**: 集成了富文本编辑、AI 拟题、摘要生成及媒体原子化插入逻辑。
*   **渲染引擎 (`components/PaperView.tsx`)**: 负责“杂志风格”与“经典风格”的实时物理排版模拟。
*   **状态管理 (`hooks/useJournal.ts`)**: 统一的数据流入口，负责 IndexedDB 的并发读写与文章生命周期管理。
*   **构建引擎 (`scripts/post-build.js`)**: **项目灵魂**。在构建后自动内联 JS/CSS，并注入 PDF.js 核心及 Worker，实现“单文件自包含 HTML”导出。

---

## 🏗️ 核心技术机制

### 1. 离线阅读版导出原理
本系统采用“量子纠缠”式的架构，导出的阅读器实际上是编辑器自身的受限功能副本：
*   **一键内联**：通过 `post-build.js` 将所有外部依赖（包括 10MB+ 的 PDF 渲染引擎）转为 Base64 嵌入单个 HTML。
*   **数据注入**：用户导出时，文章数据、加密图片均通过 Base64 安全注入到模板的 `window` 对象中。
*   **单页路由**：阅读版采用极简的单页 Hash 路由切换文章。

### 2. AI 智能开发助手 (Agent Skills)
项目在 `.agent/skills` 下内置了一套 AI 协作规范，确保开发过程中架构的优雅与一致性：
*   `code-style-check`: 强化类型安全与 TailwindCSS 规范。
*   `export-template-unification`: 确保编辑器预览与导出版视觉 100% 同位。
*   `performance-optimization`: 专项处理大型 Base64 图片导致的内存压力（Blob Manager）。

---

## ✨ 核心特性

-   **智能抓取**: 微信文章 V5 极速抓取，自动清洗头部干扰与尾部广告。
-   **AI 辅助**: 基于 Gemini-3-Flash 智能提取技术重点 (Why/How/Benefits) 并一键拟定标题。
-   **杂志排版**: 封面/封底支持实时切换设计风格，支持高清 PDF 附件预览与自动转图。
-   **极端离线**: 导出的情报包不依赖任何网络，所有图片与播放器内核均为内置。

---

## 📅 更新日志 (Changelog)

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
最后更新：2026-03-16
