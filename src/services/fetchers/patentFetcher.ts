import { UniversalArticleMeta } from '../../types/intelligence';

export const PATENT_KEYWORDS = [
  { label: '造船机器人 (Shipbuilding Robot)', value: 'shipbuilding robot' },
  { label: '船体焊接工艺 (Hull Welding)', value: 'hull welding' },
  { label: '船舶涂装 (Marine Coating)', value: 'marine coating' },
  { label: '智能造船 (Smart Shipbuilding)', value: 'smart shipbuilding' }
];

export async function fetchPatents(keyword: string): Promise<UniversalArticleMeta[]> {
  console.log(`[techFetcher] 开始检索 Semantic Scholar 前沿文献, 关键词: ${keyword}`);
  
  try {
    const currentYear = new Date().getFullYear();
    const timeWindow = `${currentYear - 1}-${currentYear}`; 
    const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&year=${timeWindow}&limit=20&fields=title,abstract,url,year,authors,venue,openAccessPdf,citationCount`;

    // 【终极网络底座：轮询代理池】
    const proxyNodes = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`, // 节点1：AllOrigins 原生模式
      `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`,             // 节点2：CorsProxy
      apiUrl                                                               // 节点3：原生直连（最后的尊严）
    ];

    let data: any = null;
    let isRateLimited = false;

    for (let i = 0; i < proxyNodes.length; i++) {
      try {
        console.log(`[techFetcher] 正在尝试节点 ${i + 1}...`);
        const response = await fetch(proxyNodes[i]);
        
        if (response.status === 429) {
          throw new Error("NODE_429"); // 抛出特定错误以触发切换
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        data = JSON.parse(text);

        // 如果代理服务器返回的 JSON 里带着限流消息
        if (data.message && data.message.includes('Too Many Requests')) {
          throw new Error("NODE_429");
        }

        // 如果成功拿到了真实文章数据，跳出轮询！
        if (data && data.data) {
          console.log(`[techFetcher] 节点 ${i + 1} 请求大成功！`);
          isRateLimited = false;
          break; 
        }
      } catch (err: any) {
        console.warn(`[techFetcher] 节点 ${i + 1} 失败，准备切换: `, err.message);
        if (err.message === "NODE_429") isRateLimited = true;
        data = null; // 重置数据，继续下一次循环
      }
    }

    // 轮询结束后，如果 data 依然为空
    if (!data || !data.data) {
      if (isRateLimited) {
         throw new Error("全球学术库公共通道当前限流极度严重。所有的代理节点均被拦截，请稍后再试。");
      }
      throw new Error("全球学术网络通道当前严重拥堵，所有节点均无响应。");
    }

    if (data.data.length === 0) {
      throw new Error(`未检索到与 "${keyword}" 相关的最新文献，请尝试更换关键词`);
    }

    const validPapers = data.data.filter((paper: any) => paper.abstract && paper.title);

    if (validPapers.length === 0) {
      throw new Error("检索到了相关文献，但缺乏可供 AI 评审的摘要内容。");
    }

    console.log(`[techFetcher] 成功检索并过滤出 ${validPapers.length} 篇优质文献`);

    return validPapers.map((paper: any) => {
      const venueStr = paper.venue ? `发表期刊/会议: ${paper.venue}` : '发表渠道: 独立学术出版';
      const citationStr = paper.citationCount !== undefined ? `全球引用次数: ${paper.citationCount} 次` : '';
      const authorsStr = paper.authors && paper.authors.length ? `核心作者: ${paper.authors.map((a:any)=>a.name).slice(0, 3).join(', ')}` : '';
      const oaStr = paper.openAccessPdf ? `【注意：本文附带免费开源 PDF 全文】链接: ${paper.openAccessPdf.url}` : '';
      
      const enrichedContent = `【学术背书】\n${venueStr}\n${citationStr}\n${authorsStr}\n${oaStr}\n\n【核心摘要】\n${paper.abstract}`;

      return {
        id: `PAPER-${paper.paperId.substring(0, 8)}`,
        sourceType: 'patent', 
        sourceName: `学术库 (${paper.year || '最新'})${paper.openAccessPdf ? ' · 🆓 开源全文' : ''}`,
        title: paper.title,
        content: enrichedContent, 
        url: paper.openAccessPdf ? paper.openAccessPdf.url : (paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`), 
        publishDate: paper.year ? paper.year.toString() : '未知',
        decision: 'pending'
      };
    });

  } catch (error) {
    console.error("[techFetcher] 抓取失败:", error);
    throw new Error(`${error instanceof Error ? error.message : '未知网络错误'}`);
  }
}