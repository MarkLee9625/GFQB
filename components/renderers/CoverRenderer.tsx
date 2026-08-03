import React from 'react';
import type { Article } from '../../src/types';
import { Icon } from '../Icons';
import type { ArticleRendererBaseProps } from './types';
import { CoverImageEditor } from './CoverImageEditor';
import { useImageEditor } from './hooks/useImageEditor';
import { COVER_THEMES, UploadSection } from './CoverBackShared';

interface CoverRendererProps extends ArticleRendererBaseProps {
  mode: 'edit' | 'read' | 'print';
  isEditable?: boolean;
  onImageUpload?: (type: 'cover' | 'back') => void;
  onUpdate?: (id: number, updates: Partial<Article>) => void;
  onNext?: () => void;
  onImageDelete?: () => void;
}

export const CoverRenderer = React.memo<CoverRendererProps>(({
  article,
  mode,
  useAlternateDesign = false,
  isEditable = false,
  onImageUpload,
  onUpdate,
  onNext,
  onImageDelete
}) => {
  const {
    zoom,
    isDragging,
    eventHandlers,
    containerRef,
    imageUrl: coverUrl,
    imageContainerRef,
    isImageSelected,
    toolbarPos,
    replaceInputRef,
    hasImage,
    handleImageClick,
    handleImageDoubleClick,
    handleContainerClick,
    handleImgAlign,
    handleImgDelete,
    handleImgReplace,
    handleImgCaption,
  } = useImageEditor({
    article,
    mode,
    isEditable: isEditable || false,
    imageType: 'cover',
    onUpdate,
    onImageUpload,
    onImageDelete,
  });

  const theme = COVER_THEMES[useAlternateDesign ? 'magazine' : 'default'];

  return (
    <div
      ref={containerRef}
      id={`cover-${article.id}`}
      className={theme.containerClass}
      {...eventHandlers}
    >
      {/* Background */}
      {theme.renderBg(hasImage, coverUrl ?? '')}

      {/* Full-bleed image */}
      <CoverImageEditor
        imageUrl={coverUrl ?? undefined}
        isDragging={isDragging}
        isEditable={isEditable}
        isImageSelected={isImageSelected}
        zoom={zoom}
        imageContainerRef={imageContainerRef}
        toolbarPos={toolbarPos}
        replaceInputRef={replaceInputRef}
        alt="Cover"
        hintText="双击更换封面图片，单击选中编辑"
        gradientFrom="from-black/5"
        gradientVia={theme.imgGradientVia}
        gradientTo={theme.imgGradientTo}
        handleImageClick={handleImageClick}
        handleImageDoubleClick={handleImageDoubleClick}
        handleContainerClick={handleContainerClick}
        handleImgAlign={handleImgAlign}
        handleImgDelete={handleImgDelete}
        handleImgReplace={handleImgReplace}
        handleImgCaption={handleImgCaption}
      />

      {/* Header — overlaid on image */}
      <div className={`flex flex-col items-start z-[3] w-full relative px-[40px] md:px-[60px] ${theme.headerPt} shrink-0`}>
        <div className={theme.subtitleClass}>
          {theme.subtitle}
        </div>
        {theme.hasDivider && (
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#005596]/20 to-transparent mb-[15px]"></div>
        )}

        <div className="relative">
          <svg
            className={`w-full ${theme.svgMaxWidth} h-auto ${theme.svgMb}`}
            viewBox="0 0 500 120"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id={theme.svgGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
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
              fill={`url(#${theme.svgGradientId})`}
              letterSpacing="15"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
            >
              工法情报
            </text>
          </svg>
          {theme.hasTitleLine && (
            <div className="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[#005596]/60 to-transparent"></div>
          )}
        </div>

        <div className={`flex ${theme.issueDateGap} items-center justify-start font-sans text-[#005596] ${theme.issueDateFontSize} font-bold ${theme.issueDateMt} drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]`}>
          <div
            className={isEditable ? theme.issuePillEditableClass : theme.issuePillReadonlyClass}
            contentEditable={isEditable}
            onBlur={(e) => onUpdate?.(article.id, { issueText: e.currentTarget.innerText })}
            suppressContentEditableWarning
          >
            {article.issueText || 'NO.01'}
          </div>
          <span className="text-[#005596]/40 text-[12px]">·</span>
          <div
            className={isEditable ? theme.datePillEditableClass : theme.datePillReadonlyClass}
            contentEditable={isEditable}
            onBlur={(e) => onUpdate?.(article.id, { dateText: e.currentTarget.innerText })}
            suppressContentEditableWarning
          >
            {article.dateText || `JAN ${new Date().getFullYear()}`}
          </div>
        </div>
      </div>

      {/* Upload button when no image */}
      <UploadSection
        style={theme.uploadStyle}
        iconName="camera"
        label={theme.uploadStyle === 'magazine' ? '添加封面图片' : '+ COVER PHOTO'}
        hintText="建议尺寸 1200×1600"
        onClick={() => { if (isEditable) onImageUpload?.('cover'); }}
        hasImage={hasImage}
      />

      {/* Spacer to push footer down when no image */}
      {!hasImage && <div className="shrink-0 h-[60px]"></div>}

      {/* Footer */}
      <div className={theme.footerClass}>
        {theme.footerLeft}
        {mode === 'edit' && (
          <div
            onClick={onNext}
            className={theme.footerRightClass}
          >
            开始阅读 <Icon name="arrow-right" className={theme.footerRightIconSize} />
          </div>
        )}
      </div>

      {/* Decorative corners */}
      {theme.hasDeco && (
        <>
          <div className="absolute bottom-10 left-10 w-6 h-6 border-l-2 border-t-2 border-white/30 pointer-events-none z-[3]"></div>
          <div className="absolute top-10 right-10 w-4 h-4 border-r-2 border-b-2 border-white/30 pointer-events-none z-[3]"></div>
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.article.id === nextProps.article.id &&
    prevProps.article.coverImage === nextProps.article.coverImage &&
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
