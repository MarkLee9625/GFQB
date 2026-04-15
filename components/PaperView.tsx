import React, { useRef, useState, useEffect } from 'react';
import { Article, CONSTANTS } from '../types';
import { Icon } from './Icons';
import { useBlobManager } from '../hooks/useBlobManager';
import { useInView } from '../hooks/useInView';

interface PaperViewProps {
  article: Article | undefined;
  logo: string;
  isEditMode: boolean;
  onUpdate: (id: number, updates: Partial<Article>) => void;
  onImageUpload: (type: 'cover' | 'back') => void;
  onNext: () => void;
  useAlternateDesign: boolean;
  setUseAlternateDesign: (value: boolean) => void;
}

const useBlobUrl = (dataUrl: string | null | undefined) => {
  const blobManager = useBlobManager();
  const prevDataUrlRef = useRef(dataUrl);
  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    return dataUrl ? blobManager.getBlobUrl(dataUrl) : null;
  });

  if (dataUrl !== prevDataUrlRef.current) {
    prevDataUrlRef.current = dataUrl;
    const newUrl = dataUrl ? blobManager.getBlobUrl(dataUrl) : null;
    setBlobUrl(newUrl);
  }

  useEffect(() => {
    if (dataUrl) {
      const currentUrl = blobManager.getBlobUrl(dataUrl);
      if (currentUrl !== blobUrl) {
        setBlobUrl(currentUrl);
      }
    } else if (blobUrl !== null) {
      setBlobUrl(null);
    }
  }, [dataUrl, blobManager]);

  return blobUrl;
};

// IntersectionObserver 配置常量，避免每次渲染都重建配置对象（修复引用陷阱）
const LAZY_IMAGE_OBSERVER_OPTIONS = { 
  rootMargin: '400px', // 再次调大预加载范围
  threshold: 0.01,
};

// 极简版直接渲染组件（彻底放弃视口监听）
const PdfViewer: React.FC<{ pdfUrl: string }> = ({ pdfUrl }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="w-full h-full relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
        </div>
      )}
      <iframe
        src={`${pdfUrl}#toolbar=0&navpanes=0`}
        className="w-full h-full border-0 relative z-0"
        onLoad={() => setLoaded(true)}
        title="PDF Viewer"
      />
    </div>
  );
};

/** 
 * 带懒加载的图片组件
 */
const LazyImage: React.FC<{
  src: string | null;
  alt: string;
  className: string;
  style?: React.CSSProperties;
  placeholder?: React.ReactNode;
}> = ({ src, alt, className, style, placeholder }) => {
  const { ref, inView } = useInView(LAZY_IMAGE_OBSERVER_OPTIONS);
  const [loaded, setLoaded] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // 一旦进入过视口或正在打印，就一直保持渲染状态，防止视口抖动闪烁
  useEffect(() => {
    if (inView || isPrinting) {
      setShouldRender(true);
    }
  }, [inView, isPrinting]);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    if (shouldRender && src) {
      const img = new Image();
      img.onload = () => setLoaded(true);
      img.src = src;
      return () => {
        img.onload = null;
      };
    }
  }, [shouldRender, src]);

  // 如果没有 src，显示占位符或空
  if (!src) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyItems: 'center', background: '#f9f9f9', opacity: 0.5 }}>
        {placeholder}
      </div>
    );
  }

  // 如果未进入视口且非打印，先渲染容器占位
  if (!shouldRender && !isPrinting) {
    return <div ref={ref as React.RefObject<HTMLDivElement>} className={className} style={style} />;
  }

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} style={{ display: 'contents' }}>
      <img
        src={src}
        alt={alt}
        className={`${className} max-w-full h-auto object-contain ${isPrinting ? 'force-print-visible' : ''}`}
        style={{
          ...style,
          opacity: (loaded || isPrinting) ? 1 : 0.8, // 提高初始透明度，减少淡入闪烁感
          transition: 'opacity 0.2s ease-out', // 缩短过渡时间
        }}
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          console.error(`[LazyImage] 图片加载失败: ${src}`);
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};


const AmbientBg: React.FC<{ src: string | null | undefined }> = ({ src }) => {
  if (!src) return null;
  return (
    <div
      className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30 pointer-events-none z-0 transition-opacity duration-700"
      style={{
        backgroundImage: `url('${src}')`,
        filter: 'blur(60px) saturate(180%) brightness(1.05)',
        transform: 'scale(1.2)',
      }}
    />
  );
};

