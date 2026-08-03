import { useRef, useState, useEffect, useCallback } from 'react';
import type { Article } from '../../../src/types';
import { usePanZoom } from '../../../hooks/usePanZoom';
import { calculateAutoFitPosition } from '../../../src/utils/imageMath';
import { fileToDataURL, compressImage } from '../../../src/utils/fileHelpers';

const noop = () => {};

type ImageType = 'cover' | 'back';

interface UseImageEditorOptions {
  article: Article;
  mode: 'edit' | 'read' | 'print';
  isEditable: boolean;
  imageType: ImageType;
  onUpdate?: (id: number, updates: Partial<Article>) => void;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onImageDelete?: () => void;
}

export function useImageEditor({
  article,
  mode,
  isEditable,
  imageType,
  onUpdate,
  onImageUpload,
  onImageDelete,
}: UseImageEditorOptions) {
  const imageField = imageType === 'cover' ? 'coverImage' : 'backImage';

  const {
    zoom,
    isDragging,
    eventHandlers,
    containerRef,
  } = usePanZoom({
    initialScale: article.scale || 1,
    initialX: article.posX || 0,
    initialY: article.posY || 0,
    isEditable: isEditable || false,
    mode,
    category: article.category,
    onUpdate: (updates) => onUpdate?.(article.id, updates),
    minScale: 0.5,
    maxScale: 5,
    scaleStep: 0.1,
    dragThreshold: 2,
    debounceDelay: 150,
  });

  const imageUrl = article[imageField];
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lastAutoFitRef = useRef<{ scale: number; posX: number; posY: number } | null>(null);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isImageSelected) {
      setToolbarPos(null);
      return;
    }
    const imageEl = imageContainerRef.current?.querySelector('img');
    if (imageEl) {
      const rect = imageEl.getBoundingClientRect();
      const toolbarHeight = 40;
      const toolbarWidth = 320;
      let top = rect.top - toolbarHeight - 8;
      if (top < 8) top = rect.bottom + 8;
      let left = rect.left + rect.width / 2;
      if (left - toolbarWidth / 2 < 8) left = toolbarWidth / 2 + 8;
      if (left + toolbarWidth / 2 > window.innerWidth - 8) left = window.innerWidth - toolbarWidth / 2 - 8;
      setToolbarPos({ top, left });
    }
  }, [isImageSelected, imageUrl, zoom]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable || !imageUrl) return;
    if (isDragging) return;
    e.stopPropagation();
    setIsImageSelected(prev => !prev);
  }, [isEditable, imageUrl, isDragging]);

  const handleImageDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    setIsImageSelected(true);
    onImageUpload?.(imageType);
  }, [isEditable, imageType, onImageUpload]);

  const handleContainerClick = useCallback(() => {
    if (isImageSelected) {
      setIsImageSelected(false);
    }
  }, [isImageSelected]);

  const handleImgAlign = useCallback((align: 'left' | 'center' | 'right') => {
    if (!imageContainerRef.current) return;
    const container = imageContainerRef.current;
    container.style.justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  }, []);

  const handleImgDelete = useCallback(() => {
    setIsImageSelected(false);
    onUpdate?.(article.id, { [imageField]: undefined, scale: 1, posX: 0, posY: 0 });
    onImageDelete?.();
  }, [article.id, imageField, onUpdate, onImageDelete]);

  const handleImgReplace = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToDataURL(file);
      // 封面/封底固定 2400px + quality 0.92 + WebP（与 CLAUDE.md 约定及 App.tsx 上传路径一致），
      // 避免十几 MB 原图直接写入 IndexedDB
      const src = await compressImage(base64, 2400, 0.92, 'webp');
      onUpdate?.(article.id, { [imageField]: src });
    } catch (err) {
      alert('图片替换失败: ' + (err instanceof Error ? err.message : '请检查图片格式'));
    } finally {
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  }, [article.id, imageField, onUpdate]);

  const handleImgCaption = noop;

  useEffect(() => {
    if (imageContainerRef.current && imageUrl) {
      const { clientWidth, clientHeight } = imageContainerRef.current;
      const img = new Image();
      img.onload = () => {
        const result = calculateAutoFitPosition(
          img.naturalWidth,
          img.naturalHeight,
          clientWidth,
          clientHeight
        );
        if (!lastAutoFitRef.current ||
            Math.abs(result.scale - lastAutoFitRef.current.scale) > 0.01 ||
            Math.abs(result.posX - lastAutoFitRef.current.posX) > 1 ||
            Math.abs(result.posY - lastAutoFitRef.current.posY) > 1) {
          lastAutoFitRef.current = result;
          onUpdate?.(article.id, result);
        }
      };
      img.src = imageUrl;
    }
  }, [imageUrl, article.id, onUpdate]);

  const hasImage = !!imageUrl;

  return {
    zoom,
    isDragging,
    eventHandlers,
    containerRef,
    imageUrl,
    imageContainerRef,
    isImageSelected,
    toolbarPos,
    replaceInputRef,
    hasImage,
    handleImageClick,
    handleImageDoubleClick,
    handleContainerClick,
    handleImgAlign,
    handleImgDelete,
    handleImgReplace,
    handleImgCaption,
  };
}
