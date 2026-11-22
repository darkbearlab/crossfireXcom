// 朱音（akane）的可動方塊模型資料。參考圖：art/pixel/akane.png（正面、側面朝右、背面）
// 格式說明：docs/voxel-rig.md
// 比例照參考圖量：參考圖每 15 像素一格，腳底 y=0、頭頂 y≈50、馬尾尖 y≈62，大約 4 頭身、腿佔一半
// 座標：+x＝角色的左手邊、+y 往上、+z 臉朝的方向；身體中線在 x=0、z=0
const SKIN = '#f6cdb0', SKIN_D = '#e0a888';
const R = '#d8222c', R_D = '#a3151d', R_L = '#ef3a3a';
const H = '#e5202a', H_D = '#a8121c', H_L = '#ff5a48';       // 頭髮
const BOOT = '#6e1a20', BOOT_L = '#9c2430', SOLE = '#3e0c12';
const GOLD = '#e8b440', GUN = '#2a2a32', GUN_L = '#4a4a58';
const BOW = '#4ff0f0', BOW_C = '#c8ffff', SCRUNCH = '#5a0a14';
const RIB = '#7a1420', RIB_D = '#5a0c18';
const FLASH = '#ffe066', FLASH_C = '#fffbe0';

import CARVED from './akane.carved.js';   // art/rig_carve.py 從參考圖堆出來的部位

