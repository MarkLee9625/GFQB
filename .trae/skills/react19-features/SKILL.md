---
name: react19-features
description: 指导如何使用React 19的新特性，如useTransition、useDeferredValue、useActionState等。
---

# React 19 新特性指南 (React 19 Features)

此 Skill 用于指导如何在项目中正确使用 React 19 的新特性，提升应用性能和开发体验。

## 何时使用

- 升级到 React 19 后
- 需要优化大型状态更新的性能
- 实现更流畅的用户交互
- 简化表单处理逻辑

## 1. useTransition

`useTransition` 允许您将某些状态更新标记为非紧急，从而避免阻塞 UI。

### 基本用法
```tsx
import { useTransition, useState } from 'react';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState([]);

  const handleSearch = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    
    // 将搜索结果更新标记为非紧急
    startTransition(() => {
      // 模拟 API 调用
      setTimeout(() => {
        setResults([`结果 1 for ${newQuery}`, `结果 2 for ${newQuery}`]);
      }, 500);
    });
  };

  return (
    <div>
      <input type="text" value={query} onChange={handleSearch} />
      {isPending && <div>搜索中...</div>}
      <ul>
        {results.map((result, index) => (
          <li key={index}>{result}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 适用场景
- 搜索功能
- 过滤大型列表
- 加载大量数据

## 2. useDeferredValue

`useDeferredValue` 允许您延迟处理某些值的更新，直到紧急更新完成。

### 基本用法
```tsx
import { useDeferredValue, useState, useMemo } from 'react';

function ListComponent({ items }) {
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  const filteredItems = useMemo(() => {
    return items.filter(item => item.includes(deferredFilter));
  }, [items, deferredFilter]);

  return (
    <div>
      <input 
        type="text" 
        value={filter} 
        onChange={(e) => setFilter(e.target.value)} 
      />
      <ul>
        {filteredItems.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 适用场景
- 实时过滤大型列表
- 复杂计算的结果展示
- 依赖于用户输入的昂贵操作

## 3. useActionState

`useActionState` 简化了表单处理逻辑，提供了一种处理异步操作的新方式。

### 基本用法
```tsx
import { useActionState } from 'react';

async function submitForm(previousState, formData) {
  // 模拟 API 调用
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (formData.get('email') === '') {
    return { error: '邮箱不能为空' };
  }
  
  return { success: '提交成功' };
}

function FormComponent() {
  const [state, formAction] = useActionState(submitForm, null);

  return (
    <form action={formAction}>
      <input type="email" name="email" placeholder="请输入邮箱" />
      <button type="submit">提交</button>
      {state?.error && <div style={{ color: 'red' }}>{state.error}</div>}
      {state?.success && <div style={{ color: 'green' }}>{state.success}</div>}
    </form>
  );
}
```

### 适用场景
- 表单提交
- 异步操作处理
- 状态管理简化

## 4. useOptimistic

`useOptimistic` 允许您在等待异步操作完成时，立即更新 UI 以提供更流畅的用户体验。

### 基本用法
```tsx
import { useOptimistic, useState } from 'react';

function LikeButton() {
  const [likes, setLikes] = useState(0);
  
  const [optimisticLikes, addLike] = useOptimistic(
    likes,
    (state, delta) => state + delta
  );

  const handleLike = async () => {
    addLike(1);
    // 模拟 API 调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLikes(prev => prev + 1);
  };

  return (
    <button onClick={handleLike}>
      点赞 ({optimisticLikes})
    </button>
  );
}
```

### 适用场景
- 点赞、收藏等交互
- 购物车操作
- 任何需要立即反馈的异步操作

## 5. Server Components

React 19 增强了对 Server Components 的支持，允许在服务器端渲染组件，减少客户端包大小。

### 基本用法
```tsx
// app/page.tsx (Server Component)
import { db } from '@/lib/db';

export default async function Page() {
  const posts = await db.posts.findMany();
  
  return (
    <div>
      <h1>博客文章</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 适用场景
- 内容展示页面
- 数据密集型应用
- 首屏加载优化

## 6. 其他新特性

### 6.1 改进的错误边界
React 19 改进了错误边界的行为，使其能够捕获更多类型的错误。

### 6.2 简化的 Suspense
React 19 简化了 Suspense 的使用，使其更加直观。

### 6.3 改进的开发者体验
- 更好的错误消息
- 更详细的警告
- 改进的开发工具集成

## 最佳实践

1. **性能优化**：使用 `useTransition` 和 `useDeferredValue` 优化大型状态更新
2. **用户体验**：使用 `useOptimistic` 提供即时反馈
3. **代码简化**：使用 `useActionState` 简化表单处理
4. **服务器渲染**：合理使用 Server Components 提高性能
5. **渐进式采用**：逐步迁移到新特性，而不是一次性重构

## 迁移指南

1. **更新依赖**：将 React 和 React DOM 更新到 19.0.0 或更高版本
2. **代码审查**：检查现有代码是否可以使用新特性优化
3. **测试**：确保所有功能在新版本下正常工作
4. **性能监控**：使用 React DevTools 监控应用性能

## 常见问题

### Q: useTransition 和 useDeferredValue 有什么区别？
**A:** `useTransition` 用于标记状态更新为非紧急，而 `useDeferredValue` 用于延迟处理值的更新。两者都用于优化性能，但适用场景不同。

### Q: Server Components 和 Client Components 有什么区别？
**A:** Server Components 在服务器端渲染，不支持交互和状态，而 Client Components 在客户端渲染，支持交互和状态。

### Q: 如何处理 useActionState 中的错误？
**A:** 您可以在 action 函数中返回错误状态，然后在组件中显示错误信息。