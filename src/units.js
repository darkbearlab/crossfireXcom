// 單位模型：low poly（平面著色、少面數）。正面朝 +Z，地面 y = 0，一格 = 1。
// 只求「味道對」：魔法少女是裙裝＋髮型＋招牌武器；黑手黨手下是西裝＋帽子；家族成員是魔女＋黑手黨。
import * as THREE from 'three';
import { rigDefFor, makeRigMesh } from './unit-rigs.js';
import { ENEMIES as RIG_ENEMIES } from './rigs/enemies-mc.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05, flatShading: true, ...o });
const GLOW = (color, emissive, k = 1.5) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: k, flatShading: true });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

function adder(g) {
  return (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
}

// ---------- 槍：沿 +Z，原點在握把，回傳槍長（槍口位置） ----------
function makeGun(type, parent, x, y, z) {
  // 每把槍自己的材質：倒下時會把整個模型調成半透明，共用材質會連別人的槍一起變透明
  const GUN_DARK = M(0x24272c), GUN_METAL = M(0x5a6068, { metalness: 0.5, roughness: 0.45 }), WOOD = M(0x6b4528);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  const add = adder(g);
  const barrel = (r, len, bx = 0, by = 0, bz = 0, mat = GUN_METAL) => add(cyl(r, r, len, 6), mat, bx, by, bz + len / 2, Math.PI / 2);
  let len;
  switch (type) {
    case 'pistol': case 'duals':
      add(box(0.05, 0.07, 0.17), GUN_DARK, 0, 0.02, 0.06); add(box(0.04, 0.09, 0.05), GUN_DARK, 0, -0.04, 0); len = 0.15; break;
    case 'magnum':
      add(box(0.05, 0.08, 0.12), GUN_DARK, 0, 0.02, 0.03); add(cyl(0.04, 0.04, 0.07, 6), GUN_METAL, 0, 0.02, 0.07, Math.PI / 2);
      barrel(0.022, 0.16, 0, 0.03, 0.1); add(box(0.04, 0.1, 0.05), WOOD, 0, -0.05, -0.01); len = 0.26; break;
    case 'sg':
      add(box(0.07, 0.08, 0.2), WOOD, 0, 0, -0.05); barrel(0.028, 0.32, -0.02, 0.03, 0.02); barrel(0.028, 0.32, 0.02, 0.03, 0.02); len = 0.34; break;
    case 'double': // 人偶的雙管槍
      add(box(0.08, 0.09, 0.26), WOOD, 0, -0.01, -0.1); barrel(0.032, 0.34, -0.025, 0.03, 0.02); barrel(0.032, 0.34, 0.025, 0.03, 0.02); len = 0.36; break;
    case 'tri': { // 小桃的三管霰彈槍：粗短
      add(box(0.12, 0.12, 0.16), M(0xd8a020), 0, 0, -0.02);
      for (const [bx, by] of [[-0.035, 0.04], [0.035, 0.04], [0, -0.02]]) barrel(0.034, 0.3, bx, by, 0.04, GUN_DARK);
      len = 0.34; break;
    }
    case 'sn':
      add(box(0.06, 0.08, 0.5), GUN_DARK, 0, 0, 0.1); add(box(0.05, 0.1, 0.18), WOOD, 0, -0.02, -0.2);
      add(cyl(0.025, 0.025, 0.18, 6), GUN_METAL, 0, 0.07, 0.12, Math.PI / 2); barrel(0.018, 0.3, 0, 0.01, 0.35); len = 0.65; break;
    case 'lmg':
      add(box(0.11, 0.12, 0.38), GUN_DARK, 0, 0, 0.08); add(box(0.1, 0.12, 0.12), GUN_METAL, -0.08, -0.05, 0.05);
      barrel(0.025, 0.28, 0, 0.02, 0.27); len = 0.55; break;
    case 'hmg': // 雪乃的重機槍：又長又粗，側面掛彈箱
      add(box(0.14, 0.15, 0.42), GUN_DARK, 0, 0, 0.08); add(box(0.12, 0.14, 0.16), M(0x3c4a30), -0.12, -0.02, 0.02);
      add(box(0.03, 0.08, 0.14), GUN_METAL, 0, 0.12, 0.05);
      barrel(0.04, 0.34, 0, 0.02, 0.29); add(cyl(0.055, 0.055, 0.08, 6), GUN_METAL, 0, 0.02, 0.6, Math.PI / 2); len = 0.66; break;
    case 'gl': // 楓的榴彈發射器：粗短的大口徑槍管＋轉輪彈倉
      add(box(0.09, 0.1, 0.22), WOOD, 0, -0.02, -0.08);
      add(cyl(0.075, 0.075, 0.12, 6), M(0xc06020), 0, 0.02, 0.06, Math.PI / 2);
      barrel(0.055, 0.26, 0, 0.03, 0.12, GUN_DARK); len = 0.38; break;
    case 'smg': // 詩織的衝鋒槍：短小、直彈匣
      add(box(0.06, 0.08, 0.24), M(0xe8e0d0), 0, 0, 0.04); add(box(0.04, 0.14, 0.05), GUN_DARK, 0, -0.1, 0.08);
      add(box(0.04, 0.09, 0.05), GUN_DARK, 0, -0.06, -0.04); barrel(0.016, 0.1, 0, 0.01, 0.16); len = 0.26; break;
    case 'bat': // 打手的木棍
      add(cyl(0.028, 0.045, 0.6, 6), WOOD, 0, 0.12, 0.1, 0.7, 0, 0); len = 0.1; break;
    case 'tommy': // 黑手黨的衝鋒槍（彈鼓）
      add(box(0.06, 0.08, 0.32), GUN_DARK, 0, 0, 0.06); add(cyl(0.07, 0.07, 0.05, 8), GUN_METAL, 0, -0.08, 0.06, 0, 0, Math.PI / 2);
      add(box(0.05, 0.08, 0.14), WOOD, 0, -0.01, -0.16); barrel(0.018, 0.12, 0, 0.01, 0.22); len = 0.36; break;
    default: // ar
      add(box(0.07, 0.1, 0.36), GUN_DARK, 0, 0, 0.08); add(box(0.05, 0.12, 0.06), GUN_DARK, 0, -0.09, 0.1);
      add(box(0.05, 0.08, 0.14), GUN_DARK, 0, -0.01, -0.16); barrel(0.018, 0.16, 0, 0.02, 0.26); len = 0.44;
  }
  return len;
}

// 魔女帽：帽簷＋歪一邊的尖頂＋發光帽帶
function witchHat(add, y, { color = 0x2a1838, band = 0xc040ff, brim = 0.32, h = 0.5, bend = 0.25 } = {}) {
  const hat = M(color);
  add(cyl(brim, brim, 0.03, 10), hat, 0, y, 0.02);
  add(cyl(0.16, 0.17, 0.06, 8), GLOW(band, band, 0.9), 0, y + 0.04, 0.02);
  add(cone(0.16, h, 6), hat, 0.02, y + 0.06 + h / 2, 0.0, -0.1, 0, bend);
}

// ---------- 女性身體（魔法少女、人偶、家族成員共用） ----------
// o: top 上衣, skirt 裙子（null＝褲裝）, skirtLen, flare, legs 腿/襪, boots, bootH, skin, hair, eyes
function femaleBody(add, o) {
  const top = M(o.top), legs = M(o.legs), boots = M(o.boots), skin = M(o.skin || 0xffe2cf), hair = M(o.hair);
  const eyes = GLOW(o.eyes || 0x302030, o.eyes || 0x000000, o.eyes ? 0.6 : 0);
  const bh = o.bootH || 0.14;
  for (const s of [-1, 1]) {
    add(box(0.11, bh, 0.16), boots, 0.075 * s, bh / 2, 0.015);
    add(box(0.085, 0.52 - bh, 0.09), legs, 0.075 * s, bh + (0.52 - bh) / 2, 0);
  }
  if (o.skirt != null) {
    const sl = o.skirtLen || 0.24;
    add(cyl(0.15, o.flare || 0.29, sl, 8), M(o.skirt), 0, 0.64 - sl / 2, 0);
  } else add(cyl(0.16, 0.17, 0.12, 6), top, 0, 0.6, 0); // 褲裝：上衣下襬
  const torso = add(cyl(0.15, 0.12, 0.3, 6), top, 0, 0.79, 0);
  torso.scale.z = 0.75;
  // 手臂往前端槍
  for (const s of [-1, 1]) add(box(0.07, 0.08, 0.26), top, 0.17 * s, 0.86, 0.08, 0, -0.15 * s);
  add(cyl(0.04, 0.05, 0.06, 6), skin, 0, 0.96, 0);
  add(ball(0.15, 1), skin, 0, 1.1, 0);
  const cap = add(ball(0.165, 1), hair, 0, 1.17, -0.045); // 往後放：臉要露出來
  cap.scale.set(1.04, 0.9, 0.97);
  add(box(0.26, 0.06, 0.07), hair, 0, 1.2, 0.115); // 瀏海
  for (const s of [-1, 1]) add(box(0.04, 0.05, 0.02), eyes, 0.055 * s, 1.09, 0.14);
  return { top, hair, skin, legs };
}

// 魔法少女
function girlParts(add, girl, color, hairColor) {
  const glowBow = GLOW(0x9be7ff, 0x4fd6ff, 1.4);
  if (girl === 'akane') {
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.2, flare: 0.27, legs: 0xffe2cf, boots: 0x8e1e1a, bootH: 0.24, hair: hairColor, eyes: 0xff5040 });
    // 刺刺的高馬尾
    add(cone(0.07, 0.36, 5), b.hair, 0, 1.3, -0.14, -0.9);
    add(cone(0.05, 0.28, 5), b.hair, 0.07, 1.22, -0.2, -1.3, 0, -0.4);
    add(cone(0.05, 0.28, 5), b.hair, -0.07, 1.22, -0.2, -1.3, 0, 0.4);
    for (const s of [-1, 1]) add(cone(0.05, 0.14, 4), b.hair, 0.12 * s, 1.24, 0.06, 0.3, 0, -0.9 * s); // 翹起的鬢角
    add(box(0.05, 0.3, 0.02), M(0xb02020), 0.09, 0.5, -0.18, 0.3, 0, 0.15);  // 腰帶飄帶
    add(box(0.05, 0.26, 0.02), M(0xb02020), -0.05, 0.52, -0.18, 0.4, 0, -0.1);
    add(box(0.1, 0.06, 0.04), glowBow, 0, 0.88, 0.1);
  } else if (girl === 'hikari') {
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.28, flare: 0.33, legs: 0xffffff, boots: 0xffffff, bootH: 0.34, hair: hairColor, eyes: 0xff70b0 });
    add(box(0.3, 0.62, 0.08), b.hair, 0, 0.84, -0.13);           // 長到腰下的長髮
    add(cone(0.15, 0.2, 5), b.hair, 0, 0.47, -0.13, Math.PI);
    for (const s of [-1, 1]) add(ball(0.045, 0), GLOW(0xffffff, 0xffc0e0, 0.8), 0.13 * s, 1.24, 0.02); // 髮飾花
    add(box(0.16, 0.07, 0.05), GLOW(0xffd0e8, 0xff80c0, 1.2), 0, 0.88, 0.1);  // 胸前大蝴蝶結
    add(cyl(0.3, 0.34, 0.08, 8), M(0xe8e0f0, { transparent: true, opacity: 0.6 }), 0, 0.36, 0); // 透明的外層裙擺
  } else if (girl === 'yukino') {
    const b = femaleBody(add, { top: color, skirt: 0xf0f4fa, skirtLen: 0.2, flare: 0.25, legs: 0x20283a, boots: 0xf0f4fa, bootH: 0.28, hair: hairColor, eyes: 0x5aa8ff });
    add(cyl(0.17, 0.27, 0.36, 6), M(color), 0, 0.5, -0.04).scale.z = 0.8; // 大衣下襬
    add(box(0.3, 0.68, 0.07), b.hair, 0, 0.82, -0.14);           // 長直髮
    add(cyl(0.13, 0.13, 0.08, 8), M(0x2c5ab0), 0, 0.95, 0);       // 圍巾
    add(box(0.07, 0.3, 0.03), M(0x2c5ab0), 0.08, 0.78, 0.12, 0.15);
    add(ball(0.03, 0), GLOW(0xffffff, 0x9be7ff, 1.2), -0.12, 1.24, 0.08); // 雪花髮夾
  } else if (girl === 'chinatsu') { // 千夏：墨綠斗篷、短鮑伯頭、單邊瞄準鏡片
    const b = femaleBody(add, { top: color, skirt: 0x2a3a34, skirtLen: 0.22, flare: 0.26, legs: 0x1a2420, boots: 0x3a2a20, bootH: 0.3, hair: hairColor, eyes: 0x60e0b0 });
    add(box(0.33, 0.2, 0.2), b.hair, 0, 1.07, -0.08);                   // 鮑伯頭
    for (const s of [-1, 1]) add(box(0.06, 0.18, 0.1), b.hair, 0.15 * s, 1.04, 0.04); // 兩側的髮
    add(cone(0.3, 0.46, 6), M(0x2a4a40), 0, 0.7, -0.08);                // 斗篷
    add(box(0.05, 0.05, 0.03), GLOW(0x9bffd8, 0x30c090, 1.6), -0.06, 1.1, 0.15); // 單邊鏡片
    add(box(0.14, 0.04, 0.03), M(0x203028), -0.02, 1.13, 0.14);
  } else if (girl === 'kaede') { // 楓：橘色短外套、工作褲、蓬鬆短髮、護目鏡、彈帶
    const b = femaleBody(add, { top: color, skirt: null, legs: 0x5a4a38, boots: 0x3a2a1a, bootH: 0.26, hair: hairColor, eyes: 0xffb040 });
    for (const s of [-1, 1]) add(cone(0.08, 0.2, 5), b.hair, 0.12 * s, 1.17, -0.06, -0.6, 0, -1.0 * s); // 亂翹
    add(box(0.3, 0.06, 0.06), M(0x2a2a2a), 0, 1.22, 0.06);              // 護目鏡帶
    for (const s of [-1, 1]) add(cyl(0.045, 0.045, 0.04, 8), GLOW(0xffe0a0, 0xc07020, 1), 0.07 * s, 1.23, 0.11, Math.PI / 2);
    add(box(0.07, 0.42, 0.04), M(0x8a6a30), 0, 0.8, 0.13, 0, 0, 0.6);   // 斜背的榴彈帶
    for (const y of [0.7, 0.8, 0.9]) add(cyl(0.025, 0.025, 0.06, 6), M(0xc06020), (y - 0.8) * 0.7, y, 0.16, Math.PI / 2);
  } else if (girl === 'shiori') { // 詩織：嫩綠洋裝、長捲髮、花冠、天使般的小翅膀
    const b = femaleBody(add, { top: color, skirt: 0xf4f8ec, skirtLen: 0.3, flare: 0.34, legs: 0xffffff, boots: 0xd8e8c8, bootH: 0.22, hair: hairColor, eyes: 0x70c070 });
    add(box(0.32, 0.5, 0.08), b.hair, 0, 0.9, -0.13);
    for (const s of [-1, 1]) add(cone(0.07, 0.32, 5), b.hair, 0.15 * s, 0.86, -0.05, Math.PI, 0, 0.15 * s);
    for (let i = 0; i < 5; i++) { const a = -1.2 + i * 0.6; add(ball(0.035, 0), GLOW(0xffffff, i % 2 ? 0xffc0e0 : 0xfff0a0, 0.7), Math.sin(a) * 0.16, 1.24, Math.cos(a) * 0.12 - 0.02); }
    for (const s of [-1, 1]) add(cone(0.08, 0.22, 3), GLOW(0xffffff, 0xd8ffd0, 0.5), 0.12 * s, 0.9, -0.17, 0.3, 0.4 * s, -1.1 * s);
    add(box(0.1, 0.06, 0.04), glowBow, 0, 0.88, 0.1);
  } else { // momo
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.18, flare: 0.28, legs: 0xffe2cf, boots: 0xf2c230, bootH: 0.2, hair: hairColor, eyes: 0xffa020 });
    for (const s of [-1, 1]) { // 過大的靴子
      add(box(0.15, 0.12, 0.22), M(0xe8b020), 0.08 * s, 0.06, 0.04);
      // 亂翹的雙馬尾
      add(cone(0.08, 0.34, 5), b.hair, 0.22 * s, 1.12, -0.04, 0, 0, 1.9 * s);
      add(cone(0.06, 0.24, 5), b.hair, 0.25 * s, 1.02, -0.06, 0.3, 0, 2.4 * s);
      add(ball(0.04, 0), GLOW(0xffe060, 0xffb000, 0.8), 0.15 * s, 1.2, -0.04);
    }
    add(box(0.1, 0.06, 0.04), glowBow, 0, 0.88, 0.1);
  }
}

