export type SourceType = 'wechat' | 'rss' | 'patent' | 'aip';

export interface UniversalArticleMeta {
  id: string;
  sourceType: SourceType;  // 区分数据来源
  sourceName: string;      // 来源名称，如 "微信公众号", "TradeWinds", "专利局"
  title: string;
  content: string;         // 完整正文
  url?: string;            // 原始链接
  publishDate?: string;    // 发布时间
  // --- AI 评审流转字段 ---
  aiSummary?: string;
  decision?: 'recommend' | 'reject' | 'pending';
  reason?: string;
  tags?: string[];
}