# 工法情报编辑器 - 隐藏Bug与体验问题排查修复计划

## 审查范围
对应用经过多轮重构后的核心代码进行全面审查，识别隐藏Bug和影响使用体验的代码问题。

---

## 🔴 严重Bug（必须修复）

### 1. App.tsx 键盘快捷键重复绑定 — Ctrl+S 执行两次
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L241-L286)
- **问题**: `Ctrl+S` 快捷键在 `handleKeyDown` 中被定义了**两次**（第241行和第277行），第二次会覆盖第一次的逻辑，导致导出行为不一致。第一个调用 `handleExport(false)`，第二个在有编辑器打开时只打印日志，否则弹 alert。
- **影响**: 用户按 Ctrl+S 时行为不可预测，可能触发导出也可能只弹提示
- **修复**: 删除重复的 Ctrl+S 分支，合并逻辑

### 2. App.tsx useEffect 依赖缺失 — handleExport/handleDelete 等闭包陷阱
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L229-L334)
- **问题**: 键盘快捷键的 `useEffect` 依赖列表是 `[currentId, isEditorOpen, isCatManagerOpen, showShortcutsHelp]`，但回调内部使用了 `handleExport`、`handleDelete`、`toggleReadingMode` 等函数，这些函数不在依赖列表中。由于闭包捕获，这些函数可能引用过期的 state。
- **影响**: 快捷键操作可能使用过期的状态，导致行为异常
- **修复**: 将缺失的函数加入依赖列表，或使用 `useCallback` 稳定化这些函数

### 3. useJournal.ts — createArticle 的 ID 冲突风险
- **文件**: [useJournal.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useJournal.ts#L137)
- **问题**: `id: Date.now()` 在快速连续创建文章时可能产生相同 ID（毫秒级精度不够）。虽然 `setArticles` 会立即触发，但如果用户快速点击"新建"或 AI 批量创建，可能冲突。
- **影响**: 文章数据互相覆盖
- **修复**: 使用 `Date.now() + Math.random()` 或递增计数器确保唯一性

### 4. PaperView.tsx — useBlobUrl 在渲染期间调用 setState
- **文件**: [PaperView.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/PaperView.tsx#L29-L33)
- **问题**: `useBlobUrl` hook 在渲染期间直接调用 `setPrevDataUrl` 和 `setBlobUrl`，这在 React 严格模式下会导致双重渲染，且属于反模式。虽然注释说"同步更新防止闪烁"，但应使用 `useSyncExternalStore` 或 `useMemo` 替代。
- **影响**: React 18+ 严格模式下可能导致无限渲染循环或性能问题
- **修复**: 改用 `useMemo` 计算 blobUrl，避免渲染期 setState

### 5. Editor.tsx — handleSave 中 Blob URL 还原逻辑不完整
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L760-L792)
- **问题**: 存盘时只还原了 `<img>` 标签的 blob URL，但 PDF 页面图片也使用 blob URL（通过 `blobManager.getBlobUrl`），这些 blob URL 同样记录在 `blobToDataMap` 中。如果 PDF 转图片后的 blob URL 出现在 `<img>` 标签中，还原逻辑应该能覆盖，但 `video` 和 `audio` 的 `src` 属性没有被还原（虽然它们用的是 data URL 而非 blob URL，但逻辑不统一）。
- **影响**: 如果未来有视频/音频使用 blob URL，存盘后数据会丢失
- **修复**: 统一还原所有 `src` 属性中的 blob URL

### 6. Editor.tsx — handleFile 中 PDF 处理的 setIsProcessing 双重设置
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L641-L755)
- **问题**: `handleFile` 在外层 `setIsProcessing(true)`（第641行），然后在 PDF 转图片分支内又 `setIsProcessing(true)`（第682行），finally 中 `setIsProcessing(false)`（第730行）。但外层的 finally（第749行）也会 `setIsProcessing(false)`，导致处理状态提前结束。
- **影响**: PDF 转图片过程中，loading 状态可能提前消失
- **修复**: 移除内层重复的 `setIsProcessing` 调用，或使用计数器管理

