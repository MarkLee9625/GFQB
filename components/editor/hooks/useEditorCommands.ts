import { useCallback } from 'react';
import type { Article } from '../../../src/types';
import { generateArticleMeta, generateTitleOnly, scaleText } from '../../../services/aiService';

interface UseEditorCommandsOptions {
  contentRef: React.RefObject<HTMLDivElement | null>;
  formData: { title?: string | null; abstract?: string | null; tags?: string[] };
  setFormData: React.Dispatch<React.SetStateAction<Partial<Article>>>;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setIsGeneratingAi: (v: boolean) => void;
  setIsGeneratingTitle: (v: boolean) => void;
  setShowAiLoading: (v: boolean) => void;
  setShowTitleLoading: (v: boolean) => void;
  setIsScalingText: (v: boolean) => void;
  saveSelection: () => void;
  restoreSelection: () => void;
}

export function useEditorCommands({
  contentRef,
  formData,
  setFormData,
  setTitle,
  setIsGeneratingAi,
  setIsGeneratingTitle,
  setShowAiLoading,
  setShowTitleLoading,
  setIsScalingText,
  saveSelection,
  restoreSelection,
}: UseEditorCommandsOptions) {

  const execCmd = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
  }, []);

  const handleAutoIndent = useCallback(() => {
    if (!contentRef.current) return;
    const body = contentRef.current;

    const children = Array.from(body.childNodes);
    let currentWrapper: HTMLParagraphElement | null = null;

    children.forEach((node: ChildNode) => {
      const isBlock = node.nodeType === Node.ELEMENT_NODE &&
        /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|SECTION|ARTICLE|PRE|HR|TABLE)$/i.test((node as HTMLElement).tagName);

      if (!isBlock) {
        const isEmptyText = node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
        if (isEmptyText && !currentWrapper) return;

        if (!currentWrapper) {
          currentWrapper = document.createElement('p');
          body.insertBefore(currentWrapper, node);
        }
        currentWrapper.appendChild(node);
      } else {
        currentWrapper = null;
      }
    });

    const processNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        Array.from(el.children).forEach(child => processNode(child));

        if (el.classList.contains('pdf-summary-card')) return;

        if (tag === 'p') {
          const hasText = el.innerText.trim().length > 0;
          const hasMedia = el.querySelector('img, video, audio, iframe');

          if (hasText && !hasMedia) {
            el.style.textIndent = '2em';
            el.style.marginBottom = '0';
            el.style.textAlign = 'justify';
            el.style.lineHeight = '2.0';
          } else {
            el.style.textIndent = '0';
            el.style.textAlign = 'center';
            el.style.marginBottom = '0';
          }
        }
        else if (tag === 'div') {
          if (el.classList.contains('media-container')) return;

          if (!el.querySelector('img, video, audio, iframe')) {
            el.style.textIndent = '2em';
            el.style.marginBottom = '0';
            el.style.textAlign = 'justify';
          }
        }
      }
    };

    processNode(body);

    setFormData(prev => ({ ...prev, content: body.innerHTML }));
  }, [contentRef, setFormData]);

  const handleScaleText = useCallback(async (mode: 'expand' | 'shrink') => {
    const editorElement = contentRef.current;
    if (!editorElement) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      alert("请先用鼠标选中需要伸缩的文本段落！");
      return;
    }

    const selectedText = selection.toString();

    saveSelection();
    setIsScalingText(true);

    try {
      const aiResult = await scaleText(selectedText, mode);

      if (document.activeElement !== editorElement) {
        editorElement.focus();
      }
      restoreSelection();

      document.execCommand('insertText', false, aiResult);

      setFormData(prev => ({ ...prev, content: editorElement.innerHTML }));

      saveSelection();
    } catch (err) {
      alert(`AI ${mode === 'expand' ? '扩写' : '精简'}失败: ` + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setIsScalingText(false);
    }
  }, [contentRef, saveSelection, restoreSelection, setIsScalingText, setFormData]);

  const handleAiSummary = useCallback(async () => {
    const text = contentRef.current?.innerText || '';
    if (!text || text.length < 50) return alert("内容太少，AI 无法生成总结");

    if (formData.title && formData.title.trim() !== '' && formData.title !== '未命名文章') {
      if (!window.confirm("这将覆盖现有标题，确定继续吗？")) return;
    }

    setShowAiLoading(true);
    setIsGeneratingAi(true);
    try {
      const result = await generateArticleMeta(text);
      setFormData(prev => ({
        ...prev,
        abstract: result.abstract,
        title: result.title,
        tags: result.keywords || prev.tags
      }));
    } catch (err) {
      alert("AI 总结生成失败: " + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setShowAiLoading(false);
      setIsGeneratingAi(false);
    }
  }, [contentRef, formData.title, setFormData, setShowAiLoading, setIsGeneratingAi]);

  const handleAiTitle = useCallback(async () => {
    const text = contentRef.current?.innerText || '';
    if (!text || text.length < 50) return alert("内容太少，AI 无法生成标题");

    setShowTitleLoading(true);
    setIsGeneratingTitle(true);
    try {
      const title = await generateTitleOnly(text);
      setTitle(title);
    } catch (err) {
      alert("AI 标题生成失败: " + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setShowTitleLoading(false);
      setIsGeneratingTitle(false);
    }
  }, [contentRef, setTitle, setFormData, setShowTitleLoading, setIsGeneratingTitle]);

  const insertHtml = useCallback((htmlOrNode: string | Node) => {
    const editorElement = contentRef.current;
    if (!editorElement) return;

    if (document.activeElement !== editorElement) {
      editorElement.focus();
    }

    restoreSelection();

    if (typeof htmlOrNode === 'string') {
      const success = document.execCommand('insertHTML', false, htmlOrNode);
      if (!success) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const fragment = range.createContextualFragment(htmlOrNode);
          range.insertNode(fragment);
        }
      }
    } else {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(htmlOrNode);

        const newRange = document.createRange();
        newRange.setStartAfter(htmlOrNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        editorElement.appendChild(htmlOrNode);
      }
    }

    saveSelection();
  }, [contentRef, saveSelection, restoreSelection]);

  return {
    execCmd,
    handleAutoIndent,
    handleScaleText,
    handleAiSummary,
    handleAiTitle,
    insertHtml,
  };
}
