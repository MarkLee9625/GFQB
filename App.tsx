import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Article, CONSTANTS } from './types';
import { db } from './services/db';
import { compressImage, fileToDataURL } from './src/utils/fileHelpers';
import { Icon } from './components/Icons';
import { PaperView } from './components/PaperView';
import { Editor } from './components/Editor';
import { ErrorBoundary, DBErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import KeyboardShortcutsHelpModal from './components/KeyboardShortcutsHelpModal';
import NavigationCapsule from './components/NavigationCapsule';
import LoadingOverlay from './components/LoadingOverlay';
import CategoryManagerModal from './components/CategoryManagerModal';
import ExportOptionsModal from './components/ExportOptionsModal';
import { useMemoryMonitor } from './hooks/useMemoryMonitor';
import { useJournal } from './hooks/useJournal';
import { fetchWechatArticle } from './services/wechatImporter';
import { generateReaderHTML, generatePrintableHTML, exportToPdf, PdfExportOptions } from './src/services/export';
import MainLayout from './src/components/Layout/MainLayout';

const AppContent: React.FC = () => {
  // 使用 useJournal 管理文章状态
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

  // State
  const [logo, setLogo] = useState<string>('');
  const [categories, setCategories] = useState<string[]>(CONSTANTS.DEFAULT_CATS);
  const [sidebarMeta, setSidebarMeta] = useState('[部门/内容]');
  const [searchQuery, setSearchQuery] = useState('');

  // UI State
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false); // Controls Layout (Full width vs Padded)
  const [isFullscreen, setIsFullscreen] = useState(false); // Controls Real Fullscreen API state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [useAlternateDesign, setUseAlternateDesign] = useState(false); // 控制是否使用杂志风设计
  const [importProgress, setImportProgress] = useState<{ stage: string, details: string } | null>(null);

  // Export Options Modal State
  const [isExportOptionsModalOpen, setIsExportOptionsModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    useAlternateDesign: false,
    includeImages: true,
    optimizeForPrint: false,
  });

  const openExportOptionsModal = () => {
    setExportOptions(prev => ({
      ...prev,
      useAlternateDesign, // 默认使用当前的设计风格
    }));
    setIsExportOptionsModalOpen(true);
  };

  // Refs for uploads
  const importInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const uploadTypeRef = useRef<'cover' | 'back'>('cover');

  // Keyboard shortcuts state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [isExportOptionsOpen, setIsExportOptionsOpen] = useState(false);

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        // 0. Check for Embedded Reader Data (Priority)
        // @ts-ignore
        if (window.__SWS_DATA_ARTICLES_B64__) {
          try {
            // @ts-ignore
            const b64Data = window.__SWS_DATA_ARTICLES_B64__;
            const decoded = decodeURIComponent(escape(atob(b64Data)));
            const jsonData = JSON.parse(decoded);

            if (Array.isArray(jsonData)) {
              console.log("📚 Reader Mode: Data loaded from embedded source");
              setArticlesAction(jsonData);

              // Initialize Reader UI State
              setIsEditMode(false);
              setIsSidebarHidden(true); // Default hide sidebar for immersive reading
              setIsImmersive(false); // Can interpret this as needed, maybe default to normal or immersive

              // Load Config if available
              // @ts-ignore
              if (window.__SWS_DATA_CONFIG_B64__) {
                // @ts-ignore
                const b64Config = window.__SWS_DATA_CONFIG_B64__;
                const cfg = JSON.parse(decodeURIComponent(escape(atob(b64Config))));
                if (cfg.logo) setLogo(cfg.logo);
                if (cfg.sidebarMeta) setSidebarMeta(cfg.sidebarMeta);
                if (cfg.alternateDesign) setUseAlternateDesign(cfg.alternateDesign);
              }

              // Set initial article (likely cover)
              if (jsonData.length > 0) setCurrentId(jsonData[0].id);
              return; // SKIP DB Load if running as Reader
            }
          } catch (e) {
            console.error("Reader Mode Init Error", e);
          }
        }

        // 1. Normal DB Init
        await db.init();
        const storedData = await db.load(CONSTANTS.KEY);
        if (storedData) {
          setLogo(storedData.logo || '');
          setSidebarMeta(storedData.sidebarMetaText || '[部门/内容]');
        }

        const localCats = localStorage.getItem('SWS_CATS_REACT');
        if (localCats) setCategories(JSON.parse(localCats));

      } catch (e) {
        console.error("DB Error", e);
      }
    };
    init();
  }, []);

  // 临时Blob URL管理（用于导出）
  const exportBlobUrls = useRef<string[]>([]);
  const exportTimers = useRef<NodeJS.Timeout[]>([]);

  const addTemporaryBlobUrl = useCallback((url: string) => {
    exportBlobUrls.current.push(url);
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      exportBlobUrls.current = exportBlobUrls.current.filter(u => u !== url);
      const index = exportTimers.current.indexOf(timer);
      if (index > -1) {
        exportTimers.current.splice(index, 1);
      }
    }, 5 * 60 * 1000); // 5分钟后自动清理
    exportTimers.current.push(timer);
  }, []);

  // 立即清理所有临时Blob URL
  const cleanupTemporaryBlobUrls = useCallback(() => {
    exportBlobUrls.current.forEach(url => URL.revokeObjectURL(url));
    exportBlobUrls.current = [];
    exportTimers.current.forEach(timer => clearTimeout(timer));
    exportTimers.current = [];
  }, []);

  // 清理临时Blob URL的effect
  useEffect(() => {
    return () => {
      cleanupTemporaryBlobUrls();
    };
  }, [cleanupTemporaryBlobUrls]);

  // Track Fullscreen State
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + S: Save (export project)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleExport(false);
        return;
      }

      // Ctrl/Cmd + E: Export reader version
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleExport(true);
        return;
      }

      // Ctrl/Cmd + N: New article
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsEditorOpen(true);
        setCurrentId(null);
        return;
      }

      // Ctrl/Cmd + F: Toggle fullscreen
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        toggleReadingMode();
        return;
      }

      // Ctrl/Cmd + H: Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setIsSidebarHidden(prev => !prev);
        return;
      }

      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isEditorOpen) {
          // 编辑器内部已经处理了 Ctrl+S，这里主要是全局反馈
          console.log("Saving via Editor...");
        } else {
          alert("进度已自动同步至本地存储");
        }
        return;
      }

      // Ctrl/Cmd + /: Show shortcuts help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcutsHelp(true);
        return;
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigate('prev');
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigate('next');
        return;
      }

      // Escape: Close modals or exit fullscreen
      if (e.key === 'Escape') {
        if (isEditorOpen) {
          setIsEditorOpen(false);
        } else if (isCatManagerOpen) {
          setIsCatManagerOpen(false);
        } else if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        return;
      }

      // Delete key for deleting current article
      if (e.key === 'Delete' && currentId) {
        e.preventDefault();
        handleDelete();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentId, isEditorOpen, isCatManagerOpen, showShortcutsHelp]);

  // Persistence Helper
  const saveToDB = async (data: Article[], l: string, meta: string) => {
    await db.save(CONSTANTS.KEY, { data, logo: l, sidebarMetaText: meta });
  };

  useEffect(() => {
    if (!loading) saveToDB(articles, logo, sidebarMeta);
  }, [articles, logo, sidebarMeta, loading]);

  useEffect(() => {
    localStorage.setItem('SWS_CATS_REACT', JSON.stringify(categories));
  }, [categories]);

  // Article Management
  const sortedArticles = React.useMemo(() => {
    return articles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [articles, searchQuery]);

  const currentArticle = articles.find(a => a.id === currentId);

  const handleSaveArticle = async (updated: Partial<Article>) => {
    if (updated.id) {
      updateArticle(updated.id, updated);
    } else {
      const newArt = await createArticle(updated);
      if (newArt) setIsEditorOpen(false); // 成功后关闭
    }
    setIsEditorOpen(false); // 确保关闭
  };

  const handleReset = () => {
    if (!window.confirm("⚠️ 警告：这将清空所有数据并开始新一期！确定吗？")) return;
    const now = Date.now();
    const fresh: Article[] = [
      { id: now, title: "封面", category: "封面", content: "", issueText: "NO.01", dateText: "JAN " + new Date().getFullYear() },
      { id: now + 1, title: "封底", category: "封底", content: "" }
    ];
    setArticlesAction(fresh);
    setCurrentId(fresh[0].id);
  };

  // UI Actions
  const toggleReadingMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.warn);
      setIsSidebarHidden(true);
      setIsImmersive(true);
    } else {
      document.exitFullscreen();
      // Logic: If on Cover/Back, keep immersive layout (full width).
      // If on Normal article, restore standard layout.
      const art = articles.find(a => a.id === currentId);
      const isSpecial = art?.category === '封面' || art?.category === '封底';
      if (!isSpecial) {
        setIsSidebarHidden(false);
        setIsImmersive(false);
      }
    }
  };

  // 注意：normalizeArticles 函数已移除，因为 useJournal 的 enforceOrder 已经处理排序

  const handleSelectArticle = (id: any) => {
    const numId = Number(id);
    setCurrentId(numId);
    const art = articles.find(a => a.id === numId);
    const isSpecial = art?.category === '封面' || art?.category === '封底';

    if (isSpecial) {
      setIsImmersive(true);
      setIsSidebarHidden(true);
    } else {
      setIsImmersive(false);
      setIsSidebarHidden(false);
    }
  };

  const handleImportWechat = async () => {
    const url = window.prompt('请输入微信公众号文章链接:');
    if (!url) return;

    setImportProgress({ stage: 'starting', details: '准备开始抓取...' });

    try {
      const result = await fetchWechatArticle(url, (stage, details) => {
        setImportProgress({ stage, details });
      });

      setImportProgress({ stage: 'saving', details: '正在保存到本地库...' });

      const newItem: Partial<Article> = {
        title: result.title,
        category: '智能制造',
        content: result.content,
        date: result.date || new Date().toISOString().slice(0, 10),
        fontSize: 18,
        lineHeight: 2.0
      };

      const newArt = await createArticle(newItem);
      if (newArt) {
        setCurrentId(newArt.id);
        // 成功后延迟清空，让用户看到“导入成功”的提示（如果需要的话，或者直接清空）
        setImportProgress(null);
        setTimeout(() => alert('导入成功！'), 100);
      }
    } catch (err) {
      setImportProgress(null);
      alert('导入失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // Navigation Logic
  const handleNavigate = (direction: 'prev' | 'next') => {
    const idx = sortedArticles.findIndex(a => a.id === currentId);
    if (direction === 'prev' && idx > 0) {
      handleSelectArticle(sortedArticles[idx - 1].id);
    } else if (direction === 'next' && idx > -1 && idx < sortedArticles.length - 1) {
      handleSelectArticle(sortedArticles[idx + 1].id);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentId) return;
    fileToDataURL(file).then(base64 => {
      if (uploadTypeRef.current === 'cover') updateArticle(currentId, { coverImage: base64 as string });
      else updateArticle(currentId, { backImage: base64 as string });
    });
    e.target.value = '';
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        // 1. 尝试直接作为 JSON 解析 (适配纯 JSON 导出)
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            setArticlesAction(json);
            return;
          }
        } catch (e) { /* 不是纯 JSON，继续 */ }

        // 2. 尝试从 HTML 中提取数据 (适配 HTML 导出)
        // 优先查找 Base64 加密格式 (新版)
        const b64ArticlesMatch = text.match(/window\.__SWS_DATA_ARTICLES_B64__\s*=\s*"(.*?)";/);
        if (b64ArticlesMatch && b64ArticlesMatch[1]) {
          try {
            const decoded = decodeURIComponent(escape(atob(b64ArticlesMatch[1])));
            setArticlesAction(JSON.parse(decoded));

            const configMatch = text.match(/window\.__SWS_DATA_CONFIG_B64__\s*=\s*"(.*?)";/);
            if (configMatch && configMatch[1]) {
              const cfg = JSON.parse(decodeURIComponent(escape(atob(configMatch[1]))));
              if (cfg.logo) setLogo(cfg.logo);
              if (cfg.sidebarMeta) setSidebarMeta(cfg.sidebarMeta);
            }
            return;
          } catch (e) { console.error("Base64 Decode Error:", e); }
        }

        // 兜底查找注释格式 (旧版) - 使用正则直接从文本提取，防止 DOMParser 截断长注释
        const extractFromComment = (marker: string) => {
          const regex = new RegExp(`<!--\\s*${marker}\\s*([\\s\\S]*?)\\s*${marker.split(' ')[0]} END\\s*-->`);
          const match = text.match(regex);
          return match ? match[1].trim() : null;
        };

        const rawData = extractFromComment('DATA START');
        const rawLogo = extractFromComment('LOGO START');
        const rawCats = extractFromComment('CAT START');

        if (rawData) setArticlesAction(JSON.parse(rawData));
        if (rawLogo) setLogo(rawLogo);
        if (rawCats) setCategories(JSON.parse(rawCats));

      } catch (err) {
        console.error("Import Parse Error:", err);
        alert("导入失败：文件格式不正确或已损坏");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 使用内存监控Hook（开发环境）
  useMemoryMonitor(150);

  const createExportBlob = (content: string) => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    addTemporaryBlobUrl(url); // 添加到临时管理器，5分钟后自动清理

    // 设置一个较短的超时（1分钟）清理这个特定的URL，因为下载后可能不需要长时间保留
    const shortTimer = setTimeout(() => {
      URL.revokeObjectURL(url);
      // 从数组中移除
      exportBlobUrls.current = exportBlobUrls.current.filter(u => u !== url);
      const index = exportTimers.current.indexOf(shortTimer);
      if (index > -1) {
        exportTimers.current.splice(index, 1);
      }
    }, 60 * 1000); // 1分钟后清理
    exportTimers.current.push(shortTimer);

    return url;
  };


  // 新的导出函数，接收选项参数
  const handleExportWithOptions = async (options: {
    useAlternateDesign: boolean;
    includeImages: boolean;
    optimizeForPrint: boolean;
    exportType: 'reader' | 'printable' | 'pdf';
  }) => {
    try {
      if (options.exportType === 'pdf') {
        // 使用PDF双核导出引擎
        const pdfOptions: PdfExportOptions = {
          useAlternateDesign: options.useAlternateDesign,
          includeImages: options.includeImages,
          optimizeForPrint: options.optimizeForPrint,
          logo: logo // 传递Logo信息
        };
        await exportToPdf(articles, pdfOptions);
      } else {
        let htmlContent: string;
        let fileName: string;

        if (options.exportType === 'printable') {
          htmlContent = await generatePrintableHTML(articles, options, { logo, sidebarMeta });
          fileName = `SWS_Printable_${new Date().toISOString().slice(0, 10)}.html`;
        } else {
          htmlContent = await generateReaderHTML(articles, options, { logo, sidebarMeta });
          fileName = `SWS_Reader_${new Date().toISOString().slice(0, 10)}.html`;
        }

        const url = createExportBlob(htmlContent);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出过程中发生错误，请查看控制台。');
    }
  };

  // 旧的handleExport函数，保持向后兼容，默认使用当前状态
  const handleExport = (isReader: boolean) => {
    if (isReader) {
      // 打开导出选项模态框
      openExportOptionsModal();
      return;
    }

    // Project Export (JSON Data wrapper) - 保持不变
    const content = `<!-- DATA START ${JSON.stringify(articles)} DATA END -->` +
      `<!-- LOGO START ${logo} LOGO END -->` +
      `<!-- CAT START ${JSON.stringify(categories)} CAT END -->` +
      `<!-- META START ${sidebarMeta} META END -->`;
    const url = createExportBlob(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SWS_Project_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
  };

  const handleDelete = () => {
    if (currentId) deleteArticle(currentId);
  };

  // 重命名分类：更新所有文章中的分类名称并更新本地分类列表
  const handleRenameCategory = (oldName: string, newName: string) => {
    // 更新文章中的分类
    const updatedArticles = articles.map(article =>
      article.category === oldName ? { ...article, category: newName } : article
    );
    setArticlesAction(updatedArticles);

    // 更新本地分类列表
    setCategories(prev => prev.map(cat => cat === oldName ? newName : cat));
  };

  return (
    <MainLayout
      isLoading={loading || !!importProgress}
      loadingMessage={importProgress?.details}
      isSidebarHidden={isSidebarHidden}
      isImmersive={isImmersive}
      onFloatMenuClick={() => setIsSidebarHidden(false)}
      sidebar={
        <Sidebar
          articles={articles}
          currentId={currentId}
          logo={logo}
          sidebarMeta={sidebarMeta}
          searchQuery={searchQuery}
          isEditMode={isEditMode}
          isSidebarHidden={isSidebarHidden}
          onSelectArticle={handleSelectArticle}
          onToggleSidebar={() => setIsSidebarHidden(true)}
          onSearchChange={setSearchQuery}
          onSidebarMetaChange={setSidebarMeta}
          onLogoUpload={() => logoInputRef.current?.click()}
          onToggleEditMode={() => setIsEditMode(!isEditMode)}
          onReorder={reorderArticles}
        />
      }
      toolbar={
        <Toolbar
          currentId={currentId}
          isFullscreen={isFullscreen}
          onNewArticle={() => { setIsEditorOpen(true); setCurrentId(null); }}
          onEditArticle={() => currentId && setIsEditorOpen(true)}
          onImport={() => importInputRef.current?.click()}
          onImportWechat={handleImportWechat}
          onToggleFullscreen={toggleReadingMode}
          onDelete={handleDelete}
          onReset={handleReset}
          onExportReader={() => handleExport(true)}
          onExportProject={() => handleExport(false)}
        />
      }
      content={
        !currentArticle ? (
          <div className="text-center text-gray-300 mt-[200px]">
            <p>请选择左侧文档</p>
          </div>
        ) : (
          <div className={`w-full transition-all duration-300 origin-top ${isImmersive ? 'max-w-full min-h-screen m-0 p-0 flex items-center justify-center' : 'max-w-[850px] mx-auto bg-white min-h-[1000px] p-[80px_100px] shadow-sm mb-[40px]'}`}>
            <PaperView
              article={currentArticle}
              logo={logo}
              isEditMode={isEditMode}
              onUpdate={updateArticle}
              onImageUpload={(type) => {
                uploadTypeRef.current = type;
                coverInputRef.current?.click();
              }}
              onNext={() => handleNavigate('next')}
              useAlternateDesign={useAlternateDesign}
              setUseAlternateDesign={setUseAlternateDesign}
            />

            {(() => {
              const idx = sortedArticles.findIndex(a => a.id === currentId);
              const prevArt = idx > 0 ? sortedArticles[idx - 1] : null;
              const nextArt = idx > -1 && idx < sortedArticles.length - 1 ? sortedArticles[idx + 1] : null;
              const isSpecial = currentArticle?.category === '封面' || currentArticle?.category === '封底';

              return (
                <NavigationCapsule
                  onPrev={() => handleNavigate('prev')}
                  onNext={() => handleNavigate('next')}
                  onShowShortcutsHelp={() => setShowShortcutsHelp(true)}
                  prevTitle={prevArt?.title}
                  nextTitle={nextArt?.title}
                  isSpecialPage={isSpecial}
                />
              );
            })()}
          </div>
        )
      }
      modals={
        <>
          <KeyboardShortcutsHelpModal
            isOpen={showShortcutsHelp}
            currentArticleTitle={currentArticle?.title || '无'}
            onClose={() => setShowShortcutsHelp(false)}
          />
          <Editor
            isOpen={isEditorOpen}
            article={currentId ? (articles.find(a => a.id === currentId) || {}) : {}}
            categories={categories}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleSaveArticle}
            onManageCats={() => setIsCatManagerOpen(true)}
          />
          <CategoryManagerModal
            isOpen={isCatManagerOpen}
            categories={categories}
            onClose={() => setIsCatManagerOpen(false)}
            onUpdateCategories={setCategories}
            onRenameCategory={handleRenameCategory}
          />
          <ExportOptionsModal
            isOpen={isExportOptionsModalOpen}
            currentUseAlternateDesign={useAlternateDesign}
            onClose={() => setIsExportOptionsModalOpen(false)}
            onConfirm={(options) => {
              handleExportWithOptions(options);
              setIsExportOptionsModalOpen(false);
            }}
          />
        </>
      }
      hiddenInputs={
        <>
          <input type="file" ref={importInputRef} className="hidden" accept=".html,.json" onChange={handleImport} />
          <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) fileToDataURL(f).then((b64) => setLogo(b64 as string));
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
