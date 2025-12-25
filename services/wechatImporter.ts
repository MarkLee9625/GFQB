/**
 * 微信公众号文章导入服务
 * 提供从微信文章URL抓取并清洗内容的函数
 */

/**
 * 强力清洗微信HTML内容，解决无法删除的空行/占位符问题
 * @param html 原始HTML字符串
 * @returns 清洗后的HTML字符串
 */
function cleanWeChatHTML(html: string): string {
  if (!html) return '';

  // 使用DOMParser解析HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // --- Step A: 图片处理 (Image Optimization) ---
  const images = doc.querySelectorAll('img');

  // 图片代理服务配置
  const PROXY_WESERV = 'https://images.weserv.nl/?url=';
  const PROXY_CORSPROXY = 'https://corsproxy.io/?';
  const PROXY_ALLORIGINS = 'https://api.allorigins.win/raw?url=';
  // 备用：使用了 output=webp 优化

  images.forEach(img => {
    // 1. 获取真实图片地址 (优先 data-src)
    let src = img.getAttribute('data-src') || img.getAttribute('src');

    if (src) {
      // 增强的 GIF 检测逻辑
      const dataType = (img.getAttribute('data-type') || '').toLowerCase();
      const isGif = dataType === 'gif' || src.includes('wx_fmt=gif') || src.includes('tp=gif') || src.includes('/mmbiz_gif/');

      let primaryUrl = '';
      let fallbackScript = '';

      if (isGif) {
        // [策略 Adjust V4] 多级降级策略
        // 1. AllOrigins (Raw) - 最可能保留动图原样
        // 2. Corsproxy (Raw) - 备用原始代理
        // 3. Weserv (Processed) - 兜底，带强制参数

        const url1 = `${PROXY_ALLORIGINS}${encodeURIComponent(src)}`;
        const url2 = `${PROXY_CORSPROXY}${encodeURIComponent(src)}`;
        const timestamp = Date.now();
        const url3 = `${PROXY_WESERV}${encodeURIComponent(src)}&output=gif&n=-1&t=${timestamp}`;

        primaryUrl = url1;

        // 链式 fallback: url1 -> url2 -> url3
        fallbackScript = `
          if (this.src.indexOf('api.allorigins.win') > -1) {
            this.src = '${url2}';
          } else if (this.src.indexOf('corsproxy.io') > -1) {
            this.src = '${url3}';
            this.onerror = null;
          }
        `;
      } else {
        // [策略 Default] 对于静态图，优先使用 Weserv 转 WebP (极速、省流)
        primaryUrl = `${PROXY_WESERV}${encodeURIComponent(src)}&output=webp`;

        // 静态图回退：如果 Weserv 挂了，试着用 CORS 代理拿原图
        fallbackScript = `
          if (this.src.startsWith('${PROXY_WESERV}')) {
            this.src = '${PROXY_CORSPROXY}' + encodeURIComponent('${src}');
            this.onerror = null;
          }
        `;
      }

      img.src = primaryUrl;
      img.setAttribute('onerror', fallbackScript.replace(/\s+/g, ' '));
      img.removeAttribute('data-src');
    }

    // 2. 移除无关属性
    img.removeAttribute('data-w');
    img.removeAttribute('data-type');
    img.removeAttribute('data-ratio');
    img.removeAttribute('class');
    img.removeAttribute('style'); // 清除内联样式
    img.removeAttribute('crossorigin');

    // 3. 确保显示正常
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    img.style.margin = '20px auto';
    img.style.borderRadius = '4px';

    // 标记为保留
    img.setAttribute('data-sws-keep', 'true');
  });



  // --- Step B: 结构扁平化 ---
  const sections = doc.querySelectorAll('section');
  sections.forEach(section => {
    while (section.firstChild) {
      section.parentNode?.insertBefore(section.firstChild, section);
    }
    section.remove();
  });

  // --- Step C: 全局清洗 ---
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    if (el.tagName.toLowerCase() === 'img') return;

    el.removeAttribute('id');
    el.removeAttribute('class');
    el.removeAttribute('style');
    el.removeAttribute('width');
    el.removeAttribute('height');

    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name.startsWith('wx-')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // 移除垃圾标签
  const problematicTags = ['iframe', 'script', 'style', 'link', 'meta', 'noscript', 'wx-open-launch-weapp'];
  problematicTags.forEach(tagName => {
    doc.querySelectorAll(tagName).forEach(el => el.remove());
  });

  // --- Step D: 空内容清洗 ---
  const spacingTags = ['p', 'div', 'span', 'strong', 'em'];
  spacingTags.forEach(tagName => {
    doc.querySelectorAll(tagName).forEach(el => {
      const hasContent = el.textContent?.trim().length;
      const hasImage = el.querySelector('img');
      const isImage = el.tagName.toLowerCase() === 'img';

      if (!isImage && !hasImage && !hasContent) {
        el.remove();
      }
    });
  });

  // --- Step E: 智能底部干扰内容清洗 (Smart Footer Noise Removal) ---
  const footerKeywords = ['扫描二维码', '关注公众号', '点分享', '点收藏', '点点赞', '点在看', '长按识别二维码', '预览时标签不可点', '喜欢作者'];

  // 1. 查找 "END" 标记，如果找到，移除其后所有内容
  // 微信通常用 section 或 p 包裹 END
  const potentialEndNodes = doc.querySelectorAll('p, section, div, span');
  for (const el of Array.from(potentialEndNodes)) {
    const text = el.textContent?.trim() || '';
    // 匹配常见的 END 样式，包括 "END" 及其两侧的横线装饰
    const isEndMarker = /^(end|the end|完|全文完)$/i.test(text) ||
      /^-{3,}$/.test(text) ||
      (text === 'END');

    if (isEndMarker) {
      // 找到 END 了，往上找一层，确认它不是文章中间的某个单词
      // 通常 END 是独立的
      if (text.length < 10) {
        console.log('Found END marker, truncating...', text);

        // 找到包含 END 的最顶层块级元素 (在 js_content 下的直接子元素，或接近顶层的 section)
        let container = el;
        let depth = 0;
        while (container.parentElement && container.parentElement.id !== 'js_content' && container.parentElement !== doc.body && depth < 5) {
          // 如果父级包含太多文字，则 END 可能是内嵌的，停止上溯
          if ((container.parentElement.textContent || '').length > 50) break;
          container = container.parentElement;
          depth++;
        }

        // 移除该容器及其之后的所有兄弟节点
        let next = container.nextElementSibling;
        while (next) {
          const toRemove = next;
          next = next.nextElementSibling;
          toRemove.remove();
        }
        container.remove(); // 移除 END 本身
        break; // 停止处理，已经截断了
      }
    }
  }

  // 2. 针对残留的底部关键词（如果 END 没抓到，或者这些在 END 之前）
  // 重新查询，因为 DOM 变了
  const remainingNodes = doc.querySelectorAll('p, div, span, strong, section, fieldset');
  remainingNodes.forEach(el => {
    const text = el.textContent?.trim() || '';
    if (!text) return;

    if (footerKeywords.some(kw => text.includes(kw)) && text.length < 100) {
      // 这是一个包含底部关键词的短元素
      // 往上找包裹它的容器 (通常微信文章用 section 包裹每一段)
      let container = el;
      let depth = 0;
      // 尝试找到包裹这个 footer 元素的独立 section
      while (container.parentElement &&
        container.parentElement.tagName.toLowerCase() !== 'body' &&
        container.parentElement.id !== 'js_content' &&
        depth < 3) {

        // 如果父容器包含太多文字（比如>200字），可能误删了正文，停止上溯
        if ((container.parentElement.textContent || '').length > 200) break;

        container = container.parentElement;
        depth++;
      }

      // 移除容器
      container.remove();
    }
  });

  // 3. 针对特定的图片二维码结构 (通常是图片后面紧跟 "关注" 文字)
  // 如果上面的关键词逻辑没删掉图片（因为图片和文字是兄弟节点，且在不同 section），这里补刀
  const footerImages = doc.querySelectorAll('img');
  footerImages.forEach(img => {
    // 检查图片后面是否有 "关注"、"二维码" 等字样
    let next = img.nextSibling;
    let siblingsChecked = 0;
    while (next && siblingsChecked < 3) { // 检查后3个节点
      const nextText = next.textContent?.trim() || '';
      if (footerKeywords.some(kw => nextText.includes(kw))) {
        // 命中！移除图片和这个文字节点
        img.remove();
        // 如果 next 是元素，也移除
        if (next instanceof Element) next.remove();
        else next.parentNode?.removeChild(next);
        break;
      }
      next = next.nextSibling;
      siblingsChecked++;
    }
  });

  // 移除指定选择器
  const footerSelectors = ['.rich_media_tool', '#js_toobar3', '.reward_area', '#js_pc_qr_code', '#js_view_source', '.qr_code_pc_outer'];
  footerSelectors.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  });

  let htmlOutput = doc.body.innerHTML;

  // 1. 移除包含空格、nbsp、br 的空段落
  htmlOutput = htmlOutput.replace(/<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
  htmlOutput = htmlOutput.replace(/(<br\s*\/?>\s*)+/gi, '<br>');
  htmlOutput = htmlOutput.replace(/>\s+</g, '><');

  return htmlOutput;
}

