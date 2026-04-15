/**
 * AI 服务 - 通过 BFF 代理调用 DeepSeek API 进行文章总结
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 */

import { extractAbstractFromPdf } from '../src/services/pdf/index';

const REASONER_MODEL = 'deepseek-reasoner';
const CHAT_MODEL = 'deepseek-chat';
const API_URL = `/api/deepseek/generate`;
const PROXY_SECRET = import.meta.env.VITE_PROXY_SECRET || '';

const API_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

export type ProgressCallback = (stage: string, detail: string) => void;

interface DeepSeekMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface CallOptions {
    model?: string;
    messages: DeepSeekMessage[];
    max_tokens?: number;
    temperature?: number;
    timeoutMs?: number;
    retries?: number;
}

async function callDeepSeekAPI(options: CallOptions): Promise<string> {
    const {
        model = CHAT_MODEL,
        messages,
        max_tokens,
        temperature,
        timeoutMs = API_TIMEOUT_MS,
        retries = MAX_RETRIES,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log(`[aiService] API 调用 (尝试 ${attempt}/${retries}, 模型: ${model})...`);

            const body: Record<string, unknown> = { model, messages };
            if (max_tokens !== undefined) body.max_tokens = max_tokens;
            if (temperature !== undefined) body.temperature = temperature;

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sws-proxy-secret': PROXY_SECRET,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`AI 请求失败 (HTTP ${response.status}): ${errorText.substring(0, 200)}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('AI 服务返回内容为空');
            }

            console.log(`[aiService] API 调用成功 (尝试 ${attempt}/${retries})`);
            return content;

        } catch (error: any) {
            clearTimeout(timeoutId);
            lastError = error;

            const isAbort = error.name === 'AbortError';
            const is5xx = error.message?.includes('5') && error.message?.includes('HTTP');
            const is429 = error.message?.includes('429');
            const isRetryable = isAbort || is5xx || is429;

            if (!isRetryable || attempt >= retries) {
                console.error(`[aiService] API 调用最终失败 (${attempt}/${retries}):`, error.message);
                break;
            }

            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.warn(`[aiService] API 调用失败，${(delay / 1000).toFixed(1)}s 后重试... (${error.message})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('API 调用失败');
}

function extractJsonFromReasoning(text: string): string {
    text = text.replace(/<think[\s\S]*?<\/think>/g, '');

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        const firstBracket = text.indexOf('[');
        const lastBracket = text.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
            const arrStr = text.substring(firstBracket, lastBracket + 1);
            return arrStr.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        throw new Error('无法从 AI 响应中提取有效的 JSON 数据');
    }

    const jsonStr = text.substring(firstBrace, lastBrace + 1);
    return jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
}

function cleanPlainTextResponse(text: string): string {
    return text.replace(/<think[\s\S]*?<\/think>/g, '').trim();
}

function cleanHtmlResponse(text: string): string {
    return text.replace(/<think[\s\S]*?<\/think>/g, '').trim();
}

function robustJsonParse<T>(rawText: string, fallbackHeal?: (text: string) => string): T {
    const cleaned = extractJsonFromReasoning(rawText);

    try {
        return JSON.parse(cleaned) as T;
    } catch (_) {}

    const sanitized = cleaned
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/}\s*{/g, '},{');

    try {
        return JSON.parse(sanitized) as T;
    } catch (_) {}

    console.warn('[aiService] JSON 解析失败，尝试堆栈修复...');
    const healed = healJsonWithStack(cleaned);
    try {
        return JSON.parse(healed) as T;
    } catch (_) {}

    if (fallbackHeal) {
        console.warn('[aiService] 堆栈修复失败，尝试兜底修复...');
        try {
            return JSON.parse(fallbackHeal(cleaned)) as T;
        } catch (_) {}
    }

    throw new Error('JSON 解析失败：所有修复策略均无效');
}

function healJsonWithStack(text: string): string {
    let healed = text.trim();
    const quotesCount = (healed.match(/"/g) || []).length;
    if (quotesCount % 2 !== 0) healed += '"';

    healed = healed.replace(/[:,\s]+$/, '');

    const stack: string[] = [];
    for (let i = 0; i < healed.length; i++) {
        const char = healed[i];
        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) stack.pop();
        }
    }
    while (stack.length > 0) healed += stack.pop();

    if (!healed.startsWith('{')) {
        if (healed.includes('"links"') || healed.includes('"source"')) {
            healed = healed.startsWith('{') ? healed : '{' + (healed.startsWith('"links"') ? healed : '"links":' + (healed.startsWith('[') ? healed : '[' + healed + ']')) + '}';
        } else if (healed.includes('"nodes"') || healed.includes('"id"')) {
            healed = healed.startsWith('{') ? healed : '{' + (healed.startsWith('"nodes"') ? healed : '"nodes":' + (healed.startsWith('[') ? healed : '[' + healed + ']')) + '}';
        }
    }

    return healed;
}

export interface AIResult {
    title: string;
    abstract: string;
    keywords: string[];
}

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
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });
        return robustJsonParse<AIResult>(rawText);
    } catch (error) {
        console.error('Generate meta failed:', error);
        throw error;
    }
}

export async function scaleText(text: string, mode: 'expand' | 'shrink'): Promise<string> {
    const systemPrompt = mode === 'expand'
        ? `你是一名资深的船舶工程编辑，擅长扩写技术文档。请对用户提供的文本进行专业扩写。`
        : `你是一名资深的船舶工程编辑，擅长精简技术文档。请对用户提供的文本进行专业精简。`;

    const userPrompt = `请对以下文本进行 ${mode === 'expand' ? '扩写' : '精简'}：\n\n${text}`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });
        return cleanPlainTextResponse(rawText);
    } catch (error) {
        console.error(`[aiService] 文本${mode === 'expand' ? '扩写' : '精简'}失败:`, error);
        throw error;
    }
}

export interface KnowledgeNode {
    id: string;
    name: string;
    type: 'technology' | 'process' | 'material' | 'equipment' | 'concept';
    weight: number;
    description: string;
}

export interface KnowledgeLink {
    source: string;
    target: string;
    relationship: string;
    strength: number;
}

export interface KnowledgeGraphData {
    nodes: KnowledgeNode[];
    links: KnowledgeLink[];
}

export interface GraphQualityReport {
    nodeCount: number;
    linkCount: number;
    orphanNodeCount: number;
    orphanNodeNames: string[];
    typeDistribution: Record<string, number>;
    connectivityRatio: number;
    avgLinksPerNode: number;
    isValid: boolean;
    warnings: string[];
}

export function validateGraphQuality(data: KnowledgeGraphData): GraphQualityReport {
    const warnings: string[] = [];
    const nodeIds = new Set(data.nodes.map(n => n.id));

    const typeDistribution: Record<string, number> = {};
    for (const node of data.nodes) {
        typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
    }

    const validLinks = data.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    const linkedNodeIds = new Set<string>();
    for (const link of validLinks) {
        linkedNodeIds.add(link.source);
        linkedNodeIds.add(link.target);
    }

    const orphanNodes = data.nodes.filter(n => !linkedNodeIds.has(n.id));
    const orphanNodeNames = orphanNodes.map(n => n.name);

    const connectivityRatio = data.nodes.length > 0 ? linkedNodeIds.size / data.nodes.length : 0;
    const avgLinksPerNode = data.nodes.length > 0 ? validLinks.length / data.nodes.length : 0;

    if (data.nodes.length < 20) {
        warnings.push(`节点数量偏少 (${data.nodes.length})，建议至少 20 个以保证图谱丰富度`);
    }
    if (orphanNodes.length > data.nodes.length * 0.3) {
        warnings.push(`孤立节点占比过高 (${orphanNodes.length}/${data.nodes.length})，可能遗漏了部分关系`);
    }
    if (validLinks.length < data.nodes.length * 0.8) {
        warnings.push(`连线数量偏少 (${validLinks.length})，图谱可能不够连通`);
    }
    if (connectivityRatio < 0.6) {
        warnings.push(`连通率偏低 (${(connectivityRatio * 100).toFixed(0)}%)，建议补充关系`);
    }
    const types = Object.keys(typeDistribution);
    if (types.length < 3) {
        warnings.push(`节点类型单一 (仅 ${types.join(', ')})，覆盖面可能不足`);
    }

    const ghostLinks = data.links.length - validLinks.length;
    if (ghostLinks > 0) {
        warnings.push(`已过滤 ${ghostLinks} 条幽灵连线（引用了不存在的节点）`);
    }

    return {
        nodeCount: data.nodes.length,
        linkCount: validLinks.length,
        orphanNodeCount: orphanNodes.length,
        orphanNodeNames,
        typeDistribution,
        connectivityRatio,
        avgLinksPerNode,
        isValid: warnings.filter(w => !w.includes('已过滤')).length === 0,
        warnings,
    };
}

export async function extractGlobalKnowledgeGraph(
    articlesText: string,
    onProgress?: ProgressCallback
): Promise<KnowledgeGraphData> {
    const progress = onProgress || (() => {});

    progress('节点提取', '正在从全刊内容中提取核心技术节点 (约需 30-90 秒)...');

    const nodeSystemPrompt = `你是一名顶级船舶工程领域的知识图谱专家。从海工装备技术长文中提取核心节点。

【任务目标】
1. 深度覆盖：识别原文中最核心的技术概念、工法、材料与装备。
2. 节点规模：必须提取 35-45 个高质量节点，覆盖造船全生命周期（设计、加工、组装、舾装、涂装、交付）。
3. 输出要求：仅输出节点列表的 JSON 结构，不要输出任何其他文字。

【输出格式】严格输出以下 JSON（不要包裹在 markdown 代码块中）：
{"nodes": [{"id": "唯一英文ID", "name": "中文名称", "type": "枚举值", "weight": 1-10, "description": "15-30字专业描述"}]}
type 枚举值只能是: technology, process, material, equipment, concept`;

    const nodeUserPrompt = `请从以下文章内容中提取 35-45 个核心节点，不要输出连线(links)：\n\n${articlesText}`;

    try {
        const nodeRawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: nodeSystemPrompt },
                { role: 'user', content: nodeUserPrompt },
            ],
            max_tokens: 8192,
            timeoutMs: 180_000,
        });

        const nodesResult = robustJsonParse<{ nodes: KnowledgeNode[] }>(nodeRawText);

        if (!nodesResult.nodes || !Array.isArray(nodesResult.nodes) || nodesResult.nodes.length === 0) {
            throw new Error('未能识别到有效的 nodes 结构');
        }

        console.log(`[aiService] [阶段 1/3] 节点提取完成，获得 ${nodesResult.nodes.length} 个节点。`);
        progress('关系挖掘', `已提取 ${nodesResult.nodes.length} 个节点，正在挖掘节点间逻辑关系 (约需 30-90 秒)...`);

        const linkSystemPrompt = `你是一名顶级船舶工程领域的知识图谱专家。根据原文，构建已有节点之间的逻辑连线。

【挖掘准则】
1. 关系强度：深挖节点间的因果、依赖、优化、应用关系。
2. 关系规模：连线总数必须在节点数的 1.5 倍到 2 倍之间。
3. 流向控制：遵循工业传递链。concept/material -> process -> technology/equipment。
4. 输出要求：仅输出连线列表的 JSON 结构，不要输出任何其他文字。

【输出格式】严格输出以下 JSON（不要包裹在 markdown 代码块中）：
{"links": [{"source": "源节点ID", "target": "目标节点ID", "relationship": "关系动词", "strength": 1-5}]}
source 和 target 必须仅使用我提供给你的节点 ID 列表。`;

        const linkUserPrompt = `
【原文背景】
${articlesText.substring(0, 50000)}

【已确定的节点列表 (ID List)】
${nodesResult.nodes.map(n => n.id).join(', ')}

请为以上节点列表构建 ${Math.round(nodesResult.nodes.length * 1.5)}-${Math.round(nodesResult.nodes.length * 2)} 条逻辑连线，仅输出 links JSON 结构：`;

        const linkRawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: linkSystemPrompt },
                { role: 'user', content: linkUserPrompt },
            ],
            max_tokens: 8192,
            timeoutMs: 180_000,
        });

        const linksResult = robustJsonParse<{ links: KnowledgeLink[] }>(linkRawText);
        if (!linksResult.links) linksResult.links = [];

        console.log(`[aiService] [阶段 2/3] 关系挖掘完成，获得 ${linksResult.links.length} 条关系。`);

        const nodeIds = new Set(nodesResult.nodes.map(n => n.id));
        const finalData: KnowledgeGraphData = {
            nodes: nodesResult.nodes,
            links: linksResult.links.filter(l =>
                nodeIds.has(l.source) && nodeIds.has(l.target)
            ),
        };

        progress('质量校验', `图谱合成完成，正在进行质量校验...`);

        const qualityReport = validateGraphQuality(finalData);
        console.log('[aiService] 质量校验报告:', qualityReport);

        if (qualityReport.orphanNodeCount > 0 && qualityReport.connectivityRatio < 0.7) {
            console.log('[aiService] [阶段 3/3] 检测到较多孤立节点，启动补充关系挖掘...');
            progress('补充挖掘', `检测到 ${qualityReport.orphanNodeCount} 个孤立节点，正在补充关系...`);

            const supplementData = await supplementOrphanLinks(finalData, articlesText);
            finalData.links = [
                ...finalData.links,
                ...supplementData.links.filter(l =>
                    nodeIds.has(l.source) && nodeIds.has(l.target) &&
                    !finalData.links.some(existing =>
                        existing.source === l.source && existing.target === l.target
                    )
                ),
            ];

            const updatedReport = validateGraphQuality(finalData);
            console.log('[aiService] 补充后质量:', updatedReport);
        }

        console.log('[aiService] 知识图谱提取完成，最终节点:', finalData.nodes.length, '关系:', finalData.links.length);
        return finalData;

    } catch (error) {
        console.error('[aiService] 知识图谱提取失败:', error);
        throw error;
    }
}

async function supplementOrphanLinks(
    currentData: KnowledgeGraphData,
    articlesText: string
): Promise<{ links: KnowledgeLink[] }> {
    const linkedNodeIds = new Set<string>();
    for (const link of currentData.links) {
        linkedNodeIds.add(link.source);
        linkedNodeIds.add(link.target);
    }

    const orphanNodes = currentData.nodes.filter(n => !linkedNodeIds.has(n.id));
    if (orphanNodes.length === 0) return { links: [] };

    const orphanInfo = orphanNodes.map(n => `${n.id}(${n.name}, ${n.type})`).join(', ');

    const systemPrompt = `你是知识图谱专家。以下是一些孤立节点（没有任何连线），请根据原文背景和造船工程常识，为它们建立与已有节点的逻辑关系。

【输出格式】严格输出 JSON（不要包裹在 markdown 代码块中）：
{"links": [{"source": "节点ID", "target": "节点ID", "relationship": "关系动词", "strength": 1-5}]}`;

    const userPrompt = `
【原文背景】
${articlesText.substring(0, 30000)}

【孤立节点】
${orphanInfo}

【所有可用节点 ID】
${currentData.nodes.map(n => n.id).join(', ')}

请为孤立节点建立逻辑连线：`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 4096,
            timeoutMs: 120_000,
            retries: 2,
        });

        return robustJsonParse<{ links: KnowledgeLink[] }>(rawText);
    } catch (error) {
        console.warn('[aiService] 补充关系挖掘失败，跳过:', error);
        return { links: [] };
    }
}

export async function generateArticleSummary(content: string): Promise<string> {
    const res = await generateArticleMeta(content);
    return res.abstract;
}

export async function generateTitleOnly(content: string): Promise<string> {
    const plainText = content.replace(/<[^>]+>/g, '\n').slice(0, 50000);
    const systemPrompt = `你是一个专业的船舶工程编辑助手。请为用户提供的文章拟定一个专业的标题。`;
    const userPrompt = `文章内容如下：\n\n${plainText}`;

    const rawText = await callDeepSeekAPI({
        model: REASONER_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    });
    return cleanPlainTextResponse(rawText).trim().replace(/^["']|["']$/g, '');
}

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
            temperature: 0.1,
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

        const results: AiEvaluationResult[] = JSON.parse(content);
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
3. 语言风格：硬核、专业、干练。绝不要输出多余的寒暄语。`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `【论文标题】\n${article.title}\n\n【原始信息】\n${article.content}` },
            ],
            temperature: 0.3,
        });

        const cleanedText = cleanPlainTextResponse(rawText);
        console.log("[aiService] 学术文献深度编译成功");
        return cleanedText;
    } catch (error) {
        console.error("[aiService] 学术编译失败:", error);
        throw new Error("编译失败");
    }
}

