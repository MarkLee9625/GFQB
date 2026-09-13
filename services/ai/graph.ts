/**
 * AI 知识图谱模块 - 单次提取、孤立节点兜底、超级上下文组装
 * 类型与质量校验见零依赖的 ./graphQuality（此处回导，公共导出面不变）
 * 原 services/aiService.ts 对应部分原样迁移，行为不变
 */

import { extractAbstractFromPdf } from '../../src/services/pdf/index';
import {
    callDeepSeekAPI,
    robustJsonParse,
    REASONER_MODEL,
    GRAPH_TIMEOUT_SINGLE,
    type ArticleContextInput,
    type ProgressCallback,
} from './client';
import {
    validateGraphQuality,
    type KnowledgeGraphData,
    type KnowledgeLink,
    type KnowledgeNode,
} from './graphQuality';

export { validateGraphQuality };
export type { KnowledgeGraphData, KnowledgeLink, KnowledgeNode, GraphQualityReport } from './graphQuality';

export async function extractGlobalKnowledgeGraph(
    articlesText: string,
    onProgress?: ProgressCallback
): Promise<KnowledgeGraphData> {
    const progress = onProgress || (() => {});

    progress('知识图谱生成', '正在从全刊内容中一次性提取节点与关系 (约需 30-90 秒)...');

    const systemPrompt = `你是船舶海洋工程领域的资深技术专家。请一次性完成知识图谱的完整构建（节点 + 关系），不要分步回答。

【节点命名规范 ★最重要】
  name 必须是具体的、独一无二的技术实体名称，长度 2-12 字。
  ✅ 正确示例：船体焊接、舾装件标准化设计、激光复合焊、涂装防腐、分段吊装、压载水处理、LNG动力系统、爬壁机器人、数字孪生、总装精度控制
  ❌ 绝对禁止：技术、工艺、材料、设备、理念、概念、方法、系统 等万能通用词
  ❌ 同样禁止：焊接技术、涂装工艺、材料特性 等"X+类型名"的偷懒命名
  规则：name 中不得包含 type 字段的值

【节点数量与类型】
  提取 35-50 个节点。type 字段独立于 name：
  - technology(技术): 如"激光复合焊"
  - process(工艺): 如"分段涂装"
  - material(材料): 如"高强钢"
  - equipment(设备): 如"爬壁机器人"
  - concept(概念): 如"模块化设计"
  weight: 1-10 (9-10=核心主题, 7-8=关键支撑, 5-6=常规, 3-4=辅助, 1-2=边缘)
  ID: 纯英文小写+下划线，≤30字符，**必须全局唯一**（重复 id 会导致节点被丢弃）

【关系 ★必须包含，且数量不少于节点数×2.5】
  遵循 concept/material→process→technology/equipment 传递链。
  每个节点至少 2 条连线，孤立节点不可接受。
  links 的 source/target 必须引用 nodes 中已存在的 id，禁止使用未定义的 id。
  动词: 驱动/支撑/决定/控制/主导/影响/制约/应用于/服务于/实现/配套于/包含/属于/组成/依赖/基于/协同
  strength: 1-5 (5=强因果/直接依赖, 1=弱关联)

【输出格式】严格 JSON，无 markdown 包裹，一次性输出 nodes 和 links：
{"nodes":[{"id":"hull_welding","name":"船体焊接","type":"process","weight":8,"description":"船体结构焊接工艺"}],"links":[{"source":"hull_welding","target":"high_strength_steel","relationship":"依赖","strength":4}]}`;

    const userPrompt = `从以下内容一次性提取 35-50 个核心节点及关系（links 必须 ≥ 节点数×2.5）：\n\n${articlesText}`;

    try {
    let nodesResult: { nodes: KnowledgeNode[]; links?: KnowledgeLink[] } | null = null;
    let nodeRawText = '';
    const NODE_MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= NODE_MAX_RETRIES; attempt++) {
        try {
            nodeRawText = await callDeepSeekAPI({
                model: REASONER_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                timeoutMs: GRAPH_TIMEOUT_SINGLE,
            });

            nodesResult = robustJsonParse<{ nodes: KnowledgeNode[]; links?: KnowledgeLink[] }>(nodeRawText);

            if (!nodesResult.nodes || !Array.isArray(nodesResult.nodes) || nodesResult.nodes.length === 0) {
                throw new Error('未能识别到有效的 nodes 结构');
            }
            break; // 成功则跳出重试循环
        } catch (err: unknown) {
            if (attempt < NODE_MAX_RETRIES) {
                console.warn(`[aiService] Phase 1 解析失败 (尝试 ${attempt}/${NODE_MAX_RETRIES})，准备重试:`, err instanceof Error ? err.message : String(err));
                continue;
            }
            throw err; // 最后一次失败则向外抛出
        }
    }

    if (!nodesResult) throw new Error('Phase 1: 所有重试均未能获取有效节点');
    const initialLinks: KnowledgeLink[] = Array.isArray(nodesResult.links) ? nodesResult.links : [];

        const VALID_TYPES = new Set(['technology', 'process', 'material', 'equipment', 'concept']);
        const TYPE_ALIASES: Record<string, string> = {
            technique: 'technology', method: 'process', tech: 'technology',
            material_type: 'material', equip: 'equipment', tool: 'equipment',
            concept_type: 'concept', theory: 'concept', principle: 'concept',
            procedure: 'process', step: 'process', operation: 'process',
            device: 'equipment', system: 'equipment', facility: 'equipment',
            substance: 'material', alloy: 'material', coating: 'material',
        };

        const seenIds = new Set<string>();
        const seenNames = new Set<string>();
        // 通用词黑名单：禁止 AI 将类型标签偷懒用作节点名
        const GENERIC_NAME_PATTERNS = [
          /^技术$/, /^工艺$/, /^材料$/, /^设备$/, /^理念$/, /^概念$/, /^方法$/, /^系统$/,
          /^technology$/i, /^process$/i, /^material$/i, /^equipment$/i, /^concept$/i,
          /^.{0,2}(技术|工艺|材料|设备|理念|概念|方法|系统)$/, // "X技术""XX工艺"等偷懒命名
        ];
        function isGenericName(name: string): boolean {
          if (!name || name.length <= 1) return true;
          return GENERIC_NAME_PATTERNS.some(p => p.test(name));
        }
        let genericFilteredCount = 0;
        nodesResult.nodes = nodesResult.nodes.filter(node => {
            if (!node.id || !node.name) return false;
            node.id = String(node.id).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            if (!node.id || node.id.length < 1) return false;
            if (seenIds.has(node.id)) return false;
            seenIds.add(node.id);
            if (seenNames.has(node.name)) return false;
            if (isGenericName(node.name)) { genericFilteredCount++; return false; }
            seenNames.add(node.name);
            const normalizedType = (node.type || '').toLowerCase().trim();
            node.type = (VALID_TYPES.has(normalizedType) ? normalizedType : (TYPE_ALIASES[normalizedType] || 'concept')) as KnowledgeNode['type'];
            node.weight = Math.max(1, Math.min(10, Math.round(Number(node.weight) || 5)));
            node.description = (node.description || node.name).substring(0, 80);
            return true;
        });

        if (genericFilteredCount > 0) {
          console.log(`[aiService] [安检] 过滤了 ${genericFilteredCount} 个通用词节点（如"技术""工艺"等偷懒命名）`);
        }
        console.log(`[aiService] 图谱生成完成，获得 ${nodesResult.nodes.length} 个节点，${initialLinks.length} 条关系（清洗后）。`);
        progress('处理中', `已提取 ${nodesResult.nodes.length} 个节点和 ${initialLinks.length} 条关系...`);

        const allLinks: KnowledgeLink[] = initialLinks.filter(l => {
            if (!l.source || !l.target || l.source === l.target) return false;
            l.source = String(l.source).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            l.target = String(l.target).replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            const strongRels = ['驱动', '支撑', '决定', '转化', '依赖', '控制', '主导'];
            const weakRels = ['关联', '涉及', '相关', '包含', '具有'];
            const rel = l.relationship || '关联';
            if (strongRels.some(r => rel.includes(r))) {
                l.strength = Math.max(1, Math.min(5, Math.round(Number(l.strength) || 4)));
            } else if (weakRels.some(r => rel.includes(r))) {
                l.strength = Math.max(1, Math.min(5, Math.round(Number(l.strength) || 2)));
            } else {
                l.strength = Math.max(1, Math.min(5, Math.round(Number(l.strength) || 3)));
            }
            l.relationship = rel.substring(0, 20);
            return l.source !== l.target;
        });

        const nodeIds = new Set(nodesResult.nodes.map(n => n.id));
        const finalData: KnowledgeGraphData = {
            nodes: nodesResult.nodes,
            links: allLinks.filter(l =>
                nodeIds.has(l.source) && nodeIds.has(l.target)
            ),
        };

        progress('质量校验', `图谱合成完成，正在进行质量校验...`);

        const qualityReport = validateGraphQuality(finalData);
        console.log('[aiService] 质量校验报告:', qualityReport);

        // 规则兜底：孤立节点用同类型最近节点连接
        if (qualityReport.orphanNodeCount > 0) {
            console.log(`[aiService] 检测到 ${qualityReport.orphanNodeCount} 个孤立节点，规则兜底...`);
            const fallbackLinks = generateFallbackLinks(finalData);
            finalData.links = [...finalData.links, ...fallbackLinks];
            const updatedReport = validateGraphQuality(finalData);
            console.log('[aiService] 兜底后质量:', updatedReport);
        }

        console.log('[aiService] 知识图谱提取完成（单次调用），最终节点:', finalData.nodes.length, '关系:', finalData.links.length);
        return finalData;

    } catch (error) {
        console.error('[aiService] 知识图谱提取失败:', error);
        throw error;
    }
}

