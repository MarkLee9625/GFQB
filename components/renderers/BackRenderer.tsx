import React, { useRef, useState, useEffect } from 'react';
import { Article } from '../../src/types/models';
import { Icon } from '../Icons';
import { usePanZoom } from '../../hooks/usePanZoom';
import { ArticleRendererBaseProps } from './ArticleRenderer';
import { AmbientBg, TechGrid, LazyImage } from './SharedComponents';

interface BackRendererProps extends ArticleRendererBaseProps {
  mode: 'edit' | 'read' | 'print';
  isEditable?: boolean;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onUpdate?: (id: number, updates: Partial<Article>) => void;
}

export const BackRenderer = React.memo<BackRendererProps>(({
  article,
  mode,
  useAlternateDesign = false,
  isEditable = false,
  onImageUpload,
  onUpdate
}) => {
  // 使用拖拽缩放 Hook
  const {
    zoom,
    isDragging,
    eventHandlers,
    containerRef,
  } = usePanZoom({
    initialScale: article.scale || 1,
    initialX: article.posX || 0,
    initialY: article.posY || 0,
    isEditable: isEditable || false,
    mode,
    category: article.category,
    onUpdate: (updates) => onUpdate?.(article.id, updates),
    minScale: 0.5,
    maxScale: 5,
    scaleStep: 0.1,
    dragThreshold: 2,
    debounceDelay: 150,
  });

  const backUrl = article.backImage;


  // 杂志风设计
  if (useAlternateDesign) {
    return (
      <div
        ref={containerRef}
        id={`back-${article.id}`}
        className="w-full min-h-[840px] flex flex-col p-[40px_60px] bg-white text-left relative overflow-hidden group magazine-back-cover"
        {...eventHandlers}
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
      ref={containerRef}
      id={`back-${article.id}`}
      className="w-full min-h-[840px] flex flex-col p-0 bg-transparent text-left border-t-8 border-brand-blue relative overflow-hidden group"
      {...eventHandlers}
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
});