export default {
  id: 'akane',
  name: '朱音',
  unit: 48,            // 身高格數（決定一格多大：一格＝身高/48）。腳底到頭頂 50 格，馬尾另計

  // 部位：寫的順序要「上層先寫」。pivot＝關節位置（跟方塊同一套座標）
  parts: {
    hips: {
      pivot: [0, 24, 0],
      build(v) { v.box(-3, 3, 23, 27, -2, 2, R_D); },           // 裙子裡面，平常看不到
    },
    // 腿和靴子的形狀是堆出來的；顏色重新上（參考圖的黑線和陰影搬到立體上會變成雜點）
    thighL: { parent: 'hips', pivot: [3.5, 23, -0.5], build(v) { v.put(CARVED.thighL).tint(() => SKIN); } },
    shinL: {                                                                 // 膝蓋＋長靴
      parent: 'thighL', pivot: [3.5, 14, -0.5],
      build(v) { v.put(CARVED.shinL).tint(c => c.c === SKIN || c.c === SKIN_D ? (c.y >= 12 ? SKIN : BOOT_L) : c.y === 0 ? SOLE : c.y >= 11 ? BOOT_L : BOOT); },
    },
    thighR: { mirror: 'thighL' },
    shinR: { mirror: 'shinL' },
    skirt: {
      parent: 'hips', pivot: [0, 27.5, 0],
      build(v) {
        v.put(CARVED.skirt);
        // 百褶：每三格一條深色的褶線（前後面看 x、側面看 z）
        v.tint(c => (Math.abs(c.x) >= 6 ? Math.abs(c.z) % 3 === 2 : Math.abs(c.x) % 3 === 2) || c.y === 23 ? R_D : R);
      },
    },
    // 腰後的大蝴蝶結和兩條飄帶（手排，兩節，會甩）
    ribbon1: {
      parent: 'hips', pivot: [0, 26.5, -6.5],
      dangle: { k: 40, damp: 5, gain: 0.04 },
      build(v) {
        v.box(-1, 1, 25, 27, -6, -6, RIB_D).sym(2, 4, 26, 27, -6, -6, RIB).sym(2, 3, 25, 25, -6, -6, RIB_D).sym(4, 4, 28, 28, -6, -6, RIB);
        v.box(-4, -2, 17, 24, -7, -7, RIB).box(2, 4, 16, 24, -7, -7, RIB).box(-3, -3, 17, 24, -7, -7, RIB_D).box(3, 3, 16, 24, -7, -7, RIB_D);
      },
    },
    ribbon2: {
      parent: 'ribbon1', pivot: [0, 16.5, -7],
      dangle: { k: 30, damp: 4, gain: 0.05 },
      build(v) {
        v.box(-4, -2, 6, 16, -7, -7, RIB).box(2, 4, 5, 15, -7, -7, RIB).box(-3, -3, 6, 16, -7, -7, RIB_D).box(3, 3, 5, 15, -7, -7, RIB_D);
        v.box(-5, -5, 5, 7, -7, -7, RIB_D).clear(-3, -3, 6, 6, -7, -7);     // 剪成燕尾
        v.box(5, 5, 4, 6, -7, -7, RIB_D).clear(3, 3, 5, 5, -7, -7);
      },
    },
    torso: {
      parent: 'hips', pivot: [0, 28, 0],
      build(v) {
        v.put(CARVED.torso).tint(() => R);
        // 參考圖上只有一兩個像素寬的細節，堆的時候會被吃掉，用畫的補回來
        v.paint(-3, 3, 28, 28, -3, 3, GOLD);                                         // 金色腰線
        v.paint(-1, 1, 29, 29, 2, 3, GOLD).paint(0, 0, 30, 30, 2, 3, GOLD);          // 前面往上的尖
        v.paint(-2, 2, 38, 38, -3, 3, GOLD).paint(0, 0, 37, 37, 1, 3, GOLD);         // 立領
        [[-3, 36], [-2, 35], [-1, 34], [0, 33], [1, 34], [2, 35], [3, 36]].forEach(([x, y]) => v.paint(x, x, y, y, -3, -3, GOLD)); // 背後的 V
        v.paint(-3, -3, 29, 36, -3, 3, R_D).paint(3, 3, 29, 36, -3, 3, R_D);         // 兩側暗一點
      },
    },
    // 胸前發光的蝴蝶結（手排：要發光）
    bow: {
      parent: 'torso', pivot: [0, 34, 4],
      build(v) {
        v.sym(1, 2, 35, 35, 4, 4, BOW, 'e').sym(1, 3, 34, 34, 4, 4, BOW, 'e').sym(1, 2, 33, 33, 4, 4, BOW, 'e');
        v.dot(0, 34, 4, BOW_C, 'e').sym(1, 1, 32, 32, 4, 4, BOW, 'e');
      },
    },
    upperArmL: { parent: 'torso', pivot: [4.5, 37.5, -2.5], build(v) { v.put(CARVED.upperArmL).tint(() => SKIN); } },
    lowerArmL: { parent: 'upperArmL', pivot: [4.5, 31, -3], build(v) { v.put(CARVED.lowerArmL).tint(c => c.y <= 26 ? SKIN_D : SKIN); } },
    // 手槍（手排）：平常槍口朝下（手垂著），手臂抬平時槍口自然朝前。樞紐在手掌
    gunL: {
      parent: 'lowerArmL', pivot: [5, 25, -3],
      build(v) {
        v.box(6, 7, 18, 26, -3, -3, GUN).box(6, 7, 18, 26, -2, -2, GUN_L).box(6, 7, 22, 26, -5, -4, GUN);
        v.dot(6, 22, -4, GUN_L).box(6, 7, 18, 18, -3, -3, '#111116');
      },
    },
    flashL: {
      parent: 'gunL', pivot: [6.5, 18, -2.5], hidden: true,
      build(v) {
        v.box(6, 7, 14, 17, -3, -2, FLASH, 'e').box(6, 7, 15, 16, -3, -2, FLASH_C, 'e');
        v.box(5, 5, 15, 16, -3, -2, FLASH, 'e').box(8, 8, 15, 16, -3, -2, FLASH, 'e').box(6, 7, 15, 16, -4, -4, FLASH, 'e').box(6, 7, 15, 16, -1, -1, FLASH, 'e');
        v.box(6, 7, 12, 13, -3, -2, FLASH, 'e');
      },
    },
    upperArmR: { mirror: 'upperArmL' },
    lowerArmR: { mirror: 'lowerArmL' },
    gunR: { mirror: 'gunL' },
    flashR: { mirror: 'flashL' },
    // 頭：輪廓和頭髮顏色從參考圖堆出來；臉削平（規格裡的 cap），眼睛嘴巴的位置塗成膚色，改用貼片
    head: {
      parent: 'torso', pivot: [0, 39, -1.5],
      build(v) {
        v.put(CARVED.head);
        v.under(-3, 3, 40, 40, 3, 3, SKIN);                                 // 下巴補平，嘴巴貼片才貼得上
        v.box(-1, 2, 50, 52, -5, -2, SCRUNCH).box(-2, 3, 50, 51, -4, -3, SCRUNCH);   // 髮圈
      },
    },
    // 高馬尾（手排）：三節，越後面越軟。從頭頂後面往右後上方衝，再往後、往右散開，尾端垂下來
    pony1: {
      parent: 'head', pivot: [0.5, 53, -4],
      dangle: { k: 90, damp: 9, gain: 0.02, grav: 500, limit: 0.35 },
      build(v) {
        v.box(-1, 2, 53, 54, -5, -3, H);
        v.spike(0, 54, -4, 0.5, 1, -0.9, 4, H, 1.6);
      },
    },
    pony2: {
      parent: 'pony1', pivot: [1.5, 57, -7],
      dangle: { k: 55, damp: 6, gain: 0.03, grav: 700, limit: 0.5 },
      build(v) {
        v.spike(2, 58, -8, 0.5, 1, -0.9, 5, H, 1.5);             // 往上衝的那根
        v.spike(1, 56, -6, 1, 0.15, -0.4, 9, H, 1.5);            // 往右（正面看得到的那叢）
        v.spike(1, 57, -7, 0.4, 0.6, -1, 8, H_D, 1.3);           // 往右後上
        v.spike(1, 56, -7, 0.25, 0.1, -1, 10, H, 1.8);           // 往後
        v.spike(0, 55, -7, -0.3, -0.05, -1, 9, H_D, 1.4);        // 往左後
        v.dot(3, 60, -9, H_L).dot(3, 61, -10, H_L).dot(2, 57, -10, H_L).dot(5, 57, -7, H_L);
      },
    },
    pony3: {
      parent: 'pony2', pivot: [0, 54, -14],
      dangle: { k: 35, damp: 4, gain: 0.045, grav: 900, limit: 0.7 },
      build(v) {
        v.spike(0, 53, -13, 0, -0.8, -0.5, 7, H_D, 1.2);         // 垂下來的尾端
        v.spike(2, 56, -16, 0.2, -0.1, -1, 3, H, 0.6);
      },
    },
  },

  // 站姿（所有動作都從這裡開始加）：參考圖的 A 字站姿，腿外八、手往外張，槍垂直朝下
  rest: {
    thighL: { z: 0.24 }, thighR: { z: -0.24 }, shinL: { z: -0.05 }, shinR: { z: 0.05 },
    upperArmL: { z: 0.39 }, upperArmR: { z: -0.39 },
    lowerArmL: { z: 0.09, x: -0.1 }, lowerArmR: { z: -0.09, x: -0.1 },
    gunL: { z: -0.48, x: 0.1 }, gunR: { z: 0.48, x: 0.1 },
    ribbon1: { x: 0.25 }, ribbon2: { x: 0.1 },
  },

  // 臉：貼在 head 上的薄片。每一層的每一種排列是一組字元圖，最上面一列在 y
  // x0＝字元圖最左一格的 x；z＝貼在哪個面（臉的表面在 3.5）
  face: {
    part: 'head', x0: -4, z: 3.5,
    colors: {
      k: '#3a0a12', r: '#c01018', q: '#e8303c', R: '#5a0008', w: '#ffffff',
      b: '#5a0a12', m: '#7a1f2a', t: '#e06070', W: '#ffffff', p: '#ff8a9a',
    },
    blinkEyes: 'closed',
    layers: {
      // 眼睛 3 格寬 × 3 格高（照參考圖），在 x -4..-2 和 2..4
      eyes: {
        y: 44,
        variants: {
          open:     ['kkk...kkk', 'wRr...wRr', 'rqq...rqq'],
          happy:    ['.k.....k.', 'k.k...k.k', '.........'],
          closed:   ['.........', '.........', 'kkk...kkk'],
          angry:    ['kk.....kk', 'wRk...kRw', 'rqq...qqr'],
          wide:     ['kkk...kkk', 'wRw...wRw', 'www...www'],
          pain:     ['k.......k', '.kk...kk.', 'k.......k'],
          ko:       ['k.k...k.k', '.k.....k.', 'k.k...k.k'],
        },
      },
      // 眉毛貼在瀏海前面（瀏海表面在 5.5），所以從臉一路厚到 5.6
      brows: {
        z: 3.5, depth: 2.1,
        variants: {
          normal: { y: 45, rows: ['.bb...bb.'] },
          angry:  { y: 46, rows: ['b.......b', '.bb...bb.'] },
          up:     { y: 46, rows: ['.bb...bb.'] },
          sad:    { y: 46, rows: ['..b...b..', 'bb.....bb'] },
        },
      },
      mouth: {
        y: 41,
        variants: {
          rest:   ['.........', '....m....'],
          smile:  ['..m...m..', '...mmm...'],
          frown:  ['...mmm...', '..m...m..'],
          small:  ['.........', '...mtm...'],
          big:    ['..mmmmm..', '..mtttm..'],
          i:      ['.........', '..mWWWm..'],
          u:      ['...mmm...', '...mtm...'],
          grit:   ['..WWWWW..', '..mmmmm..'],
          wavy:   ['.........', '..m.m.m..'],
        },
      },
      blush: { y: 41, variants: { on: ['pp.....pp'] } },
    },
  },

  // 表情＝每一層要用哪一種排列。blink:false 的表情不會自動眨眼
  expressions: {
    normal:    { eyes: 'open', brows: 'normal', mouth: 'rest' },
    smile:     { eyes: 'happy', brows: 'normal', mouth: 'smile', blush: 'on', blink: false },
    angry:     { eyes: 'angry', brows: 'angry', mouth: 'frown' },
    surprised: { eyes: 'wide', brows: 'up', mouth: 'u' },
    pain:      { eyes: 'pain', brows: 'sad', mouth: 'grit', blink: false },
    blink:     { eyes: 'closed', brows: 'normal', mouth: 'rest', blink: false },
    ko:        { eyes: 'ko', brows: 'sad', mouth: 'wavy', blink: false },
  },
  // 對嘴用的嘴形（程式只認這五個名字）→ 這個角色的嘴巴排列
  visemes: { closed: 'rest', small: 'small', big: 'big', i: 'i', u: 'u' },
};
