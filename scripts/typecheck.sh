#!/bin/bash
# TypeScript 类型检查
# 运行 tsc 的 noEmit 模式来检查类型错误
cd "$(dirname "$0")/.."
npx tsc --noEmit --pretty 2>&1
exit $?
