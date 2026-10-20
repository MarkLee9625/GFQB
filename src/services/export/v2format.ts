/**
 * R1-b/R3：阅读包 v2 数据布局（索引 + 按篇分块 + 媒体单编码）。
 *
 * v1 痛点：整包 JSON（含内层 base64 媒体）gzip 后再整体 base64 ——
 * 打开即克隆/解压/解析 200MB+，且媒体被双重 base64（×1.77）。
 *
 * v2 布局：
 *   meta    ：每篇小字段（id/标题/分类/排序/标签/摘要），gzip+base64，KB 级，秒开骨架
 *   bodies[]：每篇一包（媒体抽走后换 token 占位），各自 gzip+base64，按需解码
 *   media[] ：`mime,b64` 原始单编码，不 gzip（已压缩媒体压不动，省 CPU）
 *
 * 统一 token 设计：builder 先把文章 JSON 序列化为文本，再用正则把全部 data URI
 * 换成 `__SWS_M2_{n}__`（n = 全局媒体表下标，跨篇去重）；loader 解码 body 后先做
 * 文本级回填再 JSON.parse —— 两侧都不需要 schema 知识，cover/正文/blocks/pdf 全覆盖。
 * pdfData 裸 base64 先归一为 data URI 再抽取（回填后为 data URI 形态，阅读器双兼容）。
 * 构建时若原文已含完整 token 形态（`__SWS_M2_{数字}__`）直接抛错（宁可导出失败，
 * 不静默损坏）；裸前缀文本无害（回填正则只认完整形态），予以放行。
 *
 * 兼容：v1 文件无 v2 标记，阅读器走老路径；v2 文件带 `__SWS_FORMAT__='v2'`。
 * 本模块纯函数（无 DOM/Worker），导出 Worker 与阅读器 loader 共用，vitest 全覆盖。
 */
import type { Article } from '../../types/models';

export const V2_FORMAT_MARK = 'v2';
export const V2_MEDIA_TOKEN_PREFIX = '__SWS_M2_';

/**
 * R-D0：剥离可由 content 无损重算的 blocks（v1/v2 导出共用）。
 *
 * 背景：Article 双存储（content HTML + blocks）下媒体存两份，实测第3期阅读包
 * JSON 213MB 里视频/图片均 double（3 个视频 137MB 实为 68MB×2）。
 * blocks 恒由 content 经 htmlToBlocks 纯函数派生（id 是内容哈希，无随机因子），
 * 阅读器 ContentRenderer 本就内置 `blocks 缺失 → htmlToBlocks(content)` 回退，
 * 降级骨架只用 content——故有 content 时剥离 blocks 是无损的。
 * 保守规则：content 为空但 blocks 非空时保留（无法重算）；其余原样。
 * 已知边界：content 与 blocks 短暂不一致窗口（P0-B idle 补写前）导出的包，
 * 渲染口径从 blocks 版切到 content 版（更新的一版）。
 */
export function stripRedundantBlocks(articles: Article[]): { slim: Article[]; stripped: number; kept: number } {
  let stripped = 0;
  let kept = 0;
  const slim = articles.map((a) => {
    if (a.blocks && a.blocks.length > 0 && a.content && a.content.trim()) {
      stripped += 1;
      const { blocks: _omit, ...rest } = a;
      return rest as Article;
    }
    if (a.blocks && a.blocks.length > 0) kept += 1;
    return a;
  });
  return { slim, stripped, kept };
}
const V2_MEDIA_TOKEN_RE = /__SWS_M2_(\d+)__/g;
/** 完整 token 形态（回填正则只认它；裸前缀文本可安全通过，见 splitArticleMedia） */
const V2_MEDIA_TOKEN_FULL_RE = /__SWS_M2_\d+__/;
const DATA_URI_RE = /data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)/g;

/** 外壳渲染 + 预检索需要的最小字段（与 Article 对齐，缺 content/媒体） */
export interface ArticleShell {
  id: number;
  title: string;
  category: string;
  order: number;
  /** 是否有 PDF 附件（侧边栏角标用） */
  hasPdf: boolean;
  date?: string;
  issueText?: string;
  dateText?: string;
  tags?: string[];
  abstract?: string | null;
  fontSize?: number;
  lineHeight?: number;
}

export interface SplitArticle {
  /** 媒体抽走后的文章 JSON 文本（含 token） */
  bodyJson: string;
  /** 本篇外壳 */
  shell: ArticleShell;
}

export interface V2Manifest {
  shells: ArticleShell[];
  bodyJsons: string[];
  /** `mime,b64`，全局去重 */
  media: string[];
}

