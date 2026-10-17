#!/usr/bin/env python3
"""把 PINOC 生成的场景变成游戏能直接用的关卡素材。

用法:
  python3 tools/prep-scene.py <场景 .spz 的 URL 或本地路径> --id <关卡名> [--open 半径] [--eye 1.5] [--room 半径]

做的事:
  1. 下载 PINOC 的 SPZ v4（zstd 压缩，网页引擎读不了）
  2. 用 @playcanvas/splat-transform 转成 compressed.ply，顺便去掉不透明度 < 2% 的点（体积约 -28%）
  3. 量地面：场景原点是拍摄点，沿原点往下找最密的一层就是地面；按“原点离地 eye 米”换算成米
  4. 从点云算可走区域：离地 0.35–1.7 米之间点多的格子算障碍，只保留和原点连通的部分
     --open 用于麦田、草地这类可以穿行的场景：只限制一个圆形范围
  5. 打印一段可以直接粘进 src/levels.js 的配置

依赖: node (npx)、python3 + numpy、curl
"""
import argparse, json, os, subprocess, sys, tempfile
from collections import deque

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src', help='场景 .spz 的 URL（get_asset / wait_for_tasks 返回的 splatUrl）或本地路径')
ap.add_argument('--id', required=True, help='关卡名，决定输出文件名')
ap.add_argument('--eye', type=float, default=1.5, help='假设拍摄点离地多少米（默认 1.5）。房间看着偏大就调小')
ap.add_argument('--room', type=float, default=6.0, help='室内模式下可走区域的最大半径（米）')
ap.add_argument('--open', type=float, default=None, help='开放场景：直接用这个半径（米）的圆当可走区域')
args = ap.parse_args()

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
cache = os.path.join('tools', '.cache')
os.makedirs(cache, exist_ok=True)
os.makedirs('public/scenes', exist_ok=True)
os.makedirs('public/levels', exist_ok=True)

# 1) 下载
spz = args.src
if spz.startswith('http'):
    spz = os.path.join(cache, f'{args.id}.spz')
    subprocess.run(['curl', '-sSL', '--retry', '5', '--retry-all-errors', '-o', spz, args.src], check=True)
print(f'[1/5] 场景文件 {spz} ({os.path.getsize(spz) / 1e6:.1f} MB)')

# 2) 转格式 + 瘦身
ply = os.path.join(tempfile.gettempdir(), f'{args.id}.ply')
out = f'public/scenes/{args.id}.compressed.ply'
st = ['npx', '--yes', '@playcanvas/splat-transform', '-w']
subprocess.run(st + [spz, ply], check=True, capture_output=True)
subprocess.run(st + [spz, '-V', 'opacity,gt,0.02', out], check=True, capture_output=True)
print(f'[2/5] {out} ({os.path.getsize(out) / 1e6:.1f} MB)')

# 读未压缩 ply：x y z rot*4 scale*3 opacity f_dc*3（SH 0 阶）
with open(ply, 'rb') as f:
    header = b''
    while True:
        line = f.readline()
        header += line
        if line.strip() == b'end_header':
            break
    h = header.decode()
    n = int([l for l in h.splitlines() if l.startswith('element vertex')][0].split()[-1])
    props = [l.split()[-1] for l in h.splitlines() if l.startswith('property')]
    a = np.frombuffer(f.read(), dtype=np.float32).reshape(n, len(props))
px, py, pz = a[:, 0], a[:, 1], a[:, 2]
opacity = a[:, props.index('opacity')]  # logit

# 3) 量地面（文件单位）：原点正下方最密的一层
col = (np.abs(px) < 0.4) & (np.abs(pz) < 0.4) & (py < -0.15)
hist, edges = np.histogram(py[col], bins=60)
i = int(np.argmax(hist))
ground = float((edges[i] + edges[i + 1]) / 2)
scale = args.eye / abs(ground)

# 换算到世界坐标（米，地面 y=0），再用原点附近地面的中位高度微调
keep = opacity > -2.0
x, y, z = px[keep] * scale, (py[keep] - ground) * scale, pz[keep] * scale
near = (np.abs(x) < 1.0) & (np.abs(z) < 1.0) & (y > -1.2) & (y < 0.4)
adj = float(np.median(y[near])) if near.any() else 0.0
ground = ground + adj / scale
y = y - adj
print(f'[3/5] ground={ground:.4f}  scale={scale:.3f}  （原点离地 {args.eye} 米）')

# 4) 可走区域
cell = 0.25
R = args.open if args.open else args.room
nx = int(2 * R / cell)
ix = ((x + R) / cell).astype(int)
iz = ((z + R) / cell).astype(int)
ok = (ix >= 0) & (ix < nx) & (iz >= 0) & (iz < nx)
yy, xx = np.mgrid[0:nx, 0:nx]
dist = np.hypot((xx - nx / 2) * cell, (yy - nx / 2) * cell)
if args.open:
    blocked = dist > R - 0.5
else:
    floor = np.zeros((nx, nx))
    obst = np.zeros((nx, nx))
    fm = ok & (y > -0.35) & (y < 0.25)
    om = ok & (y > 0.35) & (y < 1.7)
    np.add.at(floor, (iz[fm], ix[fm]), 1)
    np.add.at(obst, (iz[om], ix[om]), 1)
    blocked = (obst > max(8, np.percentile(obst[obst > 0], 60))) | (floor < 3)
c0 = nx // 2
walk = np.zeros_like(blocked, dtype=bool)
if not blocked[c0, c0]:
    q = deque([(c0, c0)])
    walk[c0, c0] = True
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r2, c2 = r + dr, c + dc
            if 0 <= r2 < nx and 0 <= c2 < nx and not walk[r2, c2] and not blocked[r2, c2]:
                walk[r2, c2] = True
                q.append((r2, c2))
grid_path = f'public/levels/{args.id}.grid.json'
with open(grid_path, 'w') as f:
    json.dump({'cell': cell, 'R': R, 'n': nx, 'walk': [''.join('1' if walk[r, c] else '0' for c in range(nx)) for r in range(nx)]}, f)
print(f'[4/5] {grid_path}  可走 {walk.sum() * cell * cell:.1f} 平方米')
if walk.sum() < 20:
    print('      ⚠ 可走区域太小：可能是地面没量准，或场景是开放空间（试试 --open 4）', file=sys.stderr)

# 5) 关卡配置
print('[5/5] 粘进 src/levels.js：')
print(f"""  {{
    id: '{args.id}',
    scene: 'scenes/{args.id}.compressed.ply',
    grid: 'levels/{args.id}.grid.json',
    ground: {ground:.4f},
    scale: {scale:.3f},
    painting: 'paintings/{args.id}.jpg',
    title: {{ en: '…', place: '…' }},
    quote: {{ en: '…', zh: '…', src: '…' }},
    goal: {{ en: '…', zh: '…' }},
    items: [],
    portal: null,
  }},""")
print('提示：-Z 方向是原画构图，+Z 是画家身后、原画里没有的那一半。家具看着偏大，就用更小的 --eye 重跑。')
