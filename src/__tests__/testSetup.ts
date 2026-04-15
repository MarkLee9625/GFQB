import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// 清理 DOM
afterEach(() => {
  cleanup();
});

// 安全的 Image Mock (基于 Class 的 stub)
vi.stubGlobal('Image', class {
  crossOrigin = '';
  src = '';
  width = 800;
  height = 600;
  onload: any = null;
  onerror: any = null;
  
  // 模拟 src 赋值时自动触发 onload
  // 注意：在测试图片异常时，可手动重写此行为
});

// 安全的 FileReader Mock (基于 Class 的 stub)
vi.stubGlobal('FileReader', class {
  result = 'data:test;base64,mock';
  onload: any = null;
  onerror: any = null;
  onabort: any = null;
  error: any = null;
  readyState = 0;
  
  readAsDataURL() {}
  abort() {}
});
