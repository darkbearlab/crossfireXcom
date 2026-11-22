// 光的方塊人皮膚。照 art/pixel/hikari.png：粉紅長直髮＋兩朵白花、白色洋裝粉紅蝴蝶結（發光）、白手套、
// 粉白層次裙、半透明紫紗、白色過膝襪和白靴、白粉配色的步槍。骨架和臉的預設貼圖在 mc-base.js
import { mcRig, rows, bands, longHair } from './mc-base.js';

const PAL = {
  s: '#fbd8c0', d: '#e8b49c',                     // 皮膚、陰影
  P: '#ff9ec4', p: '#e87aa8', L: '#ffc4dc',       // 頭髮、深、亮
  W: '#fdf6fa', w: '#e4d4e0',                     // 白、白的陰影
  K: '#ff6fa5', k: '#d84a84',                     // 粉紅、深粉紅
  G: '#f0c060',                                   // 金邊
  C: ['#ffffff', 'e'], c: ['#ff9ad0', 'e'],       // 蝴蝶結（發光）
  V: ['#d8c0f0', 'g'],                            // 紫紗（半透明）
  f: '#f0b030',                                   // 花心
  N: '#f4f0f4', n: '#ff8ab8', M: '#c8c0cc',       // 槍：白、粉紅、灰
};

const HEAD_IN = {
  fill: 's',
  front: ['PPPPPPPP', 'PPPPPPPP', 'PssssssP', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'sPPPPPPP', 'ssPPPPPP', 'sdsPPPPP', 'ssPPPPPP', 'dsPPPPPP'],   // 第 0 欄靠臉
  back: rows(8, 'PPPPPPPP'), top: rows(8, 'PPPPPPPP'), bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['PPPPPPPP', 'PLPPPPLP', 'PPPpPPPP', 'Pp.Pp.pP', 'P......P', 'P......P', 'P......P', 'p......p'],   // 齊瀏海，兩側的頭髮垂到下巴
  side:  ['PPPPPPPP', 'PPLPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'pPPPPPPP', '.PPPPPPP', '.pPPPPPP', '..PPPPPP'],
  back:  ['PPPPPPPP', 'PPPPPPPP', 'PpPPPPpP', 'PPPPPPPP', 'PPpPPpPP', 'PPPPPPPP', 'PpPPPPpP', 'PPPPPPPP'],
  top:   ['PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP', 'PPLPPLPP', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'],
};
const BODY_IN = {
  fill: 'W',
  front: ['WWWssWWW', 'WWKWWKWW', 'WKKccKKW', 'WKkCCkKW', 'WWKWWKWW', 'WWWWWWWW', 'wWWGGWWw', 'wWWWWWWw', 'KKKKKKKK', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW'],
  back:  ['WWWssWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'wWWWWWWw', 'wWWWWWWw', 'KKKKKKKK', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW'],
  side:  [...rows(6, 'WWWW'), 'wwww', 'wwww', 'KKKK', 'WWWW', 'WWWW', 'WWWW'],
  top:   ['WWWWWWWW', 'WWWssWWW', 'WWWssWWW', 'WWWWWWWW'], bottom: rows(4, 'WWWWWWWW'),
};
const PLEAT = 'WwWwWwWw', HEM = 'KkKkKkKk';
const BODY_OUT = {           // 裙子上半；背後是大蝴蝶結
  front: [...rows(9, '........'), PLEAT, PLEAT, HEM],
  back:  [...rows(8, '........'), '.KK..KK.', 'WKKGGKKW', 'WkKkkKkW', HEM],
  side:  [...rows(9, '....'), 'WwWw', 'WwWw', 'KkKk'],
};
const SKIRT = { front: [PLEAT, PLEAT, HEM], back: [PLEAT, PLEAT, HEM], side: ['WwWw', 'WwWw', 'KkKk'] };

export default mcRig({
  id: 'hikari-mc', name: '光', pal: PAL,
  head: {
    in: HEAD_IN, out: HEAD_OUT,
    extra(v) {      // 兩朵白花（頭兩側前上方）
      for (const x of [-5, 3]) v.box(x, x + 1, 30, 31, 4, 4, '#ffffff').dot(x < 0 ? -4 : 3, 30, 5, PAL.f).dot(x < 0 ? -5 : 4, 31, 5, '#ffffff');
    },
  },
  body: { in: BODY_IN, out: BODY_OUT },
  skirt: { rows: 3, faces: SKIRT },
  armUp: bands('WWKsss'),            // 泡泡袖（白、粉紅滾邊）
  armLo: bands('sGWWWW'),            // 白手套、金色袖口
  thigh: bands('WWssKW'),            // 裙底、露一截腿、過膝襪的粉紅襪口
  shin: bands('WGWWWk'),             // 白靴、金邊、粉紅鞋底
  gun: {
    hand: 'R', thick: 2, gc: 4, gr: 1, mr: 1, per: 0.16,
    rows: ['.....nNNM.......',
           'NNNNNNNNNNNnnnnn',
           'NN..n.Nn........',
           '....n.n.........'],
  },
  parts: {
    ...longHair(PAL, { c: 'P', d: 'p', y1: 16, y2: 9 }),
    // 半透明的紫紗：從腰往後披，一片在背後、兩片在側邊（會甩）
    veil: {
      parent: 'hips', pivot: [-0.5, 13, -2.5],
      dangle: { k: 35, damp: 5, gain: 0.04, limit: 0.5 },
      build(v) {
        v.box(-6, 5, 4, 11, -7, -7, PAL.V[0], 'g');
        v.box(-6, -6, 5, 11, -6, 0, PAL.V[0], 'g').box(5, 5, 5, 11, -6, 0, PAL.V[0], 'g');
        for (const [x, y] of [[-4, 6], [3, 8], [-1, 5]]) v.dot(x, y, -7, '#ffffff', 'e');
      },
    },
  },
  rest: { veil: { x: 0.12 } },
  face: { colors: { k: '#5a2038', r: '#e0408a', q: '#ff8ac0', R: '#8a1050', b: '#c05a88', m: '#b04a60' } },
});
