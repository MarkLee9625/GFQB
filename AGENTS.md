# AGENTS.md

> **维护说明**：本文件（AGENTS.md）为唯一项目文档维护入口。

## 项目概述

工法情报编辑器：React 19 + TypeScript + Vite + IndexedDB 的本地优先情报编辑工具，BFF 代理接 DeepSeek API。**始终使用简体中文回复。**

## 开发路线图（2026-10-11 编制）

**进度：P0-A 媒体资产拆表 ✅ / P0-B 保存链路 flush ✅（2026-10-13 完成，实施记录与验收证据见该文档「实施记录」节）；P1-A/P1-B/P2 系列待开发。**

后续开发按 **`docs/开发方案-性能优化与功能增强.md`** 执行：8 张任务卡（P0-A 媒体拆表、P0-B 保存 flush、P1-A 回收站+备份、P1-B 状态域拆分、P2-A 撤销栈、P2-B 图谱 ?raw 改造、P2-C 小件包、P3 随卡测试），每卡含现状证据/设计/步骤/验收/风险。**开工前先读该文档**；完成后在此节标注进度并回填文档附录 B 性能基线。

阅读包优化按 **`docs/开发方案-阅读包体积与打开速度优化.md`**（R 系列）执行。**2026-10-20 落地**：打印空白页根治（A1 台架/A2 双约束/A3 分页清理/A4 真数据回归）+ R0 基线/R-D0 去重/R1-a/R1-b/R2 守卫/R3 告警/R4/R4-auto（v2 布局说明见 `docs/阅读包v2布局说明.md`；发布须 `npm run build` 后用生产服务导出，dev 导出为 v1 骨架）。

## 暂停开发事项（2026-09-05 用户决议）

- **AI 选题评审暂停开发**：`batchEvaluateArticles`（`services/ai/review.ts`）及配套入口（`AiCurationModal` 评审链路）暂时用不到，现有代码保持原样可用，不删除、不增强。
- 连带搁置：已识别的“评审批量无上限→按 10 篇分批”改造，在评审解冻前不实施。
- 同日决议：卷首语（`generateForeword`）推理强度保持默认 `max`，不降档。—— **2026-10-19 用户改判：全局默认思考强度改为 `high`（模型仍 `deepseek-flash`），且所有调用（含元数据/扩写/标题/评审/学术编译等轻任务）统一 `high`，不再有传 `low` 的调用点；本条作废**。

## 文件编辑约定（重要）

- 本目录位于 OneDrive 中文路径下；**DSH 环境下 read / edit / write 工具可直接读写**（已验证可用）。
- **如果编辑工具报沙箱拒绝（EPERM）**，改用 PowerShell 兜底：`Get-Content -Raw -LiteralPath` 读取，`[System.IO.File]::WriteAllText / WriteAllLines`（UTF-8 无 BOM）写入；小改动用精确字符串替换，大改动用单引号 here-string 整文件重写。
- 写完后立即回读校验，必要时 `node --check` / `npm run typecheck` 验证。

## 提示约定（重要）

- **禁止新增 `alert()` / `window.alert` 调用**：统一走全局 Toast（`import { toast } from '../src/utils/toast'`；`toast.info/success/warning/error(message)`，组件为 `ToastHost`，已挂载在 App 根级）。
- 例外：破坏性操作的确认（`window.confirm`）、导出阅读器内联脚本（`reader/clientScript.ts` 及其按序拼接的拆分片段 `src/services/export/reader/client/*`，如 `client/render.ts`）、测试数据中的字符串。
- 新增 `alert` 会被审查拒绝，请遵守。

## 可用技能（`.codex/skills/`）

| 技能 | 用途 |
|------|------|
| add-article | 新建文章 |
| ai-meta | AI 元数据/图谱/选题 |
| check-app | 全面检查 |
| app-audit | 代码分析 |
| db-inspect | IndexedDB 检查 |
| export-data | 数据导出 |
| git-upload | 提交推送 |

## 关键命令

```powershell
npm run dev:all      # 并行启动 Vite :4512 + BFF :4513（开发推荐）
npm run dev          # 仅 Vite :4512
npm run server       # 仅 BFF :4513
npm run build        # 生产构建 → dist/
npm run test         # vitest run
npm run typecheck    # tsc --noEmit
npm run start        # 生产模式 (NODE_ENV=production node server.js)
npm run test:watch   # vitest 监听模式
npm run test:server  # BFF 回归测试 (node --test server.test.mjs)
npm run verify:print / :issue3 / :v2e2e / :vtranscode  # 打印台架 / 真数据回归 / v2端到端 / 转码真机门
npm run test:file <path>  # bash scripts/test-file.sh <path>（单文件测试）
npm run test:coverage     # 仅 fileHelpers.ts + pasteCleaner.ts
npm run clean             # 清理构建产物（dist/ + public 下 PDF.js 资源）
start.ps1 / start.bat     # Windows 一键启动（检查依赖/清理残留进程）
```

