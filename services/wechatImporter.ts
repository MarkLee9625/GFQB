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
 * 进度回调函数类型
 */
export type ImportProgressCallback = (stage: string, details: string) => void;

/**
 * 下载图片并转换为 Base64 格式
 * 使用代理服务器绕过跨域限制
 */
async function downloadImageAsBase64(url: string): Promise<string> {
  // 尝试多个代理服务器
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=webp&q=85`
  ];

  for (const proxyUrl of proxies) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15秒超时

      const response = await fetch(proxyUrl, {
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const blob = await response.blob();

      // 检查文件大小（限制5MB）
      if (blob.size > 5 * 1024 * 1024) {
        console.warn(`[WechatImporter] Image too large (${(blob.size / 1024 / 1024).toFixed(2)}MB):`, url);
        throw new Error('Image size exceeds 5MB');
      }

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn(`[WechatImporter] Proxy failed for image:`, proxyUrl.substring(0, 50), err);
      continue;
    }
  }

  // 所有代理都失败，返回原始URL作为降级
  console.warn(`[WechatImporter] All proxies failed for image, using original URL:`, url);
  return url;
}

/**
 * 强力清洗微信HTML内容，解决无法删除的空行/占位符问题
 * @param html 原始HTML内容
 * @param onProgress 进度回调（可选）
 */
async function cleanWeChatHTML(html: string, onProgress?: ImportProgressCallback): Promise<string> {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // --- Step A: 图片处理与 Base64 转换 ---
  const images = doc.querySelectorAll('img');
  const totalImages = images.length;

  if (totalImages > 0) {
    onProgress?.('downloading_images', `正在下载 ${totalImages} 张图片...`);
  }

  const imagePromises = Array.from(images).map(async (img, index) => {
    try {
      // 优先获取真实地址
      const src = img.getAttribute('data-src') || img.getAttribute('src');
      if (!src) return;

      // 记录原始地址
      img.setAttribute('data-original-src', src);
      img.removeAttribute('data-src');

      // 下载并转换为 Base64
      onProgress?.('downloading_images', `正在下载图片 ${index + 1}/${totalImages}...`);
      const base64 = await downloadImageAsBase64(src);
      img.src = base64;

      // 移除无关干扰属性
      ['data-w', 'data-type', 'data-ratio', 'class', 'style', 'crossorigin'].forEach(attr => {
        img.removeAttribute(attr);
      });

      // 规范化样式
      Object.assign(img.style, {
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        margin: '20px auto',
        borderRadius: '4px'
      });
      img.setAttribute('data-sws-keep', 'true');
    } catch (err) {
      console.warn('[WechatImporter] Image processing failed:', img.src, err);
      // 失败时保留原始URL
    }
  });

  // 等待所有图片下载完成
  await Promise.all(imagePromises);

  // --- Step B: 结构清洗与扁平化 ---
  // 移除 section 包裹，防止样式污染
  doc.querySelectorAll('section').forEach(section => {
    while (section.firstChild) {
      section.parentNode?.insertBefore(section.firstChild, section);
    }
    section.remove();
  });

  // 移除非法/垃圾标签
  const unwantedTags = ['iframe', 'script', 'style', 'link', 'meta', 'noscript', 'wx-open-launch-weapp'];
  unwantedTags.forEach(tag => doc.querySelectorAll(tag).forEach(el => el.remove()));

  // 移除所有元素的无用属性
  doc.querySelectorAll('*').forEach(el => {
    if (el.tagName.toLowerCase() === 'img') return;
    ['id', 'class', 'style', 'width', 'height'].forEach(attr => el.removeAttribute(attr));

    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name.startsWith('wx-')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // --- Step C: 智能截断 (截掉广告、版权信息) ---
  const footerKeywords = ['扫描二维码', '关注公众号', '点击上方', '点分享', '点收藏', '点在看', '长按识别', '喜欢作者'];
  const endMarkers = /^(end|the end|完|全文完|—END—|END)$/i;

  const nodes = Array.from(doc.querySelectorAll('p, div, span, strong, section'));
  const totalNodes = nodes.length;

  for (let i = 0; i < totalNodes; i++) {
    const el = nodes[i];
    const text = el.textContent?.trim() || '';

    // 1. END 标记检测 (仅在文章后 40% 范围内检测，防止误杀)
    if (i > totalNodes * 0.6 && endMarkers.test(text) && text.length < 15) {
      console.log('[WechatImporter] Detect END marker:', text);
      // 移除该节点及其之后的所有内容
      while (el.nextSibling) el.nextSibling.remove();
      el.remove();
      break;
    }

    // 2. 关键词底部清理
    if (footerKeywords.some(kw => text.includes(kw)) && text.length < 100) {
      // 如果是后部的短文本包含关键词，则认为可能是广告
      if (i > totalNodes * 0.7) {
        el.remove();
      }
    }
  }

  // --- Step D: 移除空标签 ---
  doc.querySelectorAll('p, div, span').forEach(el => {
    if (el.tagName.toLowerCase() === 'img') return;
    if (!el.textContent?.trim() && !el.querySelector('img')) {
      el.remove();
    }
  });

  let output = doc.body.innerHTML;
  // 清理多余换行
  output = output.replace(/<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');
  output = output.replace(/(<br\s*\/?>\s*)+/gi, '<br>');

  return output;
}

/**
 * 代理服务器配置接口
 */
interface ProxyConfig {
  name: string;
  url: string;
  healthCheckUrl?: string;
}

/**
 * 测试代理服务器健康状态
 */
async function testProxyHealth(proxy: ProxyConfig): Promise<boolean> {
  if (!proxy.healthCheckUrl) return true; // 没有健康检查URL，默认认为可用

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(proxy.healthCheckUrl, {
      signal: controller.signal,
      mode: 'no-cors' // 健康检查可能会有CORS问题，使用no-cors模式
    });
    clearTimeout(timeout);
    return true; // 只要请求成功就认为可用
  } catch {
    return false;
  }
}

/**
 * 并发获取内容（Race Strategy + 健康检测）
 */
async function fetchHtmlWithProxies(url: string, onProgress?: ImportProgressCallback): Promise<string> {
  const proxies: ProxyConfig[] = [
    {
      name: 'AllOrigins (推荐)',
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      healthCheckUrl: 'https://api.allorigins.win/info'
    },
    {
      name: 'CorsProxy',
      url: `https://corsproxy.io/?${encodeURIComponent(url)}`
    },
    {
      name: 'CodeTabs',
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    }
  ];

  // 错误收集器
  const errors: { proxy: string; error: string }[] = [];

  // 包装每个请求
  const fetchTasks = proxies.map(async (proxy) => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 25000); // 单个代理 25s 超时

      onProgress?.('fetching', `正在通过 ${proxy.name} 获取文章...`);

      const res = await fetch(proxy.url, { signal: controller.signal });
      clearTimeout(tid);

      if (!res.ok) {
        const errorMsg = `HTTP ${res.status} ${res.statusText}`;
        errors.push({ proxy: proxy.name, error: errorMsg });
        throw new Error(errorMsg);
      }

      let html = '';
      if (proxy.name.includes('AllOrigins')) {
        const json = await res.json();
        html = json.contents;
      } else {
        html = await res.text();
      }

      // 内容长度验证（降低阈值到200）
      if (!html || html.length < 200) {
        const errorMsg = `Content too short (${html?.length || 0} chars)`;
        errors.push({ proxy: proxy.name, error: errorMsg });
        throw new Error(errorMsg);
      }

      // 内容格式验证
      if (!html.includes('rich_media_content') && !html.includes('js_content')) {
        const errorMsg = 'Invalid WeChat article format';
        errors.push({ proxy: proxy.name, error: errorMsg });
        throw new Error(errorMsg);
      }

      console.log(`[WechatImporter] ✅ ${proxy.name} 成功获取文章`);
      return html;
    } catch (e: any) {
      const errorMsg = e.message || 'Unknown error';
      if (!errors.find(err => err.proxy === proxy.name)) {
        errors.push({ proxy: proxy.name, error: errorMsg });
      }
      console.warn(`[WechatImporter] ❌ ${proxy.name} 失败:`, errorMsg);
      throw e;
    }
  });

  // 使用 Promise.any 获得第一个成功的结果
  try {
    onProgress?.('fetching', '正在通过全球加速网络获取文章...');
    return await Promise.any(fetchTasks);
  } catch (err) {
    // 生成详细的错误报告
    const errorReport = errors.map(e => `  • ${e.proxy}: ${e.error}`).join('\n');

    const detailedError = `所有代理均响应失败，请检查：

【失败详情】
${errorReport}

【可能原因】
1. 链接格式不正确（请确认是微信公众号文章链接）
2. 文章已被删除或设置为私密
3. 网络连接不稳定
4. 代理服务器临时故障

【建议操作】
• 复制正确的微信文章链接（应包含 mp.weixin.qq.com）
• 检查网络连接是否正常
• 稍后重试`;

    throw new Error(detailedError);
  }
}

