"""把像素風三視圖（正面、側面朝右、背面）切成方塊模型。

做法：正面剪影 × 側面剪影 交集 = 方塊（visual hull），只留表面；
顏色：最前面的方塊用正面的顏色，最後面的用背面，其他用側面。
輸出 assets/voxels/<名字>.json：{ size, palette: [hex...], vox: [x, y, z, 色號, ...] }

用法：python art/pixel2voxel.py art/pixel/akane.png akane [高度格數=56]
"""
import sys, json
import numpy as np
from PIL import Image

src, name = sys.argv[1], sys.argv[2]
TARGET_H = int(sys.argv[3]) if len(sys.argv) > 3 else 56

img = np.asarray(Image.open(src).convert('RGB')).astype(int)
H, W, _ = img.shape
bg = np.median(np.concatenate([img[:8, :8].reshape(-1, 3), img[:8, -8:].reshape(-1, 3), img[-8:, :8].reshape(-1, 3)]), axis=0)
mask = np.abs(img - bg).sum(axis=2) > 40

# 三個視圖：在 1/3、2/3 附近找「內容最少的欄」當分界（槍、頭髮可能跨過空白）
colsum = mask.sum(axis=0)
def cut(at):
    lo, hi = int(W * at) - 140, int(W * at) + 140
    return lo + int(np.argmin(colsum[lo:hi]))
c1, c2 = cut(1 / 3), cut(2 / 3)
merged = []
for x0, x1 in [(0, c1), (c1, c2), (c2, W)]:
    xs = np.where(colsum[x0:x1] > 0)[0]
    merged.append([x0 + xs[0], x0 + xs[-1] + 1])
views = []
for x0, x1 in merged:
    m = mask[:, x0:x1].copy()
    rows = np.where(m.any(axis=1))[0]
    y0, y1 = rows[0], rows[-1] + 1
    # 以靴子（最下面 12%）的中心當身體中心
    foot = m[int(y1 - (y1 - y0) * 0.12):y1]
    fx = np.where(foot.any(axis=0))[0]
    cx = (fx[0] + fx[-1]) / 2 + x0
    views.append(dict(x0=x0, x1=x1, y0=y0, y1=y1, cx=cx))
front, side, back = views
bottom = max(v['y1'] for v in views)
top = min(v['y0'] for v in views)
cell = (bottom - top) / TARGET_H

def grid(v):
    """把一個視圖取樣成格子：回傳 (u 起點, 格數, 遮罩, 顏色)，u=0 在身體中心"""
    half = int(np.ceil(max(v['cx'] - v['x0'], v['x1'] - v['cx']) / cell)) + 1
    n = 2 * half
    gm = np.zeros((TARGET_H, n), bool)
    gc = np.zeros((TARGET_H, n, 3), int)
    for j in range(TARGET_H):           # j=0 在腳底
        py0 = bottom - (j + 1) * cell
        for i in range(n):
            px0 = v['cx'] + (i - half) * cell
            ys = slice(int(py0 + cell * 0.2), int(py0 + cell * 0.8) + 1)
            xs = slice(int(px0 + cell * 0.2), int(px0 + cell * 0.8) + 1)
            mm = mask[ys, xs]
            if mm.size and mm.mean() > 0.45:
                gm[j, i] = True
                px = img[ys, xs][mm]
                # 取最常出現的顏色（像素圖的色塊），不是平均
                q = (px // 8) * 8
                vals, cnt = np.unique(q.reshape(-1, 3), axis=0, return_counts=True)
                gc[j, i] = vals[cnt.argmax()] + 4
    return half, gm, gc

fh, fm, fc = grid(front)
sh, sm, sc = grid(side)
bh, bm, bc = grid(back)

# visual hull：x 來自正面（畫面右 = +x），z 來自側面（畫面右 = 前方 +z），y 往上
# 正面的剪影要跟背面互相確認（背面左右相反），兩個都有才算，免得槍、飄帶在背面亂長
vox = {}
for j in range(TARGET_H):
    for i in range(2 * fh):
        if not fm[j, i]: continue
        x = i - fh
        bi = -x + bh
        if 0 <= bi < 2 * bh and not bm[j, bi]:
            # 背面沒有：只有正面有的東西（胸前、手上的槍）→ 只長在前半
            front_only = True
        else:
            front_only = False
        for k in range(2 * sh):
            if not sm[j, k]: continue
            z = k - sh
            if front_only and z < 0: continue
            vox[(x, j, z)] = None

def solid(x, y, z): return (x, y, z) in vox
out = []
palette, pidx = [], {}
def col(c):
    key = tuple(int(v) for v in c)
    if key not in pidx:
        pidx[key] = len(palette); palette.append('#%02x%02x%02x' % key)
    return pidx[key]
for (x, y, z) in vox:
    nb = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
    if all(solid(x + a, y + b, z + c) for a, b, c in nb): continue  # 內部，看不到
    # 往前（+z）、往後（-z）是不是露出來
    front_exposed = not any(solid(x, y, zz) for zz in range(z + 1, z + 40))
    back_exposed = not any(solid(x, y, zz) for zz in range(z - 40, z))
    side_exposed = not solid(x + 1, y, z) or not solid(x - 1, y, z)
    fi, bi, si = x + fh, -x + bh, z + sh
    if front_exposed and fm[y, fi]: c = fc[y, fi]
    elif back_exposed and 0 <= bi < 2 * bh and bm[y, bi]: c = bc[y, bi]
    elif side_exposed and sm[y, si]: c = sc[y, si]
    elif fm[y, fi]: c = fc[y, fi]
    else: c = sc[y, si]
    out += [x, y, z, col(c)]

res = dict(name=name, height=TARGET_H, palette=palette, vox=out)
import os
os.makedirs('assets/voxels', exist_ok=True)
json.dump(res, open(f'assets/voxels/{name}.json', 'w'), separators=(',', ':'))
print(name, 'cells', len(vox), 'surface', len(out) // 4, 'colors', len(palette), 'grid', 2 * fh, 2 * sh, TARGET_H)
