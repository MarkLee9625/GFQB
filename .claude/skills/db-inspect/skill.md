---
name: db-inspect
description: 数据库检查 — 查看/修复/导出 IndexedDB 数据
---

检查和操作浏览器的 IndexedDB 存储。

## 数据库结构

| 数据库 | 说明 |
|--------|------|
| `SWS_DATABASE_REACT` | 主数据库，store=`journal_store` |
| `sws-knowledge-graph-cache` | 知识图谱缓存 |

## 数据键格式
- 文章: `article-{id}`（id 为数字时间戳）
- 配置: `config-{key}`（如 `config-logo`, `config-categories`）
- 元数据: `SWS_JOURNAL_DATA`（logo、sidebarMeta）
- 分类: 存储在 `localStorage['SWS_CATS_REACT']`

## 常见操作

### 检查文章数量与 ID
查看所有 `article-` 前缀的 key，确认 ID 和 order 为数字类型

### 修复数据
如果文章 ID 或 order 变成了字符串，`sanitizeArticles()` 会清洗：
```typescript
// 在 useJournal.ts 中
const safeId = (!isNaN(numId) && numId !== 0) ? numId : Date.now() + index;
order: Number(a.order) || 0
```

### 清理缓存
知识图谱缓存最多保留 20 条，可通过 `clearGraphCache()` 清空。

### 数据恢复
如果应用崩溃，可以：
1. 在浏览器 DevTools → Application → IndexedDB 中查看原始数据
2. 导出后通过导入功能恢复
