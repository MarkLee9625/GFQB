# -*- coding: utf-8 -*-
"""生成 5 种实测长宽比的仿真 PDF 光栅页（A1 台架 fixture 素材）。

尺寸 = convertPdfToImages(scale=2.0) 的 canvas 整数尺寸，来源：
2026第3期 5 个源 PDF 的 mediabox（pt）×2：
  焊接顺序 612.3x842.0   -> 1224x1684  ratio 1.3755（实测撕裂）
  三维模型 603.8x824.9   -> 1208x1650  ratio 1.3659（实测撕裂）
  激光清理 595.3x807.9   -> 1190x1616  ratio 1.3571（实测临界通过）
  知识图谱 603.8x824.9   -> 1208x1650  ratio 1.3659（实测撕裂，内容与三维模型区分）
  知识驱动 595.2x842.0   -> 1190x1684  ratio 1.4151（A4 系，溢出最大）

内容：白底 + 灰色仿真文字行 + 顶部标题条，底部 18% 纯白（模拟 PDF 白边，
正是白边让撕裂残片呈现为“空白页”）。
确定性输出（无随机），产物落 assets/ 并提交 git。
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, 'assets')

SPECS = [
    # (文件名, 宽, 高, 标题条高度, 文字行数)
    ('pdf-raster-1224x1684.png', 1224, 1684, 150, 34),
    ('pdf-raster-1208x1650-a.png', 1208, 1650, 140, 32),
    ('pdf-raster-1190x1616.png', 1190, 1616, 140, 30),
    ('pdf-raster-1208x1650-b.png', 1208, 1650, 110, 36),
    ('pdf-raster-1190x1684.png', 1190, 1684, 150, 34),
]


def make_image(w: int, h: int, title_h: int, n_lines: int):
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (w, h), 'white')
    d = ImageDraw.Draw(img)
    margin = int(w * 0.08)
    # 顶部标题条
    d.rectangle([margin, 60, w - margin, 60 + title_h], fill=(38, 68, 120))
    d.rectangle([margin, 80 + title_h, int(w * 0.45), 100 + title_h], fill=(120, 130, 145))
    # 仿真文字行（行宽按固定伪随机序列变化，保证确定性）
    top = 140 + title_h
    bottom_limit = int(h * 0.80)  # 下方 18%+ 留白
    line_h, gap = 14, 22
    widths = [0.92, 0.86, 0.90, 0.78, 0.88, 0.94, 0.82, 0.90, 0.70, 0.87]
    y = top
    i = 0
    while y + line_h <= bottom_limit and i < n_lines + 12:
        frac = widths[i % len(widths)]
        x1 = margin + (0 if i % 4 else int(w * 0.04))  # 首行缩进模拟
        d.rectangle([x1, y, margin + int((w - 2 * margin) * frac), y + line_h],
                    fill=(105, 112, 125))
        # 段落间隔
        y += line_h + gap + (26 if i % 7 == 6 else 0)
        i += 1
    # 页脚线（帮助肉眼判断残片归属）
    d.rectangle([margin, int(h * 0.815), w - margin, int(h * 0.815) + 3], fill=(38, 68, 120))
    return img


def main():
    os.makedirs(ASSETS, exist_ok=True)
    for name, w, h, title_h, n_lines in SPECS:
        img = make_image(w, h, title_h, n_lines)
        path = os.path.join(ASSETS, name)
        img.save(path, 'PNG')
        print(f'{name}  {w}x{h}  ratio={h / w:.4f}  {os.path.getsize(path) // 1024}KB')


if __name__ == '__main__':
    main()
