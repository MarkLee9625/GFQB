import React, { useState, useEffect } from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message }) => {
  const [dotCount, setDotCount] = useState(0);

  // 打字机效果的动态点...
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setDotCount(prev => (prev + 1) % 4); // 0, 1, 2, 3
    }, 500);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) {
    return null;
  }

  const dots = '.'.repeat(dotCount);
  const displayMessage = message || '正在处理中，请稍候';

  const isAiOperation = message?.includes('AI') || message?.includes('生成') || message?.includes('分析') || message?.includes('推理');
  const subMessage = isAiOperation ? '模型正在深入分析内容，进行逻辑推理与结构化思考' : '正在处理您的请求，请稍候';
  const timeHint = isAiOperation ? '预计等待时间 10-30 秒，请耐心等待' : '处理中，请稍候';
  const bottomHint = isAiOperation ? '深度推理进行中 · 请勿关闭页面' : '处理中 · 请勿关闭页面';

  return (
    <div className="fixed inset-0 bg-white/95 z-[9999] flex flex-col items-center justify-center backdrop-blur-[4px]">
      <div className="relative mb-8">
        <div className="absolute inset-0 w-[100px] h-[100px] bg-blue-50 rounded-full animate-ping opacity-20"></div>
        <div className="absolute inset-5 w-[70px] h-[70px] bg-blue-100 rounded-full animate-pulse opacity-30"></div>
        <div className="relative w-[60px] h-[60px] border-[3px] border-blue-200 border-t-brand-blue rounded-full animate-spin mb-2"></div>
      </div>
      
      <div className="text-center max-w-md px-6">
        <div className="text-gray-700 text-lg font-bold mb-2 tracking-wide">
          {displayMessage}{dots}
        </div>
        
        <div className="text-gray-500 text-sm mb-4 font-medium">
          {subMessage}
        </div>
        
        <div className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-full font-medium inline-block">
          <span className="animate-pulse inline-block mr-1">●</span>
          {timeHint}
        </div>
      </div>
      
      <div className="absolute bottom-12 text-[10px] text-gray-300 font-medium tracking-wider">
        {bottomHint}
      </div>
    </div>
  );
};

export default LoadingOverlay;
