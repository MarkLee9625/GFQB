# SWS 工法情报编辑器

船舶与海洋工程工法情报收集、编辑与发布系统。

## 技术栈

- **框架**: React 19 + TypeScript 5.8
- **构建**: Vite 6 + TailwindCSS v4
- **测试**: Vitest + jsdom + @testing-library/react
- **后端**: Express (BFF 代理服务器)
- **存储**: IndexedDB (浏览器端)
- **AI**: DeepSeek API (通过 BFF 代理)

## 项目结构

```
/
├── App.tsx                          # 主应用组件，全局状态编排
├── index.tsx                        # 入口文件
├── components/                      # 顶层UI组件
│   ├── Editor.tsx                   # 富文本编辑器(懒加载)
│   ├── PaperView.tsx                # 纸张预览组件(封面/封底/文章渲染)
│   ├── Sidebar.tsx                  # 侧边栏(文章列表)
│   ├── Toolbar.tsx                  # 顶部工具栏
│   ├── NavigationCapsule.tsx        # 上下篇导航胶囊
│   ├── CategoryManagerModal.tsx     # 分类管理弹窗(懒加载)
│   ├── ExportOptionsModal.tsx       # 导出选项弹窗(懒加载)
│   ├── KeyboardShortcutsHelpModal.tsx # 快捷键帮助弹窗(懒加载)
│   ├── ErrorBoundary.tsx            # 错误边界
│   ├── Icons.tsx                    # SVG图标集
│   ├── LoadingOverlay.tsx           # 加载遮罩
│   ├── editor/                      # 编辑器子组件
│   │   ├── EditorFooter.tsx
│   │   ├── EditorRightPanel.tsx
│   │   ├── FormattingToolbar.tsx
│   │   ├── ImageToolbar.tsx
│   │   └── hooks/                   # 编辑器Hooks
│   │       ├── useEditorState.ts
│   │       ├── useEditorCommands.ts
│   │       ├── useEditorKeyboard.ts
│   │       ├── useFileUpload.ts
│   │       ├── useImageToolbar.ts
│   │       └── useSelectionManager.ts
│   └── renderers/                   # 文章渲染器
│       ├── ArticleRenderer.tsx      # 统一渲染入口
│       ├── CoverRenderer.tsx        # 封面渲染
│       ├── BackRenderer.tsx         # 封底渲染
│       ├── ContentRenderer.tsx      # 文章内容渲染
│       └── SharedComponents.tsx
├── hooks/                           # 业务逻辑Hooks
│   ├── useJournal.ts                # 文章CRUD + IndexedDB持久化
│   ├── useAppInitialization.ts      # 应用初始化(读模式/编辑模式)
│   ├── useAiFeatures.ts             # AI: 卷首语生成 + 知识图谱
│   ├── useExportManager.ts          # 导出管理(reader/printable/PDF)
│   ├── useImportManager.ts          # 导入管理
│   ├── useArticleNavigation.ts      # 文章导航(搜索/切换)
│   ├── useKeyboardShortcuts.ts      # 全局快捷键
│   ├── useBlobManager.ts            # Blob URL管理
│   ├── useMemoryMonitor.ts          # 内存监控
│   ├── usePanZoom.ts                # 平移缩放
│   └── useInView.ts                 # 可见性检测
├── services/                        # 服务层
│   ├── db.ts                        # IndexedDB封装(连接/CRUD/批量)
│   ├── aiService.ts                 # AI服务(元数据/图谱/评审/编译)
│   └── graphCache.ts                # 知识图谱IndexedDB缓存
├── src/
│   ├── types/                       # 类型定义
│   │   ├── index.ts                 # 统一导出
│   │   ├── models.ts                # Article核心模型
│   │   ├── blocks.ts                # ContentBlock 14种块类型
│   │   └── ui.ts                    # UI相关类型
│   ├── constants.ts                 # 全局常量 + 排版样式
│   ├── index.css                    # 全局CSS + Tailwind + 打印样式
│   ├── components/
│   │   ├── AiCurationModal.tsx      # AI智能选题弹窗
│   │   └── Layout/MainLayout.tsx    # 主布局(侧栏+工具栏+内容+弹窗)
│   ├── services/
│   │   ├── export/                  # 导出引擎
│   │   │   ├── index.ts            # 门面统一导出
│   │   │   ├── reader.ts           # 阅读器导出
│   │   │   ├── reader.worker.ts    # Web Worker
│   │   │   ├── print.ts            # 打印版导出
│   │   │   ├── templates.ts        # HTML模板
│   │   │   ├── pdfEngine.ts        # PDF导出引擎
│   │   │   ├── pdfComponents.tsx    # PDF组件
│   │   │   ├── pdf/                # PDF子模块
│   │   │   └── utils/              # 导出工具
│   │   ├── pdf/                    # PDF处理服务
│   │   │   ├── index.ts            # PDF转图片
│   │   │   └── strategies/         # 抽字策略
│   │   └── fetchers/               # 数据抓取
│   │       ├── rssFetcher.ts       # RSS资讯拉取
│   │       └── patentFetcher.ts    # 专利检索
│   └── utils/                      # 工具函数
│       ├── fileHelpers.ts           # 文件/图片工具
│       ├── pasteCleaner.ts          # 粘贴HTML清洗
│       ├── blockParser.ts           # HTML→ContentBlock解析
│       ├── graphRenderer.ts         # 知识图谱渲染器(Canvas+SVG)
│       ├── encoding.ts              # Base64编解码
│       └── imageMath.ts             # 图片计算
├── server.js                        # Express BFF代理服务器
├── scripts/
│   ├── copy-worker.js               # Worker复制脚本
│   └── post-build.js                # 构建后处理
└── public/                          # 静态资源(CMap/PDF.js/字体)
```

