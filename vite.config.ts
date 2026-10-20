import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 4512,
      host: '0.0.0.0',
      // 添加热更新优化
      hmr: {
        overlay: true,
      },
      // 开发环境代理配置：将前端 /api 请求转发到 BFF 代理服务器
      proxy: {
        '/api': {
          target: 'http://localhost:4513',
          changeOrigin: true,
          headers: {
            // 绝不能读 VITE_ 前缀的密钥：VITE_ 变量会被注入客户端 bundle（见 AGENTS.md 环境变量约定）
            'x-sws-proxy-secret': env.PROXY_SECRET || '',
          },
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
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          main: path.resolve(process.cwd(), 'index.html'),
        },
        output: {
          // 文件名优化
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // 首屏分包：react/pdf/graph 独立 chunk，编辑器懒 chunk 可并行加载
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor';
              if (id.includes('pdfjs-dist') || id.includes('fflate') || id.includes('file-saver')) return 'pdf-vendor';
              if (id.includes('/d3')) return 'graph-vendor';
              // R4-auto：转码依赖必须独立懒 chunk —— 并入 eager vendor 会随首屏加载（~300KB），
              // 且只有视频上传链路引用它。改动后用生产构建验证 chunk 图。
              if (id.includes('mp4box') || id.includes('mp4-muxer')) return 'transcode-vendor';
              return 'vendor';
            }
          },
        },
      },
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      esbuild: {
        drop: ["console", "debugger"],
      },
    },
    worker: {
      format: 'es',
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
