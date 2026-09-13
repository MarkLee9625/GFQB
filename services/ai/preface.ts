/**
 * AI 卷首语模块 - 导读上下文组装与卷首语 HTML 生成
 * 原 services/aiService.ts 对应部分原样迁移，行为不变
 */

import { extractAbstractFromPdf } from '../../src/services/pdf/index';
import {
    callDeepSeekAPI,
    cleanHtmlResponse,
    warnIfLengthOff,
    REASONER_MODEL,
    type ArticleContextInput,
} from './client';

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
        warnIfLengthOff(cleanedHtml.replace(/<[^>]+>/g, ''), 500, 1000, '卷首语正文');
        return cleanedHtml;
    } catch (error) {
        console.error('[aiService] 卷首语生成失败:', error);
        throw error;
    }
}

export async function buildForewordContext(articles: ArticleContextInput[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装导读上下文...`);
    // 上下文总量上限（deepseek-flash 上下文 1M，12 万字符安全），优先保证整刊文章覆盖完整
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
