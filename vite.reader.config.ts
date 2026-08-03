import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 阅读版独立构建配置
 *
 * 与编辑器入口分开构建，保证阅读版是一个完整的单文件应用：
 * - 单入口（reader.html）→ Rollup 把全部静态依赖打进同一个 JS chunk，
 *   不会生成需要在单文件外加载的共享 chunk；
 * - 不包含编辑器功能（Editor/导出引擎/AI/PDF.js 抽词等）；
 * - 构建产物由 post-build.js 内联为单文件模板（reader-template.html）。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      tailwindcss(),
      react()
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      }
    },
    build: {
      // 与编辑器共用 dist：禁止清空，避免删掉主入口的构建产物
      emptyOutDir: false,
      target: 'esnext',
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          reader: path.resolve(process.cwd(), 'reader.html'),
        },
        output: {
          entryFileNames: 'assets/reader-[hash].js',
          chunkFileNames: 'assets/reader-chunk-[hash].js',
          assetFileNames: 'assets/reader-[hash].[ext]',
        },
      },
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      esbuild: {
        drop: ["console", "debugger"],
      },
    },
    esbuild: {
      target: 'esnext'
    }
  };
});