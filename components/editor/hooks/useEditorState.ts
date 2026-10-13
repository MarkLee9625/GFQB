import { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import type { Article } from '../../../src/types';
import { htmlToBlocks } from '../../../src/utils/blockParser';
import { toast } from '../../../src/utils/toast';
import { resolveMediaValue } from '../../../services/mediaStore';

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

      const rawContent = currentArticle?.content || '';
      const articleId = currentArticle?.id;
      const el = contentRef.current;
      if (el) {
        el.innerHTML = rawContent;
      }

      // P0-A：正文内 sws-media:// 引用异步还原为 data URL 供编辑显示。
      // 「用户是否已改动」用输入事件标记判定——不用 innerHTML 比较：外部导入/手改的 HTML
      // 经 DOM 归一化后（如 `<br/>`→`<br>`）必然与原字符串不等，会把还原永久误判掉。
      if (el && rawContent.includes('sws-media://')) {
        let userEdited = false;
        const markEdited = () => { userEdited = true; };
        el.addEventListener('input', markEdited, { once: true });
        void resolveMediaValue(rawContent)
          .then((resolved) => {
            if (!resolved || resolved === rawContent) return;
            if (articleRef.current?.id !== articleId) return;
            const target = contentRef.current;
            if (!target || !target.isConnected || userEdited) return;
            target.innerHTML = resolved;
          })
          .catch((err) => {
            console.warn('[Editor] 正文媒体还原失败', err);
          })
          .finally(() => {
            el.removeEventListener('input', markEdited);
          });
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

    // 双存储：保存时把解析结果一并持久化，阅读打开时直接命中 blocks，
    // 避免每次打开都全量解析正文；封面/封底或空正文不附加。
    const buildBlocks = () => (finalContent.trim() ? htmlToBlocks(finalContent) : undefined);
    // 大文档解析放空闲时段，避免点击保存时长时间阻塞主线程
    const runIdle = (cb: () => void) => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
      if (typeof ric === 'function') ric(cb, { timeout: 500 });
      else setTimeout(cb, 0);
    };
    const saveWithBlocks = () => {
      try {
        onSave({ ...snapshot, blocks: buildBlocks() });
      } catch {
        onSave(snapshot);
      }
    };

    // 新文章必须一次性创建（两次 onSave 会建出两篇），沿用空闲时段单次保存
    if (!snapshot.id) {
      runIdle(saveWithBlocks);
      return;
    }
    // 已有文章：正文立即落盘（不等空闲时段，关页/崩溃不丢正文），blocks 解析结果随后补写。
    // ⚠️ 第一阶段必须显式清空 blocks：否则 updateArticle 的浅合并会保留**旧 blocks**，
    // 而阅读态只要 blocks 非空就直接用它（不看 content）⇒「保存后关页」会显示旧正文。
    onSave({ ...snapshot, blocks: undefined });
    runIdle(saveWithBlocks);
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
