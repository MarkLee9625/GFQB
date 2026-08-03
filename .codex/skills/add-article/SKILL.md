---
name: add-article
description: 引导创建新文章 — 填写元信息、编辑正文、设置分类、AI辅助
---

提供交互式引导来创建一篇新的工法情报文章。

流程：

1. **收集信息**:
   - 文章标题
   - 分类（已有分类列表或新建）
   - 正文内容（HTML/Markdown，或从粘贴内容清洗）
   - 是否包含 PDF 附件
   - 标签关键词

2. **AI 辅助**（可选）:
   - `/ai-meta` — 自动生成标题、摘要、关键词
   - 检查是否已配置 `DEEPSEEK_API_KEY`

3. **内容处理**:
   - 粘贴的 HTML 通过 `pasteCleaner` 清洗
   - 图片通过 `compressImage` 压缩为 WebP
   - 纯文本段落自动添加首行缩进 2em

4. **保存**:
   - 通过 `useJournal.createArticle()` 创建
   - 设置合适的 order 排序
   - 触发 IndexedDB 持久化

注意事项：
- 封面/封底分类有特殊渲染逻辑，普通文章不应使用
- 如果内容包含 PDF 附件，会触发 PDF.js 抽字
- 图片压缩默认 maxWidth=1200, quality=0.8, format=webp
