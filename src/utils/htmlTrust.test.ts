import { describe, it, expect } from 'vitest';
import { isSelfGeneratedHtml, isSelfGeneratedHtmlCached } from './htmlTrust';

const VALID_GRAPH_HTML = `
  <div class="knowledge-graph-container" contenteditable="false">
    <script type="text/plain" id="data-graph-1">{"nodes":[]}</script>
    <iframe srcdoc="<html></html>"></iframe>
    <button onclick="app.toggleGraphExpand()">展开</button>
  </div>
`;

describe('isSelfGeneratedHtml', () => {
  it('识别系统生成的图谱容器', () => {
    expect(isSelfGeneratedHtml(VALID_GRAPH_HTML)).toBe(true);
  });

  it('拒绝普通 HTML', () => {
    expect(isSelfGeneratedHtml('<p>普通正文</p>')).toBe(false);
  });

  it('拒绝伪装容器中的危险注入', () => {
    const malicious = `<div class="knowledge-graph-container" contenteditable="false">
      <img src="x" onerror="alert(1)">
      <iframe srcdoc="ok"></iframe>
    </div>`;
    expect(isSelfGeneratedHtml(malicious)).toBe(false);
  });

  it('拒绝带外部 src 的 iframe', () => {
    const withExternalIframe = `<div class="knowledge-graph-container" contenteditable="false">
      <script type="text/plain" id="data-graph-1">{}</script>
      <iframe src="https://evil.example"></iframe>
    </div>`;
    expect(isSelfGeneratedHtml(withExternalIframe)).toBe(false);
  });
});

describe('isSelfGeneratedHtmlCached', () => {
  it('缓存命中且结果与未缓存版本一致', () => {
    const first = isSelfGeneratedHtmlCached(VALID_GRAPH_HTML);
    const second = isSelfGeneratedHtmlCached(VALID_GRAPH_HTML);
    expect(second).toBe(first);
    expect(second).toBe(true);
    expect(isSelfGeneratedHtmlCached('<p>普通正文</p>')).toBe(false);
  });
});