// ---------- 黑手黨手下（西裝） ----------
function goonBody(add, kind, color) {
  const suit = M(color), pants = M(0x1e2026), shirt = M(0xe8e4dc), skin = M(0xc9a58a);
  const eye = GLOW(0xffd34d, 0xffb000, 1.6);
  const big = kind === 'brute';
  const w = big ? 0.56 : kind === 'mg' ? 0.48 : 0.42;
  for (const s of [-1, 1]) {
    add(box(0.15, 0.08, 0.22), M(0x15161a), 0.1 * s, 0.04, 0.03);
    add(box(big ? 0.18 : 0.14, 0.46, 0.16), big ? suit : pants, 0.1 * s, 0.31, 0);
  }
  const torso = add(box(w, 0.46, big ? 0.34 : 0.26), suit, 0, 0.78, 0);
  if (!big) { // 襯衫＋領帶
    add(box(0.12, 0.3, 0.02), shirt, 0, 0.86, 0.135);
    add(box(0.04, 0.22, 0.025), M(kind === 'officer' ? 0x902020 : 0x30303a), 0, 0.85, 0.15);
  }
  for (const s of [-1, 1]) add(box(0.1, 0.1, 0.3), suit, (w / 2 + 0.02) * s, 0.86, 0.08, 0, -0.12 * s); // 手臂往前
  let headY = 1.14;
  if (big) {
    // 重裝兵：方盔、目鏡縫、肩甲、胸甲
    add(box(0.32, 0.3, 0.32), suit, 0, 1.17, 0.02);
    add(box(0.24, 0.05, 0.03), eye, 0, 1.18, 0.19);
    for (const s of [-1, 1]) add(box(0.22, 0.14, 0.36), suit, 0.34 * s, 1.03, 0, 0, 0, 0.25 * s);
    add(box(0.4, 0.26, 0.05), M(0x5a1e48), 0, 0.84, 0.18);
    return { torso, headY: 1.17 };
  }
  add(ball(0.14, 1), skin, 0, headY, 0.02);
  for (const s of [-1, 1]) add(box(0.04, 0.035, 0.02), eye, 0.05 * s, headY + 0.01, 0.155);
  const hatM = M(0x1a1a20);
  if (kind === 'gunman' || kind === 'mg') { // 紳士帽
    add(cyl(0.22, 0.22, 0.025, 8), hatM, 0, headY + 0.1, 0.02);
    add(cyl(0.12, 0.14, 0.14, 6), hatM, 0, headY + 0.18, 0.02);
    add(cyl(0.142, 0.142, 0.03, 6), M(color), 0, headY + 0.13, 0.02);
  } else if (kind === 'officer') { // 大盤帽＋發光帽帶
    add(cyl(0.2, 0.15, 0.1, 8), M(color), 0, headY + 0.16, 0.0);
    add(cyl(0.152, 0.152, 0.04, 8), GLOW(0xffd34d, 0xffb000, 1.2), 0, headY + 0.11, 0);
    add(box(0.2, 0.02, 0.1), hatM, 0, headY + 0.1, 0.14);
    add(cyl(0.22, 0.26, 0.4, 6), M(color), 0, 0.45, -0.02).scale.z = 0.7; // 長大衣
  } else if (kind === 'conscript') { // 鴨舌扁帽
    add(cyl(0.15, 0.15, 0.06, 8), M(0x6a5a40), 0, headY + 0.11, 0);
    add(box(0.16, 0.02, 0.08), M(0x6a5a40), 0, headY + 0.09, 0.13);
  } else if (kind === 'sniper') { // 風鏡＋長大衣
    add(box(0.26, 0.05, 0.05), GLOW(0x9be7ff, 0x3080c0, 1.2), 0, headY + 0.02, 0.14);
    add(cyl(0.16, 0.16, 0.08, 8), M(color), 0, headY + 0.1, 0);
    add(cyl(0.22, 0.26, 0.42, 6), M(color), 0, 0.44, -0.02).scale.z = 0.7;
  } else if (kind === 'brawler') { // 打手：光頭、墨鏡、背心
    add(box(0.24, 0.04, 0.04), M(0x101010), 0, headY + 0.02, 0.13);
    for (const s of [-1, 1]) add(box(0.1, 0.1, 0.12), M(color), 0.27 * s, 0.95, 0); // 粗手臂
  } else if (kind === 'zealot') { // 頭巾、捲袖
    add(cyl(0.15, 0.15, 0.05, 8), GLOW(0xff7a2a, 0xc04000, 0.9), 0, headY + 0.05, 0.0);
    add(box(0.04, 0.2, 0.02), GLOW(0xff7a2a, 0xc04000, 0.9), 0.04, headY - 0.05, -0.15, 0.3);
  }
  if (kind === 'mg') { // 肩墊＋子彈帶
    for (const s of [-1, 1]) add(box(0.18, 0.12, 0.3), suit, 0.3 * s, 1.0, 0);
    add(box(0.06, 0.5, 0.29), M(0x8a6a30), 0, 0.82, 0, 0, 0, 0.7);
  }
  return { torso, headY };
}

