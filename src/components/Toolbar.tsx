import React from 'react';
import { Icon } from '@/components/Icons';

export interface ToolbarProps {
  currentId: number | null;
  isFullscreen: boolean;
  onToggleSidebar: () => void; // 新增：侧边栏切换回调
  onNewArticle: () => void;
  onEditArticle: () => void;
  onImport: () => void;
  onImportWechat: () => void;
  onToggleFullscreen: () => void;
  onDelete: () => void;
  onReset: () => void;
  onExportReader: () => void;
  onExportProject: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentId,
  isFullscreen,
  onToggleSidebar,
  onNewArticle,
  onEditArticle,
  onImport,
  onImportWechat,
  onToggleFullscreen,
  onDelete,
  onReset,
  onExportReader,
  onExportProject
}) => {
  // [修复]：移除全屏隐藏逻辑，确保用户能找到退出按钮
  // if (isFullscreen) return null;

  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-5 flex-shrink-0 z-20">
      <div className="flex items-center gap-3">
        {/* [修复]：新增侧边栏切换按钮 */}
        <button 
          onClick={onToggleSidebar} 
          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          title="切换侧边栏"
        >
          <Icon name="menu" className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        <button onClick={onNewArticle} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors shadow-sm">
          <Icon name="plus" className="w-4 h-4" />
          <span>新建</span>
        </button>
        
        <button 
          onClick={onEditArticle} 
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentId ? 'bg-blue-50 text-brand-blue hover:bg-blue-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
        >
          <Icon name="edit" className="w-4 h-4" />
          <span>编辑</span>
        </button>

        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        <button onClick={onImport} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
          <Icon name="upload" className="w-4 h-4" />
          <span>导入文件</span>
        </button>

        <button onClick={onImportWechat} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-md transition-colors border border-transparent hover:border-green-200" title="输入微信公众号链接导入">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          <span>公众号</span>
        </button>

        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        <button onClick={onExportReader} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="导出为HTML，包含目录页，优化打印">
          <Icon name="download" className="w-4 h-4" />
          <span>导出/打印PDF</span>
        </button>
        <button onClick={onExportProject} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
          <Icon name="save" className="w-4 h-4" />
          <span>保存工程</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onToggleFullscreen} className={`p-2 rounded-md transition-colors ${isFullscreen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`} title={isFullscreen ? "退出全屏" : "全屏模式"}>
          <Icon name="maximize" className="w-4 h-4" />
        </button>
        
        <button 
          onClick={onDelete} 
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors" 
          title="删除当前文章"
        >
          <Icon name="trash" className="w-4 h-4" />
        </button>
        
        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        <button onClick={onReset} className="p-2 text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50 rounded-md transition-colors" title="清空所有数据">
          <Icon name="refresh" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
