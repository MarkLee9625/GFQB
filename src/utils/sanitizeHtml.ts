import DOMPurify from 'dompurify';
import { createLruCache } from './memoize';
import { MEDIA_REF_SCHEME } from './mediaRefs';

/**
 * DOMPurify 净化结果缓存
 *
 * 正文由数百个 block 组成，内容字符串大量重复（段落/表格/列表），
 * 逐 block 调用 DOMPurify.sanitize 有明显开销。净化配置全局固定，
 * 输出确定，按输入字符串 LRU 缓存结果即可安全复用。
 */
const sanitizeCache = createLruCache<string>(500);

/**
 * P0-A：媒体引用 `sws-media://{hash}` 必须能通过净化。
 *
 * DOMPurify 默认 URI 白名单不含该 scheme，实测会把 `<img src="sws-media://…">` 的 src 静默删除
 * （阅读态行内图片消失）。这里**不改写 `ALLOWED_URI_REGEXP`**——那会把 URI 策略冻结在抄写时的
 * DOMPurify 版本上、并可能漏掉默认列表里的 scheme（实测默认含 `matrix:`）；改用官方 hook，
 * 只对"值以 `sws-media://` 开头的 `src`"强制保留：
 * 其余标签/属性/协议判定完全走 DOMPurify 默认逻辑，未来升级 DOMPurify 自动生效。
 */
let hookInstalled = false;
function ensureMediaRefHook(): void {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (
      data.attrName === 'src' &&
      typeof data.attrValue === 'string' &&
      data.attrValue.startsWith(MEDIA_REF_SCHEME)
    ) {
      data.forceKeepAttr = true;
    }
  });
}

export function sanitizeHtml(html: string): string {
  const cached = sanitizeCache.get(html);
  if (cached !== undefined) return cached;
  ensureMediaRefHook();
  const result = DOMPurify.sanitize(html);
  sanitizeCache.set(html, result);
  return result;
}
