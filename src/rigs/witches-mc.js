// 魔女黑手黨「瑪格麗特家族」的方塊人皮膚：七名成員＋教母。沒有參考圖，照遊戲裡現在的造型
// （src/units.js 的 bossParts）和 config.js 的顏色設計。骨架和臉的預設貼圖在 mc-base.js。
// 調色盤慣例：s d 皮膚、H h L 頭髮、C c 主色和陰影、X 黑、其他各自註明。
import { mcRig, rows, bands, headOf, torsoOf, gown, fedora, witchHat, longHair, plane, GUNS } from './mc-base.js';

const SKIN = { s: '#f4d8c4', d: '#dcb49c' };
const X = '#15121a';

// ───── 薇歐拉（眼線）：紫色長大衣、插羽毛的紳士帽、單眼鏡、靛色長髮、狙擊槍 ─────
const EYE = { ...SKIN, H: '#2a2050', h: '#1c1438', L: '#40347a', C: '#5b3f8f', c: '#432c6c', W: '#e8e0f0', G: '#e8c860', X, V: ['#c080ff', 'e'] };
const b_eye = mcRig({
  id: 'b_eye-mc', name: '薇歐拉', pal: EYE,
  head: { ...headOf('long'), extra(v) { fedora(v, EYE.C, EYE.c); v.box(3, 3, 33, 37, -2, -2, EYE.V[0], 'e').dot(3, 38, -3, EYE.V[0], 'e').dot(4, 36, -2, EYE.V[0], 'e'); } },   // 帽子上一根發光的羽毛
  body: { in: torsoOf({ front: ['CCWWWWCC', 'CCcWWcCC', 'CCCccCCC', 'CGCCCCGC', 'CCCCCCCC', 'CGCCCCGC', 'CCCCCCCC', 'cCCCCCCc', 'XXXGGXXX', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: 'CCCCCCCcXCCC' }) },
  armUp: bands('CCCCCC'), armLo: bands('CCCCcX'),            // 黑手套
  thigh: bands('XXXXXX'), shin: bands('XXXXXX'),
  ...gown('CCCCCCCCCc..', 1),                                // 長大衣到小腿，前面敞開
  gun: GUNS.sn,
  parts: longHair(EYE, { c: 'H', d: 'h', y1: 17, y2: 13 }),
  face: {
    colors: { k: '#1c1438', r: '#8040c0', q: '#c080ff', R: '#3a1060', b: '#2a2050', m: '#8a3a60', G: ['#ffe090', 'e'] },
    layers: { monocle: { z: 3.5, depth: 0.35, variants: { on: { y: 29, rows: ['.....GG.', '....G..G', '....G..G', '....G..G', '.....GG.', '.......G', '.......G'] } } } },   // 單眼鏡和鍊子（她的左眼）
  },
});

// ───── 蕾貝卡（執行人）：深色褲裝、黑短髮、歪戴的小紳士帽、臉上一道疤、麥格農 ─────
const EXEC = { ...SKIN, H: '#101014', h: '#08080a', L: '#22222a', C: '#3b2a4a', c: '#2a1c36', R: '#7a1c2c', W: '#e8e4dc', X, N: '#24272c' };
const b_exec = mcRig({
  id: 'b_exec-mc', name: '蕾貝卡', pal: EXEC,
  head: { ...headOf('updo'), extra(v) { v.box(-3, 4, 32, 32, -4, 3, X).box(-1, 3, 33, 34, -2, 1, X).box(-1, 3, 33, 33, -2, 1, EXEC.R); } },   // 小紳士帽歪在一邊
  body: { in: torsoOf({ front: ['CCWWWWCC', 'CCWRRWCC', 'CCCRRCCC', 'CCCRRCCC', 'CNNCCCCC', 'CNNCcCCC', 'CCCCCCCC', 'cCCCcCCc', 'XXXXXXXX', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: 'CCCCCCCcXCCC' }) },   // 紅領帶、肩掛槍套
  armUp: bands('CCCCCC'), armLo: bands('CCCCWs'),
  thigh: bands('CCCCCC'), shin: bands('CCCCXX'),
  gun: GUNS.magnum,
  expressions: { normal: { eyes: 'angry', brows: 'none', mouth: 'rest' } },
  face: {
    colors: { k: '#08080a', r: '#c01030', q: '#ff4060', R: '#500010', b: '#101014', m: '#7a2a30', S: '#e07878' },
    layers: { scar: { z: 3.5, depth: 0.25, variants: { on: { y: 29, rows: ['.S......', '.S......', '........', '.S......', '.S......'] } } } },   // 劃過右眼的疤
  },
});

// ───── 莫妮卡（帳房）：綠背心白襯衫、圓眼鏡、墨綠包頭、左手抱著帳本、手槍 ─────
const BOOK = { ...SKIN, H: '#14281c', h: '#0c1a12', L: '#244232', C: '#2f4a3a', c: '#20362a', W: '#ece8e0', w: '#ccc8c0', G: '#d8b050', X, K: '#2a3a2a', P: '#f0e8d0' };
const b_book = mcRig({
  id: 'b_book-mc', name: '莫妮卡', pal: BOOK,
  head: { ...headOf('updo'), extra(v) { v.box(-2, 1, 31, 34, -7, -5, BOOK.H).box(-1, 0, 32, 33, -8, -8, BOOK.h); } },   // 後腦的包頭
  body: { in: torsoOf({ front: ['WWWssWWW', 'WCCWWCCW', 'WCCCCCCW', 'WCGCCCCW', 'WCCCCCCW', 'WCGCCCCW', 'WCCCCCCW', 'WcGCCCcW', 'XXXGGXXX', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: ['WWWWWWWW', ...rows(6, 'WCCCCCCW'), 'WccccccW', 'XXXXXXXX', ...rows(3, 'CCCCCCCC')], side: 'WWWWWWWWXCCC' }) },
  armUp: bands('WWWWWW'), armLo: bands('WWWWws'),            // 白襯衫袖子
  thigh: bands('CCCCCC'), shin: bands('CCCCXX'),
  gun: GUNS.pistol,
  parts: {
    // 帳本：夾在左手臂彎裡
    ledger: { parent: 'lowerArmL', pivot: [3.5, 14, 2.5], build(v) { v.box(1, 5, 12, 17, 2, 2, BOOK.P).box(1, 5, 12, 17, 3, 3, BOOK.K).box(2, 4, 15, 15, 3, 3, BOOK.G).box(1, 1, 12, 17, 2, 3, BOOK.K); } },
  },
  rest: { lowerArmL: { x: -1.1 }, upperArmL: { z: 0.05, x: 0.15 } },
  face: {
    colors: { k: '#0c1a12', r: '#2a9060', q: '#60d090', R: '#0a4028', b: '#14281c', m: '#8a4a48', O: '#d8c890' },
    layers: { glasses: { z: 3.5, depth: 0.4, variants: { on: { y: 29, rows: ['.OO..OO.', 'O..OO..O', 'O..OO..O', 'O..OO..O', '.OO..OO.'] } } } },   // 圓眼鏡（細框，罩在眼睛外面）
  },
});

// ───── 莉莉絲（魔女姊姊）：哥德長裙、大魔女帽、洋紅長捲髮、手上的詛咒光球、手槍 ─────
const SIS = { ...SKIN, H: '#9a2a7a', h: '#701c58', L: '#c044a0', C: '#7a2a6a', c: '#561c4a', K: '#2a1030', X, Z: ['#ff40d0', 'e'], O: ['#d060ff', 'e'], o: ['#f0c0ff', 'e'] };
const b_sis = mcRig({
  id: 'b_sis-mc', name: '莉莉絲', pal: SIS,
  head: { ...headOf('long'), extra(v) { witchHat(v, SIS.K, SIS.Z, 3); } },
  body: { in: torsoOf({ front: ['ssssssss', 'CssssssC', 'CCssssCC', 'CCCssCCC', 'CCZCCZCC', 'CCCZZCCC', 'cCCCCCCc', 'cCCCCCCc', 'KKKZZKKK', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: 'sCCCCCccKCCC', side: 'sCCCCCccKCCC' }) },   // 露肩、胸口繫帶
  armUp: bands('ssCCCC'), armLo: bands('CCCCKs'),
  thigh: bands('XXXXXX'), shin: bands('XXXXXX'),
  ...gown('CCCCCCCCCCcK'),                                   // 長裙到腳踝
  gun: GUNS.pistol,
  parts: {
    ...longHair(SIS, { c: 'H', d: 'h', y1: 16, y2: 10, wave: true }),
    // 詛咒光球：浮在左手上
    orb: { parent: 'lowerArmL', pivot: [4.5, 10, 3], build(v) { v.box(4, 5, 12, 13, 3, 4, SIS.O[0], 'e').box(3, 6, 12, 13, 3, 4, SIS.O[0], 'e').box(4, 5, 11, 14, 3, 4, SIS.O[0], 'e').box(4, 5, 12, 13, 2, 5, SIS.O[0], 'e').dot(4, 13, 5, SIS.o[0], 'e'); } },
  },
  rest: { lowerArmL: { x: -1.3 }, upperArmL: { z: 0.2 } },
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'smile' } },
  face: { colors: { k: '#40103a', r: '#d030b0', q: '#ff60e0', R: '#600850', b: '#701c58', m: '#a02060' } },
});

// ───── 卡蜜拉（調香師）：薰衣草色禮服、淡紫盤髮插髮簪、左手的香水瓶、腳邊飄著霧、手槍 ─────
const PERF = { ...SKIN, H: '#d8c0e8', h: '#b49cc8', L: '#f0e0fa', C: '#6a4a8a', c: '#4c3268', V: '#9a7ac0', G: '#ffd070', K: '#2a1838', X, O: ['#e8c0ff', 'e'], M: ['#c8b0e0', 'g'] };
const b_perfume = mcRig({
  id: 'b_perfume-mc', name: '卡蜜拉', pal: PERF,
  head: { ...headOf('updo'), extra(v) { v.box(-2, 1, 32, 34, -4, -1, PERF.H).box(-1, 0, 35, 35, -3, -2, PERF.h).box(1, 4, 34, 34, -3, -3, PERF.K).dot(5, 35, -3, PERF.G); } },   // 頭頂的髮髻和髮簪
  body: { in: torsoOf({ front: ['ssssssss', 'sVssssVs', 'CVVssVVC', 'CCVVVVCC', 'CCCGGCCC', 'CCCCCCCC', 'cCCCCCCc', 'cCCCCCCc', 'VVVGGVVV', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: 'ssCCCCccVCCC', side: 'ssCCCCccVCCC' }) },
  armUp: bands('ssssVV'), armLo: bands('VVVVVs'),            // 長手套
  thigh: bands('XXXXXX'), shin: bands('XXXXXX'),
  ...gown('CCCCCCCCCVCV'),
  gun: GUNS.pistol,
  parts: {
    // 香水瓶：拿在左手
    bottle: { parent: 'lowerArmL', pivot: [4.5, 11, 0], build(v) { v.box(4, 5, 9, 11, 0, 1, PERF.O[0], 'e').box(4, 5, 8, 8, 0, 1, PERF.G).dot(4, 7, 0, PERF.G); } },
    // 腳邊的霧（半透明，慢慢晃）
    mist: {
      parent: 'hips', pivot: [-0.5, 6, -0.5],
      dangle: { k: 20, damp: 3, gain: 0.05, limit: 0.4 },
      build(v) { for (const [x, y, z] of [[6, 2, -3], [-9, 1, 2], [-6, 4, -6], [4, 0, 5], [-2, 2, 6]]) v.box(x, x + 2, y, y + 2, z, z + 2, PERF.M[0], 'g'); },
    },
  },
  rest: { lowerArmL: { x: -0.9 }, upperArmL: { z: 0.15 } },
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'smile' } },
  face: { colors: { k: '#4c3268', r: '#a060e0', q: '#e0a0ff', R: '#402070', b: '#b49cc8', m: '#a04a80' } },
});

// ───── 艾琳娜（獵犬）：皮夾克、像狼耳的亂髮、發光的紅項圈、長圍巾、霰彈槍 ─────
const HOUND = { ...SKIN, s: '#e8c4a4', d: '#c89c7c', H: '#5a4a3a', h: '#3e3226', L: '#7a6650', C: '#7a5a2a', c: '#58401c', K: '#1c1814', P: '#2a2018', B: '#1a1410', R: '#8a2a20', r: '#641c14', Z: ['#ff4040', 'e'], G: '#a0a0a0' };
const b_hound = mcRig({
  id: 'b_hound-mc', name: '艾琳娜', pal: HOUND,
  head: {
    ...headOf('bob'),
    extra(v) {      // 像狼耳一樣翹起來的兩撮頭髮
      for (const x of [-4, 2]) v.box(x, x + 1, 32, 33, -1, 0, HOUND.H).dot(x < 0 ? -4 : 3, 34, 0, HOUND.H).dot(x < 0 ? -3 : 2, 32, 1, HOUND.h);
      v.box(-5, -5, 26, 27, -3, -1, HOUND.h).box(4, 4, 26, 27, -3, -1, HOUND.h);
    },
  },
  body: {
    in: torsoOf({ front: ['ZZZZZZZZ', 'CCKKKKCC', 'CCKKKKCC', 'CGKKKKGC', 'CCKKKKCC', 'CCKKKKCC', 'CCKKKKCC', 'cCKKKKCc', 'KKKGGKKK', 'PPPPPPPP', 'PPPPPPPP', 'PPPPPPPP'], back: 'ZCCCCCCcKPPP', side: 'ZCCCCCCcKPPP' }),   // 最上面一圈是項圈
  },
  armUp: bands('CCCCCC'), armLo: bands('CCCCcs'),
  thigh: bands('PPPPPP'), shin: bands('BBBBBK'),             // 及膝長靴
  gun: GUNS.sg,
  parts: {
    // 長圍巾：從脖子往後飄（會甩）
    scarf: {
      parent: 'torso', pivot: [1.5, 22.5, -3.5],
      dangle: { k: 35, damp: 4, gain: 0.05, limit: 0.7 },
      build(v) { v.box(1, 2, 12, 22, -4, -4, HOUND.R).box(1, 1, 12, 22, -4, -4, HOUND.r).box(2, 2, 10, 11, -4, -4, HOUND.R); },
    },
  },
  rest: { scarf: { x: 0.25 } },
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'grin' } },
  face: { colors: { k: '#2a2018', r: '#d09010', q: '#ffc040', R: '#704000', b: '#3e3226', m: '#7a3028' } },
});

