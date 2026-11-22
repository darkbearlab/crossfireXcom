// 朱音的「方塊人」版。骨架和臉的預設貼圖在 mc-base.js，這裡只有她的皮膚
// 每個部位是一個盒子，六個面各一張字元圖（皮膚），分內層和外層：
//   內層＝盒子本身；外層＝貼在外面多凸一格，只有畫了的地方才有方塊（頭髮、裙子、靴子）
// 皮膚照 art/pixel/akane.png 設計：紅色刺刺頭髮＋高馬尾、紅色無袖上衣金邊、胸前發光的青色蝴蝶結、百褶短裙、及膝長靴、雙槍
// 字元圖怎麼看：見 voxel-rig.js 的 skinBox。格式說明：docs/voxel-rig.md
import { mcRig, rows, bands } from './mc-base.js';

const PAL = {
  s: '#f8d0b0', d: '#e2aa88',                     // 皮膚、皮膚陰影
  H: '#e5202a', h: '#b01620', L: '#ff5a48',       // 頭髮、深、亮
  k: '#4a0810',                                   // 髮圈
  R: '#d8222c', r: '#a3151d', G: '#e8b440',       // 衣服紅、深紅（褶子／陰影）、金邊
  D: '#7a1018',                                   // 裙子裡面、飄帶
  C: ['#4ff0f0', 'e'], c: ['#c8ffff', 'e'],       // 蝴蝶結（發光）
  B: '#6e1a20', b: '#9c2430', K: '#3e0c12',       // 靴子、靴口、鞋底
  N: '#2a2a32', n: '#4a4a58',                     // 槍
  F: ['#ffe066', 'e'], f: ['#fffbe0', 'e'],       // 槍口火光
};

// ───── 頭 ─────
const HEAD_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsHHHHHH'],   // 第 0 欄靠臉
  back:  rows(8, 'HHHHHHHH'),
  top:   rows(8, 'HHHHHHHH'),
  bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['HHHHHHHH', 'HLHHHHLH', 'HHhHHhHH', 'H..hh..H', 'H......H', 'h......h', '........', '........'],  // 鋸齒瀏海，中間一撮垂到兩眼之間
  side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.hHHHHHH', '..HhHHHH', '...H.HhH'],
  back:  ['HHHHHHHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'HhHHhHHH', 'hH.hh.Hh'],
  top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHLHHLHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'],
};

// ───── 身體 ─────
const BODY_IN = {
  fill: 'R',
  front: ['RRRGGRRR', 'RRRRRRRR', 'RCRRRRCR', 'RRCccCRR', 'RCRRRRCR', 'RRRRRRRR', 'rRRRRRRr', 'rRRRRRRr', 'GGGRRGGG', 'DDDGGDDD', 'DDDDDDDD', 'DDDDDDDD'],
  back:  ['RRRGGRRR', 'RRRRRRRR', 'GRRRRRRG', 'RGRRRRGR', 'RRGRRGRR', 'RRRGGRRR', 'rRRRRRRr', 'rRRRRRRr', 'GGGGGGGG', 'DDDDDDDD', 'DDDDDDDD', 'DDDDDDDD'],
  side:  ['RRRR', 'RRRR', 'RRRR', 'RRRR', 'RRRR', 'RRRR', 'rrrr', 'rrrr', 'GGGG', 'DDDD', 'DDDD', 'DDDD'],
  top:   ['RRRRRRRR', 'RRRssRRR', 'RRRssRRR', 'RRRRRRRR'],
  bottom: rows(4, 'DDDDDDDD'),
};
const SKIRT = 'RrRrRrRr';
const BODY_OUT = {           // 身體的外層：裙子上半（最下面三列），背後中間是蝴蝶結的結
  front: [...rows(9, '........'), SKIRT, SKIRT, SKIRT],
  back:  [...rows(9, '........'), 'RrRDDrRr', 'RrRDDrRr', SKIRT],
  side:  [...rows(9, '....'), 'RrRr', 'RrRr', 'RrRr'],
};
// 裙子下半：獨立一個部位（一圈外層，裡面是空的），兩腿在裡面各自擺動
const SKIRT_LOW = { front: [SKIRT, SKIRT], back: [SKIRT, SKIRT], side: ['RrRr', 'RrRr'] };

