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
- 集成 Gemini API 的最新功能

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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1024,
                    topP: 0.95
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API 响应错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("AI 未返回有效结果");
        }
        
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
const [error, setError] = useState<string | null>(null);

const handleGenerate = async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await aiService.generateNewFeature(inputText);
    setResult(data);
  } catch (error) {
    // 使用项目统一的 Toast 或 Alert 组件
    setError(error instanceof Error ? error.message : "发生未知错误");
  } finally {
    setLoading(false);
  }
};

return (
  <div>
    {loading && <div className="loading-indicator">处理中...</div>}
    {error && <div className="error-message">{error}</div>}
    {result && (
      <div className="result">
        <h2>{result.title}</h2>
        <p>{result.abstract}</p>
        <div className="keywords">
          {result.keywords.map((keyword, index) => (
            <span key={index} className="keyword-tag">{keyword}</span>
          ))}
        </div>
      </div>
    )}
  </div>
);
```

### 3. 提示词工程 (Prompt Engineering)

- **指令清晰**: 明确告诉 AI 角色（Role）、任务（Task）和输出格式（Format）。
- **结构化输出**: 如果代码需要解析结果，要求 AI 输出 JSON 格式，并给出 Schema 示例。
- **上下文管理**: 对于复杂任务，提供足够的上下文信息，帮助 AI 更好地理解任务。
- **few-shot 学习**: 提供示例输入和输出，帮助 AI 理解预期的输出格式。

### 4. Gemini API 最新功能

- **多模态支持**: 支持文本、图像、音频等多种输入模式。
- **函数调用**: 允许 AI 调用外部函数，实现更复杂的交互。
- **结构化输出**: 可以指定输出格式为 JSON，简化解析过程。
- **流式响应**: 支持流式输出，提升用户体验。

```typescript
// 流式响应示例
export async function generateWithStream(content: string, onChunk: (chunk: string) => void): Promise<string> {
    const prompt = `你是一个技术专家。请基于以下内容完成任务：\n${content}`;
    
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            stream: true
        })
    });
    
    const reader = response.body?.getReader();
    let fullResponse = '';
    
    if (reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            // 处理 SSE 格式的响应
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;
                    try {
                        const json = JSON.parse(data);
                        if (json.candidates && json.candidates[0].content.parts[0].text) {
                            const text = json.candidates[0].content.parts[0].text;
                            fullResponse += text;
                            onChunk(text);
                        }
                    } catch (e) {
                        console.error('解析 SSE 数据失败:', e);
                    }
                }
            }
        }
    }
    
    return fullResponse;
}
```

## 安全与配置

- **API Key**: 严禁将 API Key 硬编码在代码中。必须通过 `import.meta.env.VITE_GEMINI_API_KEY` 等环境变量访问。
- **敏感数据**: 它是第三方服务，**不要**发送用户的隐私敏感信息（如密码、个人身份ID等）给 AI。
- **请求限制**: 实现请求节流，避免过多请求导致 API 限制。
- **错误处理**: 实现完善的错误处理机制，包括网络错误、API 错误等。

## 性能优化

- **缓存机制**: 对于相同的输入，缓存 AI 响应结果，减少重复请求。
- **批量处理**: 对于多个相似的任务，考虑批量处理，减少 API 调用次数。
- **后台处理**: 对于耗时较长的任务，考虑在后台处理，避免阻塞 UI。

## 调试建议

- 在 `aiService` 中保留关键的 `console.log` 以便追踪 Prompt 和原始 Response，但在生产环境中应考虑从简或移除。
- 使用 Chrome DevTools 的 Network 面板监控 API 请求和响应。
- 实现详细的错误日志，便于排查问题。
