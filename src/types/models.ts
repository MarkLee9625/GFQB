// 核心业务实体定义

export type MediaType = 'image' | 'video' | 'audio' | 'pdf';
export type ArticleCategory = '封面' | '封底' | string;

export interface Article {
  id: number;
  title: string;
  category: ArticleCategory;
  content: string;
  date?: string;
  // Metadata for Cover/Back
  issueText?: string;
  dateText?: string;
  coverImage?: string | null;
  backImage?: string | null;
  // Zoom state
  scale?: number;
  posX?: number;
  posY?: number;
  // Media
  pdfData?: string | null;
  // PDF摘要
  abstract?: string | null;
  // 拖拽排序顺序
  order?: number;
  // 排版设置
  fontSize?: number;
  lineHeight?: number;
}