const TechGrid: React.FC = () => (
  <div
    className="absolute inset-0 w-full h-full pointer-events-none z-[0] opacity-[0.03]"
    style={{
      backgroundImage: `
            linear-gradient(#005596 1px, transparent 1px),
            linear-gradient(90deg, #005596 1px, transparent 1px)
        `,
      backgroundSize: '40px 40px'
    }}
  />
);

const DesignToggle: React.FC<{
  isEditMode: boolean;
  useAlternateDesign: boolean;
  setUseAlternateDesign: (value: boolean) => void;
}> = ({ isEditMode, useAlternateDesign, setUseAlternateDesign }) => {
  if (!isEditMode) return null;
  return (
    <div className="DesignToggle fixed top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-gray-200">
      <span className="text-xs font-medium text-gray-600">设计模式:</span>
      <button
        onClick={() => setUseAlternateDesign(false)}
        className={`px-2 py-1 text-xs rounded ${!useAlternateDesign ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        原版
      </button>
      <button
        onClick={() => setUseAlternateDesign(true)}
        className={`px-2 py-1 text-xs rounded ${useAlternateDesign ? 'bg-brand-blue text-white' : 'text-gray-500 hover:bg-gray-100'}`}
      >
        杂志风
      </button>
    </div>
  );
};

const PaperViewComponent: React.FC<PaperViewProps> = ({ article, logo, isEditMode, onUpdate, onImageUpload, onNext, useAlternateDesign, setUseAlternateDesign }) => {
  const [zoom, setZoom] = useState({ scale: article?.scale || 1, x: article?.posX || 0, y: article?.posY || 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initX: 0, initY: 0 });
  const hasMoved = useRef(false);
  // useAlternateDesign 现在从 props 传入

  // Blob URL hooks for memory optimization
  const coverUrl = useBlobUrl(article?.coverImage);
  const backUrl = useBlobUrl(article?.backImage);
  const pdfUrl = useBlobUrl(article?.pdfData);

  // 监听文章ID变化，重置缩放状态
  useEffect(() => {
    if (article) {
      setZoom({
        scale: article.scale || 1,
        x: article.posX || 0,
        y: article.posY || 0
      });
    }
  }, [article?.id]); // 仅当文章ID变化时触发

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const articleRef = useRef(article);
  articleRef.current = article;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (hasMoved.current && articleRef.current) {
          onUpdateRef.current(articleRef.current.id, { posX: zoomRef.current.x, posY: zoomRef.current.y });
        }
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isDragging]);

  const coverRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!isEditMode && !articleRef.current?.category.includes('封')) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      let newScale = zoomRef.current.scale * delta;
      newScale = Math.min(Math.max(0.5, newScale), 5);
      const newZoom = { ...zoomRef.current, scale: newScale };
      setZoom(newZoom);
      if (articleRef.current) onUpdateRef.current(articleRef.current.id, { scale: newScale });
    };

    const coverEl = coverRef.current;
    const backEl = backRef.current;

    if (coverEl) coverEl.addEventListener('wheel', handleWheel, { passive: false });
    if (backEl) backEl.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (coverEl) coverEl.removeEventListener('wheel', handleWheel);
      if (backEl) backEl.removeEventListener('wheel', handleWheel);
    };
  }, [isEditMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!article?.category.includes('封')) return;
    if ((e.target as HTMLElement).closest('button, input, .clickable-area')) return;

    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, initX: zoom.x, initY: zoom.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true;
    setZoom(prev => ({ ...prev, x: dragStart.current.initX + dx, y: dragStart.current.initY + dy }));
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (hasMoved.current && article) {
        onUpdate(article.id, { posX: zoomRef.current.x, posY: zoomRef.current.y });
      }
    }
  };

  if (!article) return null;

  if (article.category === '封面') {
    if (useAlternateDesign) {
      // 备用封面设计 - 专业杂志风格
      return (
        <>
          <DesignToggle isEditMode={isEditMode} useAlternateDesign={useAlternateDesign} setUseAlternateDesign={setUseAlternateDesign} />
          <div className="w-full min-h-[840px] flex flex-col p-[40px_60px] bg-white text-left relative overflow-hidden group magazine-cover">
            {/* 背景 - 更简洁的渐变 */}
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-50 via-white to-gray-50"></div>

            {/* 顶部标题区 - 杂志风格 */}
            <div className="flex flex-col items-start z-[2] mb-[25px] shrink-0 w-full relative">
              <div className="font-sans text-[9px] font-black text-brand-blue tracking-[4px] uppercase w-full mb-[2px] letter-spacing-wider">
                SHIP CONSTRUCTION METHOD
              </div>
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-brand-blue/50 to-transparent mb-[15px]"></div>

              {/* 主标题 - 更大胆的杂志风格 */}
              <div className="relative">
                <svg className="w-full max-w-[400px] h-auto mb-[5px]" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="magazineTitleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#005596', stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: '#003366', stopOpacity: 1 }} />
                    </linearGradient>
                  </defs>
                  <text x="50%" y="85" textAnchor="middle" fontFamily="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" fontWeight="bold" fontSize="90" fill="url(#magazineTitleGradient)" letterSpacing="15">工法情报</text>
                </svg>
                <div className="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-brand-blue to-transparent"></div>
              </div>

              {/* 期号和日期 - 标签式设计 */}
              <div className="flex gap-[15px] items-center justify-start font-sans text-[#333] text-[11px] font-bold mt-[15px]">
                <div
                  className={`min-w-[60px] text-center px-[8px] py-[4px] rounded-full border border-brand-blue/30 bg-white/50 backdrop-blur-sm transition-colors ${isEditMode ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue' : 'cursor-default'}`}
                  contentEditable={isEditMode}
                  onBlur={(e) => onUpdate(article.id, { issueText: e.currentTarget.innerText })}
                  suppressContentEditableWarning
                >
                  {article.issueText || "NO.01"}
                </div>
                <span className="text-brand-blue/50 text-[12px]">•</span>
                <div
                  className={`min-w-[70px] text-center px-[8px] py-[4px] rounded-full border border-brand-blue/30 bg-white/50 backdrop-blur-sm transition-colors ${isEditMode ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue' : 'cursor-default'}`}
                  contentEditable={isEditMode}
                  onBlur={(e) => onUpdate(article.id, { dateText: e.currentTarget.innerText })}
                  suppressContentEditableWarning
                >
                  {article.dateText || `JAN ${new Date().getFullYear()}`}
                </div>
              </div>
            </div>

            {/* 图片区域 - 杂志封面中心焦点 */}
            <div className="w-full h-[550px] shrink-0 flex justify-center items-center z-[1] relative my-4">
              <div
                className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${isEditMode ? (article.coverImage ? 'cursor-pointer' : 'cursor-pointer') : ''}`}
                onClick={() => isEditMode && onImageUpload('cover')}
              >
                {article.coverImage ? (
                  coverUrl ? (
                    <div className="relative group">
                      <LazyImage
                        src={coverUrl}
                        alt="Cover"
                        className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto"
                        style={{
                          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.3)'
                        }}
                        placeholder={
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                          </div>
                        }
                      />
                      {isEditMode && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                            点击更换封面图片
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className="clickable-area text-gray-500 text-[14px] bg-white/90 backdrop-blur-sm px-8 py-4 border-2 border-dashed border-gray-300 z-[10] tracking-widest rounded-xl shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode) onImageUpload('cover');
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
                        <Icon name="camera" className="w-5 h-5 text-brand-blue" />
                      </div>
                      <span>添加封面图片</span>
                      <span className="text-[11px] font-normal text-gray-400">建议尺寸 1200×1600</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* 底部 - 开始阅读按钮 */}
            <div className="flex items-center justify-between z-[2] pt-[20px] shrink-0 mt-[20px] w-full relative">
              <div className="text-[9px] text-gray-400 tracking-[2px] uppercase font-bold">
                OFFICIAL PUBLICATION
              </div>
              <div
                onClick={onNext}
                className="clickable-area text-[11px] font-bold text-white bg-gradient-to-r from-brand-blue to-brand-dark flex items-center gap-[8px] cursor-pointer hover:opacity-90 hover:translate-x-1 transition-all uppercase tracking-widest px-4 py-3 rounded-lg shadow-lg"
              >
                开始阅读 <Icon name="arrow-right" className="w-3 h-3" />
              </div>
            </div>

            {/* 装饰性元素 */}
            <div className="absolute bottom-10 left-10 w-6 h-6 border-l-2 border-t-2 border-brand-blue/30"></div>
            <div className="absolute top-10 right-10 w-4 h-4 border-r-2 border-b-2 border-brand-blue/30"></div>
          </div>
        </>
      );
    } else {
      // 原版封面设计
      return (
        <>
          <DesignToggle isEditMode={isEditMode} useAlternateDesign={useAlternateDesign} setUseAlternateDesign={setUseAlternateDesign} />
          <div className="w-full min-h-[840px] flex flex-col p-0 bg-transparent text-left border-t-8 border-brand-blue relative overflow-hidden group">
            <div className="absolute inset-0 z-0 bg-transparent">
              <TechGrid />
              <AmbientBg src={coverUrl} />
            </div>
            <div className="flex flex-col items-start z-[2] mb-[15px] gap-[5px] shrink-0 border-b-[3px] border-double border-[#333] pb-[15px] w-full relative">
              <div className="font-sans text-[10px] font-extrabold text-brand-blue tracking-[3px] uppercase w-full mb-[5px]">
                Ship Construction Method Information
              </div>
              <svg className="w-full max-w-[320px] h-auto mb-[2px]" viewBox="0 0 500 120" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="titleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#005596', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#003366', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <text x="50%" y="85" textAnchor="middle" fontFamily="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" fontWeight="bold" fontSize="90" fill="url(#titleGradient)" letterSpacing="15">工法情报</text>
              </svg>
              <div className="flex gap-[8px] items-center justify-start font-sans text-[#333] text-[12px] font-bold mt-[5px]">
                <div
                  className={`min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors ${isEditMode ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue hover:text-brand-blue' : 'cursor-default'}`}
                  contentEditable={isEditMode}
                  onBlur={(e) => onUpdate(article.id, { issueText: e.currentTarget.innerText })}
                  suppressContentEditableWarning
                >
                  {article.issueText || "NO.01"}
                </div>
                <span className="text-[#666] text-[12px]">·</span>
                <div
                  className={`min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors ${isEditMode ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue hover:text-brand-blue' : 'cursor-default'}`}
                  contentEditable={isEditMode}
                  onBlur={(e) => onUpdate(article.id, { dateText: e.currentTarget.innerText })}
                  suppressContentEditableWarning
                >
                  {article.dateText || `JAN ${new Date().getFullYear()}`}
                </div>
              </div>
            </div>
            <div className="w-full min-h-[550px] h-auto shrink-0 flex justify-center items-center z-[1] relative my-4">
              <div
                ref={coverRef}
                className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${isEditMode ? (article.coverImage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer') : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={() => isEditMode && !hasMoved.current && onImageUpload('cover')}
              >
                {article.coverImage ? (
                  coverUrl ? (
      <LazyImage
        src={coverUrl}
        alt="Cover"
        className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] origin-center will-change-transform transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto mix-blend-multiply"
        style={{
          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
        placeholder={
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
          </div>
        }
      />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className="clickable-area absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-[13px] bg-white/80 backdrop-blur-sm px-6 py-3 border border-gray-200 z-[10] tracking-widest rounded-lg shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode) onImageUpload('cover');
                    }}
                  >
                    + COVER PHOTO
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between z-[2] pt-[15px] shrink-0 mt-[15px] w-full relative">
              <div className="h-[15px] w-[80px] opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px)' }}></div>
              <div onClick={onNext} className="clickable-area text-[10px] font-bold text-brand-blue flex items-center gap-[5px] cursor-pointer hover:opacity-70 hover:translate-x-1 transition-all uppercase tracking-widest bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
                开始阅读 <Icon name="arrow-right" className="w-3 h-3" />
              </div>
            </div>
          </div>
        </>
      );
    }
  }

  if (article.category === '封底') {
    if (useAlternateDesign) {
      // 备用封底设计 - 专业杂志风格
      return (
        <>
          <DesignToggle isEditMode={isEditMode} useAlternateDesign={useAlternateDesign} setUseAlternateDesign={setUseAlternateDesign} />
          <div className="w-full min-h-[840px] flex flex-col p-[40px_60px] bg-white text-left relative overflow-hidden group magazine-back-cover">
            {/* 背景 - 简洁渐变 */}
            <div className="absolute inset-0 z-0 bg-gradient-to-tl from-blue-50/80 via-white to-gray-50/80"></div>

            {/* 顶部标题区 - 杂志风格 */}
            <div className="flex flex-col items-start z-[2] mb-[25px] shrink-0 w-full relative">
              <div className="font-sans text-[9px] font-black text-brand-blue tracking-[4px] uppercase w-full mb-[2px] letter-spacing-wider">
                SHIP CONSTRUCTION METHOD
              </div>
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-brand-blue/30 to-transparent mb-[15px]"></div>

              {/* 主标题 - 倾斜杂志风格 */}
              <div className="relative transform -rotate-2 origin-left">
                <h1
                  className="font-serif text-[64px] font-black tracking-[-2px] leading-[0.9] mb-[5px] italic"
                  style={{
                    background: 'linear-gradient(to bottom, #005596, #003366)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: 'transparent'
                  }}
                >
                  Sailing With Success
                </h1>
                <div className="absolute -bottom-3 left-0 w-24 h-2 bg-gradient-to-r from-brand-blue to-transparent transform rotate-2"></div>
              </div>
            </div>

            {/* 图片区域 - 杂志封底设计 */}
            <div className="w-full h-[550px] shrink-0 flex justify-center items-center z-[1] relative my-4">
              <div
                className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${isEditMode ? 'cursor-pointer' : ''}`}
                onClick={() => isEditMode && onImageUpload('back')}
              >
                {article.backImage ? (
                  backUrl ? (
                    <div className="relative group flex flex-col items-center justify-center w-full h-full">
                      <LazyImage
                        src={backUrl}
                        alt="Back Cover"
                        className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto"
                        style={{
                          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.3)'
                        }}
                        placeholder={
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                          </div>
                        }
                      />
                      {isEditMode && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                            点击更换封底图片
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className="clickable-area text-gray-500 text-[14px] bg-white/90 backdrop-blur-sm px-8 py-4 border-2 border-dashed border-gray-300 z-[10] tracking-widest rounded-xl shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode) onImageUpload('back');
                    }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
                        <Icon name="image" className="w-5 h-5 text-brand-blue" />
                      </div>
                      <span>添加封底图片</span>
                      <span className="text-[11px] font-normal text-gray-400">建议尺寸 1200×1600</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* 底部信息区 - 杂志风格排版 */}
            <div className="w-full flex items-start justify-between z-[2] shrink-0 relative">
              {/* 左侧 - 公司信息 */}
              <div className="flex flex-col gap-[8px] max-w-[40%]">
                <div className="text-[11px] text-gray-500 tracking-[1px] font-bold uppercase">
                  SWS Offshore
                </div>
                <div className="font-normal text-[10px] text-gray-400 leading-tight">
                  Shanghai Waigaoqiao Shipbuilding Co., Ltd.<br />
                  上海外高桥造船有限公司
                </div>
                <div className="mt-[10px] text-[9px] text-gray-400">
                  © {new Date().getFullYear()} Ship Construction Method Information
                </div>
              </div>

              {/* 中间 - 编辑团队信息 */}
              <div className="flex flex-col gap-[12px]">
                <div className="grid grid-cols-3 gap-[20px] text-[11px] text-gray-600 font-sans">
                  <div className="flex flex-col gap-[2px]">
                    <div className="text-gray-400 text-[9px] uppercase tracking-widest">编辑</div>
                    <b>马李琛</b>
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <div className="text-gray-400 text-[9px] uppercase tracking-widest">校对</div>
                    <b>胡国超</b>
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <div className="text-gray-400 text-[9px] uppercase tracking-widest">审核</div>
                    <b>储年生</b>
                  </div>
                </div>

                {/* 模拟条形码 */}
                <div className="flex flex-col items-center gap-[2px] mt-[5px]">
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  <div className="text-[8px] text-gray-400 tracking-[3px]">ISSN 0000-0000</div>
                </div>
              </div>

              {/* 右侧 - Logo */}
              <div className="flex flex-col items-end gap-[10px]">
                {logo && (
                  <div className="relative">
                    <img src={logo} className="h-[25px] w-auto block" alt="Logo" />
                    <div className="absolute -bottom-1 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-blue/50 to-transparent"></div>
                  </div>
                )}
                <div className="text-[9px] text-gray-400 text-right">
                  Official Publication<br />
                  Volume {article.issueText || "01"} · {article.dateText || `JAN ${new Date().getFullYear()}`}
                </div>
              </div>
            </div>

            {/* 装饰性元素 */}
            <div className="absolute top-20 left-10 w-3 h-3 border-2 border-brand-blue/20 rounded-full"></div>
            <div className="absolute bottom-20 right-10 w-2 h-2 border border-brand-blue/20"></div>
            <div className="absolute top-40 right-20 w-6 h-px bg-gradient-to-r from-transparent to-brand-blue/30"></div>
          </div>
        </>
      );
    } else {
      // 原版封底设计
      return (
        <>
          <DesignToggle isEditMode={isEditMode} useAlternateDesign={useAlternateDesign} setUseAlternateDesign={setUseAlternateDesign} />
          <div className="w-full min-h-[840px] flex flex-col p-0 bg-transparent text-left border-t-8 border-brand-blue relative overflow-hidden group">
            <div className="absolute inset-0 z-0 overflow-hidden bg-transparent">
              <TechGrid />
              <AmbientBg src={backUrl} />
            </div>
            <div className="w-full border-b-[3px] border-double border-[#333] pb-[15px] mb-[15px] flex flex-col items-start gap-[5px] z-[2] shrink-0 relative">
              <div className="font-sans text-[10px] font-extrabold text-brand-blue tracking-[3px] uppercase w-full mb-[5px]">
                Ship Construction Method Information
              </div>
              <div className="font-serif text-[36px] font-bold tracking-[2px] uppercase m-0 leading-[1.2] text-transparent bg-clip-text bg-gradient-to-b from-brand-blue to-brand-dark">
                Sailing With Success
              </div>
            </div>
            <div className="w-full min-h-[550px] h-auto shrink-0 flex justify-center items-center z-[1] relative my-4">
              <div
                ref={backRef}
                className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${isEditMode ? (article.backImage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer') : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onClick={() => isEditMode && !hasMoved.current && onImageUpload('back')}
              >
                {article.backImage ? (
                  backUrl ? (
                    <LazyImage
                      src={backUrl}
                      alt="Back Cover"
                      className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] origin-center will-change-transform transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto mix-blend-multiply"
                      style={{
                        transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)'
                      }}
                      placeholder={
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    className="clickable-area absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-[13px] bg-white/80 backdrop-blur-sm px-6 py-3 border border-gray-200 z-[10] tracking-widest rounded-lg shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEditMode) onImageUpload('back');
                    }}
                  >
                    + BACK PHOTO
                  </button>
                )}
              </div>
            </div>
            <div className="w-full flex items-center justify-between z-[2] pt-[15px] shrink-0 mt-[15px] relative">
              <div className="text-[10px] text-gray-400 tracking-[1px] font-bold uppercase flex flex-col gap-[4px]">
                <span>SWS Offshore</span>
                <span className="font-normal text-[9px]">Shanghai Waigaoqiao Shipbuilding Co., Ltd.</span>
              </div>
              <div className="flex items-center gap-[20px]">
                <div className="flex gap-[15px] text-[11px] text-[#666] font-sans">
                  <div className="flex gap-[4px] whitespace-nowrap"><span>编辑:</span> <b>马李琛</b></div>
                  <div className="flex gap-[4px] whitespace-nowrap"><span>校对:</span> <b>胡国超</b></div>
                  <div className="flex gap-[4px] whitespace-nowrap"><span>审核:</span> <b>储年生</b></div>
                </div>
                {logo && <img src={logo} className="h-[20px] w-auto block" alt="Logo" />}
              </div>
            </div>
          </div>
        </>
      );
    }
  }

  return (
    <div className="flex flex-col w-full text-left bg-white relative">
      <div className="shrink-0 mb-[30px] text-left border-b border-gray-200 pb-[20px]">
        <h1 className="font-serif text-[32px] text-[#111] m-[0_0_15px_0] leading-[1.3] font-bold tracking-[1px]">{article.title}</h1>
        <div className="text-gray-400 text-[13px] flex flex-wrap gap-y-3 gap-x-5 font-medium font-sans uppercase tracking-[1px] items-center">
          {article.category !== '封面' && article.category !== '封底' && article.tags && article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Icon name="search" className="w-3 h-3 mt-1" />
              {article.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded text-[12px] font-bold border border-gray-200/50 hover:bg-brand-blue/5 hover:text-brand-blue hover:border-brand-blue/20 transition-colors cursor-default">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-1"><Icon name="search" className="w-3 h-3" /> {article.category}</span>
          )}
        </div>
        {article.abstract && (
          <div className="mt-6 p-4 bg-gray-50 border-l-4 border-brand-blue rounded-r-lg text-[14px] leading-relaxed text-gray-600 italic font-sans animate-in fade-in slide-in-from-left-2 duration-500 shrink-0">
            <div className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1 not-italic">摘要</div>
            {article.abstract}
          </div>
        )}
      </div>

      <div className="flex flex-col w-full">
        <div
          className={`sws-prose article-body w-full ${article.pdfData ? 'border-b border-gray-100 pb-8' : ''}`}
          style={{
            fontSize: `${article.fontSize || 18}px`,
            lineHeight: article.lineHeight || 2.0
          }}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {article.pdfData && (
          <div className="w-full flex flex-col mt-8">
            <div className="w-full h-[80vh] min-h-[800px] flex flex-col relative rounded-[24px] pdf-viewer-container border border-gray-200 shadow-sm">
              {/* PDF Toolbar */}
              <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 select-none">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Icon name="file-text" className="w-4 h-4" />
                  PDF PREVIEW
                </div>
                <button
                  className="pdf-expand-btn bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/20 rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer flex items-center gap-2 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    const container = e.currentTarget.closest('.pdf-viewer-container');
                    if (container) {
                      if (container.classList.contains('expanded')) {
                        container.classList.remove('expanded');
                        document.exitFullscreen?.();
                      } else {
                        container.classList.add('expanded');
                        container.requestFullscreen?.();
                      }
                    }
                  }}
                >
                  <Icon name="maximize" className="w-3.5 h-3.5" />
                  <span>全屏阅读</span>
                </button>
              </div>

              <div className="flex-1 w-full relative bg-gray-100/50 overflow-hidden min-h-0 h-full">
                {pdfUrl ? (
                  <div className="w-full h-full flex flex-col p-4 relative">
                    {/* 边界防护层 - 防止PDF内容溢出 */}
                    <div className="flex-1 w-full overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm relative h-full min-h-[300px]">
                      {/* PDF内容容器 */}
                      <div className="w-full h-full overflow-auto relative min-h-[300px]">
                        <PdfViewer pdfUrl={pdfUrl} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 min-h-[300px]">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                    <div className="text-gray-400 text-sm">正在加载 PDF...</div>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!pdfUrl) {
                      alert('PDF 正在处理中，请稍后再试...');
                      return;
                    }
                    try {
                      // 纯粹的安全下载机制，杜绝使用 window.open 触发拦截
                      const link = document.createElement('a');
                      link.href = pdfUrl;
                      link.download = article?.title ? `${article.title}.pdf` : 'document.pdf';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch (err) {
                      console.error('下载PDF失败', err);
                      alert('下载失败，请重试');
                    }
                  }}
                  className="absolute bottom-4 right-4 z-[20] bg-white px-3 py-2 text-xs border border-gray-300 rounded text-brand-blue cursor-pointer flex items-center gap-1 hover:bg-gray-50 shadow-md transition-colors"
                >
                  <Icon name="download" className="w-3 h-3" />
                  下载完整 PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Always visible */}
      <div className="mt-auto pt-8 border-t border-gray-100 text-center shrink-0">
        <img src={logo} className="h-[25px] opacity-50 inline-block align-middle mr-2" alt="" />
        <span className="text-xs text-gray-400 font-bold tracking-widest">SWS KNOWLEDGE BASE</span>
      </div>
      <div className="text-center m-[40px_auto_0] text-[10px] text-gray-200 tracking-[2px] shrink-0">- End of Article -</div>
    </div>
  );
};

export const PaperView = React.memo(PaperViewComponent);
