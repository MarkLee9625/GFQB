import type { UniversalArticleMeta } from '../../types';
import { fetchWithTimeout } from './utils';

/** rss2json 接口返回的条目结构（替代 any） */
interface Rss2JsonItem {
  title?: string;
  content?: string;
  description?: string;
  link?: string;
  pubDate?: string;
}

// 经过架构师筛选的全球海事造船顶级 RSS 源（去除了死链，增加了高可用源）
export const RSS_PRESETS = [
  { name: 'MarineLog (全球海事)', url: 'https://www.marinelog.com/feed/' },
  { name: 'gCaptain (硬核海事)', url: 'https://gcaptain.com/feed/' }, // 极力推荐的硬核源
  { name: 'Splash247 (国际海运)', url: 'https://splash247.com/feed/' }, // 更新极其频繁
  { name: 'Baird Maritime', url: 'https://www.bairdmaritime.com/feed/' },
  { name: 'TradeWinds (贸易风 - 尝试破壁)', url: 'https://www.tradewindsnews.com/arc/outboundfeeds/rss/' }
];

export async function fetchRssFeed(url: string, sourceName: string): Promise<UniversalArticleMeta[]> {
  console.log(`[rssFetcher] 开始拉取 ${sourceName}: ${url}`);
  
  // ==========================================
  // 引擎 1: rss2json (通过 count=50 强行拉满数量)
  // ==========================================
  try {
    const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=50`;
    const response = await fetchWithTimeout(rss2jsonUrl);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.status === 'ok' && data.items && data.items.length > 0) {
      console.log(`[rssFetcher] 引擎1成功拉取 ${data.items.length} 篇文章`);
      return data.items.map((item: Rss2JsonItem) => ({
        id: Math.random().toString(36).substring(2, 11),
        sourceType: 'rss',
        sourceName: sourceName,
        title: item.title,
        content: (item.content || item.description || '').replace(/<[^>]+>/g, '').trim(),
        url: item.link,
        publishDate: item.pubDate,
        decision: 'pending'
      }));
    }
    throw new Error("接口返回异常或数据为空");
  } catch (err1) {
    console.warn(`[rssFetcher] 引擎 1 (rss2json) 被拦截或失败，正在切换至备用穿甲引擎... 错误: `, err1);
    
    // ==========================================
    // 引擎 2: AllOrigins 代理 + 原生 DOM 暴力硬解 XML
    // ==========================================
    try {
      // AllOrigins 是极其强壮的 CORS 代理，可以绕过很多基础墙
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const proxyRes = await fetchWithTimeout(proxyUrl);
      if (!proxyRes.ok) throw new Error("代理请求失败");
      
      const proxyData = await proxyRes.json();
      if (!proxyData.contents) throw new Error("代理返回了空的内容");

      // 使用浏览器原生的 XML 解析器进行暴力拆解
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(proxyData.contents, "text/xml");
      const items = Array.from(xmlDoc.querySelectorAll("item"));

      if (items.length === 0) throw new Error("XML 结构中没有找到 <item> 标签");

      console.log(`[rssFetcher] 引擎2成功拉取 ${items.length} 篇文章`);
      return items.map(item => {
        const title = item.querySelector("title")?.textContent || "未知标题";
        const link = item.querySelector("link")?.textContent || "";
        const desc = item.querySelector("description")?.textContent || "";
        // 抹除 HTML 标签，保留纯文本作为摘要
        const cleanContent = desc.replace(/<[^>]+>/g, '').trim();
        const pubDate = item.querySelector("pubDate")?.textContent || "";

        return {
          id: Math.random().toString(36).substring(2, 11),
          sourceType: 'rss',
          sourceName: sourceName,
          title,
          content: cleanContent,
          url: link,
          publishDate: pubDate,
          decision: 'pending'
        };
      });
    } catch (err2) {
      console.error(`[rssFetcher] 双引擎全部失效: `, err2);
      throw new Error(`无法拉取 [${sourceName}]。该网站可能已开启最高级别防爬虫(如 Cloudflare 盾)，或者其 RSS 接口已彻底报废。`);
    }
  }
}