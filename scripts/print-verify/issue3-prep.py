# -*- coding: utf-8 -*-
"""第3期端到端复现预处理（A4）：工程备份 + 已打印 PDF → vitest 可消费的映射。

输入：
  1. SWS_Project_2026-10-20.html（27 篇文章全量 JSON，含 pdfData/coverImage/正文）
  2. 打印专用版-NO.pdf（156 页，含 63 张 PDF 光栅内容页 XObject）
输出（.tmp/，gitignored）：
  - issue3-pdfmap.json：{pdfArticles:[{id,title,order,pdfPages,pdfSha1}], logo, sidebarMeta,
      onlineImageCount, contentImageCount}
  - issue3-rasters/{articleId}-{idx}.{png|jpg}：63 张内容光栅（二进制 XObject 原样）

映射原理：5 篇 PDF 文章的 pdfData 页数各不相同（12/10/11/13/17），打印 PDF 里
5 个光栅段的内容页数也是 [12,10,11,13,17]（顺序一致），按“页数”一一对应，
不依赖标题文本（打印 PDF 字体缺 ToUnicode，抽字乱码）。
vitest 侧 mock convertPdfToImages 按 pdf 字节 sha1 命中，回放对应光栅。
"""
import base64
import hashlib
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(HERE, '.tmp')
RASTERS = os.path.join(TMP, 'issue3-rasters')

PROJECT_HTML = sys.argv[1] if len(sys.argv) > 1 else (
    'C:/Users/MA/OneDrive - stu.just.edu.cn/工法情报收集/2026第3期'
    '/SWS_Project_2026-10-20.html')
PRINT_PDF = sys.argv[2] if len(sys.argv) > 2 else (
    'C:/Users/MA/OneDrive - stu.just.edu.cn/工法情报收集/2026第3期/打印专用版-NO.pdf')


def extract_segments(path: str):
    with open(path, 'rb') as f:
        raw = f.read()
    def seg(a: bytes, b: bytes) -> bytes:
        i = raw.find(a)
        j = raw.find(b)
        assert i >= 0 and j > i, f'标记缺失: {a} / {b}'
        return raw[i + len(a):j]
    data = seg(b'DATA START', b'DATA END').strip()
    logo = seg(b'LOGO START', b'LOGO END').strip().decode('utf-8')
    meta = seg(b'META START', b'META END').strip().decode('utf-8')
    return json.loads(data), logo, meta


def pdf_page_count(pdf_bytes: bytes) -> int:
    from pypdf import PdfReader
    return len(PdfReader(io.BytesIO(pdf_bytes)).pages)


def main():
    print(f'[prep] 解析工程备份: {os.path.basename(PROJECT_HTML)}')
    articles, logo, sidebar_meta = extract_segments(PROJECT_HTML)
    print(f'[prep] 文章数: {len(articles)}（含封面/封底），logo {len(logo)//1024}KB，meta={sidebar_meta!r}')

    # 按打印排序（与 sortArticlesByPriority 同口径：封面首、封底尾、其余 order 升序）
    def sort_key(a):
        if a.get('category') == '封面':
            return (-1, 0)
        if a.get('category') == '封底':
            return (2, 0)
        return (0, int(a.get('order') or 0))
    ordered = sorted(articles, key=sort_key)

    pdf_articles = []
    online_imgs = 0
    content_imgs = 0
    for a in ordered:
        content = a.get('content') or ''
        online_imgs += len(re.findall(r'<img[^>]*src=[\"\']https?://', content))
        content_imgs += len(re.findall(r'<img[^>]*', content))
        pdf_data = a.get('pdfData')
        if not pdf_data:
            continue
        b64 = pdf_data.split(',', 1)[1] if ',' in pdf_data else pdf_data
        pdf_bytes = base64.b64decode(b64)
        pdf_articles.append({
            'id': a['id'],
            'title': a.get('title'),
            'order': a.get('order'),
            'pdfPages': pdf_page_count(pdf_bytes),
            'pdfSha1': hashlib.sha1(pdf_bytes).hexdigest()[:16],
            'pdfBytes': len(pdf_bytes),
        })
    print('[prep] PDF 文章（打印顺序）:')
    for p in pdf_articles:
        print(f"  id={p['id']} order={p['order']} pages={p['pdfPages']} sha1={p['pdfSha1']} {p['title']}")
    print(f'[prep] 正文 <img> 共 {content_imgs} 处，其中在线 URL {online_imgs} 处')

    # 从已打印 PDF 提取 63 张内容光栅（大图单图页，按打印顺序）
    from pypdf import PdfReader
    reader = PdfReader(PRINT_PDF)
    big_pages = []  # [(pdf页码, image对象)]
    for i, pg in enumerate(reader.pages):
        txt = (pg.extract_text() or '').strip()
        imgs = list(pg.images)
        if txt == '' and len(imgs) == 1 and len(imgs[0].data) > 50000:
            big_pages.append((i + 1, imgs[0]))
    print(f'[prep] 打印 PDF 内容光栅页: {len(big_pages)} 张')
    assert len(big_pages) == sum(p['pdfPages'] for p in pdf_articles), \
        f"光栅数 {len(big_pages)} != pdfData 页数和"

    # 按段切分并断言每段计数与 pdfData 页数一致
    os.makedirs(RASTERS, exist_ok=True)
    # 清空旧光栅
    for f in os.listdir(RASTERS):
        os.remove(os.path.join(RASTERS, f))
    pos = 0
    section_counts = []
    for p in pdf_articles:
        n = p['pdfPages']
        # 段内必须连续（允许残片页夹在中间：残片是 T==0 tiny-img 页，不在 big_pages 内；
        # 故 big_pages 全局连续即等价于段连续——额外断言页码单调即可）
        chunk = big_pages[pos:pos + n]
        assert len(chunk) == n
        section_counts.append(n)
        files = []
        for idx, (pdf_page_no, im) in enumerate(chunk):
            d = im.data
            ext = 'png' if d[:8] == b'\x89PNG\r\n\x1a\n' else ('jpg' if d[:2] == b'\xff\xd8' else 'bin')
            mime = {'png': 'image/png', 'jpg': 'image/jpeg'}.get(ext, 'application/octet-stream')
            fname = f"{p['id']}-{idx}.{ext}"
            with open(os.path.join(RASTERS, fname), 'wb') as f:
                f.write(d)
            files.append({'file': fname, 'mime': mime, 'bytes': len(d), 'fromPdfPage': pdf_page_no})
        p['rasters'] = files
        pos += n
    print(f'[prep] 段计数: {section_counts}，光栅已落盘 {RASTERS}')

    for p in pdf_articles:
        del p['pdfBytes']
    with open(os.path.join(TMP, 'issue3-pdfmap.json'), 'w', encoding='utf-8') as f:
        json.dump({'pdfArticles': pdf_articles, 'logo': logo, 'sidebarMeta': sidebar_meta,
                   'onlineImageCount': online_imgs, 'contentImageCount': content_imgs},
                  f, ensure_ascii=False)
    print('[prep] OK issue3-pdfmap.json')


if __name__ == '__main__':
    main()
