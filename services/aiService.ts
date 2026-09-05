/**
 * AI 服务 - 通过 BFF 代理调用 DeepSeek API 进行文章总结
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 */

import { extractAbstractFromPdf } from '../src/services/pdf/index';
import type { Article } from '../src/types';

/** AI 上下文组装所需的文章字段子集（替代 any[]，字段拼写错误在编译期暴露） */
export type ArticleContextInput = Pick<Article, 'id' | 'title' | 'content' | 'abstract' | 'tags' | 'pdfData'>;

const REASONER_MODEL = 'deepseek-v4-flash';
const CHAT_MODEL = 'deepseek-v4-flash';
const API_URL = `/api/deepseek/generate`;

const API_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const GRAPH_TIMEOUT_SINGLE = 600_000;

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
    /** 推理强度分级：简单任务（标题/扩写/翻译）传 'low' 控制推理 token 成本 */
    reasoningEffort?: 'low' | 'medium' | 'max';
}

async function callDeepSeekAPI(options: CallOptions): Promise<string> {
    const {
        model = CHAT_MODEL,
        messages,
        max_tokens,
        temperature,
        timeoutMs = API_TIMEOUT_MS,
        retries = MAX_RETRIES,
        reasoningEffort = 'max',
    } = options;

    let lastError: Error | null = null;
    let effectiveMaxTokens = max_tokens;
    let effectiveMessages = messages;
    let isEmptyContent = false;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        // 无参 abort：带 reason 的 abort 会让 fetch 以该 Error 拒绝（name 为 'Error'），
        // 导致下方 isAbort 恒为 false，超时重试逻辑永远不触发
        let timedOut = false;
        const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

        if (attempt > 1 && isEmptyContent) {
            effectiveMaxTokens = Math.min(Math.round((effectiveMaxTokens || 16384) * 1.5), 131072);
            console.warn(`[aiService] content 为空重试，max_tokens 提升至 ${effectiveMaxTokens}`);
        }

        if (attempt > 1 && lastError?.name === 'AbortError') {
            effectiveMessages = effectiveMessages.map(m => {
                if (m.content.length > 50000) {
                    return { ...m, content: m.content.substring(0, Math.floor(m.content.length * 0.75)) + '\n\n[内容已截断...]' };
                }
                return m;
            });
            console.warn('[aiService] 超时重试，上下文截断至 75%');
        }

        try {
            console.log(`[aiService] API 调用 (尝试 ${attempt}/${retries}, 模型: ${model})...`);

            const body: Record<string, unknown> = { model, messages: effectiveMessages };
            if (effectiveMaxTokens !== undefined) body.max_tokens = effectiveMaxTokens;
            if (temperature !== undefined) body.temperature = temperature;
            body.reasoning_effort = reasoningEffort;
            // DeepSeek V4 思考模式：须为请求体顶层 thinking 字段（extra_body 仅为 OpenAI SDK 概念，
            // 原始 fetch 直连时会被上游忽略）。轻任务（reasoningEffort='low'）关闭思考以控制推理成本。
            if (reasoningEffort !== 'low') {
                body.thinking = { type: 'enabled' };
            }

            // 不发送 x-sws-proxy-secret：secret 仅由 Vite 开发代理/BFF 同源校验注入，
            // 客户端携带会把密钥打进 bundle（VITE_ 前缀变量会被 Vite 暴露）
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`AI 请求失败 (HTTP ${response.status}): ${errorText.substring(0, 200)}`);
            }

            let data;
            try {
                data = await response.json();
            } catch (parseErr) {
                throw new Error('AI 服务返回了无效的 JSON 响应');
            }

            const message = data.choices?.[0]?.message;
            let content = message?.content;

            // DeepSeek Reasoner 模型：当 content 为空时，从 reasoning_content 提取
            if (!content && message?.reasoning_content) {
                console.warn(`[aiService] content 为空，尝试从 reasoning_content 提取（finish_reason: ${data.choices[0].finish_reason}）`);
                content = message.reasoning_content;
            }

            if (!content) {
                const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
                const usage = data.usage ? `usage: ${JSON.stringify(data.usage)}` : '无 usage 信息';
                throw new Error(`AI 服务返回内容为空（finish_reason: ${finishReason}, ${usage}）`);
            }

            console.log(`[aiService] API 调用成功 (尝试 ${attempt}/${retries})`);
            return content;

        } catch (error: unknown) {
            clearTimeout(timeoutId);
            const err = error instanceof Error ? error : new Error(String(error));
            lastError = err;

            const isAbort = err.name === 'AbortError';
            const is5xx = /HTTP 5\d{2}/.test(err.message || '');
            const is429 = err.message.includes('429');
            isEmptyContent = err.message.includes('AI 服务返回内容为空');
            const isRetryable = isAbort || is5xx || is429 || isEmptyContent;

            if (!isRetryable || attempt >= retries) {
                console.error(`[aiService] API 调用最终失败 (${attempt}/${retries}):`, err.message);
                if (isAbort && timedOut) {
                    lastError = new Error(`AI 请求超时 (${timeoutMs / 1000}s)`);
                }
                break;
            }

            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.warn(`[aiService] API 调用失败，${(delay / 1000).toFixed(1)}s 后重试... (${err.message})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('API 调用失败');
}

function extractJsonFromReasoning(text: string): string {
    // 先剥离 think 标签和 markdown 代码块标记
    let cleaned = text.replace(/<think[\s\S]*?<\/think>/g, '')
                     .replace(/```json\s*/g, '')
                     .replace(/```\s*/g, '')
                     .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }

    // 无包裹对象，尝试提取数组
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
        return cleaned.substring(firstBracket, lastBracket + 1);
    }

    throw new Error('无法从 AI 响应中提取有效的 JSON 数据');
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

    progress('知识图谱生成', '正在从全刊内容中一次性提取节点与关系 (约需 30-90 秒)...');

    const systemPrompt = `你是船舶海洋工程领域的资深技术专家。请一次性完成知识图谱的完整构建（节点 + 关系），不要分步回答。

【节点命名规范 ★最重要】
  name 必须是具体的、独一无二的技术实体名称，长度 2-12 字。
  ✅ 正确示例：船体焊接、舾装件标准化设计、激光复合焊、涂装防腐、分段吊装、压载水处理、LNG动力系统、爬壁机器人、数字孪生、总装精度控制
  ❌ 绝对禁止：技术、工艺、材料、设备、理念、概念、方法、系统 等万能通用词
  ❌ 同样禁止：焊接技术、涂装工艺、材料特性 等"X+类型名"的偷懒命名
  规则：name 中不得包含 type 字段的值

【节点数量与类型】
  提取 35-50 个节点。type 字段独立于 name：
  - technology(技术): 如"激光复合焊"
  - process(工艺): 如"分段涂装"
  - material(材料): 如"高强钢"
  - equipment(设备): 如"爬壁机器人"
  - concept(概念): 如"模块化设计"
  weight: 1-10 (9-10=核心主题, 7-8=关键支撑, 5-6=常规, 3-4=辅助, 1-2=边缘)
  ID: 纯英文小写+下划线，≤30字符，**必须全局唯一**（重复 id 会导致节点被丢弃）

【关系 ★必须包含，且数量不少于节点数×2.5】
  遵循 concept/material→process→technology/equipment 传递链。
  每个节点至少 2 条连线，孤立节点不可接受。
  links 的 source/target 必须引用 nodes 中已存在的 id，禁止使用未定义的 id。
  动词: 驱动/支撑/决定/控制/主导/影响/制约/应用于/服务于/实现/配套于/包含/属于/组成/依赖/基于/协同
  strength: 1-5 (5=强因果/直接依赖, 1=弱关联)

【输出格式】严格 JSON，无 markdown 包裹，一次性输出 nodes 和 links：
{"nodes":[{"id":"hull_welding","name":"船体焊接","type":"process","weight":8,"description":"船体结构焊接工艺"}],"links":[{"source":"hull_welding","target":"high_strength_steel","relationship":"依赖","strength":4}]}`;

    const userPrompt = `从以下内容一次性提取 35-50 个核心节点及关系（links 必须 ≥ 节点数×2.5）：\n\n${articlesText}`;

    try {
    let nodesResult: { nodes: KnowledgeNode[]; links?: KnowledgeLink[] } | null = null;
    let nodeRawText = '';
    const NODE_MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= NODE_MAX_RETRIES; attempt++) {
        try {
            nodeRawText = await callDeepSeekAPI({
                model: REASONER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                timeoutMs: GRAPH_TIMEOUT_SINGLE,
            });

            nodesResult = robustJsonParse<{ nodes: KnowledgeNode[]; links?: KnowledgeLink[] }>(nodeRawText);

            if (!nodesResult.nodes || !Array.isArray(nodesResult.nodes) || nodesResult.nodes.length === 0) {
                throw new Error('未能识别到有效的 nodes 结构');
            }
            break; // 成功则跳出重试循环
        } catch (err: unknown) {
            if (attempt < NODE_MAX_RETRIES) {
                console.warn(`[aiService] Phase 1 解析失败 (尝试 ${attempt}/${NODE_MAX_RETRIES})，准备重试:`, err instanceof Error ? err.message : String(err));
                continue;
            }
            throw err; // 最后一次失败则向外抛出
        }
    }

    if (!nodesResult) throw new Error('Phase 1: 所有重试均未能获取有效节点');
    const initialLinks: KnowledgeLink[] = Array.isArray(nodesResult.links) ? nodesResult.links : [];

        const VALID_TYPES = new Set(['technology', 'process', 'material', 'equipment', 'concept']);
        const TYPE_ALIASES: Record<string, string> = {
            technique: 'technology', method: 'process', tech: 'technology',
            material_type: 'material', equip: 'equipment', tool: 'equipment',
            concept_type: 'concept', theory: 'concept', principle: 'concept',
            procedure: 'process', step: 'process', operation: 'process',
            device: 'equipment', system: 'equipment', facility: 'equipment',
            substance: 'material', alloy: 'material', coating: 'material',
        };

        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        // 通用词黑名单：禁止 AI 将类型标签偷懒用作节点名
        const GENERIC_NAME_PATTERNS = [
          /^技术$/, /^工艺$/, /^材料$/, /^设备$/, /^理念$/, /^概念$/, /^方法$/, /^系统$/,
          /^technology$/i, /^process$/i, /^material$/i, /^equipment$/i, /^concept$/i,
          /^.{0,2}(技术|工艺|材料|设备|理念|概念|方法|系统)$/, // "X技术""XX工艺"等偷懒命名
        ];
        function isGenericName(name: string): boolean {
          if (!name || name.length <= 1) return true;
          return GENERIC_NAME_PATTERNS.some(p => p.test(name));
        }
        let genericFilteredCount = 0;
        nodesResult.nodes = nodesResult.nodes.filter(node => {
            if (!node.id || !node.name) return false;
            node.id = String(node.id).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            if (!node.id || node.id.length < 1) return false;
            if (seenIds.has(node.id)) return false;
            seenIds.add(node.id);
            if (seenNames.has(node.name)) return false;
            if (isGenericName(node.name)) { genericFilteredCount++; return false; }
            seenNames.add(node.name);
            const normalizedType = (node.type || '').toLowerCase().trim();
            node.type = (VALID_TYPES.has(normalizedType) ? normalizedType : (TYPE_ALIASES[normalizedType] || 'concept')) as KnowledgeNode['type'];
            node.weight = Math.max(1, Math.min(10, Math.round(Number(node.weight) || 5)));
            node.description = (node.description || node.name).substring(0, 80);
            return true;
        });

        if (genericFilteredCount > 0) {
          console.log(`[aiService] [安检] 过滤了 ${genericFilteredCount} 个通用词节点（如"技术""工艺"等偷懒命名）`);
        }
        console.log(`[aiService] 图谱生成完成，获得 ${nodesResult.nodes.length} 个节点，${initialLinks.length} 条关系（清洗后）。`);
        progress('处理中', `已提取 ${nodesResult.nodes.length} 个节点和 ${initialLinks.length} 条关系...`);

        const allLinks: KnowledgeLink[] = initialLinks.filter(l => {
            if (!l.source || !l.target || l.source === l.target) return false;
            l.source = String(l.source).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            l.target = String(l.target).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            const strongRels = ['驱动', '支撑', '决定', '转化', '依赖', '控制', '主导'];
            const weakRels = ['关联', '涉及', '相关', '包含', '具有'];
            const rel = l.relationship || '关联';
            if (strongRels.some(r => rel.includes(r))) {
                l.strength = Math.max(1, Math.min(5, Math.round(Number(l.strength) || 4)));
            } else if (weakRels.some(r => rel.includes(r))) {
                l.strength = Math.max(1, Math.min(5, Math.round(Number(l.strength) || 2)));
            } else {
                l.strength = Math.max(1, Math.min(5, Math.round(Number(l.strength) || 3)));
            }
            l.relationship = rel.substring(0, 20);
            return l.source !== l.target;
        });

        const nodeIds = new Set(nodesResult.nodes.map(n => n.id));
        const finalData: KnowledgeGraphData = {
            nodes: nodesResult.nodes,
            links: allLinks.filter(l =>
                nodeIds.has(l.source) && nodeIds.has(l.target)
            ),
        };

        progress('质量校验', `图谱合成完成，正在进行质量校验...`);

        const qualityReport = validateGraphQuality(finalData);
        console.log('[aiService] 质量校验报告:', qualityReport);

        // 规则兜底：孤立节点用同类型最近节点连接
        if (qualityReport.orphanNodeCount > 0) {
            console.log(`[aiService] 检测到 ${qualityReport.orphanNodeCount} 个孤立节点，规则兜底...`);
            const fallbackLinks = generateFallbackLinks(finalData);
            finalData.links = [...finalData.links, ...fallbackLinks];
            const updatedReport = validateGraphQuality(finalData);
            console.log('[aiService] 兜底后质量:', updatedReport);
        }

        console.log('[aiService] 知识图谱提取完成（单次调用），最终节点:', finalData.nodes.length, '关系:', finalData.links.length);
        return finalData;

    } catch (error) {
        console.error('[aiService] 知识图谱提取失败:', error);
        throw error;
    }
}

/* ========== 辅助函数 ========== */

function generateFallbackLinks(currentData: KnowledgeGraphData): KnowledgeLink[] {
    const linkedNodeIds = new Set<string>();
    for (const link of currentData.links) {
        linkedNodeIds.add(link.source);
        linkedNodeIds.add(link.target);
    }
    const orphanNodes = currentData.nodes.filter(n => !linkedNodeIds.has(n.id));
    if (orphanNodes.length === 0) return [];

    const fallbackLinks: KnowledgeLink[] = [];
    const processNodes = currentData.nodes.filter(n => n.type === 'process');
    const techNodes = currentData.nodes.filter(n => n.type === 'technology');
    const materialNodes = currentData.nodes.filter(n => n.type === 'material');


    for (const orphan of orphanNodes) {
        const usedTargetIds = new Set<string>();

        if (orphan.type === 'concept' || orphan.type === 'material') {
            const relationship = orphan.type === 'material' ? '用于' : '指导';
            const candidates = processNodes.filter(p => p.id !== orphan.id && !fallbackLinks.some(l => l.source === orphan.id && l.target === p.id));
            candidates.slice(0, 2).forEach((target, idx) => {
                fallbackLinks.push({ source: orphan.id, target: target.id, relationship: idx === 0 ? relationship : '配合', strength: 3 - idx });
                usedTargetIds.add(target.id);
            });
        } else if (orphan.type === 'process') {
            const candidates = techNodes.filter(t => t.id !== orphan.id && !fallbackLinks.some(l => l.source === t.id && l.target === orphan.id));
            candidates.slice(0, 2).forEach((target, idx) => {
                fallbackLinks.push({ source: target.id, target: orphan.id, relationship: idx === 0 ? '实现' : '支撑', strength: 3 - idx });
                usedTargetIds.add(target.id);
            });
            // 如果还没有连线，再尝试连 material
            if (usedTargetIds.size === 0) {
                const mCandidates = materialNodes.filter(m => m.id !== orphan.id && !fallbackLinks.some(l => l.source === m.id && l.target === orphan.id));
                if (mCandidates.length > 0) {
                    fallbackLinks.push({ source: mCandidates[0].id, target: orphan.id, relationship: '用于', strength: 2 });
                }
            }
        } else if (orphan.type === 'equipment') {
            const candidates = processNodes.filter(p => p.id !== orphan.id && !fallbackLinks.some(l => l.source === orphan.id && l.target === p.id));
            candidates.slice(0, 2).forEach((target, idx) => {
                fallbackLinks.push({ source: orphan.id, target: target.id, relationship: idx === 0 ? '服务于' : '配套于', strength: 3 - idx });
                usedTargetIds.add(target.id);
            });
        } else {
            // technology 或其他类型
            const candidates = processNodes.filter(p => p.id !== orphan.id && !fallbackLinks.some(l => l.source === orphan.id && l.target === p.id));
            if (candidates.length > 0) {
                fallbackLinks.push({ source: orphan.id, target: candidates[0].id, relationship: '应用于', strength: 2 });
            }
        }
    }
    return fallbackLinks;
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
    return title;
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
        return cleanedText;
    } catch (error) {
        console.error("[aiService] 学术编译失败:", error);
        throw new Error("编译失败");
    }
}

export async function generateForeword(articles: ArticleContextInput[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装导读上下文...`);
    const articlesContext = await buildForewordContext(articles);
    console.log('[aiService] 导读上下文组装完成，总长度:', articlesContext.length);

    const systemPrompt = `你是一名资深的工程期刊主编，拥有 20 年海工装备行业经验。请根据提供的文章全文信息，撰写本期期刊的卷首语（宏观导读）。

### 【撰写要求】
1. **定位与视角**：站在行业宏观高度，洞察本期文章的技术脉络与产业价值。
2. **基于原文**：请基于提供的原文技术细节进行点评，引用文章中的具体技术关键词、工艺名称或数据来增强说服力，避免空泛的学术化描述。
3. **结构层次**：
   - 开篇：点明本期核心主题与技术趋势
   - 中段：逐一点评各篇文章的亮点与创新（不要简单罗列，要有机串联）
   - 结尾：总结本期价值，展望行业未来发展
4. **语言风格**：专业但不晦涩，权威但不高冷。采用技术主编的口吻，既要有学术深度，又要有行业温度。
5. **字数控制**：600-800 字。
6. **输出格式**：必须输出完整的 HTML 片段，使用标准的 HTML 标签（如 <p>, <h3>, <strong> 等），确保可直接嵌入网页显示。
7. **输出方式**：直接输出 HTML 片段本身，禁止使用 Markdown 代码块（如 \`\`\`html）包裹，禁止输出任何解释性前后缀文字。

### 【输出格式示例】
<p>本期《海洋工程智能建造》聚焦于船舶制造领域的关键技术创新...</p>
<h3>一、焊接工艺的智能化突破</h3>
<p>在大型邮轮薄板激光复合焊方面...</p>
<p>...</p>`;

    const userPrompt = `请为以下文章撰写卷首语：\n\n${articlesContext}`;

    try {
        const rawText = await callDeepSeekAPI({
            model: REASONER_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 8192,
        });

        const cleanedHtml = cleanHtmlResponse(rawText);
        console.log('[aiService] 卷首语生成成功，长度:', cleanedHtml.length);
        return cleanedHtml;
    } catch (error) {
        console.error('[aiService] 卷首语生成失败:', error);
        throw error;
    }
}

