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

export default {
  id: 'akane',
  name: '朱音',
  unit: 48,            // 身高格數（決定一格多大：一格＝身高/48）。腳底到頭頂 50 格，馬尾另計

  // 部位：寫的順序要「上層先寫」。pivot＝關節位置（跟方塊同一套座標）
  parts: {
    hips: {
      pivot: [0, 24, 0],
      build(v) { v.box(-3, 3, 23, 28, -2, 2, R_D); },           // 裙子裡面，平常看不到
    },
    thighL: {
      parent: 'hips', pivot: [2.5, 23, -0.5],
      build(v) { v.box(1, 4, 13, 22, -2, 1, SKIN); },
    },
    // 及膝長靴：靴口外翻、前面 V 字缺口、有鞋跟
    shinL: {
      parent: 'thighL', pivot: [2.5, 13, -0.5],
      build(v) {
        v.box(1, 4, 12, 12, -2, 1, SKIN);                                   // 膝蓋
        v.box(1, 4, 1, 10, -2, 1, BOOT).box(1, 4, 0, 2, 2, 3, BOOT);        // 靴筒、腳尖
        v.box(1, 4, 0, 0, -2, 3, SOLE).box(1, 4, 0, 2, -3, -3, SOLE);       // 鞋底、鞋跟
        v.box(0, 5, 11, 11, -3, 2, BOOT_L);
        for (const x of [0, 5]) for (const z of [-3, 2]) v.clear(x, x, 11, 11, z, z);
        v.box(2, 3, 10, 10, 2, 2, BOOT_L).clear(2, 3, 11, 11, 2, 2);        // 前面 V 字缺口
      },
    },
    thighR: { mirror: 'thighL' },
    shinR: { mirror: 'shinL' },
    // 百褶裙：上窄下寬，前後面按 x、側面按 z 交錯深淺
    skirt: {
      parent: 'hips', pivot: [0, 28.5, 0],
      build(v) {
        for (let y = 22; y <= 28; y++) {
          const t = Math.sqrt((28 - y) / 6), hx = Math.round(3.5 + 3.5 * t), hz = Math.round(3 + 2.2 * t);   // 上面很快撐開
          for (let x = -hx; x <= hx; x++) for (let z = -hz; z <= hz; z++) {
            if (Math.abs(x) === hx && Math.abs(z) === hz) continue;      // 圓角
            const dark = Math.abs(x) === hx ? (z & 1) : (x & 1);
            v.dot(x, y, z, dark || y === 22 ? R_D : R);
          }
        }
      },
    },
    // 背後的大蝴蝶結飄帶（兩節，會甩）
    ribbon1: {
      parent: 'hips', pivot: [0, 27.5, -5.5],
      dangle: { k: 40, damp: 5, gain: 0.04 },
      build(v) {
        v.box(-1, 1, 26, 28, -5, -5, RIB_D).sym(2, 4, 27, 28, -5, -5, RIB).sym(2, 3, 26, 26, -5, -5, RIB_D).sym(4, 4, 29, 29, -5, -5, RIB); // 腰後的大蝴蝶結
        v.box(-4, -2, 18, 25, -6, -6, RIB).box(2, 4, 17, 25, -6, -6, RIB).box(-3, -3, 18, 25, -6, -6, RIB_D).box(3, 3, 17, 25, -6, -6, RIB_D);
      },
    },
    ribbon2: {
      parent: 'ribbon1', pivot: [0, 17.5, -6],
      dangle: { k: 30, damp: 4, gain: 0.05 },
      build(v) {
        v.box(-4, -2, 7, 17, -6, -6, RIB).box(2, 4, 6, 16, -6, -6, RIB).box(-3, -3, 7, 17, -6, -6, RIB_D).box(3, 3, 6, 16, -6, -6, RIB_D);
        v.box(-5, -5, 6, 8, -6, -6, RIB_D).clear(-3, -3, 7, 7, -6, -6);     // 剪成燕尾
        v.box(5, 5, 5, 7, -6, -6, RIB_D).clear(3, 3, 6, 6, -6, -6);
      },
    },
    torso: {
      parent: 'hips', pivot: [0, 29, 0],
      build(v) {
        v.box(-3, 3, 29, 36, -2, 2, R).box(-2, 2, 33, 35, 3, 3, R);         // 身體、胸口
        v.box(-3, 3, 29, 29, -2, 2, GOLD);                                  // 金色腰線
        v.sym(2, 3, 30, 30, 2, 2, GOLD).dot(0, 30, 2, GOLD).dot(0, 31, 2, GOLD); // 前面往上的 V 字
        v.box(-1, 1, 36, 36, 3, 3, R_L).box(-2, 2, 37, 37, -1, 1, R).box(-1, 1, 37, 37, 0, 2, GOLD); // 立領
        v.dot(0, 36, 3, GOLD);
        // 背後的 V
        [[-3, 36], [-2, 35], [-1, 34], [0, 33], [1, 34], [2, 35], [3, 36]].forEach(([x, y]) => v.dot(x, y, -2, GOLD));
      },
    },
    bow: {
      parent: 'torso', pivot: [0, 34, 4],
      build(v) {
        v.sym(1, 2, 35, 35, 4, 4, BOW, 'e').sym(1, 3, 34, 34, 4, 4, BOW, 'e').sym(1, 2, 33, 33, 4, 4, BOW, 'e'); // 兩片圓圓的翅膀
        v.dot(0, 34, 4, BOW_C, 'e').sym(1, 1, 32, 32, 4, 4, BOW, 'e');           // 中間的結、兩條小尾巴
      },
    },
    upperArmL: {
      parent: 'torso', pivot: [4.5, 36.5, -0.5],
      build(v) { v.box(4, 5, 30, 36, -1, 0, SKIN); },
    },
    lowerArmL: {
      parent: 'upperArmL', pivot: [4.5, 30, -0.5],
      build(v) { v.box(4, 5, 24, 29, -1, 0, SKIN).box(4, 5, 21, 23, -1, 0, SKIN_D).dot(4, 23, 1, SKIN_D); },
    },
    // 手槍：平常槍口朝下（手垂著），手臂抬平時槍口自然朝前。樞紐在手掌
    gunL: {
      parent: 'lowerArmL', pivot: [5, 22.5, -0.5],
      build(v) {
        v.box(6, 7, 16, 24, 0, 0, GUN).box(6, 7, 16, 24, 1, 1, GUN_L).box(6, 7, 20, 24, -2, -1, GUN);
        v.dot(6, 20, -1, GUN_L).box(6, 7, 16, 16, 0, 0, '#111116');
      },
    },
    flashL: {
      parent: 'gunL', pivot: [6.5, 16, 0.5], hidden: true,
      build(v) {
        v.box(6, 7, 12, 15, 0, 1, FLASH, 'e').box(6, 7, 13, 14, 0, 1, FLASH_C, 'e');
        v.box(5, 5, 13, 14, 0, 1, FLASH, 'e').box(8, 8, 13, 14, 0, 1, FLASH, 'e').box(6, 7, 13, 14, -1, -1, FLASH, 'e').box(6, 7, 13, 14, 2, 2, FLASH, 'e');
        v.box(6, 7, 10, 11, 0, 1, FLASH, 'e');
      },
    },
    upperArmR: { mirror: 'upperArmL' },
    lowerArmR: { mirror: 'lowerArmL' },
    gunR: { mirror: 'gunL' },
    flashR: { mirror: 'flashL' },
    head: {
      parent: 'torso', pivot: [0, 38, -0.5],
      build(v) {
        v.box(-3, 3, 38, 38, -3, 3, SKIN).box(-4, 4, 39, 47, -4, 3, SKIN);    // 臉（下巴窄一格）
        // 尖耳朵（從鬢角後面露出來，尖端往後上）
        v.sym(5, 6, 42, 43, -1, -1, SKIN).sym(5, 5, 41, 43, 0, 0, SKIN).sym(6, 6, 44, 44, -2, -2, SKIN).sym(6, 6, 42, 42, 0, 0, SKIN_D);
        // 頭頂：圓一點、不要像帽子
        v.box(-5, 5, 46, 49, -5, 4, H).box(-4, 4, 50, 50, -4, 2, H).box(-2, 2, 51, 51, -3, 0, H);
        for (const x of [-5, 5]) for (const z of [-5, 4]) v.clear(x, x, 49, 49, z, z);
        // 後腦：兩層，下緣一根一根尖下來
        v.box(-5, 5, 39, 45, -5, -5, H).box(-4, 4, 39, 49, -6, -6, H_D);
        [2, 0, 3, 1, 4, 2, 4, 1, 3, 0, 2].forEach((d, i) => { const x = i - 5; if (d) v.box(x, x, 39 - d, 38, -5, -5, i % 2 ? H : H_D); });
        for (const x of [-3, 0, 3]) v.box(x, x, 36, 38, -6, -6, H_D);
        // 兩側：前面的鬢髮長到下巴，後面短，耳朵那裡留空
        const sideBottom = { [-5]: 38, [-4]: 38, [-3]: 39, [-2]: 40, [-1]: 45, 0: 45, 1: 40, 2: 38, 3: 37 };
        for (const [z, y0] of Object.entries(sideBottom)) v.sym(5, 5, y0, 48, +z, +z, H);
        v.sym(5, 5, 36, 38, 3, 3, H_D).sym(4, 4, 37, 41, 4, 4, H).sym(4, 4, 37, 37, 4, 4, H_D);
        // 瀏海（z=4）：每根長度不同，鋸齒狀；中間一撮垂到兩眼之間
        const tips = { [-5]: 40, [-4]: 44, [-3]: 45, [-2]: 46, [-1]: 45, 0: 43, 1: 45, 2: 46, 3: 45, 4: 44, 5: 40 };
        for (const [x, y0] of Object.entries(tips)) { v.box(+x, +x, y0, 49, 4, 4, H); v.dot(+x, y0, 4, H_D); }
        v.box(-4, 4, 47, 49, 5, 5, H).sym(2, 3, 46, 46, 5, 5, H).dot(0, 46, 5, H);
        v.dot(-2, 49, 5, H_L).dot(-1, 48, 5, H_L).dot(-3, 48, 5, H_L).dot(3, 49, 5, H_L).dot(2, 48, 5, H_L);
        // 頭頂圓圓的（參考圖），只在兩側和後面翹幾根
        v.spike(-6, 48, -2, -1, 0.7, -0.2, 3, H, 0.6).spike(6, 48, -2, 1, 0.7, -0.2, 3, H, 0.6);
        v.spike(-3, 45, -7, -0.5, -0.4, -1, 3, H_D, 0.5).spike(3, 45, -7, 0.5, -0.4, -1, 3, H_D, 0.5);
        // 臉頰兩側往外炸開的鬢角（招牌）
        for (const s of [-1, 1]) {
          v.spike(6 * s, 44, 1, s, 0.55, 0.15, 4, H, 1);
          v.spike(6 * s, 42, 1, s, -0.05, 0.25, 4, H_D, 1);
          v.spike(6 * s, 40, 0, s, -0.6, 0.1, 3, H, 0.7);
        }
        // 髮圈（頭頂偏後）
        v.box(-1, 1, 50, 51, -5, -3, SCRUNCH).box(-2, 2, 50, 50, -4, -4, SCRUNCH);
      },
    },
    // 高馬尾：三節，越後面越軟。從頭頂後面往上衝，再往後、往右散開
    pony1: {
      parent: 'head', pivot: [0, 52, -4],
      dangle: { k: 90, damp: 9, gain: 0.02, grav: 500, limit: 0.35 },
      build(v) {
        v.box(-1, 1, 52, 54, -5, -3, H);
        v.spike(0, 55, -4, 0.15, 1, -0.2, 5, H, 1.6);
      },
    },
    pony2: {
      parent: 'pony1', pivot: [0, 56, -5],
      dangle: { k: 55, damp: 6, gain: 0.03, grav: 700, limit: 0.5 },
      build(v) {
        v.spike(0, 57, -5, 0.15, 1, -0.35, 7, H, 2);            // 往上衝的那根
        v.spike(0, 56, -6, 0.35, 0.5, -1, 9, H_D, 1.8);         // 往右後上
        v.spike(0, 56, -6, -0.3, 0.3, -1, 8, H, 1.5);           // 往左後
        v.spike(0, 57, -4, 1, 0.65, -0.2, 8, H, 1.5);           // 往右上（正面看得到的那叢）
        v.spike(0, 56, -5, 1, 0.15, -0.5, 7, H_D, 1.2);         // 往右
        v.spike(0, 57, -4, -0.8, 0.9, -0.2, 6, H_D, 1.2);       // 往左上
        v.spike(0, 55, -6, 0, -0.1, -1, 9, H_D, 1.5);           // 往正後
        v.dot(0, 61, -6, H_L).dot(1, 62, -7, H_L).dot(1, 59, -9, H_L).dot(2, 60, -3, H_L);
      },
    },
    pony3: {
      parent: 'pony2', pivot: [0, 57, -14],
      dangle: { k: 35, damp: 4, gain: 0.045, grav: 900, limit: 0.7 },
      build(v) {
        v.spike(3, 60, -15, 0.25, 0.2, -1, 5, H_D, 1);
        v.spike(0, 54, -15, 0, -0.45, -1, 5, H_D, 1);
        v.spike(-2, 58, -14, -0.25, 0, -1, 4, H, 0.8);
      },
    },
  },

  // 站姿（所有動作都從這裡開始加）：雙腿微微張開、手往外張，槍垂直朝下
  rest: {
    thighL: { z: 0.11 }, thighR: { z: -0.11 }, shinL: { z: -0.06 }, shinR: { z: 0.06 },
    upperArmL: { z: 0.26 }, upperArmR: { z: -0.26 },
    lowerArmL: { x: -0.1 }, lowerArmR: { x: -0.1 },
    gunL: { z: -0.26, x: 0.1 }, gunR: { z: 0.26, x: 0.1 },
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
      eyes: {
        y: 44,
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
          normal: { y: 45, rows: ['.bb...bb.'] },
          angry:  { y: 46, rows: ['.b.....b.', '..b...b..'] },
          up:     { y: 46, rows: ['.bb...bb.'] },
          sad:    { y: 46, rows: ['..b...b..', '.b.....b.'] },
        },
      },
      mouth: {
        y: 40,
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
      blush: { y: 40, variants: { on: ['pp.....pp'] } },
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
