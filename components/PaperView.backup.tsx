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
}

const useBlobUrl = (dataUrl: string | null | undefined) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobManager = useBlobManager();

  useEffect(() => {
    if (!dataUrl) {
      setBlobUrl(null);
      return;
    }
    
    // 使用优化的Blob管理器
    const url = blobManager.getBlobUrl(dataUrl);
    setBlobUrl(url);

    return () => {
      // 注意：我们不再在这里手动revoke URL，因为useBlobManager会管理生命周期
      // 这样可以避免重复创建和销毁Blob URL
    };
  }, [dataUrl, blobManager]);

  return blobUrl;
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
  const { ref, inView } = useInView({
    rootMargin: '200px', // 提前200px开始加载
    threshold: 0.1,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (inView && src) {
      const img = new Image();
      img.onload = () => setLoaded(true);
      img.src = src;
      return () => {
        img.onload = null;
      };
    }
  }, [inView, src]);

  // 如果没有src或者没有进入视口，显示占位符
  if (!src || !inView) {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} className={className} style={style}>
        {placeholder || (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>}>
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: loaded ? 1 : 0.7,
          transition: 'opacity 0.3s ease-in-out',
        }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

// PDF懒加载组件
const LazyPdfViewer: React.FC<{ pdfUrl: string }> = ({ pdfUrl }) => {
  const { ref, inView } = useInView({
    rootMargin: '300px', // PDF文件较大，提前300px开始加载
    threshold: 0.1,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (inView && !loaded) {
      // 模拟PDF加载，实际加载由浏览器处理
      setLoaded(true);
    }
  }, [inView, loaded]);

  if (!inView) {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
          <div className="text-gray-400 text-sm">PDF将在进入视口后加载...</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="w-full h-full">
      <object 
        data={pdfUrl} 
        type="application/pdf" 
        className="w-full h-full block"
        onLoad={() => setLoaded(true)}
      />
      <a 
        href={pdfUrl} 
        target="_blank" 
        rel="noreferrer"
        className="absolute bottom-[10px] right-[25px] z-[99] bg-white p-[5px] text-[12px] border border-gray-300 rounded text-brand-blue no-underline"
      >
        无法预览？点击打开PDF
      </a>
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

export const PaperView: React.FC<PaperViewProps> = ({ article, logo, isEditMode, onUpdate, onImageUpload, onNext }) => {
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initX: 0, initY: 0 });
  const hasMoved = useRef(false);

  // Blob URL hooks for memory optimization
  const coverUrl = useBlobUrl(article?.coverImage);
  const backUrl = useBlobUrl(article?.backImage);
  const pdfUrl = useBlobUrl(article?.pdfData);

  useEffect(() => {
    if (article) {
      setZoom({
        scale: article.scale || 1,
        x: article.posX || 0,
        y: article.posY || 0
      });
    }
  }, [article?.id]);

  // 清理所有事件监听器（确保没有内存泄漏）
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (hasMoved.current && article) {
          onUpdate(article.id, { posX: zoom.x, posY: zoom.y });
        }
      }
    };

    // 添加全局mouseup事件监听器，确保即使在元素外部释放鼠标也能清理
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseUp);

    return () => {
      // 组件卸载时清理全局事件监听器
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isDragging, hasMoved.current, article, zoom.x, zoom.y, onUpdate]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!isEditMode && !article?.category.includes('封')) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    let newScale = zoom.scale * delta;
    newScale = Math.min(Math.max(0.5, newScale), 5);
    const newZoom = { ...zoom, scale: newScale };
    setZoom(newZoom);
    if (article) onUpdate(article.id, { scale: newScale });
  };

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
        onUpdate(article.id, { posX: zoom.x, posY: zoom.y });
      }
    }
  };

  if (!article) return null;

  if (article.category === '封面') {
    return (
      <div className="w-full min-h-[840px] flex flex-col p-[30px_50px] bg-white text-left border-t-8 border-brand-blue relative overflow-hidden group">
        <div className="absolute inset-0 z-0 overflow-hidden bg-gray-50/50">
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
                     <stop offset="0%" style={{stopColor:'#005596', stopOpacity:1}} />
                     <stop offset="100%" style={{stopColor:'#003366', stopOpacity:1}} />
                 </linearGradient>
             </defs>
             <text x="50%" y="85" textAnchor="middle" fontFamily="'Songti SC', 'SimSun', 'STSong', serif" fontWeight="bold" fontSize="90" fill="url(#titleGradient)" letterSpacing="15">工法情报</text>
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
              {article.dateText || "JAN 2025"}
            </div>
          </div>
        </div>
        <div className="flex-grow flex flex-col justify-center items-center z-[1] w-full min-h-[500px] mt-[10px] relative">
           <div 
             className={`w-full h-full flex items-center justify-center relative overflow-visible ${isEditMode ? (article.coverImage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer') : ''}`}
             onWheel={handleWheel}
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
                      className="w-auto h-auto max-w-full max-h-full object-contain relative z-[1] shadow-2xl origin-center will-change-transform rounded-sm"
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
            <div className="h-[15px] w-[80px] opacity-40" style={{backgroundImage: 'repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px)'}}></div>
            <div onClick={onNext} className="clickable-area text-[10px] font-bold text-brand-blue flex items-center gap-[5px] cursor-pointer hover:opacity-70 hover:translate-x-1 transition-all uppercase tracking-widest bg-white/80 px-2 py-1 rounded backdrop-blur-sm">
                开始阅读 <Icon name="arrow-right" className="w-3 h-3" />
            </div>
        </div>
      </div>
    );
  }

  if (article.category === '封底') {
    return (
      <div className="w-full min-h-[840px] flex flex-col p-[30px_50px] bg-white text-left border-t-8 border-brand-blue relative overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden bg-gray-50/50">
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
        <div className="flex-grow w-full flex items-center justify-center relative overflow-visible min-h-[500px]">
           <div 
             className={`w-full h-full flex items-center justify-center m-0 border-none ${isEditMode ? (article.backImage ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer') : ''}`}
             onWheel={handleWheel}
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
                     className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] origin-center will-change-transform rounded-sm"
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
                 className="clickable-area text-gray-400 text-[12px] z-[10] bg-white/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-white hover:text-brand-blue hover:scale-105 active:scale-95 transition-all shadow-sm font-bold"
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
    );
  }

  return (
    <div className="w-full text-left">
      <style>{CONSTANTS.UNIFIED_STYLES}</style>
      <div className="mb-[30px] text-left border-b border-gray-200 pb-[20px]">
        <h1 className="font-serif text-[32px] text-[#111] m-[0_0_15px_0] leading-[1.3] font-bold tracking-[1px]">{article.title}</h1>
        <div className="text-gray-400 text-[13px] flex gap-[20px] font-medium font-sans uppercase tracking-[1px]">
          <span className="flex items-center gap-1"><Icon name="edit" className="w-3 h-3" /> {article.date}</span>
          <span className="flex items-center gap-1"><Icon name="search" className="w-3 h-3" /> {article.category}</span>
        </div>
      </div>
      
      <div 
        className="sws-prose article-body"
        dangerouslySetInnerHTML={{ __html: article.content }} 
      />

      {article.pdfData && (
        <div className="w-full h-[85vh] min-h-[600px] border border-gray-200 mt-[30px] bg-gray-50 flex items-center justify-center relative overflow-hidden rounded-[44px]">
           {pdfUrl ? (
               <LazyPdfViewer pdfUrl={pdfUrl} />
           ) : (
               <div className="flex flex-col items-center gap-4">
                   <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                   <div className="text-gray-400 text-sm">正在加载 PDF...</div>
               </div>
           )}
        </div>
      )}

      <div className="mt-[50px] pt-[20px] border-t border-gray-100 text-center opacity-40 text-[10px] text-gray-400 tracking-[2px] uppercase font-sans">
         <img src={logo} className="h-[25px] opacity-50 inline-block align-middle mr-2" alt="" />
         SWS KNOWLEDGE BASE
      </div>
      <div className="text-center m-[40px_auto_0] text-[10px] text-gray-200 tracking-[2px]">- End of Article -</div>
    </div>
  );
};
