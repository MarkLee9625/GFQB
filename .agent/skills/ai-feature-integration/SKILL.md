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

项目通常包含一个核心的 `aiService` 单例或模块。在开发前，请先阅读 `services/aiService.ts` 了解当前的 API 封装。

## 开发步骤

### 1. 扩展 Service 方法

在 `aiService.ts` 中添加新的方法，而不是在组件中直接调用 fetch。

```typescript
// services/aiService.ts

export interface AIResult {
    title: string;
    abstract: string;
    keywords: string[];
}

/**
 * 这是一个新功能的示例方法
 * @param content 用户输入的内容
 * @returns 包含 title、abstract 和 keywords 的结构化数据
 */
export async function generateNewFeature(content: string): Promise<AIResult> {
    const prompt = `你是一个技术专家。请基于以下内容完成任务：\n${content}\n\n请严格返回如下 JSON 格式：{"title":"...", "abstract":"...", "keywords":["..."]}`;

    try {
        // 调用统一的 AI 请求逻辑 (参考 generateArticleMeta)
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text) as AIResult;
    } catch (error) {
        console.error("AI 生成失败:", error);
        throw new Error("AI 服务暂时不可用。");
    }
}
```

### 2. UI 交互模式

AI 操作通常是异步且耗时的，必须处理 Loading 状态和错误反馈。

```tsx
// 在组件中使用

const [loading, setLoading] = useState(false);
const [result, setResult] = useState<AIResult | null>(null);

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

### 3. 提示词工程 (Prompt Engineering)

- **指令清晰**: 明确告诉 AI 角色（Role）、任务（Task）和输出格式（Format）。
- **结构化输出**: 如果代码需要解析结果，要求 AI 输出 JSON 格式，并给出 Schema 示例。

## 安全与配置

- **API Key**: 严禁将 API Key 硬编码在代码中。必须通过 `import.meta.env.VITE_GEMINI_API_KEY` 等环境变量访问。
- **敏感数据**: 它是第三方服务，**不要**发送用户的隐私敏感信息（如密码、个人身份ID等）给 AI。

## 调试建议

- 在 `aiService` 中保留关键的 `console.log` 以便追踪 Prompt 和原始 Response，但在生产环境中应考虑从简或移除。
