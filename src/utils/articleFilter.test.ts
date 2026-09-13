import { describe, it, expect } from 'vitest';
import { normalizeArticleQuery, matchesArticleQuery, filterArticlesByQuery } from './articleFilter';
import type { Article } from '../types';

function makeArticle(partial: Partial<Article> & { id: number }): Article {
    return { title: '', category: '正文', content: '', ...partial };
}

describe('normalizeArticleQuery', () => {
    it('去空白并统一小写', () => {
        expect(normalizeArticleQuery('  焊接 ')).toBe('焊接');
        expect(normalizeArticleQuery('ABC')).toBe('abc');
    });

    it('空输入归一为空串', () => {
        expect(normalizeArticleQuery('')).toBe('');
        expect(normalizeArticleQuery('   ')).toBe('');
    });
});

describe('matchesArticleQuery', () => {
    it('空查询全量通过', () => {
        expect(matchesArticleQuery(makeArticle({ id: 1, title: '焊接' }), '')).toBe(true);
    });

    it('大小写不敏感命中标题', () => {
        expect(matchesArticleQuery(makeArticle({ id: 1, title: 'LNG动力系统' }), 'lng')).toBe(true);
        expect(matchesArticleQuery(makeArticle({ id: 1, title: '涂装防腐' }), '焊接')).toBe(false);
    });

    it('缺 title 的脏数据不抛异常', () => {
        const dirty = makeArticle({ id: 1 });
        delete (dirty as Partial<Article>).title;
        expect(() => matchesArticleQuery(dirty, '焊接')).not.toThrow();
        expect(matchesArticleQuery(dirty, '焊接')).toBe(false);
        expect(matchesArticleQuery(dirty, '')).toBe(true);
    });
});

describe('filterArticlesByQuery', () => {
    const list = [
        makeArticle({ id: 1, title: '船体焊接工艺' }),
        makeArticle({ id: 2, title: '涂装防腐' }),
        makeArticle({ id: 3, title: '封面', category: '封面' }),
    ];

    it('空查询返回原数组引用（memo 稳定）', () => {
        expect(filterArticlesByQuery(list, '')).toBe(list);
        expect(filterArticlesByQuery(list, '   ')).toBe(list);
    });

    it('按标题子串过滤，保持原顺序', () => {
        const result = filterArticlesByQuery(list, '焊接');
        expect(result.map(a => a.id)).toEqual([1]);
    });

    it('大小写不敏感', () => {
        const mixed = [makeArticle({ id: 1, title: 'LNG动力' }), makeArticle({ id: 2, title: 'lng应用' })];
        expect(filterArticlesByQuery(mixed, 'LNG').map(a => a.id)).toEqual([1, 2]);
    });
});
