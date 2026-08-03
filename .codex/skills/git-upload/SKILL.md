---
name: git-upload
description: 提交并推送代码到 GitHub — 状态检查、变更审查、commit、push
---

将当前分支的代码提交并推送到 GitHub 远程仓库。适用于日常代码同步和发布。

## 执行步骤

### 1. 检查当前状态
```
git status
git diff --stat HEAD   # 查看变更概览
git log --oneline -5   # 查看最近提交，了解 commit 风格
```

### 2. 识别应排除的文件
对照 `.gitignore` 确认以下文件不应被跟踪：
- `node_modules/`、`dist/`、`dist-reader/` — 构建产物
- `.trae/` — Trae CN 编辑器残留文件
- `.env.local`、`.env` — 环境配置（含 API Key）
- 如果这些目录已被跟踪，使用 `git rm --cached -r <dir>` 从跟踪中移除

### 3. Staging 变更
```
# 添加所有修改和删除（排除已在 .gitignore 中的文件）
git add -A

# 或精确添加特定文件
git add <file1> <file2>
```

### 4. 提交
遵循项目 commit 风格：`v<版本>: <中文描述>`
```
git commit -m "v1.x.x: 简要描述本次变更"
```

### 5. 推送到远程
```
git push origin <branch-name>
```

### 6. 验证
- `git status` 确认工作区干净
- `git log --oneline -1` 确认最新提交
- 到 GitHub 远程仓库确认已同步

## 注意事项

- **.trae/ 和 dist-reader/**：已在 .gitignore 中，如果之前被跟踪过，需先 `git rm --cached` 再 commit
- **不要提交** `.env.local`、`node_modules/`、`dist/`
- **大型二进制文件**（如 PDF CMap、字体文件）不应进入仓库
- 如果提交后发现遗漏，可以 `git add <遗漏文件>` && `git commit --amend`（仅未推送时使用）
