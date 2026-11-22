// 敵人的方塊人皮膚（黑手黨手下＋人偶＋稻草人）。沒有參考圖，照遊戲裡現在的造型（src/units.js 的 goonBody）和
// config.js 的顏色設計。骨架和臉的預設貼圖在 mc-base.js。
// 手下共用 goon() 這個樣板：西裝、襯衫領帶、發光的黃眼睛；每一種只寫跟樣板不一樣的地方。
import { mcRig, rows, bands, headOf, torsoOf, gown, fedora, plane, GUNS } from './mc-base.js';

const hex = n => '#' + n.toString(16).padStart(6, '0');
const dark = (n, k = 0.7) => hex(((n >> 16 & 255) * k) << 16 | ((n >> 8 & 255) * k) << 8 | ((n & 255) * k) | 0);

// 手下的臉：睫毛深、眼睛整顆發黃光
const GOON_FACE = { k: '#1a1210', w: ['#fff0a0', 'e'], r: ['#ffd34d', 'e'], q: ['#ffd34d', 'e'], R: ['#ffb000', 'e'], b: '#2a2018', m: '#6a3a30', p: '#d08070' };

// o：{ id, name, color（西裝，config.js 的顏色）, tie, hair, hat(v, pal), arms: 'suit'|'rolled'|'bare', coat, gun, scale, … }
function goon(o) {
  const pal = {
    s: '#c9a58a', d: '#a88468',
    H: '#2a2420', h: '#1a1614', L: '#3a322c',       // 頭髮
    S: hex(o.color), D: dark(o.color),              // 西裝、陰影
    W: '#e8e4dc', T: o.tie || '#30303a',            // 襯衫、領帶
    P: '#1e2026', B: '#15161a', b: '#0a0a0c',       // 褲子、鞋、鞋底
    K: '#1a1a20',                                   // 帽子
    Y: ['#ffd34d', 'e'],                            // 發光的地方
    ...o.pal,
  };
  const front = o.front || ['SSWWWWSS', 'SSWTTWSS', 'SSSTTSSS', 'SSSTTSSS', 'SSSTTSSS', 'SSSDDSSS', 'SSSSSSSS', 'DSSSSSSD', 'SSSSSSSS', 'DDDDDDDD', 'PPPPPPPP', 'PPPPPPPP'];
  const arms = { suit: ['SSSSSS', 'SSSSWs'], rolled: ['SSSSSD', 'sssssd'], bare: ['ssssss', 'sssssd'] }[o.arms || 'suit'];
  const head = headOf(o.hair || 'short');
  return mcRig({
    id: o.id + '-mc', name: o.name, pal, scale: o.scale,
    head: { ...head, extra: o.hat && (v => o.hat(v, pal)) },
    body: { in: torsoOf({ front, back: o.back || 'SSSSSSSDSDPP' }), extra: o.bodyExtra && (v => o.bodyExtra(v, pal)) },
    armUp: bands(arms[0]), armLo: bands(arms[1]),
    thigh: bands('PPPPPP'), shin: bands('PPPPBb'),
    ...(o.coat ? gown('SSSSSSSSD...', 1) : {}),     // 長大衣：下襬到小腿，前面敞開
    gun: o.gun,
    parts: o.parts,
    rest: o.rest, clips: o.clips, expressions: o.expressions,
    face: { colors: { ...GOON_FACE, ...o.faceColors }, layers: o.faceLayers },
    ...o.over,
  });
}

