import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  currentId: number | null;
  isEditorOpen: boolean;
  showShortcutsHelp: boolean;
  setIsEditorOpen: (v: boolean) => void;
  setCurrentId: (id: number | null) => void;
  setIsSidebarHidden: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShortcutsHelp: (v: boolean) => void;
  handleExportRef: React.MutableRefObject<((isReader: boolean, categories?: string[]) => void) | null>;
  toggleReadingModeRef: React.MutableRefObject<(() => void) | null>;
  handleDeleteRef: React.MutableRefObject<(() => void) | null>;
  handleNavigateRef: React.MutableRefObject<((direction: 'prev' | 'next') => void) | null>;
}

export function useKeyboardShortcuts({
  currentId,
  isEditorOpen,
  showShortcutsHelp,
  setIsEditorOpen,
  setCurrentId,
  setIsSidebarHidden,
  setShowShortcutsHelp,
  handleExportRef,
  toggleReadingModeRef,
  handleDeleteRef,
  handleNavigateRef,
}: UseKeyboardShortcutsOptions) {
  const stateRef = useRef({
    currentId,
    isEditorOpen,
    showShortcutsHelp,
    setIsEditorOpen,
    setCurrentId,
    setIsSidebarHidden,
    setShowShortcutsHelp,
  });
  stateRef.current = {
    currentId,
    isEditorOpen,
    showShortcutsHelp,
    setIsEditorOpen,
    setCurrentId,
    setIsSidebarHidden,
    setShowShortcutsHelp,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        currentId: curId,
        isEditorOpen: editorOpen,
        showShortcutsHelp: shortcutsOpen,
        setIsEditorOpen: setEditorOpen,
        setCurrentId: setCurId,
        setIsSidebarHidden: setSidebarHidden,
        setShowShortcutsHelp: setShortcutsOpen,
      } = stateRef.current;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleExportRef.current?.(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleExportRef.current?.(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (!editorOpen) {
          setEditorOpen(true);
          setCurId(null);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        toggleReadingModeRef.current?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setSidebarHidden(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateRef.current?.('prev');
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateRef.current?.('next');
        return;
      }

      if (e.key === 'Escape') {
        if (editorOpen) {
          setEditorOpen(false);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        return;
      }

      if (e.key === 'Delete' && curId) {
        e.preventDefault();
        handleDeleteRef.current?.();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
