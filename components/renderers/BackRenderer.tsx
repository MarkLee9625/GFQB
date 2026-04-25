import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Article } from '../../src/types/models';
import { Icon } from '../Icons';
import { usePanZoom } from '../../hooks/usePanZoom';
import { ArticleRendererBaseProps } from './ArticleRenderer';
import { AmbientBg, TechGrid } from './SharedComponents';
import { calculateAutoFitPosition } from '../../src/utils/imageMath';
import ImageToolbar from '../editor/ImageToolbar';

interface BackRendererProps extends ArticleRendererBaseProps {
  mode: 'edit' | 'read' | 'print';
  isEditable?: boolean;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onUpdate?: (id: number, updates: Partial<Article>) => void;
  onImageDelete?: () => void;
}

export const BackRenderer = React.memo<BackRendererProps>(({
  article,
  mode,
  logo,
  useAlternateDesign = false,
  isEditable = false,
  onImageUpload,
  onUpdate,
  onImageDelete
}) => {
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
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lastAutoFitRef = useRef<{ scale: number; posX: number; posY: number } | null>(null);
  const [isImageSelected, setIsImageSelected] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isImageSelected) {
      setToolbarPos(null);
      return;
    }
    const imageEl = imageContainerRef.current?.querySelector('img');
    if (imageEl) {
      const rect = imageEl.getBoundingClientRect();
      const toolbarHeight = 40;
      const toolbarWidth = 320;
      let top = rect.top - toolbarHeight - 8;
      if (top < 8) top = rect.bottom + 8;
      let left = rect.left + rect.width / 2;
      if (left - toolbarWidth / 2 < 8) left = toolbarWidth / 2 + 8;
      if (left + toolbarWidth / 2 > window.innerWidth - 8) left = window.innerWidth - toolbarWidth / 2 - 8;
      setToolbarPos({ top, left });
    }
  }, [isImageSelected, backUrl, zoom]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable || !backUrl) return;
    if (isDragging) return;
    e.stopPropagation();
    setIsImageSelected(prev => !prev);
  }, [isEditable, backUrl, isDragging]);

  const handleImageDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    setIsImageSelected(true);
    onImageUpload?.('back');
  }, [isEditable, onImageUpload]);

  const handleContainerClick = useCallback(() => {
    if (isImageSelected) {
      setIsImageSelected(false);
    }
  }, [isImageSelected]);

  const handleImgAlign = useCallback((align: 'left' | 'center' | 'right') => {
    if (!imageContainerRef.current) return;
    const container = imageContainerRef.current;
    container.style.justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  }, []);

  const handleImgDelete = useCallback(() => {
    setIsImageSelected(false);
    onUpdate?.(article.id, { backImage: undefined, scale: 1, posX: 0, posY: 0 });
    onImageDelete?.();
  }, [article.id, onUpdate, onImageDelete]);

  const handleImgReplace = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      onUpdate?.(article.id, { backImage: src });
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  }, [article.id, onUpdate]);

  const handleImgCaption = useCallback(() => {}, []);

  useEffect(() => {
    if (imageContainerRef.current && article.backImage) {
      const { clientWidth, clientHeight } = imageContainerRef.current;
      const img = new Image();
      img.onload = () => {
        const result = calculateAutoFitPosition(
          img.naturalWidth,
          img.naturalHeight,
          clientWidth,
          clientHeight
        );
        if (!lastAutoFitRef.current ||
            Math.abs(result.scale - lastAutoFitRef.current.scale) > 0.01 ||
            Math.abs(result.posX - lastAutoFitRef.current.posX) > 1 ||
            Math.abs(result.posY - lastAutoFitRef.current.posY) > 1) {
          lastAutoFitRef.current = result;
          onUpdate?.(article.id, result);
        }
      };
      img.src = article.backImage;
    }
  }, [article.backImage, onUpdate, article.id]);

  const hasImage = !!backUrl;

  // ────── Magazine Design ──────
  if (useAlternateDesign) {
    return (
      <div
        ref={containerRef}
        id={`back-${article.id}`}
        className="w-full min-h-[900px] flex flex-col text-left relative overflow-hidden group magazine-back-cover"
        {...eventHandlers}
      >
        {/* Background when no image */}
        {!hasImage && (
          <div className="absolute inset-0 z-0 bg-gradient-to-tl from-blue-50/80 via-white to-gray-50/80"></div>
        )}

        {/* Ambient blur background */}
        {hasImage && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <AmbientBg src={backUrl} />
          </div>
        )}

        {/* Full-bleed image */}
        {hasImage && (
          <div
            ref={imageContainerRef}
            className={`absolute inset-0 z-[1] ${isEditable ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            onClick={handleContainerClick}
          >
            <div className={`w-full h-full ${isImageSelected ? 'cover-img-selected' : ''}`}>
              <img
                src={backUrl}
                alt="Back Cover"
                className="w-full h-full object-cover select-none"
                style={{
                  transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                  transformOrigin: 'center',
                }}
                draggable={false}
                onClick={handleImageClick}
                onDoubleClick={handleImageDoubleClick}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/70 pointer-events-none z-[2]"></div>
            {isEditable && !isImageSelected && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-[3]">
                <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                  双击更换封底图片，单击选中编辑
                </div>
              </div>
            )}
          </div>
        )}

        {/* Header section */}
        <div className="flex flex-col items-start z-[3] w-full relative px-[40px] md:px-[60px] pt-[35px] shrink-0">
          <div className="font-sans text-[9px] font-black text-[#005596] tracking-[4px] uppercase w-full mb-[2px] letter-spacing-wider drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]">
            SHIP CONSTRUCTION METHOD
          </div>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#005596]/20 to-transparent mb-[15px]"></div>

          <div className="relative transform -rotate-2 origin-left">
            <h1
              className="font-serif text-[64px] font-black tracking-[-2px] leading-[0.9] mb-[5px] italic drop-shadow-[0_2px_8px_rgba(255,255,255,0.6)]"
              style={{
                color: '#005596',
              }}
            >
              Sailing With Success
            </h1>
            <div className="absolute -bottom-3 left-0 w-24 h-2 bg-gradient-to-r from-[#005596]/60 to-transparent transform rotate-2"></div>
          </div>
        </div>

        {/* Upload button when no image */}
        {!hasImage && (
          <div className="flex-1 flex items-center justify-center z-[3]">
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
          </div>
        )}

        {/* Spacer when no image */}
        {!hasImage && <div className="shrink-0 h-[60px]"></div>}

        {/* Footer background strip — ensures footer text stays clear over blurred background */}
        <div className="absolute bottom-0 left-0 right-0 z-[2] h-[160px] bg-gradient-to-t from-white/80 via-white/30 to-transparent pointer-events-none"></div>

        {/* Footer — overlaid on image */}
        <div className="flex items-end justify-between z-[3] pb-[30px] px-[40px] md:px-[60px] shrink-0 w-full relative mt-auto pt-[20px]">
          <div className="flex flex-col gap-[8px] max-w-[40%]">
            <div className="text-[11px] text-[#005596]/70 tracking-[1px] font-bold uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              SWS Offshore
            </div>
            <div className="font-normal text-[10px] text-[#005596]/50 leading-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              Shanghai Waigaoqiao Shipbuilding Co., Ltd.<br />
              上海外高桥造船有限公司
            </div>
            <div className="mt-[10px] text-[9px] text-[#005596]/40 drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
              © {new Date().getFullYear()} Ship Construction Method Information
            </div>
          </div>

          <div className="flex flex-col gap-[12px] items-center">
            <div className="grid grid-cols-3 gap-[20px] text-[11px] text-[#005596]/80 font-sans drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              <div className="flex flex-col gap-[2px]">
                <div className="text-[#005596]/50 text-[9px] uppercase tracking-widest">编辑</div>
                <b className="text-[#005596]">马李琛</b>
              </div>
              <div className="flex flex-col gap-[2px]">
                <div className="text-[#005596]/50 text-[9px] uppercase tracking-widest">校对</div>
                <b className="text-[#005596]">胡国超</b>
              </div>
              <div className="flex flex-col gap-[2px]">
                <div className="text-[#005596]/50 text-[9px] uppercase tracking-widest">审核</div>
                <b className="text-[#005596]">储年生</b>
              </div>
            </div>

            <div className="flex flex-col items-center gap-[2px] mt-[5px]">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#005596]/30 to-transparent"></div>
              <div className="text-[8px] text-[#005596]/40 tracking-[3px]">ISSN 0000-0000</div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-[10px]">
            {logo && (
              <div className="relative">
                <img src={logo} className="h-[25px] w-auto block brightness-0 invert-[0.3] sepia-[1] saturate-[5] hue-rotate-[150deg] opacity-80" alt="Logo" />
                <div className="absolute -bottom-1 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#005596]/50 to-transparent"></div>
              </div>
            )}
            <div className="text-[9px] text-[#005596]/50 text-right drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
              Official Publication<br />
              Volume {article.issueText || '01'} · {article.dateText || `JAN ${new Date().getFullYear()}`}
            </div>
          </div>
        </div>

        {isEditable && isImageSelected && toolbarPos && (
          <ImageToolbar
            position={toolbarPos}
            onAlign={handleImgAlign}
            onSize={() => {}}
            onReplace={handleImgReplace}
            onCaption={handleImgCaption}
            onDelete={handleImgDelete}
            replaceInputRef={replaceInputRef}
          />
        )}
        <input type="file" className="hidden" accept="image/*" ref={replaceInputRef} />
      </div>
    );
  }

  // ────── Default Design ──────
  return (
    <div
      ref={containerRef}
      id={`back-${article.id}`}
      className="w-full min-h-[900px] flex flex-col p-0 text-left border-t-8 border-brand-blue relative overflow-hidden group"
      {...eventHandlers}
    >
      <div className="absolute inset-0 z-0 overflow-hidden bg-transparent">
        <TechGrid />
        <AmbientBg src={backUrl} />
      </div>

      {/* Full-bleed image */}
      {hasImage && (
        <div
          ref={imageContainerRef}
          className={`absolute inset-0 z-[1] ${isEditable ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onClick={handleContainerClick}
        >
          <div className={`w-full h-full ${isImageSelected ? 'cover-img-selected' : ''}`}>
            <img
              src={backUrl}
              alt="Back Cover"
              className="w-full h-full object-cover select-none"
              style={{
                transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                transformOrigin: 'center',
              }}
              draggable={false}
              onClick={handleImageClick}
              onDoubleClick={handleImageDoubleClick}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/80 pointer-events-none z-[2]"></div>
          {isEditable && !isImageSelected && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-[3]">
              <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                双击更换封底图片，单击选中编辑
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col items-start z-[3] w-full relative px-[40px] md:px-[60px] pt-[30px] shrink-0">
        <div className="font-sans text-[10px] font-extrabold text-[#005596] tracking-[3px] uppercase w-full mb-[5px] drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]">
          Ship Construction Method Information
        </div>
        <div className="font-serif text-[36px] font-bold tracking-[2px] uppercase m-0 leading-[1.2] drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]"
          style={{ color: '#005596' }}>
          Sailing With Success
        </div>
      </div>

      {/* Upload button when no image */}
      {!hasImage && (
        <div className="flex-1 flex items-center justify-center z-[3]">
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
        </div>
      )}

      {/* Spacer when no image */}
      {!hasImage && <div className="shrink-0 h-[60px]"></div>}

      {/* Footer background strip — ensures footer text stays clear over blurred background */}
      <div className="absolute bottom-0 left-0 right-0 z-[2] h-[140px] bg-gradient-to-t from-white/80 via-white/30 to-transparent pointer-events-none"></div>

      {/* Footer */}
      <div className="flex items-end justify-between z-[3] pb-[25px] px-[40px] md:px-[60px] shrink-0 w-full relative mt-auto pt-[15px]">
        <div className="flex flex-col gap-[4px]">
          <span className="text-[#005596]/70 text-[10px] tracking-[1px] font-bold uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">SWS Offshore</span>
          <span className="font-normal text-[9px] text-[#005596]/50 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">Shanghai Waigaoqiao Shipbuilding Co., Ltd.</span>
        </div>
        <div className="flex items-center gap-[20px]">
          <div className="flex gap-[15px] text-[#005596]/80 text-[11px] font-sans drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
            <div className="flex gap-[4px] whitespace-nowrap"><span className="text-[#005596]/60">编辑:</span> <b className="text-[#005596]">马李琛</b></div>
            <div className="flex gap-[4px] whitespace-nowrap"><span className="text-[#005596]/60">校对:</span> <b className="text-[#005596]">胡国超</b></div>
            <div className="flex gap-[4px] whitespace-nowrap"><span className="text-[#005596]/60">审核:</span> <b className="text-[#005596]">储年生</b></div>
          </div>
          {logo && <img src={logo} className="h-[20px] w-auto block brightness-0 invert-[0.3] sepia-[1] saturate-[5] hue-rotate-[150deg] opacity-80" alt="Logo" />}
        </div>
      </div>

      {isEditable && isImageSelected && toolbarPos && (
        <ImageToolbar
          position={toolbarPos}
          onAlign={handleImgAlign}
          onSize={() => {}}
          onReplace={handleImgReplace}
          onCaption={handleImgCaption}
          onDelete={handleImgDelete}
          replaceInputRef={replaceInputRef}
        />
      )}
      <input type="file" className="hidden" accept="image/*" ref={replaceInputRef} />
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.article.id === nextProps.article.id &&
    prevProps.article.backImage === nextProps.article.backImage &&
    prevProps.logo === nextProps.logo &&
    prevProps.article.issueText === nextProps.article.issueText &&
    prevProps.article.dateText === nextProps.article.dateText &&
    prevProps.article.scale === nextProps.article.scale &&
    prevProps.article.posX === nextProps.article.posX &&
    prevProps.article.posY === nextProps.article.posY &&
    prevProps.mode === nextProps.mode &&
    prevProps.useAlternateDesign === nextProps.useAlternateDesign &&
    prevProps.isEditable === nextProps.isEditable
  );
});
