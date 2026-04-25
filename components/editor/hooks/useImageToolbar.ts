import { useState, useCallback } from 'react';

export function useImageToolbar() {
  const [selectedImgEl, setSelectedImgEl] = useState<HTMLImageElement | null>(null);
  const [imgToolbarPos, setImgToolbarPos] = useState<{ top: number; left: number } | null>(null);

  const handleEditorClick = useCallback((e: React.MouseEvent, contentRef: React.RefObject<HTMLDivElement | null>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' && contentRef.current?.contains(target)) {
      const img = target as HTMLImageElement;
      if (selectedImgEl && selectedImgEl !== img) {
        selectedImgEl.classList.remove('img-selected');
      }
      img.classList.add('img-selected');
      setSelectedImgEl(img);
      const rect = img.getBoundingClientRect();
      const toolbarHeight = 40;
      const toolbarWidth = 320;
      let top = rect.top - toolbarHeight - 8;
      if (top < 8) top = rect.bottom + 8;
      let left = rect.left + rect.width / 2;
      if (left - toolbarWidth / 2 < 8) left = toolbarWidth / 2 + 8;
      if (left + toolbarWidth / 2 > window.innerWidth - 8) left = window.innerWidth - toolbarWidth / 2 - 8;
      if (top + toolbarHeight > window.innerHeight - 8) top = window.innerHeight - toolbarHeight - 8;
      setImgToolbarPos({ top, left });
    } else {
      if (selectedImgEl) {
        selectedImgEl.classList.remove('img-selected');
        setSelectedImgEl(null);
        setImgToolbarPos(null);
      }
    }
  }, [selectedImgEl]);

  const handleImgAlign = useCallback((align: 'left' | 'center' | 'right') => {
    if (!selectedImgEl) return;
    const container = selectedImgEl.closest('div') as HTMLElement | null;
    if (container) {
      container.style.textAlign = align;
    }
    selectedImgEl.style.margin = align === 'center' ? '0 auto' : align === 'left' ? '0 auto 0 0' : '0 0 0 auto';
    selectedImgEl.style.display = 'block';
  }, [selectedImgEl]);

  const handleImgSize = useCallback((size: '30%' | '60%' | '100%') => {
    if (!selectedImgEl) return;
    const container = selectedImgEl.closest('div') as HTMLElement | null;
    if (container) {
      container.style.width = size;
      container.style.maxWidth = size;
    }
  }, [selectedImgEl]);

  const handleImgReplace = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, imgCompressMaxWidth: number, imgCompressQuality: number, imgCompressFormat: 'webp' | 'jpeg' | 'original') => {
    const { fileToDataURL, compressImage } = await import('../../../src/utils/fileHelpers');
    const file = e.target.files?.[0];
    if (!file || !selectedImgEl) return;
    try {
      const base64 = await fileToDataURL(file);
      const src = await compressImage(base64, imgCompressMaxWidth, imgCompressQuality, imgCompressFormat);
      const oldSrc = selectedImgEl.getAttribute('src');
      if (oldSrc && oldSrc.startsWith('blob:')) {
        URL.revokeObjectURL(oldSrc);
      }
      selectedImgEl.setAttribute('src', src);
    } catch {
      alert('替换图片失败');
    } finally {
      e.target.value = '';
    }
  }, [selectedImgEl]);

  const handleImgDelete = useCallback(() => {
    if (!selectedImgEl) return;
    const container = selectedImgEl.closest('div') as HTMLElement | null;
    if (container && container.parentElement) {
      const nextP = container.nextElementSibling;
      container.remove();
      if (nextP && nextP.tagName === 'P' && (nextP.innerHTML === '<br>' || nextP.innerHTML === '')) {
        nextP.remove();
      }
    } else {
      selectedImgEl.remove();
    }
    setSelectedImgEl(null);
    setImgToolbarPos(null);
  }, [selectedImgEl]);

  const handleImgCaption = useCallback(() => {
    if (!selectedImgEl) return;
    const container = selectedImgEl.closest('div') as HTMLElement | null;
    if (!container) return;
    const existingCaption = container.nextElementSibling;
    if (existingCaption && existingCaption.classList.contains('image-caption')) {
      existingCaption.remove();
      return;
    }
    const caption = document.createElement('p');
    caption.className = 'image-caption';
    caption.contentEditable = 'true';
    caption.innerHTML = '请输入图片说明...';
    caption.style.cssText = 'text-align: center; font-size: 14px; color: #6b7280; font-style: italic; text-indent: 0; margin: 4px 0 16px 0; line-height: 1.6;';
    container.parentElement!.insertBefore(caption, container.nextSibling);
    const range = document.createRange();
    range.selectNodeContents(caption);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [selectedImgEl]);

  return {
    selectedImgEl,
    imgToolbarPos,
    handleEditorClick,
    handleImgAlign,
    handleImgSize,
    handleImgReplace,
    handleImgDelete,
    handleImgCaption,
  };
}
