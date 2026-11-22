"""把像素三視圖（正面、側面朝右、背面）切成三張單獨的圖，給 sprite_quantize 去背減色。

三張用同一個上下範圍（所以高度一樣、腳底對齊），左右各留一點背景（去背要從邊框往內填）。
輸出 art/pixel/views/<名字>_{front,side,back}.png，並印出建議的 --target-size（高 64）。

用法：python art/split_views.py akane hikari ...（不給名字就全部）
"""
import sys, os, glob, json
import numpy as np
from PIL import Image

H_OUT = int(os.environ.get('SPRITE_H', 64))
names = sys.argv[1:] or [os.path.splitext(os.path.basename(p))[0] for p in sorted(glob.glob('art/pixel/*.png'))]
os.makedirs('art/pixel/views', exist_ok=True)
sizes = {}
for name in names:
    im = Image.open(f'art/pixel/{name}.png').convert('RGB')
    img = np.asarray(im).astype(int)
    H, W, _ = img.shape
    bg = np.median(np.concatenate([img[:8, :8].reshape(-1, 3), img[:8, -8:].reshape(-1, 3), img[-8:, :8].reshape(-1, 3)]), axis=0)
    mask = np.abs(img - bg).sum(axis=2) > 40
    colsum = mask.sum(axis=0)
    def cut(at):
        lo, hi = int(W * at) - 140, int(W * at) + 140
        return lo + int(np.argmin(colsum[lo:hi]))
    c1, c2 = cut(1 / 3), cut(2 / 3)
    rows = np.where(mask.any(axis=1))[0]
    pad = 12
    y0, y1 = max(0, rows[0] - pad), min(H, rows[-1] + 1 + pad)
    for view, (a, b) in zip(['front', 'side', 'back'], [(0, c1), (c1, c2), (c2, W)]):
        xs = np.where(colsum[a:b] > 0)[0]
        x0, x1 = max(a, a + xs[0] - pad), min(b, a + xs[-1] + 1 + pad)
        crop = im.crop((x0, y0, x1, y1))
        crop.save(f'art/pixel/views/{name}_{view}.png')
        w = max(1, round((x1 - x0) * H_OUT / (y1 - y0)))
        sizes[f'{name}_{view}'] = f'{w}x{H_OUT}'
print(json.dumps(sizes))
