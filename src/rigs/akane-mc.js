// 朱音的「方塊人」版：Minecraft 比例但手腳比較細（頭 8×8×8、身體 8×12×4、手 2×12×3、腳 3×12×3），一格 = 皮膚的一個像素
// 每個部位是一個盒子，六個面各一張字元圖（皮膚），分內層和外層：
//   內層＝盒子本身；外層＝貼在外面多凸一格，只有畫了的地方才有方塊（頭髮、裙子、靴子）
// 皮膚照 art/pixel/akane.png 設計：紅色刺刺頭髮＋高馬尾、紅色無袖上衣金邊、胸前發光的青色蝴蝶結、百褶短裙、及膝長靴、雙槍
// 字元圖怎麼看：見 voxel-rig.js 的 skinBox。格式說明：docs/voxel-rig.md
import { skinBox } from '../voxel-rig.js';

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
const rows = (n, row) => Array(n).fill(row);

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

// ───── 手（2 格寬、3 格深，無袖）─────
const ARM_UP = { fill: 's', front: rows(6, 'ss'), back: rows(6, 'ss'), side: rows(6, 'sss'), top: rows(3, 'ss') };
const ARM_LO = { fill: 's', front: [...rows(5, 'ss'), 'dd'], back: [...rows(5, 'ss'), 'dd'], side: [...rows(5, 'sss'), 'ddd'], bottom: rows(3, 'dd') };

// ───── 腳（3 格寬、3 格深。左腳；右腳鏡像。兩腿中間空兩格）─────
const THIGH_IN = {
  fill: 's',
  front: ['DDD', 'DDD', 'sss', 'sss', 'sss', 'sss'], back: ['DDD', 'DDD', 'sss', 'sss', 'sss', 'sss'],
  side:  ['DDD', 'DDD', 'sss', 'sss', 'sss', 'sss'], top: rows(3, 'DDD'),
};
const SHIN_IN = { fill: 'B', front: ['bBb', ...rows(4, 'BBB'), 'KKK'], back: ['bbb', ...rows(4, 'BBB'), 'KKK'], side: ['bbb', ...rows(4, 'BBB'), 'KKK'], bottom: rows(3, 'KKK') };
const SHIN_OUT = {           // 靴子比腿粗一圈，靴口外翻、前面 V 字
  front: ['b.b', 'BBB', 'BBB', 'BBB', 'BBB', 'KKK'], back: ['bbb', ...rows(4, 'BBB'), 'KKK'], side: ['bbb', ...rows(4, 'BBB'), 'KKK'],
};

