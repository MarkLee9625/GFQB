import type { UniversalArticleMeta } from '../../types';
import { fetchWithTimeout } from './utils';

export const PATENT_KEYWORDS = [
  { label: 'Shipbuilding', value: 'shipbuilding' },
  { label: 'Offshore Platform', value: 'offshore platform' },
  { label: 'Marine Engineering', value: 'marine engineering' },
  { label: 'Ship Design', value: 'ship design' },
  { label: 'Welding Technology', value: 'welding ship steel' },
];

export async function fetchPatents(keyword: string): Promise<UniversalArticleMeta[]> {
  console.log(`[patentFetcher] 检索关键词: ${keyword}`);

  try {
    const patentSearchUrl = `https://patents.google.com/query?q=${encodeURIComponent(keyword)}&oq=${encodeURIComponent(keyword)}&start=0`;

    const response = await fetchWithTimeout(patentSearchUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const patentItems: UniversalArticleMeta[] = [];

    const resultCards = doc.querySelectorAll('.patent-result-card, article.search-result, div.result-container');

    resultCards.forEach((card) => {
      const titleEl = card.querySelector('h3, .title, .patent-title');
      const title = titleEl?.textContent?.trim() || '未知专利标题';

      const abstractEl = card.querySelector('.abstract, .patent-abstract, p');
      const abstract = abstractEl?.textContent?.trim() || '';

      const linkEl = card.querySelector('a[href*="patent"]');
      const link = linkEl?.getAttribute('href') || '';

      if (title && title !== '未知专利标题') {
        patentItems.push({
          id: Math.random().toString(36).substring(2, 11),
          sourceType: 'patent',
          sourceName: 'Google Patents',
          title: `[专利] ${title}`,
          content: abstract,
          url: link.startsWith('http') ? link : `https://patents.google.com${link}`,
          publishDate: new Date().toISOString(),
          decision: 'pending'
        });
      }
    });

    if (patentItems.length === 0) {
      const fallbackUrl = `https://worldwide.espacenet.com/search/results?query=${encodeURIComponent(keyword)}`;

      return [{
        id: Math.random().toString(36).substring(2, 11),
        sourceType: 'patent',
        sourceName: 'Espacenet',
        title: `[专利] ${keyword} 相关专利`,
        content: `检索关键词: ${keyword}。请访问 ${fallbackUrl} 查看完整专利列表。`,
        url: fallbackUrl,
        publishDate: new Date().toISOString(),
        decision: 'pending'
      }];
    }

    console.log(`[patentFetcher] 成功检索到 ${patentItems.length} 条专利`);
    return patentItems;

  } catch (error) {
    console.error('[patentFetcher] 检索失败:', error);
    throw new Error(`专利检索失败: ${error instanceof Error ? error.message : '网络错误'}`);
  }
}
