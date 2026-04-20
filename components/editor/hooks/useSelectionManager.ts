import { useCallback, useRef } from 'react';

export function useSelectionManager() {
  const lastRangeRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      lastRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

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
