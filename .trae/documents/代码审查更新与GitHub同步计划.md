# 计划：代码审查、更新文档与GitHub同步

## 任务概述
1. 检查并修复代码中的注释乱码现象
2. 检查所有未记录的更新并更新到 README（目录树、内容、版本号）
3. 上传最新代码到 GitHub 并切回主支

---

## 任务一：修复注释乱码

### 目标文件
- `src/services/export/print/printableSkeleton.ts` — 多处中文注释显示为乱码

### 乱码示例
- `姝枃鏂囩珷鍦ㄩ瑙堜腑涓嶅己鍒?97mm楂樺高度` — UTF-8 编码被错误解码

### 修复步骤
1. 读取 `printableSkeleton.ts` 文件
2. 定位所有乱码注释
3. 将乱码替换为正确的中文或英文注释
4. 验证修复结果

---

## 任务二：更新 README 文档

### 2.1 识别未记录的更新

根据 `git status` 和 `git log`，当前分支 `feature/refactor-article-renderer` 相比 `main` 有以下变更：

#### 新增文件（Untracked）
- `components/editor/` — 编辑器相关 hooks
  - `useEditorCommands.ts`
  - `useEditorKeyboard.ts`
  - `useEditorState.ts`
  - `useFileUpload.ts`
  - `useImageToolbar.ts`
  - `useSelectionManager.ts`
- `components/renderers/SharedComponents.tsx`
- `hooks/useAiFeatures.ts`
- `hooks/useAppInitialization.ts`
- `hooks/useArticleNavigation.ts`
- `hooks/useExportManager.ts`
- `hooks/useImportManager.ts`
- `hooks/useKeyboardShortcuts.ts`
- `hooks/usePanZoom.ts`
- `services/graphCache.ts`
- `src/components/renderers/` — blocks 相关
- `src/constants.ts`
- `src/services/export/pdf/` — PDF 导出模块
  - `PdfArticlePage.tsx`
  - `PdfBackCover.tsx`
  - `PdfCover.tsx`
  - `PdfDocument.tsx`
  - `PdfTOC.tsx`
  - `index.ts`
  - `pdfStyles.ts`
- `src/services/export/print/` — 打印导出模块
  - `printableSkeleton.ts`
- `src/services/export/reader/` — 阅读器导出模块
  - `clientScript.ts`
  - `readerSkeleton.ts`
  - `readerTemplates.ts`
- `src/types/blocks.ts`
- `src/types/index.ts`
- `src/utils/blockParser.test.ts`
- `src/utils/blockParser.ts`
- `src/utils/encoding.ts`
- `.trae/documents/print-feature-review-and-optimization.md`

#### 已修改文件（Modified）
- `App.tsx`
- `components/CategoryManagerModal.tsx`
- `components/Editor.tsx`
- `components/ExportOptionsModal.tsx`
- `components/Icons.tsx`
- `components/KeyboardShortcutsHelpModal.tsx`
- `components/LoadingOverlay.tsx`
- `components/NavigationCapsule.tsx`
- `components/PaperView.tsx`
- `components/Sidebar.tsx`
- `components/Toolbar.tsx`
- `components/renderers/ArticleRenderer.tsx`
- `components/renderers/BackRenderer.tsx`
- `components/renderers/ContentRenderer.tsx`
- `components/renderers/CoverRenderer.tsx`
- `hooks/useBlobManager.ts`
- `hooks/useJournal.ts`
- `hooks/useMemoryMonitor.ts`
- `index.html`
- `package.json`
- `scripts/post-build.js`
- `server.js`
- `services/aiService.ts`
- `services/db.ts`
- `src/__tests__/testSetup.ts`
- `src/components/AiCurationModal.tsx`
- `src/index.css`
- `src/services/export/assets.ts`
- `src/services/export/compression.ts`
- `src/services/export/index.ts`
- `src/services/export/pdfComponents.tsx`
- `src/services/export/pdfEngine.ts`
- `src/services/export/print.ts`
- `src/services/export/reader.ts`
- `src/services/export/templates.ts`
- `src/services/export/utils/media.ts`
- `src/services/fetchers/rssFetcher.ts`
- `src/services/pdf/index.ts`
- `src/types/models.ts`
- `src/types/ui.ts`
- `src/utils/fileHelpers.ts`
- `src/utils/graphRenderer.ts`
- `src/utils/pasteCleaner.ts`
- `styles/article-renderer.css`
- `vite-env.d.ts`
- `vite.config.ts`
- `vitest.config.ts`
- `.env.example`
- `.gitignore`

