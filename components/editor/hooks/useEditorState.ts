import { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import type { Article } from '../../../src/types';
import { htmlToBlocks } from '../../../src/utils/blockParser';
import { toast } from '../../../src/utils/toast';

interface UseEditorStateOptions {
  isOpen: boolean;
  article: Partial<Article>;
  categories: string[];
  contentRef: React.RefObject<HTMLDivElement | null>;
  onSave: (article: Partial<Article>) => void;
}

export function useEditorState({ isOpen, article, categories, contentRef, onSave }: UseEditorStateOptions) {
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
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

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
    // 白名单校验：localStorage 旧值可能非法（如 "png"），避免类型撒谎
    return saved === 'webp' || saved === 'jpeg' || saved === 'original' ? saved : 'webp';
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
    localStorage.setItem('SWS_IMG_COMPRESS_MAX_WIDTH', String(imgCompressMaxWidth));
    localStorage.setItem('SWS_IMG_COMPRESS_FORMAT', imgCompressFormat);
  }, [imgCompressQuality, imgCompressMaxWidth, imgCompressFormat]);

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

  // 保存编排：校验 → 快照 → 空闲时段解析 blocks → 双存储落盘（原 Editor 组件体逻辑下沉）
  const handleSave = useCallback((targetPublishState?: boolean) => {
    if (!title) { toast.warning("请输入标题"); return; }

    const finalContent = contentRef.current?.innerHTML || '';
    const snapshot: Partial<Article> = {
      ...formData,
      title,
      content: finalContent,
      pdfData: tempPdf?.data,
      isPublished: targetPublishState !== undefined ? targetPublishState : formData.isPublished
    };

    // 大文档解析放空闲时段，避免点击保存时长时间阻塞主线程；单次保存语义不变
    const doSave = () => {
      try {
        // 双存储：保存时把解析结果一并持久化，阅读打开时直接命中 blocks，
        // 避免每次打开都全量解析正文；封面/封底或空正文不附加。
        const blocks = finalContent.trim() ? htmlToBlocks(finalContent) : undefined;
        onSave({ ...snapshot, blocks });
      } catch {
        onSave(snapshot);
      }
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') ric(doSave, { timeout: 500 });
    else setTimeout(doSave, 0);
  }, [formData, title, tempPdf, contentRef, onSave]);

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
    rightPanelCollapsed, setRightPanelCollapsed,
    handleSave,
  };
}
