import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 添加热更新优化
      hmr: {
        overlay: true,
      },
      // 开发环境代理配置：将前端 /api 请求转发到 BFF 代理服务器
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
    plugins: [
      tailwindcss(),
      react()
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      }
    },
    // 优化构建目标以支持 PDF.js 的 Top-level Await
    build: {
      target: 'esnext',
      minify: false, // Disable minification to avoid build crash
      sourcemap: false,
      rollupOptions: {
        output: {
          // 文件名优化
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // 构建输出优化
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
    },
    // 预构建优化
    optimizeDeps: {
      include: ['react', 'react-dom'],
      esbuildOptions: {
        target: 'esnext',
        supported: {
          'top-level-await': true
        }
      }
    },
    base: './', // Ensure relative paths for offline/single-file usage
    esbuild: {
      target: 'esnext'
    }
  };
});
