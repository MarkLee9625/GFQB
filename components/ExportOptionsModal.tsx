import React, { useState } from 'react';
import { Icon } from './Icons';

interface ExportOptionsModalProps {
  isOpen: boolean;
  currentUseAlternateDesign: boolean;
  onClose: () => void;
  onConfirm: (options: {
    useAlternateDesign: boolean;
    includeImages: boolean;
    optimizeForPrint: boolean;
  }) => void;
}

const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  isOpen,
  currentUseAlternateDesign,
  onClose,
  onConfirm,
}) => {
  const [selectedDesign, setSelectedDesign] = useState<'original' | 'magazine'>(currentUseAlternateDesign ? 'magazine' : 'original');
  const [includeImages, setIncludeImages] = useState(true);
  const [optimizeForPrint, setOptimizeForPrint] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm({
      useAlternateDesign: selectedDesign === 'magazine',
      includeImages,
      optimizeForPrint,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[102] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">导出阅读版选项</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* 封面封底风格选择 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">封面封底风格</h3>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedDesign('original')}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center transition-all ${selectedDesign === 'original' ? 'border-brand-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="w-16 h-20 mb-2 bg-gradient-to-b from-blue-100 to-white border border-gray-300 rounded flex items-center justify-center">
                    <div className="text-xs font-bold text-blue-800">原版</div>
                  </div>
                  <span className="text-sm font-medium">原版设计</span>
                  <span className="text-xs text-gray-500 mt-1">传统专业风格</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDesign('magazine')}
                  className={`p-4 border-2 rounded-lg flex flex-col items-center transition-all ${selectedDesign === 'magazine' ? 'border-brand-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="w-16 h-20 mb-2 bg-gradient-to-b from-gray-900 to-gray-700 rounded flex items-center justify-center">
                    <div className="text-xs font-bold text-white">杂志</div>
                  </div>
                  <span className="text-sm font-medium">杂志风格</span>
                  <span className="text-xs text-gray-500 mt-1">现代时尚风格</span>
                </button>
              </div>
            </div>

            {/* 其他选项 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">导出选项</h3>
              
              <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div>
                  <div className="font-medium text-gray-800">包含图片</div>
                  <div className="text-sm text-gray-500">导出文章中的图片和封面封底图片</div>
                </div>
                <input
                  type="checkbox"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="w-5 h-5 text-brand-blue rounded focus:ring-brand-blue"
                />
              </label>

              <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div>
                  <div className="font-medium text-gray-800">优化打印</div>
                  <div className="text-sm text-gray-500">调整布局和颜色以便打印</div>
                </div>
                <input
                  type="checkbox"
                  checked={optimizeForPrint}
                  onChange={(e) => setOptimizeForPrint(e.target.checked)}
                  className="w-5 h-5 text-brand-blue rounded focus:ring-brand-blue"
                />
              </label>
            </div>

            {/* 预览说明 */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="info" className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">导出说明</p>
                  <p className="mt-1">导出的HTML文件包含所有文章、图片和导航功能，可在任何现代浏览器中离线阅读。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-brand-blue text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Icon name="download" className="w-4 h-4" />
            导出阅读版
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportOptionsModal;
