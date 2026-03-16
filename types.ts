
export type MediaType = 'image' | 'video' | 'audio' | 'pdf';
export type ArticleCategory = '封面' | '封底' | string;
export type UploadType = 'cover' | 'back';
export type NavigationDirection = 'prev' | 'next';
export type ExportType = 'reader' | 'project' | 'printable';

export interface Article {
  id: number;
  title: string;
  category: ArticleCategory;
  content: string;
  date?: string;
  // Metadata for Cover/Back
  issueText?: string;
  dateText?: string;
  coverImage?: string | null;
  backImage?: string | null;
  // Zoom state
  scale?: number;
  posX?: number;
  posY?: number;
  // Media
  pdfData?: string | null;
  // Typography & AI
  fontSize?: number;
  lineHeight?: number;
  abstract?: string | null;
  tags?: string[]; // 新增：多标签/关键词功能
  // 拖拽排序顺序
  order?: number;
}

export interface AppState {
  data: Article[];
  logo: string;
  categories: string[];
  sidebarMetaText: string;
  currentId: number | null;
  isEditMode: boolean;
  isSidebarHidden: boolean;
  isImmersive: boolean;
  searchQuery: string;
}

export interface ExportOptions {
  type: ExportType;
  includeData: boolean;
  includeLogo: boolean;
  includeCategories: boolean;
}

export interface FileUploadResult {
  success: boolean;
  data?: string;
  error?: string;
  fileName?: string;
  fileSize?: number;
}

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

export const CONSTANTS = {
  DB_NAME: "SWS_DATABASE_REACT",
  DB_STORE: "journal_store",
  KEY: "SWS_JOURNAL_DATA",
  DEFAULT_CATS: ["工法", "智能制造", "设计"],
  IMAGES: {
    MAX_WIDTH: 1200,
    QUALITY: 0.8,
  },
  // Shared CSS for consistent typography across Editor, App View, and Exported HTML
  UNIFIED_STYLES: `
    .sws-prose {
      font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 18px;
      line-height: 2.0;
      color: #1f2937;
      text-align: justify;
    }
    .sws-prose p, .sws-prose div:not(.pdf-summary-card), .sws-prose span, .sws-prose li {
        font-family: inherit !important;
        font-size: inherit !important;
        line-height: inherit !important;
        color: inherit;
        background-color: transparent !important;
    }
    .sws-prose p { text-indent: 2em; margin-top: 0 !important; margin-bottom: 0 !important; min-height: 1em; }
    .sws-prose h2 {
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif !important;
        font-size: 24px !important;
        font-weight: bold !important;
        color: #111 !important;
        margin-top: 50px; margin-bottom: 25px; padding-left: 15px;
        border-left: 4px solid #005596; line-height: 1.4 !important; text-indent: 0 !important;
    }
    .sws-prose img, .sws-prose video {
        display: block; margin: 24px auto !important; max-width: 100%; height: auto;
        border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); text-indent: 0 !important;
    }
    
    /* 新增：媒体容器样式 (用于包裹视频，确保原子化删除) */
    .media-container {
        display: block;
        margin: 24px 0 !important;
        text-align: center;
        /* user-select: none;  <-- 删除这一行，允许选中删除 */
    }
    .sws-prose blockquote {
        border-left: 3px solid #005596; margin: 30px 0; padding: 5px 25px;
        color: #4b5563 !important; font-style: italic; background: #f9fafb !important; text-indent: 0 !important;
    }
    .sws-prose ul { list-style-type: disc; padding-left: 2em; margin-bottom: 25px; }
    .sws-prose ol { list-style-type: decimal; padding-left: 2em; margin-bottom: 25px; }
    
    /* PDF Card Styling - Stronger & Cleaner */
    .sws-prose .pdf-summary-card {
        /* 强制使用黑体序列，覆盖正文的宋体设置 */
        font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Arial, sans-serif !important;
        font-weight: 900 !important; /* 使用数值 900 确保加粗更明显 */
        font-style: normal !important; /* 防止斜体覆盖 */
        font-size: 15px !important;   /* 稍微调大 1px 增加可读性 */
        line-height: 1.7 !important;
        text-indent: 0 !important;
        background-color: #F3F4F6 !important; /* 稍微加深背景色对比 */
        color: #111827 !important;    /* 近似纯黑，防止灰色显得细 */
        padding: 18px 24px !important;
        border-radius: 6px;
        border-left: 5px solid #005596 !important;
        display: block;
        margin: 30px 0 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        -webkit-font-smoothing: antialiased; /* 确保字体渲染锐利 */
        -moz-osx-font-smoothing: grayscale; /* Firefox 字体渲染优化 */
        text-rendering: optimizeLegibility; /* 改善字体渲染 */
    }
    
    /* 核心修复：强制所有子元素继承加粗样式 */
    .sws-prose .pdf-summary-card *, 
    .sws-prose .pdf-summary-card p, 
    .sws-prose .pdf-summary-card div,
    .sws-prose .pdf-summary-card span {
        font-family: inherit !important;
        font-weight: 900 !important; /* 强制子元素也加粗 */
        color: inherit !important;
        background-color: transparent !important;
    }

    /* Hide the PDF filename (bold tag) as requested */
    .sws-prose .pdf-summary-card b, 
    .sws-prose .pdf-summary-card strong {
        display: none !important;
    }

  /* PDF 转图片专用样式 - 打印排版增强 (绝对像素级控制) */
    .pdf-page-image {
        width: 100% !important;
        height: 100% !important;
        object-fit: contain !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        display: block !important;
        box-sizing: border-box !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    
    .pdf-page-container {
        width: 210mm !important;
        height: 297mm !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        border: none !important;
        background: white !important;
        box-sizing: border-box !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
  `,
  COMPANY_INFO: {
    EN_SHORT: "SWS OFFSHORE",
    EN_FULL: "SHANGHAI WAIGAOQIAO SHIPBUILDING & OFFSHORE CO.,LTD",
    ZH_FULL: "上海外高桥造船海洋工程有限公司"
  }
};
