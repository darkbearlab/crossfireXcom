"""分部位剪影堆疊：照部位框，從像素三視圖（正面、側面朝右、背面）堆出每個部位的方塊。

跟 pixel2voxel.py（整隻一起堆）不同的地方：
  - 一個部位一個框，手臂、腿、身體各自堆，不會黏在一起。
  - 參考圖裡斜著的手腳（A 字站姿）用「每一列平移」扳直，堆出來是直的，之後由骨架擺回斜的。
  - 可以指定哪些顏色類別才算這個部位（例如手臂只收膚色，才不會吃到衣服）。
  - 截面可以修圓（round），不會是方方的十字擠出。

用法：python art/rig_carve.py art/pixel/akane.rig.json
輸出：規格裡 out 指定的 .js（export default { 部位: { palette: [...], cells: [x,y,z,色號, ...] } }）

規格（JSON）：
  image, out, cell（幾像素一格）, feet（腳底的像素 y）, front/side/back（各視圖中線的像素 x）
  parts: { 名字: {
    y: [y0, y1]            這個部位佔的列（模型座標，含頭尾）
    x: [x0, x1], z: [z0, z1]  搜尋範圍（模型座標，扳直之後）
    fx: [上, 下]           正面視圖要平移幾格才對到參考圖（上＝y1 那列、下＝y0 那列，中間線性）
    sz: [上, 下]           側面視圖同理
    f: "sR"  s: "*"        正面／側面哪些類別算這個部位（* ＝不是背景都算）
    c: "sR"                上色可以用哪些類別（不在裡面的像素改抓同一列最近的，可省略＝跟 f 一樣）
    round: 2.5             截面修圓的指數（越大越方，省略＝不修）
    dome: [y起, y頂]       從 y起 往上把截面慢慢縮小（配合 round，頭頂變圓）
    fill: true             每一列把最左到最右之間填滿
    skin: [[x0,x1,y0,y1], ...]  正面這幾塊強制塗膚色（臉：眼睛嘴巴改用貼片）
    cap: [[y0,y1,zmax], ...]    這幾列的 z 不超過 zmax（把臉削平，貼片才貼得上）
    palette: ["#..", ...]  只用這幾個顏色（取最接近的）；省略＝照參考圖的顏色
    fine: 2                這個部位的格子細幾倍（頭用 2）；y/x/z/cap/skin/dome 都用細格子的座標
    default: "#d8222c"     找不到顏色時用的顏色
  } }
類別：. 背景  s 皮膚  R 紅  D 深紅  k 黑線  y 金  C 青  G 槍灰  w 白
"""
import sys, json, colorsys
from collections import Counter
from PIL import Image

spec = json.load(open(sys.argv[1], encoding='utf8'))
im = Image.open(spec['image']).convert('RGB')
px = im.load()
W, H = im.size
bg = px[5, 5]
CELL, FEET = spec['cell'], spec['feet']


def cls(c):
    r, g, b = c
    if sum(abs(a - b2) for a, b2 in zip(c, bg)) < 40: return '.'
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if b > 150 and g > 150 and r < 150: return 'C'
    if l < 0.13: return 'k'
    if s < 0.2 and l < 0.45: return 'G'
    if s < 0.25 and l > 0.75: return 'w'
    if r > 190 and g > 140 and b > 100 and r - b < 130: return 's'
    if r > 170 and g > 120 and b < 110 and g - b > 40: return 'y'
    if l < 0.3: return 'D'
    return 'R'