**开发环境必须启动 BFF**（Vite 的 `/api` 代理转发到 :4513）。

## 环境变量（.env.local）

```env
DEEPSEEK_API_KEY=sk-xxx           # BFF 后端专用，绝不能加 VITE_ 前缀
PROXY_SECRET=sws-gongfa-proxy-xxx # BFF 鉴权密钥
```

## 架构要点

- App.tsx 是状态中枢（唯一 state 集中地）→ Hooks → Services → IndexedDB
- 数据落在 IndexedDB（db.ts 单例）

> 完整技术栈、代码规范见下文「附录：实现细节」。

---

## 附录：实现细节

## 技术栈

React 19 + TypeScript 5.8 · Vite 6 · TailwindCSS v4 · Vitest + jsdom · Express (BFF) · IndexedDB · DeepSeek API

## 关键命令

```bash
npm run dev              # Vite 开发服务器 :4512
npm run dev:all          # 并行启动 Vite :4512 + BFF :4513
npm run build            # 生产构建 → dist/（sync worker → vite build → post-build 内联资源）
npm start                # 生产模式 (NODE_ENV=production node server.js)
npm run server           # 仅启动 BFF 代理 :4513
npm run test             # vitest run（测试文件在 src/**/*.{test,spec}.* 与 hooks/**/*.{test,spec}.*）
npm run test:watch       # vitest 监听模式
npm run test:file <path> # bash scripts/test-file.sh <path>（单文件测试）
npm run typecheck        # tsc --noEmit
npm run test:coverage    # 仅 fileHelpers.ts + pasteCleaner.ts
npm run clean            # 清理构建产物（dist/ + public 下 PDF.js 资源）
```

**开发环境需要 BFF**: `npm run dev:all` 或分两个终端跑 `npm run dev` + `npm run server`。Vite 的 `/api` 代理转发到 BFF :4513。

**Windows 一键启动**: `start.ps1` / `start.bat` 检查 Node/依赖/.env.local → 清理残留 node 进程 → 启动 Vite :4512 + BFF :4513，退出时自动清理进程。

## 项目级技能 (.codex/skills/)

7 个技能:add-article(新建文章)、ai-meta(AI 元数据/图谱/选题)、check-app(全面检查)、app-audit(代码分析)、db-inspect(IndexedDB 检查)、export-data(导出)、git-upload(提交推送)。按需用 Skill 工具调用。

## 环境变量 (.env.local)

```env
DEEPSEEK_API_KEY=sk-xxx           # BFF 后端专用，绝不能加 VITE_ 前缀
PROXY_SECRET=sws-gongfa-proxy-xxx # BFF 鉴权密钥
```

## 架构核心

### 数据流

```
用户操作 → App.tsx（状态中枢，唯一 state 集中地）→ Hooks（业务逻辑）→ Services（数据处理）
                                                                        ↓
                                                                IndexedDB（db.ts 单例）
                                                                        ↓
                                                                App.tsx → 组件渲染
```

**App.tsx 是唯一状态中枢**: 所有顶层 state 和 useCallback 在此定义，通过 props 下传。无 Redux，纯 React Hooks。

**useJournal** (`hooks/useJournal.ts`) 是业务数据核心入口，掌管 articles 数组的 CRUD + IndexedDB 持久化。

顶层 `hooks/` 共 11 个 hook:useJournal、useExportManager、useImportManager、useBlobManager、useMemoryMonitor、useAppInitialization、useArticleNavigation、usePanZoom、useInView、useAiFeatures、useKeyboardShortcuts。

### 懒加载策略

Editor、KeyboardShortcutsHelpModal、CategoryManagerModal、ExportOptionsModal、AiCurationModal 均用 `React.lazy()` + `Suspense` 包裹。`loading` 状态结束后自动触发预加载（`App.tsx:149-158`）。

### 编辑器架构

`components/Editor.tsx` 是核心富文本编辑器，其逻辑拆分为 6 个专用 hook（`components/editor/hooks/`）:
- **useEditorState** — content HTML、blocks、脏标记
- **useEditorCommands** — 命令执行、格式化、撤销重做
- **useEditorKeyboard** — 快捷键
- **useFileUpload** — 文件上传与 WebP 压缩
- **useImageToolbar** — 图片选中工具栏
- **useSelectionManager** — 光标/选区管理

