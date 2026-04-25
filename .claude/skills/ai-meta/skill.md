---
name: ai-meta
description: AI 辅助功能 — 生成文章元数据、卷首语、知识图谱、AI选题评审
---

调用 DeepSeek API（通过本地 BFF 代理）执行 AI 任务。

## 前置条件
确保 `.env.local` 中已配置 `DEEPSEEK_API_KEY` 和 `PROXY_SECRET`

## 可用任务

### 1. 生成文章元数据 (`generateArticleMeta`)
- 自动生成标题、摘要、关键词
- 需要先有正文内容
- 调用 `services/aiService.ts` 中的 `generateArticleMeta()`

### 2. 生成卷首语 (`generateForeword`) — [已实现]
- 纵览全刊文章，生成 600-800 字导读
- 输出 HTML 格式，可直接嵌入
- 入口: `useAiFeatures.handleGenerateForeword()`

### 3. 知识图谱 (`extractGlobalKnowledgeGraph`) — [已实现]
- 提取 40-70 个核心技术节点
- 建立概念→工艺→技术/装备的关系链路
- 输出 Canvas 交互式图谱 + 打印用 SVG
- 有 IndexedDB 缓存（同一内容 hash 不重复调用）
- 入口: `useAiFeatures.handleGenerateGraph()`

### 4. AI 选题评审 (`batchEvaluateArticles`) — [已实现]
- 批量评审微信公众号/MD 文章
- 双栏沙盘展示推荐/淘汰结果
- 入口: `AiCurationModal`

### 5. 文本扩写/精简 (`scaleText`)
- 对技术文档进行专业扩写或精简

### 6. 学术文献编译 (`translateAndFormatAcademic`)
- 英文学术论文→中文工法情报报道
- 包含文献来源、核心解析、应用前景

### 注意事项
- AI 响应会包含 `<think>` 推理标签，已内置自动清洗
- JSON 解析有 3 层兜底修复（正则→堆栈→自定义）
- 自动重试 3 次，超时 120s
- 知识图谱有质量校验（孤立节点检测、连通率评估）
