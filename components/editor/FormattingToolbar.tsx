import React from 'react';
import { Icon } from '../Icons';

interface FormattingToolbarProps {
  onExecCmd: (cmd: string, val?: string) => void;
  onAutoIndent: () => void;
  onScaleText: (mode: 'expand' | 'shrink') => void;
  isScalingText: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>, type: 'img' | 'video' | 'audio' | 'pdf') => void;
}

const FormattingToolbar = React.memo(({ onExecCmd, onAutoIndent, onScaleText, isScalingText, onFile }: FormattingToolbarProps) => (
  <div className="px-8 py-2 flex items-center gap-1 border-b border-gray-100 bg-white sticky top-0 z-20">
    <div className="flex items-center gap-0.5 mr-2">
      {['bold', 'italic', 'underline'].map(cmd => (
        <button
          key={cmd}
          onClick={() => onExecCmd(cmd)}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title={cmd}
        >
          <Icon name={cmd as any} className="w-4 h-4" />
        </button>
      ))}
    </div>

    <div className="w-px h-4 bg-gray-200 mx-1"></div>

    <div className="flex items-center gap-1 mx-2">
      <button
        onClick={() => onExecCmd('formatBlock', '<h2>')}
        className="px-2 py-1 text-xs font-black text-gray-700 hover:bg-gray-100 rounded border border-transparent hover:border-gray-200"
        title="二级标题"
      >H2</button>
      <button
        onClick={() => onExecCmd('formatBlock', '<blockquote>')}
        className="px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded"
        title="引用"
      >Quote</button>
      <button
        onClick={() => onExecCmd('insertUnorderedList')}
        className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
        title="无序列表"
      >
        <Icon name="menu" className="w-4 h-4" />
      </button>
    </div>

    <div className="w-px h-4 bg-gray-200 mx-1"></div>

    <div className="flex items-center gap-1 mx-2">
      <button
        onClick={() => onExecCmd('justifyLeft')}
        className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-colors"
        title="左对齐"
      >
        <Icon name="align-left" className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const container = selection.getRangeAt(0).commonAncestorContainer;
            const element = container.nodeType === 3 ? container.parentElement : (container as HTMLElement);
            if (element && (element.style.textAlign === 'center' || element.getAttribute('align') === 'center')) {
              onExecCmd('justifyLeft');
            } else {
              onExecCmd('justifyCenter');
            }
          }
        }}
        className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-colors"
        title="居中切换"
      >
        <Icon name="align-center" className="w-4 h-4" />
      </button>
    </div>

    <div className="w-px h-4 bg-gray-200 mx-1"></div>

    <div className="ml-2">
      <button
        onClick={onAutoIndent}
        className="px-3 py-1 bg-blue-50 text-brand-blue text-[11px] font-bold rounded hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
        title="智能首行缩进"
      >智能缩进</button>
    </div>

    <div className="w-px h-4 bg-gray-200 mx-1"></div>

    <div className="flex items-center gap-2 mx-1">
      <button
        onClick={() => onScaleText('expand')}
        disabled={isScalingText}
        className={`flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded border shadow-sm transition-all ${
          isScalingText ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100 hover:-translate-y-0.5'
        }`}
        title="AI 智能扩写选中段落"
      >
        {isScalingText ? <div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div> : '➕'}
        AI 扩写
      </button>
      <button
        onClick={() => onScaleText('shrink')}
        disabled={isScalingText}
        className={`flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded border shadow-sm transition-all ${
          isScalingText ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 hover:-translate-y-0.5'
        }`}
        title="AI 智能精简选中段落"
      >
        {isScalingText ? <div className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin"></div> : '➖'}
        AI 精简
      </button>
    </div>

    <div className="flex-1"></div>

    <div className="flex gap-2">
      <label className="cursor-pointer p-2 hover:bg-blue-50 text-brand-blue rounded transition-colors group relative">
        <Icon name="image" className="w-4 h-4" />
        <input type="file" className="hidden" accept="image/*" onChange={e => onFile(e, 'img')} />
      </label>
      <label className="cursor-pointer p-2 hover:bg-purple-50 text-purple-600 rounded transition-colors relative">
        <Icon name="video" className="w-4 h-4" />
        <input type="file" className="hidden" accept="video/*" onChange={e => onFile(e, 'video')} />
      </label>
      <label className="cursor-pointer p-2 hover:bg-red-50 text-red-500 rounded transition-colors relative">
        <Icon name="pdf" className="w-4 h-4" />
        <input type="file" className="hidden" accept="application/pdf" onChange={e => onFile(e, 'pdf')} />
      </label>
    </div>
  </div>
));

export default FormattingToolbar;