#### 已删除文件（Deleted）
- `CODE_REVIEW_PHASE2.md`
- `REFACTOR_FINAL_REPORT.md`
- `REFACTOR_PROGRESS.md`
- `ai-upgrade-plan.md`
- `components/PaperView.backup.tsx`
- `extract-func.mjs`
- `extract-function.js`
- `extract-simple.mjs`
- `extract.mjs`
- `metadata.json`
- `services_aiService_full_old.ts`
- `services_aiService_full_old_utf8.ts`
- `services_aiService_recovery.ts`
- `services_aiService_recovery_utf8.ts`
- `services/aiService.ts.backup`
- `src/services/export/blobCache.ts`
- `src/services/export/data.ts`
- `tailwind.config.js.bak`
- `test-graph.js`
- `test-graph.ts`
- `test_abstract_extraction.js`
- `test_pdf_extraction.js`
- `types.ts`
- 以及多个中文文档文件

### 2.2 核心更新摘要

根据提交历史 `feat: Phase 2 完成 - 重构 Editor 组件使用 ArticleRenderer`，主要更新包括：

1. **编辑器组件重构**：将 Editor 组件重构为使用 ArticleRenderer
2. **组件拆分**：新增多个编辑器相关 hooks（useEditorCommands, useEditorKeyboard, useEditorState, useFileUpload, useImageToolbar, useSelectionManager）
3. **渲染器拆分**：ArticleRenderer、CoverRenderer、BackRenderer、ContentRenderer 独立组件
4. **导出模块重构**：拆分为 pdf/、print/、reader/ 子目录
5. **类型系统增强**：新增 blocks.ts 类型定义
6. **工具函数新增**：blockParser、encoding 等
7. **核心 hooks 新增**：useAiFeatures、useAppInitialization、useArticleNavigation、useExportManager、useImportManager、useKeyboardShortcuts、usePanZoom

### 2.3 README 更新清单

#### 【必须】目录树更新
1. 更新 `.trae/skills/` 路径（从 `.agent/skills/` 迁移）
2. 新增 `components/editor/` 及子文件
3. 新增 `hooks/` 相关文件
4. 新增 `components/renderers/SharedComponents.tsx`
5. 更新 `src/services/export/` 子目录结构（pdf/, print/, reader/）
6. 更新 `src/types/` 添加 blocks.ts
7. 更新 `src/components/` 目录结构
8. 清理已删除文件的引用
9. 清理已废弃的备份文件引用（tailwind.config.js.bak, metadata.json 等）

#### 【必须】关键组件说明更新
1. **编辑器 (`components/Editor.tsx`)**: 更新描述，说明已重构为使用 ArticleRenderer
2. **渲染引擎 (`components/PaperView.tsx`)**: 说明现在使用 ArticleRenderer 等独立组件
3. **核心 Hooks**: 添加对新 Hooks 的说明（useExportManager, useImportManager, useAiFeatures 等）
4. **导出服务**: 更新说明，使用新的 pdf/, print/, reader/ 模块化结构

#### 【必须】技术机制更新
1. **离线阅读版导出原理**: 更新 post-build.js 相关描述
2. **AI 全渠道情报矩阵**: 确认描述与当前代码一致

#### 【必须】更新版本号和 Changelog
在 Changelog 顶部添加新版本记录：

```
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
```

#### 【必须】更新最后更新日期
将 `最后更新：2026-04-15` 更新为 `最后更新：2026-04-20`

---

## 任务三：GitHub 同步

### 3.1 提交当前更改

```bash
# 1. 添加所有更改到暂存区
git add .

# 2. 提交更改
git commit -m "feat: Phase 2 完成 - 重构 Editor 组件使用 ArticleRenderer"
```

### 3.2 推送到远程

```bash
# 推送当前分支
git push origin feature/refactor-article-renderer
```

### 3.3 切换回主支并合并

```bash
# 1. 切换到 main 分支
git checkout main

# 2. 合并 feature 分支
git merge feature/refactor-article-renderer

# 3. 推送 main 分支
git push origin main
```

### 3.4 可选：删除功能分支

```bash
git branch -d feature/refactor-article-renderer
```

---

## 实施顺序

1. ✅ 修复 printableSkeleton.ts 中的注释乱码
2. ✅ 更新 README.md 目录树
3. ✅ 更新 README.md 关键组件说明
4. ✅ 更新 README.md 技术机制描述
5. ✅ 更新 README.md 版本号和 Changelog
6. ✅ 更新 README.md 最后更新日期
7. ✅ Git add + commit
8. ✅ Git push + merge to main
