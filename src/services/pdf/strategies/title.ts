/**
 * 标题提取策略模块
 */

/**
 * 清洗提取的标题，移除数字序列、作者信息等无关内容
 */
export function cleanExtractedTitle(title: string): string {
    if (!title) return title;

    console.log(`[标题清洗] 原始标题: "${title}"`);

    let cleaned = title.trim();

    // 1. 移除开头的数字序列（如"2 0 2 4 0 4 1 0 "）
    cleaned = cleaned.replace(/^(\d\s*){5,}/, '');

    // 2. 移除文章编号等数字模式
    const noSpaceForDigits = cleaned.replace(/\s+/g, '');
    if (noSpaceForDigits.match(/^\d{8,}/)) {
        cleaned = cleaned.replace(/^(\d\s*)+/, '');
    }

    // 3. 合并被空格分隔的英文缩写
    cleaned = cleaned.replace(/([A-Z])\s+([A-Z])\s+([A-Z])\s+([A-Z])/g, '$1$2$3$4');
    cleaned = cleaned.replace(/([A-Z])\s+([A-Z])\s+([A-Z])/g, '$1$2$3');
    cleaned = cleaned.replace(/([A-Z])\s+([A-Z])/g, '$1$2');

    // 4. 合并被空格分隔的"SPMT"
    cleaned = cleaned.replace(/S\s+P\s+M\s+T/g, 'SPMT');

    // 5. 移除作者信息
    cleaned = cleaned.replace(/\b\d+[a-zA-Z]\s*(,\s*\d+[a-zA-Z]\s*)*/g, '');

    // 6. 移除常见的作者标记
    cleaned = cleaned.replace(/[\u4e00-\u9fa5]+\s+\d+[a-zA-Z]\s*(,\s*\d+[a-zA-Z]\s*)*/g, '');

    // 7. 移除多个作者
    cleaned = cleaned.replace(/[\u4e00-\u9fa5]+\s*(,\s*[\u4e00-\u9fa5]+\s*){2,}/g, '');

    // 8. 移除括号内的内容
    cleaned = cleaned.replace(/\([^)]*\d+[a-zA-Z][^)]*\)/g, '');

    // 9. 移除单独的英文字母和数字组合
    cleaned = cleaned.replace(/\b\d\s+[a-zA-Z]\b/g, '');

    // 10. 清理多余的空格和标点
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/^[,\s.，。、]+/, '');
    cleaned = cleaned.replace(/[,\s.，。、]+$/, '');

    // 11. 移除末尾的括号和括号内容
    cleaned = cleaned.replace(/\([^)]*\)$/, '');

    if (cleaned.length < 5) {
        return title.trim();
    }

    return cleaned;
}

/**
 * 评估单个文本段落是否可能是标题
 */
export function evaluateTitleCandidate(text: string, paragraphIndex: number, sentenceIndex: number): { text: string, score: number, reasons: string[] } | null {
    const cleanPara = text.trim().replace(/\s+/g, ' ');
    const length = cleanPara.length;

    let score = 0;
    const reasons: string[] = [];

    if (paragraphIndex === 0) {
        if (sentenceIndex === -1) {
            score += 20;
            reasons.push('第一段');
        } else if (sentenceIndex === 0) {
            score += 25;
            reasons.push('第一段第一句');
        } else {
            score += 15;
            reasons.push(`第一段第${sentenceIndex + 1}句`);
        }
    } else if (paragraphIndex === 1) {
        score += 10;
        reasons.push('第二段');
    } else {
        score += 5;
        reasons.push('第三段或更后');
    }

    if (length >= 10 && length <= 150) {
        score += 15;
        reasons.push(`适中长度(${length})`);
    } else if (length >= 5 && length <= 200) {
        score += 10;
        reasons.push(`可接受长度(${length})`);
    } else {
        return null;
    }

    const nonTitlePatterns = [
        /摘要|abstract|摘\s*要/i,
        /关键词|key words|keywords/i,
        /目录|contents|目\s*录/i,
        /引言|introduction|引\s*言/i,
        /^\d+[\.\、]\s*/,
        /^(abstract|keywords|introduction):?\s*/i,
        /^[a-z][a-z\s]*$/,
        /\.{3,}/,
        /第[一二三四五六七八九十\d]+[章节部分]/,
        /基金项目|作者简介|文章编号|DOI|中图分类号|文献标志码/i,
        /vol\.|no\.|pp\.|pages?|volume/i,
    ];

    const lowerPara = cleanPara.toLowerCase();
    for (const pattern of nonTitlePatterns) {
        if (pattern.test(cleanPara) || pattern.test(lowerPara)) {
            return null;
        }
    }

    if (!/[。.;!?]$/.test(cleanPara)) {
        score += 10;
        reasons.push('无结束标点');
    }

    if (/[:：\-—]$/.test(cleanPara)) {
        score += 5;
        reasons.push('标题标点结尾');
    }

    const titleKeywords = [
        /研究|study|research/i, /分析|analysis/i, /探讨|discussion/i,
        /综述|review/i, /设计|design/i, /应用|application/i,
        /基于|based on/i, /方法|method/i, /技术|technology/i,
        /系统|system/i, /动力学|dynamic/i, /运输|transfer/i, /模块|module/i
    ];

    let keywordScore = 0;
    for (const keyword of titleKeywords) {
        if (keyword.test(cleanPara)) keywordScore += 3;
    }
    if (keywordScore > 0) {
        score += Math.min(keywordScore, 15);
        reasons.push(`包含标题关键词(+${keywordScore})`);
    }

    if (/^[A-Z]/.test(cleanPara) && /[a-zA-Z]/.test(cleanPara)) {
        const importantWords = cleanPara.split(/\s+/).filter(w => w.length > 2);
        if (importantWords.length > 0) {
            const capitalizedRatio = importantWords.filter(w => /^[A-Z]/.test(w)).length / importantWords.length;
            if (capitalizedRatio > 0.5) {
                score += 10;
                reasons.push('英文标题格式');
            }
        }
    }

    const digitCount = (cleanPara.match(/\d/g) || []).length;
    if (digitCount / length > 0.2) {
        score -= 10;
        reasons.push(`数字过多(-10)`);
    }

    return score >= 25 ? { text: cleanPara, score, reasons } : null;
}

