import type { Article } from '../types';

/**
 * ID 生成遵循项目约定：Date.now() * 1000 + 自增偏移。
 * 量级远大于旧式 Date.now() id，与存量数据无碰撞。
 */
export function generateArticleId(seq: number): number {
  return Date.now() * 1000 + seq;
}

/**
 * 空库初始化（useJournal）与清空重置（App.handleReset）共用的
 * 封面/封底默认数据，order 强制 0 / 99999。
 */
export function createDefaultSpecialArticles(seq = 1): Article[] {
  const base = Date.now() * 1000;
  return [
    {
      id: base + seq,
      title: '封面',
      category: '封面',
      content: '',
      issueText: 'NO.01',
      dateText: 'JAN ' + new Date().getFullYear(),
      order: 0,
    },
    {
      id: base + seq + 1,
      title: '封底',
      category: '封底',
      content: '',
      order: 99999,
    },
  ];
}
