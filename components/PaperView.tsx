import React from 'react';
import { Article } from '../src/types/models';
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

  return (
    <div className="relative">
      {/* 设计模式切换器 */}
      {isEditMode && (
        <div className="DesignToggle fixed top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200">
          <span className="text-xs font-medium text-gray-600">设计模式:</span>
          <button
            onClick={() => setUseAlternateDesign(false)}
            className={`px-2 py-1 text-xs rounded ${!useAlternateDesign ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            原版
          </button>
          <button
            onClick={() => setUseAlternateDesign(true)}
            className={`px-2 py-1 text-xs rounded ${useAlternateDesign ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            杂志风
          </button>
        </div>
      )}

      {/* 使用统一的 ArticleRenderer 组件 */}
      <ArticleRenderer
        article={article}
        mode={isEditMode ? 'edit' : 'read'}
        logo={logo}
        isEditable={isEditMode}
        onArticleUpdate={onUpdate}
        onImageUpload={onImageUpload}
        onNext={onNext}
        useAlternateDesign={useAlternateDesign}
      />
    </div>
  );
};

export const PaperView = React.memo(PaperViewComponent);
