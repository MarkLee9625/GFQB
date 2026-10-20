# -*- coding: utf-8 -*-
"""打印 PDF 页图谱分析（A1 台架 / A4 验收门）。

用法：
    python page-map.py <pdf> [--strict] [--json]

逐页统计：可抽取文本字符数 / 内嵌图片数与字节数 / 内容流长度，
并分类：
  - EMPTY  ：无文本、无图片、内容流为空 —— 真空白页
  - SLIVER ：单图且图片极小（<8KB）或 PNG 细条（高<=64px）—— 图片被分页撕裂的残片页
  - CONTENT：正常内容页

--strict 下检出任何 EMPTY/SLIVER 即 exit 1（验收门）。
实测口径来源：2026第3期 打印专用版-NO.pdf（156页），PDF 光栅页被撕成
“内容页 + 1224x24 残片页”交替出现，残片约 159~222B。
"""
import json
import struct
import sys


def png_dims(data: bytes):
    if len(data) >= 26 and data[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', data[16:24])
        return w, h
    return None, None


def analyze(pdf_path: str):
    try:
        from pypdf import PdfReader
    except ModuleNotFoundError:
        print('[page-map] 缺依赖 pypdf：请对本解释器执行 pip install pypdf', file=sys.stderr)
        sys.exit(3)
    reader = PdfReader(pdf_path)
    pages = []
    for i, pg in enumerate(reader.pages):
        try:
            text_len = len((pg.extract_text() or '').strip())
        except Exception:
            text_len = -1  # 抽字失败，不计入判定
        imgs = []
        try:
            for im in pg.images:
                d = im.data
                w, h = png_dims(d)
                imgs.append({'name': im.name, 'bytes': len(d), 'w': w, 'h': h})
        except Exception as e:
            imgs = [{'name': f'<error {e}>', 'bytes': -1, 'w': None, 'h': None}]
        try:
            contents = pg.get_contents()
            content_len = len(contents.get_data()) if contents is not None else 0
        except Exception:
            content_len = -1
        n_img = len(imgs)
        img_bytes = sum(x['bytes'] for x in imgs if x['bytes'] > 0)
        box = pg.mediabox
        pages.append({
            'page': i + 1,
            'size_pt': (round(float(box.width), 1), round(float(box.height), 1)),
            'text_len': text_len,
            'n_images': n_img,
            'img_bytes': img_bytes,
            'content_len': content_len,
            'images': imgs,
        })
    return pages


def classify(pg) -> str:
    has_text = pg['text_len'] > 0
    # EMPTY：无文本无图片（内容流里只剩操作符残留，无可见标记）。
    # 本产品不存在纯矢量页（图形均为 img data-URI，封面/占位符均带可抽取文本），故安全。
    if not has_text and pg['n_images'] == 0:
        return 'EMPTY'
    # SLIVER：无文本且图片总量极小（撕裂残片；实测 159~222B/页，封顶 8KB 防误伤）
    if not has_text and 0 < pg['img_bytes'] < 8192:
        return 'SLIVER'
    if not has_text and pg['n_images'] == 1:
        im = pg['images'][0]
        if im['h'] is not None and im['h'] <= 64:
            return 'SLIVER'
    return 'CONTENT'


def render_stats(pdf_path: str, dpi: int = 60):
    """渲染口径：每页非白像素的外接框高度占比 + 白像素比。

    headless --print-to-pdf 把撕裂两半挂同一 XObject（字节口径失效），
    但用户视角的“空白页”渲染特征稳定：非白像素挤在一条细带内。
    """
    import fitz
    import PIL.Image
    import io
    doc = fitz.open(pdf_path)
    out = []
    for i in range(len(doc)):
        pix = doc[i].get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
        img = PIL.Image.open(io.BytesIO(pix.tobytes('png')))
        w, h = img.size
        px = img.load()
        top, bottom, nonwhite_rows = h, -1, 0
        step = 2  # 隔行/隔列采样，快且足够
        for y in range(0, h, step):
            row_hit = False
            for x in range(0, w, step):
                if px[x, y] < 250:
                    row_hit = True
                    break
            if row_hit:
                nonwhite_rows += 1
                if y < top:
                    top = y
                if y > bottom:
                    bottom = y
        band_ratio = ((bottom - top + step) / h) if bottom >= 0 else 0.0
        white_ratio = 1.0 - (nonwhite_rows / (h / step))
        out.append({'band_ratio': round(band_ratio, 4), 'white_ratio': round(white_ratio, 4)})
    return out


def classify_render(st, text_len: int) -> str:
    # 只判无文本页：有文本的稀疏页（p31 式文章尾、p4 式正文寡行）是合法分页，不是缺陷。
    # 撕裂残片页恒无文本（纯图半页），故此门不漏检。
    if text_len != 0:
        return 'CONTENT'
    # RENDER_BLANK：整页全白；RENDER_SLIVER：非白挤在<=6%高度细带内且白行比>=97%
    if st['white_ratio'] >= 0.999:
        return 'RENDER_BLANK'
    if st['band_ratio'] <= 0.06 and st['white_ratio'] >= 0.97:
        return 'RENDER_SLIVER'
    return 'CONTENT'


def main(argv):
    args = []
    expect_pages = None
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == '--expect-pages' and i + 1 < len(argv):
            expect_pages = int(argv[i + 1])
            i += 2
        elif a.startswith('-'):
            i += 1
        else:
            args.append(a)
            i += 1
    strict = '--strict' in argv
    as_json = '--json' in argv
    do_render = '--render' in argv
    if not args:
        print('用法: python page-map.py <pdf> [--strict] [--json] [--render] [--expect-pages N]')
        return 2
    pdf_path = args[0]
    pages = analyze(pdf_path)
    rstats = render_stats(pdf_path) if do_render else None
    defects = []
    for idx, pg in enumerate(pages):
        pg['class'] = classify(pg)
        if rstats is not None:
            pg['render'] = rstats[idx]
            pg['render_class'] = classify_render(rstats[idx], pg['text_len'])
            if pg['class'] == 'CONTENT' and pg['render_class'] != 'CONTENT':
                pg['class'] = pg['render_class']
        if pg['class'] != 'CONTENT':
            defects.append(pg)
    summary = {
        'pdf': pdf_path,
        'total_pages': len(pages),
        'empty_pages': [p['page'] for p in defects if p['class'] == 'EMPTY'],
        'sliver_pages': [p['page'] for p in defects if p['class'] == 'SLIVER'],
        'render_blank_pages': [p['page'] for p in defects if p['class'] == 'RENDER_BLANK'],
        'render_sliver_pages': [p['page'] for p in defects if p['class'] == 'RENDER_SLIVER'],
    }
    count_mismatch = expect_pages is not None and len(pages) != expect_pages
    if as_json:
        print(json.dumps({'summary': summary, 'pages': pages,
                          'expect_pages': expect_pages,
                          'count_mismatch': count_mismatch}, ensure_ascii=False))
    else:
        print(f"=== {pdf_path}  共 {len(pages)} 页 ===")
        for pg in pages:
            flag = '' if pg['class'] == 'CONTENT' else f'  <-- {pg["class"]}'
            extra = ''
            if 'render' in pg:
                extra = f' band={pg["render"]["band_ratio"]:.3f} W={pg["render"]["white_ratio"]:.3f}'
            print(f"p{pg['page']:03d} T={pg['text_len']:5d} I={pg['n_images']} "
                  f"S={pg['img_bytes']:>9d} C={pg['content_len']:>7d}{extra}{flag}")
        print()
        print(f"EMPTY: {summary['empty_pages'] or '无'}")
        print(f"SLIVER: {summary['sliver_pages'] or '无'}")
        if do_render:
            print(f"RENDER_BLANK: {summary['render_blank_pages'] or '无'}")
            print(f"RENDER_SLIVER: {summary['render_sliver_pages'] or '无'}")
        if expect_pages is not None:
            print(f"页数期望: {expect_pages}，实际: {len(pages)}"
                  + ('（不符!）' if count_mismatch else '（相符）'))
    if strict and (defects or count_mismatch):
        print(f'\n[FAIL] 检出 {len(defects)} 个空白/残片页'
              + ('；页数不符' if count_mismatch else ''))
        return 1
    print('\n[PASS] 无空白/残片页' if not defects else '\n[WARN] 非 strict 模式，仅报告')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
