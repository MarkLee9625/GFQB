import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer, Suspense } from 'react';
import type { Article } from './src/types';
import { CONSTANTS, isSpecialCategory } from './src/constants';
import { db } from './services/db';
import { compressImage, fileToDataURL } from './src/utils/fileHelpers';
import { Icon } from './components/Icons';
import { PaperView } from './components/PaperView';
import { ErrorBoundary, DBErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import NavigationCapsule from './components/NavigationCapsule';
import { useMemoryMonitor } from './hooks/useMemoryMonitor';
import { useJournal } from './hooks/useJournal';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useExportManager } from './hooks/useExportManager';
import { useImportManager } from './hooks/useImportManager';
import { useArticleNavigation } from './hooks/useArticleNavigation';
import { useAiFeatures } from './hooks/useAiFeatures';
import MainLayout from './src/components/Layout/MainLayout';

const Editor = React.lazy(() => import('./components/Editor').then(m => ({ default: m.Editor })));
const KeyboardShortcutsHelpModal = React.lazy(() => import('./components/KeyboardShortcutsHelpModal'));
const CategoryManagerModal = React.lazy(() => import('./components/CategoryManagerModal'));
const ExportOptionsModal = React.lazy(() => import('./components/ExportOptionsModal'));
const AiCurationModal = React.lazy(() => import('./src/components/AiCurationModal'));

const LazyFallback = ({ error, onReset }: { error?: string; onReset?: () => void }) => (
  <div className="fixed inset-0 bg-white/95 z-[9999] flex flex-col items-center justify-center backdrop-blur-[4px]">
    <div className="relative mb-8">
      <div className="absolute inset-0 w-[100px] h-[100px] bg-blue-50 rounded-full animate-ping opacity-20"></div>
      <div className="relative w-[60px] h-[60px] border-[3px] border-blue-200 border-t-brand-blue rounded-full animate-spin"></div>
    </div>
    <div className="text-center max-w-md px-6">
      <div className="text-gray-700 text-lg font-bold mb-2 tracking-wide">
        {error ? '组件加载异常' : '加载中'}...
      </div>
      {error && (
        <div className="text-red-500 text-sm mb-4 font-medium">{error}</div>
      )}
      {error && (
        <button
          onClick={onReset || (() => window.location.reload())}
          className="px-6 py-2 bg-brand-blue text-white rounded-lg text-sm font-bold hover:bg-brand-dark transition-colors"
        >
          重试
        </button>
      )}
      {!error && (
        <div className="text-gray-500 text-sm font-medium">正在加载应用组件，请稍候</div>
      )}
    </div>
  </div>
);

const NavigationCapsuleMemo = React.memo(({
  sortedArticles, currentId, currentArticle, onNavigate, onShowShortcutsHelp
}: {
  sortedArticles: Article[];
  currentId: number | null;
  currentArticle: Article | undefined;
  onNavigate: (dir: 'prev' | 'next') => void;
  onShowShortcutsHelp: () => void;
}) => {
  const idx = sortedArticles.findIndex(a => a.id === currentId);
  const prev = idx > 0 ? sortedArticles[idx - 1] : null;
  const next = idx > -1 && idx < sortedArticles.length - 1 ? sortedArticles[idx + 1] : null;
  const isSpecial = isSpecialCategory(currentArticle?.category);

  return (
    <NavigationCapsule
      onPrev={() => onNavigate('prev')}
      onNext={() => onNavigate('next')}
      onShowShortcutsHelp={onShowShortcutsHelp}
      prevTitle={prev?.title}
      nextTitle={next?.title}
      isSpecialPage={isSpecial}
    />
  );
});

