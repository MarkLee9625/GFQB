/**
 * 统一的文章渲染器组件导出
 * 
 * 使用示例：
 * ```tsx
 * import { ArticleRenderer } from './renderers';
 * 
 * // 编辑模式
 * <ArticleRenderer
 *   article={article}
 *   mode="edit"
 *   onArticleUpdate={handleUpdate}
 * />
 * 
 * // 阅读模式
 * <ArticleRenderer
 *   article={article}
 *   mode="read"
 * />
 * 
 * // 打印模式
 * <ArticleRenderer
 *   article={article}
 *   mode="print"
 * />
 * ```
 */

export {
  ArticleRenderer,
  CoverRenderer,
  BackRenderer,
  ContentRenderer
} from './ArticleRenderer';

export type {
  ArticleRendererProps,
  ArticleRendererBaseProps,
  ArticleRendererEditProps,
  ArticleRendererReadProps,
  ArticleRendererPrintProps
} from './ArticleRenderer';
