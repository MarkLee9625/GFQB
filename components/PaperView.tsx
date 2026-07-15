import React, { useCallback } from 'react';
import type { Article } from '../src/types';
import { ArticleRenderer } from './renderers';

interface PaperViewProps {
  article: Article | undefined;
  logo: string;
  isEditMode: boolean;
  onUpdate: (id: number, updates: Partial<Article>) => void;
  onImageUpload: (type: 'cover' | 'back') => void;
  onNext: () => void;
  useAlternateDesign: boolean;
  setUseAlternateDesign: (value: boolean) => void;
}

const PaperViewComponent: React.FC<PaperViewProps> = ({
  article,
  logo,
  isEditMode,
  onUpdate,
  onImageUpload,
  onNext,
  useAlternateDesign,
  setUseAlternateDesign
}) => {
  if (!article) return null;

  const handleSetAlternateDesign = useCallback(
    (value: boolean) => setUseAlternateDesign(value),
    [setUseAlternateDesign]
  );

  return (
    <div className="relative">
      {/* 设计模式切换器 */}
      {isEditMode && (
        <div className="DesignToggle fixed top-16 right-4 z-40 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200">
          <span className="text-xs font-medium text-gray-600">设计模式:</span>
          <button
            onClick={() => handleSetAlternateDesign(false)}
            className={`px-2 py-1 text-xs rounded ${!useAlternateDesign ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            原版
          </button>
          <button
            onClick={() => handleSetAlternateDesign(true)}
            className={`px-2 py-1 text-xs rounded ${useAlternateDesign ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            杂志风
          </button>
        </div>
      )}

      {/* 使用统一的 ArticleRenderer 组件 */}
      <ArticleRenderer
        {...({
          article,
          mode: isEditMode ? 'edit' as const : 'read' as const,
          logo,
          isEditable: isEditMode,
          onArticleUpdate: onUpdate,
          onImageUpload,
          onNext,
          useAlternateDesign,
        } as import('./renderers/ArticleRenderer').ArticleRendererProps)}
      />
    </div>
  );
};

export const PaperView = React.memo(PaperViewComponent, (prevProps, nextProps) => {
  return (
    prevProps.article?.id === nextProps.article?.id &&
    prevProps.article?.content === nextProps.article?.content &&
    prevProps.useAlternateDesign === nextProps.useAlternateDesign &&
    prevProps.isEditMode === nextProps.isEditMode &&
    prevProps.logo === nextProps.logo
  );
});
