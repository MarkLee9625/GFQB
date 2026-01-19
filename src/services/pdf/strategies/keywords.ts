/**
 * 关键词提取策略模块
 */

/**
 * 在文本中寻找关键词
 */
export function findKeywordsInText(text: string): string[] {
    if (!text) return [];

    // 预处理：保留换行以辅助正则匹配
    const cleanText = text.replace(/[\u3000]/g, ' ').replace(/[ \t]+/g, ' ');

    const patterns = [
        /(?:关\s*键\s*词|关\s*键\s*字)\s*[:：]\s*(.*?)(?=\n|引言|Introduction|1\.|DOI|中图分类号|$)/i,
        /(?:Key\s*words?)\s*[:：]\s*(.*?)(?=\n|Introduction|1\.|DOI|$)/i,
        /(?:关\s*键\s*词|关\s*键\s*字)\s*[:：]\s*(.{5,100})/i,
        /(?:Key\s*words?)\s*[:：]\s*(.{5,100})/i
    ];

    let keywordsStr = '';
    for (const pattern of patterns) {
        const match = pattern.exec(cleanText);
        if (match && match[1]) {
            const candidate = match[1].trim();
            if (candidate.length > 2 && /[a-zA-Z\u4e00-\u9fa5]/.test(candidate)) {
                keywordsStr = candidate;
                break;
            }
        }
    }

    if (!keywordsStr) return [];

    // 清洗分割
    keywordsStr = keywordsStr.replace(/[;；,，.。]+$/, '');
    let keywords = keywordsStr.split(/[,，;；]/).map(k => k.trim());

    if (keywords.length <= 1 && keywords[0].includes(' ')) {
        const spaceSplit = keywords[0].split(/\s+/);
        if (spaceSplit.length > 1) keywords = spaceSplit;
    }

    return keywords
        .map(k => k.trim())
        .filter(k => k.length >= 2 && k.length < 30)
        .filter(k => !/^\d+$/.test(k))
        .filter(k => !/^(DOI|中图分类号|TN|TP)/i.test(k));
}

/**
 * 导出主函数
 */
export function extractKeywords(fullText: string): string[] {
    return findKeywordsInText(fullText);
}
