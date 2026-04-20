export type UploadType = 'cover' | 'back';
export type NavigationDirection = 'prev' | 'next';
export type ExportType = 'reader' | 'project' | 'printable';

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
