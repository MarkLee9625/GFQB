// 核心业务实体定义

export type SpecialCategory = '封面' | '封底';
export type ArticleCategory = SpecialCategory | (string & {});

import type { ContentBlock } from './blocks';

export interface Article {
  id: number;
  title: string;
  category: ArticleCategory;
  content: string;
  date?: string;
  issueText?: string;
  dateText?: string;
  coverImage?: string | null;
  backImage?: string | null;
  scale?: number;
  posX?: number;
  posY?: number;
  pdfData?: string | null;
  /** v2 外壳标记：是否有 PDF 附件（阅读器侧边栏角标用，不进库） */
  hasPdf?: boolean;
  abstract?: string | null;
  tags?: string[];
  isPublished?: boolean;
  order?: number;
  fontSize?: number;
  lineHeight?: number;
  blocks?: ContentBlock[];
}
