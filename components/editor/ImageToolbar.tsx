import React from 'react';

interface ImageToolbarProps {
  position: { top: number; left: number };
  onAlign: (align: 'left' | 'center' | 'right') => void;
  onSize: (size: '30%' | '60%' | '100%') => void;
  onReplace: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCaption: () => void;
  onDelete: () => void;
  replaceInputRef: React.RefObject<HTMLInputElement>;
}

const ImageToolbar = React.memo(({ position, onAlign, onSize, onReplace, onCaption, onDelete, replaceInputRef }: ImageToolbarProps) => (
  <div
    className="fixed z-[300] flex items-center gap-1 bg-white rounded-lg shadow-xl border border-gray-200 px-2 py-1.5"
    style={{
      top: `${position.top}px`,
      left: `${position.left}px`,
      transform: 'translateX(-50%)',
    }}
  >
    <button onClick={() => onAlign('left')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors" title="左对齐">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
    </button>
    <button onClick={() => onAlign('center')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors" title="居中">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
    </button>
    <button onClick={() => onAlign('right')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors" title="右对齐">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
    <button onClick={() => onSize('30%')} className="px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded hover:text-gray-800 transition-colors" title="小图 30%">S</button>
    <button onClick={() => onSize('60%')} className="px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded hover:text-gray-800 transition-colors" title="中图 60%">M</button>
    <button onClick={() => onSize('100%')} className="px-1.5 py-0.5 text-[10px] font-bold text-gray-500 hover:bg-gray-100 rounded hover:text-gray-800 transition-colors" title="大图 100%">L</button>
    <div className="w-px h-4 bg-gray-200 mx-0.5"></div>
    <label className="p-1.5 hover:bg-blue-50 rounded text-gray-500 hover:text-brand-blue cursor-pointer transition-colors" title="替换图片">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <input type="file" className="hidden" accept="image/*" onChange={onReplace} ref={replaceInputRef as React.Ref<HTMLInputElement>} />
    </label>
    <button onClick={onCaption} className="p-1.5 hover:bg-purple-50 rounded text-gray-500 hover:text-purple-600 transition-colors" title="添加/移除题注">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h10M4 17h12"/></svg>
    </button>
    <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded text-gray-500 hover:text-red-500 transition-colors" title="删除图片">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
    </button>
  </div>
));

export default ImageToolbar;