export async function buildForewordContext(articles: ArticleContextInput[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装导读上下文...`);
    // 上下文总量上限（deepseek-v4-flash 上下文 1M，12 万字符安全），优先保证整刊文章覆盖完整
    const MAX_CONTEXT_LENGTH = 120000;
    const allTexts: string[] = [];
    let totalLength = 0;

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        let articleText = `【文章 ${i+1}】\n标题：${article.title}\n`;

        if (article.abstract && article.abstract.trim().length > 10) {
            articleText += `摘要：${article.abstract}\n`;
        }
        if (article.tags && Array.isArray(article.tags) && article.tags.length > 0) {
            articleText += `标签：${article.tags.join(', ')}\n`;
        }

        if (article.content && article.content.trim().length > 10) {
            const plainText = article.content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim();
            articleText += `正文：${plainText.substring(0, 15000)}\n`;
            console.log(`[aiService]   第${i+1}篇正文，提取 ${Math.min(plainText.length, 15000)} 字`);
        }

        if (article.pdfData && article.pdfData.trim().length > 100) {
            try {
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('PDF 提取超时')), 10000)
                );
                const extractionPromise = extractAbstractFromPdf(article.pdfData, 5, 10000);
                const result = await Promise.race([extractionPromise, timeoutPromise]);
                if (result.success && result.fullText && result.fullText.trim().length > 50) {
                    articleText += `PDF原文：${result.fullText.substring(0, 20000)}\n`;
                    console.log(`[aiService]   第${i+1}篇PDF，提取 ${Math.min(result.fullText.length, 20000)} 字`);
                } else if (result.success && result.abstract) {
                    articleText += `PDF摘要：${result.abstract}\n`;
                    console.log(`[aiService]   第${i+1}篇PDF摘要`);
                }
            } catch (pdfErr) {
                console.warn(`[aiService]   第${i+1}篇PDF 提取失败:`, pdfErr);
            }
        }

        allTexts.push(articleText);
        totalLength += articleText.length;

        if (totalLength >= MAX_CONTEXT_LENGTH) {
            console.warn(`[aiService] 导读上下文已达上限 ${MAX_CONTEXT_LENGTH} 字符，停止组装后续 ${articles.length - 1 - i} 篇文章`);
            break;
        }
    }

    const combinedText = allTexts.join('\n\n');
    console.log(`[aiService] 导读上下文组装完成，总长度: ${combinedText.length}`);
    return combinedText;
}

export async function buildSuperContextForGraph(articles: ArticleContextInput[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装超级上下文...`);

    const allTexts: string[] = [];
    const pdfTasks: { index: number; title: string; data: string }[] = [];

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`[aiService] 处理第 ${i+1}/${articles.length} 篇: "${article.title}"`);

        if (article.content && article.content.trim().length > 10) {
            const plainText = article.content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim();
            allTexts.push(`【文章 ${i+1}】${article.title}\n${plainText.substring(0, 15000)}`);
        } else if (article.abstract && article.abstract.trim().length > 10) {
            allTexts.push(`【文章 ${i+1}】${article.title}\n${article.abstract.substring(0, 5000)}`);
        }

        // 仅登记 PDF 任务参数（真正提取在下方分批启动，避免任务创建即并发导致 OOM）
        const pdfData = article.pdfData;
        if (pdfData && pdfData.trim().length > 100) {
            pdfTasks.push({ index: i, title: article.title, data: pdfData });
        }
    }

    // 分批并发提取 PDF（每批 4 个，真实限制同时进行的提取数）
    if (pdfTasks.length > 0) {
        const PDF_CONCURRENCY = 4;
        console.log(`[aiService] 等待 ${pdfTasks.length} 个 PDF 分批提取（每批 ${PDF_CONCURRENCY} 个）...`);
        for (let batchStart = 0; batchStart < pdfTasks.length; batchStart += PDF_CONCURRENCY) {
            const batch = pdfTasks.slice(batchStart, batchStart + PDF_CONCURRENCY);
            await Promise.allSettled(
                batch.map(async ({ index, title, data }) => {
                    console.log(`[aiService]   检测到 PDF 附件 #${index + 1}，开始静默抽字...`);
                    try {
                        const result = await extractAbstractFromPdf(data, 5, 20000);
                        if (result.success && result.fullText && result.fullText.trim().length > 50) {
                            allTexts.push(`【PDF ${index + 1}】${title}\n${result.fullText.substring(0, 20000)}`);
                            console.log(`[aiService]   PDF #${index + 1} 抽字成功，提取 ${result.fullText.length} 字`);
                        }
                    } catch (pdfErr) {
                        console.warn(`[aiService]   PDF #${index + 1} 提取异常:`, pdfErr);
                    }
                })
            );
        }
    }

    const combinedText = allTexts.join('\n\n');
    console.log(`[aiService] 超级上下文组装完成，总长度: ${combinedText.length}`);
    return combinedText;
}
