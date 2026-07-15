import { useCallback, useRef } from 'react';
import { debounce } from '../../../src/utils/debounce';

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

  /** 同步保存选区——用于 blur 等需要立即保存的场景，无防抖延迟 */
  const saveSelectionSync = useCallback(() => {
    saveSelectionFn();
  }, [saveSelectionFn]);

  return {
    lastRangeRef,
    saveSelection,
    saveSelectionSync,
    restoreSelection,
  };
}
