/**
 * AI 评审模块 - 选题批量评审与学术文献编译
 * 原 services/aiService.ts 对应部分原样迁移，行为不变
 */

import { callDeepSeekAPI, cleanPlainTextResponse, warnIfLengthOff, REASONER_MODEL } from './client';

export interface AiEvaluationResult {
    id: string;
    aiSummary: string;
    decision: 'recommend' | 'reject';
    reason: string;
    tags: string[];
}

export async function batchEvaluateArticles(
    articlesToEvaluate: { id: string; title: string; content: string }[]
): Promise<AiEvaluationResult[]> {
    if (!articlesToEvaluate.length) return [];

    const inputData = JSON.stringify(articlesToEvaluate.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content.replace(/[#*\[\]!>]/g, '').replace(/\s+/g, ' ').substring(0, 3000)
    })));

    const systemPrompt = `你是一位拥有20年经验的顶级船舶制造总工和《工法情报》期刊总编。 我将给你一批微信公众号文章的纯文本内容。请你认真阅读每篇文章的核心内容。

【收录标准】必须严格符合以下至少一项：
1. 涂装、舾装、吊装工艺与技术 2. 船舶建造核心工法 3. 国内外船厂的先进工艺实践或前沿工艺 4. 实际造船中采用的先进装备或工艺 5. 智能船舶与绿色船舶技术 6. 智能制造系统与造船机器人

【坚决淘汰】以下水文或非技术文章：
领导视察、会议纪要、党建活动、人事任命、公司获奖通报、行业宏观政策泛泛而谈等。

【输出要求】
请对输入数组中的**每一篇**文章逐篇评审，返回与输入**相同数量**的 JSON 对象，不要遗漏任何一篇，也不要合并多篇。
请严格输出一个 JSON 数组。数组中的每个对象必须包含：
- "id": 对应输入文章的 id
- "aiSummary": 你提炼该文章核心技术摘要（50字左右，必须客观精炼）
- "tags": 提取 2-3 个核心技术关键词标签（如 ["吊装工艺", "爬壁机器人"]）
- "decision": 结合摘要和标准，给出 "recommend" 或 "reject"
- "reason": 15字以内，说明为什么推荐或淘汰

千万不要输出 Markdown 代码块，直接返回纯正的 JSON 数组。`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `请评审以下文章：\n${inputData}` },
            ],
            reasoningEffort: 'low',
        });

        let content = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        content = content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]+/g, "");

        if (content.startsWith('{') && content.endsWith('}')) {
            content = content.replace(/}\s*{/g, '},{');
            content = `[${content}]`;
        }

        const firstBracket = content.indexOf('[');
        const lastBracket = content.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            content = content.substring(firstBracket, lastBracket + 1);
        }

        content = content.replace(/,\s*([}\]])/g, '$1');

        const parsed: AiEvaluationResult[] = JSON.parse(content);

        // 解析后轻量校验：decision 枚举归一、按 id 去重、非法条目剔除；缺篇仅告警不阻塞
        const VALID_DECISIONS: ReadonlySet<string> = new Set(['recommend', 'reject']);
        const seenIds = new Set<string>();
        const results: AiEvaluationResult[] = [];
        for (const item of parsed) {
            if (!item || !item.id) continue;
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            results.push({
                id: item.id,
                aiSummary: String(item.aiSummary ?? '').trim(),
                decision: VALID_DECISIONS.has(item.decision) ? item.decision : 'reject',
                reason: String(item.reason ?? '').trim(),
                tags: Array.isArray(item.tags)
                    ? [...new Set(item.tags.map(t => String(t).trim()).filter(Boolean))].slice(0, 5)
                    : [],
            });
        }

        const missingIds = articlesToEvaluate.map(a => a.id).filter(id => !seenIds.has(id));
        if (missingIds.length > 0) {
            console.warn(`[aiService] AI 评审缺篇 ${missingIds.length} 篇，未返回结果:`, missingIds);
        }
        console.log('[aiService] AI 批量评审成功，结果数:', results.length);
        return results;
    } catch (error) {
        console.error('[aiService] AI 批量评审失败:', error);
        throw new Error('AI 评审解析失败，请重试');
    }
}

export async function translateAndFormatAcademic(article: { title: string, content: string }): Promise<string> {
    console.log("[aiService] 启动学术文献深度编译...");

    const systemPrompt = `你是一位拥有20年经验的顶级船舶制造总工和《工法情报》期刊总编。 请将下面这篇英文学术论文（包含期刊来源和摘要）翻译并重写为一篇适合中文读者阅读的专业《工法情报》推文正文。
【排版要求】
1. 必须使用 Markdown 格式排版。
2. 必须包含以下三个核心模块：
   - 🏆 **文献来源** (提取传入文本中的期刊、作者、引用量等硬核信息)
   - 💡 **核心工法解析** (将英文摘要翻译为通顺、专业的中文工程描述，切忌机翻味)
   - 🚀 **应用前景分析** (作为总编，用1段话专业点评该技术在实际造船厂中的潜在应用价值)
3. 语言风格：硬核、专业、干练。绝不要输出多余的寒暄语。
4. 输出约束：直接输出编译后的正文本身，禁止输出任何解释性前言或后记；正文长度控制在 800-1500 字。`;

    // 思考模式下 temperature 不生效，故不传该参数；输入截断至 3 万字控制成本
    const contentText = article.content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim().slice(0, 30000);

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `【论文标题】\n${article.title}\n\n【原始信息】\n${contentText}` },
            ],
            reasoningEffort: 'low',
        });

        const cleanedText = cleanPlainTextResponse(rawText);
        console.log("[aiService] 学术文献深度编译成功");
        warnIfLengthOff(cleanedText, 600, 2000, '学术编译正文');
        return cleanedText;
    } catch (error) {
        console.error("[aiService] 学术编译失败:", error);
        throw new Error("编译失败");
    }
}