/** data URI 形态归一：pdfData 裸 base64 → data URI（阅读器双兼容，回填后统一为后者） */
export function normalizePdfData(article: Article): Article {
  const pdf = article.pdfData;
  if (typeof pdf === 'string' && pdf.length > 0 && !pdf.startsWith('data:')) {
    return { ...article, pdfData: `data:application/pdf;base64,${pdf}` };
  }
  return article;
}

export function pickShell(article: Article): ArticleShell {
  return {
    id: article.id,
    title: article.title,
    category: article.category,
    order: article.order ?? 0,
    hasPdf: !!article.pdfData,
    ...(article.date !== undefined ? { date: article.date } : {}),
    ...(article.issueText !== undefined ? { issueText: article.issueText } : {}),
    ...(article.dateText !== undefined ? { dateText: article.dateText } : {}),
    ...(article.tags !== undefined ? { tags: article.tags } : {}),
    ...(article.abstract !== undefined ? { abstract: article.abstract } : {}),
    ...(article.fontSize !== undefined ? { fontSize: article.fontSize } : {}),
    ...(article.lineHeight !== undefined ? { lineHeight: article.lineHeight } : {}),
  };
}

/**
 * 抽取单篇文章的媒体（JSON 文本级正则，全字段统一覆盖）。
 * @param mediaTable 全局媒体表（跨篇去重；`mime,b64` → 下标），调用方持有
 */
export function splitArticleMedia(
  article: Article,
  mediaTable: Map<string, number>,
  mediaList: string[]
): SplitArticle {
  const normalized = normalizePdfData(article);
  const json = JSON.stringify(normalized);
  // 只拒绝完整 token 形态：回填正则只认它，裸前缀文本可安全通过（防误杀教程类正文）
  if (V2_MEDIA_TOKEN_FULL_RE.test(json)) {
    throw new Error(`[v2] 文章 #${article.id} 正文含保留 token 形态，拒绝导出（防损坏）`);
  }
  const bodyJson = json.replace(DATA_URI_RE, (_m, mime: string, b64: string) => {
    const key = `${mime},${b64}`;
    let idx = mediaTable.get(key);
    if (idx === undefined) {
      idx = mediaList.length;
      mediaTable.set(key, idx);
      mediaList.push(key);
    }
    return `${V2_MEDIA_TOKEN_PREFIX}${idx}__`;
  });
  return { bodyJson, shell: pickShell(normalized) };
}

export function buildV2Manifest(articles: Article[]): V2Manifest {
  const mediaTable = new Map<string, number>();
  const media: string[] = [];
  const shells: ArticleShell[] = [];
  const bodyJsons: string[] = [];
  for (const a of articles) {
    const { bodyJson, shell } = splitArticleMedia(a, mediaTable, media);
    shells.push(shell);
    bodyJsons.push(bodyJson);
  }
  return { shells, bodyJsons, media };
}

/**
 * 组装 v2 注入脚本（纯函数；由导出 Worker 调用，主线程只做模板替换）。
 * 把 100MB 级数组拼串搬进 Worker，避免主线程同时持有克隆数组 + 拼接串 + 产物三份。
 * 字符串一律 JSON.stringify 包裹（不依赖"b64 无引号"隐式不变式），再转义 `</` 防破环。
 */
export function buildV2InjectionScript(parts: {
  metaB64: string;
  bodiesB64: string[];
  media: string[];
  configB64: string;
  compressionMethod: string;
}): string {
  const js = (s: string): string => JSON.stringify(s).replace(/<\//g, '<\\/');
  const arr = (xs: string[]): string => `[${xs.map(js).join(',')}]`;
  return `<script>window.__SWS_FORMAT__="v2";window.__SWS_V2_METHOD__=${js(parts.compressionMethod)};window.__SWS_V2_META_B64__=${js(parts.metaB64)};window.__SWS_V2_BODIES_B64__=${arr(parts.bodiesB64)};window.__SWS_V2_MEDIA__=${arr(parts.media)};window.__SWS_DATA_CONFIG_B64__=${js(parts.configB64)};window.__SWS_COMPRESSION_METHOD__=${js(parts.compressionMethod)};</script>`;
}

/**
 * 回填单篇 body（文本级替换后解析；缺失下标/越界即抛错，不静默）。
 * 注意：回填只认 `__SWS_M2_{n}__` token；body 文本本身不可能含完整形态（构建期已断言）。
 */
export function restoreV2Article(bodyJson: string, media: string[]): Article {
  const restored = bodyJson.replace(V2_MEDIA_TOKEN_RE, (_m, idx: string) => {
    const item = media[Number(idx)];
    if (item === undefined) throw new Error(`[v2] 媒体下标越界: ${idx}`);
    const comma = item.indexOf(',');
    if (comma <= 0) throw new Error(`[v2] 媒体条目损坏: ${idx}`);
    return `data:${item.slice(0, comma)};base64,${item.slice(comma + 1)}`;
  });
  return JSON.parse(restored) as Article;
}
