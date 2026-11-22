// 千夏的方塊人皮膚。照 art/pixel/chinatsu.png：墨綠鮑伯頭、右眼發光的瞄準鏡片、藍綠色軍裝外套（金扣、皮帶）、
// 深綠百褶裙、黑褲襪、棕色短靴、背後有金色花紋的連帽披風、狙擊槍。骨架和臉的預設貼圖在 mc-base.js
import { mcRig, rows, bands, plane } from './mc-base.js';

const PAL = {
  s: '#f6d4b8', d: '#dcb094',
  H: '#1e3a30', h: '#142820', L: '#2e5444',       // 頭髮
  J: '#1c4a48', j: '#143634',                     // 外套、陰影
  O: '#9a9448',                                   // 橄欖金（扣子、滾邊、披風花紋）
  K: '#1a1a1a', Q: '#c0b060',                     // 皮帶、皮帶扣
  S: '#1c3c2c', D: '#142c20',                     // 裙子、褶子
  X: '#18181c',                                   // 褲襪
  B: '#6a4428', b: '#3e2814',                     // 靴子、鞋底
  M: '#2c4a30', m: '#203824',                     // 披風、陰影
  G: '#26282c', g: '#44464c',                     // 槍
};

const HEAD_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsHHHHHH'],   // 第 0 欄靠臉
  back: rows(8, 'HHHHHHHH'), top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['HHHHHHHH', 'HHLHHHHH', 'HHHHhHHH', 'HHh.HhHH', 'H......H', 'H......H', 'H......H', 'h......h'],   // 鮑伯頭：兩側齊到下巴
  side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.HHHHHHH', '.HHHHHHH', '.hHHHHHh'],
  back:  ['HHHHHHHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'HHHHHHHH', 'hHhHHhHh'],
  top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHLLHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'],
};
const BODY_IN = {
  fill: 'J',
  front: ['MMJOOJMM', 'MMJJJJMM', 'MJOJJOJM', 'JJJJJJJJ', 'JJOJJOJJ', 'JJJJJJJJ', 'jJOJJOJj', 'KKKQQKKK', 'JOOOOOOJ', 'SDSDSDSD', 'SDSDSDSD', 'SDSDSDSD'],
  back:  [...rows(7, 'JJJJJJJJ'), 'KKKKKKKK', 'JJJJJJJJ', 'SDSDSDSD', 'SDSDSDSD', 'SDSDSDSD'],
  side:  ['MMMM', 'MMMM', ...rows(5, 'JJJJ'), 'KKKK', 'JJJJ', 'SDSD', 'SDSD', 'SDSD'],
  top:   ['MMMMMMMM', 'MMMssMMM', 'MMMssMMM', 'MMMMMMMM'], bottom: rows(4, 'XXXXXXXX'),
};
const PLEAT = 'SDSDSDSD', LINE = 'OOOOOOOO';
const BODY_OUT = { front: [...rows(9, '........'), PLEAT, PLEAT, PLEAT], back: [...rows(9, '........'), PLEAT, PLEAT, PLEAT], side: [...rows(9, '....'), 'SDSD', 'SDSD', 'SDSD'] };
const SKIRT = { front: [PLEAT, LINE, PLEAT], back: [PLEAT, LINE, PLEAT], side: ['SDSD', 'OOOO', 'SDSD'] };
// 披風（從背後看）：金色菱形和 V 字花紋，下襬收成尖的
const CAPE = [
  '..MMMMMMMM..',
  '.MMMMMMMMMM.',
  'MMMMMMMMMMMM',
  'MMMMMMMMMMMM',
  'MMMMMmmMMMMM',
  'MMMMMmmMMMMM',
  'MMMMMOOMMMMM',
  'MMMMOMMOMMMM',
  'MMMMMOOMMMMM',
  'MMMMMOOMMMMM',
  'MOMMMOOMMMOM',
  'MMOOMOOMOOMM',
  'mMMMOOOOMMMm',
  '.mMMMOOMMMm.',
  '..mMMMMMMm..',
  '....mMMm....',
];

export default mcRig({
  id: 'chinatsu-mc', name: '千夏', pal: PAL,
  head: { in: HEAD_IN, out: HEAD_OUT },
  body: { in: BODY_IN, out: BODY_OUT },
  skirt: { rows: 3, faces: SKIRT },
  armUp: bands('MJJJJJ'),
  armLo: bands('JJJJOs'),
  thigh: bands('DDXXXX'),
  shin: bands('XXBBBb', { front: ['XXX', 'XXX', 'BBB', 'BQB', 'BBB', 'bbb'] }),
  gun: {
    hand: 'R', thick: 1, gc: 4, gr: 1, mr: 1, per: 1.3,
    rows: ['.....gGGg..........',
           'GGGGGGGGGGGgggggggg',
           'GG..G..............'],
  },
  parts: {
    // 披風：掛在肩膀後面的一整片（會甩），上面一小塊是垂下來的帽子
    cape: {
      parent: 'torso', pivot: [-0.5, 23.5, -3.5],
      dangle: { k: 45, damp: 6, gain: 0.035, limit: 0.5 },
      build(v) {
        plane(v, CAPE, PAL, { x0: -6, yTop: 23, z: -4 });
        v.box(-3, 2, 20, 23, -5, -5, PAL.M).box(-2, 1, 19, 19, -5, -5, PAL.m).box(-3, 2, 23, 23, -3, -3, PAL.M);
      },
    },
  },
  rest: { cape: { x: 0.08 } },
  face: {
    colors: { k: '#0e201a', r: '#207060', q: '#50b090', R: '#0a3028', b: '#1e3a30', m: '#9a5050', E: ['#40f0a0', 'e'], e: ['#c8ffe4', 'e'] },
    layers: {
      // 瞄準鏡片：罩在她右眼外面的一圈光（任何表情都在）
      lens: { z: 3.5, depth: 0.35, variants: { on: { y: 29, rows: ['.EE.....', 'E..E....', 'E..E....', 'E..E....', '.EE.....'] } } },
    },
  },
});
