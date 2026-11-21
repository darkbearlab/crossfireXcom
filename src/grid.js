// 格子規則：尋路、視線、掩體、命中率。
import { T, RULES } from './config.js';

export const key = (x, z) => x + ',' + z;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// fog：迷霧擋視線（千夏站著不動時看得穿）
function clearLine(map, ax, az, bx, bz, fog = true) {
  const dx = bx - ax, dz = bz - az;
  const steps = Math.ceil(Math.hypot(dx, dz) * 6);
  const full = (x, z) => (map.inB(x, z) && map.get(x, z) === T.FULL) || (fog && map.isFog && map.isFog(x, z));
  let px = ax, pz = az;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(ax + dx * t), z = Math.round(az + dz * t);
    // 斜著擠過兩塊全掩體相接的牆角：算擋住
    if (x !== px && z !== pz && full(px, z) && full(x, pz)) return false;
    px = x; pz = z;
    if ((x === ax && z === az) || (x === bx && z === bz)) continue;
    if (full(x, z)) return false;
  }
  return true;
}

// 「探身」：貼著全掩體、目標在牆的那一側時，往旁邊跨一格、沿著牆邊看出去。
// 跨出去的那一格前面不能也是牆（要站在牆的盡頭才探得出去）。兩邊都檢查，所以視線是對稱的。
function peekLine(map, from, to, fog = true) {
  const full = (x, z) => map.inB(x, z) && map.get(x, z) === T.FULL;
  const vx = to.x - from.x, vz = to.z - from.z;
  for (const [wx, wz] of ORTH) {
    if (!full(from.x + wx, from.z + wz) || wx * vx + wz * vz <= 0) continue;
    for (const [sx, sz] of [[wz, wx], [-wz, -wx]]) { // 沿牆的兩個方向
      const px = from.x + sx, pz = from.z + sz;
      if (!map.walkable(px, pz) || full(px + wx, pz + wz)) continue;
      if (clearLine(map, px, pz, to.x, to.z, fog)) return true;
    }
  }
  return false;
}

// noFog：看得穿迷霧（千夏）。站在迷霧裡的人只有相鄰的人看得到（雙向）
export function hasLOS(map, a, b, sight = RULES.SIGHT, noFog = false) {
  const d = dist(a, b);
  if (d > sight) return false;
  const fog = !noFog;
  if (fog && map.isFog && d > 1.5 && (map.isFog(a.x, a.z) || map.isFog(b.x, b.z))) return false;
  if (clearLine(map, a.x, a.z, b.x, b.z, fog)) return true;
  return peekLine(map, a, b, fog) || peekLine(map, b, a, fog);
}

// 目標格 t 面對攻擊者 from 時的掩體等級：0 無、1 半、2 全
export function coverAt(map, t, from) {
  const vx = from.x - t.x, vz = from.z - t.z;
  const len = Math.hypot(vx, vz) || 1;
  let best = 0;
  for (const [dx, dz] of ORTH) {
    const nx = t.x + dx, nz = t.z + dz;
    if (!map.inB(nx, nz)) continue;
    const c = map.get(nx, nz);
    if (c === T.FLOOR) continue;
    if ((dx * vx + dz * vz) / len < 0.35) continue; // 攻擊者不在掩體那一側 → 被側翼
    best = Math.max(best, c);
  }
  return best;
}

export function coverSides(map, t) {
  const out = [];
  for (const [dx, dz] of ORTH) {
    const nx = t.x + dx, nz = t.z + dz;
    if (map.inB(nx, nz) && map.get(nx, nz) !== T.FLOOR) out.push({ dx, dz, c: map.get(nx, nz) });
  }
  return out;
}

// ---------- 直線移動 ----------
// 從 a 直線走到 b：路線只能經過空地，且不能穿過其他單位
export function clearMove(map, a, b, blocked) {
  if (a.x === b.x && a.z === b.z) return false;
  if (!map.walkable(b.x, b.z) || blocked(b.x, b.z)) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  const steps = Math.ceil(Math.hypot(dx, dz) * 8);
  const R = 0.2; // 地形：身體半徑掃過（不能切牆角）；單位：只看中心線經過的格子
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, px = a.x + dx * t, pz = a.z + dz * t;
    const cx = Math.round(px), cz = Math.round(pz);
    if (!(cx === a.x && cz === a.z) && blocked(cx, cz)) return false;
    for (const ox of [-R, R]) for (const oz of [-R, R]) {
      const x = Math.round(px + ox), z = Math.round(pz + oz);
      if (x === a.x && z === a.z) continue;
      if (!map.walkable(x, z)) return false;
    }
  }
  return true;
}

