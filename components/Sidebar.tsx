import React from 'react';
import { Icon } from './Icons';
import { Article } from '../src/types/models';

interface SidebarProps {
  articles: Article[];
  currentId: number | null;
  logo: string;
  sidebarMeta: string;
  searchQuery: string;
  isEditMode: boolean;
  isSidebarHidden: boolean;
  onSelectArticle: (id: number) => void;
  onToggleSidebar: () => void;
  onSearchChange: (query: string) => void;
  onSidebarMetaChange: (meta: string) => void;
  onLogoUpload: () => void;
  onToggleEditMode: () => void;
  onReorder: (newOrder: Article[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  articles,
  currentId,
  logo,
  sidebarMeta,
  searchQuery,
  isEditMode,
  isSidebarHidden,
  onSelectArticle,
  onToggleSidebar,
  onSearchChange,
  onSidebarMetaChange,
  onLogoUpload,
  onToggleEditMode,
  onReorder,
}) => {
  // Filter articles but PRESERVE array order (except for Search)
  const displayArticles = React.useMemo(() => {
    return articles.filter(a => (a.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [articles, searchQuery]);

  // Drag and Drop Logic
  const [draggedId, setDraggedId] = React.useState<number | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLUListElement>) => {
    const target = (e.target as HTMLElement).closest('li[data-id]');
    if (!target) return;
    const id = Number((target as HTMLElement).dataset.id);
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('li[data-id]');
    if (!target) return;
    const id = Number((target as HTMLElement).dataset.id);
    if (draggedId === id) return;
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent<HTMLUListElement>) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('li[data-id]');
    if (!target) return;
    const targetId = Number((target as HTMLElement).dataset.id);
    if (draggedId === null || draggedId === targetId) return;

    const newArticles = [...articles];
    const draggedIndex = newArticles.findIndex(a => a.id === draggedId);
    const targetIndex = newArticles.findIndex(a => a.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = newArticles.splice(draggedIndex, 1);
    newArticles.splice(targetIndex, 0, draggedItem);
    onReorder(newArticles);

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleListClick = (e: React.MouseEvent<HTMLUListElement>) => {
    const target = (e.target as HTMLElement).closest('li[data-id]');
    if (!target) return;
    const id = Number((target as HTMLElement).dataset.id);
    onSelectArticle(id);
  };

  return (
    <div
      className={`no-print w-[300px] bg-sidebar flex flex-col shrink-0 border-r border-gray-200 z-[60] transition-transform duration-300 ${isSidebarHidden ? '-translate-x-full absolute h-full shadow-2xl' : 'translate-x-0'}`}
    >
      <div className="p-[45px_30px_20px_30px] flex flex-col gap-2 relative">
        <div className="relative">
          <svg className="w-full max-w-[200px] h-auto" viewBox="0 0 400 60" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="sidebarTitleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#005596', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#003366', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <text x="50%" y="45" textAnchor="middle" fontFamily="'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif" fontWeight="bold" fontSize="48" fill="url(#sidebarTitleGradient)" letterSpacing="10">工法情报</text>
          </svg>
        </div>

        {/* Sidebar Toggle for Desktop (Explicit Control) */}
        <button
          onClick={onToggleSidebar}
          className="absolute top-[45px] right-[30px] text-gray-400 hover:text-brand-blue transition-colors"
          title="隐藏侧边栏"
        >
          <Icon name="menu" className="w-4 h-4" />
        </button>

        <div
          className={`text-xs text-gray-500 py-[2px] border-b border-dashed border-transparent transition-colors font-sans ${isEditMode ? 'cursor-text hover:text-brand-blue hover:border-brand-blue' : ''}`}
          contentEditable={isEditMode}
          onBlur={e => onSidebarMetaChange(e.target.innerText)}
          suppressContentEditableWarning
        >
          {sidebarMeta}
        </div>
      </div>

      <div className="p-[10px_30px_20px_30px]">
        <div className="bg-gray-50 rounded p-[8px_12px] flex items-center border border-transparent focus-within:bg-white focus-within:border-brand-blue focus-within:shadow-[0_0_0_2px_rgba(0,85,150,0.05)] transition-all">
          <Icon name="search" className="w-4 h-4 text-gray-400 mr-2" />
          <input
            className="bg-transparent border-none w-full outline-none text-[13px] text-gray-900"
            placeholder="搜索文章..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <ul
        className="flex-1 overflow-y-auto px-[15px] m-0 list-none scrollbar-hide"
        onClick={handleListClick}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {displayArticles.map(article => (
          <li
            key={article.id}
            data-id={article.id}
            draggable={!searchQuery && !['封面', '封底'].includes(article.category)}
            className={`p-[14px_15px] rounded cursor-pointer transition-all mb-[2px] border-l-2 ${currentId === article.id ? 'bg-blue-50 border-brand-blue' : 'border-transparent hover:bg-gray-100'} ${dragOverId === article.id ? 'border-t-4 border-t-brand-blue' : ''} ${draggedId === article.id ? 'opacity-40' : ''}`}
          >
            <div className={`text-[14px] font-semibold mb-1 leading-[1.4] font-sans ${currentId === article.id ? 'text-brand-blue' : 'text-gray-700'} ${['封面', '封底'].includes(article.category) ? 'text-brand-blue font-bold' : ''}`}>
              {article.pdfData && <span className="bg-red-100 text-red-500 text-[9px] px-1 rounded font-bold mr-1">PDF</span>}
              {article.title}
            </div>
            <div className="text-[11px] text-gray-400 flex justify-between">
            </div>
          </li>
        ))}
      </ul>

      <div className="p-[15px_30px_20px_30px] border-t border-gray-200 flex flex-col items-start bg-sidebar gap-[10px] relative">
        <div className="text-[9px] text-gray-300 uppercase tracking-[1.5px] font-bold">PRODUCED BY</div>
        <div
          className={`w-full relative min-h-[40px] group ${isEditMode ? 'cursor-pointer' : ''}`}
          onClick={() => isEditMode && onLogoUpload()}
        >
          {logo ? (
            <img src={logo} alt="Logo" className="max-w-[150px] h-auto max-h-[50px] block" />
          ) : (
            <div className="w-full h-[50px] border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-[11px] bg-gray-50">
              <Icon name="plus" className="w-3 h-3 mr-1" /> 上传 Logo
            </div>
          )}
          {isEditMode && logo && <div className="absolute inset-0 bg-white/90 text-brand-blue text-xs font-bold items-center justify-center border border-dashed border-brand-blue rounded hidden group-hover:flex">更换 Logo</div>}
        </div>

        <button
          onClick={onToggleEditMode}
          className="absolute bottom-[10px] right-[10px] text-gray-200 p-1 rounded hover:text-brand-blue hover:bg-blue-50 transition-colors"
        >
          <Icon name={isEditMode ? 'unlock' : 'lock'} />
        </button>
      </div>
    </div>
  );
};
export default Sidebar;