// 家族成員（魔女黑手黨）
function bossParts(add, kind, color) {
  const black = 0x15121a;
  if (kind === 'b_eye') { // 薇歐拉：紫色長大衣、羽毛紳士帽、單眼鏡、背上狙擊槍
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.42, flare: 0.3, legs: black, boots: black, bootH: 0.2, hair: 0x2a2050, eyes: 0xc080ff });
    add(cone(0.06, 0.4, 5), b.hair, 0, 1.0, -0.17, -0.3);
    add(cyl(0.3, 0.3, 0.03, 10), M(color), 0, 1.27, 0.02);
    add(cyl(0.14, 0.16, 0.16, 6), M(color), 0, 1.36, 0.02);
    add(cone(0.03, 0.3, 4), GLOW(0xc080ff, 0x8040c0, 1), 0.15, 1.45, -0.05, -0.5, 0, -0.5);
    add(new THREE.TorusGeometry(0.035, 0.008, 4, 8), GLOW(0xffe090, 0xffb000, 1.6), 0.055, 1.09, 0.15);
    add(box(0.05, 0.06, 0.7), M(0x24272c), -0.1, 0.85, -0.17, 0.9, 0, 0.5);
    return 'sn';
  }
  if (kind === 'b_exec') { // 蕾貝卡：酒紅色褲裝、黑短髮、小紳士帽
    const b = femaleBody(add, { top: color, skirt: null, legs: color, boots: black, bootH: 0.16, hair: 0x101014, eyes: 0xff4060 });
    add(box(0.3, 0.16, 0.24), b.hair, 0, 1.06, -0.02);
    add(cyl(0.22, 0.22, 0.025, 8), M(black), 0, 1.25, 0.02, -0.15);
    add(cyl(0.12, 0.14, 0.12, 6), M(black), 0, 1.32, 0.0, -0.15);
    add(box(0.07, 0.12, 0.05), M(0x24272c), -0.15, 0.75, 0.09); // 肩掛槍套
    add(box(0.02, 0.06, 0.01), GLOW(0xff8080, 0x802020, 0.5), -0.07, 1.13, 0.14); // 疤
    return 'magnum';
  }
  if (kind === 'b_book') { // 莫妮卡：綠背心白襯衫、圓眼鏡、帳本
    const b = femaleBody(add, { top: color, skirt: null, legs: color, boots: black, bootH: 0.16, hair: 0x14281c, eyes: 0x60d090 });
    add(ball(0.08, 0), b.hair, 0, 1.2, -0.15);
    for (const s of [-1, 1]) {
      add(box(0.075, 0.085, 0.27), M(0xece8e0), 0.17 * s, 0.86, 0.08, 0, -0.15 * s); // 白襯衫袖子
      add(new THREE.TorusGeometry(0.035, 0.008, 4, 8), GLOW(0xe0ffe0, 0x40a060, 1.2), 0.055 * s, 1.09, 0.155);
    }
    const book = add(box(0.18, 0.24, 0.05), M(0x2a3a2a), -0.22, 0.75, 0.16, 0, 0.4, 0.1);
    add(box(0.12, 0.03, 0.055), GLOW(0xffd070, 0xa07000, 0.8), 0, 0.06, 0, 0, 0, 0, book);
    return 'pistol';
  }
  if (kind === 'b_sis') { // 莉莉絲：哥德長裙、大魔女帽、長捲髮、詛咒光球
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.5, flare: 0.36, legs: black, boots: black, bootH: 0.16, hair: 0x9a2a7a, eyes: 0xff60e0 });
    add(box(0.34, 0.6, 0.08), b.hair, 0, 0.88, -0.13);
    for (const s of [-1, 1]) add(cone(0.06, 0.3, 5), b.hair, 0.16 * s, 0.85, -0.06, Math.PI, 0, 0.2 * s);
    witchHat(add, 1.27, { color: 0x2a1030, band: 0xff40d0, brim: 0.36, h: 0.56, bend: 0.4 });
    add(ball(0.07, 0), GLOW(0xd060ff, 0xa020ff, 2.2), -0.22, 0.95, 0.22);
    return 'pistol';
  }
  if (kind === 'b_perfume') { // 卡蜜拉：薰衣草色禮服、盤髮、香水瓶、身邊飄著霧
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.46, flare: 0.34, legs: black, boots: black, bootH: 0.16, hair: 0xd8c0e8, eyes: 0xe0a0ff });
    add(ball(0.1, 0), b.hair, 0, 1.28, -0.08);
    add(cyl(0.025, 0.025, 0.16, 6), M(0x2a1838), 0, 1.36, -0.08, 0.3, 0, 0.6); // 髮簪
    add(ball(0.06, 0), GLOW(0xe8c0ff, 0xa060e0, 1.4), -0.22, 0.82, 0.18);       // 香水瓶
    add(cyl(0.015, 0.015, 0.05, 6), M(0xffd070), -0.22, 0.9, 0.18);
    for (const [x, y, z] of [[0.25, 0.4, -0.1], [-0.2, 0.3, -0.18], [0.1, 0.25, 0.25]]) add(ball(0.12, 0), M(0xc8b0e0, { transparent: true, opacity: 0.35 }), x, y, z);
    return 'pistol';
  }
  if (kind === 'b_hound') { // 艾琳娜：皮夾克、狼耳般的亂髮、項圈、長圍巾
    const b = femaleBody(add, { top: color, skirt: null, legs: 0x2a2018, boots: 0x1a1410, bootH: 0.3, hair: 0x5a4a3a, eyes: 0xffc040 });
    for (const s of [-1, 1]) add(cone(0.06, 0.18, 4), b.hair, 0.1 * s, 1.3, -0.02, 0, 0, -0.2 * s); // 像狼耳的頭髮
    add(box(0.3, 0.4, 0.1), b.hair, 0, 0.96, -0.12);
    add(cyl(0.1, 0.1, 0.04, 8), GLOW(0xff4040, 0x801010, 0.8), 0, 0.98, 0);      // 項圈
    add(box(0.06, 0.5, 0.02), M(0x8a2a20), 0.1, 0.78, -0.16, 0.4, 0, 0.2);      // 飄起的圍巾
    return 'sg';
  }
  if (kind === 'b_puppet') { // 桃樂絲：洛可可洋裝、雙捲髮、手上垂著提線的十字木架
    const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.44, flare: 0.4, legs: 0xf2ead8, boots: 0x3a2030, bootH: 0.16, hair: 0xf0d080, eyes: 0xff80a0 });
    for (const s of [-1, 1]) { add(cyl(0.06, 0.06, 0.34, 6), b.hair, 0.17 * s, 0.92, -0.04); add(ball(0.06, 0), b.hair, 0.17 * s, 0.74, -0.04); }
    add(box(0.16, 0.1, 0.06), GLOW(0xffc0d0, 0xff6090, 1), 0, 1.24, 0.04);      // 大蝴蝶結
    const cross = add(box(0.3, 0.03, 0.03), M(0x6a4a2a), -0.2, 1.25, 0.2);
    add(box(0.03, 0.03, 0.22), M(0x6a4a2a), 0, 0, 0, 0, 0, 0, cross);
    for (const x of [-0.12, 0, 0.12]) add(cyl(0.003, 0.003, 0.5, 3), GLOW(0xffffff, 0xffe0f0, 1), x, -0.25, 0, 0, 0, 0, cross);
    return 'pistol';
  }
  // 瑪格麗特：黑色毛皮大衣到地、毛領、大魔女帽＋面紗、長步槍
  const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.6, flare: 0.4, legs: black, boots: black, bootH: 0.16, hair: 0xa8a0a8, eyes: 0xd0a0ff });
  add(new THREE.TorusGeometry(0.17, 0.07, 5, 8), M(0x3a3438, { roughness: 1 }), 0, 0.94, 0, Math.PI / 2);
  for (const s of [-1, 1]) add(ball(0.08, 0), b.hair, 0.15 * s, 1.03, -0.02);
  witchHat(add, 1.27, { color: 0x120c18, band: 0xc040ff, brim: 0.42, h: 0.72, bend: 0.2 });
  add(cyl(0.2, 0.2, 0.2, 8, 1), M(0x201828, { transparent: true, opacity: 0.45 }), 0, 1.15, 0.02); // 面紗
  return 'sn';
}

