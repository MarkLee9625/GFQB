export async function extractTitle(pdf: any, fullText: string): Promise<string | null> {
    const firstPage = await pdf.getPage(1);
    const textContent = await firstPage.getTextContent();
    const firstPageText = textContent.items.map((item: any) => item.str).join(' ');

    const titleMatch = firstPageText.match(/(?:^|\n)([^\n]{5,60})(?:\n|$)/);

    if (titleMatch) {
        return titleMatch[1].trim();
    }

    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
        return lines[0].trim().substring(0, 100);
    }

    return null;
}
