// 小地圖程序生成：建築、柱子/樹、半掩體群、出生點、敵人小隊（pod）。
import { T, MAPGEN } from './config.js';
import { clearMove, hasLOS } from './grid.js';

export class GameMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
  }
  inB(x, z) { return x >= 0 && z >= 0 && x < this.w && z < this.h; }
  get(x, z) { return this.inB(x, z) ? this.tiles[z * this.w + x] : T.FULL; }
  set(x, z, v) { if (this.inB(x, z)) this.tiles[z * this.w + x] = v; }
  walkable(x, z) { return this.inB(x, z) && this.get(x, z) === T.FLOOR; }
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
  const q = [s];
  while (q.length) {
    const c = q.shift();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, nz = c.z + dz;
      const nk = k(nx, nz);
      if (!m.walkable(nx, nz) || seen.has(nk)) continue;
      seen.add(nk);
      q.push({ x: nx, z: nz });
    }
  }
  return seen;
}

export function generateMap(level) {
  for (let i = 0; i < MAPGEN.STRICT_ATTEMPTS + 300; i++) {
    const minMoves = i < MAPGEN.STRICT_ATTEMPTS ? MAPGEN.MIN_CONTACT_MOVES : 1;
    const r = tryGenerate(level, minMoves);
    if (r) { r.attempts = i + 1; r.minMoves = minMoves; return r; }
  }
  throw new Error('地圖生成失敗');
}

// 從 starts 出發，最少要幾次直線移動才能站到看得到 targets 任一格的位置（上限 limit）
function movesToContact(m, starts, targets, limit) {
  const none = () => false;
  let frontier = starts;
  const seen = new Set(starts.map(p => k(p.x, p.z)));
  for (let depth = 0; depth < limit; depth++) {
    if (frontier.some(p => targets.some(t => hasLOS(m, p, t)))) return depth;
    if (depth === limit - 1) break;
    const next = [];
    for (const p of frontier) {
      for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) {
        const kk = k(x, z);
        if (seen.has(kk)) continue;
        if (clearMove(m, p, { x, z }, none)) { seen.add(kk); next.push({ x, z }); }
      }
    }
    frontier = next;
  }
  return limit;
}

function tryGenerate(level, minMoves) {
  const w = ri(12, 15), h = ri(10, 14);
  const m = new GameMap(w, h);

  // 建築：外牆是全掩體，有門；有些是廢墟，破牆變半掩體
  const nb = ri(1, 3);
  for (let b = 0; b < nb; b++) {
    const bw = ri(3, 5), bh = ri(3, 5);
    if (w - bw - 3 < 3) continue;
    const x0 = ri(3, w - bw - 3), z0 = ri(0, h - bh);
    const ruined = Math.random() < 0.5;
    const perim = [];
    for (let x = x0; x < x0 + bw; x++) {
      for (let z = z0; z < z0 + bh; z++) {
        const ex = x === x0 || x === x0 + bw - 1;
        const ez = z === z0 || z === z0 + bh - 1;
        if (!ex && !ez) { m.set(x, z, T.FLOOR); continue; }
        m.set(x, z, T.FULL);
        if (!(ex && ez)) perim.push([x, z]);
      }
    }
    shuffle(perim);
    const doors = ri(2, 3);
    perim.forEach(([x, z], i) => {
      if (i < doors) m.set(x, z, T.FLOOR);
      else if (ruined && Math.random() < 0.35) m.set(x, z, T.HALF);
    });
  }

  // 柱子 / 樹
  const np = ri(2, 5);
  for (let i = 0; i < np; i++) {
    const x = ri(2, w - 3), z = ri(0, h - 1);
    if (m.get(x, z) === T.FLOOR) m.set(x, z, T.FULL);
  }

  // 半掩體群
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

  // 玩家出生區（左側）
  const zc = ri(1, h - 4);
  for (let x = 0; x <= 2; x++) for (let z = zc - 1; z <= zc + 3; z++) m.set(x, z, T.FLOOR);
  if (m.get(3, zc + 1) === T.FLOOR && Math.random() < 0.7) m.set(3, zc + 1, T.HALF);
  const playerSpawns = [{ x: 1, z: zc }, { x: 1, z: zc + 2 }];

  const reach = flood(m, playerSpawns[0]);
  if (!reach.has(k(playerSpawns[1].x, playerSpawns[1].z))) return null;

  // 敵人數量隨關卡增加，分成 2~3 人的小隊
  const count = Math.min(6, 2 + Math.floor((level - 1) * 0.8));
  const podSizes = [];
  let left = count;
  while (left > 0) {
    const s = left <= 3 ? left : ri(2, 3);
    podSizes.push(s);
    left -= s;
  }

  const used = new Set();
  const pods = [];
  for (const size of podSizes) {
    let placed = null;
    for (let t = 0; t < 80 && !placed; t++) {
      const cx = ri(Math.ceil(w * 0.5), w - 1), cz = ri(0, h - 1);
      const ck = k(cx, cz);
      if (!reach.has(ck) || used.has(ck)) continue;
      if (Math.hypot(cx - 1, cz - zc) < 7) continue;
      if (pods.some(p => Math.hypot(p[0].x - cx, p[0].z - cz) < 4)) continue;
      const members = [{ x: cx, z: cz }];
      const around = [];
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (dx || dz) around.push({ x: cx + dx, z: cz + dz });
      for (const p of shuffle(around)) {
        if (members.length >= size) break;
        const pk = k(p.x, p.z);
        if (reach.has(pk) && !used.has(pk)) members.push(p);
      }
      if (members.length >= size) placed = members;
    }
    if (!placed) return null;
    placed.forEach(p => used.add(k(p.x, p.z)));
    pods.push(placed.map(p => ({ ...p, type: level >= 3 && Math.random() < 0.35 ? 'brute' : 'grunt' })));
  }

  // 部署區：左側幾欄、出生點附近、可到達的空地
  const deployZone = [];
  const z0 = zc - Math.floor((MAPGEN.DEPLOY_ROWS - 3) / 2);
  for (let x = 0; x < MAPGEN.DEPLOY_COLS; x++) {
    for (let z = z0; z < z0 + MAPGEN.DEPLOY_ROWS; z++) {
      if (m.walkable(x, z) && reach.has(k(x, z))) deployZone.push({ x, z });
    }
  }

  // 開場安全距離：雙方都要移動 minMoves 次以上才能接觸
  const enemyPos = pods.flat();
  if (movesToContact(m, enemyPos, deployZone, minMoves) < minMoves) return null;
  if (movesToContact(m, deployZone, enemyPos, minMoves) < minMoves) return null;

  return { map: m, playerSpawns, pods, deployZone };
}