/* ========== 辅助函数 ========== */

function generateFallbackLinks(currentData: KnowledgeGraphData): KnowledgeLink[] {
    const linkedNodeIds = new Set<string>();
    for (const link of currentData.links) {
        linkedNodeIds.add(link.source);
        linkedNodeIds.add(link.target);
    }
    const orphanNodes = currentData.nodes.filter(n => !linkedNodeIds.has(n.id));
    if (orphanNodes.length === 0) return [];

    const fallbackLinks: KnowledgeLink[] = [];
    const processNodes = currentData.nodes.filter(n => n.type === 'process');
    const techNodes = currentData.nodes.filter(n => n.type === 'technology');
    const materialNodes = currentData.nodes.filter(n => n.type === 'material');


    for (const orphan of orphanNodes) {
        const usedTargetIds = new Set<string>();

        if (orphan.type === 'concept' || orphan.type === 'material') {
            const relationship = orphan.type === 'material' ? '用于' : '指导';
            const candidates = processNodes.filter(p => p.id !== orphan.id && !fallbackLinks.some(l => l.source === orphan.id && l.target === p.id));
            candidates.slice(0, 2).forEach((target, idx) => {
                fallbackLinks.push({ source: orphan.id, target: target.id, relationship: idx === 0 ? relationship : '配合', strength: 3 - idx });
                usedTargetIds.add(target.id);
            });
        } else if (orphan.type === 'process') {
            const candidates = techNodes.filter(t => t.id !== orphan.id && !fallbackLinks.some(l => l.source === t.id && l.target === orphan.id));
            candidates.slice(0, 2).forEach((target, idx) => {
                fallbackLinks.push({ source: target.id, target: orphan.id, relationship: idx === 0 ? '实现' : '支撑', strength: 3 - idx });
                usedTargetIds.add(target.id);
            });
            // 如果还没有连线，再尝试连 material
            if (usedTargetIds.size === 0) {
                const mCandidates = materialNodes.filter(m => m.id !== orphan.id && !fallbackLinks.some(l => l.source === m.id && l.target === orphan.id));
                if (mCandidates.length > 0) {
                    fallbackLinks.push({ source: mCandidates[0].id, target: orphan.id, relationship: '用于', strength: 2 });
                }
            }
        } else if (orphan.type === 'equipment') {
            const candidates = processNodes.filter(p => p.id !== orphan.id && !fallbackLinks.some(l => l.source === orphan.id && l.target === p.id));
            candidates.slice(0, 2).forEach((target, idx) => {
                fallbackLinks.push({ source: orphan.id, target: target.id, relationship: idx === 0 ? '服务于' : '配套于', strength: 3 - idx });
                usedTargetIds.add(target.id);
            });
        } else {
            // technology 或其他类型
            const candidates = processNodes.filter(p => p.id !== orphan.id && !fallbackLinks.some(l => l.source === orphan.id && l.target === p.id));
            if (candidates.length > 0) {
                fallbackLinks.push({ source: orphan.id, target: candidates[0].id, relationship: '应用于', strength: 2 });
            }
        }
    }
    return fallbackLinks;
}

