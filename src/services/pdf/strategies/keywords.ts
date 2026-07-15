/**
 * PDF 关键词提取策略
 *
 * 匹配模式（按优先级）：
 * 1. 标准「关键词:」/「keywords:」/「key words:」
 * 2. 中文方括号变体：【关键词】、[关键词] 等
 * 3. 空格分隔的「关　键　词」、「关 键 词」
 * 4. 中文「关键字:」
 */

export function extractKeywords(fullText: string): string[] {
    const patterns = [
        // 标准：关键词/keywords + 分隔符 + 词汇列表
        /(?:关键词|keywords|key words|关键字)[:：\s]*([^\n]{10,200})/i,

        // 中文方括号：【关键词】[关键词]［关键词］
        /[【\[［〔](?:关键词|keywords|key words|关键字)[】\]］〕]\s*([^\n]{10,200})/i,

        // 空格分隔：关 键 词、关　键　词
        /关\s*键\s*词[:：\s]*([^\n]{10,200})/i,
    ];

    for (const pattern of patterns) {
        const keywords = tryExtract(pattern, fullText);
        if (keywords.length > 0) return keywords;
    }

    // 回退：找到含「关键词」的行，解析同一行或下一行
    const lines = fullText.split('\n');
    const keywordLineIndex = lines.findIndex(line =>
        /(?:关键词|keywords|key words|关键字|关\s*键\s*词)/i.test(line)
    );

    if (keywordLineIndex !== -1) {
        const line = lines[keywordLineIndex];
        // 先尝试同行冒号后的内容
        const inlineMatch = line.match(/[:：]\s*(.+)/);
        const textToParse = inlineMatch
            ? inlineMatch[1]
            : (keywordLineIndex < lines.length - 1 ? lines[keywordLineIndex + 1] : '');

        if (textToParse) {
            const keywords = parseKeywords(textToParse);
            if (keywords.length > 0) return keywords.slice(0, 6);
        }
    }

    return [];
}

/** 用指定模式尝试提取 */
function tryExtract(pattern: RegExp, fullText: string): string[] {
    const match = fullText.match(pattern);
    if (!match || !match[1]) return [];
    return parseKeywords(match[1]);
}

/** 解析关键词字符串：按中文逗号、英文逗号、分号、顿号、制表符分割 */
function parseKeywords(text: string): string[] {
    return text
        .split(/[,，;；、\t|/]+/)
        .map(k => k.trim())
        .filter(k => {
            const clean = k.replace(/[「」【】\[\]『』《》""'']/g, '').trim();
            return clean.length > 1 && clean.length < 30;
        })
        .slice(0, 8);
}