### 渲染器

`ArticleRenderer`（`components/renderers/ArticleRenderer.tsx`）按 `article.category` 分发：
- `CoverRenderer` — category='封面'
- `BackRenderer` — category='封底'
- `ContentRenderer` — 其他 category

### BFF 代理安全

`server.js`（Express）:
- `POST /api/deepseek/generate` 接收前端请求 → `x-sws-proxy-secret` 头鉴权 → 转发 DeepSeek API
- API Key 不暴露到前端
- 生产模式同时托管 `dist/` 静态资源
- 600s 上游超时，SIGTERM/SIGINT 优雅关闭
- 请求体限制 5MB
- `GET /api/health` 健康检查端点
- 生产模式下同源请求跳过 proxy-secret 校验（前端由同一 server.js 托管）

### 构建后内联

`scripts/post-build.js` 在 `vite build` 后执行，将所有外部依赖（JS/CSS/字体/图片，包括 10MB+ PDF.js Worker）转为 Base64 内联到单个 HTML。导出的离线阅读器因此可真正单文件离线使用。

注意:生产构建 esbuild `drop: ["console", "debugger"]`，线上包无 console 日志，排障时需在开发模式验证。

### 其他脚本

`scripts/` 目录：
- `copy-worker.js` — 构建前复制 PDF.js worker（`npm run sync:worker`）
- `start-all.sh` — 并行启动 Vite + BFF（`npm run dev:all`）
- `test-file.sh` — 单文件测试（`npm run test:file <path>`）
- `check-env.sh` — 环境变量检查
- `typecheck.sh` — 类型检查（`npm run typecheck`）
- `post-build.js` — 构建后内联资源
- `create-pptx.mjs` — 导出 PPTX

### 导出引擎（双引擎架构）

`src/services/export/`:
- **reader** — 生成单 HTML 离线阅读器（含 Base64 内联资源 + 全文检索）
- **print** — 生成打印优化版 HTML（A4 分页、隐藏 UI 元素）

`index.ts` 作为门面统一导出两个引擎。PDF 直出链路已于 v1.9.0 下线（代码与依赖均已移除）。

### PDF 解析

`src/services/pdf/` — 多策略模式（`strategies/` 目录）:
- **abstract** — 提取摘要
- **keywords** — 提取关键词
- **title** — 提取标题
- **wrapper.ts** — PDF.js 封装

### 数据源抓取

`src/services/fetchers/`:
- `rssFetcher.ts` — RSS 源抓取（rss2json + AllOrigins 双引擎降档）
- `paperFetcher.ts` — 论文检索：OpenAlex 直连优先 + BFF(`/api/papers/search`)/arXiv 兜底；含摘要重建、DOI/标题去重、摘要质量门槛、游标分页。入口 `searchPapers()`，消费方 `AiCurationModal`（Tab「前沿学术文献」，sourceType='paper' 采纳时触发 AI 深度编译）
- `patentFetcher.ts` — 专利网页抓取（**休眠**：已无调用方；Google Patents 无 CORS 且选择器失效，保留备将来专利 Tab 复用）

### AI 服务

`services/aiService.ts` — DeepSeek AI 调用（元数据生成、卷首语、知识图谱数据等）

### 知识图谱

`src/utils/graph/` 包含:
- **QuadTree** — 空间索引加速
- **ForceEngine** — 力导向布局
- **Canvas 渲染** — 交互式图谱
- **graphRenderer.ts** — 知识图谱 HTML 组装（~54KB）

