# -*- coding: utf-8 -*-
"""R4 视频 720p（工具链路，不改编辑器代码）：转码 + 工程备份打补丁。

为什么走工具链：浏览器内转码（WebCodecs/Muxer）重且脆，属产品级决策；
本轮用离线 ffmpeg（imageio-ffmpeg 自带静态二进制，无需安装）处理第3期 3 个视频，
用户拍板已允许 720p。

流程：
  1. 转码 2026第3期/*.mp4（1080p→720p，crf23，faststart）→ _体积分析/r4-720p/
  2. 按“字节 sha1 一致”校验内嵌视频即源文件（每处出现 2 次：content+blocks）
  3. 替换工程备份内 6 处 data URI → 输出 SWS_Project_2026-10-20-720p.html（原文件不动）
  4. 用户在编辑器内导入该工程备份 → 重新导出阅读包即生效

用法: python r4-transcode.py [--skip-transcode] [--skip-patch]
"""
import base64
import hashlib
import os
import subprocess
import sys

ISSUE3 = 'C:/Users/MA/OneDrive - stu.just.edu.cn/工法情报收集/2026第3期'
OUT720 = ('C:/Users/MA/OneDrive - stu.just.edu.cn/前端项目/工法情报收集系统'
          '/_体积分析/r4-720p')
PROJECT = os.path.join(ISSUE3, 'SWS_Project_2026-10-20.html')
PROJECT_720 = os.path.join(ISSUE3, 'SWS_Project_2026-10-20-720p.html')

VIDEOS = [
    '【视频】HD现代重工建成全球首批氨燃料气体运输船.mp4',
    '【视频】川崎重工：船体分段焊接的自动化革新.mp4',
    '中船黄埔文冲AI智能套料系统正式上线.mp4',
]


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def sha1_file(path: str) -> str:
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for ch in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(ch)
    return h.hexdigest()


def transcode(src: str, dst: str):
    # 源已是低码率 1080p（692~1302k），crf23 会反增体积；用 crf28 + 尺寸守卫兜底
    cmd = [ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
           '-vf', 'scale=-2:720', '-crf', '28', '-preset', 'fast',
           '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', dst]
    print(f'[r4] 转码 {os.path.basename(src)} → 720p crf28 ...', flush=True)
    subprocess.run(cmd, check=True)
    s0, s1 = os.path.getsize(src), os.path.getsize(dst)
    if s1 >= s0:
        # 守卫：转码后更大则保留原片（不让“优化”变负优化）
        os.remove(dst)
        import shutil
        shutil.copyfile(src, dst)
        s1 = s0
        print(f'[r4]   {s0 / 1024 / 1024:.1f}MB → 转码更大，保留原片')
    else:
        print(f'[r4]   {s0 / 1024 / 1024:.1f}MB → {s1 / 1024 / 1024:.1f}MB（-{100 * (1 - s1 / s0):.0f}%）')
    return s0, s1


def main():
    skip_tc = '--skip-transcode' in sys.argv
    skip_patch = '--skip-patch' in sys.argv
    os.makedirs(OUT720, exist_ok=True)

    pairs = []  # (原b64, 新b64, 名)
    total0 = total1 = 0
    for name in VIDEOS:
        src = os.path.join(ISSUE3, name)
        dst = os.path.join(OUT720, name)
        if skip_tc:
            assert os.path.exists(dst), f'缺转码产物: {dst}'
            s0, s1 = os.path.getsize(src), os.path.getsize(dst)
        else:
            s0, s1 = transcode(src, dst)
        total0 += s0
        total1 += s1
        with open(src, 'rb') as f:
            b0 = base64.b64encode(f.read()).decode()
        with open(dst, 'rb') as f:
            b1 = base64.b64encode(f.read()).decode()
        pairs.append((b0, b1, name))
    print(f'[r4] 合计 {total0 / 1024 / 1024:.1f}MB → {total1 / 1024 / 1024:.1f}MB')

    if skip_patch:
        print('[r4] 跳过补丁')
        return
    print(f'[r4] 读工程备份（{os.path.getsize(PROJECT) / 1024 / 1024:.0f}MB）...', flush=True)
    with open(PROJECT, 'r', encoding='utf-8') as f:
        text = f.read()
    for b0, b1, name in pairs:
        n = text.count(b0)
        assert n == 2, f'{name}：期望出现 2 次（content+blocks），实际 {n} 次，拒绝补丁'
        text = text.replace(b0, b1)
        print(f'[r4] 补丁 {name}：2 处已替换')
    with open(PROJECT_720, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'[r4] OK → {PROJECT_720}（{os.path.getsize(PROJECT_720) / 1024 / 1024:.0f}MB）')
    print('[r4] 下一步：在编辑器内导入该工程备份，重新导出阅读包即生效（原备份不动）')


if __name__ == '__main__':
    main()