## 核心数据流

```
用户操作 → App.tsx (状态管理) → Hooks (业务逻辑) → Services (数据处理)
                                                        ↓
                                              IndexedDB (持久化)
                                                        ↓
                                              App.tsx → 组件渲染
```

### 文章生命周期
1. **创建**: useJournal.createArticle() → 分配ID → db.saveArticle() → 更新state
2. **编辑**: Editor组件 → useEditorState管理表单 → 保存时触发useJournal.updateArticle()
3. **删除**: useJournal.deleteArticle() → 封禁封面封底删除 → db.deleteArticle()
4. **排序**: 侧栏拖拽 → reorderArticles() → 重新分配order权重 → db.clearAndBulkSaveArticles()

### 导出流程
```
exportToPdf()  → 生成PDF Blob → 下载
exportReaderHTML() → 生成独立阅读器HTML → 打开新窗口
generatePrintableHTML() → 生成打印版HTML → 预览窗口
```

### AI流程
```
生成卷首语:
  useAiFeatures.handleGenerateForeword()
  → aiService.generateForeword() → buildForewordContext()
  → callDeepSeekAPI() → 解析HTML → createArticle()

提取知识图谱:
  useAiFeatures.handleGenerateGraph()
  → buildSuperContextForGraph() (含PDF抽字)
  → graphCache检查 (避免重复调用)
  → aiService.extractGlobalKnowledgeGraph()
  → generateGraphHtml() → 创建iframe沙盒渲染 → createArticle()

AI选题评审:
  AiCurationModal → 多源导入(RSS/专利/MD) → batchEvaluateArticles()
  → 双栏沙盘展示 → 采纳时触发onAdopt() → createArticle()
```

## 数据模型

### Article (核心模型)
```typescript
interface Article {
  id: number;           // 唯一ID (Date.now()生成)
  title: string;        // 标题
  category: string;     // 分类 (封面/封底/自定义)
  content: string;      // HTML正文内容
  blocks?: ContentBlock[]; // 结构化块数组(可选)
  date?: string;
  issueText?: string;   // 期号
  dateText?: string;    // 日期文本
  coverImage?: string;  // 封面图(base64)
  backImage?: string;   // 封底图(base64)
  scale/posX/posY?: number; // 图片定位
  pdfData?: string;     // PDF附件(base64)
  abstract?: string;    // 摘要
  tags?: string[];      // 标签
  isPublished?: boolean;
  order?: number;       // 排序权重
  fontSize/lineHeight?: number;
}
```

### ContentBlock (14种块类型)
paragraph | heading(1-6) | image | video | audio | pdf | blockquote | list(ordered/unordered) | table | code | hr | figure | rawHtml

## 开发命令

```bash
# 启动开发服务器 (BFF代理在前端代理后端)
npm run dev        # 前端:3000 + BFF:3001

# 构建生产版本
npm run build      # 输出到dist/

# 生产启动 (同时托管前端静态+API代理)
npm start          # node server.js (端口3001)

# 测试
npm test           # vitest run
npm run test:watch # 监听模式
npm run test:coverage # 覆盖率报告

# 后端开发
npm run server     # 仅启动BFF代理
npm run server:dev # nodemon热重载
```

## 环境变量 (.env.local)

```env
DEEPSEEK_API_KEY=sk-xxx           # DeepSeek API密钥
PROXY_SECRET=sws-gongfa-proxy-xxx # BFF代理认证密钥
```

## 设计模式

1. **门面模式**: `src/services/export/index.ts` 统一导出所有导出功能
2. **组合模式**: `ArticleRenderer` 根据类别分发到 Cover/Back/Content 渲染器
3. **策略模式**: `src/services/pdf/strategies/` 多种PDF抽字策略
4. **双重引擎**: RSS抓取对应两种爬取引擎(rss2json + AllOrigins代理)
5. **内容-显示分离**: content(HTML) + blocks(结构化) 双存储，按需使用

## 关键约定

- **封面/封底**: id任意但category固定为'封面'/'封底'，order强制置顶/置底
- **图片压缩**: 统一转为WebP格式，默认maxWidth=1200, quality=0.8
- **文章ID**: 使用 `Date.now() * 1000 + 计数器` 生成，不依赖数据库自增
- **排序**: 普通文章按 order 升序，封面 order=0, 封底 order=99999
- **数据存储**: 文章以 `article-{id}` 为key存IndexedDB，配置以`config-{key}`存储
