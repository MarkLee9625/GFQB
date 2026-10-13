---
name: db-inspect
description: 数据库检查 — 查看/修复/导出 IndexedDB 数据
---

检查和操作浏览器的 IndexedDB 存储。

## 数据库结构

| 数据库 | 说明 |
|--------|------|
| `SWS_DATABASE_REACT`（v4） | 主数据库，store=`journal_store`（文章/配置）+ `media_store`（媒体资产，P0-A 新增） |
| `sws-knowledge-graph-cache` | 知识图谱缓存 |

## 数据键格式
- 文章: `article-{id}`（id 为数字时间戳）
- 配置: `config-{key}`（如 `config-logo`, `config-categories`）
- 媒体: `media_store` 内以**内容哈希**（32 位十六进制）为 key，记录 `{hash, dataUrl, mime, size, refCount, createdAt}`
- 迁移标记: `config-mediaMigratedAt`（存在即表示旧库媒体拆表已完成）
- 元数据: `SWS_JOURNAL_DATA`（logo、sidebarMeta）
- 分类: 存储在 `localStorage['SWS_CATS_REACT']`

## 媒体库检查（P0-A 媒体引用协议）

文章字段里不再内嵌 base64 媒体，只存 `sws-media://{hash}` 引用；实体在 `media_store` 中**只存一份**（同图多篇共用）。

| 症状 | 排查 |
|------|------|
| 图片不显示（阅读态） | 看文章字段里的 `sws-media://{hash}` 是否能在 `media_store` 找到同 key 记录；缺失即引用悬空（正常流程不会出现：写侧"先写媒体、再写文章"） |
| 媒体库体积只增不减 | 属预期：孤儿媒体**只统计不物理删除**。需要时调 `recalcMediaRefs({ deleteOrphans: true })`（默认关闭，确认无遗漏再启用） |
| 迁移没跑 | 检查 `config-mediaMigratedAt`；迁移在首屏加载期执行，幂等可中断续跑，失败会在控制台留 `[媒体库] 迁移失败` 警告，下次启动自动重试 |
| 需要真实 data URL 做排查/导出 | 调 `services/mediaStore.ts` 的 `resolveMediaValue` / `resolveArticleMediaData` / `resolveArticlesMediaData`，**不要**直接把引用当 URL 用 |

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
