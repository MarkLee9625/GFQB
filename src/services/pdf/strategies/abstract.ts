/**
 * 摘要提取策略模块
 */

/**
 * 兜底策略：取第一段看起来像正文的段落
 */
export function extractFirstMeaningfulParagraph(text: string): string | null {
    const paragraphs = text.split(/\n+/);
    for (const p of paragraphs) {
        const cleanP = p.replace(/\s+/g, '').trim();
        // 筛选条件：长度80-800字，且不是纯大写(标题)
        if (cleanP.length > 80 && cleanP.length < 800) {
            if (cleanP.length < 200 && /^[A-Z\s]+$/.test(p.trim())) continue;
            return p.trim().replace(/\s+/g, ' ').substring(0, 500);
        }
    }
    return null;
}

/**
 * 寻找摘要主逻辑
 */
export function findAbstractInText(text: string): string | null {
    if (!text) return null;

    // 1. 预处理
    const cleanText = text
        .replace(/[\u3000]/g, ' ')
        .replace(/\s+/g, ' ');

    // 2. 匹配模式
    const startPatterns = [
        { regex: /(?:摘|内\s*容\s*提)\s*要[:：]?/g, weight: 10 },
        { regex: /abstract[:：]?/gi, weight: 8 },
        { regex: /概\s*要[:：]?/g, weight: 6 }
    ];

    let bestStartIdx = -1;
    let maxWeight = -1;
    let usedPatternLen = 0;

    for (const pattern of startPatterns) {
        let match;
        pattern.regex.lastIndex = 0;
        while ((match = pattern.regex.exec(cleanText)) !== null) {
            const idx = match.index;
            if (idx > 3000) continue;
            const lookAhead = cleanText.slice(idx, idx + 50);
            if (/(\.{3,}|…{3,})\s*\d+/.test(lookAhead)) continue; // 排除目录

            if (pattern.weight > maxWeight) {
                maxWeight = pattern.weight;
                bestStartIdx = idx;
                usedPatternLen = match[0].length;
                if (bestStartIdx < 500 && maxWeight === 10) break;
            }
        }
    }

    if (bestStartIdx === -1) return extractFirstMeaningfulParagraph(text);

    // 3. 确定起止
    let contentStart = bestStartIdx + usedPatternLen;
    while (contentStart < cleanText.length && /[:：\s\.]/.test(cleanText[contentStart])) {
        contentStart++;
    }

    const endKeywords = ['关键词', 'key words', 'keywords', '引言', 'introduction', '1. ', '1、', '©', 'copyright'];
    let contentEnd = cleanText.length;
    const lowerText = cleanText.toLowerCase();
    const searchScope = lowerText.slice(contentStart);
    let minDistance = Infinity;

    for (const endKw of endKeywords) {
        const idx = searchScope.indexOf(endKw.toLowerCase());
        if (idx !== -1 && idx > 10 && idx < minDistance) {
            minDistance = idx;
        }
    }

    contentEnd = minDistance !== Infinity ? contentStart + minDistance : Math.min(contentStart + 600, cleanText.length);

    // 4. 清洗
    let finalResult = cleanText.substring(contentStart, contentEnd).trim().replace(/^[\s:：\.]*/, '');
    if (finalResult.length > 800) finalResult = finalResult.substring(0, 800) + '...';

    return finalResult.length < 10 ? extractFirstMeaningfulParagraph(text) : finalResult;
}

/**
 * 导出主函数
 */
export function extractAbstract(fullText: string): string | null {
    return findAbstractInText(fullText);
}