// ───── 桃樂絲（人偶師）：洛可可洋裝、金色雙捲髮、發光的大蝴蝶結、左手提線的十字木架、手槍 ─────
const PUP = { ...SKIN, H: '#f0d080', h: '#d0ac58', L: '#fce8a8', C: '#a04060', c: '#7a2c48', W: '#f2ead8', w: '#d8ccb4', B: '#3a2030', K: '#6a4a2a', Z: ['#ffc0d0', 'e'], z: ['#ff6090', 'e'], I: ['#ffffff', 'e'] };
const PRUF = 'CcCcCcCc';
const b_puppet = mcRig({
  id: 'b_puppet-mc', name: '桃樂絲', pal: PUP,
  head: { ...headOf('updo'), extra(v) { v.box(-3, -1, 32, 33, 0, 1, PUP.Z[0], 'e').box(0, 2, 32, 33, 0, 1, PUP.Z[0], 'e').box(-1, 0, 32, 32, 0, 1, PUP.z[0], 'e').dot(-3, 34, 0, PUP.Z[0], 'e').dot(2, 34, 0, PUP.Z[0], 'e'); } },   // 頭頂的大蝴蝶結
  body: {
    in: torsoOf({ front: ['WWWssWWW', 'CWWWWWWC', 'CCWzzWCC', 'CCWWWWCC', 'CCCWWCCC', 'CCCWWCCC', 'cCCWWCCc', 'cCCCCCCc', 'WWWWWWWW', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: 'WCCCCCccWCCC' }),
    out: { front: [...rows(9, '........'), PRUF, PRUF, PRUF], back: [...rows(9, '........'), PRUF, PRUF, PRUF], side: [...rows(9, '....'), 'CcCc', 'CcCc', 'CcCc'] },
  },
  skirt: { rows: 4, faces: { front: [PRUF, PRUF, PRUF, 'WWWWWWWW'], back: [PRUF, PRUF, PRUF, 'WWWWWWWW'], side: ['CcCc', 'CcCc', 'CcCc', 'WWWW'] } },
  armUp: bands('CCCCWW'), armLo: bands('ssssWs'),            // 泡泡袖、蕾絲袖口
  thigh: bands('WWWWWW'), shin: bands('WWWWBB'),             // 米白長襪
  gun: GUNS.pistol,
  parts: {
    // 雙捲髮：兩側各一條螺旋（會甩）
    drillL: {
      parent: 'head', pivot: [5, 27.5, -1],
      dangle: { k: 60, damp: 6, gain: 0.03, limit: 0.4 },
      build(v) { for (let i = 0; i < 5; i++) v.box(5 - (i % 2), 6 - (i % 2), 26 - i * 2, 27 - i * 2, -2, -1, i % 2 ? PUP.h : PUP.H); v.dot(5, 16, -1, PUP.h); },
    },
    drillR: { mirror: 'drillL' },
    // 提線的十字木架：拿在左手，垂下三條發光的線
    cross: {
      parent: 'lowerArmL', pivot: [4.5, 11, 2],
      build(v) { v.box(2, 7, 11, 11, 2, 2, PUP.K).box(4, 5, 11, 11, 0, 4, PUP.K); for (const x of [2, 4, 7]) v.box(x, x, 4, 10, 2, 2, PUP.I[0], 'e'); },
    },
  },
  rest: { lowerArmL: { x: -1.57 }, upperArmL: { z: 0.2, x: -0.3 } },
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'smile' } },
  face: { colors: { k: '#7a5020', r: '#e04070', q: '#ff80a0', R: '#801030', b: '#d0ac58', m: '#b04a60' } },
});

