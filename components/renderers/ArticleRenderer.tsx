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
  onImageDelete?: () => void;
}

export interface ArticleRendererReadProps extends ArticleRendererBaseProps {
  mode: 'read';
  isEditable?: false;
  onArticleUpdate?: never;
  onImageUpload?: never;
  onNext?: never;
  onImageDelete?: never;
}

export interface ArticleRendererPrintProps extends ArticleRendererBaseProps {
  mode: 'print';
  isEditable?: false;
  onArticleUpdate?: never;
  onImageUpload?: never;
  onNext?: never;
  onImageDelete?: never;
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
 * 3. 性能优化：使用 CSS 类切换主题，避免组件卸载重载
 */
export const ArticleRenderer = React.memo<ArticleRendererProps>((props) => {
  const {
    article,
    mode,
    logo,
    useAlternateDesign = false,
    onArticleUpdate,
    onImageUpload,
    onNext,
    onImageDelete
  } = props;

  const containerClass = useAlternateDesign
    ? 'article-renderer alternate-theme'
    : 'article-renderer default-theme';

  const renderContent = () => {
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
          onImageDelete={onImageDelete}
        />
      );
    }

    if (article.category === '封底') {
      return (
        <BackRenderer
          article={article}
          mode={mode}
          logo={logo}
          useAlternateDesign={useAlternateDesign}
          isEditable={mode === 'edit'}
          onImageUpload={onImageUpload}
          onUpdate={mode === 'edit' ? onArticleUpdate : undefined}
          onImageDelete={onImageDelete}
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
  };

  return (
    <div className={containerClass}>
      {renderContent()}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.article.id === nextProps.article.id &&
    prevProps.article.content === nextProps.article.content &&
    prevProps.article.coverImage === nextProps.article.coverImage &&
    prevProps.article.backImage === nextProps.article.backImage &&
    prevProps.useAlternateDesign === nextProps.useAlternateDesign &&
    prevProps.mode === nextProps.mode &&
    prevProps.logo === nextProps.logo
  );
});

export { CoverRenderer } from './CoverRenderer';
export { BackRenderer } from './BackRenderer';
export { ContentRenderer } from './ContentRenderer';
