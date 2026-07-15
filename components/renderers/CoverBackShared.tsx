import React from 'react';
import { Icon } from '../Icons';
import { AmbientBg, TechGrid } from './SharedComponents';

// ============================================================
// Shared background components
// ============================================================

/** Magazine-style background when image exists (identical for cover & back) */
export const MagazineHasImageBg: React.FC<{ src: string | null | undefined }> = ({ src }) => (
  <div className="absolute inset-0 z-0 overflow-hidden">
    <AmbientBg src={src} />
  </div>
);

// ============================================================
// Shared upload section component
// ============================================================

interface UploadSectionProps {
  style: 'magazine' | 'default';
  iconName?: string;
  label: string;
  hintText?: string;
  onClick: () => void;
  hasImage: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  style,
  iconName,
  label,
  hintText,
  onClick,
  hasImage,
}) => {
  if (hasImage) return null;

  return (
    <div className="flex-1 flex items-center justify-center z-[3]">
      {style === 'magazine' ? (
        <button
          type="button"
          className="clickable-area text-gray-500 text-[14px] bg-white/90 backdrop-blur-sm px-8 py-4 border-2 border-dashed border-gray-300 z-[10] tracking-widest rounded-xl shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold group"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center">
              <Icon name={iconName as 'camera' | 'image'} className="w-5 h-5 text-brand-blue" />
            </div>
            <span>{label}</span>
            <span className="text-[11px] font-normal text-gray-400">{hintText}</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          className="clickable-area absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400 text-[13px] bg-white/80 backdrop-blur-sm px-6 py-3 border border-gray-200 z-[10] tracking-widest rounded-lg shadow-sm hover:bg-white hover:text-brand-blue hover:border-brand-blue hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {label}
        </button>
      )}
    </div>
  );
};

// ============================================================
// Cover Theme Config
// ============================================================

export interface CoverTheme {
  containerClass: string;
  /** Renders the appropriate background based on hasImage state */
  renderBg: (hasImage: boolean, imageUrl: string) => React.ReactNode;
  imgGradientVia: string;
  imgGradientTo: string;
  svgGradientId: string;
  svgMaxWidth: string;
  svgMb: string;
  subtitle: string;
  subtitleClass: string;
  hasDivider: boolean;
  hasTitleLine: boolean;
  headerPt: string;
  issueDateMt: string;
  issueDateGap: string;
  issueDateFontSize: string;
  issuePillEditableClass: string;
  issuePillReadonlyClass: string;
  datePillEditableClass: string;
  datePillReadonlyClass: string;
  uploadStyle: 'magazine' | 'default';
  footerClass: string;
  footerLeft: React.ReactNode;
  footerRightClass: string;
  footerRightIconSize: string;
  hasDeco: boolean;
}

