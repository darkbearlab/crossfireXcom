"""把去背減色好的三視圖（art/pixel/q/<名字>_<視圖>_q15.png）拼成遊戲用的精靈圖。

每名少女一張索引色 PNG（同一組 15 色調色盤，0 號透明），四格一列：
  正面 | 右側 | 背面 | 左側（右側左右翻轉）
每格一樣寬（取四格最寬），腳底貼齊格子底部、左右置中。
輸出 assets/sprites/girls/<名字>.png 和 assets/sprites/girls.json（格子大小、四個方向、調色盤）。

用法：python art/pack_sprites.py
"""
import glob, json, os
from PIL import Image

NAMES = ['akane', 'hikari', 'yukino', 'momo', 'chinatsu', 'kaede', 'shiori']
DIRS = ['front', 'right', 'back', 'left']
os.makedirs('assets/sprites/girls', exist_ok=True)
meta = {'dirs': DIRS, 'note': '每格腳底在格子底部中間；0 號色透明', 'girls': {}}
for n in NAMES:
    v = {k: Image.open(glob.glob(f'art/pixel/q/{n}_{k}_q*.png')[0]) for k in ['front', 'side', 'back']}
    pal = v['front'].getpalette()
    for k, im in v.items():
        assert im.mode == 'P' and im.getpalette() == pal, f'{n}_{k} 調色盤不一樣'
    cells = [v['front'], v['side'], v['back'], v['side'].transpose(Image.FLIP_LEFT_RIGHT)]
    cw = max(c.width for c in cells)
    ch = max(c.height for c in cells)
    sheet = Image.new('P', (cw * 4, ch), 0)
    sheet.putpalette(pal)
    for i, c in enumerate(cells):
        sheet.paste(c, (i * cw + (cw - c.width) // 2, ch - c.height))
    sheet.info['transparency'] = 0
    sheet.save(f'assets/sprites/girls/{n}.png', transparency=0, optimize=True)
    meta['girls'][n] = {
        'file': f'girls/{n}.png', 'cell': [cw, ch],
        'palette': ['#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]) for i in range(16)],
    }
    print(n, f'{cw}x{ch} x4')
json.dump(meta, open('assets/sprites/girls.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
