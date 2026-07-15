/**
 * PDF 标题提取策略
 *
 * 策略：
 * 1. 分析第一页文本项的字号（transform[3]），按 Y 坐标分行
 * 2. 字号显著大于中位数的行最有可能是标题
 * 3. 如果字号分析无法确定，取页面最顶端的内容行
 * 4. 最终回退：全文第一个非空行
 */

export async function extractTitle(pdf: any, fullText: string): Promise<string | null> {
    // 策略一：基于字号 + Y 坐标的首页分析
    try {
        const firstPage = await pdf.getPage(1);
        const textContent = await firstPage.getTextContent();

        // 按 Y 坐标分组（容差 5 单位内的视为同一行）
        const Y_THRESHOLD = 5;
        const lineMap = new Map<number, { text: string; maxFontSize: number }>();

        for (const item of textContent.items as any[]) {
            const str = (item.str || '').trim();
            if (!str) continue;

            const y = Math.round((item.transform?.[5] || 0) / Y_THRESHOLD) * Y_THRESHOLD;
            const fontSize = item.transform?.[3] || item.height || 0;

            const existing = lineMap.get(y);
            if (existing) {
                existing.text += str;
                existing.maxFontSize = Math.max(existing.maxFontSize, fontSize);
            } else {
                lineMap.set(y, { text: str, maxFontSize: fontSize });
            }
        }

        if (lineMap.size > 0) {
            const lines = Array.from(lineMap.entries())
                .sort((a, b) => a[0] - b[0]); // 按 Y 从上到下

            const fontSizes = lines.map(l => l[1].maxFontSize).sort((a, b) => b - a);
            const median = fontSizes[Math.floor(fontSizes.length / 2)] || 1;

            // 找字号 > 中位数 1.4 倍且长度 5-100 的行
            const candidates = lines
                .map(l => l[1])
                .filter(l => l.maxFontSize > median * 1.4 && l.text.length >= 5 && l.text.length <= 100)
                .sort((a, b) => b.maxFontSize - a.maxFontSize);

            if (candidates.length > 0) {
                return candidates[0].text.trim();
            }

            // 回退：取页面最顶行的内容（通常第一行是标题或页眉）
            const topLine = lines[0];
            if (topLine) {
                const text = topLine[1].text.trim();
                if (text.length >= 5 && text.length <= 100) {
                    return text;
                }
            }
        }
    } catch (e) {
        console.warn('[TitleExtract] 字号分析失败，回退文本策略:', e);
    }

    // 策略二：全文第一个非空行
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
        const title = lines[0].trim();
        if (title.length > 5) {
            return title.substring(0, 100);
        }
        // 如果第一行太短（可能是页码/页眉），尝试第二行
        if (lines.length > 1) {
            return lines[1].trim().substring(0, 100);
        }
        return title.substring(0, 100);
    }

    return null;
}
