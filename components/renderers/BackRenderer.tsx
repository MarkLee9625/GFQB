import React from 'react';
import type { Article } from '../../src/types';
import type { ArticleRendererBaseProps } from './types';
import { CoverImageEditor } from './CoverImageEditor';
import { useImageEditor } from './hooks/useImageEditor';
import { BACK_THEMES, UploadSection } from './CoverBackShared';

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
    imageUrl: backUrl,
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
    imageType: 'back',
    onUpdate,
    onImageUpload,
    onImageDelete,
  });

  const theme = BACK_THEMES[useAlternateDesign ? 'magazine' : 'default'];

  return (
    <div
      ref={containerRef}
      id={`back-${article.id}`}
      className={theme.containerClass}
      {...eventHandlers}
    >
      {/* Background */}
      {theme.renderBg(hasImage, backUrl ?? '')}

      {/* Full-bleed image */}
      <CoverImageEditor
        imageUrl={backUrl ?? undefined}
        isDragging={isDragging}
        isEditable={isEditable}
        isImageSelected={isImageSelected}
        zoom={zoom}
        imageContainerRef={imageContainerRef}
        toolbarPos={toolbarPos}
        replaceInputRef={replaceInputRef}
        alt="Back Cover"
        hintText="双击更换封底图片，单击选中编辑"
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

      {/* Header section */}
      <div className={`flex flex-col items-start z-[3] w-full relative px-[40px] md:px-[60px] ${theme.headerPt} shrink-0`}>
        <div className={theme.subtitleClass}>
          {theme.subtitle}
        </div>
        {theme.hasDivider && (
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#005596]/20 to-transparent mb-[15px]"></div>
        )}
        {theme.renderTitle()}
      </div>

      {/* Upload button when no image */}
      <UploadSection
        style={theme.uploadStyle}
        iconName="image"
        label={theme.uploadStyle === 'magazine' ? '添加封底图片' : '+ BACK PHOTO'}
        hintText="建议尺寸 1200×1600"
        onClick={() => { if (isEditable) onImageUpload?.('back'); }}
        hasImage={hasImage}
      />

      {/* Spacer when no image */}
      {!hasImage && <div className="shrink-0 h-[60px]"></div>}

      {/* Footer background strip */}
      <div className={theme.footerStripClass}></div>

      {/* Footer */}
      {theme.renderFooter({ article, mode, logo })}
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