export async function buildSuperContextForGraph(articles: ArticleContextInput[]): Promise<string> {
    console.log(`[aiService] 开始为 ${articles.length} 篇文章组装超级上下文...`);

    const allTexts: string[] = [];
    const pdfTasks: { index: number; title: string; data: string }[] = [];

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`[aiService] 处理第 ${i+1}/${articles.length} 篇: "${article.title}"`);

        if (article.content && article.content.trim().length > 10) {
            const plainText = article.content.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ').trim();
            allTexts.push(`【文章 ${i+1}】${article.title}\n${plainText.substring(0, 15000)}`);
        } else if (article.abstract && article.abstract.trim().length > 10) {
            allTexts.push(`【文章 ${i+1}】${article.title}\n${article.abstract.substring(0, 5000)}`);
        }

        // 仅登记 PDF 任务参数（真正提取在下方分批启动，避免任务创建即并发导致 OOM）
        const pdfData = article.pdfData;
        if (pdfData && pdfData.trim().length > 100) {
            pdfTasks.push({ index: i, title: article.title, data: pdfData });
        }
    }

    // 分批并发提取 PDF（每批 4 个，真实限制同时进行的提取数）
    if (pdfTasks.length > 0) {
        const PDF_CONCURRENCY = 4;
        console.log(`[aiService] 等待 ${pdfTasks.length} 个 PDF 分批提取（每批 ${PDF_CONCURRENCY} 个）...`);
        for (let batchStart = 0; batchStart < pdfTasks.length; batchStart += PDF_CONCURRENCY) {
            const batch = pdfTasks.slice(batchStart, batchStart + PDF_CONCURRENCY);
            await Promise.allSettled(
                batch.map(async ({ index, title, data }) => {
                    console.log(`[aiService]   检测到 PDF 附件 #${index + 1}，开始静默抽字...`);
                    try {
                        const result = await extractAbstractFromPdf(data, 5, 20000);
                        if (result.success && result.fullText && result.fullText.trim().length > 50) {
                            allTexts.push(`【PDF ${index + 1}】${title}\n${result.fullText.substring(0, 20000)}`);
                            console.log(`[aiService]   PDF #${index + 1} 抽字成功，提取 ${result.fullText.length} 字`);
                        }
                    } catch (pdfErr) {
                        console.warn(`[aiService]   PDF #${index + 1} 提取异常:`, pdfErr);
                    }
                })
            );
        }
    }

    const combinedText = allTexts.join('\n\n');
    console.log(`[aiService] 超级上下文组装完成，总长度: ${combinedText.length}`);
    return combinedText;
}