// ───── 黑手黨手下 ─────
const gunman = goon({      // 槍手：紅西裝、紳士帽、衝鋒槍
  id: 'gunman', name: '槍手', color: 0xc0453a,
  hat: (v, p) => fedora(v, p.K, p.S),
  gun: GUNS.tommy,
});
const zealot = goon({      // 狂徒：橘色、捲袖、發光的頭巾（後面拖一條）、霰彈槍
  id: 'zealot', name: '狂徒', color: 0xd8752a, arms: 'rolled',
  pal: { O: ['#ff7a2a', 'e'] },
  front: ['SSssssSS', 'SSWssWSS', 'SSSWWSSS', 'SSSSSSSS', 'SSSSSSSS', 'SSSDDSSS', 'SSSSSSSS', 'DSSSSSSD', 'SSSSSSSS', 'DDDDDDDD', 'PPPPPPPP', 'PPPPPPPP'],   // 領口敞開、沒打領帶
  hat: (v, p) => { v.box(-5, 4, 30, 30, -5, 4, p.O[0], 'e'); },
  parts: {
    band: {
      parent: 'head', pivot: [1.5, 30, -5.5],
      dangle: { k: 40, damp: 5, gain: 0.04, limit: 0.6 },
      build(v) { v.box(1, 2, 24, 29, -6, -6, '#ff7a2a', 'e').box(1, 1, 22, 23, -6, -6, '#ff7a2a', 'e'); },
    },
  },
  rest: { band: { x: 0.15 } },
  expressions: { normal: { eyes: 'open', brows: 'angry', mouth: 'grit' } },
  gun: GUNS.sg,
});
const conscript = goon({   // 小弟：個子小、土色舊西裝、鴨舌帽、手槍，一臉害怕
  id: 'conscript', name: '小弟', color: 0x8a7a5a, scale: 0.9,
  pal: { K: '#6a5a40' },
  hat: (v, p) => { v.box(-4, 3, 32, 32, -4, 3, p.K).box(-3, 2, 33, 33, -3, 2, p.K).box(-3, 2, 32, 32, 4, 5, p.K); },
  expressions: { normal: { eyes: 'open', brows: 'sad', mouth: 'wavy' } },
  gun: GUNS.pistol,
});
const officer = goon({     // 幹部：金色長大衣、大盤帽（帽帶發光）、紅領帶、手槍
  id: 'officer', name: '幹部', color: 0xd0b040, tie: '#902020', coat: true,
  hat: (v, p) => {
    v.box(-5, 4, 33, 34, -5, 4, p.S).box(-4, 3, 32, 32, -4, 3, p.Y[0], 'e').box(-3, 2, 32, 32, 4, 6, p.K);
    v.box(-1, 0, 33, 33, 5, 5, p.Y[0], 'e');
  },
  gun: GUNS.pistol,
});
const sniper = goon({      // 狙擊手：灰藍長大衣、毛帽、發光的風鏡、狙擊槍
  id: 'sniper', name: '狙擊手', color: 0x5a6a8a, coat: true,
  hat: (v, p) => { v.box(-4, 3, 32, 33, -4, 3, p.S).box(-5, 4, 31, 31, -5, 4, p.D); },
  faceColors: { C: ['#9be7ff', 'e'], c: '#22303c' },
  faceLayers: { goggles: { z: 3.5, depth: 0.5, variants: { on: { y: 28, rows: ['cccccccc', 'cCCccCCc', 'cccccccc'] } } } },
  gun: GUNS.sn,
});
const brawler = goon({     // 打手：光頭、墨鏡、背心露出粗手臂、球棒（近戰）
  id: 'brawler', name: '打手', color: 0x6a4a3a, hair: 'bald', arms: 'bare',
  front: ['sSssssSs', 'sSSssSSs', 'SSSSSSSS', 'SSSSSSSS', 'SSSSSSSS', 'SSSDDSSS', 'SSSSSSSS', 'DSSSSSSD', 'SSSSSSSS', 'BBBYYBBB', 'PPPPPPPP', 'PPPPPPPP'],
  back: 'sSSSSSSDSBPP',
  faceColors: { c: '#101010' },
  faceLayers: { shades: { z: 3.5, depth: 0.5, variants: { on: { y: 28, rows: ['cccccccc', '.cc..cc.', '.cc..cc.'] } } } },
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'frown' } },
  gun: GUNS.bat,
});
const mg = goon({          // 機槍手：暗紅西裝、紳士帽、墊肩、斜背的子彈帶、輕機槍
  id: 'mg', name: '機槍手', color: 0x7a3434,
  pal: { A: '#8a6a30', a: '#c8a850' },
  front: ['SSWWWWSS', 'SSWTTWAa', 'SSSTTAaS', 'SSSTAaSS', 'SSSAaSSS', 'SSAaDSSS', 'SAaSSSSS', 'AaSSSSSD', 'SSSSSSSS', 'DDDDDDDD', 'PPPPPPPP', 'PPPPPPPP'],
  hat: (v, p) => fedora(v, p.K, p.S),
  over: { armUpOut: { left: ['SSS', 'DDD'], front: ['SS', 'DD'], back: ['SS', 'DD'], top: rows(3, 'SS') } },   // 墊肩
  gun: GUNS.lmg,
});