### 7. aiService.ts — PROXY_SECRET 硬编码在前端代码中
- **文件**: [aiService.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/services/aiService.ts#L11)
- **问题**: `const PROXY_SECRET = 'my-super-secret-key'` 硬编码在前端代码中，任何人查看源码都能获取这个密钥，可以绕过 BFF 代理直接调用 API。
- **影响**: 安全漏洞，API 可被滥用
- **修复**: 移除前端密钥，改用 HttpOnly Cookie 或服务端 Session 验证

---

## 🟡 中等问题（影响体验）

### 8. App.tsx — handleSaveArticle 双重关闭编辑器
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L364-L372)
- **问题**: `handleSaveArticle` 中，新建文章成功后 `setIsEditorOpen(false)`（第369行），然后无论成功与否又无条件执行 `setIsEditorOpen(false)`（第371行）。虽然功能上不影响，但新建失败时也会关闭编辑器，用户丢失编辑内容。
- **影响**: 新建文章失败时编辑器被关闭，用户输入丢失
- **修复**: 仅在成功时关闭编辑器

### 9. App.tsx — saveToDB 在每次 articles/logo/sidebarMeta 变化时触发
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L341-L343)
- **问题**: `useEffect` 监听 `[articles, logo, sidebarMeta, loading]`，每次变化都调用 `saveToDB`。但 `articles` 是数组引用，即使内容没变也可能因引用不同而触发。而且 `useJournal` 已经有 `debouncedSaveArticle` 做单文章保存，这里又做全量保存，造成双重写入。
- **影响**: 性能浪费，可能导致 IndexedDB 写入竞争
- **修复**: 移除此全量保存逻辑（useJournal 已负责保存），或添加 debounce

### 10. PaperView.tsx — useEffect 依赖列表包含非稳定引用
- **文件**: [PaperView.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/PaperView.tsx#L227)
- **问题**: 全局 mouseup 事件的 useEffect 依赖列表包含 `hasMoved.current`、`zoom.x`、`zoom.y`，其中 `hasMoved.current` 是 ref 的读取（不应出现在依赖中），而 `zoom.x` 和 `zoom.y` 在拖拽过程中频繁变化，导致事件监听器不断重新绑定。
- **影响**: 拖拽封面/封底图片时性能下降，事件监听器频繁重建
- **修复**: 使用 `useRef` 存储最新值，将 useEffect 依赖精简为 `[isDragging]`

### 11. PaperView.tsx — wheel 事件监听器依赖 zoom 导致频繁重建
- **文件**: [PaperView.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/PaperView.tsx#L232-L255)
- **问题**: wheel 事件的 useEffect 依赖 `[isEditMode, article, zoom, onUpdate]`，其中 `zoom` 在每次滚轮缩放时都会变化，导致事件监听器被移除再重新添加。
- **影响**: 滚轮缩放体验卡顿
- **修复**: 使用 `useRef` 存储 zoom 的最新值，将 zoom 从依赖中移除

### 12. Editor.tsx — contentEditable 的 innerHTML 直接设置导致光标丢失
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L106-L108)
- **问题**: `useEffect` 中当 `isOpen` 或 `article` 变化时，直接设置 `contentRef.current.innerHTML = article.content || ''`。这在编辑过程中如果触发（例如外部更新了文章），会完全替换 DOM 内容，导致光标位置丢失和撤销栈清空。
- **影响**: 编辑中如果文章被外部更新，用户当前编辑内容会被覆盖
- **修复**: 仅在文章 ID 变化时才重置 innerHTML

### 13. Editor.tsx — handleKeys 的依赖包含 formData 导致频繁重绑定
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L266)
- **问题**: `handleKeys` 的 useEffect 依赖 `[isOpen, formData, onSave]`，其中 `formData` 在每次输入时都会变化，导致键盘事件监听器频繁重建。
- **影响**: 输入时性能开销增大
- **修复**: 使用 `useRef` 存储 formData 的最新值