export default {
  id: 'akane-mc',
  name: '朱音（方塊人）',
  unit: 32,          // 腳底到頭頂 32 格（腳 12、身體 12、頭 8）
  evenX: true,       // 身體寬度是偶數格：中線在 x=-0.5，左右鏡像用 x → -x-1

  parts: {
    hips: { pivot: [-0.5, 12, -0.5], build() {} },                       // 只是關節
    thighL: { parent: 'hips', pivot: [2, 12, 0], build(v) { skinBox(v, [1, 6, -1, 3, 6, 3], THIGH_IN, PAL); } },
    shinL: { parent: 'thighL', pivot: [2, 6, 0], build(v) { skinBox(v, [1, 0, -1, 3, 6, 3], SHIN_IN, PAL); skinBox(v, [1, 0, -1, 3, 6, 3], SHIN_OUT, PAL, true); } },
    thighR: { mirror: 'thighL' },
    shinR: { mirror: 'shinL' },
    skirt: { parent: 'hips', pivot: [-0.5, 12, -0.5], build(v) { skinBox(v, [-4, 10, -2, 8, 2, 4], SKIRT_LOW, PAL, true); } },
    // 背後的兩條飄帶（會甩）
    ribbon1: {
      parent: 'hips', pivot: [-0.5, 13, -3.5],
      dangle: { k: 40, damp: 5, gain: 0.04, limit: 0.5 },
      build(v) { v.box(-3, -2, 4, 12, -4, -4, PAL.D).box(1, 2, 3, 12, -4, -4, PAL.D).box(-3, -3, 4, 5, -4, -4, PAL.r).box(2, 2, 3, 4, -4, -4, PAL.r); },
    },
    torso: { parent: 'hips', pivot: [-0.5, 12, -0.5], build(v) { skinBox(v, [-4, 12, -2, 8, 12, 4], BODY_IN, PAL); skinBox(v, [-4, 12, -2, 8, 12, 4], BODY_OUT, PAL, true); } },
    upperArmL: { parent: 'torso', pivot: [4.5, 22.5, 0], build(v) { skinBox(v, [4, 18, -1, 2, 6, 3], ARM_UP, PAL); } },
    lowerArmL: { parent: 'upperArmL', pivot: [4.5, 18, 0], build(v) { skinBox(v, [4, 12, -1, 2, 6, 3], ARM_LO, PAL); } },
    // 手槍：一格厚的薄片（像 Minecraft 手上拿的東西）。手垂著時槍口朝下，手臂抬平時槍口朝前
    gunL: {
      parent: 'lowerArmL', pivot: [5, 12, 0],
      build(v) { v.box(5, 5, 6, 11, 0, 0, PAL.N).box(5, 5, 6, 11, 1, 1, PAL.n).box(5, 5, 10, 11, -2, -1, PAL.N).dot(5, 6, 0, '#111116'); },
    },
    flashL: {
      parent: 'gunL', pivot: [5, 6, 0.5], hidden: true,
      build(v) { v.box(5, 5, 3, 5, 0, 1, PAL.F[0], 'e').box(5, 5, 4, 4, -1, 2, PAL.F[0], 'e').box(4, 6, 4, 4, 0, 1, PAL.F[0], 'e').box(5, 5, 4, 4, 0, 1, PAL.f[0], 'e').box(5, 5, 1, 2, 0, 1, PAL.F[0], 'e'); },
    },
    upperArmR: { mirror: 'upperArmL' },
    lowerArmR: { mirror: 'lowerArmL' },
    gunR: { mirror: 'gunL' },
    flashR: { mirror: 'flashL' },
    head: {
      parent: 'torso', pivot: [-0.5, 24, -0.5],
      build(v) {
        skinBox(v, [-4, 24, -4, 8, 8, 8], HEAD_IN, PAL);
        skinBox(v, [-4, 24, -4, 8, 8, 8], HEAD_OUT, PAL, true);
        // 臉頰兩側往外炸開的鬢角（外層再凸出去一點點，朱音的招牌）
        for (const [a, b] of [[5, 6], [-6, -7]]) v.box(a, a, 25, 27, 0, 1, PAL.H).box(b, b, 25, 26, 0, 1, PAL.h).dot(a, 24, 1, PAL.h);
        v.box(-2, 1, 33, 33, -4, -2, PAL.k);                                 // 髮圈
      },
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

  // 站姿：手微微張開，槍垂直朝下
  rest: {
    upperArmL: { z: 0.1 }, upperArmR: { z: -0.1 },
    gunL: { z: -0.1 }, gunR: { z: 0.1 },
    ribbon1: { x: 0.15 },
  },

  // ───── 臉（表情和嘴形都是貼圖，要改就改下面的字元圖）─────
  // 臉是貼在頭正面的薄片，8 格寬（跟頭一樣寬），分四層：eyes 眼睛、brows 眉毛、mouth 嘴巴、blush 臉紅
  // 每一層有好幾張「貼圖」（variants），一次只顯示一張；一個字元＝一格，'.' 是透明，顏色看 colors
  //   y＝這張貼圖最上面一列在第幾格高（頭是 24–31）；左到右對應頭的 8 格（第 0 欄是角色的右臉）
  //   眼睛：三列（睫毛、瞳孔上、瞳孔下），在第 1–2、5–6 欄；嘴巴：兩列，在第 2–5 欄
  // 要加新的：在那一層加一張貼圖，再到 expressions 把它編進某個表情，或到 visemes 指定給某個嘴形
  // 改完重新整理預覽頁（voxel-rig.html）就看得到；「看臉」按鈕可以拉近
  face: {
    part: 'head', x0: -4, z: 3.5,
    colors: {
      k: '#3a0a12', r: '#c01018', q: '#f04858', R: '#5a0008', w: '#ffffff',
      b: '#5a0a12', m: '#8a2a30', t: '#e06070', W: '#ffffff', p: '#ff9aa6',
    },
    blinkEyes: 'closed',
    layers: {
      eyes: {
        y: 28,
        variants: {
          open:   ['.kk..kk.', '.wr..rw.', '.qR..Rq.'],
          happy:  ['........', '.kk..kk.', 'k..kk..k'],
          closed: ['........', '........', '.kk..kk.'],
          angry:  ['.k....k.', '.rk..kr.', '.qR..Rq.'],
          wide:   ['.kk..kk.', '.ww..ww.', '.wR..Rw.'],
          pain:   ['.k....k.', '..k..k..', '.k....k.'],
          ko:     ['k.k..k.k', '.k....k.', 'k.k..k.k'],
        },
      },
      // 眉毛貼在瀏海（外層）前面
      brows: {
        z: 3.5, depth: 1.1,
        variants: {
          none:  { y: 29, rows: ['.'] },
          angry: { y: 30, rows: ['.b....b.', '..b..b..'] },
          up:    { y: 30, rows: ['.bb..bb.'] },
          sad:   { y: 30, rows: ['..b..b..', '.b....b.'] },
        },
      },
      mouth: {
        y: 25,
        variants: {
          rest:  ['........', '...mm...'],
          smile: ['..m..m..', '...mm...'],
          frown: ['...mm...', '..m..m..'],
          small: ['........', '...tt...'],
          big:   ['..mmmm..', '..mttm..'],
          i:     ['........', '..WWWW..'],
          u:     ['...mm...', '...tt...'],
          grit:  ['..WWWW..', '..mmmm..'],
          wavy:  ['........', '.m.mm.m.'],
        },
      },
      blush: { y: 25, variants: { on: ['pp....pp'] } },
    },
  },

  expressions: {
    normal:    { eyes: 'open', brows: 'none', mouth: 'rest' },
    smile:     { eyes: 'happy', brows: 'none', mouth: 'smile', blush: 'on', blink: false },
    angry:     { eyes: 'angry', brows: 'angry', mouth: 'frown' },
    surprised: { eyes: 'wide', brows: 'up', mouth: 'u' },
    pain:      { eyes: 'pain', brows: 'sad', mouth: 'grit', blink: false },
    blink:     { eyes: 'closed', brows: 'none', mouth: 'rest', blink: false },
    ko:        { eyes: 'ko', brows: 'sad', mouth: 'wavy', blink: false },
  },
  visemes: { closed: 'rest', small: 'small', big: 'big', i: 'i', u: 'u' },
};
