---
name: ai-feature-integration
description: 指导如何集成和扩展 AI 功能（基于项目的 aiService）。当需要添加新的 AI 生成、分析或处理功能时使用。
---

# AI 功能集成指南 (AI Feature Integration)

此 Skill 用于指导如何在项目中正确使用和扩展 AI 能力（Gemini API）。

## 何时使用

- 需要添加新的 AI 辅助功能（如文本生成、摘要、翻译等）
- 修改现有的 AI 调用逻辑
- 处理 AI 服务的配置和错误

## 现有架构 (基于 `services/aiService.ts`)

项目通常包含一个核心的 `aiService` 单例或模块。在开发前，请先阅读 `src/services/aiService.ts` 了解当前的 API 封装。

## 开发步骤

### 1. 扩展 Service 方法

在 `aiService.ts` 中添加新的方法，而不是在组件中直接调用 fetch。

```typescript
// src/services/aiService.ts

// ... existing code ...

/**
 * 这是一个新功能的示例方法
 * @param content 用户输入的内容
 * @returns AI 生成的结果
 */
public async generateNewFeature(content: string): Promise<string> {
  // 1. 构造 Prompt
  const prompt = `
    你是一个某种领域的专家。请基于以下内容完成任务：
    ${content}
    
    输出要求：
    - 简洁明了
    - 使用 Markdown 格式
  `;

  try {
    // 2. 调用底层 API (假设 model 是已初始化的 Gemini 模型实例)
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("AI Generation failed:", error);
    throw new Error("AI 服务暂时不可用，请稍后重试。");
  }
}
```

### 2. UI 交互模式

AI 操作通常是异步且耗时的，必须处理 Loading 状态和错误反馈。

```tsx
// 在组件中使用

const [loading, setLoading] = useState(false);
const [result, setResult] = useState<string | null>(null);

const handleGenerate = async () => {
  setLoading(true);
  try {
    const data = await aiService.generateNewFeature(inputText);
    setResult(data);
  } catch (error) {
    // 使用项目统一的 Toast 或 Alert 组件
    alert(error instanceof Error ? error.message : "发生未知错误");
  } finally {
    setLoading(false);
  }
};
```

### 3. Prompt通过工程 (Prompt Engineering)

- **指令清晰**: 明确告诉 AI 角色（Role）、任务（Task）和输出格式（Format）。
- **上下文**: 如果需要，将之前的对话或相关文档片段包含在 Prompt 中。
- **结构化输出**: 如果代码需要解析结果，要求 AI 输出 JSON 格式，并给出 Schema 示例。

## 安全与配置

- **API Key**: 严禁将 API Key 硬编码在代码中。必须通过 `import.meta.env.VITE_GEMINI_API_KEY` 等环境变量访问。
- **敏感数据**: 它是第三方服务，**不要**发送用户的隐私敏感信息（如密码、个人身份ID等）给 AI。

## 调试建议

- 在 `aiService` 中保留关键的 `console.log` 以便追踪 Prompt 和原始 Response，但在生产环境中应考虑从简或移除。