export async function generateForeword(articlesSummary: string): Promise<string> {
    const systemPrompt = `你是一名资深的工程期刊主编，拥有 20 年海工装备行业经验。请根据提供的文章摘要列表，撰写本期期刊的卷首语（宏观导读）。

### 【撰写要求】
1. **定位与视角**：站在行业宏观高度，洞察本期文章的技术脉络与产业价值。
2. **结构层次**：
   - 开篇：点明本期核心主题与技术趋势
   - 中段：逐一点评各篇文章的亮点与创新（不要简单罗列，要有机串联）
   - 结尾：总结本期价值，展望行业未来发展
3. **语言风格**：专业但不晦涩，权威但不高冷。采用技术主编的口吻，既要有学术深度，又要有行业温度。
4. **字数控制**：约 500 字。
5. **输出格式**：必须输出完整的 HTML 片段，使用标准的 HTML 标签（如 <p>, <h3>, <strong> 等），确保可直接嵌入网页显示。

### 【输出格式示例】
<p>本期《海洋工程智能建造》聚焦于船舶制造领域的关键技术创新...</p>
<h3>一、焊接工艺的智能化突破</h3>
<p>在大型邮轮薄板激光复合焊方面...</p>
<p>...</p>`;

    const userPrompt = `请为以下文章摘要列表撰写卷首语：\n\n${articlesSummary}`;

    try {
        console.log('[aiService] 开始生成卷首语，摘要长度:', articlesSummary.length);

        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });

        const cleanedHtml = cleanHtmlResponse(rawText);
        console.log('[aiService] 卷首语生成成功，长度:', cleanedHtml.length);
        return cleanedHtml;
    } catch (error) {
        console.error('[aiService] 卷首语生成失败:', error);
        throw error;
    }
}

