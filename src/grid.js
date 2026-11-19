// 格子規則：尋路、視線、掩體、命中率。
import { T, RULES } from './config.js';

export const key = (x, z) => x + ',' + z;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function clearLine(map, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const steps = Math.ceil(Math.hypot(dx, dz) * 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(ax + dx * t), z = Math.round(az + dz * t);
    if ((x === ax && z === az) || (x === bx && z === bz)) continue;
    if (map.get(x, z) === T.FULL) return false;
  }
  return true;
}

function adjFull(map, p) {
  return ORTH.some(([dx, dz]) => map.inB(p.x + dx, p.z + dz) && map.get(p.x + dx, p.z + dz) === T.FULL);
}

// 「探身」：站在全掩體旁可從旁邊一格看出去。兩邊都檢查，所以視線是對稱的。
function peekLine(map, from, to) {
  if (!adjFull(map, from)) return false;
  for (const [dx, dz] of ORTH) {
    const px = from.x + dx, pz = from.z + dz;
    if (map.walkable(px, pz) && clearLine(map, px, pz, to.x, to.z)) return true;
  }
  return false;
}

export function hasLOS(map, a, b, sight = RULES.SIGHT) {
  if (dist(a, b) > sight) return false;
  if (clearLine(map, a.x, a.z, b.x, b.z)) return true;
  return peekLine(map, a, b) || peekLine(map, b, a);
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
  if (map.isConceal(b.x, b.z)) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  const steps = Math.ceil(Math.hypot(dx, dz) * 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(a.x + dx * t), z = Math.round(a.z + dz * t);
    if ((x === a.x && z === a.z) || (x === b.x && z === b.z)) continue;
    if (map.get(x, z) !== T.FLOOR || map.isConceal(x, z)) return false;
  }
  return true;
}

// weapon：可選的武器修正 { aim, crit, ignoreHalf, closeBonus, farRange, farPenalty }
export function shotOdds(map, s, sPos, tPos, { reaction = false, targetSuppressed = false, weapon = null } = {}) {
  const w = weapon || {};
  const raw = coverAt(map, tPos, sPos);
  const ignored = !!w.ignoreHalf && !reaction && raw === 1;
  const cover = ignored ? 0 : raw;
  const d = dist(sPos, tPos);
  let hit = s.aim + (w.aim || 0) - RULES.COVER_DEF[cover];
  const closeBonus = w.closeBonus ?? RULES.CLOSE_BONUS;
  const farRange = w.farRange ?? RULES.FAR_RANGE;
  const farPenalty = w.farPenalty ?? RULES.FAR_PENALTY;
  if (d <= RULES.CLOSE_RANGE) hit += closeBonus;
  else if (d > farRange) hit -= Math.round((d - farRange) * farPenalty);
  if (reaction) hit -= RULES.REACTION_PENALTY;
  if (s.suppressed) hit -= RULES.SUPPRESS_AIM;
  if (targetSuppressed) hit -= RULES.SUPPRESS_DEF;
  hit = clamp(Math.round(hit), 0, 100);
  const crit = clamp(s.crit + (w.crit || 0) + (cover === 0 ? RULES.FLANK_CRIT : 0), 0, 100);
  return { hit, crit, cover, ignored, flanked: cover === 0 && !ignored && coverSides(map, tPos).length > 0, dist: d };
}
