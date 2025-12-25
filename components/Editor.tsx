import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Article, CONSTANTS } from '../types';
import { Icon } from './Icons';
import { fileToDataURL, compressImage, convertPdfToImages } from '../services/db';
import { generateArticleMeta, generateTitleOnly } from '../services/aiService';
import { extractAbstractFromPdf } from '../services/pdfExtractor';

interface EditorProps {
  isOpen: boolean;
  article: Partial<Article>;
  categories: string[];
  onClose: () => void;
  onSave: (article: Partial<Article>) => void;
  onManageCats: () => void;
}

export const Editor: React.FC<EditorProps> = ({ isOpen, article, categories, onClose, onSave, onManageCats }) => {
  const [formData, setFormData] = useState<Partial<Article>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const lastRangeRef = useRef<Range | null>(null);
  const [tempPdf, setTempPdf] = useState<{ name: string, data: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  // 保存当前选区（光标位置）
  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      lastRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  // 恢复之前保存的选区
  const restoreSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && lastRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(lastRangeRef.current);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: article.title || '',
        date: article.date || new Date().toISOString().split('T')[0],
        category: article.category || (categories[0] || '默认'),
        content: article.content || '',
        id: article.id,
        abstract: article.abstract || '',
        tags: article.tags || [],
        fontSize: article.fontSize || 18,
        lineHeight: article.lineHeight || 2.0
      });
      if (article.pdfData) {
        setTempPdf({ name: 'Existing PDF', data: article.pdfData });
      } else {
        setTempPdf(null);
      }
      if (contentRef.current) {
        contentRef.current.innerHTML = article.content || '';
      }
    } else {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    }
  }, [isOpen, article, categories]);

  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          onSave({ ...formData, content: contentRef.current?.innerHTML || '' });
        }
      }

      if (e.altKey && e.key === '2') {
        e.preventDefault();
        execCmd('formatBlock', 'h2');
      }

      // 处理 Backspace 和 Delete 键，用于删除媒体容器
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);

        // [新增] 情况0：处理“选中”了媒体容器的情况 (非折叠选区)
        if (!range.collapsed) {
          const common = range.commonAncestorContainer;
          // 检查选区是否包含或就是 media-container
          // 简单策略：如果选区起始节点是元素，且该位置的子节点是 media-container
          if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            const startNode = (range.startContainer as HTMLElement).childNodes[range.startOffset];
            if (startNode && startNode.nodeType === Node.ELEMENT_NODE && (startNode as HTMLElement).classList.contains('media-container')) {
              e.preventDefault();
              (startNode as HTMLElement).remove();
              return;
            }
          }
          // 如果是普通文本选中，交给浏览器默认处理
          return;
        }

        // 辅助函数：检查元素是否是媒体容器
        const isMediaContainer = (element: Element): boolean => {
          return element.classList.contains('media-container');
        };

        // 获取光标所在的容器
        const container = range.commonAncestorContainer;

        // 情况1：光标在空的 <p> 内，且前一个兄弟节点是 media-container
        if (container.nodeType === Node.ELEMENT_NODE && (container as HTMLElement).tagName === 'P') {
          const p = container as HTMLElement;
          const isEmpty = p.innerHTML === '' || p.innerHTML === '<br>' || p.children.length === 0;
          if (isEmpty) {
            const prev = p.previousElementSibling;
            if (prev && isMediaContainer(prev)) {
              e.preventDefault();
              prev.remove();
              // 将光标移动到之前的位置（在 p 之前）
              const parent = p.parentNode;
              if (parent) {
                const newRange = document.createRange();
                const index = Array.from(parent.childNodes).indexOf(p);
                newRange.setStart(parent, index);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                p.remove(); // 移除空的 <p>
              }
              return;
            }
          }
        }

        // 情况2：光标在元素的开头，且前一个兄弟元素是 media-container
        if (range.startOffset === 0) {
          // 如果光标在文本节点内，检查其父元素的前一个兄弟元素
          let targetElement: HTMLElement | null = null;
          if (container.nodeType === Node.TEXT_NODE) {
            const parent = container.parentNode;
            if (parent && parent.nodeType === Node.ELEMENT_NODE) {
              targetElement = parent as HTMLElement;
            }
          } else if (container.nodeType === Node.ELEMENT_NODE) {
            targetElement = container as HTMLElement;
          }

          if (targetElement) {
            const prev = targetElement.previousElementSibling;
            if (prev && isMediaContainer(prev)) {
              e.preventDefault();
              prev.remove();
              // 光标留在当前元素的开头
              const newRange = document.createRange();
              if (container.nodeType === Node.TEXT_NODE) {
                newRange.setStart(container, 0);
              } else {
                newRange.setStart(targetElement, 0);
              }
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              return;
            }
          }
        }

        // 情况3：光标在媒体容器之后的 <br> 或空白处，但不在任何元素内
        // 例如，媒体容器后面直接跟一个 <br>，光标在 <br> 之后
        // 这种场景较难检测，我们尝试查找光标前一个可见元素
        // 简单起见，我们检查光标所在节点的前一个兄弟元素
        let node: Node | null = container;
        while (node && node !== contentRef.current) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            const prev = element.previousElementSibling;
            if (prev && isMediaContainer(prev)) {
              // 如果光标在元素的最开头，已经由情况2处理
              // 这里处理光标在元素中间但前面是媒体容器的情况（例如，媒体容器后跟一个 <br>，光标在 <br> 后）
              // 实际上，这种情况可能不会发生，因为媒体容器是块级元素，后面通常跟一个块级元素
              // 为了安全，我们仍然检查
              if (range.startOffset === 0) {
                // 已经在情况2处理过，这里不再重复
                break;
              }
              // 如果光标不在开头，但前一个兄弟是媒体容器，我们仍然删除媒体容器，并将光标移动到当前元素的开头
              e.preventDefault();
              prev.remove();
              const newRange = document.createRange();
              newRange.setStart(element, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              return;
            }
            break;
          }
          node = node.parentNode;
        }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => {
      window.removeEventListener('keydown', handleKeys);
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, [isOpen, formData, onSave]);

  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
  };

  const handleAutoIndent = () => {
    if (!contentRef.current) return;
    const body = contentRef.current;

    // --- 步骤 1: 结构标准化 (将裸文本包裹进 <p>) ---
    const children = Array.from(body.childNodes);
    let currentWrapper: HTMLParagraphElement | null = null;

    children.forEach((node: any) => {
      // 判断是否为块级元素
      const isBlock = node.nodeType === Node.ELEMENT_NODE &&
        /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|SECTION|ARTICLE|PRE|HR|TABLE)$/i.test((node as HTMLElement).tagName);

      // 如果不是块级元素 (即文本、span、br、img等行内内容)
      if (!isBlock) {
        // 忽略纯空白文本，除非它在 wrapper 中
        const isEmptyText = node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
        if (isEmptyText && !currentWrapper) return;

        if (!currentWrapper) {
          currentWrapper = document.createElement('p');
          body.insertBefore(currentWrapper, node);
        }
        currentWrapper.appendChild(node);
      } else {
        currentWrapper = null; // 遇到块级元素，打断当前的包裹逻辑
      }
    });

    // --- 步骤 2: 递归应用样式 ---
    const processNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // 递归处理子节点
        Array.from(el.children).forEach(child => processNode(child));

        // 跳过特殊的卡片组件
        if (el.classList.contains('pdf-summary-card')) return;

        // 策略 A: 针对 P 标签 (激进缩进)
        if (tag === 'p') {
          const hasText = el.innerText.trim().length > 0;
          const hasMedia = el.querySelector('img, video, audio, iframe');

          // 逻辑：只要有文字就缩进；或者完全没有媒体也缩进。
          // 唯独：没文字 且 有媒体 (纯图片段落) -> 不缩进
          if (hasText || !hasMedia) {
            el.style.textIndent = '2em';
            el.style.marginBottom = '0'; // 修改为 0
            el.style.textAlign = 'justify';
            el.style.lineHeight = '2.0';
          } else {
            // 纯图片段落：清除缩进，居中
            el.style.textIndent = '0';
            el.style.textAlign = 'center';
            el.style.marginBottom = '0'; // 修改为 0
          }
        }
        // 策略 B: 针对 DIV 标签 (保守缩进)
        else if (tag === 'div') {
          // 跳过媒体容器，不要给它加缩进
          if (el.classList.contains('media-container')) return;

          if (!el.querySelector('img, video, audio, iframe')) {
            el.style.textIndent = '2em';
            el.style.marginBottom = '0'; // 修改为 0
            el.style.textAlign = 'justify';
          }
        }
      }
    };

    processNode(body);

    // 强制触发 React 状态同步
    setFormData(prev => ({ ...prev, content: body.innerHTML }));
  };

  const handleAiSummary = async () => {
    const text = contentRef.current?.innerText || '';
    if (!text || text.length < 50) return alert("内容太少，AI 无法生成总结");

    // 防误触保护：如果已有标题，提示用户
    if (formData.title && formData.title.trim() !== '' && formData.title !== '未命名文章') {
      if (!window.confirm("这将覆盖现有标题，确定继续吗？")) return;
    }

    setIsGeneratingAi(true);
    try {
      const result = await generateArticleMeta(text);
      setFormData(prev => ({
        ...prev,
        abstract: result.abstract,
        title: result.title, // 同时更新标题
        tags: result.keywords || prev.tags // 同步更新标签
      }));
    } catch (err) {
      alert("AI 总结生成失败: " + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAiTitle = async () => {
    const text = contentRef.current?.innerText || '';
    if (!text || text.length < 50) return alert("内容太少，AI 无法生成标题");

    setIsGeneratingTitle(true);
    try {
      const title = await generateTitleOnly(text);
      setFormData(prev => ({ ...prev, title }));
    } catch (err) {
      alert("AI 标题生成失败: " + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const insertHtml = (html: string) => {
    // [修改] 不要在这里调用 saveSelection()，否则会覆盖掉 onBlur 保存的正确位置

    // 确保编辑器获得焦点
    if (contentRef.current && document.activeElement !== contentRef.current) {
      contentRef.current.focus();
    }

    // [关键] 恢复到点击上传按钮那一刻的光标位置
    restoreSelection();

    // 执行插入
    execCmd('insertHTML', html);

    // 插入完成后，更新当前光标位置
    saveSelection();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'img' | 'video' | 'audio' | 'pdf') => {
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

    setIsProcessing(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        if (type === 'img') {
          const src = file.type === 'image/gif' ? await fileToDataURL(file) : await compressImage(file);
          // 核心修复：在图片后追加 <p><br/></p>，确保光标有落脚点，且自动换行
          insertHtml(`<img src="${src}" /><p><br/></p>`);
        } else if (type === 'pdf') {
          const base64 = await fileToDataURL(file);

          // 智能提取 PDF 标题和摘要 (无论哪种模式都执行)
          try {
            const extractResult = await extractAbstractFromPdf(base64);
            if (extractResult.success) {
              if (!formData.title || formData.title === '未命名文章') {
                setFormData(prev => ({ ...prev, title: extractResult.title || prev.title }));
              }
              // 自动提取关键词并作为标签
              if (extractResult.keywords && extractResult.keywords.length > 0) {
                setFormData(prev => ({
                  ...prev,
                  tags: [...new Set([...(prev.tags || []), ...extractResult.keywords!])]
                }));
              }
              // 只有当当前摘要为空时，才用提取的摘要覆盖
              if (!formData.abstract) {
                setFormData(prev => ({ ...prev, abstract: extractResult.abstract || prev.abstract }));
              }
            }
          } catch (err) {
            console.error('PDF extraction failed:', err);
          }

          // 询问用户处理意图
          const insertAsContent = window.confirm(
            "您希望如何处理此 PDF？\n\n【确定】转为图片插入正文（推荐，可直接打印，所见即所得）\n【取消】作为附件挂载（仅提供下载链接）"
          );

          if (insertAsContent) {
            setIsProcessing(true);
            try {
              const images = await convertPdfToImages(file);

              // 生成连续的图片 HTML 块，每页一个容器
              const html = images.map((imgSrc, index) =>
                `<div class="media-container pdf-page-container" contenteditable="false">
                    <img src="${imgSrc}" class="pdf-page-image" alt="PDF Page ${index + 1}" />
                  </div><p><br/></p>`
              ).join('');

              insertHtml(html);
            } catch (err) {
              console.error(err);
              alert("PDF 转换失败，请检查文件是否加密或损坏。");
            } finally {
              setIsProcessing(false);
            }
          } else {
            // 原有的附件逻辑 (仅设置 PDF 数据)
            setTempPdf({ name: file.name, data: base64 });
          }
        } else {
          const src = await fileToDataURL(file);

          // 核心修改：使用 contentEditable="false" 包裹视频，使其成为一个整体块
          // 这样 Backspace 键可以一次性删除它，且光标不会跑进 video 标签里
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
    }, 50);
    timeoutIdsRef.current.push(timeoutId);
  };

  const handleSave = () => {
    if (!formData.title) return alert("请输入标题");
    onSave({
      ...formData,
      content: contentRef.current?.innerHTML || '',
      pdfData: tempPdf?.data
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
      <style>{CONSTANTS.UNIFIED_STYLES}</style>

      {isProcessing && (
        <div className="absolute inset-0 z-[200] bg-white/50 flex flex-col items-center justify-center backdrop-blur-[2px]">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin mb-3"></div>
          <div className="text-brand-blue font-bold text-sm">正在上传资源...</div>
        </div>
      )}

      <div className="bg-white w-full max-w-[1600px] h-full rounded-2xl flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Icon name="edit" className="w-4 h-4 text-brand-blue" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 tracking-tight">
              {formData.id ? '编辑工作台' : '创作新篇章'}
            </h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-800 transition-all">
            <Icon name="maximize" className="w-5 h-5 rotate-45" />
          </button>
        </div>

        {/* Workspace: Split Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Content Editor */}
          <div className="flex-1 flex flex-col border-r border-gray-100 bg-gray-50/30">
            {/* Dynamic Title Input */}
            <div className="p-8 pb-4 flex items-center gap-2">
              <input
                className="flex-1 bg-transparent text-3xl font-bold border-none placeholder:text-gray-300 focus:outline-none focus:ring-0 leading-tight"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="在这里输入引人入胜的标题..."
              />
              <button
                onClick={handleAiTitle}
                disabled={isGeneratingTitle}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${isGeneratingTitle ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-brand-blue text-white shadow-lg shadow-blue-200 hover:scale-105 active:scale-95'}`}
              >
                {isGeneratingTitle ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '✨'}
                AI 拟题
              </button>
            </div>

            {/* Formatting Toolbar */}
            <div className="px-8 py-2 flex items-center gap-1 border-b border-gray-100 bg-white sticky top-0 z-20">
              <div className="flex items-center gap-0.5 mr-2">
                {['bold', 'italic', 'underline'].map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => execCmd(cmd)}
                    className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                    title={cmd}
                  >
                    <Icon name={cmd as any} className="w-4 h-4" />
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-gray-200 mx-1"></div>

              <div className="flex items-center gap-1 mx-2">
                <button
                  onClick={() => execCmd('formatBlock', 'h2')}
                  className="px-2 py-1 text-xs font-black text-gray-700 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"
                  title="二级标题"
                >H2</button>
                <button
                  onClick={() => execCmd('formatBlock', 'blockquote')}
                  className="px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded"
                  title="引用"
                >Quote</button>
                <button
                  onClick={() => execCmd('insertUnorderedList')}
                  className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                  title="无序列表"
                >
                  <Icon name="menu" className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-4 bg-gray-200 mx-1"></div>

              <div className="flex items-center gap-1 mx-2">
                <button
                  onClick={() => execCmd('justifyLeft')}
                  className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-colors"
                  title="左对齐"
                >
                  <Icon name="align-left" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const container = selection.getRangeAt(0).commonAncestorContainer;
                      const element = container.nodeType === 3 ? container.parentElement : (container as HTMLElement);
                      if (element && (element.style.textAlign === 'center' || element.getAttribute('align') === 'center')) {
                        execCmd('justifyLeft');
                      } else {
                        execCmd('justifyCenter');
                      }
                    }
                  }}
                  className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-colors"
                  title="居中切换"
                >
                  <Icon name="align-center" className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-4 bg-gray-200 mx-1"></div>

              <div className="ml-2">
                <button
                  onClick={handleAutoIndent}
                  className="px-3 py-1 bg-blue-50 text-brand-blue text-[11px] font-bold rounded hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                  title="智能首行缩进"
                >智能缩进</button>
              </div>

              <div className="flex-1"></div>

              <div className="flex gap-2">
                <label className="cursor-pointer p-2 hover:bg-blue-50 text-brand-blue rounded transition-colors group relative">
                  <Icon name="image" className="w-4 h-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={e => handleFile(e, 'img')} />
                </label>
                <label className="cursor-pointer p-2 hover:bg-purple-50 text-purple-600 rounded transition-colors relative">
                  <Icon name="video" className="w-4 h-4" />
                  <input type="file" className="hidden" accept="video/*" onChange={e => handleFile(e, 'video')} />
                </label>
                <label className="cursor-pointer p-2 hover:bg-red-50 text-red-500 rounded transition-colors relative">
                  <Icon name="pdf" className="w-4 h-4" />
                  <input type="file" className="hidden" accept="application/pdf" onChange={e => handleFile(e, 'pdf')} />
                </label>
              </div>
            </div>

            {/* Editable Body */}
            <div className="flex-1 overflow-y-auto p-12 bg-white">
              <div
                ref={contentRef}
                className="sws-prose editor-area min-h-full focus:outline-none"
                contentEditable
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onBlur={saveSelection} // [新增] 失去焦点时保存光标
                style={{
                  fontSize: `${formData.fontSize}px`,
                  lineHeight: formData.lineHeight,
                  textAlign: 'justify'
                }}
              />
            </div>
          </div>

          {/* Right Panel: Settings & Meta */}
          <div className="w-[400px] flex flex-col bg-white overflow-y-auto scrollbar-hide border-l border-gray-100">
            <div className="p-8 flex flex-col gap-8">

              {/* Section: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">基础信息</h3>
                </div>

                <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                  {/* 仅在封面/封底显示分类管理 */}
                  {(formData.category === '封面' || formData.category === '封底') ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-gray-500 flex justify-between">
                        特殊页面类型 <button onClick={onManageCats} className="text-brand-blue hover:underline">管理</button>
                      </label>
                      <select
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:border-brand-blue outline-none"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ) : (
                    /* 普通文章显示标签输入 */
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                          <Icon name="search" className="w-2.5 h-2.5" /> 标签 / 关键词 (支持人工录入)
                        </label>
                      </div>
                      <div
                        className="flex flex-wrap gap-2 p-2 bg-white border border-gray-200 rounded-lg focus-within:border-brand-blue transition-all min-h-[42px] cursor-text"
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input');
                          if (input) input.focus();
                        }}
                      >
                        {(formData.tags || []).map((tag, idx) => (
                          <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-brand-blue text-[11px] font-bold rounded-md">
                            {tag}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newTags = (formData.tags || []).filter((_, i) => i !== idx);
                                setFormData({ ...formData, tags: newTags });
                              }}
                              className="hover:text-red-500"
                            >
                              <Icon name="maximize" className="w-2.5 h-2.5 rotate-45" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-gray-400"
                          placeholder={(formData.tags || []).length === 0 ? "点击输入标签，回车或空格分隔..." : "继续输入..."}
                          onBlur={(e) => {
                            const val = e.currentTarget.value.trim().replace(/[,，\s]+/g, ' ');
                            if (val) {
                              const newTags = val.split(' ').filter(t => t && !(formData.tags || []).includes(t));
                              if (newTags.length > 0) {
                                setFormData({ ...formData, tags: [...(formData.tags || []), ...newTags] });
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ' ') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim().replace(/[,，\s]/g, '');
                              if (val && !(formData.tags || []).includes(val)) {
                                setFormData({ ...formData, tags: [...(formData.tags || []), val] });
                                e.currentTarget.value = '';
                              }
                            }
                            // 退格键删除最后一个标签
                            if (e.key === 'Backspace' && e.currentTarget.value === '' && (formData.tags || []).length > 0) {
                              const newTags = (formData.tags || []).slice(0, -1);
                              setFormData({ ...formData, tags: newTags });
                            }
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 flex justify-between px-1">
                        <span>支持回车、空格、逗号分隔</span>
                        <span>{(formData.tags || []).length} / 10 个建议</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Typography */}
              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">排版控制</h3>
                <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                      <span>正文字号</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{formData.fontSize}px</span>
                    </div>
                    <input
                      type="range" min="12" max="36" step="1"
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                      value={formData.fontSize}
                      onChange={e => setFormData({ ...formData, fontSize: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                      <span>行间距</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{formData.lineHeight}x</span>
                    </div>
                    <input
                      type="range" min="1.0" max="3.0" step="0.1"
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                      value={formData.lineHeight}
                      onChange={e => setFormData({ ...formData, lineHeight: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* Section: AI Summary */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">摘要/导读 (Why & How)</h3>
                  <button
                    onClick={handleAiSummary}
                    disabled={isGeneratingAi}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${isGeneratingAi ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-brand-blue text-white shadow-lg shadow-blue-200 hover:scale-105 active:scale-95'}`}
                    title="一键生成标题与摘要"
                  >
                    {isGeneratingAi ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '✨'}
                    一键生成标题与摘要
                  </button>
                </div>
                <textarea
                  className="w-full h-[180px] bg-gray-50/50 border border-gray-100 rounded-xl p-4 text-[13px] leading-relaxed text-gray-600 focus:bg-white focus:border-brand-blue outline-none transition-all resize-none placeholder:text-gray-300"
                  placeholder={formData.pdfData ? "摘要/导读：建议重点总结 PDF 的核心内容及效益... 将展示在阅读器顶部。" : "点击上方按钮生成摘要，或者在这里手动输入... 摘要将展示在导出版的标题正下方。建议重点描述：为什么要开展此项工法？能带来哪些效益？"}
                  value={formData.abstract || ''}
                  onChange={e => setFormData({ ...formData, abstract: e.target.value })}
                />
              </div>

              {/* PDF Attached status */}
              {tempPdf && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm">
                      <Icon name="pdf" className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-[10px] font-bold text-red-600 uppercase tracking-tight">附件 PDF</div>
                      <div className="text-[11px] text-red-500 truncate max-w-[150px]">{tempPdf.name}</div>
                    </div>
                  </div>
                  <button onClick={() => setTempPdf(null)} className="p-2 hover:bg-white rounded-lg text-red-300 hover:text-red-600 transition-colors">
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50/30">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Icon name="lock" className="w-3 h-3" />
            所有更改已自动缓存到本地数据库
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-all font-bold text-xs shadow-sm"
            >
              放弃修改
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-2.5 bg-brand-blue text-white rounded-xl hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-0.5 transition-all font-bold text-xs shadow-lg active:translate-y-0"
            >
              保存并发布
            </button>
          </div>
        </div>
      </div >
    </div >
  );
};