export async function buildSuperContextForGraph(articles: any[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装超级上下文...`);

    const allTexts: string[] = [];

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`[aiService] 处理第 ${i+1}/${articles.length} 篇: "${article.title}"`);

        if (article.content && article.content.trim().length > 10) {
            const plainText = article.content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim();
            allTexts.push(`【文章 ${i+1}】标题：${article.title}\n正文：${plainText.substring(0, 10000)}`);
            console.log(`[aiService]   使用正文内容，长度: ${plainText.length}`);
        }

        if (article.pdfData && article.pdfData.trim().length > 100) {
            console.log(`[aiService]   检测到 PDF 附件，开始静默抽字...`);
            try {
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('PDF 提取超时')), 10000)
                );

                const extractionPromise = extractAbstractFromPdf(article.pdfData, 5, 10000);
                const result = await Promise.race([extractionPromise, timeoutPromise]);

                if (result.success && result.fullText && result.fullText.trim().length > 50) {
                    allTexts.push(`【PDF附件 ${i+1}】标题：${article.title}\n原文：${result.fullText.substring(0, 15000)}`);
                    console.log(`[aiService]   PDF 抽字成功，提取 ${result.fullText.length} 字`);
                } else if (result.success && result.abstract) {
                    allTexts.push(`【PDF附件 ${i+1}】标题：${article.title}\n摘要：${result.abstract}`);
                    console.log(`[aiService]   使用 PDF 摘要`);
                } else {
                    console.warn(`[aiService]   PDF 提取失败: ${result.error}`);
                }
            } catch (pdfErr) {
                console.warn(`[aiService]   PDF 提取异常:`, pdfErr);
            }
        }

        if (article.abstract && article.abstract.trim().length > 10) {
            allTexts.push(`【摘要 ${i+1}】${article.abstract}`);
        }

        if (article.tags && Array.isArray(article.tags) && article.tags.length > 0) {
            allTexts.push(`【标签 ${i+1}】${article.tags.join(', ')}`);
        }

        allTexts.push('');
    }

    const combinedText = allTexts.join('\n\n');
    console.log(`[aiService] 超级上下文组装完成，总长度: ${combinedText.length}`);
    return combinedText;
}
