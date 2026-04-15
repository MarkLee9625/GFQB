import React, { useRef, useState, useEffect } from 'react';
import { Article } from '../../../types';
import { Icon } from '../../Icons';
import { useBlobManager } from '../../../hooks/useBlobManager';
import { ArticleRendererBaseProps } from './ArticleRenderer';

interface CoverRendererProps extends ArticleRendererBaseProps {
  mode: 'edit' | 'read' | 'print';
  isEditable?: boolean;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onUpdate?: (id: number, updates: Partial<Article>) => void;
  onNext?: () => void;
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
 * 封面渲染组件
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
export const CoverRenderer: React.FC<CoverRendererProps> = ({
  article,
  mode,
  useAlternateDesign = false,
  isEditable = false,
  onImageUpload,
  onUpdate,
  onNext
}) => {
  const [zoom, setZoom] = useState({
    scale: article.scale || 1,
    x: article.posX || 0,
    y: article.posY || 0
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, initX: 0, initY: 0 });
  const hasMoved = useRef(false);

  const coverUrl = article.coverImage;

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
    if (!isEditable || !article.category.includes('封面')) return;
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
      if (!articleRef.current?.category.includes('封面')) return;
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

    const coverEl = document.getElementById(`cover-${article.id}`);
    if (coverEl) {
      coverEl.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (coverEl) {
        coverEl.removeEventListener('wheel', handleWheel);
      }
    };
  }, [isEditable, mode, onUpdate, article.id]);

  // 杂志风设计
  if (useAlternateDesign) {
    return (
      <div
        id={`cover-${article.id}`}
        className="w-full min-h-[840px] flex flex-col p-[40px_60px] bg-white text-left relative overflow-hidden group magazine-cover"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
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
              <text
                x="50%"
                y="85"
                textAnchor="middle"
                fontFamily="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif"
                fontWeight="bold"
                fontSize="90"
                fill="url(#magazineTitleGradient)"
                letterSpacing="15"
              >
                工法情报
              </text>
            </svg>
            <div className="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-brand-blue to-transparent"></div>
          </div>

          {/* 期号和日期 - 标签式设计 */}
          <div className="flex gap-[15px] items-center justify-start font-sans text-[#333] text-[11px] font-bold mt-[15px]">
            <div
              className={`min-w-[60px] text-center px-[8px] py-[4px] rounded-full border border-brand-blue/30 bg-white/50 backdrop-blur-sm transition-colors ${
                isEditable ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue' : 'cursor-default'
              }`}
              contentEditable={isEditable}
              onBlur={(e) => onUpdate?.(article.id, { issueText: e.currentTarget.innerText })}
              suppressContentEditableWarning
            >
              {article.issueText || 'NO.01'}
            </div>
            <span className="text-brand-blue/50 text-[12px]">•</span>
            <div
              className={`min-w-[70px] text-center px-[8px] py-[4px] rounded-full border border-brand-blue/30 bg-white/50 backdrop-blur-sm transition-colors ${
                isEditable ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue' : 'cursor-default'
              }`}
              contentEditable={isEditable}
              onBlur={(e) => onUpdate?.(article.id, { dateText: e.currentTarget.innerText })}
              suppressContentEditableWarning
            >
              {article.dateText || `JAN ${new Date().getFullYear()}`}
            </div>
          </div>
        </div>

        {/* 图片区域 - 杂志封面中心焦点 */}
        <div className="w-full h-[550px] shrink-0 flex justify-center items-center z-[1] relative my-4">
          <div
            className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${
              isEditable ? coverUrl ? 'cursor-pointer' : 'cursor-pointer' : ''
            }`}
            onClick={() => isEditable && onImageUpload?.('cover')}
          >
            {coverUrl ? (
              <div className="relative group">
                <LazyImage
                  src={coverUrl}
                  alt="Cover"
                  className="w-auto h-auto max-w-full max-h-full object-contain shadow-2xl relative z-[1] rounded-[8px] transition-all duration-300 group-hover:shadow-3xl group-hover:scale-[1.02] mx-auto"
                  style={{
                    boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.3)'
                  }}
                />
                {isEditable && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                      点击更换封面图片
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
                  if (isEditable) onImageUpload?.('cover');
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
          {mode === 'edit' && (
            <div
              onClick={onNext}
              className="clickable-area text-[11px] font-bold text-white bg-gradient-to-r from-brand-blue to-brand-dark flex items-center gap-[8px] cursor-pointer hover:opacity-90 hover:translate-x-1 transition-all uppercase tracking-widest px-4 py-3 rounded-lg shadow-lg"
            >
              开始阅读 <Icon name="arrow-right" className="w-3 h-3" />
            </div>
          )}
        </div>

        {/* 装饰性元素 */}
        <div className="absolute bottom-10 left-10 w-6 h-6 border-l-2 border-t-2 border-brand-blue/30"></div>
        <div className="absolute top-10 right-10 w-4 h-4 border-r-2 border-b-2 border-brand-blue/30"></div>
      </div>
    );
  }

  // 原版设计
  return (
    <div
      id={`cover-${article.id}`}
      className="w-full min-h-[840px] flex flex-col p-0 bg-transparent text-left border-t-8 border-brand-blue relative overflow-hidden group"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
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
          <text
            x="50%"
            y="85"
            textAnchor="middle"
            fontFamily="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif"
            fontWeight="bold"
            fontSize="90"
            fill="url(#titleGradient)"
            letterSpacing="15"
          >
            工法情报
          </text>
        </svg>
        <div className="flex gap-[8px] items-center justify-start font-sans text-[#333] text-[12px] font-bold mt-[5px]">
          <div
            className={`min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors ${
              isEditable ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue hover:text-brand-blue' : 'cursor-default'
            }`}
            contentEditable={isEditable}
            onBlur={(e) => onUpdate?.(article.id, { issueText: e.currentTarget.innerText })}
            suppressContentEditableWarning
          >
            {article.issueText || 'NO.01'}
          </div>
          <span className="text-[#666] text-[12px]">·</span>
          <div
            className={`min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors ${
              isEditable ? 'cursor-text hover:bg-blue-50 hover:border-brand-blue hover:text-brand-blue' : 'cursor-default'
            }`}
            contentEditable={isEditable}
            onBlur={(e) => onUpdate?.(article.id, { dateText: e.currentTarget.innerText })}
            suppressContentEditableWarning
          >
            {article.dateText || `JAN ${new Date().getFullYear()}`}
          </div>
        </div>
      </div>
      <div className="w-full min-h-[550px] h-auto shrink-0 flex justify-center items-center z-[1] relative my-4">
        <div
          className={`w-full h-full flex items-center justify-center p-4 md:p-8 ${
            isEditable ? coverUrl ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer' : ''
          }`}
        >
          {coverUrl ? (
            <LazyImage
              src={coverUrl}
              alt="Cover"
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
                if (isEditable) onImageUpload?.('cover');
              }}
            >
              + COVER PHOTO
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between z-[2] pt-[15px] shrink-0 mt-[15px] w-full relative">
        <div className="h-[15px] w-[80px] opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #333, #333 1px, transparent 1px, transparent 3px)' }}></div>
        {mode === 'edit' && (
          <div
            onClick={onNext}
            className="clickable-area text-[10px] font-bold text-brand-blue flex items-center gap-[5px] cursor-pointer hover:opacity-70 hover:translate-x-1 transition-all uppercase tracking-widest bg-white/80 px-2 py-1 rounded backdrop-blur-sm"
          >
            开始阅读 <Icon name="arrow-right" className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
};