### 14. useInView.ts — options 对象引用不稳定导致 Observer 频繁重建
- **文件**: [useInView.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useInView.ts#L24)
- **问题**: `options` 作为 useEffect 的依赖，但每次父组件渲染时都会创建新的 options 对象（即使值相同），导致 IntersectionObserver 被频繁销毁重建。
- **影响**: LazyImage 组件的懒加载观察器频繁重建，可能导致图片闪烁
- **修复**: 使用 `useMemo` 稳定化 options，或仅依赖 options 的具体属性值

### 15. Sidebar.tsx — 拖拽排序在搜索模式下仍然可用
- **文件**: [Sidebar.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Sidebar.tsx#L131)
- **问题**: `draggable={!searchQuery && ...}` 在搜索模式下禁用了拖拽，但 `handleDrop` 中使用 `articles`（完整列表）而非 `displayArticles`（过滤后列表）进行重排，拖拽后的索引计算可能不正确。
- **影响**: 虽然搜索模式下已禁用拖拽，但如果未来启用，索引计算会出错
- **修复**: 确认搜索模式下拖拽确实被禁用（已确认），无需修改但建议添加注释

### 16. App.tsx — handleImport 中 Base64 解码使用已弃用的 escape/unescape
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L92-L93)
- **问题**: `decodeURIComponent(escape(atob(b64Data)))` 使用了已弃用的 `escape()` 函数，这是将 Latin1 编码的 Base64 解码为 UTF-8 的经典 hack，但在某些浏览器中可能行为不一致。
- **影响**: 含非 ASCII 字符（如中文）的导入数据可能解码失败
- **修复**: 使用 TextDecoder API 替代：`new TextDecoder().decode(Uint8Array.from(atob(b64Data), c => c.charCodeAt(0)))`

### 17. App.tsx — 初始化时 db.init() 被调用两次
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L125) 和 [useJournal.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useJournal.ts#L55)
- **问题**: App.tsx 的 `init` 函数中调用 `db.init()`（第125行），同时 `useJournal` 的 `load` 函数中也调用 `db.init()`（第55行）。两个初始化逻辑并行执行，可能导致竞态条件。
- **影响**: 数据库连接可能被重复初始化，虽然 DBService 有状态检查，但存在微妙的竞态
- **修复**: 统一由 useJournal 负责初始化，App.tsx 中移除重复的 db.init() 调用

### 18. db.ts — save/load 使用不同的 key 格式
- **文件**: [db.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/services/db.ts)
- **问题**: App.tsx 使用 `db.save(CONSTANTS.KEY, ...)` 保存全局配置（key = "SWS_JOURNAL_DATA"），而 useJournal 使用 `db.saveArticle(article)` 保存单篇文章（key = "article-{id}"）。两套存储体系并存，全局配置（logo、sidebarMeta）和文章数据分开存储，但 App.tsx 的 saveToDB 仍然保存整个 `{ data, logo, sidebarMetaText }` 对象，而 useJournal 的 `getArticles` 只读取 `article-*` 键。这意味着 App.tsx 保存的 data 数组不会被 useJournal 读取。
- **影响**: App.tsx 保存的全量数据是冗余的，useJournal 不会读取它；但 logo 和 sidebarMeta 仍然依赖这个全局 key
- **修复**: 明确分离关注点，logo/sidebarMeta 使用 `config-*` 键存储

---

## 🟢 轻微问题（代码质量/潜在风险）

### 19. Editor.tsx — execCommand 已弃用
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L268-L270)
- **问题**: `document.execCommand` 已被 W3C 标记为弃用，未来浏览器可能移除支持。
- **影响**: 长期维护风险
- **修复**: 短期无需修改（目前所有主流浏览器仍支持），长期考虑迁移到 Input Level 2 API

