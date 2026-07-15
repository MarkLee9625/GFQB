import type { Article } from '../../src/types';

export interface ArticleRendererBaseProps {
  article: Article;
  logo?: string;
  useAlternateDesign?: boolean;
}
