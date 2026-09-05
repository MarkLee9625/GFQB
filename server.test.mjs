/**
 * BFF 服务器（server.js）回归测试
 *
 * 覆盖：
 * 1. 生产模式启动不崩溃（Express 5 通配符路由回归：app.get('*') 会抛
 *    "Missing parameter name at index 1"，必须用 /*splat）
 * 2. GET /api/health 健康检查
 * 3. /api/deepseek/generate 鉴权（缺 secret / 错 secret → 403；正确 secret 缺 messages → 400）
 * 4. SPA 兜底路由（dist/index.html 存在时验证 /*splat 修复）
 *
 * 运行：node --test server.test.mjs
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET = 'test-secret-123';

let child = null;
let baseUrl = '';
const childLogs = [];

function getFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // server 尚未就绪
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server 未能启动: ${childLogs.join('')}`);
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DEEPSEEK_API_KEY: 'dummy-key-for-test',
      PROXY_SECRET: SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => childLogs.push(d.toString()));
  child.stderr.on('data', (d) => childLogs.push(d.toString()));

  await waitForHealth();
});

after(() => {
  if (child && child.exitCode === null) {
    child.kill();
  }
});

test('健康检查返回 200 且为生产环境', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'healthy');
  assert.equal(body.environment, 'production');
  assert.equal(body.deepseekApiConfigured, true);
});

test('缺少 x-sws-proxy-secret 头返回 403', async () => {
  const res = await fetch(`${baseUrl}/api/deepseek/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(res.status, 403);
});

test('错误的 x-sws-proxy-secret 头返回 403', async () => {
  const res = await fetch(`${baseUrl}/api/deepseek/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sws-proxy-secret': 'wrong-secret' },
    body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal(res.status, 403);
});

test('正确 secret 但缺少 messages 返回 400', async () => {
  const res = await fetch(`${baseUrl}/api/deepseek/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sws-proxy-secret': SECRET },
    body: JSON.stringify({ model: 'deepseek-v4-flash' }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /messages/);
});

test('SPA 兜底路由返回 index.html（/*splat 回归）', async () => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn('[skip] dist/index.html 不存在，跳过兜底路由测试');
    return;
  }
  const res = await fetch(`${baseUrl}/some/deep/route`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
});