/**
 * 抓取结果接口
 */
export interface WechatArticleResult {
  title: string;
  content: string;
  author?: string;
  date?: string;
}

/**
 * 抓取并清洗微信公众号文章
 * @param url 微信文章URL
 * @returns Promise<WechatArticleResult>
 */
export async function fetchWechatArticle(url: string): Promise<WechatArticleResult> {
  // 备选代理服务列表，依次尝试
  const proxyServices = [
    `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];

  let lastError: Error | null = null;

  for (const proxyUrl of proxyServices) {
    try {
      console.log(`尝试使用代理: ${proxyUrl}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90秒超时

      const response = await fetch(proxyUrl, {
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      let htmlContent: string;
      if (proxyUrl.includes('api.allorigins.win')) {
        const data = await response.json();
        htmlContent = data.contents;
      } else {
        htmlContent = await response.text();
      }

      if (!htmlContent || htmlContent.length < 500) {
        throw new Error('抓取到的内容过短或被拦截');
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // 1. 提取标题
      const titleSelectors = ['#activity-name', '.rich_media_title', 'title', 'h1', 'h2'];
      let title = '未命名文章';
      for (const selector of titleSelectors) {
        const element = doc.querySelector(selector);
        if (element?.textContent?.trim()) {
          title = element.textContent.trim();
          break;
        }
      }

      // 2. 提取作者/公众号
      let author = '';
      const authorSelectors = ['#js_name', '.profile_nickname', '.rich_media_meta_nickname', '.account_nickname'];
      for (const selector of authorSelectors) {
        const element = doc.querySelector(selector);
        if (element?.textContent?.trim()) {
          author = element.textContent.trim();
          break;
        }
      }

      // 3. 提取时间
      let date = '';
      const scripts = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
      const timeMatch = scripts.match(/var\s+ct\s*=\s*"(\d+)"/);
      if (timeMatch && timeMatch[1]) {
        const timestamp = parseInt(timeMatch[1], 10) * 1000;
        if (!isNaN(timestamp)) {
          date = new Date(timestamp).toISOString().slice(0, 10);
        }
      }
      if (!date) {
        const pubTimeEl = doc.getElementById('publish_time');
        if (pubTimeEl?.textContent) date = pubTimeEl.textContent.trim();
      }
      if (!date) {
        date = new Date().toISOString().slice(0, 10);
      }

      // 4. 提取正文
      const contentSelectors = ['#js_content', '#img-content', '.rich_media_content', '.article-content', 'article'];
      let contentBox: HTMLElement | null = null;
      for (const selector of contentSelectors) {
        contentBox = doc.querySelector(selector) as HTMLElement;
        if (contentBox) break;
      }

      if (!contentBox) {
        contentBox = doc.body;
        const unrelatedSelectors = ['header', 'nav', 'footer', '.header', '.nav', '.footer', '.ad', '.advertisement', '.share', '.comment', '#js_pc_qr_code'];
        unrelatedSelectors.forEach(selector => {
          contentBox!.querySelectorAll(selector).forEach(el => el.remove());
        });
      }

      const contentClone = contentBox!.cloneNode(true) as HTMLElement;

      // 应用强力清洗
      const cleanedContent = cleanWeChatHTML(contentClone.innerHTML);

      if (cleanedContent.length < 50) {
        throw new Error('清洗后内容过短');
      }

      return {
        title,
        content: cleanedContent,
        author,
        date
      };

    } catch (err) {
      console.warn(`代理 ${proxyUrl} 失败:`, err);
      lastError = err as Error;
      continue;
    }
  }

  throw lastError || new Error('无法抓取文章，请检查链接或稍后重试');
}