// ───── 瑪格麗特（教母）：拖到地上的黑色毛皮大衣、毛領、大魔女帽＋面紗、灰髮、長步槍 ─────
const MOM = { ...SKIN, s: '#e8d4cc', d: '#c8b0a8', H: '#a8a0a8', h: '#888088', L: '#c8c0c8', C: '#1e1428', c: '#120c18', F: '#3a3438', f: '#4c444a', K: '#120c18', X, Z: ['#c040ff', 'e'], V: ['#201828', 'g'], G: '#c8a850' };
const b_mother = mcRig({
  id: 'b_mother-mc', name: '瑪格麗特', pal: MOM, scale: 1.08,
  head: {
    ...headOf('updo'),
    extra(v) {
      witchHat(v, MOM.K, MOM.Z, 4);
      v.box(-5, 4, 28, 31, 5, 5, MOM.V[0], 'g').box(-5, -5, 28, 31, 0, 4, MOM.V[0], 'g').box(4, 4, 28, 31, 0, 4, MOM.V[0], 'g');   // 面紗：蓋住上半張臉
    },
  },
  body: {
    in: torsoOf({ front: ['FFFFFFFF', 'CCfFFfCC', 'CCCffCCC', 'CGCCCCGC', 'CCCCCCCC', 'CGCCCCGC', 'CCCCCCCC', 'cCCCCCCc', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC', 'CCCCCCCC'], back: 'FCCCCCCcCCCC', side: 'FCCCCCCcCCCC' }),
    out: { front: ['FfFFFFfF', '.FfFFfF.'], back: ['FFfFFfFF', '.FFFFFF.'], side: ['FfFF', 'FFfF'], top: ['FFFFFFFF', 'F......F', 'F......F', 'FFFFFFFF'] },   // 毛領
  },
  armUp: bands('FCCCCC'), armLo: bands('CCCCFX'),            // 毛袖口、黑手套
  thigh: bands('XXXXXX'), shin: bands('XXXXXX'),
  ...gown('CCCCCCCCCCCF'),                                   // 大衣拖到地，下襬一圈毛
  gun: { ...GUNS.sn, thick: 2 },
  expressions: { normal: { eyes: 'angry', brows: 'none', mouth: 'rest' } },
  face: { colors: { k: '#3a2a40', r: '#a060e0', q: '#d0a0ff', R: '#401860', b: '#888088', m: '#7a2040' } },
});

export const WITCHES = { b_eye, b_exec, b_book, b_sis, b_perfume, b_hound, b_puppet, b_mother };
