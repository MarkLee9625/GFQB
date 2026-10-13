import { describe, it, expect } from 'vitest';
import {
  rebuildAbstract,
  normalizeDoi,
  paperDedupeKey,
  dedupePapers,
  filterPapersByQuality,
  mapOpenAlexWork,
  parseArxivFeed,
  yearRangeFromDate,
  buildOpenAlexUrl,
  MIN_ABSTRACT_CHARS,
  type OpenAlexWork,
} from './paperFetcher';
import type { UniversalArticleMeta } from '../../types';

function makePaper(overrides: Partial<UniversalArticleMeta> = {}): UniversalArticleMeta {
  return {
    id: Math.random().toString(36).substring(2, 11),
    sourceType: 'paper',
    sourceName: 'OpenAlex',
    title: 'A Study of Ship Welding',
    content: '摘要: placeholder',
    decision: 'pending',
    ...overrides,
  };
}

describe('rebuildAbstract', () => {
  it('按位置还原 inverted index', () => {
    const index = { world: [1], Hello: [0], 'wide-ship': [2] };
    expect(rebuildAbstract(index)).toBe('Hello world wide-ship');
  });

  it('同一词多位置按位次展开', () => {
    const index = { ship: [0, 2], builds: [1] };
    expect(rebuildAbstract(index)).toBe('ship builds ship');
  });

  it('null / undefined / 非法输入返回空串', () => {
    expect(rebuildAbstract(null)).toBe('');
    expect(rebuildAbstract(undefined)).toBe('');
    expect(rebuildAbstract({ bad: 'not-array' } as unknown as Record<string, number[]>)).toBe('');
  });
});

describe('normalizeDoi', () => {
  it('剥离 doi.org 前缀', () => {
    expect(normalizeDoi('https://doi.org/10.1016/j.oceaneng.2023.115001')).toBe('10.1016/j.oceaneng.2023.115001');
    expect(normalizeDoi('http://dx.doi.org/10.1000/xyz')).toBe('10.1000/xyz');
  });

  it('空值返回空串', () => {
    expect(normalizeDoi(null)).toBe('');
    expect(normalizeDoi(undefined)).toBe('');
  });
});

describe('paperDedupeKey / dedupePapers', () => {
  it('优先 DOI 去重', () => {
    const a = makePaper({ doi: '10.1/x', url: 'https://example.com/a' });
    const b = makePaper({ doi: '10.1/X', url: 'https://other.dev/b' });
    expect(paperDedupeKey(a)).toBe(paperDedupeKey(b));
    expect(dedupePapers([a, b])).toHaveLength(1);
  });

  it('无 DOI 时按 URL，再按归一化标题', () => {
    const byUrl1 = makePaper({ url: 'https://example.com/p/1/' });
    const byUrl2 = makePaper({ url: 'http://www.example.com/p/1' });
    expect(paperDedupeKey(byUrl1)).toBe(paperDedupeKey(byUrl2));

    const t1 = makePaper({ title: 'Auto-Mated Welding! Process' });
    const t2 = makePaper({ title: 'auto mated welding process' });
    expect(paperDedupeKey(t1)).toBe(paperDedupeKey(t2));
  });

  it('与已有列表（existing）去重', () => {
    const existing = [makePaper({ doi: '10.1/x' })];
    const incoming = [makePaper({ doi: '10.1/x' }), makePaper({ doi: '10.1/y' })];
    expect(dedupePapers(incoming, existing)).toHaveLength(1);
  });
});

describe('filterPapersByQuality', () => {
  it('过滤摘要短于门槛的条目', () => {
    const long = makePaper({ abstract: 'a'.repeat(MIN_ABSTRACT_CHARS) });
    const short = makePaper({ abstract: 'short' });
    const none = makePaper({ abstract: undefined });
    expect(filterPapersByQuality([long, short, none])).toEqual([long]);
  });

  it('全部不合格时回退保留原结果（避免空页死局）', () => {
    const short = makePaper({ abstract: 'short' });
    expect(filterPapersByQuality([short])).toEqual([short]);
  });
});

