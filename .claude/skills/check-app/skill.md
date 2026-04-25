---
name: check-app
description: 全面检查应用状态 — 环境配置、类型检查、测试、构建完整性
---

运行一系列检查来验证 SWS 工法情报编辑器的完整性：

1. **环境检查**: 确认 Node.js、npm、依赖安装、`DEEPSEEK_API_KEY` 配置、PDF.js 资源
2. **类型检查**: 运行 `npx tsc --noEmit --pretty` 检查 TypeScript 类型
3. **测试**: 运行 `npm test` 执行全部测试
4. **构建验证**: 检查 `public/` 下 PDF.js worker 资源是否存在
5. **报告**: 汇总所有发现的问题并给出修复建议

执行步骤：
1. 运行 `scripts/check-env.sh`（或手动检查 .env.local 配置）
2. 运行 `npm test`
3. 运行类型检查
4. 检查 `public/pdf.min.mjs` 和 `public/pdf.worker.min.mjs` 是否存在
5. 汇总输出检查报告
