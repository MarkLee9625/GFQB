#!/bin/bash
# 同时启动前端开发服务器和 BFF 代理服务器
# 用法: ./scripts/start-all.sh [dev|prod]
cd "$(dirname "$0")/.."

MODE="${1:-dev}"

if [ "$MODE" = "prod" ]; then
  echo "🚀 生产模式: 构建并启动..."
  npm run build && NODE_ENV=production node server.js
else
  echo "🚀 开发模式: 并行启动前端(4512) + BFF(4513)..."
  echo ""

  # 先同步 Worker 资源
  npm run sync:worker

  # 并行启动前端和 BFF
  (npx vite --port 4512) &
  VITE_PID=$!

  (node server.js) &
  SERVER_PID=$!

  echo "📡 前端: http://localhost:4512"
  echo "📡 BFF:  http://localhost:4513"
  echo ""
  echo "按 Ctrl+C 停止所有服务"

  trap "kill $VITE_PID $SERVER_PID 2>/dev/null; exit" SIGINT SIGTERM
  wait
fi
