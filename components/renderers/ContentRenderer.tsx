import React, { useState, useEffect } from 'react';
import { Article } from '../../../types';
import { Icon } from '../../Icons';
import { useBlobManager } from '../../../hooks/useBlobManager';
import { ArticleRendererBaseProps } from './ArticleRenderer';

interface ContentRendererProps extends ArticleRendererBaseProps {
  mode: 'edit' | 'read' | 'print';
  isEditable?: boolean;
  logo?: string;
}

// 懒加载图片组件
const LazyImage: React.FC<{
  src: string | null;
  alt: string;
  className: string;
  style?: React.CSSProperties;
}> = ({ src, alt, className, style }) => {
  const [loaded, setLoaded] = useState(false);
  const blobManager = useBlobManager();
  const blobUrl = src ? blobManager.getBlobUrl(src) : null;

  return (
    <img
      src={blobUrl || src}
      alt={alt}
      className={`${className} ${loaded ? 'loaded' : ''}`}
      style={{
        ...style,
        opacity: loaded ? 1 : 0.8,
        transition: 'opacity 0.2s ease-out',
      }}
      onLoad={() => setLoaded(true)}
    />
  );
};

// PDF 查看器组件
const PdfViewer: React.FC<{ pdfUrl: string }> = ({ pdfUrl }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="w-full h-full relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
        </div>
      )}
      <iframe
        src={`${pdfUrl}#toolbar=0&navpanes=0`}
        className="w-full h-full border-0 relative z-0"
        onLoad={() => setLoaded(true)}
        title="PDF Viewer"
      />
    </div>
  );
};

/**
 * 正文渲染组件
 * 
 * 负责渲染普通文章的内容，包括：
 * - 标题、标签、摘要
 * - 正文内容（HTML）
 * - 图片、视频、音频等媒体
 * - PDF 附件
 * 
 * 支持三种模式：
 * - edit: 可编辑模式（虽然正文通常在 Editor 中编辑，但保留此属性）
 * - read: 只读模式，优化显示效果
 * - print: 打印模式，应用打印样式
 */