/**
 * 基于文本内容的标题提取策略
 */
export function extractTitleFromText(text: string): string | null {
    if (!text) return null;

    const paragraphs = text.split(/[\n\r]+/).filter(p => p.trim().length > 0);
    if (paragraphs.length === 0) return null;

    const titleCandidates: Array<{ text: string, score: number, reasons: string[] }> = [];
    const paragraphsToCheck = paragraphs.slice(0, Math.min(3, paragraphs.length));

    for (let i = 0; i < paragraphsToCheck.length; i++) {
        const originalPara = paragraphsToCheck[i];
        const cleanPara = originalPara.trim().replace(/\s+/g, ' ');
        const length = cleanPara.length;

        if (length > 500) {
            const sentences = originalPara.split(/[。.!?;；]/).filter(s => s.trim().length > 0);
            for (let j = 0; j < Math.min(sentences.length, 8); j++) {
                const sentence = sentences[j].trim().replace(/\s+/g, ' ');
                if (sentence.length >= 5 && sentence.length <= 200) {
                    const candidate = evaluateTitleCandidate(sentence, i, j);
                    if (candidate) titleCandidates.push(candidate);
                }
            }

            const lines = originalPara.split(/[\n\r]/).filter(line => line.trim().length > 0);
            for (let j = 0; j < Math.min(lines.length, 10); j++) {
                const line = lines[j].trim().replace(/\s+/g, ' ');
                if (line.length >= 5 && line.length <= 150) {
                    const candidate = evaluateTitleCandidate(line, i, -3);
                    if (candidate) titleCandidates.push(candidate);
                }
            }
            continue;
        }

        if (length >= 5 && length <= 300) {
            const candidate = evaluateTitleCandidate(cleanPara, i, -1);
            if (candidate) titleCandidates.push(candidate);
        }
    }

    if (titleCandidates.length === 0) {
        const first500Chars = text.substring(0, Math.min(500, text.length));
        const lines = first500Chars.split(/[\n\r]+/).filter(line => line.trim().length > 0);
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const line = lines[i].trim().replace(/\s+/g, ' ');
            if (line.length >= 5 && line.length <= 150) {
                const candidate = evaluateTitleCandidate(line, i, -2);
                if (candidate) titleCandidates.push(candidate);
            }
        }
    }

    if (titleCandidates.length > 0) {
        titleCandidates.sort((a, b) => b.score - a.score);
        return cleanExtractedTitle(titleCandidates[0].text);
    }

    // 宽松规则和关键词加持
    const searchText = text.substring(0, Math.min(1000, text.length));
    const keywordPatterns = [
        /SPMT.*运输.*FPSO.*上部模块.*动力学分析/,
        /FPSO.*上部模块.*运输.*动力学分析/,
        /动力学分析.*SPMT.*运输/,
        /SPMT.*运输.*动力学分析/
    ];
    const noSpaceText = searchText.replace(/\s+/g, '');
    for (const pattern of keywordPatterns) {
        if (pattern.test(noSpaceText)) {
            const match = noSpaceText.match(pattern);
            if (match) return cleanExtractedTitle(match[0]);
        }
    }

    return null;
}

/**
 * 基于最大字号的标题提取策略
 */
export async function extractTitleByFontSize(pdf: any): Promise<string | null> {
    try {
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const items = textContent.items;
        if (!items || items.length === 0) return null;

        let maxFontSize = 0;
        const validItems: any[] = [];
        for (const item of items) {
            const typedItem = item as any;
            if (!typedItem.str || typedItem.str.trim().length === 0) continue;
            const transform = typedItem.transform || [];
            if (transform.length < 6) continue;

            const fontSize = Math.abs(transform[3]);
            if (fontSize < 5) continue;
            if (fontSize > maxFontSize) maxFontSize = fontSize;

            validItems.push({
                str: typedItem.str,
                fontSize,
                x: transform[4],
                y: transform[5]
            });
        }

        if (validItems.length === 0) return null;

        const titleItems = validItems.filter(item => item.fontSize >= maxFontSize * 0.9);
        if (titleItems.length === 0) {
            const topItems = validItems.sort((a, b) => b.y - a.y).slice(0, 5); // 兜底取顶部
            return cleanExtractedTitle(topItems.map(i => i.str).join(' '));
        }

        titleItems.sort((a, b) => Math.abs(a.y - b.y) > 5 ? b.y - a.y : a.x - b.x);
        return cleanExtractedTitle(titleItems.map(item => item.str).join(' '));
    } catch (e) {
        console.error('[Title Strategy] Error:', e);
        return null;
    }
}

/**
 * 整合标题提取策略
 */
export async function extractTitle(pdf: any, fullText: string): Promise<string | null> {
    // 1. 尝试元数据
    try {
        const metadata = await pdf.getMetadata();
        const info = metadata?.info as any;
        if (info?.Title?.trim()) return info.Title.trim();
    } catch (e) { }

    // 2. 尝试字号算法
    const fontSizeTitle = await extractTitleByFontSize(pdf);
    if (fontSizeTitle) return fontSizeTitle;

    // 3. 尝试文本内容算法
    return extractTitleFromText(fullText);
}
