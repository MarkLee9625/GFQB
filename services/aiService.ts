/**
 * AI 服务门面 - 保持原有 import 路径兼容（`services/aiService`）
 *
 * 实际实现已按职责拆分到 `services/ai/*`（Phase 1A 渐进优化）：
 * - client.ts  - BFF 传输层（超时/重试/截断）+ JSON 容错解析 + 共享类型
 * - meta.ts    - 标题/摘要/关键词、标题单生、文本扩写精简
 * - graph.ts   - 知识图谱类型/校验/提取/兜底/超级上下文
 * - preface.ts - 卷首语生成与导读上下文
 * - review.ts  - 选题批量评审与学术文献编译
 *
 * 本文件仅做 re-export，不含业务逻辑。调用方无需改动。
 */

export type { ArticleContextInput, ProgressCallback } from './ai/client';

export { generateArticleMeta, generateTitleOnly, scaleText } from './ai/meta';
export type { AIResult } from './ai/meta';

export {
    validateGraphQuality,
    extractGlobalKnowledgeGraph,
    buildSuperContextForGraph,
} from './ai/graph';
export type {
    KnowledgeNode,
    KnowledgeLink,
    KnowledgeGraphData,
    GraphQualityReport,
} from './ai/graph';

export { generateForeword, buildForewordContext } from './ai/preface';

export { batchEvaluateArticles, translateAndFormatAcademic } from './ai/review';
export type { AiEvaluationResult } from './ai/review';
