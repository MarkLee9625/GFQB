import React from 'react';
import { Icon } from './Icons';

interface KeyboardShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentArticleTitle?: string;
}

const KeyboardShortcutsHelpModal: React.FC<KeyboardShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + N', desc: '新建文章 / 封面' },
    { key: 'Ctrl + S', desc: '保存当前工作进度' },
    { key: 'Ctrl + E', desc: '打开/关闭当前文章编辑' },
    { key: 'Ctrl + F', desc: '切换全屏阅读模式' },
    { key: 'Ctrl + /', desc: '打开此帮助页' },
    { key: 'Esc', desc: '关闭弹窗 / 退出当前模式' },
    { key: '← / →', desc: '快速切换上一篇/下一篇文章' },
  ];

  const editorShortcuts = [
    { key: 'Ctrl + B', desc: '文字加粗' },
    { key: 'Ctrl + I', desc: '文字斜体' },
    { key: 'Ctrl + U', desc: '文字下划线' },
    { key: 'Alt + 2', desc: '应用二级标题 (H2)' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-[500px] rounded-3xl shadow-2xl overflow-hidden border border-white/20 flex flex-col scale-in-center">
        <div className="p-8 bg-gradient-to-br from-brand-blue to-blue-700 text-white flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-black tracking-tight">键盘快捷键</h2>
            <p className="text-blue-100 text-xs mt-1 font-medium opacity-80 uppercase tracking-widest">Keyboard Mastery</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all relative z-10">
            <Icon name="x" className="w-5 h-5 text-white" />
          </button>

          {/* Decorative Background Icon */}
          <Icon name="keyboard" className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 rotate-12" />
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
          <div>
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 系统级操作
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {shortcuts.map(s => (
                <div key={s.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100/50">
                  <span className="text-[13px] font-bold text-gray-700">{s.desc}</span>
                  <kbd className="px-2 py-1 rounded bg-white border border-gray-200 shadow-sm text-[10px] font-black text-brand-blue">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 文本编辑 (编辑器内)
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {editorShortcuts.map(s => (
                <div key={s.key} className="flex items-center justify-between p-3 rounded-xl bg-green-50/30 hover:bg-green-50/60 transition-colors border border-green-100/50">
                  <span className="text-[13px] font-bold text-gray-700">{s.desc}</span>
                  <kbd className="px-2 py-1 rounded bg-white border border-green-200 shadow-sm text-[10px] font-black text-green-600">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 text-center border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-12 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg active:scale-95"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelpModal;