// 重裝兵：個子大，全身紫紅色的甲，方盔只有一條發光的目鏡縫（沒有表情），霰彈槍
const BRUTE = { S: '#8e2f6e', D: '#6a2052', N: '#5a1e48', Y: ['#ffd34d', 'e'], B: '#15161a', s: '#8e2f6e', d: '#6a2052' };
const VISOR = ['........', 'YYYYYYYY', '........'], NONE = ['........'];
const brute = mcRig({
  id: 'brute-mc', name: '重裝兵', pal: BRUTE, scale: 1.2,
  head: {
    in: { fill: 'S', front: ['SSSSSSSS', 'SSSSSSSS', 'DDDDDDDD', 'SSSSSSSS', 'DDDDDDDD', 'SSSSSSSS', 'SDSDDSDS', 'DDDDDDDD'], side: [...rows(7, 'SSSSSSSS'), 'DDDDDDDD'], back: [...rows(7, 'SSSSSSSS'), 'DDDDDDDD'], top: rows(8, 'SSSSSSSS'), bottom: rows(8, 'DDDDDDDD') },
    extra(v) { v.box(-1, 0, 32, 32, -3, 2, BRUTE.D); },          // 盔頂的脊
  },
  body: {
    in: torsoOf({ front: ['SSDDDDSS', 'SNNNNNNS', 'SNNNNNNS', 'SNNDDNNS', 'SNNNNNNS', 'SNNNNNNS', 'SSNNNNSS', 'DSSSSSSD', 'DDDDDDDD', 'SSSSSSSS', 'SSDSSDSS', 'SSSSSSSS'], back: 'SSSSSSSDDSSS' }),
    out: { front: ['........', '.NNNNNN.', '.NNNNNN.', '.NNDDNN.', '.NNNNNN.', '.NNNNNN.'], back: ['........', '.NNNNNN.', '.NNNNNN.', '.NNNNNN.', '.NNNNNN.'] },   // 胸甲、背甲
  },
  armUp: bands('SSSSSD'), armLo: bands('SSSDBB'),
  armUpOut: { left: ['SSS', 'SSS', 'DDD'], front: ['SS', 'SS', 'DD'], back: ['SS', 'SS', 'DD'], top: rows(3, 'SS') },   // 肩甲
  thigh: bands('SSSSSD'), shin: bands('SSSSBB'),
  gun: GUNS.sg,
  face: {
    colors: BRUTE,
    layers: {
      eyes: { variants: { open: VISOR, happy: VISOR, closed: VISOR, angry: VISOR, wide: VISOR, pain: ['........', 'Y.YYYY.Y', '........'], ko: ['........', '..Y..Y..', '........'] } },
      mouth: { variants: Object.fromEntries(['rest', 'smile', 'frown', 'small', 'big', 'i', 'u', 'grit', 'wavy', 'grin'].map(k => [k, NONE])) },
      brows: { variants: Object.fromEntries(['angry', 'up', 'sad'].map(k => [k, { y: 29, rows: ['.'] }])) },
      blush: { variants: { on: NONE } },
    },
  },
});

// ───── 人偶：魔女的瓷娃娃。個子大、瓷白的皮膚、米白洋裝、金色捲髮、軟帽、臉上有裂痕、背上的發條、雙管槍 ─────
const DOLL = {
  s: '#f2ead8', d: '#d8ccb4',
  H: '#d8c080', h: '#b89c58', L: '#ecd8a0',       // 頭髮
  E: '#d8c8b8', e: '#b8a694', W: '#f8f0e0',       // 洋裝、陰影、荷葉邊
  M: '#e8dcc8', m: '#c8b8a0',                     // 軟帽
  J: '#8a7a6a',                                   // 關節縫、裂痕
  B: '#5a3a20', b: '#3a2410',                     // 鞋
  Y: ['#ffd34d', 'e'],                            // 發條
};
const DPLEAT = 'EeEeEeEe';
const doll = mcRig({
  id: 'doll-mc', name: '人偶', pal: DOLL, scale: 1.25,
  head: {
    ...headOf('bob'),
    extra(v) {      // 軟帽：罩住頭頂，帽緣一圈荷葉邊
      v.box(-5, 4, 31, 32, -5, 3, DOLL.M).box(-4, 3, 33, 33, -4, 2, DOLL.M).box(-5, 4, 30, 30, 4, 4, DOLL.W).box(-5, 4, 31, 31, 4, 4, DOLL.m);
    },
  },
  body: {
    in: torsoOf({ front: ['EEWssWEE', 'EEWWWWEE', 'EEEWWEEE', 'EEEJJEEE', 'EEEEEEEE', 'EEEJJEEE', 'eEEEEEEe', 'eeeeeeee', 'WWWWWWWW', 'EEEEEEEE', 'EEEEEEEE', 'EEEEEEEE'], back: 'EEEEEEeeWEEE' }),
    out: { front: [...rows(9, '........'), DPLEAT, DPLEAT, DPLEAT], back: [...rows(9, '........'), DPLEAT, DPLEAT, DPLEAT], side: [...rows(9, '....'), 'EeEe', 'EeEe', 'EeEe'] },
  },
  skirt: { rows: 3, faces: { front: [DPLEAT, DPLEAT, 'WWWWWWWW'], back: [DPLEAT, DPLEAT, 'WWWWWWWW'], side: ['EeEe', 'EeEe', 'WWWW'] } },
  armUp: bands('EEEEWJ'), armLo: bands('sssssJ'),            // 手肘、手腕是關節縫
  thigh: bands('WWsssJ'), shin: bands('sssBBb'),             // 膝蓋是關節縫
  gun: GUNS.dbl,
  parts: {
    // 背上的發條（會慢慢抖）
    key: {
      parent: 'torso', pivot: [-0.5, 19, -3.5],
      build(v) { v.box(-1, 0, 18, 19, -5, -3, DOLL.Y[0], 'e'); plane(v, ['YY..YY', 'YYYYYY', 'YY..YY'], DOLL, { x0: -3, yTop: 20, z: -6 }); },
    },
  },
  // 沒有感情：平常眼睛睜得大大的、嘴巴不動
  expressions: { normal: { eyes: 'wide', brows: 'none', mouth: 'rest', crack: 'on' } },
  face: {
    colors: { k: '#5a4a3a', r: '#8090a0', q: '#a8b4c0', R: '#3a4450', b: '#b89c58', m: '#a06060', J: '#8a7a6a' },
    layers: { crack: { z: 3.5, depth: 0.25, variants: { on: { y: 29, rows: ['......J.', '.......J', '......J.', '.......J'] } } } },   // 臉上的裂痕
  },
});

