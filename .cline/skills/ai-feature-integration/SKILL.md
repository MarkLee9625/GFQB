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

项目包含一个核心的 `aiService` 模块，用于调用 Gemini API。在开发前，请先阅读 `services/aiService.ts` 了解当前的 API 封装。

**重要配置**：
- **API Key**: 通过 `import.meta.env.VITE_GEMINI_API_KEY` 环境变量访问
- **模型名称**: 当前使用 `gemini-3-flash-preview`
- **核心接口**: `AIResult` 包含 `title`, `abstract`, `keywords`

## 开发步骤

### 1. 扩展 Service 方法

在 `aiService.ts` 中添加新的方法，而不是在组件中直接调用 fetch。

```typescript
// services/aiService.ts

/**
 * 新功能示例方法 - 实际开发时应参考 generateArticleMeta 的实现
 * @param content 用户输入的内容
 * @returns 包含 title、abstract 和 keywords 的结构化数据
 */
export async function generateNewFeature(content: string): Promise<AIResult> {
    // 1. 构建提示词（必须遵循海工技术主编人设规范）
    const prompt = `
你是一名资深的船舶工程与智能制造领域的**技术主编**。
请基于以下文章内容完成特定任务。

### 文章内容：
${content}

### 任务要求：
[这里描述具体任务要求]

### 返回格式：
请务必严格按以下 JSON 格式返回，不要包含任何 Markdown 标记或额外文字：
{
  "title": "生成的专业标题",
  "abstract": "生成的摘要内容",
  "keywords": ["标签1", "标签2", "标签3"]
}
`;

    try {
        // 2. 调用统一的 AI 请求逻辑 (参考 generateArticleMeta)
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let text = data.candidates[0].content.parts[0].text;
            // 处理可能的 markdown 代码块
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text) as AIResult;
        } else {
            throw new Error('API 返回数据格式异常');
        }
    } catch (error) {
        console.error('AI 生成失败:', error);
        throw error;
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
    const data = await generateNewFeature(inputText);
    setResult(data);
  } catch (error) {
    // 使用项目统一的 Toast 或 Alert 组件
    console.error('AI 功能执行失败:', error);
    // 可以展示用户友好的错误提示
    alert(error instanceof Error ? error.message : "AI 服务暂时不可用");
  } finally {
    setLoading(false);
  }
};
```

### 3. 提示词工程 (Prompt Engineering)

**必须遵循海工技术主编人设**：
- **角色设定**：船舶工程与智能制造领域的资深技术主编
- **风格要求**：干练、笃定、数据驱动、重视工艺细节
- **写作禁令**：禁止使用"提质增效、数字化转型、智能化提升、创新驱动、先进技术、显著成效、圆满完成"等空洞虚词
- **强制要求**：
  - 必须提及具体工种/场景：涂装、焊接、总装、舾装、下水、精度控制、分段建造等
  - 保留核心指标数据
  - 标题结构：`核心技术名词` + `动词/应用场景` + `成效`
- **摘要逻辑**：Why (行业痛点) → How (技术手段) → Benefits (具体收益/数据)

## 安全与配置

- **API Key**: 严禁将 API Key 硬编码在代码中。必须通过 `import.meta.env.VITE_GEMINI_API_KEY` 环境变量访问。
- **敏感数据**: 不要发送用户的隐私敏感信息（如密码、个人身份ID等）给 AI。
- **内容限制**: 确保输入内容符合 API 使用政策。

## 错误处理

- **网络错误**: 检查网络连接和 API 服务状态
- **API 限制**: 处理速率限制和配额限制
- **解析错误**: 确保 AI 返回的 JSON 格式正确
- **超时处理**: 为长时间运行的操作设置超时

## 调试建议

- 在 `aiService` 中保留关键的 `console.log` 以便追踪 Prompt 和原始 Response
- 在开发环境中可以输出完整的请求/响应数据
- 在生产环境中应移除敏感调试信息

## 与工程人设提示词技能的关联

本技能与 `engineering-persona-prompting` 技能紧密相关。所有 AI 提示词都应遵循海工技术主编的人设规范，确保生成的文案具有行业实战感。