export const ContentRenderer: React.FC<ContentRendererProps> = ({
  article,
  mode,
  logo,
  isEditable = false
}) => {
  const blobManager = useBlobManager();
  const pdfUrl = article.pdfData ? blobManager.getBlobUrl(article.pdfData) : null;

  // 使用 IntersectionObserver 实现图片懒加载
  const [lazyImages, setLazyImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (mode === 'print' || mode === 'read') {
      // 打印和阅读模式下，预加载所有图片
      const imgCount = (article.content.match(/<img[^>]*>/g) || []).length;
      const allImages = new Set(Array.from({ length: imgCount }, (_, i) => i));
      setLazyImages(allImages);
    }
  }, [mode, article.content]);

  // 提取文章中的媒体元素并渲染
  const renderContent = () => {
    if (!article.content) return null;

    // 创建临时容器解析 HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content;

    // 处理所有图片，添加懒加载
    const images = tempDiv.querySelectorAll('img');
    images.forEach((img, index) => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('blob:')) {
        // 非 blob URL 的图片，转为 blob
        const blobUrl = blobManager.getBlobUrl(src);
        if (blobUrl) {
          img.setAttribute('src', blobUrl);
        }
      }
    });

    return (
      <div
        className="sws-prose article-body w-full"
        style={{
          fontSize: `${article.fontSize || 18}px`,
          lineHeight: article.lineHeight || 2.0
        }}
        dangerouslySetInnerHTML={{ __html: tempDiv.innerHTML }}
      />
    );
  };

  return (
    <div className="flex flex-col w-full text-left bg-white relative">
      {/* 文章头部 */}
      <div className="shrink-0 mb-[30px] text-left border-b border-gray-200 pb-[20px]">
        <h1 className="font-serif text-[32px] text-[#111] m-[0_0_15px_0] leading-[1.3] font-bold tracking-[1px]">
          {article.title}
        </h1>
        <div className="text-gray-400 text-[13px] flex flex-wrap gap-y-3 gap-x-5 font-medium font-sans uppercase tracking-[1px] items-center">
          {article.category !== '封面' && article.category !== '封底' && article.tags && article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Icon name="search" className="w-3 h-3 mt-1" />
              {article.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded text-[12px] font-bold border border-gray-200/50 hover:bg-brand-blue/5 hover:text-brand-blue hover:border-brand-blue/20 transition-colors cursor-default"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-1">
              <Icon name="search" className="w-3 h-3" /> {article.category}
            </span>
          )}
        </div>
        {article.abstract && (
          <div className="mt-6 p-4 bg-gray-50 border-l-4 border-brand-blue rounded-r-lg text-[14px] leading-relaxed text-gray-600 italic font-sans animate-in fade-in slide-in-from-left-2 duration-500 shrink-0">
            <div className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1 not-italic">
              摘要
            </div>
            {article.abstract}
          </div>
        )}
      </div>

      {/* 文章正文 */}
      <div className="flex flex-col w-full">
        {renderContent()}

        {/* PDF 附件 */}
        {article.pdfData && (
          <div className="w-full flex flex-col mt-8">
            <div className="w-full h-[80vh] min-h-[800px] flex flex-col relative rounded-[24px] pdf-viewer-container border border-gray-200 shadow-sm">
              {/* PDF Toolbar */}
              <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 select-none">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <Icon name="file-text" className="w-4 h-4" />
                  PDF PREVIEW
                </div>
                {mode !== 'print' && (
                  <button
                    className="pdf-expand-btn bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/20 rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer flex items-center gap-2 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      const container = e.currentTarget.closest('.pdf-viewer-container');
                      if (container) {
                        if (container.classList.contains('expanded')) {
                          container.classList.remove('expanded');
                          document.exitFullscreen?.();
                        } else {
                          container.classList.add('expanded');
                          container.requestFullscreen?.();
                        }
                      }
                    }}
                  >
                    <Icon name="maximize" className="w-3.5 h-3.5" />
                    <span>全屏阅读</span>
                  </button>
                )}
              </div>

              <div className="flex-1 w-full relative bg-gray-100/50 overflow-hidden min-h-0 h-full">
                {pdfUrl ? (
                  <div className="w-full h-full flex flex-col p-4 relative">
                    {/* PDF 内容容器 */}
                    <div className="flex-1 w-full overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm relative h-full min-h-[300px]">
                      {/* PDF 查看器 */}
                      <div className="w-full h-full overflow-auto relative min-h-[300px]">
                        <PdfViewer pdfUrl={pdfUrl} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 min-h-[300px]">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-brand-blue rounded-full animate-spin"></div>
                    <div className="text-gray-400 text-sm">正在加载 PDF...</div>
                  </div>
                )}
                {mode !== 'print' && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!pdfUrl) {
                        alert('PDF 正在处理中，请稍后再试...');
                        return;
                      }
                      try {
                        // 纯粹的安全下载机制
                        const link = document.createElement('a');
                        link.href = pdfUrl || '';
                        link.download = article.title ? `${article.title}.pdf` : 'document.pdf';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      } catch (err) {
                        console.error('下载 PDF 失败', err);
                        alert('下载失败，请重试');
                      }
                    }}
                    className="absolute bottom-4 right-4 z-[20] bg-white px-3 py-2 text-xs border border-gray-300 rounded text-brand-blue cursor-pointer flex items-center gap-1 hover:bg-gray-50 shadow-md transition-colors"
                  >
                    <Icon name="download" className="w-3 h-3" />
                    下载完整 PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 文章底部 */}
      {mode !== 'print' && (
        <>
          <div className="mt-auto pt-8 border-t border-gray-100 text-center shrink-0">
            {logo && (
              <img src={logo} className="h-[25px] opacity-50 inline-block align-middle mr-2" alt="" />
            )}
            <span className="text-xs text-gray-400 font-bold tracking-widest">SWS KNOWLEDGE BASE</span>
          </div>
          <div className="text-center m-[40px_auto_0] text-[10px] text-gray-200 tracking-[2px] shrink-0">
            - End of Article -
          </div>
        </>
      )}
    </div>
  );
};
