export type SourceType = 'wechat' | 'rss' | 'patent' | 'aip' | 'paper';

export interface UniversalArticleMeta {
  id: string;
  sourceType: SourceType;
  sourceName: string;
  title: string;
  content: string;
  url?: string;
  publishDate?: string;
  aiSummary?: string;
  reason?: string;
  tags?: string[];
  decision: 'pending' | 'recommend' | 'reject';
  /** 以下为论文附加元数据（sourceType='paper' 时由 paperFetcher 填充） */
  /** 纯文本摘要，质量门槛与去重判断用；content 中已包含可读排版版 */
  abstract?: string;
  authors?: string[];
  journal?: string;
  year?: number;
  citationCount?: number;
  doi?: string;
}
