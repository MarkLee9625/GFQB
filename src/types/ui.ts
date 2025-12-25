// UI 相关的类型定义

export type UploadType = 'cover' | 'back';
export type NavigationDirection = 'prev' | 'next';
export type ExportType = 'reader' | 'project';

export interface ExportOptions {
  useAlternateDesign: boolean;
  includeImages: boolean;
  optimizeForPrint: boolean;
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
