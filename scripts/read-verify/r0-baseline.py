# -*- coding: utf-8 -*-
"""R0 阅读包基线（先测后改）：体积账目 + 媒体审计 + 解码/解析耗时类比。

输入：第3期阅读包 SWS_工法情报_20261020.html（gzip 已生效，当前代码产物）。
输出：
  - 控制台摘要（账目/Top篇/Top PNG）
  - _体积分析/R0-基线-20261020.json（完整报告，验收留痕）

耗时为 Python 侧类比（base64/解压/JSON 解析三段），浏览器侧真值另见 r0-parse.mjs（V8）。
"""
import base64
import gzip
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPORT_JSON = ('C:/Users/MA/OneDrive - stu.just.edu.cn/前端项目/工法情报收集系统'
               '/_体积分析/R0-基线-20261020.json')

READER_HTML = sys.argv[1] if len(sys.argv) > 1 else (
    'C:/Users/MA/OneDrive - stu.just.edu.cn/工法情报收集/2026第3期'
    '/SWS_工法情报_20261020.html')

DATA_URI_RE = re.compile(r'data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)')


def mb(n):
    return round(n / 1024 / 1024, 2)


def media_stats(text: str):
    """统计一段文本内 data URI 的 mime 体积（b64 字符数→二进制估算）"""
    out = {}
    count = 0
    for m in DATA_URI_RE.finditer(text):
        mime, b64 = m.group(1), m.group(2)
        e = out.setdefault(mime, {'b64chars': 0, 'count': 0})
        e['b64chars'] += len(b64)
        e['count'] += 1
        count += 1
    for e in out.values():
        e['binBytes'] = e['b64chars'] * 3 // 4
    return out, count


def main():
    t_all = time.time()
    fsize = os.path.getsize(READER_HTML)
    print(f'=== R0 基线 {os.path.basename(READER_HTML)}  {mb(fsize)}MB ===')

    with open(READER_HTML, 'rb') as f:
        raw = f.read()

    # 压缩标记（读文件尾附近即可，articles 段之后）
    method = None
    mk = b'__SWS_COMPRESSION_METHOD__ = "'
    i = raw.find(mk)
    if i >= 0:
        method = raw[i + len(mk):raw.find(b'"', i + len(mk))].decode()
    print(f'压缩标记: {method}')

    # 数据段
    key = b'__SWS_DATA_ARTICLES_B64__ = "'
    kpos = raw.find(key)
    assert kpos > 0, 'articles 数据段缺失'
    q0 = kpos + len(key)
    q1 = raw.find(b'"', q0)
    b64 = raw[q0:q1]
    print(f'外层 base64 段: {mb(len(b64))}MB')
    del raw

    t0 = time.time()
    gz = base64.b64decode(b64)
    t_b64 = time.time() - t0
    del b64
    print(f'base64 解码: {mb(len(gz))}MB  {t_b64:.2f}s  (gzip 头: {gz[:2] == bytes([0x1f, 0x8b])})')

    t0 = time.time()
    js = gzip.decompress(gz)
    t_gz = time.time() - t0
    del gz
    print(f'gzip 解压: {mb(len(js))}MB  {t_gz:.2f}s  (压缩比 {len(js) / max(len(b64) if False else 1, 1):.1f}x —— 见账目)')
    text = js.decode('utf-8')
    del js

    t0 = time.time()
    arr = json.loads(text)
    t_json = time.time() - t0
    print(f'JSON.parse: {len(arr)} 篇  {t_json:.2f}s')

    # 逐篇 + 逐字段审计
    mime_total = {}
    png_offenders = []  # (bytes, 篇, 字段)
    per_article = []
    for a in arr:
        title = a.get('title', '?')[:30]
        fields = {
            'coverImage': a.get('coverImage') or '',
            'backImage': a.get('backImage') or '',
            'pdfData': a.get('pdfData') or '',
            'content': a.get('content') or '',
            'blocks': json.dumps(a.get('blocks') or [], ensure_ascii=False),
            'other': json.dumps({k: v for k, v in a.items()
                                 if k not in ('coverImage', 'backImage', 'pdfData', 'content', 'blocks')
                                 and isinstance(v, str)}, ensure_ascii=False),
        }
        art_mime = {}
        for fname, ftext in fields.items():
            if not ftext:
                continue
            st, _ = media_stats(ftext if isinstance(ftext, str) else '')
            for mime, e in st.items():
                art_mime[mime] = art_mime.get(mime, 0) + e['binBytes']
                g = mime_total.setdefault(mime, {'binBytes': 0, 'count': 0})
                g['binBytes'] += e['binBytes']
                g['count'] += e['count']
                if mime == 'image/png' and e['binBytes'] > 100 * 1024:
                    png_offenders.append((e['binBytes'], title, fname))
        # pdfData 非 data-URI 形态（裸 base64）单独计体积
        pdf_raw = a.get('pdfData') or ''
        pdf_bin = 0
        if pdf_raw and 'data:' not in pdf_raw[:30]:
            pdf_bin = len(pdf_raw) * 3 // 4
            g = mime_total.setdefault('application/pdf(raw)', {'binBytes': 0, 'count': 0})
            g['binBytes'] += pdf_bin
            g['count'] += 1
            art_mime['application/pdf(raw)'] = pdf_bin
        per_article.append({'title': title, 'category': a.get('category'),
                            'jsonMB': round(len(json.dumps(a, ensure_ascii=False)) / 1024 / 1024, 2),
                            'mediaMB': round(sum(art_mime.values()) / 1024 / 1024, 2)})
    # JSON 文本总长（gzip 前）
    json_len = len(text.encode('utf-8'))

    print('\n=== 体积账目 ===')
    media_bin = sum(v['binBytes'] for v in mime_total.values())
    print(f'文件: {mb(fsize)}MB / JSON: {mb(json_len)}MB / 媒体二进制合计: {mb(media_bin)}MB')
    print('媒体按 mime（真实二进制）:')
    for mime, v in sorted(mime_total.items(), key=lambda x: -x[1]['binBytes']):
        print(f'  {mime:24s} {mb(v["binBytes"]):>8}MB  {v["count"]:>4} 处')

    per_article.sort(key=lambda x: -x['jsonMB'])
    print('\n单篇 JSON Top10:')
    for p in per_article[:10]:
        print(f"  {p['jsonMB']:>7}MB(json) {p['mediaMB']:>7}MB(媒体)  [{p['category']}] {p['title']}")

    png_offenders.sort(reverse=True)
    print(f'\nPNG >100KB 共 {len(png_offenders)} 处 Top15:')
    for b, t, f in png_offenders[:15]:
        print(f'  {mb(b):>7}MB  [{f}] {t}')

    report = {
        'file': READER_HTML, 'fileMB': mb(fsize), 'method': method,
        'jsonMB': mb(json_len), 'mediaBinMB': mb(media_bin),
        'mime': {k: {'binMB': mb(v['binBytes']), 'count': v['count']} for k, v in mime_total.items()},
        'articles': per_article,
        'pngOffenders': [{'mb': mb(b), 'title': t, 'field': f} for b, t, f in png_offenders],
        'timings_py': {'b64_s': round(t_b64, 2), 'gunzip_s': round(t_gz, 2), 'parse_s': round(t_json, 2),
                       'total_s': round(time.time() - t_all, 2)},
    }
    os.makedirs(os.path.dirname(REPORT_JSON), exist_ok=True)
    with open(REPORT_JSON, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(f'\n报告已落盘: {REPORT_JSON}')


if __name__ == '__main__':
    main()
