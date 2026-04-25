import { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import { Article } from '../../../src/types/models';

interface UseEditorStateOptions {
  isOpen: boolean;
  article: Partial<Article>;
  categories: string[];
}

export function useEditorState({ isOpen, article, categories }: UseEditorStateOptions) {
  const [formData, setFormData] = useState<Partial<Article>>({});
  const [title, setTitle] = useState('');
  const [tempPdf, setTempPdf] = useState<{ name: string; data: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [showAiLoading, setShowAiLoading] = useState(false);
  const [showTitleLoading, setShowTitleLoading] = useState(false);
  const [isScalingText, setIsScalingText] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const [imgCompressQuality, setImgCompressQuality] = useState(() => {
    const saved = localStorage.getItem('SWS_IMG_COMPRESS_QUALITY');
    return saved ? parseFloat(saved) : 0.8;
  });
  const [imgCompressMaxWidth, setImgCompressMaxWidth] = useState(() => {
    const saved = localStorage.getItem('SWS_IMG_COMPRESS_MAX_WIDTH');
    return saved ? parseInt(saved) : 1200;
  });
  const [imgCompressFormat, setImgCompressFormat] = useState<'webp' | 'jpeg' | 'original'>(() => {
    const saved = localStorage.getItem('SWS_IMG_COMPRESS_FORMAT');
    return (saved as 'webp' | 'jpeg' | 'original') || 'webp';
  });

  const deferredFontSize = useDeferredValue(formData.fontSize || 18);
  const deferredLineHeight = useDeferredValue(formData.lineHeight || 2.0);

  const contentAreaStyle = useMemo(() => ({
    fontSize: `${deferredFontSize}px`,
    lineHeight: deferredLineHeight,
    textAlign: 'justify' as const
  }), [deferredFontSize, deferredLineHeight]);

  useEffect(() => {
    localStorage.setItem('SWS_IMG_COMPRESS_QUALITY', String(imgCompressQuality));
  }, [imgCompressQuality]);

  useEffect(() => {
    localStorage.setItem('SWS_IMG_COMPRESS_MAX_WIDTH', String(imgCompressMaxWidth));
  }, [imgCompressMaxWidth]);

  useEffect(() => {
    localStorage.setItem('SWS_IMG_COMPRESS_FORMAT', imgCompressFormat);
  }, [imgCompressFormat]);

  const articleRef = useRef(article);
  articleRef.current = article;

  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  const resetForArticle = useCallback((contentRef: React.RefObject<HTMLDivElement | null>) => {
    if (isOpen) {
      const currentArticle = articleRef.current;
      const currentCategories = categoriesRef.current;
      const articleTitle = currentArticle?.title || '';
      setTitle(articleTitle);
      setFormData({
        date: currentArticle?.date || new Date().toISOString().split('T')[0],
        category: currentArticle?.category || (currentCategories?.[0] || '默认'),
        content: currentArticle?.content || '',
        id: currentArticle?.id,
        abstract: currentArticle?.abstract || '',
        tags: currentArticle?.tags || [],
        fontSize: currentArticle?.fontSize || 18,
        lineHeight: currentArticle?.lineHeight || 2.0,
        isPublished: currentArticle?.isPublished || false
      });

      if (currentArticle?.pdfData) {
        setTempPdf({ name: 'Existing PDF', data: currentArticle.pdfData });
      } else {
        setTempPdf(null);
      }

      if (contentRef.current) {
        contentRef.current.innerHTML = currentArticle?.content || '';
      }
    }
  }, [isOpen]);

  return {
    formData, setFormData,
    title, setTitle,
    tempPdf, setTempPdf,
    isProcessing, setIsProcessing,
    isGeneratingAi, setIsGeneratingAi,
    isGeneratingTitle, setIsGeneratingTitle,
    showAiLoading, setShowAiLoading,
    showTitleLoading, setShowTitleLoading,
    isScalingText, setIsScalingText,
    saveToast, setSaveToast,
    imgCompressQuality, setImgCompressQuality,
    imgCompressMaxWidth, setImgCompressMaxWidth,
    imgCompressFormat, setImgCompressFormat,
    contentAreaStyle,
    resetForArticle,
  };
}