// 人偶：瓷娃娃。米白洋裝、金色捲髮、軟帽、關節球、背上的發條，雙管槍
function dollParts(add, color) {
  const porcelain = 0xf2ead8;
  const b = femaleBody(add, { top: color, skirt: color, skirtLen: 0.3, flare: 0.33, legs: porcelain, boots: 0x5a3a20, bootH: 0.12, skin: porcelain, hair: 0xd8c080, eyes: 0x8090a0 });
  for (const s of [-1, 1]) {
    add(ball(0.05, 0), M(porcelain), 0.075 * s, 0.22, 0.02);             // 膝關節
    add(box(0.08, 0.36, 0.08), b.hair, 0.15 * s, 0.98, -0.06);            // 垂下的捲髮
    add(ball(0.05, 0), b.hair, 0.15 * s, 0.8, -0.06);
  }
  add(ball(0.2, 1), M(0xe8dcc8), 0, 1.17, -0.06).scale.set(1, 0.7, 0.9);  // 軟帽
  add(new THREE.TorusGeometry(0.19, 0.03, 4, 10), M(0xf8f0e0), 0, 1.12, 0.0, Math.PI / 2 - 0.3); // 帽緣荷葉邊
  add(box(0.012, 0.08, 0.01), M(0x8a7a6a), 0.07, 1.06, 0.145, 0, 0, 0.4); // 臉上的裂痕
  const gold = GLOW(0xffd34d, 0xffb000, 1.4);
  add(cyl(0.03, 0.03, 0.22, 6), gold, 0, 0.82, -0.2, Math.PI / 2);        // 發條
  add(box(0.32, 0.09, 0.04), gold, 0, 0.82, -0.32);
}

