// 方塊人共用的底座：骨架、盒子尺寸、臉的預設貼圖、拿槍的方式都在這裡，每個角色只要給「皮膚」
//   頭 8×8×8、身體 8×12×4、手 2×12×3、腳 3×12×3（兩腿中間空兩格），腳底到頭頂 32 格
// 角色檔（akane-mc.js、hikari-mc.js…）長怎樣、每個欄位的意思：docs/voxel-rig.md「加新的方塊人」
import { skinBox } from '../voxel-rig.js';

export const rows = (n, row) => Array(n).fill(row);

// 一圈一圈的橫條皮膚（手腳最常用）：'WWssKW' = 由上到下每一列整圈同一個顏色
// over 可以再蓋掉某幾面，例如 { front: [...] }
export function bands(str, over = {}) {
  const ch = [...str];
  const g = n => ch.map(c => c.repeat(n));
  return { fill: ch[ch.length - 1], front: g(3), back: g(3), side: g(3), top: rows(3, ch[0].repeat(3)), bottom: rows(3, ch[ch.length - 1].repeat(3)), ...over };
}

// 一片直立的薄片（披風、翅膀）：rows 由上到下、由 x0 往 +x 畫，貼在 z 這一層
export function plane(v, rowsArr, pal, { x0, yTop, z, thick = 1 }) {
  rowsArr.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.' || ch === ' ') return;
    const col = pal[ch]; if (!col) throw new Error(`顏色 ${ch} 沒定義`);
    for (let k = 0; k < thick; k++) Array.isArray(col) ? v.dot(x0 + c, yTop - r, z - k, col[0], col[1]) : v.dot(x0 + c, yTop - r, z - k, col);
  }));
  return v;
}

// 長頭髮：頭後面垂下來的兩節簾子（會甩）。c 主色、d 深色（髮絲）、到 y2 那麼長、wave 尾端做成波浪
export function longHair(pal, { c, d, y1 = 16, y2 = 9, wave = false }) {
  return {
    hair1: {
      parent: 'head', pivot: [-0.5, 24, -4.5],
      dangle: { k: 70, damp: 8, gain: 0.02, grav: 500, limit: 0.3 },
      build(v) {
        v.box(-5, 4, y1, 23, -5, -4, pal[c]);
        for (const x of [-4, -1, 2]) v.box(x, x, y1, 23, -5, -5, pal[d]);
        v.box(-5, -5, y1, 23, -4, -4, pal[d]).box(4, 4, y1, 23, -4, -4, pal[d]);
      },
    },
    hair2: {
      parent: 'hair1', pivot: [-0.5, y1, -4.5],
      dangle: { k: 45, damp: 6, gain: 0.03, grav: 700, limit: 0.45 },
      build(v) {
        v.box(-5, 4, y2 + 2, y1 - 1, -5, -4, pal[c]).box(-4, 3, y2, y2 + 1, -5, -4, pal[c]);
        for (const x of [-4, -1, 2]) v.box(x, x, y2 + 1, y1 - 1, -5, -5, pal[d]);
        if (wave) { v.box(-6, -6, y2 + 2, y2 + 4, -5, -4, pal[c]).box(5, 5, y2 + 2, y2 + 4, -5, -4, pal[c]); for (const x of [-3, 0, 3]) v.box(x, x, y2 - 1, y2 - 1, -5, -4, pal[d]); }
        else v.box(-3, -2, y2 - 1, y2 - 1, -5, -4, pal[d]).box(1, 2, y2 - 1, y2 - 1, -5, -4, pal[d]);
      },
    },
  };
}

