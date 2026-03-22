# 📄 全渠道工法情报矩阵 (Omni-Channel Intelligence Matrix) 开发规划 (v2.0)

## 🎯 1. 业务目标与愿景
打破单一微信生态的数据孤岛，构建一个覆盖全球资讯 (RSS)、底层技术 (专利库)、行业权威 (船级社) 的三维数据湖。
同时，**重构系统界面，解决工具栏功能臃肿问题**，打造一个清爽、极其专业的“AI 赛博总编室”工作流。

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
  // --- AI 评审流转字段 ---
  aiSummary?: string;
  decision?: 'recommend' | 'reject' | 'pending';
  reason?: string;
  tags?: string[];
}
🔌 3. 三大维度接入方案 (Data Pipelines)
Phase 1: 全球行业资讯 (RSS 引擎)
技术方案：使用 CORS 代理或 RSS-to-JSON 服务解析海外造船媒体（MarineLog, TradeWinds）和国内垂直门户的 RSS。映射为 UniversalArticleMeta。

Phase 2: 硬核工法源泉 (专利检索 API)
技术方案：对接免费公开专利库 API，预设“船舶+自动化/工艺”关键词，提取专利摘要与权利要求作为正文。

Phase 3: 权威风向标 (船级社 AiP 抓取)
技术方案：编写轻量级爬虫或接入新闻聚合 API，定向追踪 DNV、ABS、CCS 等船级社的 AiP 认证新闻。

🖥️ 4. UI 融合与重构方案 (UI Integration & Toolbar Refactoring)
4.1 工具栏 (Toolbar) 减负与折叠设计【本次新增重点】
目标：解决顶部工具栏按键过多、视觉拥挤的问题，提升排版编辑的专注度。

重构策略：引入下拉菜单（Dropdown Menu）组件。

布局调整：

基础排版区：保留加粗、标题、列表、图片等高频排版按键。

📥 抓取与导入（合并）：将“单篇微信导入”与“本地文档导入”合并为一个下拉组。

🤖 AI 情报中枢（合并）：将极其抢眼的 “AI 智能选题” 和 “🕸️ 提取知识图谱” 合并到一个带有炫彩呼吸灯效果的下拉菜单中。点击展开后，用户可选择进入“选题工作台”或“生成全局图谱”。

4.2 全渠道总编工作台 (AiCurationModal) 扩容
目标：将原本的弹窗升级为多信源控制中心。

顶部数据源切换 Tab：

[📁 微信/MD] | [🌐 全球 RSS] | [📜 专利追踪] | [🛡️ 船级社 AiP]

交互逻辑：

切换 Tab 后，展示对应数据源的操作面板（如 RSS 需显示“拉取最新”按钮）。

抓取回来的数据铺满右侧“待评审区”，并带有来源专属角标（如 [TradeWinds]）。

依然统一使用那一颗 【🤖 开始 AI 智能评审】 按钮进行批量通读和分发。

📅 5. 实施路线图 (Action Plan)
[UI 减负与底座重构]：

优先重构 Toolbar.tsx，引入下拉菜单组件，收纳繁杂按钮，还界面一片清爽。

重构数据类型为 UniversalArticleMeta，修改工作台的顶部，加入多源切换 Tabs。

[插件化开发 - RSS优先]：实现 rssFetcher.ts，打通海外新闻数据流，验证通用数据格式的完美兼容。

[专利与AiP接入]：逐步扩展专利 API 检索和船级社抓取模块。