// gun: 'ar' | 'sg' | 'sn' | 'lmg' | 'pistol' | 'duals' | 'hmg' | 'tri' | 'magnum' | 'gl' | 'smg'（只影響外觀）
// opt: { hair, girl, boss, mother }
export function makeUnitMesh(team, kind, color, gun = 'ar', scale = 1, opt = {}) {
  // 有方塊人的單位用方塊人（src/unit-rigs.js）；沒有的、或網址加了 ?lowpoly，才用下面的舊模型
  const rigDef = rigDefFor(team, kind, gun, opt);
  if (rigDef) return makeRigMesh(rigDef, scale);
  const g = new THREE.Group();
  const add = adder(g);
  let gx = 0.2, gy = 0.84, gz = 0.12;

  if (kind === 'girl') {
    girlParts(add, opt.girl, color, opt.hair || 0x553322);
    if (opt.girl === 'momo') scale *= 0.88; // 個子小
    if (gun === 'hmg') { gx = 0.22; gy = 0.72; gz = 0.0; }
  } else if (opt.boss) {
    gun = bossParts(add, kind, color);
  } else if (kind === 'doll') {
    dollParts(add, color);
    gun = 'double';
  } else if (team === 'enemy') {
    const { headY } = goonBody(add, kind, color);
    gx = kind === 'brute' ? 0.3 : kind === 'mg' ? 0.26 : 0.23;
    gy = 0.88;
    gun = { sniper: 'sn', mg: 'lmg', zealot: 'sg', conscript: 'pistol', officer: 'pistol', brute: 'sg', brawler: 'bat' }[kind] || 'tommy';
    void headY;
  } else { // 備用：沒有專屬外型的我方單位
    goonBody(add, 'gunman', color);
  }

  const len = makeGun(gun, g, gx, gy, gz);
  if (gun === 'duals') makeGun(gun, g, -gx, gy, gz);

  // 受傷閃紅光用：只收非發光的材質
  const mats = [];
  g.traverse(o => { if (o.material && o.material.emissive && o.material.emissive.getHex() === 0 && !mats.includes(o.material)) mats.push(o.material); });
  g.scale.setScalar(scale);
  g.userData.baseScale = scale;
  g.userData.mats = mats;
  g.userData.muzzle = new THREE.Vector3(gx, gy + 0.02, gz + len);
  return g;
}

