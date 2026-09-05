import React, { useEffect, useState } from 'react';
import { subscribeToasts, dismissToast, ToastItem, ToastType } from '../src/utils/toast';
import { Icon } from './Icons';

const TYPE_STYLES: Record<ToastType, { icon: string; iconClass: string; borderClass: string }> = {
  info: { icon: 'info', iconClass: 'text-gray-500', borderClass: 'border-gray-300' },
  success: { icon: 'check', iconClass: 'text-emerald-500', borderClass: 'border-emerald-400' },
  warning: { icon: 'alert', iconClass: 'text-amber-500', borderClass: 'border-amber-400' },
  error: { icon: 'x', iconClass: 'text-red-500', borderClass: 'border-red-400' },
};

/**
 * 全局 Toast 渲染宿主：订阅模块级 toast store，渲染右上角堆叠提示。
 * 挂在 App 根级（MainLayout 旁），主界面异常时仍可正常提示。
 */
export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeToasts(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[999] flex flex-col gap-2 items-end no-print">
      {items.map((item) => {
        const style = TYPE_STYLES[item.type];
        return (
          <div
            key={item.id}
            className={`flex items-start gap-2 max-w-md px-4 py-3 rounded-lg bg-white border-l-4 ${style.borderClass} shadow-lg text-sm text-gray-700 animate-in fade-in slide-in-from-top-2 duration-300`}
            role="status"
          >
            <Icon name={style.icon} className={`w-4 h-4 mt-0.5 shrink-0 ${style.iconClass}`} />
            <span className="break-words whitespace-pre-wrap">{item.message}</span>
            <button
              onClick={() => dismissToast(item.id)}
              className="ml-2 text-gray-300 hover:text-gray-500 shrink-0"
              aria-label="关闭提示"
            >
              <Icon name="x" className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastHost;
