import React from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, message }) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-white/90 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm">
      <div className="w-[30px] h-[30px] border-[3px] border-gray-100 border-t-brand-blue rounded-full animate-spin mb-4"></div>
      <div className="text-gray-400 text-xs tracking-widest font-bold mb-1">
        {message ? message.toUpperCase() : 'PROCESSING...'}
      </div>
      {message && (
        <div className="text-brand-blue text-[10px] font-medium animate-pulse">
          {message}
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay;
