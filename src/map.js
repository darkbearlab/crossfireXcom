// 小地圖程序生成：責任區、建築、掩體、隱蔽區、散佈的敵人崗哨、任務目標、補給箱。
import { T, MAPGEN, enemyGroups, mapScale } from './config.js';
import { coverSides, coverAt, hasLOS, dist } from './grid.js';

export class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.conceal = new Uint8Array(w * h); // 隱蔽區（草叢、陰影…）
    this.zone = new Int16Array(w * h);    // 責任區編號；0 = 部署帶，沒有人負責
    this.fog = new Uint8Array(w * h);     // 迷霧（卡蜜拉的「迷香」）：擋視線，站在裡面只有相鄰的人看得到
  }
  inB(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  get(x, z) { return this.inB(x, z) ? this.tiles[z * this.w + x] : T.FULL; }
  set(x, z, v) { if (this.inB(x, z)) this.tiles[z * this.w + x] = v; }
  walkable(x, z) { return this.inB(x, z) && this.get(x, z) === T.FLOOR; }
  isConceal(x, z) { return this.inB(x, z) && this.conceal[z * this.w + x] === 1; }
  isFog(x, z) { return this.inB(x, z) && this.fog[z * this.w + x] === 1; }
  setFog(x, z, v) { if (this.inB(x, z)) this.fog[z * this.w + x] = v; }
  setConceal(x, z, v) { if (this.inB(x, z)) this.conceal[z * this.w + x] = v; }
  zoneAt(x, z) { return this.inB(x, z) ? this.zone[z * this.w + x] : -1; }
  setZone(x, z, v) { if (this.inB(x, z)) this.zone[z * this.w + x] = v; }
}

export const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const k = (x, z) => x + ',' + z;

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function flood(m, s) {
  const seen = new Set([k(s.x, s.z)]);
  const list = [s];
  const q = [s];
  while (q.length) {
    const c = q.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, nz = c.z + dz;
      const nk = k(nx, nz);
      if (!m.walkable(nx, nz) || seen.has(nk)) continue;
      seen.add(nk);
      const p = { x: nx, z: nz };
      list.push(p);
      q.push(p);
    }
  }
  return { seen, list };
}

// 一條隨機抖動的邊界（每一列/欄的位置）
function wobbly(len, base) {
  const out = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    out.push(v);
    if (Math.random() < 0.3) v = Math.max(base - 2, Math.min(base + 2, v + (Math.random() < 0.5 ? -1 : 1)));
  }
  return out;
}

// ---------- 長直線 ----------
// 偏橫向的移動方向（整數向量 p ≥ |q|，互質）；只往右掃，反方向是同一條線
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const LINE_DIRS = [];
for (let p = 1; p <= 14; p++) for (let q = -p; q <= p; q++) if (gcd(p, Math.abs(q)) === 1) LINE_DIRS.push([p, q]);

// 跟 grid.clearMove 一樣的地形判定（身體半徑掃過、不能切牆角），只看地形
function segClear(m, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const steps = Math.ceil(Math.hypot(dx, dz) * 8), R = 0.2;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, px = ax + dx * t, pz = az + dz * t;
    for (const ox of [-R, R]) for (const oz of [-R, R]) {
      const x = Math.round(px + ox), z = Math.round(pz + oz);
      if (x === ax && z === az) continue;
      if (!m.walkable(x, z)) return false;
    }
  }
  return true;
}

// 找出太長的直線：從每條線的起點往前推，能走幾段
function longLines(m) {
  const out = [];
  const edge = z => z <= 1 || z >= m.h - 2;
  for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) {
    if (!m.walkable(x, z)) continue;
    for (const [p, q] of LINE_DIRS) {
      // 便宜的預先排除：要超過最短上限，至少得走到第 need 段的格點，那一格不能走就不用細算
      const need = Math.floor(MAPGEN.LINE_EDGE / Math.hypot(p, q)) + 1;
      if (!m.walkable(x + need * p, z + need * q)) continue;
      if (m.walkable(x - p, z - q) && segClear(m, x - p, z - q, x, z)) continue; // 不是線的起點
      let n = 0;
      while (segClear(m, x + n * p, z + n * q, x + (n + 1) * p, z + (n + 1) * q)) n++;
      const len = n * Math.hypot(p, q);
      const onEdge = edge(z) && edge(z + n * q) && Math.abs(q) * n <= 1;
      if (len > (onEdge ? MAPGEN.LINE_EDGE : MAPGEN.LINE_MAX)) out.push({ x, z, p, q, n, len });
    }
  }
  return out.sort((a, b) => b.len - a.len);
}

