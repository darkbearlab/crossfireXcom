// 小桃的方塊人皮膚（個子小：scale 0.88）。照 art/pixel/momo.png：橘色刺刺雙馬尾＋發光的黃色髮球、
// 黃色無袖洋裝和發光蝴蝶結、荷葉邊短裙、黃色短靴、三管大砲、預設就是臭臉。骨架和臉的預設貼圖在 mc-base.js
import { mcRig, rows, bands } from './mc-base.js';

const PAL = {
  s: '#f6bc8c', d: '#dc9a6c',
  H: '#f47a1c', h: '#c8560c', L: '#ffa040',       // 頭髮
  Y: '#f8c020', y: '#d89a10', l: '#ffe060',       // 洋裝黃、深、亮（荷葉邊）
  C: ['#fff080', 'e'], c: ['#ffffd8', 'e'],       // 蝴蝶結、髮球（發光）
  B: '#f0b818', b: '#b87c08',                     // 靴子、鞋底
  G: '#3a3a40', g: '#1c1c20', A: '#b88a30',       // 砲管、砲口、黃銅箍
};

const HEAD_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsshHHHH'],   // 第 0 欄靠臉
  back: [...rows(7, 'HHHHHHHH'), 'hHHssHHh'], top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['HHHHHHHH', 'HHLHHLHH', 'HHhHHhHH', 'Hh.HH.hH', 'H..hh..H', 'h......h', '........', '........'],   // 亂翹的瀏海
  side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.hHHHHHH', '..hHHhHH', '...h.H.h'],
  back:  ['HHHHHHHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'hH.HH.Hh', '.h....h.'],
  top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHLLHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'],
};
const BODY_IN = {
  fill: 'Y',
  front: ['YYssssYY', 'YYYssYYY', 'YCCccCCY', 'YYCccCYY', 'YYYYYYYY', 'YYYYYYYY', 'yYYYYYYy', 'yYYYYYYy', 'yyyyyyyy', 'YYYYYYYY', 'YYYYYYYY', 'YYYYYYYY'],
  back:  ['YYssssYY', 'YYYssYYY', 'YYYYYYYY', 'YYYyyYYY', 'YYYyyYYY', 'YYYyyYYY', 'yYYyyYYy', 'yYYYYYYy', 'yyyyyyyy', 'YYYYYYYY', 'YYYYYYYY', 'YYYYYYYY'],
  side:  ['ssss', 'YYYY', 'YYYY', 'YYYY', 'YYYY', 'YYYY', 'yyyy', 'yyyy', 'yyyy', 'YYYY', 'YYYY', 'YYYY'],
  top:   ['YYssssYY', 'ssssssss', 'ssssssss', 'YYssssYY'], bottom: rows(4, 'yyyyyyyy'),
};
const PLEAT = 'YyYyYyYy', FRILL = 'lYlYlYlY';
const BODY_OUT = { front: [...rows(9, '........'), PLEAT, PLEAT, PLEAT], back: [...rows(9, '........'), PLEAT, PLEAT, PLEAT], side: [...rows(9, '....'), 'YyYy', 'YyYy', 'YyYy'] };
const SKIRT = { front: [PLEAT, FRILL], back: [PLEAT, FRILL], side: ['YyYy', 'lYlY'] };

export default mcRig({
  id: 'momo-mc', name: '小桃', pal: PAL, scale: 0.88,
  head: {
    in: HEAD_IN, out: HEAD_OUT,
    extra(v) { v.box(-1, 0, 33, 34, -1, 0, PAL.H).dot(0, 35, 0, PAL.L); },       // 頭頂的呆毛
  },
  body: { in: BODY_IN, out: BODY_OUT },
  skirt: { rows: 2, faces: SKIRT },
  armUp: bands('ssssss'), armLo: bands('sssssd'),
  thigh: bands('yyssss'),
  shin: bands('ssBBBb', { front: ['sss', 'sss', 'lBl', 'BBB', 'BBB', 'bbb'] }),   // 短靴
  gun: {
    hand: 'R', thick: 3, gc: 3, gr: 2, mr: 1, per: 0.9,
    rows: ['AGGGAGGGAGGg',
           'AGGGAGGGAGGg',
           'AGGGAGGGAGGg',
           '...G........'],
  },
  parts: {
    // 雙馬尾：往兩邊炸開的一大叢（會甩），髮根是發光的髮球
    tailL: {
      parent: 'head', pivot: [4.5, 30.5, -0.5],
      dangle: { k: 90, damp: 8, gain: 0.02, grav: 400, limit: 0.3 },
      build(v) {
        v.box(4, 5, 30, 31, -1, 0, PAL.C[0], 'e');
        v.box(6, 9, 29, 33, -2, 1, PAL.H).box(10, 11, 30, 32, -1, 0, PAL.H).box(6, 9, 29, 33, -2, -2, PAL.h);
        v.box(6, 7, 34, 35, -1, 0, PAL.H).box(9, 10, 34, 34, -1, 0, PAL.h).dot(7, 36, 0, PAL.L);
        v.box(12, 13, 31, 31, -1, 0, PAL.h).dot(12, 33, 0, PAL.H).dot(11, 33, 0, PAL.H);
        v.box(7, 8, 27, 28, -1, 0, PAL.h).box(10, 11, 28, 29, -1, 0, PAL.h).dot(12, 28, 0, PAL.h);
      },
    },
    tailR: { mirror: 'tailL' },
  },
  // 她平常就是臭臉
  expressions: { normal: { eyes: 'open', brows: 'angry', mouth: 'frown' } },
  face: { colors: { k: '#3a1808', r: '#d05010', q: '#ffa040', R: '#702000', b: '#8a3a08', m: '#8a3a28', p: '#ff9a80' } },
});
