import { useCallback, useRef, useEffect } from 'react';
import { fileToDataURL, compressImage } from '../../../src/utils/fileHelpers';
import { cleanPastedHtml } from '../../../src/utils/pasteCleaner';
import { createImageHtml } from '../../../src/utils/encoding';
import { extractAbstractFromPdf, convertPdfToImages } from '../../../src/services/pdf';
import { useBlobManager } from '../../../hooks/useBlobManager';
import { calculateAutoFitPosition } from '../../../src/utils/imageMath';

interface UseFileUploadOptions {
  contentRef: React.RefObject<HTMLDivElement | null>;
  formData: { category?: string; title?: string | null; abstract?: string | null; tags?: string[] };
  title: string;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
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
  const blobManager = useBlobManager();
  const blobToDataMapRef = useRef(new Map<string, string>());
  const formDataFieldsRef = useRef({ category: '', title: '', abstract: '' });
  formDataFieldsRef.current = {
    category: formData.category || '',
    title: title,
    abstract: formData.abstract || '',
  };

  useEffect(() => {
    return () => {
      blobToDataMapRef.current.clear();
    };
  }, []);

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
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      insertHtml(htmlContent);
      setTimeout(() => handleAutoIndent(), 50);
    }
  }, [imgCompressMaxWidth, imgCompressQuality, imgCompressFormat, insertHtml, handleAutoIndent, setIsProcessing]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: 'img' | 'video' | 'audio' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
    const MAX_AUDIO_SIZE = 20 * 1024 * 1024;
    const MAX_PDF_SIZE = 50 * 1024 * 1024;

    let maxSize = MAX_IMAGE_SIZE;
    if (type === 'video') maxSize = MAX_VIDEO_SIZE;
    else if (type === 'audio') maxSize = MAX_AUDIO_SIZE;
    else if (type === 'pdf') maxSize = MAX_PDF_SIZE;

    if (file.size > maxSize) {
      alert(`文件过大，请压缩后上传`);
      return;
    }

    if (!contentRef.current) return;
    setIsProcessing(true);
    try {
        if (type === 'img') {
          const { category } = formDataFieldsRef.current;
          if (category === '封面' || category === '封底') {
            const base64 = await fileToDataURL(file);
            const src = await compressImage(base64, imgCompressMaxWidth, imgCompressQuality, imgCompressFormat);

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

          const insertAsContent = window.confirm(
            "您希望如何处理此 PDF？\n\n【确定】转为图片插入正文（推荐，可直接打印，所见即所得）\n【取消】作为附件挂载（仅提供下载链接）"
          );

          if (insertAsContent) {
            try {
              const images = await convertPdfToImages(file);
              console.log(`[Editor] PDF 转换完成，准备分页插入 (${images.length} 页)...`);

              for (let i = 0; i < images.length; i++) {
                const dataUrl = images[i];
                const blobUrl = blobManager.getBlobUrl(dataUrl);
                if (blobUrl) {
                  blobToDataMapRef.current.set(blobUrl, dataUrl);

                  const container = document.createElement('div');
                  container.className = 'media-container pdf-page-container overflow-hidden';
                  container.contentEditable = 'false';
container.style.cssText = 'width: 100%; max-width: 100%; box-sizing: border-box; text-align: center; margin: 3rem auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; display: block;';

                  const img = document.createElement('img');
                  img.src = blobUrl;
                  img.className = 'pdf-page-image max-w-full h-auto object-contain';
                  img.style.cssText = 'width: 100% !important; max-width: 100% !important; height: auto !important; display: block; margin: 0; padding: 0;';
                  img.alt = `PDF Page ${i + 1}`;

                  container.appendChild(img);
                  insertHtml(container);

                  console.log(`[Editor] 第 ${i + 1} 页已安全挂载`);
                }
              }

              console.log('[Editor] PDF 所有页面已成功流式插入');

              const emptyParagraph = document.createElement('p');
              emptyParagraph.innerHTML = '<br>';
              insertHtml(emptyParagraph);

              const editorElement = contentRef.current;
              if (editorElement) {
                setFormData(prev => ({ ...prev, content: editorElement.innerHTML }));
              }
            } catch (err) {
              console.error('[Editor] PDF 转换流程异常:', err);
              alert(`PDF 转换失败: ${err instanceof Error ? err.message : '未知错误'}\n\n请尝试刷新页面重试。`);
            }
          } else {
            setTempPdf({ name: file.name, data: base64 });
          }
        } else {
          const src = await fileToDataURL(file);

          const tag = type === 'video' ?
            `<div class="media-container" contenteditable="false"><video controls src="${src}" style="max-width:100%; max-height:500px; border-radius:4px; background:#000;"></video></div><p><br/></p>` :
            `<div class="media-container" contenteditable="false"><audio controls src="${src}" style="width:80%; max-width:500px;"></audio></div><p><br/></p>`;

          insertHtml(tag);
        }
      } catch (error) {
        alert("上传失败");
      } finally {
        setIsProcessing(false);
        e.target.value = '';
      }
  }, [imgCompressMaxWidth, imgCompressQuality, imgCompressFormat, insertHtml, blobManager, contentRef, setFormData, setIsProcessing, setTempPdf]);

  return {
    handlePaste,
    handleFile,
    blobToDataMapRef,
  };
}