// ───── 臉的預設貼圖（表情和嘴形）。角色可以只換顏色，也可以換掉某一張 ─────
// 臉是貼在頭正面的薄片，8 格寬，分四層：eyes 眼睛、brows 眉毛、mouth 嘴巴、blush 臉紅
// 每一層有好幾張貼圖，一次只顯示一張；一個字元＝一格，'.' 是透明，顏色看 colors
//   y＝這張貼圖最上面一列在第幾格高（頭是 24–31）；左到右對應頭的 8 格（第 0 欄是角色的右臉）
//   眼睛：三列（睫毛、瞳孔上、瞳孔下），在第 1–2、5–6 欄；嘴巴：兩列，在第 2–5 欄
const FACE = () => ({
  part: 'head', x0: -4, z: 3.5,
  colors: {
    k: '#3a0a12', r: '#c01018', q: '#f04858', R: '#5a0008', w: '#ffffff',     // 睫毛、瞳孔、瞳孔亮、瞳孔深、反光
    b: '#5a0a12', m: '#8a2a30', t: '#e06070', W: '#ffffff', p: '#ff9aa6',     // 眉毛、嘴、舌頭、牙齒、臉紅
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
        grin:  ['.mWWWWm.', '..mmmm..'],
      },
    },
    blush: { y: 25, variants: { on: ['pp....pp'] } },
  },
});
const EXPRESSIONS = () => ({
  normal:    { eyes: 'open', brows: 'none', mouth: 'rest' },
  smile:     { eyes: 'happy', brows: 'none', mouth: 'smile', blush: 'on', blink: false },
  angry:     { eyes: 'angry', brows: 'angry', mouth: 'frown' },
  surprised: { eyes: 'wide', brows: 'up', mouth: 'u' },
  pain:      { eyes: 'pain', brows: 'sad', mouth: 'grit', blink: false },
  blink:     { eyes: 'closed', brows: 'none', mouth: 'rest', blink: false },
  ko:        { eyes: 'ko', brows: 'sad', mouth: 'wavy', blink: false },
});

