import React, { useState, useEffect, useRef } from 'react';
import { useBlobManager } from '../../hooks/useBlobManager';
import { useInView } from '../../hooks/useInView';

export const AmbientBg: React.FC<{ src: string | null | undefined }> = ({ src }) => {
  if (!src) return null;
  return (
    <div
      className="absolute inset-0 w-full h-full bg-cover bg-center opacity-30 pointer-events-none z-0 transition-opacity duration-700"
      style={{
        backgroundImage: `url('${src}')`,
        filter: 'blur(20px) saturate(180%) brightness(1.05)',
        willChange: 'filter',
      }}
    />
  );
};

export const TechGrid: React.FC = () => (
  <div
    className="absolute inset-0 w-full h-full pointer-events-none z-[0] opacity-[0.03]"
    style={{
      backgroundImage: `
        linear-gradient(#005596 1px, transparent 1px),
        linear-gradient(90deg, #005596 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px'
    }}
  />
);

export const LazyImage: React.FC<{
  src: string | null;
  alt: string;
  className: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLImageElement>;
}> = ({ src, alt, className, style, onClick, onDoubleClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobManager = useBlobManager();
  const { ref, inView } = useInView({ rootMargin: '50px', threshold: 0.01 });
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setLoaded(false);
      hasLoadedRef.current = false;
      return;
    }
    const url = blobManager.getBlobUrl(src);
    setBlobUrl(url);
    setLoaded(false);
    hasLoadedRef.current = false;
  }, [src, blobManager]);

  const imageSrc = blobUrl || src || undefined;

  return (
    <img
      ref={ref}
      src={inView ? imageSrc : undefined}
      alt={alt}
      className={`${className} ${loaded ? 'loaded' : ''}`}
      style={{
        ...style,
        opacity: loaded ? 1 : 0.8,
        transition: 'opacity 0.2s ease-out',
      }}
      onLoad={() => {
        if (!hasLoadedRef.current) {
          hasLoadedRef.current = true;
          setLoaded(true);
        }
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    />
  );
};
