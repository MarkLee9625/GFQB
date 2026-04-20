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

  const prevArticleIdRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);

  const resetForArticle = useCallback((contentRef: React.RefObject<HTMLDivElement | null>) => {
    if (isOpen) {
      const articleId = article.id ?? null;
      const justOpened = !wasOpenRef.current;
      wasOpenRef.current = true;
      if (prevArticleIdRef.current !== articleId || justOpened) {
        prevArticleIdRef.current = articleId;
        const articleTitle = article.title || '';
        setTitle(articleTitle);
        setFormData({
          date: article.date || new Date().toISOString().split('T')[0],
          category: article.category || (categories[0] || '默认'),
          content: article.content || '',
          id: article.id,
          abstract: article.abstract || '',
          tags: article.tags || [],
          fontSize: article.fontSize || 18,
          lineHeight: article.lineHeight || 2.0,
          isPublished: article.isPublished || false
        });
        if (article.pdfData) {
          setTempPdf({ name: 'Existing PDF', data: article.pdfData });
        } else {
          setTempPdf(null);
        }
        if (contentRef.current) {
          contentRef.current.innerHTML = article.content || '';
        }
      }
    } else {
      wasOpenRef.current = false;
    }
  }, [isOpen, article, categories]);

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
