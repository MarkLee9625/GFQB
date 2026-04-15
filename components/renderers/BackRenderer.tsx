import React, { useRef, useState, useEffect } from 'react';
import { Article } from '../../../types';
import { Icon } from '../../Icons';
import { useBlobManager } from '../../../hooks/useBlobManager';
import { ArticleRendererBaseProps } from './ArticleRenderer';

interface BackRendererProps extends ArticleRendererBaseProps {
  mode: 'edit' | 'read' | 'print';
  isEditable?: boolean;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onUpdate?: (id: number, updates: Partial<Article>) => void;
}

// 环境背景组件
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

// 技术网格背景
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

// 懒加载图片组件
const LazyImage: React.FC<{
  src: string | null;
  alt: string;
  className: string;
  style?: React.CSSProperties;
}> = ({ src, alt, className, style }) => {
  const [loaded, setLoaded] = useState(false);
  const blobManager = useBlobManager();
  const blobUrl = src ? blobManager.getBlobUrl(src) : null;

  return (
    <img
      src={blobUrl || src}
      alt={alt}
      className={`${className} ${loaded ? 'loaded' : ''}`}
      style={{
        ...style,
        opacity: loaded ? 1 : 0.8,
        transition: 'opacity 0.2s ease-out',
      }}
      onLoad={() => setLoaded(true)}
    />
  );
};

/**
 * 封底渲染组件
 * 
 * 支持两种设计风格：
 * 1. 原版设计：经典蓝色边框 + 技术网格背景
 * 2. 杂志风设计：专业期刊风格 + 渐变背景
 * 
 * 支持三种模式：
 * - edit: 可编辑模式，支持拖拽、缩放、更换图片
 * - read: 只读模式，优化显示效果
 * - print: 打印模式，应用打印样式
 */
export const BackRenderer: React.FC<BackRendererProps> = ({
  article,
  mode,
  useAlternateDesign = false,
  isEditable = false,
  onImageUpload,
  onUpdate
}) => {
  const [zoom, setZoom] = useState({
    scale: article.scale || 1,
    x: article.posX || 0,
    y: article.posY || 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initX: 0, initY: 0 });
  const hasMoved = useRef(false);

  const backUrl = article.backImage;

  // 监听文章 ID 变化，重置缩放状态
  useEffect(() => {
    setZoom({
      scale: article.scale || 1,
      x: article.posX || 0,
      y: article.posY || 0
    });
  }, [article.id]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const articleRef = useRef(article);
  articleRef.current = article;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // 鼠标拖拽事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditable || !article.category.includes('封底')) return;
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
      if (hasMoved.current && article && onUpdate) {
        onUpdate(article.id, { posX: zoomRef.current.x, posY: zoomRef.current.y });
      }
    }
  };

  // 滚轮缩放
  useEffect(() => {
    if (!isEditable || mode !== 'edit') return;

    const handleWheel = (e: WheelEvent) => {
      if (!articleRef.current?.category.includes('封底')) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      let newScale = zoomRef.current.scale * delta;
      newScale = Math.min(Math.max(0.5, newScale), 5);
      setZoom(prev => ({ ...prev, scale: newScale }));
      
      if (articleRef.current && onUpdate) {
        onUpdate(articleRef.current.id, { scale: newScale });
      }
    };

    const backEl = document.getElementById(`back-${article.id}`);
    if (backEl) {
      backEl.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (backEl) {
        backEl.removeEventListener('wheel', handleWheel);
      }
    };
  }, [isEditable, mode, onUpdate, article.id]);

  // 杂志风设计
  if (useAlternateDesign) {
    return (
      <div
        id={`back-${article.id}`}
        className="w-full min-h-[840px] flex flex-col p-[40px_60px] bg-white text-left relative overflow-hidden group magazine-back-cover"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
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
            className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${
              isEditable ? 'cursor-pointer' : ''
            }`}
            onClick={() => isEditable && onImageUpload?.('back')}
          >
            {backUrl ? (
              <div className="relative group flex flex-col items-center justify-center w-full h-full">
                <LazyImage
                  src={backUrl}
                  alt="Back Cover"
                  className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto"
                  style={{
                    boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.3)'
                  }}
                />
                {isEditable && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                      点击更换封底图片
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="clickable-area text-gray-500 text-[14px] bg-white/90 backdrop-blur-sm px-8 py-4 border-2 border-dashed border-gray-300 z-[10] tracking-widest rounded-xl shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold group"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditable) onImageUpload?.('back');
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
            {article.logo && (
              <div className="relative">
                <img src={article.logo} className="h-[25px] w-auto block" alt="Logo" />
                <div className="absolute -bottom-1 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-blue/50 to-transparent"></div>
              </div>
            )}
            <div className="text-[9px] text-gray-400 text-right">
              Official Publication<br />
              Volume {article.issueText || '01'} · {article.dateText || `JAN ${new Date().getFullYear()}`}
            </div>
          </div>
        </div>

        {/* 装饰性元素 */}
        <div className="absolute top-20 left-10 w-3 h-3 border-2 border-brand-blue/20 rounded-full"></div>
        <div className="absolute bottom-20 right-10 w-2 h-2 border border-brand-blue/20"></div>
        <div className="absolute top-40 right-20 w-6 h-px bg-gradient-to-r from-transparent to-brand-blue/30"></div>
      </div>
    );
  }

  // 原版设计
  return (
    <div
      id={`back-${article.id}`}
      className="w-full min-h-[840px] flex flex-col p-0 bg-transparent text-left border-t-8 border-brand-blue relative overflow-hidden group"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
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
          className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${
            isEditable ? backUrl ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer' : ''
          }`}
        >
          {backUrl ? (
            <LazyImage
              src={backUrl}
              alt="Back Cover"
              className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] origin-center will-change-transform transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto mix-blend-multiply"
              style={{
                transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)'
              }}
            />
          ) : (
            <button
              type="button"
              className="clickable-area absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-[13px] bg-white/80 backdrop-blur-sm px-6 py-3 border border-gray-200 z-[10] tracking-widest rounded-lg shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold"
              onClick={(e) => {
                e.stopPropagation();
                if (isEditable) onImageUpload?.('back');
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
          {article.logo && <img src={article.logo} className="h-[20px] w-auto block" alt="Logo" />}
        </div>
      </div>
    </div>
  );
};
