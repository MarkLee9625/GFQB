import React from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading }) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-white/90 z-[9999] flex flex-col items-center justify-center">
      <div className="w-[30px] h-[30px] border-[3px] border-gray-100 border-t-brand-blue rounded-full animate-spin mb-4"></div>
      <div className="text-gray-400 text-xs tracking-widest">PROCESSING...</div>
    </div>
  );
};

export default LoadingOverlay;
