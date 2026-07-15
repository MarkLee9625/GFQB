import React from 'react';
import ImageToolbar from '../editor/ImageToolbar';

interface CoverImageEditorProps {
  imageUrl: string | undefined;
  isDragging: boolean;
  isEditable: boolean;
  isImageSelected: boolean;
  zoom: { x: number; y: number; scale: number };
  imageContainerRef: React.RefObject<HTMLDivElement | null>;
  toolbarPos: { top: number; left: number } | null;
  replaceInputRef: React.RefObject<HTMLInputElement | null>;
  alt: string;
  hintText: string;
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  selectedClass?: string;
  handleImageClick: (e: React.MouseEvent) => void;
  handleImageDoubleClick: (e: React.MouseEvent) => void;
  handleContainerClick: () => void;
  handleImgAlign: (align: 'left' | 'center' | 'right') => void;
  handleImgDelete: () => void;
  handleImgReplace: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImgCaption: () => void;
}

export const CoverImageEditor: React.FC<CoverImageEditorProps> = React.memo(({
  imageUrl,
  isDragging,
  isEditable,
  isImageSelected,
  zoom,
  imageContainerRef,
  toolbarPos,
  replaceInputRef,
  alt,
  hintText,
  gradientFrom = 'from-black/5',
  gradientVia = 'via-black/15',
  gradientTo = 'to-black/60',
  selectedClass = 'cover-img-selected',
  handleImageClick,
  handleImageDoubleClick,
  handleContainerClick,
  handleImgAlign,
  handleImgDelete,
  handleImgReplace,
  handleImgCaption,
}) => {
  return (
    <>
      {imageUrl && (
        <div
          ref={imageContainerRef}
          className={`absolute inset-0 z-[1] ${isEditable ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          onClick={handleContainerClick}
        >
          <div className={`w-full h-full ${isImageSelected ? selectedClass : ''}`}>
            <img
              src={imageUrl}
              alt={alt}
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
          <div className={`absolute inset-0 bg-gradient-to-b ${gradientFrom} ${gradientVia} ${gradientTo} pointer-events-none z-[2]`}></div>
          {isEditable && !isImageSelected && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-[3]">
              <div className="bg-black/60 text-white text-xs px-3 py-2 rounded backdrop-blur-sm">
                {hintText}
              </div>
            </div>
          )}
        </div>
      )}
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
    </>
  );
});

CoverImageEditor.displayName = 'CoverImageEditor';
