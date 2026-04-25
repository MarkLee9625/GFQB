export type SourceType = 'wechat' | 'rss' | 'patent' | 'aip';

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
}
