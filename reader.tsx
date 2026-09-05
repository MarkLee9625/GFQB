import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import type { Article } from './src/types';
import { sortArticlesByPriority } from './src/utils/articleSort';
import { parseEmbeddedData } from './src/utils/embeddedData';
import { ArticleRenderer } from './components/renderers';

interface ReaderConfig {
  logo?: string;
  sidebarMeta?: string;
  alternateDesign?: boolean;
}

const SPECIAL_CATEGORIES = new Set(['封面', '封底']);

/**
 * 单文件阅读版独立入口
 *
 * 与编辑器（App.tsx）解耦：只加载嵌入数据 + 只读渲染链路，
 * 不包含 IndexedDB、编辑器、AI、导出等功能，从而大幅缩小单文件体积。
 * 数据由导出端压缩注入（gzip），加载时在 Worker 中解压。
 */
const ReaderApp: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [logo, setLogo] = useState('');
  const [sidebarMeta, setSidebarMeta] = useState('');
  const [alternateDesign, setAlternateDesign] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  const articlesRef = useRef(articles);
  articlesRef.current = articles;

  // 数据加载：文章与配置均按 __SWS_COMPRESSION_METHOD__ 解压（Worker 优先）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const win = window;
        const method = win.__SWS_COMPRESSION_METHOD__;
        const data = await parseEmbeddedData<Article[]>(win.__SWS_DATA_ARTICLES_B64__, method);
        const config = await parseEmbeddedData<ReaderConfig>(win.__SWS_DATA_CONFIG_B64__, method);
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('未找到文章数据，请重新导出阅读版');
        }
        setArticles(sortArticlesByPriority(data));
        setCurrentIndex(0);
        if (config) {
          if (config.logo) setLogo(config.logo);
          if (config.sidebarMeta) setSidebarMeta(config.sidebarMeta);
          if (config.alternateDesign) setAlternateDesign(config.alternateDesign);
        }
      } catch (e) {
        console.error('[Reader] 数据加载失败', e);
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 侧边栏搜索过滤
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(a =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.content || '').toLowerCase().includes(q)
    );
  }, [articles, searchQuery]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const navigate = useCallback((dir: 'prev' | 'next') => {
    const list = articlesRef.current;
    if (list.length === 0) return;
    let idx = currentIndexRef.current + (dir === 'next' ? 1 : -1);
    if (idx < 0) idx = list.length - 1;
    if (idx >= list.length) idx = 0;
    goTo(idx);
  }, [goTo]);

  const toggleFullscreen = useCallback(() => {
    const docEl = document.documentElement;
    if (!document.fullscreenElement) {
      docEl.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // 键盘导航
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigate('next');
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        navigate('prev');
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(Math.max(0, articlesRef.current.length - 1));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate, goTo]);

  const current = articles[currentIndex];

  // 封面/封底自动隐藏侧边栏，其余恢复显示
  useEffect(() => {
    if (current && SPECIAL_CATEGORIES.has(current.category)) {
      setSidebarHidden(true);
    } else if (!sidebarHidden) {
      setSidebarHidden(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, current]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-500 text-sm">正在加载数据...</div>
          <div className="text-gray-400 text-xs mt-2">文件较大，请稍候</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <div className="text-red-500 text-lg font-bold mb-2">阅读版加载失败</div>
          <div className="text-gray-500 text-sm mb-4 break-all">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-bold cursor-pointer"
          >
            刷新重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-white">
      {/* 侧边栏 */}
      <aside
        className={`no-print w-[300px] bg-sidebar flex flex-col shrink-0 border-r border-gray-200 z-[60] transition-transform duration-300 ${
          sidebarHidden ? '-translate-x-full absolute h-full shadow-2xl' : 'translate-x-0'
        }`}
      >
        <div className="p-[45px_30px_20px_30px] flex flex-col gap-2 relative">
          <div className="text-2xl font-bold text-brand-blue tracking-[8px]">工法情报</div>
          <div className="text-xs text-gray-500">{sidebarMeta}</div>
        </div>
        <div className="p-[10px_30px_20px_30px]">
          <input
            className="w-full bg-gray-50 rounded p-[8px_12px] text-[13px] text-gray-900 border border-transparent focus:bg-white focus:border-brand-blue outline-none"
            placeholder="搜索文章..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <ul className="flex-1 overflow-y-auto px-[15px] m-0 list-none">
          {filtered.map(article => {
            const idx = articles.findIndex(a => a.id === article.id);
            const active = idx === currentIndex;
            return (
              <li
                key={article.id}
                onClick={() => goTo(idx)}
                className={`p-[14px_15px] rounded cursor-pointer transition-all mb-[2px] border-l-2 ${
                  active ? 'bg-blue-50 border-brand-blue' : 'border-transparent hover:bg-gray-100'
                }`}
              >
                <div className={`text-[14px] font-semibold mb-1 leading-[1.4] ${active ? 'text-brand-blue' : 'text-gray-700'}`}>
                  {article.pdfData && (
                    <span className="bg-red-100 text-red-500 text-[9px] px-1 rounded font-bold mr-1">PDF</span>
                  )}
                  {article.title}
                </div>
              </li>
            );
          })}
        </ul>
        {logo && (
          <div className="p-[15px_30px_20px_30px] border-t border-gray-200">
            <img src={logo} alt="Logo" className="max-w-[150px] h-auto max-h-[50px] block" />
          </div>
        )}
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 select-none no-print">
          <button
            onClick={() => setSidebarHidden(v => !v)}
            className="px-3 py-1.5 text-xs font-bold text-brand-blue border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
          >
            ☰ 目录
          </button>
          <div className="text-sm text-gray-500 truncate max-w-[40%]">{current?.title || ''}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('prev')}
              className="px-3 py-1.5 text-xs font-bold text-brand-blue border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
            >
              ← 上一篇
            </button>
            <button
              onClick={() => navigate('next')}
              className="px-3 py-1.5 text-xs font-bold text-brand-blue border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
            >
              下一篇 →
            </button>
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1.5 text-xs font-bold text-brand-blue border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
            >
              ⛶ 全屏
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-none min-h-0">
          <div className="max-w-[980px] mx-auto p-4 md:p-6 lg:p-8">
            {current ? (
              <ArticleRenderer article={current} mode="read" logo={logo} useAlternateDesign={alternateDesign} />
            ) : (
              <div className="text-center text-gray-300 mt-[200px]">请选择左侧文档</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ReaderApp />
  </React.StrictMode>
);