// ───── 槍 ─────
// rows：槍的側面圖，槍口朝右、由上到下。握法：握把那一欄（gc）緊貼在手的前面，握把上面那一列（gr，機匣）
//   壓在前臂上緣，所以 gc 左邊的欄（槍托）會沿著前臂往手肘伸，右邊是槍管
//   gc＝握把在第幾欄、gr＝機匣（握把正上方）在第幾列、mr＝槍口在哪一列、thick＝幾格厚（1 薄片、2 跟手一樣寬、3 更粗）
//   hand＝'R'／'L'／'both'（雙槍）、carry＝平常前臂彎起來把槍端在腰邊（false 就垂著拿，槍口朝下）
//   per＝幾秒一發、melee＝近戰武器（沒有火光，動作是揮）、z0＝機匣離手心多高（預設 2＝壓在前臂上；球棒用 0）
//   pal＝槍自己的顏色（跟角色的調色盤合併）
// 槍是掛在前臂上的：手垂著時槍口朝下，前臂抬平時槍口朝前
const THICK = { 1: [5], 2: [4, 5], 3: [4, 5, 6], 4: [3, 4, 5, 6] };
function gunParts(G, pal0, P, hand) {
  const pal = { ...pal0, ...G.pal };
  const mx = x => hand === 'L' ? x : -x - 1;
  const xs = THICK[G.thick || 2].map(mx), xa = Math.min(...xs), xb = Math.max(...xs);
  const gc = G.gc ?? 0, gr = G.gr ?? 0, mr = G.mr ?? gr, z0 = G.z0 ?? 2, W = Math.max(...G.rows.map(r => r.length));
  const yM = 11 - (W - gc), zM = z0 + gr - mr;
  const F = '#ffe066', f = '#fffbe0';
  P['gun' + hand] = {
    parent: 'lowerArm' + hand, pivot: [mx(4.5), 12, 0],
    build(v) {
      G.rows.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === '.' || ch === ' ') return;
        const col = pal[ch]; if (!col) throw new Error(`槍的顏色 ${ch} 沒定義`);
        for (const x of xs) Array.isArray(col) ? v.dot(x, 11 - (c - gc), z0 + gr - r, col[0], col[1]) : v.dot(x, 11 - (c - gc), z0 + gr - r, col);
      }));
    },
  };
  if (G.melee) return;
  P['flash' + hand] = {
    parent: 'gun' + hand, pivot: [mx(4.5), yM + 1, zM], hidden: true,
    build(v) {
      v.box(xa, xb, yM - 1, yM, zM - 1, zM + 1, F, 'e').box(xa - 1, xb + 1, yM - 1, yM, zM, zM, F, 'e');
      v.box(xa, xb, yM - 1, yM, zM, zM, f, 'e').box(xa, xb, yM - 4, yM - 2, zM, zM, F, 'e');
    },
  };
}
// 現成的槍（敵人和魔女共用；少女的槍畫在她們自己的檔案裡）
const GP = { G: '#2a2c30', g: '#4a4c54', B: '#6a4428', A: '#b88a30' };
export const GUNS = {
  tommy:  { pal: GP, gc: 4, gr: 0, per: 0.12, rows: ['BBBGGGGGGggg', 'BB..G.GG....', '....G.GG....'] },
  lmg:    { pal: GP, gc: 4, gr: 1, mr: 1, per: 0.1, rows: ['.....gg..........', 'BBBGGGGGGGgggggg.', 'BB..GAAAA...g....', '....GAAA....g....'] },
  sg:     { pal: GP, gc: 4, gr: 0, per: 0.9, rows: ['BBBGGGGGGGGg', 'BB..G.BBB...'] },
  sn:     { pal: GP, gc: 4, gr: 1, mr: 1, per: 1.3, thick: 1, rows: ['.....gGGg.........', 'BBBGGGGGGGgggggggg', 'BB..G.............'] },
  pistol: { pal: GP, gc: 0, gr: 0, per: 0.4, thick: 1, carry: false, rows: ['GGGGg', 'G....'] },
  magnum: { pal: GP, gc: 0, gr: 0, per: 0.7, thick: 1, carry: false, rows: ['GGGGGGg', 'B.G....'] },
  dbl:    { pal: GP, gc: 3, gr: 1, mr: 0, per: 1.0, rows: ['BBGGGGGGGg', 'BBGGGGGGGg', 'B..G......'] },
  bat:    { pal: GP, gc: 0, gr: 0, z0: 0, thick: 1, melee: true, carry: false, per: 0.9, rows: ['BBBBBBBBBB'] },
};
// 單手槍的射擊動作：拿槍的手舉平，另一隻手伸過去扶；per＝幾秒一發
export function shootOne(hand = 'R', per = 0.3) {
  const s = hand === 'L' ? 1 : -1, other = hand === 'L' ? 'R' : 'L';
  return {
    loop: true, face: 'angry',
    fn(t, P) {
      const tt = t % per, k = Math.exp(-tt * Math.min(22, 6 / per));
      P('root').py -= 0.3; P('hips').y += 0.3 * s; P('torso').y += 0.1 * s;
      P('thighL').x -= 0.3; P('shinL').x += 0.15; P('thighR').x += 0.25; P('shinR').x += 0.35;
      const ua = P('upperArm' + hand), la = P('lowerArm' + hand);
      ua.x = -1.5 - 0.12 * k; ua.y = -0.42 * s; ua.z = 0.05 * s;
      la.x = -0.05 - 0.1 * k; la.z = 0;
      const ub = P('upperArm' + other), lb = P('lowerArm' + other);
      ub.x = -1.2 - 0.1 * k; ub.y = 0.75 * s; ub.z = -0.05 * s; lb.x = -0.35; lb.z = 0;
      P('gun' + hand).x = 0; P('gun' + hand).z = 0;
      P('flash' + hand).visible = tt < 0.06;
      P('torso').x -= 0.05 + 0.04 * k; P('head').x += 0.05; P('head').y -= 0.4 * s;
    },
  };
}
// 近戰武器的攻擊動作：舉起來往下揮
export function swing(hand = 'R', per = 0.9) {
  const s = hand === 'L' ? 1 : -1;
  const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  return {
    loop: true, face: 'angry',
    fn(t, P) {
      const p = (t % per) / per;
      const up = sm(p / 0.4), hit = sm((p - 0.4) / 0.12), back = sm((p - 0.7) / 0.3);
      const a = -2.7 * up + 2.0 * hit + 0.7 * back;
      P('upperArm' + hand).x = a; P('upperArm' + hand).z = 0.15 * s; P('lowerArm' + hand).x = -0.5 + 0.4 * hit - 0.4 * back;
      P('torso').x += 0.3 * (hit - back) - 0.12 * (up - hit); P('torso').y += 0.3 * s * (up - hit);
      P('root').py -= 0.3 * (hit - back); P('thighL').x -= 0.35 * (hit - back); P('thighR').x += 0.25 * (hit - back); P('shinR').x += 0.3 * (hit - back);
    },
  };
}

