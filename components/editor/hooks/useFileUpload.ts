import { useCallback, useRef, useEffect } from 'react';
import type { Article } from '../../../src/types';
import { fileToDataURL, compressImage, FILE_SIZE_LIMITS } from '../../../src/utils/fileHelpers';
import { cleanPastedHtml } from '../../../src/utils/pasteCleaner';
import { createImageHtml } from '../../../src/utils/encoding';
import { escapeHtml } from '../../../src/utils/stringUtils';
import { extractAbstractFromPdf } from '../../../src/services/pdf';
import { calculateAutoFitPosition } from '../../../src/utils/imageMath';

interface UseFileUploadOptions {
  contentRef: React.RefObject<HTMLDivElement | null>;
  formData: { category?: string; title?: string | null; abstract?: string | null; tags?: string[] };
  title: string;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Article>>>;
  setIsProcessing: (v: boolean) => void;
  insertHtml: (htmlOrNode: string | Node) => void;
  handleAutoIndent: () => void;
  imgCompressMaxWidth: number;
  imgCompressQuality: number;
  imgCompressFormat: 'webp' | 'jpeg' | 'original';
  setTempPdf: React.Dispatch<React.SetStateAction<{ name: string; data: string } | null>>;
  saveSelection: () => void;
  restoreSelection: () => void;
}

export function useFileUpload({
  contentRef,
  formData,
  title,
  setFormData,
  setIsProcessing,
  insertHtml,
  handleAutoIndent,
  imgCompressMaxWidth,
  imgCompressQuality,
  imgCompressFormat,
  setTempPdf,
  saveSelection,
  restoreSelection,
}: UseFileUploadOptions) {
  const formDataFieldsRef = useRef({ category: '', title: '', abstract: '' });
  formDataFieldsRef.current = {
    category: formData.category || '',
    title: title,
    abstract: formData.abstract || '',
  };

  const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = base64;
    });
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;

    if (clipboardData.files && clipboardData.files.length > 0) {
      const file = clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        setIsProcessing(true);
        try {
          const base64 = await fileToDataURL(file);
          const src = await compressImage(base64, imgCompressMaxWidth, imgCompressQuality, imgCompressFormat);
          insertHtml(createImageHtml(src));
        } catch (err) {
          alert('粘贴图片失败: ' + (err instanceof Error ? err.message : '请检查图片格式'));
        } finally {
          setIsProcessing(false);
        }
        return;
      }
    }

    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    if (html) {
      const cleaned = cleanPastedHtml(html);
      insertHtml(cleaned);
      setTimeout(() => handleAutoIndent(), 50);
    } else if (text) {
      const paragraphs = text.split(/\n\s*\n|\r\n\s*\r\n/);
      const htmlContent = paragraphs
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      insertHtml(htmlContent);
      setTimeout(() => handleAutoIndent(), 50);
    }
  }, [imgCompressMaxWidth, imgCompressQuality, imgCompressFormat, insertHtml, handleAutoIndent, setIsProcessing]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: 'img' | 'video' | 'audio' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 与 fileToDataURL 内部限制同源（FILE_SIZE_LIMITS），避免自检通过却在读取时被拒
    let maxSize = FILE_SIZE_LIMITS.image;
    if (type === 'video') maxSize = FILE_SIZE_LIMITS.video;
    else if (type === 'audio') maxSize = FILE_SIZE_LIMITS.audio;
    else if (type === 'pdf') maxSize = FILE_SIZE_LIMITS.pdf;

    if (file.size > maxSize) {
      alert(`文件过大，请压缩后上传`);
      e.target.value = ''; // 重置 input，否则再次选择同一文件不会触发 onChange
      return;
    }

    if (!contentRef.current) return;
    setIsProcessing(true);
    try {
        if (type === 'img') {
          const { category } = formDataFieldsRef.current;
          if (category === '封面' || category === '封底') {
            const base64 = await fileToDataURL(file);
            // 封面/封底固定 2400px + quality 0.92（与 CLAUDE.md 约定及 App.tsx 一致），不用用户滑杆值
            const src = await compressImage(base64, 2400, 0.92, 'webp');

            const dimensions = await getImageDimensions(src);

            const containerHeight = 550;
            const containerWidth = Math.floor(containerHeight / 1.414);

            const { scale, posX, posY } = calculateAutoFitPosition(
              dimensions.width,
              dimensions.height,
              containerWidth,
              containerHeight
            );

            const updateKey = category === '封面' ? 'coverImage' : 'backImage';
            setFormData(prev => ({ ...prev, [updateKey]: src, scale, posX, posY }));
          } else {
            const base64 = await fileToDataURL(file);
            const src = await compressImage(base64, imgCompressMaxWidth, imgCompressQuality, imgCompressFormat);
            insertHtml(createImageHtml(src));
          }
        } else if (type === 'pdf') {
          const base64 = await fileToDataURL(file);

          // 尝试自动提取元数据（标题/摘要/关键词），提取失败不影响附件挂载
          try {
            const extractResult = await extractAbstractFromPdf(base64);
            const { title, abstract } = formDataFieldsRef.current;
            if (extractResult.success) {
              if (!title || title === '未命名文章') {
                setFormData(prev => ({ ...prev, title: extractResult.title || prev.title }));
              }
              if (extractResult.keywords && extractResult.keywords.length > 0) {
                setFormData(prev => ({
                  ...prev,
                  tags: [...new Set([...(prev.tags || []), ...extractResult.keywords!])]
                }));
              }
              if (!abstract) {
                setFormData(prev => ({ ...prev, abstract: extractResult.abstract || prev.abstract }));
              }
            }
          } catch (err) {
            console.error('PDF extraction failed:', err);
          }

          // 默认作为附件挂载（不再提供转图片选项）
          setTempPdf({ name: file.name, data: base64 });
        } else {
          const src = await fileToDataURL(file);

          const tag = type === 'video' ?
            `<div class="media-container" contenteditable="false"><video controls src="${src}" style="max-width:100%; max-height:500px; border-radius:4px; background:#000;"></video></div><p><br/></p>` :
            `<div class="media-container" contenteditable="false"><audio controls src="${src}" style="width:80%; max-width:500px;"></audio></div><p><br/></p>`;

          insertHtml(tag);
        }
      } catch (error) {
        alert("上传失败: " + (error instanceof Error ? error.message : '未知错误'));
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
  }, [imgCompressMaxWidth, imgCompressQuality, imgCompressFormat, contentRef, setFormData, setIsProcessing, setTempPdf]);

  return {
    handlePaste,
    handleFile,
  };
}
