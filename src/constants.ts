export function isSpecialCategory(category: string | undefined): boolean {
  return category === '封面' || category === '封底';
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
    .editor-area img:hover {
        outline: 1px dashed #93c5fd;
        outline-offset: 3px;
        cursor: pointer;
    }
    .editor-area img.img-selected {
        outline: 2px solid #005596;
        outline-offset: 3px;
    }
    .sws-prose .image-caption {
        text-align: center !important;
        font-size: 14px !important;
        color: #6b7280 !important;
        font-style: italic !important;
        text-indent: 0 !important;
        margin: 4px 0 16px 0 !important;
        line-height: 1.6 !important;
    }
    
    .media-container {
        display: block;
        margin: 24px 0 !important;
        text-align: center;
    }
    .sws-prose blockquote {
        border-left: 3px solid #005596; margin: 30px 0; padding: 5px 25px;
        color: #4b5563 !important; font-style: italic; background: #f9fafb !important; text-indent: 0 !important;
    }
    .sws-prose ul { list-style-type: disc; padding-left: 2em; margin-bottom: 25px; }
    .sws-prose ol { list-style-type: decimal; padding-left: 2em; margin-bottom: 25px; }
    
    .sws-prose .pdf-summary-card {
        font-family: "PingFang SC", "Microsoft YaHei", "SimHei", "STHeiti", "Heiti SC", "Helvetica Neue", Arial, sans-serif !important;
        font-weight: 900 !important;
        font-style: normal !important;
        font-size: 15px !important;
        line-height: 1.7 !important;
        text-indent: 0 !important;
        background-color: #F3F4F6 !important;
        color: #111827 !important;
        padding: 18px 24px !important;
        border-radius: 6px;
        border-left: 5px solid #005596 !important;
        display: block;
        margin: 30px 0 !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
    }
    
    .sws-prose .pdf-summary-card *, 
    .sws-prose .pdf-summary-card p, 
    .sws-prose .pdf-summary-card div,
    .sws-prose .pdf-summary-card span {
        font-family: inherit !important;
        font-weight: 900 !important;
        color: inherit !important;
        background-color: transparent !important;
    }

    .sws-prose .pdf-summary-card b, 
    .sws-prose .pdf-summary-card strong {
        display: none !important;
    }

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
