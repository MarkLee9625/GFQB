import React from 'react';
import { Icon } from '../Icons';

interface EditorFooterProps {
  hasId: boolean | undefined;
  isPublished: boolean;
  onClose: () => void;
  onSave: (targetPublishState?: boolean) => void;
}

const EditorFooter = React.memo(({ hasId, isPublished, onClose, onSave }: EditorFooterProps) => (
  <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-white">
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <Icon name="lock" className="w-3 h-3" />
      所有更改已自动缓存到本地数据库
    </div>
    <div className="flex gap-3">
      <button
        onClick={onClose}
        className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-all font-bold text-xs shadow-sm"
      >
        放弃修改
      </button>
      <button
        onClick={() => onSave(false)}
        className="px-6 py-2.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-100 transition-all font-bold text-xs shadow-sm"
      >
        存为草稿
      </button>
      <button
        onClick={() => onSave(true)}
        className="px-8 py-2.5 bg-brand-blue text-white rounded-xl hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-0.5 transition-all font-bold text-xs shadow-lg active:translate-y-0"
      >
        {hasId && isPublished ? '更新并发布' : '直接发布'}
      </button>
    </div>
  </div>
));

export default EditorFooter;
