export function extractKeywords(fullText: string): string[] {
    const keywordPatterns = [
        /(?:关键词|keywords|key words)[:：]\s*([^\n]{10,200})/i,
    ];

    for (const pattern of keywordPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
            const keywords = match[1]
                .split(/[,，;；\t]+/)
                .map(k => k.trim())
                .filter(k => k.length > 1 && k.length < 20)
                .slice(0, 8);
            if (keywords.length > 0) {
                return keywords;
            }
        }
    }

    const lines = fullText.split('\n');
    const keywordLineIndex = lines.findIndex(line =>
        /(?:关键词|keywords|key words)/i.test(line)
    );

    if (keywordLineIndex !== -1 && keywordLineIndex < lines.length - 1) {
        const keywordLine = lines[keywordLineIndex + 1];
        const keywords = keywordLine
            .split(/[,，;；\t]+/)
            .map(k => k.trim())
            .filter(k => k.length > 1 && k.length < 20)
            .slice(0, 6);
        if (keywords.length > 0) {
            return keywords;
        }
    }

    return [];
}
