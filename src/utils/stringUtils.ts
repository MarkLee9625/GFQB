/**
 * HTML 文本转义：将特殊字符转为 HTML 实体
 */
export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * HTML 属性值转义：在 escapeHtml 基础上额外转义单引号
 */
export function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 提取富文本中的纯文本（供打印正文判定等）：去标签，解码命名实体与数字实体，压缩空白。
 */
export function getPlainText(html: string): string {
  return (html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, ' ')
    .replace(/&#(\d+);/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