// 烏鴉一隻：flying＝展翅
function makeCrow(flying) {
  const b = new THREE.Group();
  const add = adder(b);
  const black = M(0x15151c), beak = M(0x3a3a40), eye = GLOW(0xd070ff, 0xa020ff, 2);
  add(ball(0.07, 0), black, 0, 0, 0).scale.set(0.9, 0.8, 1.5);
  add(ball(0.05, 0), black, 0, 0.05, 0.1);
  add(cone(0.02, 0.07, 4), beak, 0, 0.045, 0.16, Math.PI / 2);
  add(cone(0.05, 0.12, 4), black, 0, 0, -0.14, -Math.PI / 2);
  for (const s of [-1, 1]) {
    add(box(0.012, 0.012, 0.012), eye, 0.025 * s, 0.065, 0.13);
    if (flying) add(box(0.22, 0.015, 0.1), black, 0.13 * s, 0.03, 0, 0, 0, 0.35 * s);
    else add(box(0.03, 0.06, 0.14), black, 0.06 * s, 0, -0.02);
  }
  return b;
}

// 稻草人：木樁＋橫桿＋破爛外套＋布袋頭＋歪掉的魔女帽。身上停著的烏鴉在 userData.perched
export function makeScarecrowMesh(color, scale = 1) {
  if (rigDefFor('enemy', 'scarecrow')) {      // 方塊人版：兩臂和帽子上一樣停著三隻烏鴉
    const g = makeRigMesh(RIG_ENEMIES.scarecrow, scale);
    g.userData.perched = [[-0.42, 1.03, 0], [0.42, 1.03, 0], [0.1, 1.62, 0.02]].map(([x, y, z], i) => {
      const c = makeCrow(false);
      c.position.set(x, y, z);
      c.rotation.y = i === 2 ? 0.5 : 0.3 * Math.sign(x);
      g.add(c);
      return c;
    });
    g.userData.muzzle = new THREE.Vector3(0, 1, 0.2);
    return g;
  }
  const g = new THREE.Group();
  const add = adder(g);
  const wood = M(0x6b4a2a), coat = M(color), patch = M(0x7a5a30), sack = M(0xc8a878), straw = M(0xe0c060), stitch = M(0x3a2a1a);
  const eye = GLOW(0xffd34d, 0xffb000, 1.6);
  add(cyl(0.05, 0.06, 1.25, 6), wood, 0, 0.62, 0);
  add(box(0.95, 0.07, 0.07), wood, 0, 0.98, 0);
  add(cyl(0.17, 0.28, 0.5, 6), coat, 0, 0.72, 0).scale.z = 0.7;        // 外套
  for (const s of [-1, 1]) {
    add(box(0.32, 0.12, 0.14), coat, 0.3 * s, 0.98, 0);                 // 袖子
    add(cone(0.07, 0.14, 4), straw, 0.5 * s, 0.98, 0, 0, 0, Math.PI / 2 * s); // 袖口的稻草
    add(cone(0.05, 0.18, 4), straw, 0.1 * s, 0.4, 0.03, 0, 0, 0.2 * s);  // 下襬的稻草
  }
  add(box(0.1, 0.1, 0.02), patch, 0.08, 0.78, 0.16);
  add(box(0.08, 0.08, 0.02), patch, -0.1, 0.62, 0.17);
  add(ball(0.18, 0), sack, 0, 1.22, 0);
  for (const s of [-1, 1]) add(box(0.05, 0.05, 0.03), eye, 0.065 * s, 1.25, 0.16);
  add(box(0.16, 0.015, 0.02), stitch, 0, 1.15, 0.165, 0, 0, 0.1);      // 縫起來的嘴
  for (const x of [-0.05, 0, 0.05]) add(box(0.01, 0.04, 0.02), stitch, x, 1.15, 0.168);
  witchHat(add, 1.36, { color: 0x4a3050, band: 0xffb000, brim: 0.3, h: 0.36, bend: 0.6 });
  // 停在身上的三隻烏鴉（左臂、右臂、帽子）
  const perched = [[-0.4, 1.06, 0], [0.4, 1.06, 0], [0.12, 1.58, 0.05]].map(([x, y, z], i) => {
    const c = makeCrow(false);
    c.position.set(x, y, z);
    c.rotation.y = i === 2 ? 0.5 : 0.3 * Math.sign(x);
    g.add(c);
    return c;
  });
  g.userData.perched = perched;
  g.scale.setScalar(scale);
  g.userData.baseScale = scale;
  g.userData.mats = [coat, sack, wood];
  g.userData.muzzle = new THREE.Vector3(0, 1, 0.2);
  return g;
}

