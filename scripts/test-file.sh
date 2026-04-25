#!/bin/bash
# 运行指定测试文件，支持 watch 模式
# 用法: ./scripts/test-file.sh <文件路径> [--watch]
cd "$(dirname "$0")/.."

FILE="$1"
WATCH="${2:-}"

if [ -z "$FILE" ]; then
  echo "❌ 请指定测试文件路径"
  echo "用法: ./scripts/test-file.sh <文件路径> [--watch]"
  echo "示例: ./scripts/test-file.sh src/utils/blockParser.test.ts"
  exit 1
fi

if [ "$WATCH" = "--watch" ]; then
  npx vitest run "$FILE" --watch
else
  npx vitest run "$FILE"
fi
