/**
 * 知识图谱纯模块 - 类型定义与质量校验（零依赖，可在 jsdom/vitest 直接测试）
 *
 * 说明：原先与 `graph.ts` 同文件，`graph.ts` 间接依赖 pdfjs-dist（浏览器构建需 DOMMatrix，
 * jsdom 下无法 import）。纯逻辑下沉至此，`graph.ts` 回导，公共导出面不变。
 */

export interface KnowledgeNode {
    id: string;
    name: string;
    type: 'technology' | 'process' | 'material' | 'equipment' | 'concept';
    weight: number;
    description: string;
}

export interface KnowledgeLink {
    source: string;
    target: string;
    relationship: string;
    strength: number;
}

export interface KnowledgeGraphData {
    nodes: KnowledgeNode[];
    links: KnowledgeLink[];
}

export interface GraphQualityReport {
    nodeCount: number;
    linkCount: number;
    orphanNodeCount: number;
    orphanNodeNames: string[];
    typeDistribution: Record<string, number>;
    connectivityRatio: number;
    avgLinksPerNode: number;
    isValid: boolean;
    warnings: string[];
}

export function validateGraphQuality(data: KnowledgeGraphData): GraphQualityReport {
    const warnings: string[] = [];
    const nodeIds = new Set(data.nodes.map(n => n.id));

    const typeDistribution: Record<string, number> = {};
    for (const node of data.nodes) {
        typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
    }

    const validLinks = data.links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));
    const linkedNodeIds = new Set<string>();
    for (const link of validLinks) {
        linkedNodeIds.add(link.source);
        linkedNodeIds.add(link.target);
    }

    const orphanNodes = data.nodes.filter(n => !linkedNodeIds.has(n.id));
    const orphanNodeNames = orphanNodes.map(n => n.name);

    const connectivityRatio = data.nodes.length > 0 ? linkedNodeIds.size / data.nodes.length : 0;
    const avgLinksPerNode = data.nodes.length > 0 ? validLinks.length / data.nodes.length : 0;

    if (data.nodes.length < 20) {
        warnings.push(`节点数量偏少 (${data.nodes.length})，建议至少 20 个以保证图谱丰富度`);
    }
    if (orphanNodes.length > data.nodes.length * 0.3) {
        warnings.push(`孤立节点占比过高 (${orphanNodes.length}/${data.nodes.length})，可能遗漏了部分关系`);
    }
    if (validLinks.length < data.nodes.length * 0.8) {
        warnings.push(`连线数量偏少 (${validLinks.length})，图谱可能不够连通`);
    }
    if (connectivityRatio < 0.6) {
        warnings.push(`连通率偏低 (${(connectivityRatio * 100).toFixed(0)}%)，建议补充关系`);
    }
    const types = Object.keys(typeDistribution);
    if (types.length < 3) {
        warnings.push(`节点类型单一 (仅 ${types.join(', ')})，覆盖面可能不足`);
    }

    const ghostLinks = data.links.length - validLinks.length;
    if (ghostLinks > 0) {
        warnings.push(`已过滤 ${ghostLinks} 条幽灵连线（引用了不存在的节点）`);
    }

    return {
        nodeCount: data.nodes.length,
        linkCount: validLinks.length,
        orphanNodeCount: orphanNodes.length,
        orphanNodeNames,
        typeDistribution,
        connectivityRatio,
        avgLinksPerNode,
        isValid: warnings.filter(w => !w.includes('已过滤')).length === 0,
        warnings,
    };
}
