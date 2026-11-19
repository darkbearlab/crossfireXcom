// 小地圖程序生成：責任區、建築、掩體、隱蔽區、散佈的敵人崗哨、任務目標、補給箱。
import { T, MAPGEN, enemyGroups } from './config.js';
import { coverSides, dist } from './grid.js';

export class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.conceal = new Uint8Array(w * h); // 隱蔽區（草叢、陰影…）
    this.zone = new Int16Array(w * h);    // 責任區編號；0 = 部署帶，沒有人負責
  }
  inB(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  get(x, z) { return this.inB(x, z) ? this.tiles[z * this.w + x] : T.FULL; }
  set(x, z, v) { if (this.inB(x, z)) this.tiles[z * this.w + x] = v; }
  walkable(x, z) { return this.inB(x, z) && this.get(x, z) === T.FLOOR; }
  isConceal(x, z) { return this.inB(x, z) && this.conceal[z * this.w + x] === 1; }
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

export function generateMap(level) {
  for (let i = 0; i < MAPGEN.ATTEMPTS; i++) {
    const r = tryGenerate(level);
    if (r) { r.attempts = i + 1; return r; }
  }
  throw new Error('地圖生成失敗');
}

function tryGenerate(level) {
  const w = ri(16, 19), h = ri(12, 15);
  const m = new GameMap(w, h);
  const DC = MAPGEN.DEPLOY_COLS;

  // ---- 責任區：部署帶以外切成 cols × rows 塊，邊界抖動 ----
  const cols = w >= 18 ? 3 : 2, rows = 2;
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
  const nb = ri(2, 3);
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
  const np = ri(3, 6);
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
  const nc = ri(4, 6);
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
  const playerSpawns = [{ x: 1, z: zc }, { x: 1, z: zc + 2 }];
  const spawnC = { x: 1, z: zc + 1 };

  // ---- 任務 ----
  const type = Math.random() < 0.5 ? 'extract' : 'sabotage';
  let objective = null;
  if (type === 'sabotage') {
    for (let t = 0; t < 40 && !objective; t++) {
      const x = ri(Math.ceil(w * 0.6), w - 2), z = ri(1, h - 2);
      if (m.get(x, z) === T.FLOOR && !m.isConceal(x, z)) objective = { x, z, planted: false };
    }
    if (!objective) return null;
    m.set(objective.x, objective.z, T.HALF); // 終端機本身當半掩體
  }

  const { seen: reach, list: reachList } = flood(m, playerSpawns[0]);
  if (!reach.has(k(playerSpawns[1].x, playerSpawns[1].z))) return null;

  // 撤離點：撤離任務在右側邊緣；破壞任務要撤回左側邊緣
  const exits = reachList.filter(p => type === 'extract' ? p.x === w - 1 : p.x <= 1);
  if (exits.length < 2) return null;
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
  const zoneTiles = new Map();
  for (const p of reachList) {
    const zid = m.zoneAt(p.x, p.z);
    if (zid === 0 || m.isConceal(p.x, p.z)) continue;
    if (dist(p, spawnC) < MAPGEN.MIN_ENEMY_DIST) continue;
    if (!zoneTiles.has(zid)) zoneTiles.set(zid, []);
    zoneTiles.get(zid).push(p);
  }
  const zoneIds = shuffle([...zoneTiles.keys()].filter(z => zoneTiles.get(z).length >= 4));
  if (zoneIds.length < 3) return null;
  if (objective) {
    // 目標所在區一定有人顧
    const oz = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => m.zoneAt(objective.x + dx, objective.z + dz)).find(z => zoneIds.includes(z));
    if (oz !== undefined) { zoneIds.splice(zoneIds.indexOf(oz), 1); zoneIds.unshift(oz); }
  }

  const used = new Set();
  const enemies = [];
  const groups = enemyGroups(level);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const zid = zoneIds[gi % zoneIds.length];
    const cands = zoneTiles.get(zid).filter(p => !used.has(k(p.x, p.z)))
      .map(p => ({ p, s: coverSides(m, p).length * 2 + Math.random() * 3 }))
      .sort((a, b) => b.s - a.s);
    if (!cands.length) return null;
    const lead = cands[0].p;
    const members = [lead];
    for (const c of cands.slice(1)) {
      if (members.length >= g.length) break;
      if (dist(c.p, lead) <= 2.3) members.push(c.p);
    }
    if (members.length < g.length) return null;
    members.forEach((p, i) => {
      used.add(k(p.x, p.z));
      enemies.push({ x: p.x, z: p.z, type: g[i], zone: zid, group: gi });
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