// ───── 現成的頭、身體、長裙、帽子 ─────
// 頭的樣板：H 頭髮、h 深、L 亮、s 皮膚、d 皮膚陰影（調色盤裡要有這五個字）
//   long 長髮（兩側垂到下巴）、bob 鮑伯頭、updo 盤髮／短髮、short 男生短髮（戴帽子用）、bald 光頭
const HAIR_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsHHHHHH'],
  back: rows(8, 'HHHHHHHH'), top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const SHORT_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'sssssHHH', 'ssssssss', 'dsssssss'],
  back: [...rows(5, 'HHHHHHHH'), 'sHHHHHHs', 'ssssssss', 'ssssssss'], top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const HEADS = {
  long: { in: HAIR_IN, out: {
    front: ['HHHHHHHH', 'HLHHHHLH', 'HHHhHHHH', 'Hh.Hh.hH', 'H......H', 'H......H', 'H......H', 'h......h'],
    side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.HHHHHHH', '.hHHHHHH', '..HHHHHH'],
    back:  ['HHHHHHHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH'],
    top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHLHHLHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'] } },
  bob: { in: HAIR_IN, out: {
    front: ['HHHHHHHH', 'HHLHHHHH', 'HHHHhHHH', 'HHh.HhHH', 'H......H', 'H......H', 'H......H', 'h......h'],
    side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.HHHHHHH', '.HHHHHHH', '.hHHHHHh'],
    back:  ['HHHHHHHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'HHHHHHHH', 'hHhHHhHh'],
    top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHLLHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'] } },
  updo: { in: HAIR_IN, out: {
    front: ['HHHHHHHH', 'HLHHHHLH', 'HHhHHhHH', 'H.h..h.H', 'h......h', '........', '........', '........'],
    side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.hHHHHHH', '..hHHHHH', '....hHHh', '........'],
    back:  [...rows(6, 'HHHHHHHH'), 'hHHHHHHh', '.hHHHHh.'],
    top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHLLHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'] } },
  short: { in: SHORT_IN, out: null },
  bald: { in: { fill: 's', front: ['ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'], bottom: rows(8, 'ssssssss') }, out: null },
};
export const headOf = style => ({ in: { ...HEADS[style].in }, out: HEADS[style].out && { ...HEADS[style].out } });
// 身體的皮膚：front 一定要畫（12 列）；back／side 可以只給一串 12 個字（由上到下每一列一個顏色），不給就照 front 每列最左邊的顏色
export function torsoOf({ front, back, side, top, bottom }) {
  const g = (x, n) => typeof x === 'string' ? [...x].map(c => c.repeat(n)) : x;
  const sd = side ?? front.map(r => r[0]).join('');
  return {
    fill: front[5][0], front, back: g(back ?? sd, 8), side: g(sd, 4),
    top: top ?? ['........', '...ss...', '...ss...', '........'].map(r => r.replaceAll('.', front[0][0])),
    bottom: bottom ?? rows(4, front[11][0].repeat(8)),
  };
}
// 長裙／長大衣：畫在腿的外層，跟著腿一起擺（兩腿各半圈，合起來是完整的一圈）
//   str：由上到下每一列的顏色，12 個字（大腿 6 列＋小腿 6 列），'.' 不畫；open＝前面中間敞開幾格（一邊）
export function gown(str, open = 0) {
  const half = part => {
    const ch = [...str].slice(part * 6, part * 6 + 6);
    return { front: ch.map(c => '.'.repeat(open) + c.repeat(4 - open)), back: ch.map(c => c.repeat(4)), left: ch.map(c => c.repeat(3)) };
  };
  return { thighWide: half(0), shinWide: half(1) };
}
// 紳士帽：c 帽子顏色、band 帽帶顏色
export function fedora(v, c, band) {
  v.box(-5, 4, 32, 32, -5, 4, c).box(-3, 2, 33, 35, -3, 2, c).box(-3, 2, 33, 33, -3, 2, band);
}
// 魔女帽：c 帽子顏色、band 帽帶顏色（可以給 [顏色,'e'] 發光）、brim 帽緣比頭寬幾格
export function witchHat(v, c, band, brim = 3) {
  v.box(-4 - brim, 3 + brim, 32, 32, -4 - brim, 3 + brim, c);
  v.box(-4, 3, 33, 34, -4, 3, c).box(-3, 2, 35, 36, -3, 2, c).box(-2, 1, 37, 38, -3, 0, c).box(-1, 0, 39, 40, -4, -2, c).dot(0, 40, -5, c);
  Array.isArray(band) ? v.box(-4, 3, 33, 33, -4, 3, band[0], band[1]) : v.box(-4, 3, 33, 33, -4, 3, band);
}

// ───── 組一隻方塊人 ─────
// o = {
//   id, name, pal（字元 → 顏色；['#顏色','e'] 發光、['#顏色','g'] 半透明）, scale（個子，預設 1）
//   head: { in, out, extra(v) }      頭的內層、外層（頭髮）、另外加的方塊（髮飾、帽子）
//   body: { in, out, extra(v) }      身體的內層、外層（裙子上半、外套）
//   skirt: { rows, faces }           掛在骨盆上的一圈裙襬（外層、空心），rows 列高
//   armUp, armLo, thigh, shin        手腳的皮膚（通常用 bands('…')）；thighOut / shinOut / armUpOut / armLoOut 是外層
//   thighWide, shinWide              長裙／長大衣（用 gown('…') 產生），跟著腿擺
//   gun: { … }                       槍（見上面）
//   parts: { … }                     其他部位（馬尾、披風、翅膀…），直接併進去
//   rest, clips, expressions         站姿、動作、表情的覆寫
//   face: { colors, layers }         臉：換顏色、換或加貼圖（跟預設的合併）
// }
export function mcRig(o) {
  const pal = o.pal;
  const box = (v, b, inner, outer) => { if (inner) skinBox(v, b, inner, pal); if (outer) skinBox(v, b, outer, pal, true); };
  const P = {
    hips: { pivot: [-0.5, 12, -0.5], build() {} },                       // 只是關節
    thighL: { parent: 'hips', pivot: [2, 12, 0], build(v) { box(v, [1, 6, -1, 3, 6, 3], o.thigh, o.thighOut); if (o.thighWide) skinBox(v, [0, 6, -1, 4, 6, 3], o.thighWide, pal, true); } },
    shinL: { parent: 'thighL', pivot: [2, 6, 0], build(v) { box(v, [1, 0, -1, 3, 6, 3], o.shin, o.shinOut); if (o.shinWide) skinBox(v, [0, 0, -1, 4, 6, 3], o.shinWide, pal, true); } },
    thighR: { mirror: 'thighL' },
    shinR: { mirror: 'shinL' },
  };
  if (o.skirt) P.skirt = { parent: 'hips', pivot: [-0.5, 12, -0.5], build(v) { skinBox(v, [-4, 12 - o.skirt.rows, -2, 8, o.skirt.rows, 4], o.skirt.faces, pal, true); } };
  Object.assign(P, {
    torso: { parent: 'hips', pivot: [-0.5, 12, -0.5], build(v) { box(v, [-4, 12, -2, 8, 12, 4], o.body.in, o.body.out); o.body.extra?.(v); } },
    upperArmL: { parent: 'torso', pivot: [4.5, 22.5, 0], build(v) { box(v, [4, 18, -1, 2, 6, 3], o.armUp, o.armUpOut); } },
    lowerArmL: { parent: 'upperArmL', pivot: [4.5, 18, 0], build(v) { box(v, [4, 12, -1, 2, 6, 3], o.armLo, o.armLoOut); } },
    upperArmR: { mirror: 'upperArmL' },
    lowerArmR: { mirror: 'lowerArmL' },
    head: { parent: 'torso', pivot: [-0.5, 24, -0.5], build(v) { box(v, [-4, 24, -4, 8, 8, 8], o.head.in, o.head.out); o.head.extra?.(v); } },
  });
  const rest = { upperArmL: { z: 0.1 }, upperArmR: { z: -0.1 } };
  const clips = {};
  if (o.gun) {
    const hands = o.gun.hand === 'both' ? ['L', 'R'] : [o.gun.hand || 'R'];
    for (const hand of hands) {
      const s = hand === 'L' ? 1 : -1;
      gunParts(o.gun, pal, P, hand);
      if (o.gun.carry !== false) { rest['upperArm' + hand] = { z: 0.06 * s, x: 0.2 }; rest['lowerArm' + hand] = { x: -1.25 }; }
    }
    if (o.gun.melee) clips.shoot = swing(hands[0], o.gun.per);
    else if (hands.length === 1) clips.shoot = shootOne(hands[0], o.gun.per);      // 雙槍用共用的雙槍射擊動作
  }
  Object.assign(P, o.parts || {});

  const face = FACE();
  Object.assign(face.colors, o.face?.colors);
  for (const [name, L] of Object.entries(o.face?.layers || {})) {
    if (face.layers[name]) Object.assign(face.layers[name].variants, L.variants);
    else face.layers[name] = L;
  }
  return {
    id: o.id, name: o.name, unit: 32, evenX: true, scale: o.scale || 1,
    parts: P,
    rest: { ...rest, ...o.rest },
    clips: { ...clips, ...o.clips },
    face,
    expressions: { ...EXPRESSIONS(), ...o.expressions },
    visemes: { closed: 'rest', small: 'small', big: 'big', i: 'i', u: 'u' },
  };
}