**⚠️ 特殊架构：代码生成注入模式**
`graphEngine.ts` 和 `Renderer.ts` 不是标准 TS 模块，它们导出 `generateGraphEngineCode()` / `generateRendererCode()` 函数，返回 **JS 源码字符串**。实际 D3/Canvas 代码嵌入在模板字面量内部，通过 `graphRenderer.ts` 组装后注入 iframe 的 `srcdoc` 中运行。编辑时必须注意：
- 模板字面量内严禁出现反引号 `` ` `` 和 `${}` 语法（会导致外层模板提前闭合）
- 字符串拼接一律使用 `+`
- 生成代码面向现代浏览器（允许 `const`/`let`/`Map`/`Object.values`，目标 ES2017+；iframe `srcdoc` 环境可控），不再限定 ES5

`services/graphCache.ts` 提供 IndexedDB LRU 缓存。

## 数据模型

### Article（核心实体，`src/types/models.ts`）

```typescript
interface Article {
  id: number;              // Date.now() * 1000 + 自增计数器
  title: string;
  category: ArticleCategory; // '封面' | '封底' | string
  content: string;         // HTML 正文
  blocks?: ContentBlock[]; // 结构化块，双存储互补
  date?: string;
  issueText?: string;      // 期号
  dateText?: string;       // 日期文本
  coverImage?: string | null;  // base64
  backImage?: string | null;
  scale?: number; posX?: number; posY?: number; // 封面/封底图片平移缩放
  pdfData?: string | null;
  abstract?: string | null;
  tags?: string[];
  isPublished?: boolean;
  order?: number;          // 排序权重，封面=0，封底=99999
  fontSize?: number;
  lineHeight?: number;
}
```

### ContentBlock（13 种联合类型，`src/types/blocks.ts`）

`paragraph | heading(1-6) | image | video | audio | pdf | blockquote | list(ordered/unordered) | table | code | hr | figure | rawHtml`。每种都有 `id: string` + `type`。

### UniversalArticleMeta（AI 选题，`src/types/intelligence.ts`）

```typescript
{ id, sourceType: 'wechat'|'rss'|'patent'|'aip'|'paper', sourceName, title, content, url?, publishDate?, aiSummary?, reason?, tags?, decision: 'pending'|'recommend'|'reject', /* paper 附加 */ abstract?, authors?, journal?, year?, citationCount?, doi? }
```

## 关键约定

- **ID**: `Date.now() * 1000 + 自增计数器`
- **封面/封底**: category 固定不变，order 强制 0/99999，禁止删除（`isSpecialCategory` 判断）
- **排序**: 普通文章按 `order` 升序
- **图片**: 统一 WebP，maxWidth=1200（封面/封底 2400px + quality=0.92）。`src/utils/fileHelpers.ts`
- **IndexedDB**: 库名 `SWS_DATABASE_REACT`（v4，双表），`journal_store`（key `article-{id}` / `config-{key}`）+ `media_store`（key = 媒体内容哈希，P0-A 新增）
- **存储**: content（HTML）为主，blocks 按需结构化解析，双存储互补
- **媒体引用（P0-A，重要）**: 文章里的 base64 媒体统一抽到 `media_store`，字段内只留 `sws-media://{hash}` 引用。**任何需要真实 data URL 的场景（导出、AI 上下文、PDF 抽字）必须先经 `services/mediaStore.ts` 还原**（`resolveMediaValue` / `resolveArticleMediaData` / `resolveArticlesMediaData`）；渲染链路统一走 `useBlobManager().getBlobUrlAsync`（已支持引用解析）。导出引擎已内置兜底还原，但新写的导出/分析路径请显式还原。
- **Vite**: `base: './'`（相对路径）、`target: 'esnext'`、chunkSizeWarningLimit=1000KB
- **路径别名**: `@/` → 项目根目录
- **样式**: 全局 CSS 常量 `CONSTANTS.UNIFIED_STYLES` 在 `src/constants.ts`，含强制中文排版规则（首行缩进 2 字符、图片居中、标题无缩进等）

## 类型配置要点

`strict: true`，`noUnusedLocals` / `noUnusedParameters` 已开启（未用参数以 `_` 前缀豁免）；`noImplicitAny` 默认开启，`noEmit: true`。

## 测试

- 环境: jsdom + globals（`src/__tests__/testSetup.ts` mock IntersectionObserver, FileReader, Image）
- 覆盖率范围: 仅 `src/utils/fileHelpers.ts` + `src/utils/pasteCleaner.ts`
- 运行单文件: `npm run test:file src/utils/someFile.test.ts`

## 设计模式

- **门面**: `src/services/export/index.ts` 统一导出两个导出引擎（reader/print）
- **组合**: `ArticleRenderer` 按 category 分发到 Cover/Back/Content
- **策略**: PDF 抽字多策略（`src/services/pdf/strategies/`）
- **内容-显示分离**: content(HTML) + blocks(结构化) 双存储
- **单例**: `services/db.ts` DBService 单例
- **LRU 缓存**: `services/graphCache.ts`

## Wiki 项目卡片规则

每次完成编码任务后，如果本次改动涉及**架构决策、技术选型变更、踩坑解决、或新增功能模块**，请同时更新 wiki 项目卡片。

- **卡片路径**：`../wiki/项目/工法情报编辑器.md`
- **内容规则**：只写决策理由、踩坑记录、架构变化，不写代码实现细节
- **何时跳过**：纯 bugfix、重构不改设计、文档拼写修正、依赖升级