_cache = {}
def sample_px(view, h, y, CELL=CELL):
    """view 的 (h, y) 那一格（h＝x 或 z，可以是小數）→ (類別, 顏色)。背面視圖左右相反。"""
    key = (view, round(h * 4), y, CELL)
    if key in _cache: return _cache[key]
    cx = spec[view]
    x0 = cx + (h - 0.5) * CELL if view != 'back' else cx - (h + 0.5) * CELL
    y0 = FEET - (y + 1) * CELL
    cnt, cols = Counter(), {}
    N = 5
    for i in range(N):
        for j in range(N):
            xx, yy = int(x0 + (i + 0.5) * CELL / N), int(y0 + (j + 0.5) * CELL / N)
            if not (0 <= xx < W and 0 <= yy < H): k = '.'
            else:
                k = cls(px[xx, yy]); cols.setdefault(k, []).append(px[xx, yy])
            cnt[k] += 1
    if cnt['.'] >= N * N * 0.6: res = ('.', None)
    else:
        k = [c for c, _ in cnt.most_common() if c != '.'][0]
        cs = sorted(cols[k], key=sum)
        res = (k, cs[len(cs) // 2])
    _cache[key] = res
    return res


def lerp(a, t): return a[0] + (a[1] - a[0]) * t
def hexc(c, pal=None):
    """有給調色盤就取最接近的那一色（參考圖的黑線、漸層直接搬到立體上會變成雜點）"""
    if pal:
        rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
        return min(pal, key=lambda h: sum((a - b) ** 2 for a, b in zip(rgb(h), c)))
    return '#%02x%02x%02x' % tuple(min(255, (v // 8) * 8 + 4) for v in c)


def carve(name, P):
    y0, y1 = P['y']; x0, x1 = P['x']; z0, z1 = P['z']
    fcls, scls = P.get('f', '*'), P.get('s', '*')
    ccls = P.get('c', fcls if fcls != '*' else 'sRDyCGw')
    fx, sz = P.get('fx', [0, 0]), P.get('sz', [0, 0])
    ok = lambda k, allow: k != '.' and (allow == '*' or k in allow)
    cells = {}
    offs = {}
    cell = CELL / P.get('fine', 1)      # 這個部位用比較細的格子（頭）

    sample = lambda view, h, y: sample_px(view, h, y, cell)
    for y in range(y0, y1 + 1):
        t = (y1 - y) / (y1 - y0) if y1 > y0 else 0
        fo, so = lerp(fx, t), lerp(sz, t)
        offs[y] = (fo, so)
        xs = [x for x in range(x0, x1 + 1) if ok(sample('front', x + fo, y)[0], fcls)]
        zs = [z for z in range(z0, z1 + 1) if ok(sample('side', z + so, y)[0], scls)]
        if not xs or not zs: continue
        if P.get('fill'):
            xs = list(range(min(xs), max(xs) + 1)); zs = list(range(min(zs), max(zs) + 1))
        cxm, hx = (min(xs) + max(xs)) / 2, (max(xs) - min(xs) + 1) / 2
        czm, hz = (min(zs) + max(zs)) / 2, (max(zs) - min(zs) + 1) / 2
        n = P.get('round')
        dome = P.get('dome')            # [從哪一列開始收, 頂端那列]：往上把截面縮小，頭頂才會圓
        if dome and y > dome[0]:
            k = (1 - ((y - dome[0]) / (dome[1] + 1 - dome[0])) ** 2) ** 0.5
            hx, hz = hx * k, hz * k
        for x in xs:
            for z in zs:
                if n:
                    dx, dz = max(0, abs(x - cxm) - 0.5) / max(hx - 0.5, 0.5), max(0, abs(z - czm) - 0.5) / max(hz - 0.5, 0.5)
                    if dx ** n + dz ** n > 1.0: continue
                if any(a <= y <= b and z > zm for a, b, zm in P.get('cap', [])): continue
                cells[(x, y, z)] = None

    def pick(view, h, y, lo, hi, off, allow=None):
        """這一格的顏色；類別不對就往兩邊找同一列最近的"""
        for d in range(0, hi - lo + 2):
            for hh in ([h] if d == 0 else [h - d, h + d]):
                k, c = sample(view, hh + off, y)
                if c is not None and k in (allow or ccls): return c
        return None

    skin = P.get('skin', [])
    default = P.get('default', '#d8222c')
    for (x, y, z) in cells:
        fo, so = offs[y]
        front = (x, y, z + 1) not in cells
        back = (x, y, z - 1) not in cells
        side = (x - 1, y, z) not in cells or (x + 1, y, z) not in cells
        c = None
        if front:
            # 臉上要貼貼片的地方：改抓同一列最近的膚色（陰影也跟著，不會留下一塊亮亮的方框）
            if any(a <= x <= b and c0 <= y <= d for a, b, c0, d in skin): c = pick('front', x, y, x0, x1, fo, 's') or 'SKIN'
            else: c = pick('front', x, y, x0, x1, fo)
        elif back: c = pick('back', x, y, x0, x1, fo)
        elif side: c = pick('side', z, y, z0, z1, so)
        else: c = pick('front', x, y, x0, x1, fo)   # 只有上下露出來的
        cells[(x, y, z)] = P.get('skinColor', '#f6cdb0') if c == 'SKIN' else hexc(c, P.get('palette')) if c else default
    pal, idx, flat = [], {}, []
    for (x, y, z), c in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0], kv[0][2])):
        if c not in idx: idx[c] = len(pal); pal.append(c)
        flat += [x, y, z, idx[c]]
    print(f'{name:10s} {len(cells):5d} 格  {len(pal):3d} 色')
    return {'palette': pal, 'cells': flat}


def face_tiles(F):
    """臉的貼片：框裡「跟膚色差很多」的像素原樣搬過來（眼睛、鼻子、嘴巴），一個像素一片
    回傳 { 層: { x, y, rows:[字元圖], colors:{字元: 顏色} } }，座標是 fine 倍的細格子"""
    cell = CELL / F['fine']
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    q = F.get('quant', 24)
    def colour(x, y):
        x0, y0 = spec['front'] + (x - 0.5) * cell, FEET - (y + 1) * cell
        cs = sorted((px[int(x0 + (i + 0.5) * cell / 3), int(y0 + (j + 0.5) * cell / 3)] for i in range(3) for j in range(3)), key=sum)
        return cs[4]
    skin = tuple(int(F['skin'][i:i + 2], 16) for i in (1, 3, 5))
    res = {}
    def skinlike(c):   # 皮膚的陰影（偏橘的淺色）不算五官
        r, g, b = c
        return r > 150 and 0.55 < g / r < 0.9 and 0.38 < b / r < 0.75
    for lname, L in F['layers'].items():
        boxes = L['boxes']
        x0 = min(b[0] for b in boxes); x1 = max(b[1] for b in boxes); y0 = min(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        pal, rows = {}, []
        for y in range(y1, y0 - 1, -1):
            row = ''
            for x in range(x0, x1 + 1):
                c = colour(x, y)
                inside = any(a <= x <= b and c0 <= y <= d for a, b, c0, d in boxes)
                if not inside or sum(abs(a - b) for a, b in zip(c, skin)) < L.get('threshold', F.get('threshold', 60)) or (L.get('noSkin') and skinlike(c)): row += '.'; continue
                h = '#%02x%02x%02x' % tuple(min(255, (v // q) * q + q // 2) for v in c)
                if h not in pal: pal[h] = letters[len(pal)]
                row += pal[h]
            rows.append(row)
        res[lname] = {'x': x0, 'y': y1, 'rows': rows, 'colors': {v: k for k, v in pal.items()}}
        print(f'臉 {lname:6s} {x1 - x0 + 1}x{y1 - y0 + 1}  {len(pal)} 色')
        for r in rows: print('   ', r)
    return res


out = {name: carve(name, P) for name, P in spec['parts'].items()}
if 'face' in spec: out['face'] = face_tiles(spec['face'])
with open(spec['out'], 'w', encoding='utf8') as f:
    f.write(f"// 由 art/rig_carve.py 從 {spec['image']} 依 {sys.argv[1]} 的部位框堆出來的，不要手改（改規格重跑）\n")
    f.write('export default ' + json.dumps(out, separators=(',', ':')) + ';\n')
print('→', spec['out'])
