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

// 臉的字元圖小工具。臉的貼片用比頭再細一倍的格子（頭一格 = 2×2 片）
// REF：直接從參考圖搬過來的那一層（art/rig_carve.py 的 face），頭抬高了 4 格（= 8 片）所以 y 加 8
const REF = name => ({ ...CARVED.face[name], y: CARVED.face[name].y + 8 });
// UP2：手畫的排列用頭的格子畫，每格放大成 2×2 片
const UP2 = rows => rows.flatMap(r => { const d = [...r].map(c => c + c).join(''); return [d, d]; });
// EYES：只寫角色右眼（畫面左邊）那 6 格，左眼自動鏡像，中間隔 5 格 → 17 格寬
const EYES = (...rows) => UP2(rows.map(r => r + '.....' + [...r].reverse().join('')));
// MOUTH：嘴巴只寫中間 7 格，兩邊各補 5 格
const MOUTH = (...rows) => UP2(rows.map(r => '.....' + r + '.....'));

export default {
  id: 'akane',
  name: '朱音',
  unit: 48,            // 身高格數（決定一格多大：一格＝身高/48）。腳底到頭頂 50 格，馬尾另計

  // 部位：寫的順序要「上層先寫」。pivot＝關節位置（跟方塊同一套座標）
  // 堆出來的部位（腿、靴子、裙子、上身、手臂、頭）都用比骨架細一倍的格子（fine: 2），形狀和顏色都直接來自參考圖
  // 這些部位 build 裡的座標是細格子；pivot 和手排的部位（飄帶、槍、馬尾）是骨架的格子
  parts: {
    hips: { pivot: [0, 24, 0], build(v) { v.box(-3, 3, 23, 27, -2, 2, R_D); } },   // 裙子裡面，平常看不到
    thighL: { parent: 'hips', pivot: [3.5, 23, -0.5], fine: 2, build(v) { v.put(CARVED.thighL); } },
    shinL: { parent: 'thighL', pivot: [3.5, 14, -0.5], fine: 2, build(v) { v.put(CARVED.shinL); } },   // 膝蓋＋長靴
    thighR: { mirror: 'thighL' },
    shinR: { mirror: 'shinL' },
    skirt: { parent: 'hips', pivot: [0, 27.5, 0], fine: 2, build(v) { v.put(CARVED.skirt); } },
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
    // 上身：金邊、領子、蝴蝶結都是參考圖上的像素。青色的格子（蝴蝶結）改成發光
    // 肩膀在規格裡削斜（xcap）；脖子是另外補的（頭比參考圖抬高，讓脖子露出來）
    torso: {
      parent: 'hips', pivot: [0, 28, 0], fine: 2,
      build(v) {
        v.put(CARVED.torso).glow(c => { const n = parseInt(c.c.slice(1), 16); return (n >> 16) < 150 && (n >> 8 & 255) > 150 && (n & 255) > 150; });
        v.box(-2, 2, 78, 83, -4, 1, SKIN_D).box(-2, 2, 78, 83, 1, 1, SKIN);
      },
    },
    // 手臂比參考圖低一格（肩膀放低）
    upperArmL: { parent: 'torso', pivot: [4.5, 36.5, -2.5], fine: 2, build(v) { v.put(CARVED.upperArmL).move(0, -2, 0); } },
    lowerArmL: { parent: 'upperArmL', pivot: [4.5, 30, -3], fine: 2, build(v) { v.put(CARVED.lowerArmL).move(0, -2, 0); } },
    // 手槍（手排）：平常槍口朝下（手垂著），手臂抬平時槍口自然朝前。樞紐在手掌
    gunL: {
      parent: 'lowerArmL', pivot: [5, 24, -3],
      build(v) {
        v.box(6, 7, 18, 26, -3, -3, GUN).box(6, 7, 18, 26, -2, -2, GUN_L).box(6, 7, 22, 26, -5, -4, GUN);
        v.dot(6, 22, -4, GUN_L).box(6, 7, 18, 18, -3, -3, '#111116').move(0, -1, 0);
      },
    },
    flashL: {
      parent: 'gunL', pivot: [6.5, 17, -2.5], hidden: true,
      build(v) {
        v.box(6, 7, 14, 17, -3, -2, FLASH, 'e').box(6, 7, 15, 16, -3, -2, FLASH_C, 'e');
        v.box(5, 5, 15, 16, -3, -2, FLASH, 'e').box(8, 8, 15, 16, -3, -2, FLASH, 'e').box(6, 7, 15, 16, -4, -4, FLASH, 'e').box(6, 7, 15, 16, -1, -1, FLASH, 'e');
        v.box(6, 7, 12, 13, -3, -2, FLASH, 'e').move(0, -1, 0);
      },
    },
    upperArmR: { mirror: 'upperArmL' },
    lowerArmR: { mirror: 'lowerArmL' },
    gunR: { mirror: 'gunL' },
    flashR: { mirror: 'flashL' },
    // 頭：用比身體細一倍的格子堆（fine: 2），眼睛才畫得出參考圖的比例。這裡面的座標都是細格子
    // 臉削平、眼睛嘴巴的位置塗成膚色（規格裡的 cap、skin），改用貼片。整顆頭比參考圖抬高 4 細格，讓脖子露出來
    head: {
      parent: 'torso', pivot: [0, 41, -1], fine: 2,
      build(v) {
        v.put(CARVED.head).flatten(-10, 10, 80, 90, 6).move(0, 4, 0);        // 臉補成平面
        v.box(-2, 5, 104, 108, -10, -4, SCRUNCH).box(-4, 7, 104, 106, -8, -6, SCRUNCH);   // 髮圈
      },
    },
    // 高馬尾（手排，身體的格子）：三節，越後面越軟。從頭頂後面往右後上方衝，再往後、往右散開，尾端垂下來
    pony1: {
      parent: 'head', pivot: [0.5, 55, -4],
      dangle: { k: 90, damp: 9, gain: 0.02, grav: 500, limit: 0.35 },
      build(v) {
        v.box(-1, 2, 55, 56, -5, -3, H);
        v.spike(0, 56, -4, 0.5, 1, -0.9, 4, H, 1.6);
      },
    },
    pony2: {
      parent: 'pony1', pivot: [1.5, 59, -7],
      dangle: { k: 55, damp: 6, gain: 0.03, grav: 700, limit: 0.5 },
      build(v) {
        v.spike(2, 60, -8, 0.5, 1, -0.9, 5, H, 1.5);             // 往上衝的那根
        v.spike(1, 58, -6, 1, 0.15, -0.4, 9, H, 1.5);            // 往右（正面看得到的那叢）
        v.spike(1, 59, -7, 0.4, 0.6, -1, 8, H_D, 1.3);           // 往右後上
        v.spike(1, 58, -7, 0.25, 0.1, -1, 10, H, 1.8);           // 往後
        v.spike(0, 57, -7, -0.3, -0.05, -1, 9, H_D, 1.4);        // 往左後
        v.dot(3, 62, -9, H_L).dot(3, 63, -10, H_L).dot(2, 59, -10, H_L).dot(5, 59, -7, H_L);
      },
    },
    pony3: {
      parent: 'pony2', pivot: [0, 56, -14],
      dangle: { k: 35, damp: 4, gain: 0.045, grav: 900, limit: 0.7 },
      build(v) {
        v.spike(0, 55, -13, 0, -0.8, -0.5, 7, H_D, 1.2);         // 垂下來的尾端
        v.spike(2, 58, -16, 0.2, -0.1, -1, 3, H, 0.6);
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

  // 臉：貼在 head 上的薄片，一片 = 頭的格子的一半（fine: 4）。每一層的每一種排列是一組字元圖，最上面一列在 y
  // 「普通」表情的眼睛、鼻子、嘴巴是直接從參考圖搬過來的（REF）；其他排列是手畫的（EYES／MOUTH）
  // x0＝手畫排列最左一片的 x；z＝貼在哪個面（臉的表面在 13）
  face: {
    part: 'head', fine: 4, x0: -16.5, z: 13, depth: 0.12,
    colors: {
      k: '#1c0408', r: '#b01020', q: '#e8404a', R: '#3c0008', w: '#ffffff',
      b: '#5a0a12', m: '#a0522c', t: '#e06070', W: '#ffffff', p: '#ff9aa6',
    },
    blinkEyes: 'closed',
    layers: {
      eyes: {
        y: 185,
        variants: {
          open:   REF('eyes'),
          happy:  EYES('......', '.kkkk.', 'kk..kk', 'k....k', '......'),
          closed: EYES('......', '......', '......', 'k....k', '.kkkk.'),
          angry:  EYES('kk....', 'kkkkk.', 'kwwRkk', 'kwRRrk', '.rqqr.'),
          wide:   EYES('.kkkk.', 'kwwwwk', 'kwRRwk', 'kwwwwk', '.kkkk.'),
          pain:   EYES('kk....', '..kk..', '....kk', '..kk..', 'kk....'),
          ko:     EYES('k...k.', '.k.k..', '..k...', '.k.k..', 'k...k.'),
        },
      },
      // 眉毛貼在瀏海前面（瀏海表面在 17），所以從臉一路厚到 17.2
      brows: {
        z: 13, depth: 4.2,
        variants: {
          none:   { y: 189, rows: ['.'] },
          normal: { y: 189, rows: EYES('.bbbb.') },
          angry:  { y: 191, rows: EYES('bbb...', '..bbbb') },
          up:     { y: 191, rows: EYES('.bbbb.') },
          sad:    { y: 191, rows: EYES('...bbb', 'bbb...') },
        },
      },
      nose: { variants: { on: REF('nose') } },
      mouth: {
        y: 173,
        variants: {
          rest:   REF('mouth'),
          smile:  MOUTH('m.....m', '.mmmmm.', '.......'),
          frown:  MOUTH('.mmmmm.', 'm.....m', '.......'),
          small:  MOUTH('..mmm..', '..mtm..', '.......'),
          big:    MOUTH('.mmmmm.', '.mtttm.', '..mmm..'),
          i:      MOUTH('.......', 'mWWWWWm', '.mmmmm.'),
          u:      MOUTH('..mmm..', '..mtm..', '..mmm..'),
          grit:   MOUTH('mWWWWWm', 'mWWWWWm', '.mmmmm.'),
          wavy:   MOUTH('.......', 'm.m.m.m', '.m.m.m.'),
        },
      },
      blush: { y: 175, variants: { on: EYES('.ppp..', '..pp..') } },
    },
  },

  // 表情＝每一層要用哪一種排列。blink:false 的表情不會自動眨眼
  expressions: {
    normal:    { eyes: 'open', brows: 'none', mouth: 'rest' },   // 參考圖的眼睛沒有另外畫眉毛
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
