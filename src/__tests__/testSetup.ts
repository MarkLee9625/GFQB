import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

vi.stubGlobal('IntersectionObserver', class {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
});

vi.stubGlobal('Image', class {
  crossOrigin = '';
  src = '';
  width = 800;
  height = 600;
  onload: any = null;
  onerror: any = null;
});

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
