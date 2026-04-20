import React, { useState } from 'react';
import { Icon } from './Icons';

interface CategoryManagerModalProps {
  isOpen: boolean;
  categories: string[];
  onClose: () => void;
  onUpdateCategories: (categories: string[]) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
}

const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  categories,
  onClose,
  onUpdateCategories,
  onRenameCategory,
}) => {
  const [newCategory, setNewCategory] = useState('');
  const [editingCat, setEditingCat] = useState<{ old: string, new: string } | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleAddCategory = () => {
    if (newCategory && !categories.includes(newCategory)) {
      const updatedCategories = [...categories, newCategory];
      onUpdateCategories(updatedCategories);
      setNewCategory('');
    }
  };

  const handleDeleteCategory = (category: string) => {
    if (window.confirm(`删除 ${category}? 隶属于该分类的文章将变为'默认'`)) {
      let updatedCategories = categories.filter(x => x !== category);
      if (!updatedCategories.includes('默认')) {
        updatedCategories = [...updatedCategories, '默认'];
      }
      onUpdateCategories(updatedCategories);
      if (onRenameCategory) onRenameCategory(category, '默认');
    }
  };

  const handleRenameStart = (c: string) => {
    setEditingCat({ old: c, new: c });
  };

  const handleRenameSave = () => {
    if (editingCat && editingCat.new && editingCat.new !== editingCat.old) {
      if (categories.includes(editingCat.new)) {
        alert("该分类名称已存在");
        return;
      }
      const updated = categories.map(c => c === editingCat.old ? editingCat.new : c);
      onUpdateCategories(updated);
      if (onRenameCategory) onRenameCategory(editingCat.old, editingCat.new);
      setEditingCat(null);
    } else {
      setEditingCat(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[101] flex items-center justify-center p-4" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="bg-white w-full max-w-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
          <span className="font-bold text-gray-800 tracking-tight">分类资源管理器</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[400px]">
          <ul className="p-4 m-0 list-none space-y-2">
            {categories.map(c => (
              <li key={c} className="p-3 bg-white border border-gray-100 rounded-xl flex justify-between items-center group hover:border-brand-blue/30 transition-all">
                {editingCat?.old === c ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      className="flex-1 border-none bg-blue-50/50 rounded-lg p-1 text-sm focus:ring-0 outline-none font-bold text-brand-blue"
                      value={editingCat.new}
                      autoFocus
                      onChange={e => setEditingCat({ ...editingCat, new: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleRenameSave()}
                    />
                    <button onClick={handleRenameSave} className="text-brand-blue text-xs font-bold">保存</button>
                    <button onClick={() => setEditingCat(null)} className="text-gray-400 text-xs">取消</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-700">{c}</span>
                    <div className="flex gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleRenameStart(c)} className="p-2 text-gray-400 hover:text-brand-blue transition-colors">
                        <Icon name="edit" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(c)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 bg-gray-50/70 flex gap-2 border-t border-gray-100">
          <input
            id="newCatInput"
            className="flex-1 border border-gray-200 p-2.5 rounded-xl text-sm focus:border-brand-blue focus:bg-white outline-none transition-all shadow-inner"
            placeholder="创建新分类..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddCategory();
              }
            }}
          />
          <button
            onClick={handleAddCategory}
            className="bg-brand-blue text-white px-6 rounded-xl text-xs font-bold shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;
