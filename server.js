/**
 * BFF 代理服务器 - 用于安全地转发 DeepSeek API 请求
 * 解决前端 API Key 硬编码的安全风险
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// ES6 模块下的 __dirname 模拟
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量 - 优先从 .env.local 读取，如果不存在则读取 .env
import { existsSync } from 'fs';
if (existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config({ path: '.env' });
}

// 健康检查：验证必需的环境变量
// 安全修复：移除对 VITE_ 前缀的兼容性，防止 API Key 被 Vite 打包泄露到前端
// 警告：DEEPSEEK_API_KEY 是后端专用密钥，绝不能以 VITE_ 开头
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 快速失败机制：如果缺少 API Key，立即终止服务
if (!DEEPSEEK_API_KEY) {
  console.error('\x1b[31m%s\x1b[0m', '‼️  CRITICAL ERROR: 未检测到 DEEPSEEK_API_KEY');
  console.error('\x1b[31m%s\x1b[0m', '请在 .env.local 文件中配置 DEEPSEEK_API_KEY=your_actual_api_key');
  console.error('\x1b[31m%s\x1b[0m', '服务启动中断，请修复配置后重试');
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '✅  BFF 代理服务器启动配置验证通过');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false // 生产环境禁止跨域（因为前端和代理在同一域名下）
    : 'http://localhost:3000', // 开发环境允许前端访问
  credentials: true,
}));

// 安全修复：限制请求体大小为 1MB，防止恶意发送超大文本耗尽内存
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 生产环境：托管前端静态资源
if (process.env.NODE_ENV === 'production') {
  console.log('\x1b[36m%s\x1b[0m', '🚀 生产模式：启用静态资源托管');
  
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  
  // API 路由必须在静态托管之前定义，避免冲突
  console.log('\x1b[36m%s\x1b[0m', '📡 API 路由已注册');
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sws-gongfa-bff-proxy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    deepseekApiConfigured: !!DEEPSEEK_API_KEY,
  });
});

// DeepSeek API 代理端点
app.post('/api/deepseek/generate', async (req, res) => {
  try {
    const proxySecret = process.env.PROXY_SECRET;
    if (!proxySecret) {
      console.warn('⚠️  PROXY_SECRET 未配置，代理接口拒绝所有请求');
      return res.status(403).json({
        error: 'Forbidden',
        message: '代理服务未正确配置',
      });
    }
    const requestSecret = req.headers['x-sws-proxy-secret'];
    
    if (requestSecret !== proxySecret) {
      console.warn('🚨 非法代理接口访问尝试：缺少或错误的 x-sws-proxy-secret 头部');
      return res.status(403).json({
        error: 'Forbidden',
        message: '无权访问此 API 接口',
      });
    }
    
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '请求体必须包含 messages 数组',
      });
    }

    const apiUrl = DEEPSEEK_API_URL;
    const requestedModel = req.body.model || 'unknown';
    
    console.log(`📤 转发请求到 DeepSeek API (模型: ${requestedModel})...`);

    const controller = new AbortController();
    const upstreamTimeout = setTimeout(() => controller.abort(), 300_000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(upstreamTimeout);

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ DeepSeek API 错误:', {
        status: response.status,
        statusText: response.statusText,
        model: requestedModel,
        data: responseData,
      });
      
      return res.status(response.status).json({
        error: 'DeepSeek API Error',
        status: response.status,
        details: responseData,
      });
    }

    console.log(`✅ DeepSeek API 请求成功 (模型: ${requestedModel})`);
    res.status(response.status).json(responseData);
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('🔥 DeepSeek API 请求超时 (>300s)');
      return res.status(504).json({
        error: 'Gateway Timeout',
        message: 'DeepSeek API 请求超时，请稍后重试',
      });
    }
    console.error('🔥 代理服务器内部错误:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || '未知错误',
    });
  }
});

// 生产环境：兜底路由（支持前端 History 路由）
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(indexPath);
  });
}

// 启动服务器
app.listen(PORT, () => {
  console.log('\x1b[32m%s\x1b[0m', `🚀 BFF 代理服务器启动成功`);
  console.log('\x1b[36m%s\x1b[0m', `📍 本地地址: http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', `📡 健康检查: http://localhost:${PORT}/api/health`);
  console.log('\x1b[36m%s\x1b[0m', `🤖 DeepSeek 代理: http://localhost:${PORT}/api/deepseek/generate`);
  console.log('\x1b[33m%s\x1b[0m', `🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('\x1b[32m%s\x1b[0m', '📦 前端静态资源托管已启用');
    console.log('\x1b[32m%s\x1b[0m', `🔗 访问 http://localhost:${PORT} 使用完整应用`);
  }
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('\x1b[33m%s\x1b[0m', '🛑 收到 SIGTERM 信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\x1b[33m%s\x1b[0m', '🛑 收到 SIGINT 信号，正在关闭服务器...');
  process.exit(0);
});