export const COVER_THEMES: Record<'magazine' | 'default', CoverTheme> = {
  magazine: {
    containerClass:
      'w-full min-h-[900px] flex flex-col text-left relative overflow-hidden group magazine-cover',
    renderBg: (hasImage, url) =>
      hasImage ? (
        <MagazineHasImageBg src={url} />
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-blue-50 via-white to-gray-50"></div>
      ),
    imgGradientVia: 'via-black/15',
    imgGradientTo: 'to-black/60',
    svgGradientId: 'magazineTitleGradient',
    svgMaxWidth: 'max-w-[400px]',
    svgMb: 'mb-[5px]',
    subtitle: 'SHIP CONSTRUCTION METHOD',
    subtitleClass:
      'font-sans text-[9px] font-black text-[#005596] tracking-[4px] uppercase w-full mb-[2px] letter-spacing-wider drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]',
    hasDivider: true,
    hasTitleLine: true,
    headerPt: 'pt-[35px]',
    issueDateMt: 'mt-[15px]',
    issueDateGap: 'gap-[15px]',
    issueDateFontSize: 'text-[11px]',
    issuePillEditableClass:
      'min-w-[60px] text-center px-[8px] py-[4px] rounded-full border border-[#005596]/30 bg-white/30 backdrop-blur-sm transition-colors cursor-text hover:bg-[#005596]/10 hover:border-[#005596]/60',
    issuePillReadonlyClass:
      'min-w-[60px] text-center px-[8px] py-[4px] rounded-full border border-[#005596]/30 bg-white/30 backdrop-blur-sm transition-colors cursor-default',
    datePillEditableClass:
      'min-w-[70px] text-center px-[8px] py-[4px] rounded-full border border-[#005596]/30 bg-white/30 backdrop-blur-sm transition-colors cursor-text hover:bg-[#005596]/10 hover:border-[#005596]/60',
    datePillReadonlyClass:
      'min-w-[70px] text-center px-[8px] py-[4px] rounded-full border border-[#005596]/30 bg-white/30 backdrop-blur-sm transition-colors cursor-default',
    uploadStyle: 'magazine',
    footerClass:
      'flex items-center justify-between z-[3] pt-[20px] pb-[30px] px-[40px] md:px-[60px] shrink-0 w-full relative mt-auto',
    footerLeft: (
      <div className="text-[9px] text-[#005596]/50 tracking-[2px] uppercase font-bold drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
        OFFICIAL PUBLICATION
      </div>
    ),
    footerRightClass:
      'clickable-area text-[11px] font-bold text-white bg-[#005596]/30 backdrop-blur-md flex items-center gap-[8px] cursor-pointer hover:bg-[#005596]/40 hover:translate-x-1 transition-all uppercase tracking-widest px-4 py-3 rounded-lg shadow-lg border border-white/30',
    footerRightIconSize: 'w-3 h-3',
    hasDeco: true,
  },
  default: {
    containerClass:
      'w-full min-h-[900px] flex flex-col p-0 text-left border-t-8 border-brand-blue relative overflow-hidden group',
    renderBg: (_hasImage, url) => (
      <div className="absolute inset-0 z-0 bg-transparent">
        <TechGrid />
        <AmbientBg src={url} />
      </div>
    ),
    imgGradientVia: 'via-black/20',
    imgGradientTo: 'to-black/70',
    svgGradientId: 'titleGradient',
    svgMaxWidth: 'max-w-[320px]',
    svgMb: 'mb-[2px]',
    subtitle: 'Ship Construction Method Information',
    subtitleClass:
      'font-sans text-[10px] font-extrabold text-[#005596] tracking-[3px] uppercase w-full mb-[5px] drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]',
    hasDivider: false,
    hasTitleLine: false,
    headerPt: 'pt-[30px]',
    issueDateMt: 'mt-[5px]',
    issueDateGap: 'gap-[8px]',
    issueDateFontSize: 'text-[12px]',
    issuePillEditableClass:
      'min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors cursor-text hover:bg-[#005596]/10 hover:border-[#005596]/60',
    issuePillReadonlyClass:
      'min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors cursor-default',
    datePillEditableClass:
      'min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors cursor-text hover:bg-[#005596]/10 hover:border-[#005596]/60',
    datePillReadonlyClass:
      'min-w-[50px] text-center px-[4px] py-[2px] rounded border-b border-dashed border-transparent transition-colors cursor-default',
    uploadStyle: 'default',
    footerClass:
      'flex items-center justify-between z-[3] pt-[15px] pb-[25px] px-[40px] md:px-[60px] shrink-0 w-full relative mt-auto',
    footerLeft: (
      <div
        className="h-[15px] w-[80px] opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #00559660, #00559660 1px, transparent 1px, transparent 3px)',
        }}
      ></div>
    ),
    footerRightClass:
      'clickable-area text-[10px] font-bold text-[#005596] flex items-center gap-[5px] cursor-pointer hover:opacity-80 hover:translate-x-1 transition-all uppercase tracking-widest bg-white/60 backdrop-blur-sm px-2 py-1 rounded drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]',
    footerRightIconSize: 'w-3 h-3',
    hasDeco: false,
  },
};

// ============================================================
// Back Theme Config
// ============================================================

