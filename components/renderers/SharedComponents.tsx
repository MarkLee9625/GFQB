import React, { useState, useEffect } from 'react';
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
}> = ({ src, alt, className, style }) => {
  const [loaded, setLoaded] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobManager = useBlobManager();
  const { ref, inView } = useInView({ rootMargin: '50px', threshold: 0.01 });

  useEffect(() => {
    if (!inView || !src) {
      setBlobUrl(null);
      return;
    }

    const timer = setTimeout(() => {
      const url = blobManager.getBlobUrl(src);
      setBlobUrl(url);
    }, 0);

    return () => clearTimeout(timer);
  }, [inView, src, blobManager]);

  const imageSrc = inView ? (blobUrl || src) : undefined;

  return (
    <img
      ref={ref}
      src={imageSrc}
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
