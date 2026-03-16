---
name: performance-optimization
description: 性能优化指南，重点关注内存管理（Blob URLs）和渲染性能。当应用出现卡顿或内存泄漏问题时使用。
---

# 性能优化指南 (Performance Optimization)

此 Skill 针对项目的特定性能瓶颈（如大型文件处理、React 渲染）提供解决方案。

## 何时使用

- 处理视频、PDF 或大型图片上传/导出时
- 页面响应变慢或浏览器内存占用过高时
- 编写复杂的交互组件时

## 1. 内存管理 (关键: Blob URL)

本项目处理大量媒体文件，Blob URL 的管理至关重要。

### 规则：创建必须清理
```typescript
// ❌ 错误做法：创建后不管
const url = URL.createObjectURL(file);
setImageSrc(url);

// ✅ 正确做法：使用 useEffect 清理
useEffect(() => {
  if (!file) return;
  
  const url = URL.createObjectURL(file);
  setImageSrc(url);
  
  // 组件卸载或 file 变化时清理
  return () => {
    URL.revokeObjectURL(url);
  };
}, [file]);
```

### 工具: `useBlobManager`
请检查项目中的 `src/hooks/useBlobManager.ts`（如文档所述），优先使用它来统一管理 Blob 生命周期，避免手动维护带来的泄漏泄漏风险。

## 2. 多媒体渲染优化 (Media Extraction)
处理打印或导出长图大文件时，大量动态资源会导致浏览器 OOM（Out Of Memory）。
- **静态降维**：对页面内的 Video 和 GIF，在执行导出或打印操作前，利用 Canvas 提取它们的第一帧 (`extractVideoFirstFrame`, `extractGifFirstFrame`)，将其替换为静态 `<img>` 标签。这不仅保证了打印的一致性，还极大地减轻了渲染引擎的内存压力。

## 3. React 渲染优化

### 避免不必要的重渲染
- **useMemo**: 缓存复杂的计算结果（如过滤大型列表）。
- **useCallback**: 缓存传递给子组件的回调函数，防止子组件无意义重渲染（尤其是配合 React.memo 使用时）。

```tsx
const filteredList = useMemo(() => {
  return heavyComputation(items, filter);
}, [items, filter]);

const handleItemClick = useCallback((id: string) => {
  // ... logic
}, []); // 依赖项为空表示函数引用永远不变
```

### 列表虚拟化
如果需要渲染长列表（>100 项），考虑使用 `react-window` 或 `react-virtuoso` 仅渲染可视区域的元素。

## 3. 资源懒加载 (Lazy Loading)

对于非首屏的大型组件或路由，使用 `React.lazy` 和 `Suspense`。

```tsx
const HeavyChart = React.lazy(() => import('./HeavyChart'));

// 在 JSX 中
<Suspense fallback={<LoadingSpinner />}>
  <HeavyChart data={data} />
</Suspense>
```

## 4. 数据库操作 (IndexedDB)
- **批量处理**: 不要在一个循环中多次调用 `db.put()`。尽量构建一个数组，使用 `db.bulkPut()` 或事务（Transaction）一次性写入。
- **异步非阻塞**: 确保数据库操作不会阻塞 UI 线程。

## 性能监控
- 使用 Chrome DevTools 的 **Performance** 面板录制操作过程，分析 Main Thread 阻塞情况。
- 使用 **Memory** 面板检查 Heap Snapshot，查找未释放的 Detached DOM 节点或 Blob 对象。
