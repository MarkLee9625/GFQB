import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './src/reader.css';
import type { Article } from './src/types';
import { sortArticlesByPriority } from './src/utils/articleSort';
import {
  createV2BodyLoader,
  parseEmbeddedData,
  parseV2Meta,
  readV2Store,
  type V2BodyLoader,
} from './src/utils/embeddedData';
import type { ArticleShell } from './src/services/export/v2format';
import { ArticleRenderer } from './components/renderers';
import { isSpecialCategory } from './src/constants';

interface ReaderConfig {
  logo?: string;
  sidebarMeta?: string;
  alternateDesign?: boolean;
}

/** 正则转义：搜索词含特殊字符时不影响 RegExp 构造 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 搜索防抖时长（ms）：避免每次击键都全量扫描所有正文 */
const SEARCH_DEBOUNCE_MS = 250;

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
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [logo, setLogo] = useState('');
  const [sidebarMeta, setSidebarMeta] = useState('');
  const [alternateDesign, setAlternateDesign] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // v2：正文就绪集合（外壳 content:'' 与纯 PDF 空正文无法区分，必须显式跟踪）
  const [readyIds, setReadyIds] = useState<Set<number>>(new Set());
  // v2：索引失败集合（失败篇正文恒为空，必须常驻提示，否则"搜不全"无感知）
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [indexing, setIndexing] = useState(false);
  const [isV2, setIsV2] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  const articlesRef = useRef(articles);
  articlesRef.current = articles;
  const loaderRef = useRef<V2BodyLoader | null>(null);
  const shellsRef = useRef<ArticleShell[]>([]);

  // v2：解码成功合并（就绪集 +=，失败集 -=；翻页与后台索引共用）
  const mergeBody = useCallback((article: Article) => {
    setArticles((prev) => prev.map((a) => (a.id === article.id ? article : a)));
    setReadyIds((prev) => {
      if (prev.has(article.id)) return prev;
      const next = new Set(prev);
      next.add(article.id);
      return next;
    });
    setFailedIds((prev) => {
      if (!prev.has(article.id)) return prev;
      const next = new Set(prev);
      next.delete(article.id);
      return next;
    });
  }, []);

  // v2：按需解码某篇（翻页/后台索引并发时 loader 内去重，同篇只解一次）
  const ensureBody = useCallback(
    (idx: number) => {
      const loader = loaderRef.current;
      const shell = shellsRef.current[idx];
      if (!loader || !shell) return;
      loader
        .loadBody(idx)
        .then(mergeBody)
        .catch((e) => {
          console.error('[Reader] 正文解码失败', shell.title, e);
          setFailedIds((prev) => {
            if (prev.has(shell.id)) return prev;
            const next = new Set(prev);
            next.add(shell.id);
            return next;
          });
        });
    },
    [mergeBody]
  );

  // v2：一键重试全部失败篇（副作用在 updater 之外，见 P0-B 教训）
  const retryFailed = useCallback(() => {
    const shells = shellsRef.current;
    failedIds.forEach((id) => {
      const idx = shells.findIndex((s) => s.id === id);
      if (idx >= 0) ensureBody(idx);
    });
  }, [ensureBody, failedIds]);

  // 数据加载：v2（meta 秒开骨架 → 首篇优先 → 后台索引）/ v1（整包解码，老路径原样）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const win = window;
        const applyConfig = (config: ReaderConfig | null) => {
          if (!config || cancelled) return;
          if (config.logo) setLogo(config.logo);
          if (config.sidebarMeta) setSidebarMeta(config.sidebarMeta);
          if (config.alternateDesign) setAlternateDesign(config.alternateDesign);
        };
        const v2 = readV2Store();
        if (v2) {
          const shells = await parseV2Meta(v2.metaB64, v2.method);
          const config = await parseEmbeddedData<ReaderConfig>(win.__SWS_DATA_CONFIG_B64__, v2.method);
          if (cancelled) return;
          if (shells.length === 0) {
            throw new Error('未找到文章数据，请重新导出阅读版');
          }
          // meta/body 下标与导出排序一致（权威顺序，不二次排序以免错位）
          shellsRef.current = shells;
          setArticles(shells.map((s) => ({ ...s, content: '' }) as Article));
          setCurrentIndex(0);
          setIsV2(true);
          applyConfig(config);
          setLoading(false);
          const loader = createV2BodyLoader(v2, shells);
          loaderRef.current = loader;
          setIndexing(true);
          try {
            // 首篇优先（await，保证释放决策计入它；窗格 effect 并发调 ensureBody(0)
            // 会命中同一在途 Promise，不重复解），再后台顺序索引其余
            const failed: number[] = [];
            for (let i = 0; i < shells.length && !cancelled; i++) {
              try {
                const article = await loader.loadBody(i);
                if (cancelled) return;
                mergeBody(article);
              } catch (e) {
                console.error('[Reader] 后台索引跳过', shells[i]?.title, e);
                if (shells[i]) failed.push(shells[i].id);
              }
            }
            if (failed.length > 0 && !cancelled) {
              setFailedIds((prev) => new Set([...prev, ...failed]));
            }
            // 索引干净完成（本轮零失败）即释放媒体表；有失败则保留供重试
            if (failed.length === 0 && !cancelled) loader.releaseMedia();
          } finally {
            if (!cancelled) setIndexing(false);
          }
          return;
        }
        const method = win.__SWS_COMPRESSION_METHOD__;
        const data = await parseEmbeddedData<Article[]>(win.__SWS_DATA_ARTICLES_B64__, method);
        const config = await parseEmbeddedData<ReaderConfig>(win.__SWS_DATA_CONFIG_B64__, method);
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('未找到文章数据，请重新导出阅读版');
        }
        setArticles(sortArticlesByPriority(data));
        setCurrentIndex(0);
        applyConfig(config);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v2：当前篇未就绪时按需解码（正文窗显示加载态而非空文）；
  // 已失败的不自动重试（否则每次后台成功都触发一次无效重试），走正文窗重试按钮
  useEffect(() => {
    if (!isV2 || !loaderRef.current) return;
    const cur = articles[currentIndex];
    if (cur && !readyIds.has(cur.id) && !failedIds.has(cur.id)) ensureBody(currentIndex);
  }, [isV2, currentIndex, articles, readyIds, failedIds, ensureBody]);

  // 静态加载骨架（reader.html #app-boot）在 React 挂载后移除；
  // createRoot 首次 render 会清空容器，此处兜底防止任何残留
  useEffect(() => {
    const boot = document.getElementById('app-boot');
    if (boot) boot.remove();
  }, []);

  // 搜索防抖：延迟 SEARCH_DEBOUNCE_MS 后再执行过滤，避免全量正文扫描阻塞输入
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 小字段小写索引（标题/摘要/标签），正文较大，避免每次输入都 toLowerCase 复制全文
  const searchMetaIndex = useMemo(() => {
    return articles.map(a => ({
      id: a.id,
      title: (a.title || '').toLowerCase(),
      abstract: (a.abstract || '').toLowerCase(),
      tags: (a.tags || []).join(' ').toLowerCase(),
    }));
  }, [articles]);

  // article.id → 数组下标 索引（替代渲染时 O(n²) 的 findIndex）
  const indexById = useMemo(() => {
    const map = new Map<number, number>();
    articles.forEach((a, i) => map.set(a.id, i));
    return map;
  }, [articles]);

  // 侧边栏搜索过滤：小字段命中直接通过；正文用正则 i 标志匹配，不复制内容
  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return articles;
    const re = new RegExp(escapeRegExp(q), 'i');
    return articles.filter((a, i) => {
      const meta = searchMetaIndex[i];
      if (meta.title.includes(q) || meta.abstract.includes(q) || meta.tags.includes(q)) {
        return true;
      }
      return re.test(a.content || '');
    });
  }, [articles, searchMetaIndex, debouncedQuery]);

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

  // 封面/封底自动隐藏侧边栏，翻回普通文章时恢复显示。
  // 用 ref 标记「是否由封面/封底自动隐藏」：仅此时恢复，
  // 避免覆盖用户在普通文章页手动隐藏的选择（原 else-if 分支恒为 no-op）
  const autoHiddenRef = useRef(false);
  useEffect(() => {
    if (current && isSpecialCategory(current.category)) {
      setSidebarHidden(true);
      autoHiddenRef.current = true;
    } else if (autoHiddenRef.current) {
      setSidebarHidden(false);
      autoHiddenRef.current = false;
    }
  }, [current]);

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
          {isV2 && indexing && (
            <div className="text-[11px] text-gray-400 mt-2">全文索引加载中（{readyIds.size}/{articles.length}）…</div>
          )}
          {isV2 && !indexing && failedIds.size > 0 && (
            <div className="text-[11px] text-red-500 mt-2">
              {failedIds.size} 篇索引失败，正文检索不全
              <button onClick={retryFailed} className="ml-2 underline cursor-pointer">
                重试
              </button>
            </div>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto px-[15px] m-0 list-none">
          {filtered.map(article => {
            const idx = indexById.get(article.id) ?? -1;
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
                  {(article.pdfData || article.hasPdf) && (
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
              !isV2 || readyIds.has(current.id) ? (
                <ArticleRenderer article={current} mode="read" logo={logo} useAlternateDesign={alternateDesign} />
              ) : failedIds.has(current.id) ? (
                <div className="flex items-center justify-center mt-[200px]">
                  <div className="text-center">
                    <div className="text-red-500 text-sm font-bold mb-2">正文加载失败</div>
                    <button
                      onClick={() => ensureBody(currentIndex)}
                      className="px-4 py-1.5 text-xs font-bold text-brand-blue border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                    >
                      重试
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center mt-[200px]">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin mx-auto mb-3"></div>
                    <div className="text-gray-400 text-sm">正文加载中…</div>
                  </div>
                </div>
              )
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