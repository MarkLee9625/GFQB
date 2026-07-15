import React from 'react';

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

