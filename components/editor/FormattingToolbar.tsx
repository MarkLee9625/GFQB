import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../Icons';
import { toast } from '../../src/utils/toast';

interface FormattingToolbarProps {
  onExecCmd: (cmd: string, val?: string) => void;
  onAutoIndent: () => void;
  onScaleText: (mode: 'expand' | 'shrink') => void;
  isScalingText: boolean;
  onFile: (e: React.ChangeEvent<HTMLInputElement>, type: 'img' | 'video' | 'audio' | 'pdf') => void;
}

const FormattingToolbar = React.memo(({ onExecCmd, onAutoIndent, onScaleText, isScalingText, onFile }: FormattingToolbarProps) => {
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const updateActiveStates = useCallback(() => {
    setActiveStates({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveStates);
    return () => document.removeEventListener('selectionchange', updateActiveStates);
  }, [updateActiveStates]);

  const handleInsertLink = useCallback(() => {
    const url = linkUrl.trim();
    if (url) {
      // 协议白名单：仅允许 http/https/mailto/tel 及相对路径/锚点，
      // 拒绝 javascript:/data:/vbscript: 等可执行协议（与 pasteCleaner 粘贴链路行为一致）
      const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url);
      const isAllowedScheme = /^(https?|mailto|tel):/i.test(url);
      if (hasScheme && !isAllowedScheme) {
        toast.warning('链接地址不安全，仅支持 http/https/mailto/tel 协议');
        return;
      }
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (range.collapsed) {
          const a = document.createElement('a');
          a.href = url;
          a.textContent = url;
          a.target = '_blank';
          range.insertNode(a);
          range.collapse(false);
        } else {
          onExecCmd('createLink', url);
        }
      }
      setLinkUrl('');
      setShowLinkInput(false);
    }
  }, [linkUrl, onExecCmd]);

  const headingBtnClass = (active: boolean) =>
    `px-2 py-1 text-xs font-black rounded border transition-all ${
      active ? 'bg-brand-blue text-white border-brand-blue' : 'text-gray-700 border-transparent hover:bg-gray-100 hover:border-gray-200'
    }`;

  const fmtBtnClass = (active: boolean) =>
    `p-2 rounded transition-colors ${active ? 'bg-brand-blue text-white' : 'hover:bg-gray-100 text-gray-600'}`;

  return (
    <div className="px-8 py-2 flex items-center gap-1 border-b border-gray-100 bg-white sticky top-0 z-20">
      <div className="flex items-center gap-0.5 mr-1">
        <button onClick={() => onExecCmd('undo')} className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="撤销 (Ctrl+Z)">
          <Icon name="undo" className="w-4 h-4" />
        </button>
        <button onClick={() => onExecCmd('redo')} className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors" title="重做 (Ctrl+Y)">
          <Icon name="redo" className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-200 mx-1"></div>

      <div className="flex items-center gap-0.5 mr-2">
        {[
          { cmd: 'bold', icon: 'bold', title: '加粗 (Ctrl+B)' },
          { cmd: 'italic', icon: 'italic', title: '斜体 (Ctrl+I)' },
          { cmd: 'underline', icon: 'underline', title: '下划线 (Ctrl+U)' },
        ].map(({ cmd, icon, title }) => (
          <button
            key={cmd}
            onClick={() => onExecCmd(cmd)}
            className={fmtBtnClass(!!activeStates[cmd])}
            title={title}
          >
            <Icon name={icon} className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-gray-200 mx-1"></div>

      <div className="flex items-center gap-1 mx-2 relative">
        <button
          onClick={() => setShowHeadingMenu(v => !v)}
          className={headingBtnClass(showHeadingMenu)}
          title="标题级别"
        >
          H▾
        </button>
        {showHeadingMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[100px]">
            {[
              { tag: '<h2>', label: 'H2 二级标题', shortcut: 'Alt+2' },
              { tag: '<h3>', label: 'H3 三级标题', shortcut: '' },
              { tag: '<h4>', label: 'H4 四级标题', shortcut: '' },
            ].map(h => (
              <button
                key={h.tag}
                onClick={() => { onExecCmd('formatBlock', h.tag); setShowHeadingMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 text-gray-700 flex justify-between items-center"
              >
                <span className="font-bold">{h.label}</span>
                {h.shortcut && <span className="text-[10px] text-gray-400 ml-2">{h.shortcut}</span>}
              </button>
            ))}
            <div className="border-t border-gray-100 my-1"></div>
            <button
              onClick={() => { onExecCmd('formatBlock', '<p>'); setShowHeadingMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 text-gray-500"
            >
              正文段落
            </button>
          </div>
        )}
        <button
          onClick={() => onExecCmd('formatBlock', '<blockquote>')}
          className="px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded"
          title="引用块"
        >Quote</button>
        <button
          onClick={() => onExecCmd('insertUnorderedList')}
          className={fmtBtnClass(!!activeStates.insertUnorderedList)}
          title="无序列表"
        >
          <Icon name="menu" className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-200 mx-1"></div>

      <div className="flex items-center gap-1 mx-2">
        <button
          onClick={() => onExecCmd('justifyLeft')}
          className={fmtBtnClass(!!activeStates.justifyLeft)}
          title="左对齐"
        >
          <Icon name="align-left" className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (activeStates.justifyCenter) {
              onExecCmd('justifyLeft');
            } else {
              onExecCmd('justifyCenter');
            }
          }}
          className={fmtBtnClass(!!activeStates.justifyCenter)}
          title="居中对齐"
        >
          <Icon name="align-center" className="w-4 h-4" />
        </button>
        <button
          onClick={() => onExecCmd('justifyRight')}
          className={fmtBtnClass(!!activeStates.justifyRight)}
          title="右对齐"
        >
          <Icon name="align-right" className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-200 mx-1"></div>

      <div className="flex items-center gap-1 mx-2">
        <button
          onClick={() => { setShowLinkInput(v => !v); setLinkUrl(''); }}
          className={`p-2 rounded transition-colors ${showLinkInput ? 'bg-brand-blue text-white' : 'hover:bg-gray-100 text-gray-600'}`}
          title="插入链接"
        >
          <Icon name="link" className="w-4 h-4" />
        </button>
        {showLinkInput && (
          <div className="flex items-center gap-1">
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleInsertLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
              placeholder="输入链接 URL..."
              className="w-40 px-2 py-1 text-xs border border-gray-200 rounded focus:border-brand-blue outline-none"
              autoFocus
            />
            <button
              onClick={handleInsertLink}
              className="px-2 py-1 text-[10px] font-bold bg-brand-blue text-white rounded hover:bg-brand-dark transition-colors"
            >确定</button>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-200 mx-1"></div>

      <div className="ml-1">
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
        <label className="cursor-pointer p-2 hover:bg-blue-50 text-brand-blue rounded transition-colors group relative" title="上传图片">
          <Icon name="image" className="w-4 h-4" />
          <input type="file" className="hidden" accept="image/*" onChange={e => onFile(e, 'img')} />
        </label>
        <label className="cursor-pointer p-2 hover:bg-purple-50 text-purple-600 rounded transition-colors relative" title="上传视频">
          <Icon name="video" className="w-4 h-4" />
          <input type="file" className="hidden" accept="video/*" onChange={e => onFile(e, 'video')} />
        </label>
        <label className="cursor-pointer p-2 hover:bg-red-50 text-red-500 rounded transition-colors relative" title="上传 PDF">
          <Icon name="pdf" className="w-4 h-4" />
          <input type="file" className="hidden" accept="application/pdf" onChange={e => onFile(e, 'pdf')} />
        </label>
      </div>
    </div>
  );
});

export default FormattingToolbar;
