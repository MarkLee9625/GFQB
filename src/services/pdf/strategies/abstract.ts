/**
 * PDF 摘要提取策略
 *
 * 匹配模式（按优先级）：
 * 1. 标准「摘要:」或「abstract:」+ 正文（中英文）
 * 2. 中文方括号变体：【摘要】、[摘要]、「摘要」等
 * 3. 全角空格分隔的「摘　要」
 * 4. 无显式标记时：找标题后的首个长段落（>150 字）作为摘要
 */

export function extractAbstract(fullText: string): string | null {
    const patterns = [
        // 标准：摘要/abstract + 冒号 + 正文（到关键词/引言/第1节截止）
        /(?:摘要|abstract)[:：\s]*([\s\S]{100,1000}?)(?:关键词|keyword|keywords|key words|引言|introduction|1[\.、　 ]|$)/i,

        // 中文方括号：【摘要】[摘要]［摘要］
        /[【\[［〔](?:摘要|abstract)[】\]］〕]\s*([\s\S]{100,800}?)(?=【[关键词]|【关键字]|\[关键词\]|$)/i,

        // 全角/半角空格分隔：摘 要、摘　要
        /摘\s*要[:：\s]*([\s\S]{100,800}?)(?:关键词|keyword|引言|introduction|1[\.、]|$)/i,

        // 英文 abstract（单独处理）
        /abstract[:：]\s*([\s\S]{100,1000}?)(?:keywords?|introduction|1[\.、]|i\.|$)/i,
    ];

    for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
            const result = match[1].trim().replace(/\s+/g, ' ');
            if (result.length > 50) {
                return result.substring(0, 500);
            }
        }
    }

    // 回退：找包含「摘要」/「abstract」的行，取后续内容
    const lines = fullText.split('\n');
    const abstractStartIndex = lines.findIndex(line =>
        /(?:摘要|abstract|摘\s*\s*要)/i.test(line)
    );

    if (abstractStartIndex !== -1 && abstractStartIndex < lines.length - 1) {
        // 跳过空行，取最多 15 行实质性内容
        let collected: string[] = [];
        for (let i = abstractStartIndex + 1; i < Math.min(abstractStartIndex + 16, lines.length); i++) {
            const trimmed = lines[i].trim();
            if (trimmed) collected.push(trimmed);
            // 遇到下一个章节标题停止
            if (/^(?:[一二三四五六七八九十]+[、．]|引言|introduction|1[\.、])/i.test(trimmed)) break;
        }
        const abstract = collected.join(' ').trim();
        if (abstract.length > 50) {
            return abstract.substring(0, 500);
        }
    }

    // 最终回退：取全文第一个长度 > 150 字的段落
    const paragraphs = fullText.split(/\n{2,}/);
    for (const para of paragraphs) {
        const clean = para.trim().replace(/\s+/g, ' ');
        if (clean.length > 150 && !/^(?:摘要|abstract|关键词|keywords|目录|table\s+of\s+contents)/i.test(clean)) {
            return clean.substring(0, 500);
        }
    }

    return null;
}