const AppContent: React.FC = () => {
  const {
    articles,
    currentId,
    loading,
    setCurrentId,
    updateArticle,
    createArticle,
    deleteArticle,
    reorderArticles,
    setArticlesAction
  } = useJournal();

  const [logo, setLogo] = useState<string>('');
  const [categories, setCategories] = useState<string[]>(CONSTANTS.DEFAULT_CATS);
  const [sidebarMeta, setSidebarMeta] = useState('[部门/内容]');
  const [searchQuery, setSearchQuery] = useState('');

  const [importProgress, setImportProgress] = useState<{ stage: string, details: string } | null>(null);
  const [exportOptions, setExportOptions] = useState({
    useAlternateDesign: false,
    includeImages: true,
    optimizeForPrint: false,
  });

  // 合并布尔 UI 状态 — useReducer 优化，减少闭包创建
  type UIState = {
    isEditMode: boolean;
    isSidebarHidden: boolean;
    isImmersive: boolean;
    isFullscreen: boolean;
    isEditorOpen: boolean;
    isCatManagerOpen: boolean;
    useAlternateDesign: boolean;
    isAiCurationModalOpen: boolean;
    isExportOptionsModalOpen: boolean;
    showShortcutsHelp: boolean;
  };

  type UIAction =
    | { key: keyof UIState; value: boolean }
    | { key: keyof UIState; updater: (prev: boolean) => boolean };

  function uiReducer(state: UIState, action: UIAction): UIState {
    const val = 'value' in action ? action.value : action.updater(state[action.key]);
    if (state[action.key] === val) return state;
    return { ...state, [action.key]: val };
  }

  const initialUIState: UIState = {
    isEditMode: true,
    isSidebarHidden: false,
    isImmersive: false,
    isFullscreen: false,
    isEditorOpen: false,
    isCatManagerOpen: false,
    useAlternateDesign: false,
    isAiCurationModalOpen: false,
    isExportOptionsModalOpen: false,
    showShortcutsHelp: false,
  };

  const [uiState, dispatchUI] = useReducer(uiReducer, initialUIState);

  const { isEditMode, isSidebarHidden, isImmersive, isFullscreen, isEditorOpen, isCatManagerOpen, useAlternateDesign, isAiCurationModalOpen, isExportOptionsModalOpen, showShortcutsHelp } = uiState;

  const makeSetter = (key: keyof UIState) => useCallback((v: boolean | ((p: boolean) => boolean)) => {
    if (typeof v === 'function') dispatchUI({ key, updater: v as (prev: boolean) => boolean });
    else dispatchUI({ key, value: v });
  }, []);

  const setIsEditMode = makeSetter('isEditMode');
  const setIsSidebarHidden = makeSetter('isSidebarHidden');
  const setIsImmersive = makeSetter('isImmersive');
  const setIsFullscreen = makeSetter('isFullscreen');
  const setIsEditorOpen = makeSetter('isEditorOpen');
  const setIsCatManagerOpen = makeSetter('isCatManagerOpen');
  const setUseAlternateDesign = makeSetter('useAlternateDesign');
  const setIsAiCurationModalOpen = makeSetter('isAiCurationModalOpen');
  const setIsExportOptionsModalOpen = makeSetter('isExportOptionsModalOpen');
  const setShowShortcutsHelp = makeSetter('showShortcutsHelp');

  const openExportOptionsModal = useCallback(() => {
    setExportOptions(prev => ({
      ...prev,
      useAlternateDesign,
    }));
    setIsExportOptionsModalOpen(true);
  }, [useAlternateDesign]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const uploadTypeRef = useRef<'cover' | 'back'>('cover');
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useAppInitialization({
    setLogo,
    setSidebarMeta,
    setCategories,
    setArticlesAction,
    setCurrentId,
    setIsEditMode,
    setIsSidebarHidden,
    setUseAlternateDesign,
    loading,
  });

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const handleGraphMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data && event.data.type === 'GRAPH_SEARCH_KEYWORD') {
        const keyword = event.data.keyword;
        // @ts-ignore
        const found = window.find(keyword, false, false, true, false, false, false);
        if (!found) {
          // @ts-ignore
          window.find(keyword, false, true, true, false, false, false);
        }
      }

      // GRAPH_REQUEST_DATA handler removed: data is now embedded directly in srcdoc
    };

    window.addEventListener('message', handleGraphMessage);
    return () => window.removeEventListener('message', handleGraphMessage);
  }, []);

  useEffect(() => {
    if (!loading) {
      db.save(CONSTANTS.KEY, { logo, sidebarMetaText: sidebarMeta }).catch((e: unknown) => {
        console.error('配置保存失败', e);
        alert('配置保存失败，请刷新页面重试');
      });
    }
  }, [logo, sidebarMeta, loading]);

  useEffect(() => {
    localStorage.setItem('SWS_CATS_REACT', JSON.stringify(categories));
  }, [categories]);

  const currentArticle = useMemo(() => articles.find(a => a.id === currentId), [articles, currentId]);

  const handleTogglePublish = useCallback(() => {
    if (!currentId || !currentArticle) return;
    const newPublishedState = !currentArticle.isPublished;
    updateArticle(currentId, { isPublished: newPublishedState });
  }, [currentId, currentArticle, updateArticle]);

  const handleSaveArticle = useCallback(async (updated: Partial<Article>) => {
    if (updated.id) {
      updateArticle(updated.id, updated);
      setIsEditorOpen(false);
    } else {
      const newArt = await createArticle(updated);
      if (newArt) setIsEditorOpen(false);
    }
  }, [updateArticle, createArticle]);

  const handleReset = useCallback(() => {
    if (!window.confirm("⚠️ 警告：这将清空所有数据并开始新一期！确定吗？")) return;
    const now = Date.now() + Math.floor(Math.random() * 1000);
    const fresh: Article[] = [
      { id: now, title: "封面", category: "封面", content: "", issueText: "NO.01", dateText: "JAN " + new Date().getFullYear() },
      { id: now + 1, title: "封底", category: "封底", content: "" }
    ];
    setArticlesAction(fresh);
    setCurrentId(fresh[0].id);
  }, [setArticlesAction, setCurrentId]);

  const toggleReadingMode = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.warn);
      setIsSidebarHidden(true);
      setIsImmersive(true);
    } else {
      document.exitFullscreen();
      const art = articles.find(a => a.id === currentId);
      const isSpecial = isSpecialCategory(art?.category);
      if (!isSpecial) {
        setIsSidebarHidden(false);
        setIsImmersive(false);
      }
    }
  }, [articles, currentId]);

  const handleImageUploadTrigger = useCallback((type: 'cover' | 'back') => {
    uploadTypeRef.current = type;
    coverInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentId) return;
    try {
      const base64 = await fileToDataURL(file);
      const isCoverUpload = uploadTypeRef.current === 'cover' || uploadTypeRef.current === 'back';
      const compressedBase64 = await compressImage(base64, isCoverUpload ? 2400 : 1200, isCoverUpload ? 0.92 : 0.8, isCoverUpload ? 'original' : 'webp');
      if (uploadTypeRef.current === 'cover') {
        updateArticle(currentId, { coverImage: compressedBase64 });
      } else {
        updateArticle(currentId, { backImage: compressedBase64 });
      }
    } catch (error) {
      console.error('图片压缩失败:', error);
      alert('图片上传压缩失败，请重试');
    }
    e.target.value = '';
  }, [currentId, updateArticle]);

  const handleDelete = useCallback(() => {
    if (currentId) deleteArticle(currentId);
  }, [currentId, deleteArticle]);

  const handleRenameCategory = useCallback((oldName: string, newName: string) => {
    const updatedArticles = articles.map(article =>
      article.category === oldName ? { ...article, category: newName } : article
    );
    setArticlesAction(updatedArticles);
    setCategories(prev => prev.map(cat => cat === oldName ? newName : cat));
  }, [articles, setArticlesAction]);

  const { handleExport, handleExportWithOptions } = useExportManager({
    articles,
    logo,
    sidebarMeta,
    useAlternateDesign,
    openExportOptionsModal,
  });

  const { handleImport } = useImportManager({
    setArticlesAction,
    setLogo,
    setSidebarMeta,
    setCategories,
  });

  const { sortedArticles, handleSelectArticle, handleNavigate } = useArticleNavigation({
    articles,
    currentId,
    searchQuery,
    setCurrentId,
    setIsImmersive,
    setIsSidebarHidden,
    contentScrollRef,
  });

  const { handleGenerateForeword, handleGenerateGraph, handleForceGenerateGraph, handleAdoptArticle } = useAiFeatures({
    articles,
    createArticle,
    setCurrentId,
    setImportProgress,
    importProgress,
  });

  const handleExportRef = useRef<((isReader: boolean, categories?: string[]) => void) | null>(null);
  const toggleReadingModeRef = useRef<(() => void) | null>(null);
  const handleDeleteRef = useRef<(() => void) | null>(null);
  const handleNavigateRef = useRef<((direction: 'prev' | 'next') => void) | null>(null);

  handleExportRef.current = handleExport;
  toggleReadingModeRef.current = toggleReadingMode;
  handleDeleteRef.current = handleDelete;
  handleNavigateRef.current = handleNavigate;

  useKeyboardShortcuts({
    currentId,
    isEditorOpen,
    isCatManagerOpen,
    showShortcutsHelp,
    setIsEditorOpen,
    setCurrentId,
    setIsSidebarHidden,
    setShowShortcutsHelp,
    handleExportRef,
    toggleReadingModeRef,
    handleDeleteRef,
    handleNavigateRef,
  });

  useMemoryMonitor(150);

  const handleNextArticle = useCallback(() => {
    handleNavigateRef.current?.('next');
  }, []);

  const handleFloatMenuClick = useCallback(() => setIsSidebarHidden(false), []);
  const handleToggleSidebar = useCallback(() => setIsSidebarHidden(true), []);
  const handleLogoUpload = useCallback(() => logoInputRef.current?.click(), []);
  const handleToggleEditMode = useCallback(() => setIsEditMode(prev => !prev), []);
  const handleNewArticle = useCallback(() => { setIsEditorOpen(true); setCurrentId(null); }, []);
  const handleEditArticle = useCallback(() => { if (currentId) setIsEditorOpen(true); }, [currentId]);
  const handleImportClick = useCallback(() => importInputRef.current?.click(), []);
  const handleExportReader = useCallback(() => handleExport(true, categories), [handleExport, categories]);
  const handleExportProject = useCallback(() => handleExport(false, categories), [handleExport, categories]);
  const handleOpenAiCuration = useCallback(() => setIsAiCurationModalOpen(true), []);
  const handleShowShortcutsHelp = useCallback(() => setShowShortcutsHelp(true), []);
  const handleCloseShortcutsHelp = useCallback(() => setShowShortcutsHelp(false), []);
  const handleCloseEditor = useCallback(() => setIsEditorOpen(false), []);
  const handleManageCats = useCallback(() => setIsCatManagerOpen(true), []);
  const handleCloseCatManager = useCallback(() => setIsCatManagerOpen(false), []);
  const handleCloseExportOptions = useCallback(() => setIsExportOptionsModalOpen(false), []);
  const handleCloseAiCuration = useCallback(() => setIsAiCurationModalOpen(false), []);
  const handleExportConfirm = useCallback(async (options: any, onProgress?: (percent: number, message?: string) => void) => {
    await handleExportWithOptions(options, onProgress);
  }, [handleExportWithOptions]);

  return (
    <MainLayout
      isLoading={loading || !!importProgress}
      loadingMessage={importProgress?.details}
      isSidebarHidden={isSidebarHidden}
      isImmersive={isImmersive}
      onFloatMenuClick={handleFloatMenuClick}
      contentScrollRef={contentScrollRef}
      sidebar={
        <Sidebar
          articles={articles}
          displayArticles={sortedArticles}
          currentId={currentId}
          logo={logo}
          sidebarMeta={sidebarMeta}
          searchQuery={searchQuery}
          isEditMode={isEditMode}
          isSidebarHidden={isSidebarHidden}
          onSelectArticle={handleSelectArticle}
          onToggleSidebar={handleToggleSidebar}
          onSearchChange={setSearchQuery}
          onSidebarMetaChange={setSidebarMeta}
          onLogoUpload={handleLogoUpload}
          onToggleEditMode={handleToggleEditMode}
          onReorder={reorderArticles}
        />
      }
      toolbar={
        <Toolbar
          currentId={currentId}
          isFullscreen={isFullscreen}
          onNewArticle={handleNewArticle}
          onEditArticle={handleEditArticle}
          onImport={handleImportClick}
          onToggleFullscreen={toggleReadingMode}
          onDelete={handleDelete}
          onReset={handleReset}
          onExportReader={handleExportReader}
          onExportProject={handleExportProject}
          isPublished={currentArticle?.isPublished || false}
          onTogglePublish={handleTogglePublish}
          onGenerateForeword={handleGenerateForeword}
          onGenerateGraph={handleGenerateGraph}
          onForceGenerateGraph={handleForceGenerateGraph}
          onOpenAiCuration={handleOpenAiCuration}
        />
      }
      content={
        !currentArticle ? (
          <div className="text-center text-gray-300 mt-[200px]">
            <p>请选择左侧文档</p>
          </div>
            ) : (
            <div className="flex flex-col w-full h-auto pb-12 relative bg-white rounded-lg shadow-sm">
              <PaperView
                article={currentArticle}
                logo={logo}
                isEditMode={isEditMode}
                onUpdate={updateArticle}
                onImageUpload={handleImageUploadTrigger}
                onNext={handleNextArticle}
                useAlternateDesign={useAlternateDesign}
                setUseAlternateDesign={setUseAlternateDesign}
              />

              <div className="flex justify-center w-full pt-4 pb-8">
                <NavigationCapsuleMemo
                  sortedArticles={sortedArticles}
                  currentId={currentId}
                  currentArticle={currentArticle}
                  onNavigate={handleNavigate}
                  onShowShortcutsHelp={handleShowShortcutsHelp}
                />
              </div>
            </div>
        )
      }
      modals={
        <ErrorBoundary fallbackRender={(error, reset) => <LazyFallback error={error.message} onReset={reset} />}>
          <Suspense fallback={<LazyFallback />}>
            <KeyboardShortcutsHelpModal
              isOpen={showShortcutsHelp}
              onClose={handleCloseShortcutsHelp}
            />
            <Editor
              isOpen={isEditorOpen}
              article={currentArticle || {}}
              categories={categories}
              onClose={handleCloseEditor}
              onSave={handleSaveArticle}
              onManageCats={handleManageCats}
            />
            <CategoryManagerModal
              isOpen={isCatManagerOpen}
              categories={categories}
              onClose={handleCloseCatManager}
              onUpdateCategories={setCategories}
              onRenameCategory={handleRenameCategory}
            />
            <ExportOptionsModal
              isOpen={isExportOptionsModalOpen}
              currentUseAlternateDesign={useAlternateDesign}
              onClose={handleCloseExportOptions}
              onConfirm={handleExportConfirm}
            />
            <AiCurationModal
              isOpen={isAiCurationModalOpen}
              onClose={handleCloseAiCuration}
              onAdopt={handleAdoptArticle}
            />
          </Suspense>
        </ErrorBoundary>
      }
      hiddenInputs={
        <>
          <input type="file" ref={importInputRef} className="hidden" accept=".html,.json" onChange={handleImport} />
          <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) fileToDataURL(f).then((b64) => compressImage(b64 as string, 400, 0.8)).then((compressed) => setLogo(compressed)).catch(err => { console.error("Logo 上传失败", err); });
          }} />
          <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        </>
      }
    />
  );
};

const App: React.FC = () => {
  return (
    <DBErrorBoundary>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </DBErrorBoundary>
  );
};

export default App;
