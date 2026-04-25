#!/bin/bash
# 检查环境配置是否完整
cd "$(dirname "$0")/.."

echo "🔍 SWS 工法情报编辑器 - 环境检查"
echo "=================================="
echo ""

# 检查 Node.js
NODE_VER=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "✅ Node.js: $NODE_VER"
else
  echo "❌ Node.js: 未安装"
fi

# 检查 npm
NPM_VER=$(npm -v 2>/dev/null)
if [ $? -eq 0 ]; then
  echo "✅ npm: $NPM_VER"
else
  echo "❌ npm: 未安装"
fi

# 检查依赖是否安装
if [ -d "node_modules" ]; then
  echo "✅ node_modules: 已安装"
else
  echo "❌ node_modules: 未安装 (运行 npm install)"
fi

# 检查 .env.local
if [ -f ".env.local" ]; then
  echo "✅ .env.local: 存在"
  # 检查 DEEPSEEK_API_KEY
  KEY=$(grep DEEPSEEK_API_KEY .env.local | head -1 | cut -d'=' -f2)
  if [ -n "$KEY" ] && [ "$KEY" != "your_deepseek_api_key_here_do_not_commit" ]; then
    echo "   ✅ DEEPSEEK_API_KEY: 已配置"
  else
    echo "   ⚠️  DEEPSEEK_API_KEY: 未配置或为占位值"
  fi
  # 检查 PROXY_SECRET
  SECRET=$(grep PROXY_SECRET .env.local | head -1 | cut -d'=' -f2)
  if [ -n "$SECRET" ]; then
    echo "   ✅ PROXY_SECRET: 已配置"
  else
    echo "   ⚠️  PROXY_SECRET: 未配置"
  fi
else
  echo "⚠️  .env.local: 不存在 (复制 .env.example 并填写配置)"
fi

# 检查 TypeScript
echo ""
echo "📦 主要依赖版本:"
for pkg in react react-dom vite typescript tailwindcss vitest; do
  VER=$(node -e "try{const p=require('./package.json');console.log(p.dependencies['$pkg']||p.devDependencies['$pkg']||'未安装')}catch(e){console.log('读取失败')}" 2>/dev/null)
  echo "   $pkg: $VER"
done

# 检查 public 资源
echo ""
echo "📁 关键资源检查:"
for f in public/pdf.min.mjs public/pdf.worker.min.mjs; do
  if [ -f "$f" ]; then
    echo "   ✅ $f"
  else
    echo "   ⚠️  $f: 缺失 (运行 npm run sync:worker)"
  fi
done

echo ""
echo "=================================="
echo "检查完成"
