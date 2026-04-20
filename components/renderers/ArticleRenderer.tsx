import React from 'react';
import { Article } from '../../src/types/models';
import { CoverRenderer } from './CoverRenderer';
import { BackRenderer } from './BackRenderer';
import { ContentRenderer } from './ContentRenderer';

export interface ArticleRendererBaseProps {
  article: Article;
  logo?: string;
  useAlternateDesign?: boolean;
}

export interface ArticleRendererEditProps extends ArticleRendererBaseProps {
  mode: 'edit';
  isEditable?: boolean;
  onArticleUpdate?: (id: number, updates: Partial<Article>) => void;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onNext?: () => void;
}

export interface ArticleRendererReadProps extends ArticleRendererBaseProps {
  mode: 'read';
  isEditable?: false;
  onArticleUpdate?: never;
  onImageUpload?: never;
  onNext?: never;
}

export interface ArticleRendererPrintProps extends ArticleRendererBaseProps {
  mode: 'print';
  isEditable?: false;
  onArticleUpdate?: never;
  onImageUpload?: never;
  onNext?: never;
}

export type ArticleRendererProps = 
  | ArticleRendererEditProps 
  | ArticleRendererReadProps 
  | ArticleRendererPrintProps;

/**
 * 统一的文章渲染组件
 * 
 * 核心设计原则：
 * 1. 单一数据源：所有视图（编辑/阅读/打印）都从同一套组件渲染
 * 2. 样式一致性：通过 mode 属性控制行为，确保视觉效果一致
 * 3. 性能优化：阅读版和打印版优化为静态渲染，编辑版支持交互
 * 
 * @example
 * // 编辑模式
 * <ArticleRenderer
 *   article={article}
 *   mode="edit"
 *   onArticleUpdate={handleUpdate}
 *   onImageUpload={handleUpload}
 * />
 * 
 * @example
 * // 阅读模式
 * <ArticleRenderer
 *   article={article}
 *   mode="read"
 * />
 * 
 * @example
 * // 打印模式
 * <ArticleRenderer
 *   article={article}
 *   mode="print"
 * />
 */
export const ArticleRenderer = React.memo<ArticleRendererProps>(({
  article,
  mode,
  logo,
  useAlternateDesign = false,
  onArticleUpdate,
  onImageUpload,
  onNext
}) => {
  // 根据文章类型选择渲染器
  if (article.category === '封面') {
    return (
      <CoverRenderer
        article={article}
        mode={mode}
        useAlternateDesign={useAlternateDesign}
        isEditable={mode === 'edit'}
        onImageUpload={onImageUpload}
        onUpdate={mode === 'edit' ? onArticleUpdate : undefined}
        onNext={mode === 'edit' ? onNext : undefined}
      />
    );
  }

  if (article.category === '封底') {
    return (
      <BackRenderer
        article={article}
        mode={mode}
        useAlternateDesign={useAlternateDesign}
        isEditable={mode === 'edit'}
        onImageUpload={onImageUpload}
        onUpdate={mode === 'edit' ? onArticleUpdate : undefined}
      />
    );
  }

  return (
    <ContentRenderer
      article={article}
      mode={mode}
      logo={logo}
      isEditable={mode === 'edit'}
    />
  );
});

// 导出辅助组件，供 PaperView 等组件迁移时使用
export { CoverRenderer } from './CoverRenderer';
export { BackRenderer } from './BackRenderer';
export { ContentRenderer } from './ContentRenderer';
