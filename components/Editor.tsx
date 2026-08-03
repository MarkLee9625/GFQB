import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import type { Article } from '../src/types';
import { isSpecialCategory } from '../src/constants';
import { htmlToBlocks } from '../src/utils/blockParser';
import { Icon } from './Icons';
import LoadingOverlay from './LoadingOverlay';
import { ArticleRenderer } from './renderers';
import FormattingToolbar from './editor/FormattingToolbar';
import ImageToolbar from './editor/ImageToolbar';
import EditorRightPanel from './editor/EditorRightPanel';
import EditorFooter from './editor/EditorFooter';
import { useEditorState } from './editor/hooks/useEditorState';
import { useSelectionManager } from './editor/hooks/useSelectionManager';
import { useEditorCommands } from './editor/hooks/useEditorCommands';
import { useImageToolbar } from './editor/hooks/useImageToolbar';
import { useFileUpload } from './editor/hooks/useFileUpload';
import { useEditorKeyboard } from './editor/hooks/useEditorKeyboard';

interface EditorProps {
  isOpen: boolean;
  article: Partial<Article>;
  categories: string[];
  onClose: () => void;
  onSave: (article: Partial<Article>) => void;
  onManageCats: () => void;
}

const noop = () => {};

export const Editor: React.FC<EditorProps> = ({ isOpen, article, categories, onClose, onSave, onManageCats }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const imgReplaceInputRef = useRef<HTMLInputElement | null>(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  const {
    formData, setFormData,
    title, setTitle,
    tempPdf, setTempPdf,
    isProcessing, setIsProcessing,
    isGeneratingAi, setIsGeneratingAi,
    isGeneratingTitle, setIsGeneratingTitle,
    showAiLoading, setShowAiLoading,
    showTitleLoading, setShowTitleLoading,
    isScalingText, setIsScalingText,
    saveToast, setSaveToast,
    imgCompressQuality, setImgCompressQuality,
    imgCompressMaxWidth, setImgCompressMaxWidth,
    imgCompressFormat, setImgCompressFormat,
    contentAreaStyle,
    resetForArticle,
  } = useEditorState({ isOpen, article, categories });

  const { saveSelection, saveSelectionSync, restoreSelection } = useSelectionManager();

  const {
    execCmd,
    handleAutoIndent,
    handleScaleText,
    handleAiSummary,
    handleAiTitle,
    insertHtml,
  } = useEditorCommands({
    contentRef,
    formData,
    setFormData,
    setTitle,
    setIsGeneratingAi,
    setIsGeneratingTitle,
    setShowAiLoading,
    setShowTitleLoading,
    setIsScalingText,
    saveSelection,
    restoreSelection,
  });

  const {
    selectedImgEl,
    imgToolbarPos,
    handleEditorClick,
    handleImgAlign,
    handleImgSize,
    handleImgReplace,
    handleImgDelete,
    handleImgCaption,
  } = useImageToolbar();

  const {
    handlePaste,
    handleFile,
  } = useFileUpload({
    contentRef,
    formData,
    title,
    setFormData,
    setIsProcessing,
    insertHtml,
    handleAutoIndent,
    imgCompressMaxWidth,
    imgCompressQuality,
    imgCompressFormat,
    setTempPdf,
    saveSelection,
    restoreSelection,
  });

  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const onSaveRef = useRef(() => { handleSave(); });
  onSaveRef.current = () => { handleSave(); };

  useEditorKeyboard({
    isOpen,
    contentRef,
    formDataRef,
    onSaveRef,
    setSaveToast,
    execCmd,
  });

  useEffect(() => {
    resetForArticle(contentRef);
  }, [isOpen, article.id, resetForArticle]);

  const handleSave = useCallback((targetPublishState?: boolean) => {
    if (!title) return alert("请输入标题");

    let finalContent = contentRef.current?.innerHTML || '';

    // 双存储：保存时把解析结果一并持久化，阅读打开时直接命中 blocks，
    // 避免每次打开都全量解析正文；封面/封底或空正文不附加。
    const blocks = finalContent.trim() ? htmlToBlocks(finalContent) : undefined;

    onSave({
      ...formData,
      title,
      content: finalContent,
      blocks,
      pdfData: tempPdf?.data,
      isPublished: targetPublishState !== undefined ? targetPublishState : formData.isPublished
    });
  }, [formData, title, tempPdf, onSave]);

  const handleImgReplaceWithSettings = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleImgReplace(e, imgCompressMaxWidth, imgCompressQuality, imgCompressFormat);
  }, [handleImgReplace, imgCompressMaxWidth, imgCompressQuality, imgCompressFormat]);

  const handleArticleUpdate = useCallback((id: number, updates: Partial<Article>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, [setFormData]);

  const handleImageUpload = useCallback((type: 'cover' | 'back') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      handleFile({ target: e.target as HTMLInputElement } as React.ChangeEvent<HTMLInputElement>, 'img');
    };
    input.click();
  }, [handleFile]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    handleEditorClick(e, contentRef);
  }, [handleEditorClick]);

  const handleFieldChange = useCallback((field: string, value: string | number | boolean | string[] | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, [setFormData]);

  // 新建文章时 id 可能为 undefined，渲染器里对 id=0 的更新会被忽略（与 undefined 行为一致）
  const articleForRenderer = useMemo(
    () => ({ ...formData, title, id: formData.id ?? 0 } as Article),
    [formData, title]
  );

  // 稳定引用：避免内联对象/箭头函数击穿 EditorRightPanel 的 React.memo
  const imageCompressSettings = useMemo(() => ({
    quality: imgCompressQuality,
    setQuality: setImgCompressQuality,
    maxWidth: imgCompressMaxWidth,
    setMaxWidth: setImgCompressMaxWidth,
    format: imgCompressFormat,
    setFormat: setImgCompressFormat,
  }), [imgCompressQuality, imgCompressMaxWidth, imgCompressFormat]);

  const handleToggleCollapse = useCallback(() => {
    setRightPanelCollapsed(v => !v);
  }, []);


  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[100] flex items-center justify-center p-0 md:p-6 overflow-hidden w-full">

      {showAiLoading && (
        <LoadingOverlay 
          isLoading={true}
          message="DeepSeek 正在进行深度逻辑推理，请耐心等待 (约 10-30 秒)..."
        />
      )}

      {showTitleLoading && (
        <LoadingOverlay 
          isLoading={true}
          message="DeepSeek 正在分析内容，生成精准标题..."
        />
      )}

      {isProcessing && (
        <div className="absolute inset-0 z-[200] bg-white/50 flex flex-col items-center justify-center backdrop-blur-[2px]">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin mb-3"></div>
          <div className="text-brand-blue font-bold text-sm">正在上传资源...</div>
        </div>
      )}

      {saveToast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[300] bg-emerald-500 text-white px-5 py-2.5 rounded-lg shadow-lg text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300">
          {saveToast}
        </div>
      )}

      <div className="bg-white w-full max-w-[1600px] h-full rounded-2xl flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Icon name="edit" className="w-4 h-4 text-brand-blue" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 tracking-tight">
              {formData.id ? '编辑工作台' : '创作新篇章'}
            </h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-800 transition-all">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col border-r border-gray-100 bg-gray-50/30 min-h-0">
            <div className="p-8 pb-4 flex items-center gap-2">
              <input
                className={`flex-1 bg-transparent text-3xl font-bold border-none placeholder:text-gray-300 focus:outline-none focus:ring-0 leading-tight`}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="在这里输入引人入胜的标题..."
              />
              <button
                onClick={handleAiTitle}
                disabled={isGeneratingTitle}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all ${isGeneratingTitle ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-brand-blue text-white shadow-lg shadow-blue-200 hover:scale-105 active:scale-95'}`}
              >
                {isGeneratingTitle ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '✨'}
                AI 拟题
              </button>
            </div>

            <FormattingToolbar
              onExecCmd={execCmd}
              onAutoIndent={handleAutoIndent}
              onScaleText={handleScaleText}
              isScalingText={isScalingText}
              onFile={handleFile}
            />

            {isSpecialCategory(formData.category) ? (
              <div className="flex-1 relative overflow-hidden bg-gray-50 min-h-[600px]">
                <ArticleRenderer
                  article={articleForRenderer}
                  mode="edit"
                  isEditable={true}
                  onArticleUpdate={handleArticleUpdate}
                  onImageUpload={handleImageUpload}
                  onNext={noop}
                  useAlternateDesign={false}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-12 bg-white max-w-full relative transform-gpu">
                <div
                  ref={contentRef}
                  className="sws-prose editor-area min-h-full focus:outline-none"
                  contentEditable
                  onPaste={handlePaste}
                  onClick={handleContentClick}
                  onMouseUp={saveSelection}
                  onKeyUp={saveSelection}
                  onBlur={saveSelectionSync}
                  style={contentAreaStyle}
                  data-placeholder="开始输入正文，或粘贴内容… 支持直接粘贴图片和 PDF"
                />
                {imgToolbarPos && selectedImgEl && (
                  <ImageToolbar
                    position={imgToolbarPos}
                    onAlign={handleImgAlign}
                    onSize={handleImgSize}
                    onReplace={handleImgReplaceWithSettings}
                    onCaption={handleImgCaption}
                    onDelete={handleImgDelete}
                    replaceInputRef={imgReplaceInputRef}
                  />
                )}
              </div>
            )}
          </div>

          <EditorRightPanel
            formData={formData}
            onFieldChange={handleFieldChange}
            categories={categories}
            onManageCats={onManageCats}
            isGeneratingAi={isGeneratingAi}
            handleAiSummary={handleAiSummary}
            tempPdf={tempPdf}
            setTempPdf={setTempPdf}
            imageCompress={imageCompressSettings}
            collapsed={rightPanelCollapsed}
            onToggleCollapse={handleToggleCollapse}
          />
        </div>

        <EditorFooter
          hasId={formData.id}
          isPublished={formData.isPublished || false}
          onClose={onClose}
          onSave={handleSave}
          contentRef={contentRef}
        />
      </div >
    </div >
  );
};
