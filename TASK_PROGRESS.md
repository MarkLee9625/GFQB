# 任务进度：恢复系统滚动域

## 目标
恢复 `MainLayout` 内容区的独立滚动能力，并确保其子组件 (`Editor` / `PaperView`) 是"流式展开"而非被硬性限制为 `h-full`，从而自然撑开内容区触发滚动条。

## 执行步骤

- [x] 分析当前文件状态：MainLayout.tsx、Editor.tsx、PaperView.tsx
- [x] 修改 MainLayout.tsx：将内容区包裹 div 的 `overflow-hidden` 改为 `overflow-y-auto`
- [x] 检查 Editor.tsx 最外层 div 是否有 `h-full`，修改为 `min-h-full` 或删除
- [x] 检查 PaperView.tsx 最外层 div 是否有 `h-full`，修改为 `min-h-full` 或删除
- [ ] 验证修改结果，确保没有双重滚动条

## 约束条件
- 绝对禁止触碰上一步修复好的 PDF 容器 `min-h-[800px]` 以及 Footer 的 `shrink-0` 保护
- 仅修复滚动链路上下文
