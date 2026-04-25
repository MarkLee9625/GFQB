import { useCallback, useRef } from 'react';

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  }) as T;
}

export function useSelectionManager() {
  const lastRangeRef = useRef<Range | null>(null);

  const saveSelectionFn = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      lastRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  const saveSelection = useCallback(
    debounce(saveSelectionFn, 200),
    [saveSelectionFn]
  );

  const restoreSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && lastRangeRef.current) {
      try {
        selection.removeAllRanges();
        selection.addRange(lastRangeRef.current);
      } catch {
        lastRangeRef.current = null;
      }
    }
  }, []);

  return {
    lastRangeRef,
    saveSelection,
    restoreSelection,
  };
}