export default mcRig({
  id: 'akane-mc', name: '朱音', pal: PAL,
  head: {
    in: HEAD_IN, out: HEAD_OUT,
    extra(v) {
      // 臉頰兩側往外炸開的鬢角（外層再凸出去一點點，朱音的招牌）
      for (const [a, b] of [[5, 6], [-6, -7]]) v.box(a, a, 25, 27, 0, 1, PAL.H).box(b, b, 25, 26, 0, 1, PAL.h).dot(a, 24, 1, PAL.h);
      v.box(-2, 1, 33, 33, -4, -2, PAL.k);                                 // 髮圈
    },
  },
  body: { in: BODY_IN, out: BODY_OUT },
  skirt: { rows: 2, faces: SKIRT_LOW },          // 裙子下半：掛在骨盆上的一圈，兩腿在裡面各自擺動
  armUp: bands('ssssss'), armLo: bands('sssssd'),            // 無袖
  thigh: bands('DDssss'),
  shin: bands('bBBBBK', { front: ['bBb', ...rows(4, 'BBB'), 'KKK'] }),   // 及膝長靴，跟腿一樣粗；靴口前面 V 字

  // 雙槍：一格厚的薄片，握把握在手裡。手垂著時槍口朝下，手臂抬平時槍口朝前
  gun: { hand: 'both', thick: 1, gc: 0, gr: 0, carry: false, rows: ['NNNNn', 'N....'] },

  parts: {
    // 背後的兩條飄帶（會甩）
    ribbon1: {
      parent: 'hips', pivot: [-0.5, 13, -3.5],
      dangle: { k: 40, damp: 5, gain: 0.04, limit: 0.5 },
      build(v) { v.box(-3, -2, 4, 12, -4, -4, PAL.D).box(1, 2, 3, 12, -4, -4, PAL.D).box(-3, -3, 4, 5, -4, -4, PAL.r).box(2, 2, 3, 4, -4, -4, PAL.r); },
    },
    // 高馬尾：兩節方塊，會甩
    pony1: {
      parent: 'head', pivot: [-0.5, 33.5, -3],
      dangle: { k: 90, damp: 9, gain: 0.02, grav: 500, limit: 0.35 },
      build(v) { v.box(-2, 1, 34, 36, -5, -3, PAL.H).box(-1, 0, 37, 38, -5, -4, PAL.H).box(-2, -2, 34, 36, -5, -3, PAL.h).dot(0, 38, -4, PAL.L); },
    },
    pony2: {
      parent: 'pony1', pivot: [-0.5, 36, -5.5],
      dangle: { k: 50, damp: 6, gain: 0.035, grav: 700, limit: 0.6 },
      build(v) {
        v.box(-2, 1, 34, 37, -8, -6, PAL.H).box(-1, 0, 38, 38, -7, -6, PAL.h).box(1, 1, 34, 37, -8, -6, PAL.h);
        v.box(-2, 1, 31, 35, -10, -9, PAL.H).box(-2, -2, 31, 35, -10, -9, PAL.h).box(-1, 0, 28, 30, -11, -10, PAL.h);
      },
    },
  },
  rest: { ribbon1: { x: 0.15 } },

  // 臉：表情和嘴形的貼圖用 mc-base.js 的預設（要改她自己的，在這裡的 face.layers 放同名的貼圖蓋掉）
  //   例：face: { layers: { eyes: { variants: { open: ['.kk..kk.', '.wr..rw.', '.qR..Rq.'] } } } }
  face: { colors: { k: '#3a0a12', r: '#c01018', q: '#f04858', R: '#5a0008', b: '#5a0a12' } },
});
