<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SWS 工法情报系统 - 本地运行与部署

此项目包含运行本地应用所需的一切。

在 AI Studio 中查看应用: https://ai.studio/apps/drive/139L7v7pTpQDqBY8nzmA_5yAFOrZDtRwe

## 本地运行

**前提条件:** Node.js

1. 安装依赖:
   `npm install`
2. 在 [.env.local](.env.local) 中设置 `GEMINI_API_KEY` 为您的 Gemini API 密钥
3. 运行应用:
   `npm run dev`

## 优化特性 (v1.0.16)

在不改变现有功能和UI的前提下，已完成以下代码质量和性能优化：

### 🎯 TypeScript 类型系统增强
- 扩展了类型定义，新增了 `MediaType`、`ArticleCategory`、`UploadType` 等类型别名
- 新增了 `ExportOptions`、`FileUploadResult`、`KeyboardShortcut` 等接口
- 增强了整个项目的类型安全性，减少运行时错误

### 🛡️ React Error Boundary 错误处理
- 创建了 `ErrorBoundary.tsx` 和 `DBErrorBoundary.tsx` 两个错误边界组件
- 修复了 React 19.2.3 中类组件的 TypeScript 类型定义问题
- 提供了优雅的错误降级和用户友好的错误提示界面

### 🏗️ 组件架构优化与拆分
- 将大型 `App.tsx` 组件拆分为多个可维护的子组件：
  - `Sidebar.tsx`: 侧边栏导航组件
  - `Toolbar.tsx`: 顶部工具栏组件
  - `NavigationCapsule.tsx`: 导航胶囊组件
  - `LoadingOverlay.tsx`: 加载覆盖层组件
  - `CategoryManagerModal.tsx`: 分类管理模态框组件
  - `KeyboardShortcutsHelpModal.tsx`: 键盘快捷键帮助模态框
- 提高了代码的可读性、可测试性和可维护性

### ⌨️ 键盘快捷键支持
- 实现了全局键盘快捷键系统，支持快速导航和操作
- 添加了快捷键帮助模态框，按 `Ctrl+/` 或 `Cmd+/` 可查看所有可用快捷键
- 快捷键包括：新建文章(`Ctrl+N`)、保存(`Ctrl+S`)、删除(`Delete`)、导航等

### 💾 IndexedDB 数据库优化
- 增强了数据库连接状态管理
- 添加了性能监控和重试逻辑，提高数据库操作的可靠性
- 实现了批量保存操作，减少频繁的数据库写入
- 优化了图片压缩处理，添加了错误处理和回退机制

### ⚡ Vite 构建配置优化
- 更新了构建配置，添加了代码分割配置
- 将依赖项分组为 vendor、editor、services 等 chunk
- 启用了更高级的压缩和目标环境设置，提升生产构建性能

### 🔧 TypeScript 配置优化
- 更新了 TypeScript 配置，启用了更严格的类型检查
- 平衡了类型安全性和开发体验，避免破坏现有代码
- 启用了 `strictNullChecks` 等关键选项

### 🧠 Blob URL 内存管理优化
- 创建了 `useBlobManager` 自定义 Hook
- 实现了 Blob URL 的缓存和过期清理机制
- 防止内存泄漏，优化了大型媒体文件（如图片、PDF）的内存使用

### 🧹 应用内存优化与泄漏防护
- **临时Blob URL管理（App.tsx）**：实现导出功能的临时Blob URL管理，防止内存泄漏
- **文件大小阈值策略（Editor.tsx）**：智能处理大文件，防止内存溢出
- **Object URL与base64智能选择**：根据文件大小自动选择最佳存储格式
- **导出Blob URL短期清理优化**：将导出文件Blob URL清理时间从5分钟缩短为1分钟，更快释放内存
- **定时器清理机制（Editor.tsx）**：防止setTimeout内存泄漏，确保所有定时器被正确清理
- **全局事件监听器清理（PaperView.tsx）**：确保所有事件监听器在组件卸载时正确移除
- **懒加载优化**：实现图片和PDF文件的懒加载，减少初始页面加载内存占用
- **内存监控Hook**：创建 `useMemoryMonitor` 自定义Hook，实时监控JavaScript堆内存使用情况，当内存使用超过阈值（默认100MB）或使用率超过80%时，在控制台发出警告，每10秒检查一次内存使用情况，避免频繁检查影响性能，仅在支持 `performance.memory` API的浏览器（如Chrome）中生效
- **Blob URL缓存管理**：避免重复创建Blob URL，提高性能并减少内存占用

### 🎨 设计模式切换与导出功能
- 添加了杂志风设计作为封面和封底的备用排版选择，提供高级简洁的视觉效果
- 用户可以在原版设计和杂志风设计之间实时切换，切换按钮在编辑模式下可见
- 导出阅读版（HTML格式）时自动包含当前选择的设计模式，确保离线版本与预览一致
- 两种设计均完全支持：原版设计（用户满意的现有排版）和杂志风设计（新的高级简洁排版）

### 📊 代码质量改进
- 所有优化均在不改变现有功能和UI的前提下完成
- 保持了向后兼容性，现有功能完全不受影响
- 提升了应用的稳定性、性能和可维护性

## 详细更新日志
查看 [CHANGELOG.md](CHANGELOG.md) 获取完整的版本历史记录和详细更新说明。
