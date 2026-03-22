📄 全渠道工法情报矩阵 (Omni-Channel Intelligence Matrix) 开发规划

## 🎯 1. 业务目标与愿景
打破单一微信生态的数据孤岛，构建一个覆盖全球资讯 (RSS)、底层技术 (专利库)、行业权威 (船级社) 的三维数据湖。
通过底层数据结构的统一（Interface Abstraction），让所有外部抓取来的异构数据，都能无缝流入现有的“DeepSeek AI 智能评审流水线”，实现全自动化的高效萃取与入库。

---

## 🏗️ 2. 核心底层改造：统一数据元规范 (Universal Interface)
**目标**：抹平不同数据源的差异，让 AI 评审引擎和 UI 组件只认一种数据格式。

**核心接口重构 (`src/types/intelligence.ts`)：**
```typescript
export type SourceType = 'wechat' | 'rss' | 'patent' | 'aip';

export interface UniversalArticleMeta {
  id: string;
  sourceType: SourceType;  // 区分数据来源
  sourceName: string;      // 来源名称，如 "TradeWinds", "国家专利局", "DNV"
  title: string;           // 统一标题
  content: string;         // 统一正文（HTML/MD/纯文本）
  url?: string;            // 原始链接
  publishDate?: string;    // 发布时间
  // --- 以下为 AI 评审流转字段 (直接复用现有逻辑) ---
  aiSummary?: string;
  decision?: 'recommend' | 'reject' | 'pending';
  reason?: string;
  tags?: string[];
}
🔌 3. 三大维度接入方案 (Data Pipelines)
Phase 1: 维度一 - 全球行业资讯 (RSS 引擎)
业务逻辑：订阅海外造船媒体（MarineLog, TradeWinds）和国内垂直门户的 RSS 资讯流。

技术方案：

在前端使用公共 CORS 代理或 RSS-to-JSON 服务（如 api.rss2json.com）破解跨域限制。

输入：配置一组 RSS Feed URL 列表。

输出：拉取最近 7 天的 <item>，将 <title> 和 <description> 转化为 UniversalArticleMeta。

开发模块：src/services/fetchers/rssFetcher.ts

Phase 2: 维度二 - 硬核工法源泉 (专利检索 API)
业务逻辑：定期拉取“造船+自动化/工艺”相关的最新公开专利。

技术方案：

对接免费的公开专利库 API（如 EPO Open Patent Services 基础版，或国内第三方专利 API 集成服务）。

输入：预设关键词（如 (shipbuilding OR hull) AND (welding OR coating OR robot)）。

输出：将专利名称映射为 title，专利摘要/权利要求书映射为 content。

开发模块：src/services/fetchers/patentFetcher.ts

Phase 3: 维度三 - 权威风向标 (船级社 AiP 抓取)
业务逻辑：追踪 DNV、ABS、CCS 等船级社发布的原则性认可 (AiP) 新闻。

技术方案：

由于船级社官网通常没有标准 API，需编写轻量级的前端爬虫（利用 fetch + DOMParser），或者借助轻量级无头浏览器微服务。

（初始阶段降级方案：寻找船级社的官方 RSS 或新闻聚合 API 替代原生抓取）。

开发模块：src/services/fetchers/aipFetcher.ts

🖥️ 4. UI 融合方案：全渠道总编工作台
对现有的 AiCurationModal.tsx 进行 UI 扩容，使其成为一个多信源控制中心。

顶部数据源切换 Tab：

[📁 微信导入] | [🌐 全球 RSS] | [📜 专利追踪] | [🛡️ 船级社 AiP]

交互逻辑：

当用户切换到【🌐 全球 RSS】时，点击“拉取最新资讯”，系统调用 rssFetcher，瞬间将海外新闻转化为卡片铺满右侧“待评审区”。

卡片 UI 新增来源徽章（Badge）：例如 [MarineLog] 或 [中国专利局]。

核心复用：拉取完成后，用户依然点击那颗紫色的 【🤖 开始 AI 智能评审】 按钮。DeepSeek 照样对这些海外新闻、晦涩专利进行通读、翻译和评分！

📅 5. 实施路线图 (Action Plan)
[底层基建]：重构 WechatArticleMeta 为 UniversalArticleMeta，确保系统兼容多数据源。

[UI 拓宽]：在 AiCurationModal 中增加数据源切换 Tabs，并为卡片增加 sourceType 的视觉区分（不同颜色/图标）。

[插件化开发 - RSS优先]：优先实现 rssFetcher.ts，打通第一个海外数据流，验证架构兼容性。

[专利与AiP接入]：逐步实现专利 API 检索和船级社抓取模块。