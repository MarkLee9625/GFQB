<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SWS 工法情报系统 (Ship Construction Method Information System)

这是一个基于 **React + TypeScript** 的工法情报编辑和管理系统，专为船舶工程与智能制造领域设计。系统支持富文本编辑、PDF 开箱即用、AI 智能辅助（DeepSeek V4）、多源数据抓取以及杂志级排版导出。

---

## 快速开始

**前提条件:** 安装 [Node.js](https://nodejs.org/)

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **配置环境**:
   在根目录创建 `.env.local` 文件:
   ```env
   DEEPSEEK_API_KEY=sk-你的_DeepSeek_API_Key
   PROXY_SECRET=sws-gongfa-proxy-xxx
   ```
   API Key 通过后端 BFF 代理服务器安全转发，不暴露给前端。

3. **运行开发服务器**:
   ```bash
   npm run dev
   ```

4. **构建生产版本**:
   ```bash
   npm run build
   ```

---

## 开发命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动前端开发服务器 (端口 3000) |
| `npm run dev:all` | 并行启动前端 (3000) + BFF 代理 (3001) |
| `npm run build` | 构建生产版本 + 内联资源 |
| `npm start` | 生产模式启动 (端口 3001) |
| `npm run server` | 仅启动 BFF 代理服务器 |
| `npm test` | 运行全部测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run test:file <path>` | 运行单个测试文件 |
| `npm run test:coverage` | 生成测试覆盖率报告 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run check:env` | 检查环境配置完整性 |
| `npm run clean` | 清理构建产物 |

---

## Claude Code Skills

本项目内置了 7 个 Claude Code 自定义 slash command，可在对话中直接输入 `/<skill-name>` 调用：

| 命令 | 用途 |
|------|------|
| `/check-app` | 全量检查环境变量、类型、测试、构建完整性 |
| `/app-audit` | 深度代码审查：未使用代码、类型安全、性能瓶颈 |
| `/add-article` | 交互式创建新文章，含 AI 辅助和图片压缩 |
| `/ai-meta` | AI 功能大全：元数据、卷首语、知识图谱、选题评审 |
| `/export-data` | 数据导出/导入：Reader、打印版、PDF、项目文件 |
| `/db-inspect` | IndexedDB 诊断、数据修复、缓存清理 |
| `/git-upload` | 提交并推送代码到 GitHub，含变更审查与提交规范 |

---

## 项目结构

```
.
├── .claude/skills/              # Claude Code 开发 Skills
├── CLAUDE.md                    # 项目架构文档
├── App.tsx                      # 应用主入口（状态编排）
├── index.tsx                    # React 渲染入口
├── index.html                   # HTML 入口
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite 构建配置
├── vitest.config.ts             # Vitest 测试配置
├── server.js                    # Express BFF 代理服务器
│
├── components/                  # React 组件
│   ├── Editor.tsx               # 核心富文本编辑器
│   ├── PaperView.tsx            # 纸张预览引擎
│   ├── Sidebar.tsx              # 侧边栏导航
│   ├── Toolbar.tsx              # 顶部工具栏
│   ├── NavigationCapsule.tsx    # 上下篇导航
│   ├── CategoryManagerModal.tsx # 分类管理弹窗
│   ├── ExportOptionsModal.tsx   # 导出选项弹窗
│   ├── KeyboardShortcutsHelpModal.tsx
│   ├── ErrorBoundary.tsx        # 错误边界
│   ├── Icons.tsx                # SVG 图标系统
│   ├── LoadingOverlay.tsx
│   ├── editor/                  # 编辑器子组件 + 6 个 Hooks
│   └── renderers/               # 渲染器（Cover/Back/Content）
│
├── hooks/                       # 业务逻辑 Hooks
│   ├── useJournal.ts            # 文章 CRUD + IndexedDB
│   ├── useAiFeatures.ts         # AI 功能（卷首语/图谱）
│   ├── useExportManager.ts
│   ├── useImportManager.ts
│   ├── useArticleNavigation.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useAppInitialization.ts
│   ├── useBlobManager.ts
│   ├── useMemoryMonitor.ts
│   ├── usePanZoom.ts
│   └── useInView.ts
│
├── services/                    # 服务层
│   ├── db.ts                    # IndexedDB 封装
│   ├── aiService.ts             # DeepSeek AI 服务
│   └── graphCache.ts            # 知识图谱缓存
│
├── scripts/                     # 构建与开发脚本
│   ├── post-build.js            # 构建后处理（资源内联）
│   ├── copy-worker.js           # PDF.js Worker 复制
│   ├── start-all.sh             # 并行启动前端+BFF
│   ├── check-env.sh             # 环境检查
│   ├── test-file.sh             # 单文件测试
│   └── typecheck.sh             # 类型检查
│
├── src/
│   ├── index.css                # 全局样式（含中文排版引擎）
│   ├── constants.ts
│   ├── components/
│   │   ├── AiCurationModal.tsx  # AI 选题工作台
│   │   └── Layout/MainLayout.tsx
│   ├── services/export/         # 导出引擎（reader/print/pdf）
│   ├── services/pdf/            # PDF 解析（含策略模式）
│   ├── services/fetchers/       # RSS + 专利数据抓取
│   ├── types/                   # 类型定义
│   ├── utils/                   # 工具函数
│   └── __tests__/
│
└── public/                      # PDF.js 静态资源
```

---

## 核心技术机制

### 离线阅读器导出
系统采用"量子纠缠"式架构，导出的阅读器是编辑器的受限功能副本。`post-build.js` 将所有外部依赖（包括 10MB+ PDF 渲染引擎）转为 Base64 嵌入单个 HTML，实现真正离线可用。

### DeepSeek V4 AI 集成
- **文章元数据**: 自动生成标题、摘要、关键词（船舶工程专业人设）
- **卷首语生成**: 纵览全刊撰写 600-800 字导读
- **知识图谱**: 40-70 个节点 + 关系链路，含交互式 Canvas + 打印 SVG
- **AI 选题评审**: 批量评审文章，双栏沙盘展示推荐/淘汰
- **学术文献编译**: 英文论文 → 中文工法报道
- 所有请求通过 BFF 代理转发，API Key 不暴露给前端

### 专业中文排版
内置强制中文期刊排版规则：首行缩进 2 字符、图片居中、标题无缩进、幽灵空行粉碎、PDF 页面拟物化。

---

## 架构决策

| 决策 | 选择 |
|------|------|
| 状态管理 | React Hooks（无 Redux） |
| 持久化 | IndexedDB（单库单表） |
| AI 代理 | Express BFF + PROXY_SECRET 鉴权 |
| 图片压缩 | 强制 WebP，1200px 上限 |
| 文章 ID | `Date.now() * 1000 + 自增` |
| 排序 | `order` 字段升序，封面=0，封底=99999 |
| CSS | TailwindCSS v4 + 全局打印样式 |
| 测试 | Vitest + jsdom |
| 导出 PDF | `@react-pdf/renderer` + `pdf-lib` |
| 导出 HTML | `post-build.js` 内联全量资源 |

---

## 更新日志

### v1.9.1 (2026-04-25) - 仓库清理与 Skills 扩展
- 新增 `/git-upload` skill — 提交并推送代码到 GitHub
- 从 Git 跟踪中移除 `.trae/` 和 `dist-reader/` 目录（已加入 .gitignore）
- 删除已迁移的旧类型文件 (`src/types/index.ts`, `ui.ts`)
- 删除已合并的旧样式文件 (`styles/article-renderer.css`)

### v1.9.0 (2026-04-25) - Claude Code Skills 集成
- 新增 6 个 Claude Code 开发维护 skills
- 新增 CLAUDE.md 项目架构文档
- 新增开发辅助脚本（类型检查/测试/环境检测）
- 修复缺失的 `intelligence.ts` 类型定义
- 清理 Trae CN 编辑器残留文件

### v1.8.0 (2026-04-24) - DeepSeek V4 模型升级
- DeepSeek V4 全面迁移，启用 thinking 模式
- 知识图谱三阶段架构（节点 → 关系 → 补充）
- 导出 Worker 后台压缩，UI 不卡顿
- Blob URL 替换性能提升 100x
- 图片自动适配计算（`imageMath.ts`）

### v1.7.0 (2026-04-20) - 编辑器组件重构
- Editor 重构为 ArticleRenderer 模块化架构
- 新增 6 个编辑器 Hooks，职责分离
- 导出模块拆分为 pdf/print/reader 子模块
- 新增 `blockParser.ts` 区块解析 + 类型系统

### 更早版本
参见 [GitHub Releases](https://github.com/MarkLee9625/GFQB/releases)

---

最后更新：2026-04-25 (v1.9.1)