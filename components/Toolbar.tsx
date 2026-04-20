import React, { useState } from 'react';
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

const Toolbar = React.memo<ToolbarProps>(({
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
  if (isFullscreen) {
    return (
      <div className="no-print fixed top-4 right-4 bg-white/90 backdrop-blur rounded-xl flex items-center gap-1 px-3 py-2 shadow-xl shadow-black/5 z-[50] border border-gray-100">
        <button onClick={onExportReader} className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition-all" title="导出阅读版">
          <Icon name="download" className="w-3.5 h-3.5" />
        </button>
        <button onClick={onExportProject} className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition-all" title="保存工程">
          <Icon name="save" className="w-3.5 h-3.5" />
        </button>
        <button onClick={onToggleFullscreen} className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition-all" title="退出全屏">
          <Icon name="minimize" className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <div className="no-print absolute top-5 right-5 bg-white/90 backdrop-blur rounded-xl flex items-center justify-end px-4 py-2 gap-2 shadow-xl shadow-black/5 z-[50] border border-gray-100">
      
      {/* 1. 核心操作组 - 新建、编辑 */}
      <div className="flex items-center gap-1">
        <button
          onClick={onNewArticle}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
          title="新建文章"
        >
          <Icon name="plus" className="w-3.5 h-3.5" />
          <span>新建</span>
        </button>
        <button
          onClick={onEditArticle}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentId ? 'bg-blue-50 text-brand-blue hover:bg-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
          title="编辑当前文章"
        >
          <Icon name="edit" className="w-3.5 h-3.5" />
          <span>编辑</span>
        </button>
      </div>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      {/* 2. 数据接入组 */}
      <div className="relative group" onClick={() => setOpenDropdown(openDropdown === 'data' ? null : 'data')} onBlur={() => setTimeout(() => setOpenDropdown(null), 150)}>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-medium transition-all"
          title="导入外部数据"
        >
          <Icon name="upload" className="w-3.5 h-3.5" />
          <span>数据接入</span>
          <Icon name="arrow-right" className="w-3 h-3 rotate-90" />
        </button>
        <div className={`absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl transition-all z-50 overflow-hidden ${openDropdown === 'data' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <button 
            onClick={onImport} 
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
          >
            <Icon name="pdf" className="w-4 h-4 text-blue-500" />
            <div className="text-left">
              <div className="font-medium">导入工程</div>
              <div className="text-xs text-gray-400">导入HTML/JSON工程文件</div>
            </div>
          </button>
          <button 
            onClick={onOpenAiCuration} 
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon name="image" className="w-4 h-4 text-green-500" />
            <div className="text-left">
              <div className="font-medium">单篇微信导入</div>
              <div className="text-xs text-gray-400">导入微信文章内容</div>
            </div>
          </button>
        </div>
      </div>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      {/* 3. AI 情报中枢 */}
      <div className="relative group" onClick={() => setOpenDropdown(openDropdown === 'ai' ? null : 'ai')} onBlur={() => setTimeout(() => setOpenDropdown(null), 150)}>
        <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-sm hover:shadow-md transition-all">
          <Icon name="refresh" className="w-3.5 h-3.5" />
          <span>AI 情报中枢</span>
          <Icon name="arrow-right" className="w-3 h-3 rotate-90" />
        </button>
        <div className={`absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl transition-all z-50 overflow-hidden ${openDropdown === 'ai' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          {onOpenAiCuration && (
            <button 
              onClick={onOpenAiCuration} 
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-indigo-700 hover:bg-indigo-50 border-b border-gray-100"
            >
              <Icon name="keyboard" className="w-4 h-4" />
              <div className="text-left">
                <div className="font-bold">AI 智能选题总编室</div>
                <div className="text-xs text-gray-500">基于AI引擎的智能选题</div>
              </div>
            </button>
          )}
          {onGenerateGraph && (
            <button 
              onClick={onGenerateGraph} 
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-emerald-700 hover:bg-emerald-50"
            >
              <Icon name="settings" className="w-4 h-4" />
              <div className="text-left">
                <div className="font-bold">提取全局知识图谱</div>
                <div className="text-xs text-gray-500">生成技术知识图谱</div>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      {/* 4. 视图与操作组 */}
      <div className="flex items-center gap-1">
        <button 
          onClick={onToggleFullscreen} 
          className="px-2.5 py-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors"
          title="切换全屏模式"
        >
          <Icon name="maximize" className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={onDelete} 
          className="px-2.5 py-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
          title="删除当前文章"
        >
          <Icon name="trash" className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      {/* 5. 高级功能组 */}
      <div className="flex items-center gap-1">
        <button 
          onClick={onReset} 
          className="flex items-center gap-2 px-3 py-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-medium transition-colors"
          title="重置所有数据"
        >
          <Icon name="lock" className="w-3.5 h-3.5" />
          <span>重置</span>
        </button>
        {onGenerateForeword && (
          <button 
            onClick={onGenerateForeword} 
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            <Icon name="save" className="w-3.5 h-3.5" />
            <span>生成本期导读</span>
          </button>
        )}
      </div>

      <div className="w-px h-4 bg-gray-100 mx-1"></div>

      {/* 6. 导出与发布组 */}
      <div className="flex items-center gap-1">
        <button 
          onClick={onExportReader} 
          className="flex items-center gap-2 px-3 py-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors"
          title="导出阅读版HTML"
        >
          <Icon name="expand" className="w-3.5 h-3.5" />
          <span>导出阅读版</span>
        </button>
        {onTogglePublish && currentId !== null && (
          <button
            onClick={onTogglePublish}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isPublished
                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                : 'text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
            title={isPublished ? "当前已发布，点击取消发布" : "当前为草稿，点击发布"}
          >
            <Icon name={isPublished ? "check" : "send"} className="w-3.5 h-3.5" />
            <span>{isPublished ? '已发布' : '发布'}</span>
          </button>
        )}
        <button 
          onClick={onExportProject} 
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all"
        >
          <Icon name="save" className="w-3.5 h-3.5" />
          <span>保存工程</span>
        </button>
      </div>
    </div>
  );
});

export default Toolbar;