// 在太長的直線中段放障礙（多半是半掩體，偶爾是全掩體），直到沒有長直線。部署帶、keep 裡的格子不動
function breakLines(m, DC, keep) {
  for (let round = 0; round < 12; round++) {
    const lines = longLines(m);
    if (!lines.length) return true;
    for (const L of lines) {
      let n = 0;
      while (segClear(m, L.x + n * L.p, L.z + n * L.q, L.x + (n + 1) * L.p, L.z + (n + 1) * L.q)) n++;
      if (n < L.n) continue; // 已經被別的障礙斷開了
      // 中心線穿過格子中央附近的格子（擋在這裡一定會擋住身體）；先找中段，沒有就整條線
      const pick = (lo, hi) => {
        const got = new Map();
        const ex = L.x + n * L.p, ez = L.z + n * L.q, steps = Math.ceil(n * Math.hypot(L.p, L.q) * 8);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (t < lo || t > hi) continue;
          const px = L.x + (ex - L.x) * t, pz = L.z + (ez - L.z) * t, x = Math.round(px), z = Math.round(pz);
          if (Math.hypot(px - x, pz - z) > 0.3 || x <= DC || keep.has(k(x, z)) || m.get(x, z) !== T.FLOOR) continue;
          if ((x === L.x && z === L.z) || (x === ex && z === ez)) continue;
          got.set(k(x, z), { x, z });
        }
        return [...got.values()];
      };
      let cand = pick(0.3, 0.7);
      if (!cand.length) cand = pick(0, 1);
      if (!cand.length) continue;
      const c = cand[ri(0, cand.length - 1)];
      m.set(c.x, c.z, Math.random() < 0.25 ? T.FULL : T.HALF);
      m.setConceal(c.x, c.z, 0);
    }
  }
  return !longLines(m).length;
}

// opts: { type: 'extract'|'sabotage'|'hunt', bonus: 額外敵人數, extra: 先擺的編組（boss 等）}
export function generateMap(level, opts = {}) {
  for (let i = 0; i < MAPGEN.ATTEMPTS; i++) {
    const r = tryGenerate(level, opts);
    if (r) { r.attempts = i + 1; return r; }
  }
  throw new Error('地圖生成失敗');
}

