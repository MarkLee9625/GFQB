import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../Icons';

interface EditorFooterProps {
  hasId: number | undefined;
  isPublished: boolean;
  onClose: () => void;
  onSave: (targetPublishState?: boolean) => void;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

const EditorFooter = React.memo(({ hasId, isPublished, onClose, onSave, contentRef }: EditorFooterProps) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [wordCount, setWordCount] = useState({ chars: 0, words: 0 });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'editing' | 'saving'>('saved');
  const prevContentRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!contentRef?.current) return;

    const updateCount = () => {
      if (!contentRef.current) return;
      const text = contentRef.current.textContent || '';
      const chars = text.replace(/\s/g, '').length;
      const words = text.trim() ? text.trim().length : 0;
      setWordCount({ chars, words });
    };

    const observer = new MutationObserver(() => {
      updateCount();
      const currentContent = contentRef.current?.innerHTML || '';
      if (currentContent !== prevContentRef.current) {
        prevContentRef.current = currentContent;
        setSaveStatus('editing');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          setSaveStatus('saved');
        }, 3000);
      }
    });

    observer.observe(contentRef.current, { childList: true, subtree: true, characterData: true });
    updateCount();

    return () => {
      observer.disconnect();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [contentRef]);

  const handleDiscard = () => {
    setShowDiscardConfirm(true);
  };

  const confirmDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  return (
    <>
      <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center bg-white relative">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            {saveStatus === 'saved' && (
              <>
                <Icon name="check" className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-600">已保存</span>
              </>
            )}
            {saveStatus === 'editing' && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
                <span className="text-amber-600">编辑中...</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <div className="w-3 h-3 border-2 border-gray-300 border-t-brand-blue rounded-full animate-spin"></div>
                <span>保存中...</span>
              </>
            )}
          </div>
          <span className="text-gray-300">|</span>
          <span>{wordCount.chars} 字</span>
          <span className="text-gray-300">|</span>
          <span>{wordCount.words} 字符</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDiscard}
            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-all font-bold text-xs shadow-sm"
          >
            放弃修改
          </button>
          <button
            onClick={() => { setSaveStatus('saving'); onSave(false); setTimeout(() => setSaveStatus('saved'), 800); }}
            className="px-6 py-2.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-100 transition-all font-bold text-xs shadow-sm"
          >
            存为草稿
          </button>
          <button
            onClick={() => { setSaveStatus('saving'); onSave(true); setTimeout(() => setSaveStatus('saved'), 800); }}
            className="px-8 py-2.5 bg-brand-blue text-white rounded-xl hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-0.5 transition-all font-bold text-xs shadow-lg active:translate-y-0"
          >
            {hasId && isPublished ? '更新并发布' : '直接发布'}
          </button>
        </div>
      </div>

      {showDiscardConfirm && (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Icon name="alert" className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">确认放弃修改？</h3>
                <p className="text-xs text-gray-500 mt-0.5">未保存的内容将丢失</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                继续编辑
              </button>
              <button
                onClick={confirmDiscard}
                className="px-4 py-2 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                确认放弃
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default EditorFooter;