export interface BackTheme {
  containerClass: string;
  /** Renders the appropriate background based on hasImage state */
  renderBg: (hasImage: boolean, imageUrl: string) => React.ReactNode;
  imgGradientVia: string;
  imgGradientTo: string;
  subtitle: string;
  subtitleClass: string;
  hasDivider: boolean;
  headerPt: string;
  uploadStyle: 'magazine' | 'default';
  /** Renders the title section below subtitle */
  renderTitle: () => React.ReactNode;
  /** Footer background strip class (different heights) */
  footerStripClass: string;
  /** Renders the footer content (includes wrapper div) */
  renderFooter: (props: BackFooterProps) => React.ReactNode;
}

export interface BackFooterProps {
  article: { issueText?: string; dateText?: string };
  mode: string;
  logo?: string;
}

/** Magazine-style back footer */
const BackMagazineFooter: React.FC<BackFooterProps> = ({ article, logo }) => (
  <div className="flex items-end justify-between z-[3] pb-[30px] px-[40px] md:px-[60px] shrink-0 w-full relative mt-auto pt-[20px]">
    <div className="flex flex-col gap-[8px] max-w-[40%]">
      <div className="text-[11px] text-[#005596]/70 tracking-[1px] font-bold uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
        SWS Offshore
      </div>
      <div className="font-normal text-[10px] text-[#005596]/50 leading-tight drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
        Shanghai Waigaoqiao Shipbuilding Co., Ltd.
        <br />
        上海外高桥造船有限公司
      </div>
      <div className="mt-[10px] text-[9px] text-[#005596]/40 drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
        © {new Date().getFullYear()} Ship Construction Method Information
      </div>
    </div>

    <div className="flex flex-col gap-[12px] items-center">
      <div className="grid grid-cols-3 gap-[20px] text-[11px] text-[#005596]/80 font-sans drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
        <div className="flex flex-col gap-[2px]">
          <div className="text-[#005596]/50 text-[9px] uppercase tracking-widest">编辑</div>
          <b className="text-[#005596]">马李琛</b>
        </div>
        <div className="flex flex-col gap-[2px]">
          <div className="text-[#005596]/50 text-[9px] uppercase tracking-widest">校对</div>
          <b className="text-[#005596]">胡国超</b>
        </div>
        <div className="flex flex-col gap-[2px]">
          <div className="text-[#005596]/50 text-[9px] uppercase tracking-widest">审核</div>
          <b className="text-[#005596]">储年生</b>
        </div>
      </div>

      <div className="flex flex-col items-center gap-[2px] mt-[5px]">
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#005596]/30 to-transparent"></div>
        <div className="text-[8px] text-[#005596]/40 tracking-[3px]">ISSN 0000-0000</div>
      </div>
    </div>

    <div className="flex flex-col items-end gap-[10px]">
      {logo && (
        <div className="relative">
          <img
            src={logo}
            className="h-[25px] w-auto block brightness-0 invert-[0.3] sepia-[1] saturate-[5] hue-rotate-[150deg] opacity-80"
            alt="Logo"
          />
          <div className="absolute -bottom-1 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#005596]/50 to-transparent"></div>
        </div>
      )}
      <div className="text-[9px] text-[#005596]/50 text-right drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]">
        Official Publication
        <br />
        Volume {article.issueText || '01'} · {article.dateText || `JAN ${new Date().getFullYear()}`}
      </div>
    </div>
  </div>
);