// 烏鴉群：幾隻展翅的烏鴉，數量跟著剩下的烏鴉數（userData.birds）
export function makeCrowMesh(n = 3) {
  const g = new THREE.Group();
  const birds = [];
  for (let i = 0; i < n; i++) {
    const b = makeCrow(true);
    const a = i / n * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.28, 0.12 * i, Math.sin(a) * 0.28);
    b.scale.setScalar(1.3);
    g.add(b);
    birds.push(b);
  }
  const mats = [];
  g.traverse(o => { if (o.material && o.material.emissive && o.material.emissive.getHex() === 0 && !mats.includes(o.material)) mats.push(o.material); });
  g.userData.birds = birds;
  g.userData.mats = mats;
  g.userData.baseScale = 1;
  g.userData.muzzle = new THREE.Vector3(0, 0, 0);
  return g;
}

// 使魔：紫色小球、一隻發光的眼睛、一對蝙蝠翅膀，飄在半空
function makeImp() {
  const g = new THREE.Group();
  const add = adder(g);
  const body = M(0xa060ff, { emissive: 0x3a1070, emissiveIntensity: 0.6 }), wing = M(0x3a2058), eye = GLOW(0xffe070, 0xffb020, 2.2);
  add(ball(0.22, 1), body, 0, 0, 0);
  add(ball(0.075, 0), eye, 0, 0.04, 0.19);
  add(cone(0.07, 0.14, 4), body, 0, -0.24, 0, Math.PI, 0, 0); // 小尾巴
  const wl = add(box(0.36, 0.025, 0.2), wing, -0.28, 0.07, -0.02, 0, 0, 0.45);
  const wr = add(box(0.36, 0.025, 0.2), wing, 0.28, 0.07, -0.02, 0, 0, -0.45);
  g.userData.wings = [wl, wr];
  g.userData.bodyMat = body;
  return g;
}
export function makeImpMesh() {
  const g = new THREE.Group();
  const imp = makeImp();
  imp.position.y = 0.55;
  g.add(imp);
  g.userData.mats = [imp.userData.bodyMat];
  g.userData.baseScale = 1;
  g.userData.muzzle = new THREE.Vector3(0, 0.55, 0.15);
  g.userData.imps = [imp];
  return g;
}
// 使魔巢穴：一團發光的紫色繭
export function makeNestMesh() {
  const g = new THREE.Group();
  const add = adder(g);
  const shell = M(0x3a1a58, { emissive: 0x200838, emissiveIntensity: 0.6 }), glow = GLOW(0xc080ff, 0x8030ff, 1.6);
  add(ball(0.42, 1), shell, 0, 0.36, 0).scale.y = 0.85;
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    add(ball(0.17, 0), shell, Math.cos(a) * 0.36, 0.18, Math.sin(a) * 0.36);
    add(ball(0.05, 0), glow, Math.cos(a) * 0.3, 0.5 + (i % 2) * 0.12, Math.sin(a) * 0.3);
  }
  add(ball(0.12, 0), glow, 0, 0.72, 0);
  g.userData.mats = [shell];
  g.userData.baseScale = 1;
  g.userData.muzzle = new THREE.Vector3(0, 0.5, 0);
  return g;
}

