import React, { useState } from 'react';
import { Article } from '../../src/types/models';
import { Icon } from '../Icons';

interface EditorRightPanelProps {
  formData: Partial<Article>;
  onFieldChange: (field: string, value: any) => void;
  categories: string[];
  onManageCats: () => void;
  isGeneratingAi: boolean;
  handleAiSummary: () => void;
  tempPdf: { name: string; data: string } | null;
  setTempPdf: React.Dispatch<React.SetStateAction<{ name: string; data: string } | null>>;
  imgCompressQuality: number;
  setImgCompressQuality: React.Dispatch<React.SetStateAction<number>>;
  imgCompressMaxWidth: number;
  setImgCompressMaxWidth: React.Dispatch<React.SetStateAction<number>>;
  imgCompressFormat: 'webp' | 'jpeg' | 'original';
  setImgCompressFormat: React.Dispatch<React.SetStateAction<'webp' | 'jpeg' | 'original'>>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const SectionBlock: React.FC<{
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full group"
      >
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          {icon && <Icon name={icon} className="w-3 h-3" />}
          {title}
        </h3>
        <svg
          className={`w-3 h-3 text-gray-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
};

const EditorRightPanel = React.memo(({
  formData, onFieldChange, categories, onManageCats, isGeneratingAi, handleAiSummary,
  tempPdf, setTempPdf, imgCompressQuality, setImgCompressQuality,
  imgCompressMaxWidth, setImgCompressMaxWidth, imgCompressFormat, setImgCompressFormat,
  collapsed, onToggleCollapse
}: EditorRightPanelProps) => {
  const category = formData.category || '';
  const tags = formData.tags || [];
  const abstract = formData.abstract || '';
  const fontSize = formData.fontSize || 18;
  const lineHeight = formData.lineHeight || 2.0;
  const pdfData = formData.pdfData;

  if (collapsed) {
    return (
      <div className="w-[48px] flex flex-col items-center py-4 bg-white border-l border-gray-100 gap-3">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-brand-blue hover:bg-blue-100 transition-colors"
          title="展开面板"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-7 h-px bg-gray-200 my-1"></div>
        <button
          onClick={handleAiSummary}
          disabled={isGeneratingAi}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-600 to-brand-blue text-white hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          title="AI 一键生成摘要"
        >
          ✨
        </button>
        <div className="w-7 h-px bg-gray-200 my-1"></div>
        <div className="flex flex-col items-center gap-1 text-[8px] text-gray-400 font-bold">
          <span>{fontSize}</span>
          <span>字号</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-[8px] text-gray-400 font-bold">
          <span>{lineHeight}</span>
          <span>行距</span>
        </div>
        {tempPdf && (
          <>
            <div className="w-7 h-px bg-gray-200 my-1"></div>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-500" title={`PDF: ${tempPdf.name}`}>
              <Icon name="pdf" className="w-3.5 h-3.5" />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
  <div className="w-[400px] flex flex-col bg-white overflow-y-auto scrollbar-hide border-l border-gray-100 transition-all duration-300">
    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">属性面板</span>
      <button
        onClick={onToggleCollapse}
        className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        title="收起面板 (获得更大编辑区)"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <div className="p-6 flex flex-col gap-6">

      <SectionBlock title="基础信息" icon="edit" defaultOpen={true}>
        <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
          {(category === '封面' || category === '封底') ? (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-500 flex justify-between">
                特殊页面类型 <button onClick={onManageCats} className="text-brand-blue hover:underline">管理</button>
              </label>
              <select
                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:border-brand-blue outline-none"
                value={category}
                onChange={e => onFieldChange('category', e.target.value)}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                  <Icon name="search" className="w-2.5 h-2.5" /> 标签 / 关键词 (支持人工录入)
                </label>
              </div>
              <div
                className="flex flex-wrap gap-2 p-2 bg-white border border-gray-200 rounded-lg focus-within:border-brand-blue transition-all min-h-[42px] cursor-text"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector('input');
                  if (input) input.focus();
                }}
              >
                {tags.map((tag, idx) => (
                  <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-brand-blue text-[11px] font-bold rounded-md">
                    {tag}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFieldChange('tags', tags.filter((_, i) => i !== idx));
                      }}
                      className="hover:text-red-500"
                    >
                      <Icon name="x" className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-gray-400"
                  placeholder={tags.length === 0 ? "点击输入标签，回车或空格分隔..." : "继续输入..."}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim().replace(/[,，]/g, ' ');
                    if (val) {
                      const newTags = val.split(/\s+/).filter(t => t && !tags.includes(t));
                      if (newTags.length > 0) {
                        onFieldChange('tags', [...tags, ...newTags]);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ' ') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim().replace(/[,，\s]/g, '');
                      if (val && !tags.includes(val)) {
                        onFieldChange('tags', [...tags, val]);
                        e.currentTarget.value = '';
                      }
                    }
                    if (e.key === 'Backspace' && e.currentTarget.value === '' && tags.length > 0) {
                      onFieldChange('tags', tags.slice(0, -1));
                    }
                  }}
                />
              </div>
              <div className="text-[10px] text-gray-400 flex justify-between px-1">
                <span>支持回车、空格、逗号分隔</span>
                <span>{tags.length} / 10 个建议</span>
              </div>
            </div>
          )}
        </div>
      </SectionBlock>

      <SectionBlock title="排版控制" icon="layout" defaultOpen={true}>
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
              <span>正文字号</span>
              <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{fontSize}px</span>
            </div>
            <input
              type="range" min="12" max="36" step="1"
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
              value={fontSize}
              onChange={e => onFieldChange('fontSize', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
              <span>行间距</span>
              <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{lineHeight}x</span>
            </div>
            <input
              type="range" min="1.0" max="3.0" step="0.1"
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
              value={lineHeight}
              onChange={e => onFieldChange('lineHeight', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="图片压缩" icon="image" defaultOpen={true}>
        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-5">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
              <span>输出格式</span>
            </div>
            <div className="flex gap-1.5">
              {([
                { value: 'webp' as const, label: 'WebP', desc: '体积最小' },
                { value: 'jpeg' as const, label: 'JPEG', desc: '兼容最好' },
                { value: 'original' as const, label: '原格式', desc: '不转码' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setImgCompressFormat(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                    imgCompressFormat === opt.value
                      ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                  <span className="block text-[8px] font-normal opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
              <span>最大宽度</span>
              <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{imgCompressMaxWidth}px</span>
            </div>
            <input
              type="range" min="400" max="2400" step="100"
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
              value={imgCompressMaxWidth}
              onChange={e => setImgCompressMaxWidth(parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
              <span>压缩质量</span>
              <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{Math.round(imgCompressQuality * 100)}%</span>
            </div>
            <input
              type="range" min="0.3" max="1.0" step="0.05"
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
              value={imgCompressQuality}
              onChange={e => setImgCompressQuality(parseFloat(e.target.value))}
            />
            <div className="flex justify-between text-[8px] text-gray-400">
              <span>体积小</span>
              <span>质量高</span>
            </div>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="摘要" icon="file-text" defaultOpen={true}>
        <div className="space-y-3">
          <button
            onClick={handleAiSummary}
            disabled={isGeneratingAi}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${isGeneratingAi ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-brand-blue text-white shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-[0.98]'}`}
            title="一键生成标题与摘要"
          >
            {isGeneratingAi ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '✨'}
            AI 一键生成标题与摘要
          </button>
          <textarea
            className="w-full h-[160px] bg-gray-50/50 border border-gray-100 rounded-xl p-4 text-[13px] leading-relaxed text-gray-600 focus:bg-white focus:border-brand-blue outline-none transition-all resize-none placeholder:text-gray-300"
            placeholder={pdfData ? "摘要：建议重点总结 PDF 的核心内容及效益... 将展示在阅读器顶部。" : "点击上方按钮生成摘要，或者在这里手动输入... 摘要将展示在导出版的标题正下方。建议重点描述：为什么要开展此项工法？能带来哪些效益？"}
            value={abstract || ''}
            onChange={e => onFieldChange('abstract', e.target.value)}
          />
        </div>
      </SectionBlock>

      {tempPdf && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm">
              <Icon name="pdf" className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-[10px] font-bold text-red-600 uppercase tracking-tight">附件 PDF</div>
              <div className="text-[11px] text-red-500 truncate max-w-[150px]">{tempPdf.name}</div>
            </div>
          </div>
          <button onClick={() => setTempPdf(null)} className="p-2 hover:bg-white rounded-lg text-red-300 hover:text-red-600 transition-colors">
            <Icon name="trash" className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
  );
});

export default EditorRightPanel;
