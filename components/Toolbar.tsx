import React from 'react';
import { Icon } from './Icons';

interface ToolbarProps {
  currentId: number | null;
  isFullscreen: boolean;
  onNewArticle: () => void;
  onEditArticle: () => void;
  onImport: () => void;
  onToggleFullscreen: () => void;
  onDelete: () => void;
  onReset: () => void;
  onExportReader: () => void;
  onExportProject: () => void;
  isPublished?: boolean;
  onTogglePublish?: () => void;
  onGenerateForeword?: () => void;
  onGenerateGraph?: () => void;
  onOpenAiCuration?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentId,
  isFullscreen,
  onNewArticle,
  onEditArticle,
  onImport,
  onToggleFullscreen,
  onDelete,
  onReset,
  onExportReader,
  onExportProject,
  isPublished,
  onTogglePublish,
  onGenerateForeword,
  onGenerateGraph,
  onOpenAiCuration,
}) => {
  if (isFullscreen) return null;

  return (
    <div className="no-print absolute top-5 right-5 h-12 bg-white/90 backdrop-blur rounded-xl flex items-center justify-end px-4 gap-2 shadow-xl shadow-black/5 z-[50] border border-gray-100">
      <button
        onClick={onNewArticle}
        className="px-4 py-2 border-none bg-blue-600 text-white rounded-lg cursor-pointer text-xs font-bold hover:bg-blue-700 transition-all active:scale-95"
      >
        新建
      </button>
      <button
        onClick={onEditArticle}
        className={`px-4 py-2 border-none rounded-lg cursor-pointer text-xs font-bold transition-all active:scale-95 ${currentId ? 'bg-blue-50 text-brand-blue hover:bg-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
      >
        编辑
      </button>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      {/* 📥 数据接入下拉组 */}
      <div className="relative group">
        <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
          <span>📥 数据接入</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div className="absolute left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <button 
            onClick={onImport} 
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            📄 导入本地文档
          </button>
          <button 
            // 暂时绑定到onImport，后续可以添加单独的单篇微信导入函数
            onClick={onImport} 
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            🟢 单篇微信导入
          </button>
        </div>
      </div>

      {/* 🤖 AI 情报中枢下拉组 (使用酷炫渐变色) */}
      <div className="relative group ml-2">
        <button className="flex items-center gap-1 px-4 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md shadow-sm hover:shadow-md transition-all">
          <span>🤖 AI 情报中枢</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
          {onOpenAiCuration && (
            <button 
              onClick={onOpenAiCuration} 
              className="w-full text-left px-4 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50 border-b border-gray-100"
            >
              📑 AI 智能选题总编室
            </button>
          )}
          {onGenerateGraph && (
            <button 
              onClick={onGenerateGraph} 
              className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              🕸️ 提取全局知识图谱
            </button>
          )}
        </div>
      </div>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      <button onClick={onToggleFullscreen} className="px-3 py-2 text-gray-400 hover:text-gray-800 text-xs font-bold transition-colors" title="全屏模式">
        全屏
      </button>
      <button onClick={onDelete} className="px-3 py-2 text-gray-400 hover:text-red-500 text-xs font-bold transition-colors" title="删除当前文章">
        删除
      </button>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      <button onClick={onReset} className="px-3 py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg text-xs font-bold transition-colors">
        重置
      </button>
      {onGenerateForeword && (
        <button 
          onClick={onGenerateForeword} 
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
        >
          ✨ 生成本期导读
        </button>
      )}
      <button onClick={onExportReader} className="px-3 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors">
        导出阅读版
      </button>
      {onTogglePublish && currentId !== null && (
       <button
         onClick={onTogglePublish}
         className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
           isPublished
             ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50'
             : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200/50'
         }`}
         title={isPublished ? "当前已发布，点击取消发布" : "当前为草稿，点击发布"}
       >
         <Icon name={isPublished ? "check" : "send"} className="w-4 h-4" />
         <span>{isPublished ? '已发布' : '发布文章'}</span>
       </button>
     )}
      <button onClick={onExportProject} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-lg shadow-black/10 active:scale-95">
        保存工程
      </button>
    </div>
  );
};

export default Toolbar;
