import { createLruCache } from './memoize';

/**
 * 检查 HTML 是否是由系统生成的受信任知识图谱容器
 *
 * 系统生成的 graph HTML（graphRenderer.ts）具有以下不可伪造的结构特征：
 *   - 根元素是 knowledge-graph-container 并含 contenteditable="false"
 *   - 内部包含 <script type="text/plain"> 数据容器（DOMPurify 默认移除）
 *   - 内部包含 <iframe>（DOMPurify 默认移除）
 *
 * 通过验证这组结构特征而非单一 class name，防止攻击者注入伪装容器绕过净化。
 */
export function isSelfGeneratedHtml(html: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return false;

    // ① 根元素必须是 knowledge-graph-container（系统唯一注册的容器类）
    if (!root.classList.contains('knowledge-graph-container')) return false;

    // ② 必须有关闭编辑的属性（graphRenderer 生成时固定设置）
    if (root.getAttribute('contenteditable') !== 'false') return false;

    // ③ 必须包含系统内置的数据脚本容器（script[type=text/plain] by graphRenderer）
    const dataScript = root.querySelector('script[type="text/plain"]');
    if (!dataScript) return false;
    const scriptId = dataScript.getAttribute('id');
    if (!scriptId || !/^data-[\w-]+$/.test(scriptId)) return false;

    // ④ 必须包含 iframe 图谱渲染区域
    if (!root.querySelector('iframe')) return false;

    // ⑤ 加固：结构特征可伪造（如 <img onerror> 混入容器），
    // 必须同时通过危险注入检查：无事件属性、无 javascript: 协议、无危险标签
    const allEls = Array.from(root.querySelectorAll('*')).concat(root);
    for (const el of allEls) {
      const tag = el.tagName.toLowerCase();

      // script 仅放行系统数据容器（type=text/plain），其余一律拒绝
      if (tag === 'script' && el.getAttribute('type') !== 'text/plain') return false;
      if (['object', 'embed', 'base', 'meta', 'link', 'form'].includes(tag)) return false;

      // iframe 必须是无 src 的 srcdoc 渲染区（攻击者可注入外部 src）
      if (tag === 'iframe' && (el.getAttribute('src') || '').trim() !== '') return false;

      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const name = attr.name.toLowerCase();

        // 事件属性：仅放行系统模板 button 的 expand 按钮 onclick（app 未定义时无操作，无风险）
        if (name.startsWith('on')) {
          if (tag === 'button' && name === 'onclick' && attr.value.includes('app.toggleGraphExpand')) continue;
          return false;
        }

        // javascript:/data:text/html 协议注入
        if (['src', 'href', 'action', 'formaction', 'xlink:href'].includes(name)) {
          const v = (attr.value || '').trim().toLowerCase();
          if (v.startsWith('javascript:') || v.startsWith('data:text/html')) return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 图谱结构校验缓存：50KB+ 的图谱 HTML 每次挂载都做全量解析，
 * 校验是纯函数（结果只依赖 html 字符串），按字符串 LRU 缓存。
 */
const graphTrustCache = createLruCache<boolean>(50);

export function isSelfGeneratedHtmlCached(html: string): boolean {
  const cached = graphTrustCache.get(html);
  if (cached !== undefined) return cached;
  const result = isSelfGeneratedHtml(html);
  graphTrustCache.set(html, result);
  return result;
}
