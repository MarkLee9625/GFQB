/**
 * AI 传输层 - 通过 BFF 代理调用 DeepSeek API（含超时/重试/截断与 JSON 容错解析）
 * 注意：API Key 已从客户端移除，通过后端代理进行安全转发
 * 默认模型 deepseek-flash
 */

import type { Article } from '../../src/types';

/** AI 上下文组装所需的文章字段子集（替代 any[]，字段拼写错误在编译期暴露） */
export type ArticleContextInput = Pick<Article, 'id' | 'title' | 'content' | 'abstract' | 'tags' | 'pdfData'>;

export const REASONER_MODEL = 'deepseek-flash';
export const CHAT_MODEL = 'deepseek-flash';
export const API_URL = `/api/deepseek/generate`;

export const API_TIMEOUT_MS = 120_000;
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 2000;
export const GRAPH_TIMEOUT_SINGLE = 600_000;

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

export async function callDeepSeekAPI(options: CallOptions): Promise<string> {
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

export function extractJsonFromReasoning(text: string): string {
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

export function cleanPlainTextResponse(text: string): string {
    return text.replace(/<think[\s\S]*?<\/think>/g, '').trim();
}

export function cleanHtmlResponse(text: string): string {
    // 卷首语要求"直接输出 HTML 片段"：模型偶发用 ```html 围栏包裹，嵌入页面会原样显示围栏文本，必须脱除
    return text
        .replace(/<think[\s\S]*?<\/think>/g, '')
        .replace(/```html\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
}

/**
 * 字数 sanity 告警：只提示不阻断，用于发现提示词要求与模型实际输出的漂移。
 * 按 Unicode 码点计数（中文按字计）。生产构建会 drop console，仅开发期可见。
 */
export function warnIfLengthOff(text: string, min: number, max: number, label: string): void {
    const len = [...text].length;
    if (len < min || len > max) {
        console.warn(`[aiService] ${label}长度 ${len} 字超出期望区间 ${min}-${max} 字`);
    }
}

export function robustJsonParse<T>(rawText: string, fallbackHeal?: (text: string) => string): T {
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