// 咬在少女身上的使魔團：數量跟著剩下的隻數（userData.birds，沿用烏鴉的顯示）
export function makeBiteMesh(n = 8) {
  const g = new THREE.Group();
  const birds = [];
  for (let i = 0; i < n; i++) {
    const b = makeImp();
    const a = i / n * Math.PI * 2 * 1.6;
    b.position.set(Math.cos(a) * 0.3, 0.55 + 0.11 * (i % 4), Math.sin(a) * 0.3);
    b.scale.setScalar(0.75);
    b.rotation.y = -a;
    g.add(b);
    birds.push(b);
  }
  g.userData.birds = birds;
  g.userData.imps = birds;
  g.userData.mats = birds.map(b => b.userData.bodyMat);
  g.userData.baseScale = 1;
  g.userData.muzzle = new THREE.Vector3(0, 0.7, 0);
  return g;
}

// 光變身後的光環＋翅膀
export function addHalo(mesh) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffd040, emissiveIntensity: 2, flatShading: true }));
  m.rotation.x = Math.PI / 2;
  m.position.y = 1.45;
  mesh.add(m);
  const wing = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc0e0, emissiveIntensity: 0.8, transparent: true, opacity: 0.85, flatShading: true });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 3), wing);
    w.position.set(0.22 * s, 0.98, -0.2);
    w.rotation.set(0.2, 0.5 * s, -1.2 * s);
    mesh.add(w);
  }
}

// 愛心形狀（小桃的彈坑）
export function heartShape(s = 0.35) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-1.2 * s, -0.1 * s, -0.9 * s, 0.9 * s, 0, 0.35 * s);
  h.bezierCurveTo(0.9 * s, 0.9 * s, 1.2 * s, -0.1 * s, 0, -0.9 * s);
  return h;
}