// ───── 稻草人：不會動。麻布袋頭、縫出來的臉、破草帽、兩手平舉釘在木樁上，腳是一根木樁 ─────
const SCARE = {
  s: '#c8a860', d: '#a88840',                     // 麻布
  H: '#c8a860', h: '#a88840', L: '#d8bc78',
  T: '#e0c060', t: '#b89838',                     // 稻草
  C: '#6a4a8a', c: '#4a3068',                     // 破外套
  W: '#6a4a2a', w: '#4a3018',                     // 木頭
  K: '#3a2a1a',                                   // 帽子、縫線
};
const scarecrow = mcRig({
  id: 'scarecrow-mc', name: '稻草人', pal: SCARE, scale: 1.1,
  head: {
    in: { fill: 's', front: [...rows(7, 'ssssssss'), 'dTdTTdTd'], side: [...rows(7, 'ssssssss'), 'TdTdTdTd'], back: ['ssssssss', 'sssKssss', 'ssssKsss', 'sssKssss', 'ssssKsss', 'sssKssss', 'ssssssss', 'dTdTTdTd'], top: rows(8, 'ssssssss'), bottom: rows(8, 'TTTTTTTT') },
    extra(v) {      // 破草帽
      v.box(-7, 6, 32, 32, -7, 6, SCARE.K).box(-4, 3, 33, 35, -4, 3, SCARE.K).box(-3, 2, 36, 37, -3, 2, SCARE.K).box(-4, 3, 33, 33, -4, 3, SCARE.T);
      v.clear(5, 6, 32, 32, 4, 6).clear(-7, -6, 32, 32, -7, -6);
    },
  },
  body: { in: torsoOf({ front: ['CCTTTTCC', 'CCCTTCCC', 'CCCWWCCC', 'CcCWWCcC', 'CCCWWCCC', 'CCcWWcCC', 'CCCWWCCC', 'cCCWWCCc', 'KKKKKKKK', 'CCCWWCCC', 'cCcWWcCc', 'T.TWWT.T'.replaceAll('.', 'c')], back: 'CCCCCCCcKCCc' }) },
  armUp: bands('CCCCCc'), armLo: bands('CCcTTt'),            // 袖口露出稻草
  thigh: bands('WWWWWW'), shin: bands('WWWWWw'),
  // 兩手平舉、兩腳併成一根樁
  rest: { upperArmL: { z: 1.45 }, upperArmR: { z: -1.45 }, lowerArmL: { z: 0.05 }, lowerArmR: { z: -0.05 } },
  expressions: { normal: { eyes: 'ko', brows: 'none', mouth: 'grit' }, smile: { eyes: 'ko', brows: 'none', mouth: 'grin', blink: false }, angry: { eyes: 'ko', brows: 'angry', mouth: 'grit', blink: false } },
  face: { colors: { k: '#3a2a1a', m: '#3a2a1a', W: '#3a2a1a', t: '#3a2a1a', b: '#3a2a1a' } },
});

export const ENEMIES = { gunman, zealot, conscript, officer, brawler, sniper, mg, brute, doll, scarecrow };
