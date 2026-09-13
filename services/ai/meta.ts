/**
 * AI 元数据模块 - 标题/摘要/关键词、标题单生、文本扩写精简
 * 原 services/aiService.ts 对应部分原样迁移，行为不变
 */

import { callDeepSeekAPI, cleanPlainTextResponse, robustJsonParse, warnIfLengthOff, REASONER_MODEL } from './client';

export interface AIResult {
    title: string;
    abstract: string;
    keywords: string[];
}

export async function generateArticleMeta(content: string): Promise<AIResult> {
    // 标题/摘要/关键词的信息量集中在前部，截断至 3 万字控制输入成本（原 10 万字符按量计费过高）
    const plainText = content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim().slice(0, 30000);

    const systemPrompt = `你是一名资深的船舶工程与智能制造领域的**技术主编**。请严格遵循以下规则处理用户提供的文章：
### 1. 【标题生成要求】
* 风格：拒绝生硬、拒绝学术化。要干练、有力、具有工程实战感。
* 结构：核心技术名词 + 动词/应用场景/成效。
* 字数：12 - 25 字。
* 必须重新提炼，禁止直接复制原文标题。
* 优秀示例：大型邮轮薄板激光复合焊变形控制工艺
### 2. 【摘要生成要求】
* 核心逻辑：Why (痛点/背景) -> How (技术手段) -> Benefits (具体收益/数据)。
* 字数：控制在 100 字左右。言简意赅，直击核心。
### 3. 【标签/关键词生成要求】
* 数量：3 - 5 个。
* 必须包含：文章涉及的具体工艺环节或工种（如：涂装、焊接、总装等）。
* 绝对禁止：禁止生成"提质增效"、"智能化"等无实际技术细节的虚词。
### 输出格式：
你必须在思考过程结束后，**仅**输出以下合法的 JSON 结构，不要附带任何解释性前缀或后缀文字，不要使用 Markdown 代码块：
{"title": "生成的专业标题", "abstract": "生成的摘要内容", "keywords": ["标签1", "标签2"]}`;

    const userPrompt = `请阅读并分析以下文章内容：\n\n${plainText}`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            reasoningEffort: 'low',
        });
        const result = robustJsonParse<AIResult>(rawText);
        const title = String(result.title ?? '').trim();
        const abstract = String(result.abstract ?? '').trim();
        const keywords = Array.isArray(result.keywords)
            ? [...new Set(result.keywords.map(k => String(k).trim()).filter(Boolean))].slice(0, 5)
            : [];
        if (!title || !abstract) {
            throw new Error('AI 元数据生成结果缺少 title 或 abstract 字段');
        }
        if (keywords.length === 0) {
            throw new Error('AI 元数据生成结果缺少 keywords 字段');
        }
        warnIfLengthOff(title, 12, 25, '标题');
        warnIfLengthOff(abstract, 60, 160, '摘要');
        return { title, abstract, keywords };
    } catch (error) {
        console.error('Generate meta failed:', error);
        throw error;
    }
}

export async function scaleText(text: string, mode: 'expand' | 'shrink'): Promise<string> {
    const action = mode === 'expand' ? '扩写' : '精简';
    const systemPrompt = `你是一名资深的船舶工程编辑，擅长${action}技术文档。

要求：
1. 只输出${action}后的正文本身，禁止输出任何解释、说明、寒暄或前后缀文字。
2. ${mode === 'expand' ? '扩写至原文的 1.5 倍左右' : '精简至原文的 50%-70%'}，不得丢失核心技术信息。
3. 保留专业术语、型号、数据与引用，不得虚构或篡改事实。
4. 保留原文的段落结构及 Markdown/HTML 格式（原文为纯文本时保持纯文本输出）。`;

    const userPrompt = `请${action}以下文本（只输出${action}后的正文）：\n\n${text}`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            reasoningEffort: 'low',
        });
        return cleanPlainTextResponse(rawText);
    } catch (error) {
        console.error(`[aiService] 文本${mode === 'expand' ? '扩写' : '精简'}失败:`, error);
        throw error;
    }
}

export async function generateTitleOnly(content: string): Promise<string> {
    const plainText = content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim().slice(0, 50000);
    const systemPrompt = `你是一个专业的船舶工程编辑助手。请为用户提供的文章拟定一个简短有力的标题。
要求：
- 字数：12 - 25 字
- 风格：干练、专业、有工程实战感
- 结构：核心技术名词 + 动词/应用场景/成效
- 禁止直接复制原文标题，必须重新提炼
- 只输出标题本身，不要加引号或多余文字`;
    const userPrompt = `文章内容如下：\n\n${plainText}`;

    const rawText = await callDeepSeekAPI({
        model: REASONER_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        reasoningEffort: 'low',
    });
    const title = cleanPlainTextResponse(rawText).trim().replace(/^["']|["']$/g, '');
    if (!title) {
        throw new Error('AI 标题生成结果为空');
    }
    warnIfLengthOff(title, 12, 25, '标题');
    return title;
}
