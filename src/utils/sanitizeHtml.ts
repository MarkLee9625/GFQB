import DOMPurify from 'dompurify';
import { createLruCache } from './memoize';

/**
 * DOMPurify 净化结果缓存
 *
 * 正文由数百个 block 组成，内容字符串大量重复（段落/表格/列表），
 * 逐 block 调用 DOMPurify.sanitize 有明显开销。净化配置全局固定，
 * 输出确定，按输入字符串 LRU 缓存结果即可安全复用。
 */
const sanitizeCache = createLruCache<string>(500);

export function sanitizeHtml(html: string): string {
  const cached = sanitizeCache.get(html);
  if (cached !== undefined) return cached;
  const result = DOMPurify.sanitize(html);
  sanitizeCache.set(html, result);
  return result;
}
