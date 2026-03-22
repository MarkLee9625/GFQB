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
├── "AI 季度智能选题库 (AI Curation Dashboard) 开发规划.md"  # AI选题库开发规划
├── "全渠道工法情报矩阵 (Omni-Channel Intelligence Matrix) 开发规划.md"  # 全渠道矩阵开发规划
├── ai-upgrade-plan.md              # AI升级计划
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
│   ├── aiService.ts                # Gemini + DeepSeek AI 服务（含批量评审接口）
│   ├── db.ts                       # IndexedDB 封装（V2 原子化存储）
│   └── aiService.ts.backup         # AI 服务备份文件
│
├── scripts/                        # 构建脚本
│   ├── post-build.js               # 构建后处理（资源内联与注入）
│   └── copy-worker.js              # Worker 复制脚本
│
├── src/                            # 源码目录（Vite 主源）
│   ├── index.css                   # 全局样式
│   ├── pdf-worker.d.ts             # PDF Worker 类型定义
│   │
│   ├── components/                 # 源码组件
│   │   ├── Toolbar.tsx
│   │   ├── AiCurationModal.tsx     # AI季度智能选题库工作台
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
│       ├── fileHelpers.ts          # 文件操作辅助
│       └── graphRenderer.ts        # 知识图谱渲染引擎
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
最后更新：2026-03-21
