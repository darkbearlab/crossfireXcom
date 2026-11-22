// 朱音（akane）的可動方塊模型資料。參考圖：art/pixel/akane.png（正面、側面朝右、背面）
// 格式說明：docs/voxel-rig.md
// 座標：一格 = 身高的 1/32；+x＝角色的左手邊、+y 往上、+z 臉朝的方向；身體中線在 x=0、z=-0.5
const SKIN = '#f6cdb0', SKIN_D = '#e0a888';
const R = '#d8222c', R_D = '#a3151d', R_L = '#ef3a3a';
const H = '#e5202a', H_D = '#a8121c', H_L = '#ff5a48';       // 頭髮
const BOOT = '#6e1a20', BOOT_L = '#9c2430', SOLE = '#3e0c12';
const GOLD = '#e8b440', GUN = '#2a2a32', GUN_L = '#4a4a58';
const BOW = '#4ff0f0', BOW_C = '#c8ffff', SCRUNCH = '#5a0a14';
const RIB = '#7a1420', RIB_D = '#5a0c18';
const FLASH = '#ffe066', FLASH_C = '#fffbe0';

export default {
  id: 'akane',
  name: '朱音',
  unit: 32,            // 一個身高單位幾格（腳底到頭頂大約 35 格，馬尾另計）

  // 部位：寫的順序要「上層先寫」。pivot＝關節位置（跟方塊同一套座標）
  parts: {
    hips: {
      pivot: [0, 12, -0.5],
      build(v) { v.box(-2, 2, 12, 13, -2, 1, R_D); },          // 裙子裡面，平常看不到
    },
    thighL: {
      parent: 'hips', pivot: [1.5, 12, -0.5],
      build(v) { v.box(1, 2, 8, 11, -1, 0, SKIN); },
    },
    shinL: {
      parent: 'thighL', pivot: [1.5, 8, -0.5],
      build(v) {
        v.box(1, 3, 0, 6, -1, 1, BOOT).box(1, 3, 0, 1, 2, 2, BOOT).box(1, 3, 0, 0, -1, 2, SOLE);
        v.box(1, 3, 7, 7, -1, 1, BOOT_L).dot(2, 6, 1, BOOT_L);  // 靴口，前面 V 字
        v.dot(1, 1, -2, SOLE).dot(2, 1, -2, SOLE).dot(1, 0, -2, SOLE).dot(2, 0, -2, SOLE); // 鞋跟
      },
    },
    thighR: { mirror: 'thighL' },
    shinR: { mirror: 'shinL' },
    skirt: {
      parent: 'hips', pivot: [0, 14, -0.5],
      build(v) {
        v.box(-3, 3, 14, 14, -2, 1, R_D);
        for (let x = -4; x <= 4; x++) v.box(x, x, 12, 13, -3, 2, x % 2 ? R : R_D);
        for (let x = -5; x <= 5; x++) v.box(x, x, 10, 11, -4, 3, x % 2 ? R : R_D);
        for (const x of [-5, 5]) for (const z of [-4, 3]) v.clear(x, x, 10, 11, z, z);
        for (const x of [-4, 4]) for (const z of [-3, 2]) v.clear(x, x, 12, 13, z, z);
      },
    },
    // 背後的大蝴蝶結飄帶（兩節，會甩）
    ribbon1: {
      parent: 'hips', pivot: [0, 14.5, -4.5],
      dangle: { k: 40, damp: 5, gain: 0.04 },
      build(v) {
        v.box(-1, 1, 13, 14, -4, -4, RIB_D).dot(-2, 14, -4, RIB).dot(2, 14, -4, RIB).dot(-2, 13, -4, RIB_D).dot(2, 13, -4, RIB_D);
        v.box(-2, -1, 9, 12, -5, -5, RIB).box(1, 2, 8, 12, -5, -5, RIB);
      },
    },
    ribbon2: {
      parent: 'ribbon1', pivot: [0, 9, -5],
      dangle: { k: 30, damp: 4, gain: 0.05 },
      build(v) {
        v.box(-2, -1, 3, 8, -5, -5, RIB).box(1, 2, 2, 7, -5, -5, RIB);
        v.dot(-3, 3, -5, RIB_D).dot(-3, 2, -5, RIB_D).dot(-1, 3, -5, RIB_D);
        v.dot(3, 2, -5, RIB_D).dot(3, 1, -5, RIB_D).dot(1, 2, -5, RIB_D);
      },
    },
    torso: {
      parent: 'hips', pivot: [0, 15, -0.5],
      build(v) {
        v.box(-2, 2, 15, 21, -2, 1, R);
        v.box(-2, 2, 15, 15, -2, 1, GOLD);                                  // 腰線
        v.dot(-2, 16, 1, GOLD).dot(0, 16, 1, GOLD).dot(2, 16, 1, GOLD);      // 前面鋸齒
        v.box(-1, 1, 20, 20, 1, 1, R_L);                                    // 胸口亮面
        v.box(-1, 1, 21, 21, -2, 1, GOLD).dot(0, 20, 1, GOLD);              // 金色立領
        v.dot(-2, 19, -2, GOLD).dot(-1, 18, -2, GOLD).dot(0, 17, -2, GOLD).dot(1, 18, -2, GOLD).dot(2, 19, -2, GOLD); // 背後 V
      },
    },
    bow: {
      parent: 'torso', pivot: [0, 18.5, 2],
      build(v) {
        v.sym(2, 2, 17, 19, 2, 2, BOW, 'e').sym(1, 1, 18, 18, 2, 2, BOW, 'e');   // ⋈ 兩片翅膀
        v.dot(0, 18, 2, BOW_C, 'e');                                             // 中間的結
      },
    },
    upperArmL: {
      parent: 'torso', pivot: [3, 21.5, -0.5],
      build(v) { v.box(3, 3, 18, 21, -1, 0, SKIN); },
    },
    lowerArmL: {
      parent: 'upperArmL', pivot: [3, 18, -0.5],
      build(v) { v.box(3, 3, 14, 17, -1, 0, SKIN).box(3, 3, 12, 13, -1, 0, SKIN_D); },
    },
    // 手槍：平常槍口朝下（手垂著），手臂抬平時槍口自然朝前
    gunL: {
      parent: 'lowerArmL', pivot: [3.5, 13, -0.5],
      build(v) {
        v.box(4, 4, 8, 13, 0, 0, GUN).box(4, 4, 8, 13, 1, 1, GUN_L).box(4, 4, 11, 13, -1, -1, GUN);
        v.dot(4, 8, 0, '#111116');
      },
    },
    flashL: {
      parent: 'gunL', pivot: [4, 8, 0.5], hidden: true,
      build(v) {
        v.box(4, 4, 5, 7, 0, 1, FLASH, 'e').dot(4, 6, 0, FLASH_C, 'e').dot(4, 6, 1, FLASH_C, 'e');
        v.dot(3, 6, 0, FLASH, 'e').dot(5, 6, 1, FLASH, 'e').dot(4, 4, 0, FLASH, 'e').dot(4, 6, -1, FLASH, 'e').dot(4, 6, 2, FLASH, 'e');
      },
    },
    upperArmR: { mirror: 'upperArmL' },
    lowerArmR: { mirror: 'lowerArmL' },
    gunR: { mirror: 'gunL' },
    flashR: { mirror: 'flashL' },
    head: {
      parent: 'torso', pivot: [0, 22, -0.5],
      build(v) {
        v.box(-1, 1, 22, 22, -1, 0, SKIN_D);                                  // 脖子
        v.box(-4, 4, 24, 31, -3, 3, SKIN).box(-3, 3, 23, 23, -2, 3, SKIN);    // 臉（下巴窄一格）
        // 尖耳朵（從鬢角後面露出來）
        v.sym(5, 6, 26, 27, -1, -1, SKIN).sym(5, 5, 25, 28, 0, 0, SKIN).sym(6, 6, 28, 28, -2, -2, SKIN).sym(6, 6, 26, 26, -2, -2, SKIN_D);
        // 頭頂：圓一點、不要像帽子
        v.box(-5, 5, 31, 33, -4, 3, H).box(-4, 4, 34, 34, -4, 1, H).box(-2, 2, 35, 35, -3, -1, H);
        for (const x of [-5, 5]) v.clear(x, x, 33, 33, -4, -4).clear(x, x, 33, 33, 3, 3);
        // 後腦：兩層，下緣一根一根尖下來
        v.box(-5, 5, 24, 30, -4, -4, H).box(-4, 4, 25, 33, -5, -5, H_D);
        const nape = [1, 0, 2, 0, 3, 1, 3, 0, 2, 0, 1];
        nape.forEach((d, i) => { const x = i - 5; if (d) v.box(x, x, 24 - d, 23, -4, -4, i % 2 ? H : H_D); });
        for (const x of [-3, 0, 3]) v.box(x, x, 22, 24, -5, -5, H_D);
        // 兩側：前面的鬢髮長到臉頰，後面短，耳朵那裡留空
        const sideBottom = { [-4]: 23, [-3]: 24, [-2]: 25, [-1]: 29, 0: 29, 1: 25, 2: 23, 3: 22 };
        for (const [z, y0] of Object.entries(sideBottom)) v.sym(5, 5, y0, 32, +z, +z, H);
        v.sym(5, 5, 22, 24, 3, 3, H_D);
        // 瀏海（z=4），每根長度不同，鋸齒狀；中間一撮垂到兩眼之間
        const tips = { [-5]: 24, [-4]: 27, [-3]: 29, [-2]: 30, [-1]: 29, 0: 27, 1: 29, 2: 30, 3: 29, 4: 27, 5: 24 };
        for (const [x, y0] of Object.entries(tips)) { v.box(+x, +x, y0, 33, 4, 4, H); v.dot(+x, y0, 4, H_D); }
        v.box(-4, 4, 32, 33, 5, 5, H).sym(2, 3, 31, 31, 5, 5, H).dot(-2, 33, 5, H_L).dot(-1, 32, 5, H_L).dot(3, 33, 5, H_L);
        // 頭頂亂翹（打破帽子輪廓）
        v.spike(-4, 34, 1, -0.6, 1, 0.5, 3, H, 0.6).spike(4, 34, 1, 0.6, 1, 0.5, 3, H, 0.6);
        v.spike(-1, 34, 4, -0.3, 0.5, 1, 3, H_D, 0.4).spike(2, 34, 4, 0.3, 0.6, 1, 2, H, 0.4);
        v.spike(-6, 32, -2, -1, 0.7, -0.2, 3, H, 0.6).spike(6, 32, -2, 1, 0.7, -0.2, 3, H, 0.6);
        v.spike(-3, 30, -6, -0.5, -0.4, -1, 3, H_D, 0.5).spike(3, 30, -6, 0.5, -0.4, -1, 3, H_D, 0.5);
        // 臉頰兩側往外炸開的鬢角（招牌）
        for (const s of [-1, 1]) {
          v.spike(6 * s, 28, 1, s, 0.6, 0.15, 4, H, 1);
          v.spike(6 * s, 25, 1, s, -0.1, 0.25, 4, H_D, 1);
          v.spike(6 * s, 23, 0, s, -0.75, 0.1, 3, H, 0.6);
          v.spike(6 * s, 30, -1, s, 0.9, -0.3, 3, H_D, 0.6);
        }
        // 髮圈
        v.box(-1, 1, 35, 36, -4, -2, SCRUNCH).box(-2, 2, 35, 35, -3, -3, SCRUNCH);
      },
    },
    // 高馬尾：三節，越後面越軟
    pony1: {
      parent: 'head', pivot: [0, 37, -3],
      dangle: { k: 90, damp: 9, gain: 0.02, grav: 500, limit: 0.35 },
      build(v) {
        v.box(-1, 1, 37, 38, -4, -2, H);
        v.spike(0, 39, -3, 0, 1, -0.15, 6, H, 1.3);
        v.spike(0, 38, -2, 0.65, 1, 0.35, 5, H_D, 0.8).spike(0, 38, -3, -0.65, 1, 0.15, 5, H, 0.8);
      },
    },
    pony2: {
      parent: 'pony1', pivot: [0, 39, -4],
      dangle: { k: 55, damp: 6, gain: 0.03, grav: 700, limit: 0.5 },
      build(v) {
        v.spike(0, 40, -4, 0.15, 0.7, -1, 7, H, 1.2);
        v.spike(0, 39, -5, -0.55, 0.35, -1, 6, H_D, 1);
        v.spike(0, 39, -5, 0.6, 0.15, -1, 6, H, 1);
        v.spike(0, 38, -5, 0, -0.15, -1, 6, H_D, 1);
        v.dot(0, 41, -5, H_L).dot(1, 42, -6, H_L);
      },
    },
    pony3: {
      parent: 'pony2', pivot: [0, 41, -10],
      dangle: { k: 35, damp: 4, gain: 0.045, grav: 900, limit: 0.7 },
      build(v) {
        v.spike(1, 44, -11, 0.15, 0.35, -1, 4, H, 0.7);
        v.spike(0, 37, -11, 0, -0.45, -1, 4, H_D, 0.6);
        v.spike(-3, 41, -10, -0.3, 0.1, -1, 3, H, 0.5);
        v.spike(3, 40, -10, 0.35, -0.1, -1, 3, H_D, 0.5);
      },
    },
  },

  // 站姿（所有動作都從這裡開始加）：手微微張開，槍不要卡到裙子
  rest: {
    upperArmL: { z: 0.22 }, upperArmR: { z: -0.22 },
    lowerArmL: { x: -0.12 }, lowerArmR: { x: -0.12 },
    gunL: { z: -0.2, x: 0.1 }, gunR: { z: 0.2, x: 0.1 },
    ribbon1: { x: 0.18 }, ribbon2: { x: 0.05 },
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
      eyes: {
        y: 28,
        variants: {
          open:     ['.kk...kk.', '.wr...wr.', '.rR...rR.', '.qq...qq.'],
          happy:    ['.........', '.kk...kk.', 'k..k.k..k', '.........'],
          closed:   ['.........', '.........', '.kk...kk.', 'k.......k'],
          angry:    ['.k.....k.', '.rk...kr.', '.rR...Rr.', '.qq...qq.'],
          wide:     ['.kk...kk.', '.ww...ww.', '.wR...Rw.', '.ww...ww.'],
          pain:     ['.........', '.k.....k.', '..k...k..', '.k.....k.'],
          ko:       ['.........', '.k.k.k.k.', '..k...k..', '.k.k.k.k.'],
        },
      },
      // 眉毛貼在瀏海前面（瀏海表面在 4.5），所以從臉一路厚到 4.6
      brows: {
        z: 3.5, depth: 1.1,
        variants: {
          normal: { y: 29, rows: ['.bb...bb.'] },
          angry:  { y: 30, rows: ['.b.....b.', '..b...b..'] },
          up:     { y: 30, rows: ['.bb...bb.'] },
          sad:    { y: 30, rows: ['..b...b..', '.b.....b.'] },
        },
      },
      mouth: {
        y: 24,
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
      blush: { y: 24, variants: { on: ['pp.....pp'] } },
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