/** Default-style back footer */
const BackDefaultFooter: React.FC<BackFooterProps> = ({ logo }) => (
  <div className="flex items-end justify-between z-[3] pb-[25px] px-[40px] md:px-[60px] shrink-0 w-full relative mt-auto pt-[15px]">
    <div className="flex flex-col gap-[4px]">
      <span className="text-[#005596]/70 text-[10px] tracking-[1px] font-bold uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
        SWS Offshore
      </span>
      <span className="font-normal text-[9px] text-[#005596]/50 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
        Shanghai Waigaoqiao Shipbuilding Co., Ltd.
      </span>
    </div>
    <div className="flex items-center gap-[20px]">
      <div className="flex gap-[15px] text-[#005596]/80 text-[11px] font-sans drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
        <div className="flex gap-[4px] whitespace-nowrap">
          <span className="text-[#005596]/60">编辑:</span>{' '}
          <b className="text-[#005596]">马李琛</b>
        </div>
        <div className="flex gap-[4px] whitespace-nowrap">
          <span className="text-[#005596]/60">校对:</span>{' '}
          <b className="text-[#005596]">胡国超</b>
        </div>
        <div className="flex gap-[4px] whitespace-nowrap">
          <span className="text-[#005596]/60">审核:</span>{' '}
          <b className="text-[#005596]">储年生</b>
        </div>
      </div>
      {logo && (
        <img
          src={logo}
          className="h-[20px] w-auto block brightness-0 invert-[0.3] sepia-[1] saturate-[5] hue-rotate-[150deg] opacity-80"
          alt="Logo"
        />
      )}
    </div>
  </div>
);

export const BACK_THEMES: Record<'magazine' | 'default', BackTheme> = {
  magazine: {
    containerClass:
      'w-full min-h-[900px] flex flex-col text-left relative overflow-hidden group magazine-back-cover',
    renderBg: (hasImage, url) =>
      hasImage ? (
        <MagazineHasImageBg src={url} />
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-tl from-blue-50/80 via-white to-gray-50/80"></div>
      ),
    imgGradientVia: 'via-transparent',
    imgGradientTo: 'to-black/70',
    subtitle: 'SHIP CONSTRUCTION METHOD',
    subtitleClass:
      'font-sans text-[9px] font-black text-[#005596] tracking-[4px] uppercase w-full mb-[2px] letter-spacing-wider drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]',
    hasDivider: true,
    headerPt: 'pt-[35px]',
    uploadStyle: 'magazine',
    renderTitle: () => (
      <div className="relative transform -rotate-2 origin-left">
        <h1
          className="font-serif text-[64px] font-black tracking-[-2px] leading-[0.9] mb-[5px] italic drop-shadow-[0_2px_8px_rgba(255,255,255,0.6)]"
          style={{ color: '#005596' }}
        >
          Sailing With Success
        </h1>
        <div className="absolute -bottom-3 left-0 w-24 h-2 bg-gradient-to-r from-[#005596]/60 to-transparent transform rotate-2"></div>
      </div>
    ),
    footerStripClass:
      'absolute bottom-0 left-0 right-0 z-[2] h-[160px] bg-gradient-to-t from-white/80 via-white/30 to-transparent pointer-events-none',
    renderFooter: (props) => <BackMagazineFooter {...props} />,
  },
  default: {
    containerClass:
      'w-full min-h-[900px] flex flex-col p-0 text-left border-t-8 border-brand-blue relative overflow-hidden group',
    renderBg: (_hasImage, url) => (
      <div className="absolute inset-0 z-0 overflow-hidden bg-transparent">
        <TechGrid />
        <AmbientBg src={url} />
      </div>
    ),
    imgGradientVia: 'via-transparent',
    imgGradientTo: 'to-black/80',
    subtitle: 'Ship Construction Method Information',
    subtitleClass:
      'font-sans text-[10px] font-extrabold text-[#005596] tracking-[3px] uppercase w-full mb-[5px] drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]',
    hasDivider: false,
    headerPt: 'pt-[30px]',
    uploadStyle: 'default',
    renderTitle: () => (
      <div
        className="font-serif text-[36px] font-bold tracking-[2px] uppercase m-0 leading-[1.2] drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]"
        style={{ color: '#005596' }}
      >
        Sailing With Success
      </div>
    ),
    footerStripClass:
      'absolute bottom-0 left-0 right-0 z-[2] h-[140px] bg-gradient-to-t from-white/80 via-white/30 to-transparent pointer-events-none',
    renderFooter: (props) => <BackDefaultFooter {...props} />,
  },
};