describe('mapOpenAlexWork', () => {
  const work: OpenAlexWork = {
    id: 'https://openalex.org/W4321',
    doi: 'https://doi.org/10.1016/j.oceaneng.2023.115001',
    title: 'Robotic welding for ship hull blocks',
    publication_year: 2023,
    publication_date: '2023-06-01',
    cited_by_count: 42,
    abstract_inverted_index: { robotic: [0], welding: [1], hull: [2] },
    authorships: [
      { author: { display_name: 'Zhang San' } },
      { author: { display_name: 'Li Si' } },
    ],
    primary_location: { source: { display_name: 'Ocean Engineering' } },
  };

  it('映射核心字段（无 [专利] 前缀、sourceType=paper）', () => {
    const mapped = mapOpenAlexWork(work);
    expect(mapped).not.toBeNull();
    expect(mapped!.sourceType).toBe('paper');
    expect(mapped!.title).toBe('Robotic welding for ship hull blocks');
    expect(mapped!.journal).toBe('Ocean Engineering');
    expect(mapped!.year).toBe(2023);
    expect(mapped!.citationCount).toBe(42);
    expect(mapped!.doi).toBe('10.1016/j.oceaneng.2023.115001');
    expect(mapped!.url).toBe('https://doi.org/10.1016/j.oceaneng.2023.115001');
    expect(mapped!.abstract).toBe('robotic welding hull');
    expect(mapped!.authors).toEqual(['Zhang San', 'Li Si']);
    expect(mapped!.sourceName).toContain('OpenAlex');
    expect(mapped!.sourceName).toContain('Ocean Engineering');
    expect(mapped!.sourceName).toContain('被引 42');
  });

  it('content 含期刊/作者/被引/DOI，供 AI 编译取材', () => {
    const mapped = mapOpenAlexWork(work)!;
    expect(mapped.content).toContain('期刊/来源: Ocean Engineering');
    expect(mapped.content).toContain('Zhang San, Li Si');
    expect(mapped.content).toContain('DOI: 10.1016/j.oceaneng.2023.115001');
    expect(mapped.content).toContain('摘要: robotic welding hull');
  });

  it('无标题返回 null', () => {
    expect(mapOpenAlexWork({ display_name: '   ' })).toBeNull();
  });
});

describe('parseArxivFeed', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>  Hull Block Assembly
      with Digital Twins </title>
    <summary>A digital twin framework for hull block assembly.</summary>
    <published>2024-01-02T00:00:00Z</published>
    <author><name>Wang Wu</name></author>
    <author><name>Zhao Liu</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.00002v1</id>
    <title></title>
    <summary>no title entry</summary>
    <published>2024-01-03T00:00:00Z</published>
  </entry>
</feed>`;

  it('解析条目并跳过无标题项', () => {
    const items = parseArxivFeed(xml);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.title).toBe('Hull Block Assembly with Digital Twins');
    expect(item.sourceType).toBe('paper');
    expect(item.sourceName).toBe('arXiv');
    expect(item.url).toBe('http://arxiv.org/abs/2401.00001v1');
    expect(item.authors).toEqual(['Wang Wu', 'Zhao Liu']);
    expect(item.abstract).toContain('digital twin');
    expect(item.content).toContain('期刊/来源: arXiv 预印本');
  });
});

describe('yearRangeFromDate', () => {
  it("'all' 返回 null", () => {
    expect(yearRangeFromDate('all')).toBeNull();
  });

  it("'3' 返回约三年前的 ISO 日期", () => {
    const from = yearRangeFromDate('3');
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const expected = new Date();
    expected.setFullYear(expected.getFullYear() - 3);
    expect(from).toBe(expected.toISOString().slice(0, 10));
  });
});

describe('buildOpenAlexUrl', () => {
  it('默认：search + relevance 排序 + 游标首页', () => {
    const url = buildOpenAlexUrl({ keyword: 'ship welding' });
    expect(url).toContain('https://api.openalex.org/works?');
    expect(url).toContain('search=ship+welding');
    expect(url).toContain('sort=relevance_score%3Adesc');
    // URLSearchParams 不编码 *，字面量断言首页游标
    expect(url).toContain('cursor=*');
    expect(url).not.toContain('filter=');
    expect(url).toContain('per_page=25');
  });

  it('年份范围生成 from_publication_date 过滤', () => {
    const url = buildOpenAlexUrl({ keyword: 'shipbuilding', yearRange: '5', sort: 'cited' });
    expect(url).toContain('filter=from_publication_date%3A');
    expect(url).toContain('sort=cited_by_count%3Adesc');
  });

  it('续页透传游标', () => {
    const url = buildOpenAlexUrl({ keyword: 'marine', cursor: 'abc123' });
    expect(url).toContain('cursor=abc123');
  });
});
