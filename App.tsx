import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Article, CONSTANTS } from './types';
import { db } from './services/db';
import { compressImage, fileToDataURL, parseMarkdownToHtml } from './src/utils/fileHelpers';
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
import AiCurationModal from './src/components/AiCurationModal';
import { UniversalArticleMeta } from './src/types/intelligence';
import { useMemoryMonitor } from './hooks/useMemoryMonitor';
import { useJournal } from './hooks/useJournal';
import { generateForeword, extractGlobalKnowledgeGraph, buildSuperContextForGraph, validateGraphQuality, GraphQualityReport } from './services/aiService';
import { generateReaderHTML, generatePrintableHTML, exportToPdf, exportReaderHTML, PdfExportOptions } from './src/services/export';
import { generateGraphHtml } from './src/utils/graphRenderer';
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
  const [isAiCurationModalOpen, setIsAiCurationModalOpen] = useState(false);

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

  // 监听来自知识图谱 iframe 的溯源检索信号
  useEffect(() => {
    const handleGraphMessage = (event: MessageEvent) => {
      // 验证信号类型
      if (event.data && event.data.type === 'GRAPH_SEARCH_KEYWORD') {
        const keyword = event.data.keyword;
        console.log('[架构连通] 接收到图谱溯源请求，开始全页查找:', keyword);
        
        // 调用浏览器原生 Ctrl+F 级别的查找能力
        // 参数: 关键词, 非大小写敏感, 向下查找, 开启循环查找
        // @ts-ignore
        const found = window.find(keyword, false, false, true, false, false, false);
        
        // 如果向下没找到，强行向上再找一圈兜底
        if (!found) {
          // @ts-ignore
          window.find(keyword, false, true, true, false, false, false);
        }
      }

      // 2. 知识图谱数据请求信号 (针对 Iframe 受限无法直接访问 parent DOM 时的回流)
      if (event.data && event.data.type === 'GRAPH_REQUEST_DATA' && event.data.uid) {
        const uid = event.data.uid;
        console.log('[架构联通] 收到图谱数据请求, UID:', uid);
        const dataEl = document.getElementById('data-' + uid);
        if (dataEl) {
          const iframe = document.getElementById('iframe-' + uid) as HTMLIFrameElement;
          if (iframe && iframe.contentWindow) {
            console.log('[架构联通] 成功定位 iframe，进行数据回流...');
            iframe.contentWindow.postMessage({
              type: 'GRAPH_DATA_RESPONSE',
              uid: uid,
              dataB64: dataEl.textContent
            }, '*');
          } else {
            console.warn('[架构联通] 未能定位到 iframe 节点:', uid);
          }
        } else {
          console.warn('[架构联通] 未能定位到数据节点 data-' + uid);
        }
      }
    };

    window.addEventListener('message', handleGraphMessage);
    return () => window.removeEventListener('message', handleGraphMessage);
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

  // 切换文章发布状态
  const handleTogglePublish = useCallback(() => {
    if (!currentId || !currentArticle) return;
    
    const newPublishedState = !currentArticle.isPublished;
    updateArticle(currentId, { isPublished: newPublishedState });
  }, [currentId, currentArticle, updateArticle]);

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


  // 生成卷首语业务流
  const handleGenerateForeword = async () => {
    // 1. 过滤并提取有效文章的标题和摘要
    const validArticles = articles.filter(a =>
      a.category !== '封面' &&
      a.category !== '封底' &&
      a.title &&
      a.title !== '未命名文章'
    );

    if (validArticles.length === 0) {
      alert("当前没有任何有效文章，无法生成导读！请先添加文章内容。");
      return;
    }

    // 2. 将数据组装为 Prompt 友好的文本格式
    const articlesSummary = validArticles.map((a, index) => 
      `【文章 ${index + 1}】标题：${a.title}\n摘要：${a.abstract || '暂无摘要，请根据标题推测'}\n标签：${(a.tags || []).join(', ')}`
    ).join('\n\n');

    // 3. 拦截 UI，复用现有的全局 Loading 状态（DeepSeek Reasoner 耗时较长）
    setImportProgress({ stage: 'generating', details: 'DeepSeek 正在纵览全局，撰写本期卷首语，请稍候 (约 15-30 秒)...' });

    try {
      // 4. 调用 AI 引擎
      const htmlContent = await generateForeword(articlesSummary);

      // 5. 将 AI 结果直接落库为一篇新文章
      const newArt = await createArticle({
        title: '本期导读 / 卷首语',
        category: '特别报道',
        content: htmlContent,
        abstract: '本文由 AI 根据本期收录的工法情报自动统稿生成，旨在为您提供宏观的技术导览。',
        isPublished: true // 默认设为已发布状态
      });

      // 6. 跳转到新文章并给与提示
      if (newArt) {
        setCurrentId(newArt.id);
        setTimeout(() => alert('✨ 卷首语生成成功！AI 已自动为您排版。'), 100);
      }
    } catch (err) {
      alert('生成卷首语失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      // 7. 解除拦截 UI
      setImportProgress(null);
    }
  };

  // 生成知识图谱业务流 (支持 PDF 深度抽取)
  const handleGenerateGraph = async () => {
    const validArticles = articles.filter(a => 
      a.category !== '封面' && 
      a.category !== '封底' && 
      (a.content || a.pdfData)
    );
    
    if (validArticles.length === 0) {
      return alert("当前无有效内容或 PDF 附件，无法提取图谱！");
    }

    setImportProgress({ stage: 'generating', details: '正在深度解析 PDF 与全刊内容，构建超级上下文...' });

    try {
      const allText = await buildSuperContextForGraph(validArticles);
      const finalContext = allText.slice(0, 150000);

      const graphData = await extractGlobalKnowledgeGraph(finalContext, (stage, detail) => {
        setImportProgress({ stage: 'generating', details: `[${stage}] ${detail}` });
      });

      const qualityReport = validateGraphQuality(graphData);
      console.log('[App] 图谱质量报告:', qualityReport);

      const htmlContent = generateGraphHtml(graphData);

      const newArt = await createArticle({
        title: '本期技术知识图谱',
        category: '特别报道',
        content: htmlContent,
        abstract: '本图谱由 AI 引擎根据全刊内容(含深度解析的PDF文献)自动提炼，展示了本期收录的核心工艺、材料与设备之间的技术拓扑关系。',
        isPublished: true
      });

      if (newArt) {
        setCurrentId(newArt.id);
        const qualityMsg = qualityReport.isValid
          ? `✅ 质量校验通过！节点 ${qualityReport.nodeCount} 个，关系 ${qualityReport.linkCount} 条，连通率 ${(qualityReport.connectivityRatio * 100).toFixed(0)}%`
          : `⚠️ 质量提示：\n${qualityReport.warnings.join('\n')}`;
        setTimeout(() => alert(`🕸️ 知识图谱生成成功！\n\n${qualityMsg}`), 100);
      }
    } catch (err) {
      alert('生成图谱失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setImportProgress(null);
    }
  };

  // 采纳AI选题文章的业务流
  const handleAdoptArticle = useCallback(async (article: UniversalArticleMeta) => {
    try {
      // 1. 将Markdown转换为HTML
      const htmlContent = parseMarkdownToHtml(article.content);
      
      // 2. 创建新文章对象
      const newArt = await createArticle({
        title: article.title || '未命名文章',
        category: 'AI选题',
        content: htmlContent,
        abstract: article.aiSummary || '',
        isPublished: true,
        tags: article.tags || []
      });

      // 3. 提示用户采纳成功
      if (newArt) {
        setCurrentId(newArt.id);
        setTimeout(() => alert(`✅ 文章 "${article.title}" 已成功采纳！`), 100);
      }
    } catch (err) {
      alert('采纳文章失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  }, [createArticle, setCurrentId]);

  // Navigation Logic
  const handleNavigate = (direction: 'prev' | 'next') => {
    const idx = sortedArticles.findIndex(a => a.id === currentId);
    if (direction === 'prev' && idx > 0) {
      handleSelectArticle(sortedArticles[idx - 1].id);
    } else if (direction === 'next' && idx > -1 && idx < sortedArticles.length - 1) {
      handleSelectArticle(sortedArticles[idx + 1].id);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentId) return;
    
    try {
      // 阶段三要求：所有图片都必须经过压缩管道，包括封面和封底
      const base64 = await fileToDataURL(file);
      const compressedBase64 = await compressImage(base64);
      
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
      } else if (options.exportType === 'reader') {
        // 使用新的 ZIP 导出功能
        await exportReaderHTML(articles, options, { logo, sidebarMeta });
      } else {
        // 打印版仍然使用原来的 HTML 导出方式
        const htmlContent = await generatePrintableHTML(articles, options, { logo, sidebarMeta });
        const fileName = `SWS_Printable_${new Date().toISOString().slice(0, 10)}.html`;
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
          onToggleFullscreen={toggleReadingMode}
          onDelete={handleDelete}
          onReset={handleReset}
          onExportReader={() => handleExport(true)}
          onExportProject={() => handleExport(false)}
          isPublished={currentArticle?.isPublished || false}
          onTogglePublish={handleTogglePublish}
          onGenerateForeword={handleGenerateForeword}
          onGenerateGraph={handleGenerateGraph}
          onOpenAiCuration={() => setIsAiCurationModalOpen(true)}
        />
      }
      content={
        !currentArticle ? (
          <div className="text-center text-gray-300 mt-[200px]">
            <p>请选择左侧文档</p>
          </div>
            ) : (
            <div className="flex flex-col w-full h-auto pb-12 relative bg-white rounded-lg shadow-sm">
              {/* PaperView 容器：移除额外包装，直接使用 PaperView 的白色背景 */}
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

              {/* NavigationCapsule 容器：置于文章正下方，移除 margin-top，使用 padding-top 确保连续背景 */}
              <div className="flex justify-center w-full pt-4 pb-8">
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
          <AiCurationModal
            isOpen={isAiCurationModalOpen}
            onClose={() => setIsAiCurationModalOpen(false)}
            onAdopt={handleAdoptArticle}
          />
        </>
      }
      hiddenInputs={
        <>
          <input type="file" ref={importInputRef} className="hidden" accept=".html,.json" onChange={handleImport} />
          <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) fileToDataURL(f).then((b64) => compressImage(b64 as string, 400, 0.8)).then((compressed) => setLogo(compressed));
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