/**
 * 抓取并清洗微信公众号文章
 */
export async function fetchWechatArticle(url: string, onProgress?: ImportProgressCallback): Promise<WechatArticleResult> {
  try {
    const htmlContent = await fetchHtmlWithProxies(url, onProgress);

    onProgress?.('parsing', '正在解析文章结构...');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // 1. 提取标题
    const title = doc.querySelector('#activity-name, .rich_media_title, title')?.textContent?.trim() || '未命名文章';

    // 2. 提取作者/公众号
    const author = doc.querySelector('#js_name, .profile_nickname, .rich_media_meta_nickname')?.textContent?.trim() || '';

    // 3. 提取时间（多种fallback方案）
    let date = '';
    const scripts = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const fullHtml = doc.documentElement.innerHTML;

    // 多种时间提取模式
    const timePatterns = [
      /var\s+ct\s*=\s*"(\d+)"/,                    // 旧版微信 (ct变量)
      /var\s+createTime\s*=\s*['"](\d+)['"]/,     // 新版微信 (createTime变量)
      /publish_time['"]?\s*[:=]\s*['"]?(\d+)/,    // publish_time属性
      /"pubtime"\s*:\s*(\d+)/,                     // JSON格式的pubtime
    ];

    for (const pattern of timePatterns) {
      const match = scripts.match(pattern) || fullHtml.match(pattern);
      if (match?.[1]) {
        const timestamp = parseInt(match[1], 10);
        // 验证时间戳合法性（应该在2010年之后且不超过当前时间）
        const minValidTimestamp = 1262304000; // 2010-01-01
        const maxValidTimestamp = Math.floor(Date.now() / 1000) + 86400; // 当前时间+1天

        if (timestamp >= minValidTimestamp && timestamp <= maxValidTimestamp) {
          date = new Date(timestamp * 1000).toISOString().slice(0, 10);
          console.log(`[WechatImporter] ✅ 成功提取时间: ${date} (来源: ${pattern.source.substring(0, 20)}...)`);
          break;
        } else {
          console.warn(`[WechatImporter] ⚠️ 时间戳不合法: ${timestamp}`);
        }
      }
    }

    // 最后的fallback：使用DOM元素或当前日期
    if (!date) {
      const publishTimeEl = doc.getElementById('publish_time');
      if (publishTimeEl?.textContent?.trim()) {
        date = publishTimeEl.textContent.trim();
      } else {
        date = new Date().toISOString().slice(0, 10);
        console.warn('[WechatImporter] ⚠️ 未能提取文章时间，使用当前日期');
      }
    }

    // 4. 提取正文内容框
    const contentBox = doc.querySelector('#js_content, .rich_media_content');
    if (!contentBox) {
      throw new Error('未能识别到微信正文区域 (js_content)');
    }

    onProgress?.('cleaning', '正在移除广告与冗余标签...');
    const cleanedContent = await cleanWeChatHTML(contentBox.innerHTML, onProgress);

    onProgress?.('complete', '抓取完成！');
    return { title, content: cleanedContent, author, date };
  } catch (err: any) {
    console.error('[WechatImporter] Error:', err);
    throw err;
  }
}