// 直線經過的格子（依序，不含起點，含終點）。t = 該格在路線上的位置 0..1
export function lineCells(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  const steps = Math.ceil(Math.sqrt(L2) * 8);
  const out = [];
  let last = key(a.x, a.z), lastT = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(a.x + dx * t), z = Math.round(a.z + dz * t);
    const kk = key(x, z);
    if (kk === last) continue;
    last = kk;
    lastT = Math.max(lastT, clamp(((x - a.x) * dx + (z - a.z) * dz) / L2, 0, 1));
    out.push({ x, z, t: lastT });
  }
  return out;
}

// 翻越：相鄰半掩體的另一側
export function vaultTargets(map, p, blocked) {
  const out = [];
  for (const [dx, dz] of ORTH) {
    const lx = p.x + dx * 2, lz = p.z + dz * 2;
    if (map.inB(p.x + dx, p.z + dz) && map.get(p.x + dx, p.z + dz) === T.HALF && map.walkable(lx, lz) && !blocked(lx, lz)) {
      out.push({ x: lx, z: lz });
    }
  }
  return out;
}

// 未警戒的視線：距離較短、看不穿半掩體、看不穿也看不進隱蔽區、不能探身
export function quietLOS(map, a, b, sight = RULES.QUIET_SIGHT) {
  if (dist(a, b) > sight) return false;
  if (map.isConceal(b.x, b.z) || (map.isFog && map.isFog(b.x, b.z))) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  const steps = Math.ceil(Math.hypot(dx, dz) * 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(a.x + dx * t), z = Math.round(a.z + dz * t);
    if ((x === a.x && z === a.z) || (x === b.x && z === b.z)) continue;
    if (map.get(x, z) !== T.FLOOR || map.isConceal(x, z) || (map.isFog && map.isFog(x, z))) return false;
  }
  return true;
}

// weapon：可選的武器修正 { aim, crit, ignoreHalf, sweet, sweetBonus, exposedBonus, farRange, farPenalty }
// aimBonus：射手的條件加成；raised：目標站在冰塊上（至少半掩體）
// 掩體等級（無 / 半 / 全，最高全）：hardy＝目標個子小，常態 +1 級（小桃）；suppressed＝目標被壓制縮起來，+1 級；
// breach＝射手會破防，不算壓制給的那 1 級
// 骰子制命中：回傳骰數、每顆骰命中率、至少中一顆的機率（hit）與平均命中數（exp）
// dieBonus：每顆骰的命中修正（%）；diceBonus：額外骰數（技能、條件）
export function shotOdds(map, s, sPos, tPos, { reaction = false, suppressed = false, breach = false, weapon = null, dieBonus = 0, diceBonus = 0, raised = false, hardy = false, air = false } = {}) {
  const w = weapon || {};
  let raw = air ? 0 : coverAt(map, tPos, sPos); // air：空中的目標（烏鴉）沒有掩體
  if (raised) raw = Math.max(raw, 1);
  const ignored = !!w.ignoreHalf && !reaction && raw === 1;
  const base = ignored ? 0 : raw;
  const duck = suppressed && !breach && base < 2;
  const small = hardy && base + (duck ? 1 : 0) < 2;
  const cover = Math.min(2, base + (duck ? 1 : 0) + (small ? 1 : 0));
  const d = dist(sPos, tPos);
  const [sweetLo, sweetHi] = w.sweet || RULES.SWEET;
  const sweet = Math.round(d) >= sweetLo && Math.round(d) <= sweetHi;
  let dice = (w.dice || 1) + diceBonus;
  if (sweet) dice += w.sweetDice ?? RULES.SWEET_DICE;
  if (cover === 0) dice += w.exposedDice || 0; // 突擊武器打沒掩體的目標
  if (d <= RULES.CLOSE_RANGE) dice += w.closeDice || 0; // 朱音槍法 3
  if (reaction && !w.noReactPenalty) dice -= RULES.REACTION_DICE;
  if (s.suppressed) dice -= RULES.SUPPRESS_DICE;
  dice = Math.max(1, dice);
  let die = RULES.DIE_HIT[cover] + (s.dieMod || 0) + (w.dieMod || 0) + dieBonus;
  const farRange = w.farRange ?? RULES.FAR_RANGE;
  const farPenalty = w.farPenalty ?? RULES.FAR_PENALTY;
  if (cover > 0 && d > farRange) die -= Math.round((d - farRange) * farPenalty);
  die = clamp(Math.round(die), RULES.DIE_MIN, RULES.DIE_MAX);
  const hit = Math.round((1 - Math.pow(1 - die / 100, dice)) * 100);
  return { hit, dice, die, exp: dice * die / 100, cover, ignored, sweet, duck, small, broke: suppressed && breach && base < 2,
    flanked: cover === 0 && !ignored && !air && coverSides(map, tPos).length > 0, dist: d };
}
