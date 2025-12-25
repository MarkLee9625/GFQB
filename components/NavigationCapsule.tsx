import React from 'react';
import { Icon } from './Icons';

interface NavigationCapsuleProps {
  onPrev: () => void;
  onNext: () => void;
  onShowShortcutsHelp: () => void;
  prevTitle?: string;
  nextTitle?: string;
  isSpecialPage?: boolean;
}

const NavigationCapsule: React.FC<NavigationCapsuleProps> = ({
  onPrev,
  onNext,
  onShowShortcutsHelp,
  prevTitle,
  nextTitle,
  isSpecialPage = false,
}) => {
  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className={`w-full max-w-[850px] mx-auto mt-12 mb-20 px-4 md:px-0 transition-all duration-300 ${isSpecialPage ? 'hidden' : 'block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Previous Article Card */}
          <div
            onClick={onPrev}
            className={`flex flex-col p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-blue/30 cursor-pointer transition-all group ${!prevTitle ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <div className="flex items-center gap-2 text-gray-400 mb-2 font-black text-[10px] tracking-widest uppercase">
              <Icon name="arrow-right" className="w-3 h-3 rotate-180 group-hover:-translate-x-1 transition-transform" />
              上一篇
            </div>
            <div className="text-sm font-bold text-gray-700 line-clamp-1 group-hover:text-brand-blue transition-colors">
              {prevTitle || "已是第一篇"}
            </div>
          </div>

          {/* Next Article Card */}
          <div
            onClick={onNext}
            className={`flex flex-col p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-blue/30 cursor-pointer transition-all items-end text-right group ${!nextTitle ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <div className="flex items-center gap-2 text-gray-400 mb-2 font-black text-[10px] tracking-widest uppercase">
              下一篇
              <Icon name="arrow-right" className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="text-sm font-bold text-gray-700 line-clamp-1 group-hover:text-brand-blue transition-colors">
              {nextTitle || "已是最后一篇"}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcut Help Button - Discreetly in bottom right */}
      <div className="fixed bottom-6 right-6 z-[90]">
        <button
          onClick={onShowShortcutsHelp}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/60 backdrop-blur-sm border border-gray-100/50 text-gray-400 hover:bg-white hover:text-brand-blue shadow-md transition-all hover:shadow-lg group"
          title="键盘快捷键帮助 (Ctrl+/)"
        >
          <Icon name="keyboard" className="w-4 h-4 opacity-70 group-hover:opacity-100" />
        </button>
      </div>
    </>
  );
};

export default NavigationCapsule;
