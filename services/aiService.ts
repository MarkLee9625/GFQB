/**
 * AI 服务 - 通过 BFF 代理调用 DeepSeek API 进行文章总结
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 */

// 使用 DeepSeek Reasoning 模型
const MODEL_NAME = 'deepseek-reasoner';
// 前端通过本地 BFF 代理访问 DeepSeek API，解决跨域和 API Key 安全问题
const API_URL = `/api/deepseek/generate`;

/**
 * 深度清洗 DeepSeek Reasoning 模型返回的 JSON 字符串
 * 处理 <think>...</think> 标签并提取有效的 JSON 部分
 */
function extractJsonFromReasoning(text: string): string {
    // 1. 移除 <think>...</think> 标签及其内容
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // 2. 查找第一个 { 和最后一个 }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        throw new Error('无法从 AI 响应中提取有效的 JSON 数据');
    }
    
    // 3. 提取 JSON 字符串
    const jsonStr = text.substring(firstBrace, lastBrace + 1);
    
    // 4. 移除可能存在的 markdown 代码块标记
    return jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * 清理纯文本响应中的推理标签
 */
function cleanPlainTextResponse(text: string): string {
    // 移除 <think>...</think> 标签及其内容
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * AI 结果接口
 */
export interface AIResult {
    title: string;
    abstract: string;
    keywords: string[]; // 新增：提取的关键词
}

/**
 * 调用 DeepSeek API 生成文章总结与标题建议
 * @param content 文章正文内容
 * @returns Promise<AIResult> 
 */
export async function generateArticleMeta(content: string): Promise<AIResult> {
    const plainText = content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim().slice(0, 100000);

    const systemPrompt = `你是一名资深的船舶工程与智能制造领域的**技术主编**。请严格遵循以下规则处理用户提供的文章：
### 1. 【标题生成要求】
* 风格：拒绝生硬、拒绝学术化。要干练、有力、具有工程实战感。
* 结构：核心技术名词 + 动词/应用场景/成效。
* 字数：12 - 25 字。
* 优秀示例：大型邮轮薄板激光复合焊变形控制工艺
### 2. 【摘要生成要求】
* 核心逻辑：Why (痛点/背景) -> How (技术手段) -> Benefits (具体收益/数据)。
* 字数：控制在 100 字左右。言简意赅，直击核心。
### 3. 【标签/关键词生成要求】
* 数量：3 - 5 个。
* 必须包含：文章涉及的具体工艺环节或工种（如：涂装、焊接、总装等）。
* 绝对禁止：禁止生成"提质增效"、"智能化"等无实际技术细节的虚词。
### 输出格式：
你必须在思考过程结束后，**仅**输出以下合法的 JSON 结构，不要附带任何解释性前缀或后缀文字：
\`\`\`json
{"title": "生成的专业标题", "abstract": "生成的摘要内容", "keywords": ["标签1", "标签2"]}
\`\`\``;

    const userPrompt = `请阅读并分析以下文章内容：\n\n${plainText}`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // 安全修复：添加自定义头部，向 BFF 代理服务器证明这是来自合法前端页面的请求
                // 防止外部直接调用代理接口盗刷额度
                'x-sws-proxy-secret': 'my-super-secret-key'
            },
        body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`AI 服务请求失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.choices?.[0]?.message?.content) {
            let text = data.choices[0].message.content;
            // 使用深度清洗函数处理可能的推理标签
            const cleanedText = extractJsonFromReasoning(text);
            return JSON.parse(cleanedText) as AIResult;
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
    // 截取前 50000 字以释放 DeepSeek 128K 上下文算力
    const plainText = content.replace(/<[^>]+>/g, '\n').slice(0, 50000);

    const systemPrompt = `你是一个专业的船舶工程编辑助手。请为用户提供的文章拟定一个专业的、简练且具有吸引力的标题。
要求：
1. 字数控制在 20 字以内。
2. 直接返回纯文本标题，不要包含任何标点符号（如书名号、引号）。
3. 思考完成后，仅输出标题本身，没有任何多余的问候语。`;

    const userPrompt = `文章内容如下：\n\n${plainText}`;

    // 通过 BFF 代理调用 DeepSeek API
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            // 安全修复：添加自定义头部，向 BFF 代理服务器证明这是来自合法前端页面的请求
            // 防止外部直接调用代理接口盗刷额度
            'x-sws-proxy-secret': 'my-super-secret-key'
        },
        body: JSON.stringify({ 
            model: MODEL_NAME,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });

    if (!response.ok) throw new Error('AI 服务请求失败');
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    // 清理纯文本响应中的推理标签
    const cleanedText = cleanPlainTextResponse(text);
    return cleanedText.trim().replace(/^["']|["']$/g, ''); // 去除首尾引号
}
