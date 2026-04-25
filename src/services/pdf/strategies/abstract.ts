export function extractAbstract(fullText: string): string | null {
    const abstractPatterns = [
        /(?:摘要|abstract)[:：]\s*([\s\S]{100,1000}?)(?:关键词|keyword|引言|introduction|$)/i,
        /(?:abstract)[:：]\s*([\s\S]{100,800}?)(?:keywords|1\.|introduction|$)/i,
    ];

    for (const pattern of abstractPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
            return match[1].trim().replace(/\s+/g, ' ');
        }
    }

    const lines = fullText.split('\n');
    const abstractStartIndex = lines.findIndex(line =>
        /(?:摘要|abstract)/i.test(line)
    );

    if (abstractStartIndex !== -1 && abstractStartIndex < lines.length - 1) {
        const abstractLines = lines.slice(abstractStartIndex + 1, abstractStartIndex + 10);
        const abstract = abstractLines.join(' ').trim();
        if (abstract.length > 50) {
            return abstract.substring(0, 500);
        }
    }

    return null;
}
