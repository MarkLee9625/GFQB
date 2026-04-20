import { useEffect, useRef } from 'react';

interface UseEditorKeyboardOptions {
  isOpen: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  formDataRef: React.MutableRefObject<any>;
  onSaveRef: React.MutableRefObject<(article: any) => void>;
  setSaveToast: (v: string | null) => void;
  execCmd: (cmd: string, val?: string) => void;
}

export function useEditorKeyboard({
  isOpen,
  contentRef,
  formDataRef,
  onSaveRef,
  setSaveToast,
  execCmd,
}: UseEditorKeyboardOptions) {
  const timeoutIdsRef = useRef<number[]>([]);
  const handleKeysRef = useRef<(e: KeyboardEvent) => void>(() => {});

  handleKeysRef.current = (e: KeyboardEvent) => {
    if (!isOpen) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        const data = { ...formDataRef.current, content: contentRef.current?.innerHTML || '' };
        if (!data.title) return;
        onSaveRef.current(data);
        setSaveToast('已自动保存');
        const tid = window.setTimeout(() => setSaveToast(null), 1500);
        timeoutIdsRef.current.push(tid);
      }
    }

    if (e.altKey && e.key === '2') {
      e.preventDefault();
      execCmd('formatBlock', '<h2>');
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);

      if (!range.collapsed) {
        if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
          const startNode = (range.startContainer as HTMLElement).childNodes[range.startOffset];
          if (startNode && startNode.nodeType === Node.ELEMENT_NODE && (startNode as HTMLElement).classList.contains('media-container')) {
            e.preventDefault();
            (startNode as HTMLElement).remove();
            return;
          }
        }
        return;
      }

      const isMediaContainer = (element: Element): boolean => {
        return element.classList.contains('media-container');
      };

      const container = range.commonAncestorContainer;

      if (container.nodeType === Node.ELEMENT_NODE && (container as HTMLElement).tagName === 'P') {
        const p = container as HTMLElement;
        const isEmpty = p.innerHTML === '' || p.innerHTML === '<br>' || p.children.length === 0;
        if (isEmpty) {
          const prev = p.previousElementSibling;
          if (prev && isMediaContainer(prev)) {
            e.preventDefault();
            prev.remove();
            const parent = p.parentNode;
            if (parent) {
              const newRange = document.createRange();
              const index = Array.from(parent.childNodes).indexOf(p);
              newRange.setStart(parent, index);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
              p.remove();
            }
            return;
          }
        }
      }

      if (range.startOffset === 0) {
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

      let node: Node | null = container;
      while (node && node !== contentRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const prev = element.previousElementSibling;
          if (prev && isMediaContainer(prev)) {
            if (range.startOffset === 0) {
              e.preventDefault();
              prev.remove();
              const newRange = document.createRange();
              newRange.setStart(element, 0);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          }
          break;
        }
        node = node.parentNode;
      }
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeysRef.current?.(e);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
    };
  }, []);
}