### 20. Editor.tsx — handleAutoIndent 中的 DOM 操作与 React 状态不同步
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L272-L350)
- **问题**: `handleAutoIndent` 直接操作 DOM（创建 `<p>` 元素、设置 style），然后通过 `setFormData` 同步 React 状态。这种混合模式容易导致状态不一致。
- **影响**: 在某些边缘情况下，React 重渲染可能覆盖 DOM 操作
- **修复**: 这是 contentEditable 的固有问题，短期难以根本解决，但应确保关键操作后及时同步状态

### 21. useBlobManager.ts — 全局缓存无上限
- **文件**: [useBlobManager.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/hooks/useBlobManager.ts)
- **问题**: `globalBlobCache` 是一个无上限的 Map，虽然有 5 分钟过期清理，但在大量图片/PDF 操作时，短时间内可能积累大量缓存。
- **影响**: 内存占用可能过高
- **修复**: 添加最大缓存条目数限制（如 100 条），超出时淘汰最久未使用的

### 22. App.tsx — postMessage 使用 '*' 作为 targetOrigin
- **文件**: [App.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/App.tsx#L211)
- **问题**: `iframe.contentWindow.postMessage({...}, '*')` 使用通配符目标源，任何域的页面都能接收消息。
- **影响**: 安全风险，恶意 iframe 可能拦截消息
- **修复**: 使用具体的 origin（如 `window.location.origin`）

### 23. AiCurationModal.tsx — "强制采纳" 按钮无功能实现
- **文件**: [AiCurationModal.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/components/AiCurationModal.tsx#L291-L293)
- **问题**: "强制采纳" 按钮没有绑定 onClick 处理函数，`manualUrl` 状态虽然被管理但没有被使用。
- **影响**: 用户点击按钮无反应，功能缺失
- **修复**: 实现手动 URL 导入功能，或移除该按钮

### 24. PaperView.tsx — 杂志风封底硬编码了年份 "© 2025"
- **文件**: [PaperView.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/PaperView.tsx#L637)
- **问题**: 杂志风封底设计中的版权年份硬编码为 "© 2025"，不会随时间更新。
- **影响**: 2026年及以后导出的文档显示错误年份
- **修复**: 使用 `new Date().getFullYear()` 动态生成

### 25. Editor.tsx — 标签输入的 onBlur 和 onKeyDown 逻辑重复
- **文件**: [Editor.tsx](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/components/Editor.tsx#L1134-L1158)
- **问题**: 标签输入的 `onBlur` 和 `onKeyDown` 都有添加标签的逻辑，但分隔符处理不一致。`onBlur` 用空格分隔（`val.split(' ')`），而 `onKeyDown` 用空格/逗号/回车但逐个添加。这导致失焦时如果输入了 "A,B" 会创建一个 "A,B" 标签而非两个。
- **影响**: 标签输入体验不一致
- **修复**: 统一分隔符处理逻辑

### 26. pdfEngine.ts — isValidPdfData 的正则校验过于严格
- **文件**: [pdfEngine.ts](file:///c:/Users/k1073/OneDrive%20-%20stu.just.edu.cn/%E5%89%8D%E7%AB%AF%E9%A1%B9%E7%9B%AE/%E5%B7%A5%E6%B3%95%E6%B3%95%E6%83%85%E6%8A%A5%E6%94%B6%E9%9B%86%E7%B3%BB%E7%BB%9F/%E5%B7%A5%E6%B3%95%E6%83%85%E6%8A%A5%E7%BC%96%E8%BE%91%E5%99%A8/src/services/export/pdfEngine.ts#L37-L52)
- **问题**: `isValidPdfData` 先用正则 `/^[A-Za-z0-9+/]+={0,2}$/` 校验，但 PDF 的 base64 数据通常包含 data URI 前缀（如 `data:application/pdf;base64,`），这个前缀会导致正则校验失败。
- **影响**: 带有 data URI 前缀的 PDF 数据会被判定为无效，导致 PDF 附件合并失败
- **修复**: 在校验前先剥离 data URI 前缀

---

## 📋 修复优先级排序

| 优先级 | 编号 | 问题 | 影响程度 |
|--------|------|------|----------|
| P0 | #1 | Ctrl+S 快捷键重复绑定 | 功能异常 |
| P0 | #7 | PROXY_SECRET 硬编码 | 安全漏洞 |
| P0 | #26 | isValidPdfData 校验过严 | PDF导出失败 |
| P1 | #2 | useEffect 闭包陷阱 | 快捷键行为异常 |
| P1 | #4 | useBlobUrl 渲染期 setState | 潜在无限循环 |
| P1 | #6 | setIsProcessing 双重设置 | Loading状态异常 |
| P1 | #8 | handleSaveArticle 双重关闭 | 编辑内容丢失 |
| P1 | #16 | escape() 已弃用 | 导入中文数据失败 |
| P1 | #23 | 强制采纳按钮无功能 | 功能缺失 |
| P2 | #3 | ID 冲突风险 | 数据覆盖 |
| P2 | #9 | saveToDB 双重写入 | 性能浪费 |
| P2 | #10 | useEffect 依赖不稳定 | 拖拽卡顿 |
| P2 | #11 | wheel 事件频繁重建 | 缩放卡顿 |
| P2 | #12 | innerHTML 直接设置 | 光标丢失 |
| P2 | #13 | formData 依赖导致重绑定 | 输入性能 |
| P2 | #17 | db.init() 重复调用 | 竞态条件 |
| P2 | #18 | 存储体系混乱 | 数据一致性 |
| P2 | #24 | 硬编码年份 | 显示错误 |
| P2 | #25 | 标签输入逻辑不一致 | 体验问题 |
| P3 | #5 | Blob URL 还原不完整 | 潜在数据丢失 |
| P3 | #14 | useInView options 不稳定 | 图片闪烁 |
| P3 | #19 | execCommand 已弃用 | 长期维护风险 |
| P3 | #20 | DOM 操作与 React 不同步 | 固有限制 |
| P3 | #21 | 全局缓存无上限 | 内存风险 |
| P3 | #22 | postMessage targetOrigin | 安全风险 |

---

## 实施步骤

### 第一轮：P0 严重问题修复（3项）
1. 修复 Ctrl+S 快捷键重复绑定
2. 移除前端硬编码的 PROXY_SECRET，改用环境变量或 Cookie
3. 修复 isValidPdfData 校验逻辑

### 第二轮：P1 重要问题修复（7项）
4. 修复键盘快捷键 useEffect 闭包陷阱
5. 重构 useBlobUrl 避免渲染期 setState
6. 修复 PDF 处理的 setIsProcessing 双重设置
7. 修复 handleSaveArticle 编辑器关闭逻辑
8. 替换 escape() 为 TextDecoder
9. 实现或移除"强制采纳"按钮
10. 修复 Base64 解码中的已弃用 API

### 第三轮：P2 体验优化（10项）
11. 增强 createArticle 的 ID 唯一性
12. 移除 App.tsx 冗余的 saveToDB
13. 优化 PaperView 拖拽/缩放的事件监听器依赖
14. 修复 Editor innerHTML 重置时机
15. 优化 Editor 键盘事件依赖
16. 统一数据库初始化入口
17. 理清存储体系
18. 修复硬编码年份
19. 统一标签输入逻辑
20. 修复 db.init 重复调用

### 第四轮：P3 代码质量提升（6项）
21. 完善 Blob URL 还原逻辑
22. 稳定化 useInView options
23. 添加 useBlobManager 缓存上限
24. 修复 postMessage targetOrigin
25-26. 记录 execCommand 和 contentEditable 的技术债
