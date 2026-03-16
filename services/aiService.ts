/**
 * AI 服务 - 通过 BFF 代理调用 Gemini API 进行文章总结
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 */

// 使用用户指定的模型
const MODEL_NAME = 'gemini-3-flash-preview';
// 前端通过本地 BFF 代理访问 Gemini API，解决跨域和 API Key 安全问题
const API_URL = `/api/gemini/generate`;

/**
 * AI 结果接口
 */
export interface AIResult {
    title: string;
    abstract: string;
    keywords: string[]; // 新增：提取的关键词
}

/**
 * 调用 Gemini API 生成文章总结与标题建议
 * @param content 文章正文内容
 * @returns Promise<AIResult> 
 */
export async function generateArticleMeta(content: string): Promise<AIResult> {
    const plainText = content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim().slice(0, 10000);

    const prompt = `
你是一名资深的船舶工程与智能制造领域的**技术主编**。
请阅读以下文章，提取核心价值，按要求生成元数据。

### 1. 【标题生成要求】
* **风格**：拒绝生硬、拒绝学术化。要**干练、有力、具有工程实战感**。
* **结构**：核心技术名词 + 动词/应用场景/成效。
* **字数**：12 - 25 字。
* **✅ 优秀示例**：**大型邮轮薄板激光复合焊变形控制工艺**

### 2. 【摘要生成要求】
* **核心逻辑**：**Why (痛点/背景)** -> **How (技术手段)** -> **Benefits (具体收益/数据)**。
* **字数**：控制在 **100 字** 左右（允许 ±20 字左右浮动，视文章内容长短而定）。要求言简意赅，直击核心，不要有废话。
* **语气**：客观、笃定，突出技术的应用价值。

### 3. 【标签/关键词生成要求】
* **数量**：3 - 5 个。
* **内容要求**：
    * **✅ 必须包含**：文章涉及的具体工艺环节或工种（例如：**涂装、焊接、总装、分段建造、下水**等）。
    * **✅ 包含**：核心设备或关键技术名词。
    * **❌ 绝对禁止**：禁止生成"提质增效"、"智能化"、"数字化"、"先进技术"、"创新性"等泛泛而谈、没有实际技术细节的虚词。

### 文章内容：
${plainText}

### 返回格式：
请务必严格按以下 JSON 格式返回，不要包含任何 Markdown 标记或额外文字：
{
  "title": "生成的专业标题",
  "abstract": "生成的摘要内容",
  "keywords": ["标签1", "标签2", "标签3"]
}
`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let text = data.candidates[0].content.parts[0].text;
            // 处理可能的 markdown 代码块
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text) as AIResult;
        } else {
            throw new Error('AI 服务返回数据格式异常');
        }
    } catch (error) {
        console.error('Generate meta failed:', error);
        throw error;
    }
}

/**
 * 兼容旧版本：调用 Gemini API 生成文章总结
 * @deprecated 请优先使用 generateArticleMeta
 */
export async function generateArticleSummary(content: string): Promise<string> {
    const res = await generateArticleMeta(content);
    return res.abstract;
}

/**
 * 仅生成标题
 */
export async function generateTitleOnly(content: string): Promise<string> {
    // 截取前 5000 字以节省 Token
    const plainText = content.replace(/<[^>]+>/g, '\n').slice(0, 5000);

    const prompt = `
    你是一个专业的编辑助手。请阅读以下文章内容，为其拟定一个专业的、简练且具有吸引力的标题（20字以内）。
    文章内容：
    ${plainText}
    
    请直接返回标题文本，不要包含 JSON 格式，不要包含引号或其他多余字符。
    `;

    // 通过 BFF 代理调用 Gemini API
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error('AI 服务请求失败');
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim().replace(/^["']|["']$/g, ''); // 去除首尾引号
}
