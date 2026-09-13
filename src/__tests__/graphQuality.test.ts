import { describe, it, expect } from 'vitest';
import { validateGraphQuality } from '../../services/ai/graphQuality';
import type { KnowledgeGraphData, KnowledgeNode } from '../../services/ai/graphQuality';

function node(id: string, type: KnowledgeNode['type'] = 'process', name?: string): KnowledgeNode {
    return { id, name: name ?? id, type, weight: 5, description: id };
}

function chainGraph(n: number): KnowledgeGraphData {
    const types: KnowledgeNode['type'][] = ['concept', 'material', 'process', 'technology', 'equipment'];
    const nodes = Array.from({ length: n }, (_, i) => node(`n${i}`, types[i % types.length], `节点${i}`));
    const links = [];
    for (let i = 0; i < n; i++) {
        links.push(
            { source: `n${i}`, target: `n${(i + 1) % n}`, relationship: '驱动', strength: 4 },
            { source: `n${i}`, target: `n${(i + 2) % n}`, relationship: '支撑', strength: 3 },
            { source: `n${(i + 3) % n}`, target: `n${i}`, relationship: '应用于', strength: 3 },
        );
    }
    return { nodes, links };
}

describe('validateGraphQuality', () => {
    it('健康图谱校验通过', () => {
        const report = validateGraphQuality(chainGraph(40));
        expect(report.nodeCount).toBe(40);
        expect(report.orphanNodeCount).toBe(0);
        expect(report.connectivityRatio).toBe(1);
        expect(report.isValid).toBe(true);
        expect(report.warnings).toHaveLength(0);
    });

    it('孤立节点被检出并列名（单个孤立未达阈值仍有效）', () => {
        const data = chainGraph(40);
        data.nodes.push(node('lonely', 'concept', '孤岛节点'));
        const report = validateGraphQuality(data);
        expect(report.orphanNodeCount).toBe(1);
        expect(report.orphanNodeNames).toContain('孤岛节点');
        expect(report.isValid).toBe(true);
    });

    it('孤立占比超三成则整体无效', () => {
        const data = chainGraph(10);
        for (let i = 0; i < 10; i++) data.nodes.push(node(`iso${i}`, 'concept', `孤岛${i}`));
        const report = validateGraphQuality(data);
        expect(report.warnings.some(w => w.includes('孤立节点占比过高'))).toBe(true);
        expect(report.isValid).toBe(false);
    });

    it('幽灵连线不计入且给出提示', () => {
        const data = chainGraph(40);
        data.links.push({ source: 'n0', target: 'ghost_node', relationship: '关联', strength: 1 });
        const report = validateGraphQuality(data);
        expect(report.linkCount).toBe(data.links.length - 1);
        expect(report.warnings.some(w => w.includes('幽灵连线'))).toBe(true);
    });

    it('节点过少与类型单一分别告警', () => {
        const few = validateGraphQuality({ nodes: [node('a'), node('b')], links: [] });
        expect(few.warnings.some(w => w.includes('节点数量偏少'))).toBe(true);

        const singleType = chainGraph(40);
        singleType.nodes.forEach(n => { n.type = 'process'; });
        const report = validateGraphQuality(singleType);
        expect(report.warnings.some(w => w.includes('类型单一'))).toBe(true);
    });

    it('空图谱不抛异常', () => {
        const report = validateGraphQuality({ nodes: [], links: [] });
        expect(report.nodeCount).toBe(0);
        expect(report.connectivityRatio).toBe(0);
    });
});
