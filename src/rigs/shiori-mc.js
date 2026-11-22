// 詩織的方塊人皮膚。照 art/pixel/shiori.png：金色長捲髮＋花冠、露肩的嫩綠洋裝（白色泡泡袖、發光蝴蝶結）、
// 白色荷葉襯裙、白色過膝襪、嫩綠短靴、背後一對發光的小翅膀、白色衝鋒槍、預設微笑。骨架和臉的預設貼圖在 mc-base.js
import { mcRig, rows, bands, longHair, plane } from './mc-base.js';

const PAL = {
  s: '#fbdcc4', d: '#e8b8a0',
  H: '#ecd890', h: '#cdb466', L: '#f8ecc0',       // 頭髮
  E: '#b4dcb0', e: '#8cc090',                     // 洋裝綠、深
  W: '#fbfaf4', w: '#dedccc',                     // 白、陰影
  G: '#e8c860',                                   // 金邊
  C: ['#f0ffe0', 'e'], c: ['#b8ffa0', 'e'],       // 蝴蝶結（發光）
  A: ['#d0ffc0', 'g'], a: ['#f4fff0', 'e'],       // 翅膀：半透明、亮邊
  F: '#ffffff', R: '#ff9ab8', Y: '#ffd040', l: '#90c060',   // 花冠：白花、粉紅花、黃花、葉子
  B: '#b4dcb0', b: '#c0a050',                     // 靴子、鞋底
  N: '#f4f2ec', n: '#cfcabc',                     // 槍
};

const HEAD_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsHHHHHH'],   // 第 0 欄靠臉
  back: rows(8, 'HHHHHHHH'), top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['HHHHHHHH', 'FRlFYlRF', 'HHhHHHhH', 'Hh.Hh.HH', 'H......H', 'H......H', 'h......h', 'H......H'],   // 第二列是花冠
  side:  ['HHHHHHHH', 'RlFYlFRl', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.HhHHHHH', '.hHHHhHH', '..HHHHHH'],
  back:  ['HHHHHHHH', 'FlRFYlRF', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HhHHHHhH', 'HHHhHHHH', 'HhHHHhHH'],
  top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHLLHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'],
};
const BODY_IN = {
  fill: 'E',
  front: ['ssssssss', 'WWWWWWWW', 'EEcCCcEE', 'EEEccEEE', 'EEEGGEEE', 'EEEWWEEE', 'eEWWWWEe', 'eEWWWWEe', 'GGWWWWGG', 'EEWWWWEE', 'EEWWWWEE', 'EEWWWWEE'],
  back:  ['ssssssss', 'WWWWWWWW', ...rows(4, 'EEEEEEEE'), 'eEEEEEEe', 'eEEEEEEe', 'GGGGGGGG', 'EEEEEEEE', 'EEEEEEEE', 'EEEEEEEE'],
  side:  ['ssss', 'WWWW', ...rows(4, 'EEEE'), 'eeee', 'eeee', 'GGGG', 'EEEE', 'EEEE', 'EEEE'],
  top:   rows(4, 'ssssssss'), bottom: rows(4, 'WWWWWWWW'),
};
// 綠色的外裙前面敞開，露出白色的襯裙
const BODY_OUT = {
  front: [...rows(9, '........'), 'EEWwWwEE', 'EEWwWwEE', 'EGWwWwGE'],
  back:  [...rows(9, '........'), 'EEEEEEEE', 'EEEEEEEE', 'EGEEEEGE'],
  side:  [...rows(9, '....'), 'EEEE', 'EEEE', 'EGGE'],
};
const SKIRT = {
  front: ['EEWwWwEE', 'EeWwWwEE', 'GWWWWWWG'], back: ['EEEEEEEE', 'EeEEEEeE', 'GGWWWWGG'], side: ['EEEE', 'EeEE', 'GGGG'],
};
const WING = [      // 左邊的翅膀，由身體往外畫
  '...aAAa',
  '.aAAAAA',
  'AAAAAa.',
  'AAAAa..',
  '.AAa...',
];

export default mcRig({
  id: 'shiori-mc', name: '詩織', pal: PAL,
  head: { in: HEAD_IN, out: HEAD_OUT },
  body: { in: BODY_IN, out: BODY_OUT },
  skirt: { rows: 3, faces: SKIRT },
  armUp: bands('ssWWWW'),            // 露肩、白色泡泡袖
  armLo: bands('WWWWGs'),
  thigh: bands('WWssGW'),            // 襯裙、露一截腿、過膝襪的金色襪口
  shin: bands('WWWBBb', { left: ['WWW', 'WWW', 'WWW', 'BGB', 'BBB', 'bbb'] }),   // 嫩綠短靴，外側有金色小翅膀
  gun: {
    hand: 'R', thick: 1, gr: 0, mr: 0, per: 0.1, carry: false,
    rows: ['NNNNNn',
           'NNNNN.',
           '.n.N..',
           '.n....'],
  },
  parts: {
    ...longHair(PAL, { c: 'H', d: 'h', y1: 16, y2: 10, wave: true }),
    // 一對發光的小翅膀（會抖）；在長頭髮的兩側往外張
    wingL: {
      parent: 'torso', pivot: [4.5, 20, -3.5],
      dangle: { k: 80, damp: 5, gain: 0.03, limit: 0.3 },
      build(v) { plane(v, WING, PAL, { x0: 5, yTop: 23, z: -4 }); },
    },
    wingR: { mirror: 'wingL' },
  },
  // 她平常就是微笑
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'smile' } },
  face: { colors: { k: '#5a4020', r: '#3a9a40', q: '#80d070', R: '#1a5020', b: '#b89850', m: '#b05860' } },
});
