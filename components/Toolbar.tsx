import React from 'react';
import { Icon } from './Icons';

interface ToolbarProps {
  currentId: number | null;
  isFullscreen: boolean;
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
  onNewArticle,
  onEditArticle,
  onImport,
  onImportWechat,
  onToggleFullscreen,
  onDelete,
  onReset,
  onExportReader,
  onExportProject,
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

      <button onClick={onImport} className="px-3 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors">
        导入项目
      </button>
      <button onClick={onImportWechat} className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-xs font-bold transition-colors">
        公众号导入
      </button>

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
      <button onClick={onExportReader} className="px-3 py-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors">
        导出阅读版
      </button>
      <button onClick={onExportProject} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-lg shadow-black/10 active:scale-95">
        保存工程
      </button>
    </div>
  );
};

export default Toolbar;