function tryGenerate(level, opts) {
  const big = mapScale(level); // 後期地圖變大
  const w = ri(16, 19) + big * 4, h = ri(12, 15) + big * 2;
  const m = new GameMap(w, h);
  const DC = MAPGEN.DEPLOY_COLS;

  // ---- 責任區：部署帶以外切成 cols × rows 塊，邊界抖動 ----
  const cols = w >= 22 ? 4 : w >= 18 ? 3 : 2, rows = h >= 16 ? 3 : 2;
  const colB = [], rowB = [];
  for (let c = 1; c < cols; c++) colB.push(wobbly(h, DC + Math.round((w - DC) * c / cols)));
  for (let r = 1; r < rows; r++) rowB.push(wobbly(w, Math.round(h * r / rows)));
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    if (x < DC) { m.setZone(x, z, 0); continue; }
    const ci = colB.filter(b => x >= b[z]).length;
    const rI = rowB.filter(b => z >= b[x]).length;
    m.setZone(x, z, 1 + ci * rows + rI);
  }

  // ---- 建築：外牆是全掩體，有門；有些是廢墟，破牆變半掩體。室內是自己的責任區 ----
  const nb = ri(2, 3) + big;
  for (let b = 0; b < nb; b++) {
    const bw = ri(3, 5), bh = ri(3, 5);
    const x0 = ri(DC + 2, w - bw - 1), z0 = ri(0, h - bh);
    const ruined = Math.random() < 0.5;
    const perim = [];
    for (let x = x0; x < x0 + bw; x++) {
      for (let z = z0; z < z0 + bh; z++) {
        const ex = x === x0 || x === x0 + bw - 1;
        const ez = z === z0 || z === z0 + bh - 1;
        m.setConceal(x, z, 0);
        if (!ex && !ez) { m.set(x, z, T.FLOOR); m.setZone(x, z, 20 + b); continue; }
        m.set(x, z, T.FULL);
        if (!(ex && ez)) perim.push([x, z]);
      }
    }
    shuffle(perim);
    const doors = ri(2, 3);
    perim.forEach(([x, z], i) => {
      if (i < doors) { m.set(x, z, T.FLOOR); m.setZone(x, z, 20 + b); }
      else if (ruined && Math.random() < 0.35) m.set(x, z, T.HALF);
    });
  }

  // ---- 柱子 / 樹 ----
  const np = ri(3, 6) + big * 2;
  for (let i = 0; i < np; i++) {
    const x = ri(DC, w - 2), z = ri(0, h - 1);
    if (m.get(x, z) === T.FLOOR) m.set(x, z, T.FULL);
  }

  // ---- 半掩體群 ----
  const nh = Math.round(w * h * 0.045);
  for (let i = 0; i < nh; i++) {
    let x = ri(1, w - 2), z = ri(0, h - 1);
    const horiz = Math.random() < 0.5;
    const len = ri(1, 3);
    for (let j = 0; j < len; j++) {
      if (m.get(x, z) === T.FLOOR) m.set(x, z, T.HALF);
      if (horiz) x++; else z++;
    }
  }

  // ---- 隱蔽區：幾團隨機漫步的區塊 ----
  const nc = ri(4, 6) + big * 2;
  for (let i = 0; i < nc; i++) {
    let x = ri(DC, w - 2), z = ri(0, h - 1);
    const len = ri(5, 9);
    for (let j = 0; j < len; j++) {
      if (m.get(x, z) === T.FLOOR && m.zoneAt(x, z) < 20) m.setConceal(x, z, 1);
      const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(0, 3)];
      x = Math.max(DC, Math.min(w - 1, x + dx));
      z = Math.max(0, Math.min(h - 1, z + dz));
    }
  }

  // ---- 玩家出生區（左側） ----
  const zc = ri(1, h - 4);
  for (let x = 0; x < DC; x++) for (let z = zc - 1; z <= zc + 3; z++) { m.set(x, z, T.FLOOR); m.setConceal(x, z, 0); }
  if (m.get(DC, zc + 1) === T.FLOOR && Math.random() < 0.7) m.set(DC, zc + 1, T.HALF);
  const playerSpawns = [{ x: 1, z: zc }, { x: 1, z: zc + 2 }, { x: 0, z: zc + 1 }];
  const spawnC = { x: 1, z: zc + 1 };

  // ---- 任務 ----
  const type = opts.type || (Math.random() < 0.5 ? 'extract' : 'sabotage');
  let objective = null;
  if (type === 'sabotage') {
    for (let t = 0; t < 40 && !objective; t++) {
      const x = ri(Math.ceil(w * 0.6), w - 2), z = ri(1, h - 2);
      if (m.get(x, z) === T.FLOOR && !m.isConceal(x, z)) objective = { x, z, planted: false };
    }
    if (!objective) return null;
    m.set(objective.x, objective.z, T.HALF); // 終端機本身當半掩體
  }

  // ---- 斷開長直線：玩家一次移動能沿直線走任意距離，橫貫的空走廊（尤其是邊緣）等於一步穿越地圖 ----
  const keep = new Set();
  if (objective) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) keep.add(k(objective.x + dx, objective.z + dz));
  if (!breakLines(m, DC, keep)) return null;

  const { seen: reach, list: reachList } = flood(m, playerSpawns[0]);
  if (!reach.has(k(playerSpawns[1].x, playerSpawns[1].z))) return null;

  // 撤離點：撤離任務在右側邊緣；破壞任務要撤回左側邊緣
  // 獵殺任務（打倒家族成員）沒有撤離點
  const exits = type === 'hunt' ? [] : reachList.filter(p => type === 'extract' ? p.x === w - 1 : p.x <= 1);
  if (type !== 'hunt' && exits.length < 2) return null;
  if (objective && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => reach.has(k(objective.x + dx, objective.z + dz)))) return null;

  // ---- 部署區 ----
  const deployZone = [];
  const z0 = zc - Math.floor((MAPGEN.DEPLOY_ROWS - 3) / 2);
  for (let x = 0; x < DC; x++) {
    for (let z = z0; z < z0 + MAPGEN.DEPLOY_ROWS; z++) {
      if (m.walkable(x, z) && reach.has(k(x, z))) deployZone.push({ x, z });
    }
  }

  // ---- 敵人：散佈在各責任區的崗哨 ----
  const zoneTiles = new Map(), hideTiles = new Map(); // hideTiles 含隱蔽區（給打手躲）
  for (const p of reachList) {
    const zid = m.zoneAt(p.x, p.z);
    if (zid === 0) continue;
    if (dist(p, spawnC) < MAPGEN.MIN_ENEMY_DIST + big) continue;
    if (!hideTiles.has(zid)) hideTiles.set(zid, []);
    hideTiles.get(zid).push(p);
    if (m.isConceal(p.x, p.z)) continue;
    if (!zoneTiles.has(zid)) zoneTiles.set(zid, []);
    zoneTiles.get(zid).push(p);
  }
  // 從部署區看過去：seen＝千夏的視野（13 格）看得到的部署格數；open＝10 格內看得到又沒掩體；half＝只有半掩體擋著
  const deployPts = [];
  for (let x = 0; x < DC; x++) for (let z = 0; z < h; z++) if (m.walkable(x, z) && reach.has(k(x, z))) deployPts.push({ x, z });
  const viewCache = new Map();
  const view = p => {
    const kk = k(p.x, p.z);
    if (!viewCache.has(kk)) {
      let seen = 0, open = 0, half = 0;
      for (const d of deployPts) {
        if (!hasLOS(m, d, p, 13, true)) continue;
        seen++;
        if (dist(d, p) > 10) continue;
        const c = coverAt(m, p, d);
        if (c === 0) open++; else if (c === 1) half++;
      }
      viewCache.set(kk, { seen, open, half });
    }
    return viewCache.get(kk);
  };
  const zoneIds = shuffle([...zoneTiles.keys()].filter(z => zoneTiles.get(z).length >= 4));
  if (zoneIds.length < 3) return null;
  if (objective) {
    // 目標所在區一定有人顧
    const oz = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => m.zoneAt(objective.x + dx, objective.z + dz)).find(z => zoneIds.includes(z));
    if (oz !== undefined) { zoneIds.splice(zoneIds.indexOf(oz), 1); zoneIds.unshift(oz); }
  }

  const extra = opts.extra || [];
  if (extra.length) {
    // boss 編組放在離部署區最遠的責任區
    const cx = z => zoneTiles.get(z).reduce((s, p) => s + p.x, 0) / zoneTiles.get(z).length;
    const far = [...zoneIds].sort((a, b) => cx(b) - cx(a))[0];
    zoneIds.splice(zoneIds.indexOf(far), 1);
    zoneIds.unshift(far);
  }
  const used = new Set();
  const nearUsed = p => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (used.has(k(p.x + dx, p.z + dz))) return true; return false; };
  const enemies = [];
  const groups = [...extra, ...enemyGroups(level, opts.bonus || 0)];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const zid = zoneIds[gi % zoneIds.length];
    const flyer = g[0] === 'imp';
    // 打手：躲在部署區看不到的地方（可以在隱蔽區）
    // 崗哨：有掩體，而且從部署區看過去不能沒掩體（不能開場就被側翼）
    // 使魔：分散，不跟其他敵人相鄰（免得一發榴彈炸好幾隻）
    // 崗哨：被看得到的話，面向部署區最好是全掩體（狙擊開場不白送）
    const score = g[0] === 'brawler'
      ? p => (view(p).seen ? -20 - view(p).seen : 0) + (m.isConceal(p.x, p.z) ? 2 : 0) + Math.random() * 3
      : flyer ? p => (nearUsed(p) ? -30 : 0) + coverSides(m, p).length + Math.random() * 3
      : p => coverSides(m, p).length * 2 - (view(p).open ? 15 : view(p).half ? 8 : 0) + Math.random() * 3;
    // 打手：自己的責任區沒地方躲，就去別的責任區躲
    const pool = g[0] === 'brawler'
      ? (hideTiles.get(zid).some(p => !used.has(k(p.x, p.z)) && !view(p).seen) ? hideTiles.get(zid) : zoneIds.flatMap(z => hideTiles.get(z) || []))
      : zoneTiles.get(zid);
    const cands = pool.filter(p => !used.has(k(p.x, p.z)))
      .map(p => ({ p, s: score(p) }))
      .sort((a, b) => b.s - a.s);
    if (!cands.length) return null;
    const lead = cands[0].p;
    const members = [lead];
    for (const c of cands.slice(1)) {
      if (members.length >= g.length) break;
      if (flyer ? dist(c.p, lead) <= 4.5 && !nearUsed(c.p) && members.every(q => dist(q, c.p) > 1.5) : dist(c.p, lead) <= 2.3) members.push(c.p);
    }
    if (flyer && members.length < g.length) for (const c of cands.slice(1)) { // 擠不下就放寬
      if (members.length >= g.length) break;
      if (!members.includes(c.p) && dist(c.p, lead) <= 4.5) members.push(c.p);
    }
    if (members.length < g.length) return null;
    members.forEach((p, i) => {
      used.add(k(p.x, p.z));
      enemies.push({ x: p.x, z: p.z, type: g[i], zone: g[0] === 'brawler' ? m.zoneAt(p.x, p.z) : zid, group: gi });
    });
  }

  // ---- 補給箱（彈藥 / 醫療包）----
  const crates = [];
  const nCr = Math.random() < 0.6 ? 2 : 1;
  const exitKeys = new Set(exits.map(p => k(p.x, p.z)));
  const crateCands = shuffle(reachList.filter(p => p.x >= DC + 2 && !used.has(k(p.x, p.z)) && !exitKeys.has(k(p.x, p.z))));
  for (let i = 0; i < nCr && i < crateCands.length; i++) {
    const p = crateCands[i];
    if (crates.some(c => dist(c, p) < 4)) continue;
    crates.push({ x: p.x, z: p.z, type: i === 0 || Math.random() < 0.5 ? 'ammo' : 'med' });
  }

  return { map: m, playerSpawns, enemies, deployZone, crates, mission: { type, exits, objective } };
}
