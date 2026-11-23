// 地圖格局：決定全掩體、半掩體、隱蔽區排在哪裡，並替每個掩體標上「它是什麼」（tag），畫面照 tag 換模型。
// 每種格局只管排格子；部署區、任務目標、斷開長直線、敵人擺放都在 map.js 的 tryGenerate 統一處理。
//   field：原本的野戰格局（隨機建築＋柱子＋箱子＋草叢），野戰主題用
//   street：街巷（夜市、公寓、洗衣店）    yard：場站（碼頭、貨運站、車站、廢車場、狗場）
//   hall：大廳柱網（停車場、賭場、拳場、劇場）  interior：室內房間（大樓、工坊、工廠）  garden：戶外庭園（教堂、望遠鏡塔、莊園）
// 地面種類 m.floor：0 主要地面、1 第二種（人行道、走道、碎石路）、2 特殊（鐵軌、舞台、地毯）
import { T } from './config.js';

export const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 放一格掩體（只放在空地上，除非 force）
function put(m, x, z, t, tag, force = false) {
  if (!m.inB(x, z)) return false;
  if (!force && m.get(x, z) !== T.FLOOR) return false;
  m.set(x, z, t); m.setTag(x, z, tag); m.setConceal(x, z, 0);
  return true;
}
// 一排掩體：從 (x,z) 往 (dx,dz) 放 len 格
function line(m, x, z, dx, dz, len, t, tag, minX) {
  let n = 0;
  for (let i = 0; i < len; i++) { const xx = x + dx * i, zz = z + dz * i; if (xx >= minX && put(m, xx, zz, t, tag)) n++; }
  return n;
}
// 隱蔽區：隨機漫步一團，只在空地、建築外
function concealBlob(m, x, z, len, minX, inside = false) {
  for (let j = 0; j < len; j++) {
    if (m.get(x, z) === T.FLOOR && (inside || m.zoneAt(x, z) < 20)) m.setConceal(x, z, 1);
    const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(0, 3)];
    x = Math.max(minX, Math.min(m.w - 1, x + dx));
    z = Math.max(0, Math.min(m.h - 1, z + dz));
  }
}
// 可以進去的建築：外牆全掩體、有門；室內是自己的責任區（20 + 編號）
// doorSide：門優先開在哪一邊（'n' 上、's' 下、'w' 左、'e' 右）
function building(m, x0, z0, bw, bh, b, { tag = 'bldg', doors = ri(2, 3), ruined = false, doorSide = null, inner = null } = {}) {
  const perim = [];
  for (let x = x0; x < x0 + bw; x++) for (let z = z0; z < z0 + bh; z++) {
    const ex = x === x0 || x === x0 + bw - 1, ez = z === z0 || z === z0 + bh - 1;
    m.setConceal(x, z, 0);
    if (!ex && !ez) { m.set(x, z, T.FLOOR); m.setTag(x, z, ''); m.setZone(x, z, 20 + b); m.setFloor(x, z, 2); continue; }
    m.set(x, z, T.FULL); m.setTag(x, z, tag);
    if (!(ex && ez)) perim.push([x, z, z === z0 ? 'n' : z === z0 + bh - 1 ? 's' : x === x0 ? 'w' : 'e']);
  }
  shuffle(perim);
  if (doorSide) perim.sort((a, b) => (b[2] === doorSide) - (a[2] === doorSide));
  perim.forEach(([x, z], i) => {
    if (i < doors) { m.set(x, z, T.FLOOR); m.setTag(x, z, ''); m.setZone(x, z, 20 + b); m.setFloor(x, z, 2); }
    else if (ruined && chance(0.35)) { m.set(x, z, T.HALF); m.setTag(x, z, 'rubble'); }
  });
  // 室內擺一兩件家具（半掩體）
  if (inner) for (let i = 0; i < ri(1, 2); i++) {
    const x = ri(x0 + 1, x0 + bw - 2), z = ri(z0 + 1, z0 + bh - 2);
    if ((bw - 2) * (bh - 2) > 2) put(m, x, z, T.HALF, inner);
  }
}

// ---------------- field：原本的野戰格局 ----------------
function field(m, c) {
  const { w, h, DC, big } = c;
  const nb = ri(2, 3) + big;
  for (let b = 0; b < nb; b++) {
    const bw = ri(3, 5), bh = ri(3, 5);
    building(m, ri(DC + 2, w - bw - 1), ri(0, h - bh), bw, bh, b, { ruined: chance(0.5), tag: 'wall' });
  }
  const np = ri(3, 6) + big * 2;
  for (let i = 0; i < np; i++) put(m, ri(DC, w - 2), ri(0, h - 1), T.FULL, 'pillar');
  const nh = Math.round(w * h * 0.045);
  for (let i = 0; i < nh; i++) {
    const horiz = chance(0.5);
    line(m, ri(1, w - 2), ri(0, h - 1), horiz ? 1 : 0, horiz ? 0 : 1, ri(1, 3), T.HALF, 'crate', 0);
  }
  const nc = ri(4, 6) + big * 2;
  for (let i = 0; i < nc; i++) concealBlob(m, ri(DC, w - 2), ri(0, h - 1), ri(5, 9), DC);
}

// ---------------- street：街巷 ----------------
// 上下兩邊是連排的店面（全掩體），中間是街；街上有攤位、機車、垃圾桶；店面之間的空隙是小巷。
// 參數：stalls 攤位多寡（0–1）、deep 建築最深幾格、shops 可以進去的店有幾間、junk 隱蔽區的樣子
function street(m, c) {
  const { w, h, DC, big, p } = c;
  const deep = p.deep || 2;
  let b = 0;
  // 店面：沿上邊和下邊一段一段排
  for (const top of [true, false]) {
    let x = DC + ri(0, 2);
    while (x < w - 1) {
      const seg = ri(2, 5), d = ri(1, deep);
      if (chance(0.82)) {
        for (let xx = x; xx < Math.min(w, x + seg); xx++) for (let k = 0; k < d; k++) {
          const z = top ? k : h - 1 - k;
          put(m, xx, z, T.FULL, 'bldg');
        }
        // 店面前一格是人行道
        for (let xx = x; xx < Math.min(w, x + seg); xx++) { const z = top ? d : h - 1 - d; if (m.inB(xx, z)) m.setFloor(xx, z, 1); }
      }
      x += seg + ri(1, 2); // 小巷
    }
  }
  // 可以進去的店：貼著上邊或下邊，門開在街那一面
  const shops = (p.shops ?? ri(1, 2)) + big;
  for (let i = 0; i < shops; i++) {
    const bw = ri(4, 5), bh = ri(3, 4), top = chance(0.5);
    const x0 = ri(DC + 3, w - bw - 1), z0 = top ? 0 : h - bh;
    building(m, x0, z0, bw, bh, b++, { tag: 'shop', doors: ri(2, 3), doorSide: top ? 's' : 'n', inner: p.shopInner || 'counter' });
  }
  // 街中間：攤位一小排一小排，偶爾有書報亭（全掩體）
  const mid = Math.floor(h / 2);
  const rows = h >= 14 ? [mid - 2, mid + 1] : [mid - 1, mid + 1];
  for (const z of rows) {
    let x = DC + ri(1, 3);
    while (x < w - 2) {
      if (chance(0.35 + 0.5 * (p.stalls ?? 0.5))) x += line(m, x, z, 1, 0, ri(1, 3), T.HALF, p.stall || 'stall', DC) + 1;
      x += ri(2, 3);
    }
  }
  const nk = ri(1, 2) + big;
  for (let i = 0; i < nk; i++) put(m, ri(DC + 3, w - 2), ri(mid - 2, mid + 2), T.FULL, p.kiosk || 'kiosk');
  // 人行道上的機車、垃圾桶
  const ns = Math.round(w * 0.35);
  for (let i = 0; i < ns; i++) {
    const x = ri(DC + 1, w - 1), top = chance(0.5);
    let z = top ? 0 : h - 1;
    while (m.inB(x, z) && m.get(x, z) !== T.FLOOR) z += top ? 1 : -1;
    put(m, x, z, T.HALF, chance(0.6) ? 'scooter' : 'bin');
  }
  // 隱蔽區：建築旁邊的雜物堆、晾衣服的地方
  const nc = ri(4, 6) + big * 2;
  for (let i = 0; i < nc; i++) {
    const top = chance(0.5);
    concealBlob(m, ri(DC, w - 2), top ? ri(1, 3) : ri(h - 4, h - 2), ri(3, 6), DC);
  }
}

// ---------------- yard：場站 ----------------
// 一排一排的貨櫃（全掩體）中間是走道；棧板、木箱、油桶是半掩體。
// 參數：stack 主要的全掩體 tag（container／carpile／kennel）、rail 有鐵軌和月台、depot 有一棟可以進去的倉庫
function yard(m, c) {
  const { w, h, DC, big, p } = c;
  let b = 0;
  let railZ = -1;
  if (p.rail) {
    // 鐵軌：橫越整張地圖的兩列；一邊停著一節車廂，兩邊是月台邊緣（半掩體，有缺口）
    railZ = ri(Math.floor(h / 2) - 1, Math.floor(h / 2));
    for (let x = 0; x < w; x++) { m.setFloor(x, railZ, 2); m.setFloor(x, railZ + 1, 2); }
    const tl = ri(4, 6), tx = ri(DC + 3, w - tl - 1), tz = chance(0.5) ? railZ : railZ + 1;
    line(m, tx, tz, 1, 0, tl, T.FULL, 'train', DC);
    for (const z of [railZ - 1, railZ + 2]) {
      let x = DC + ri(0, 2);
      while (x < w) { x += line(m, x, z, 1, 0, ri(2, 3), T.HALF, 'platform', DC) + ri(1, 2); }
      for (let xx = 0; xx < w; xx++) if (m.inB(xx, z)) m.setFloor(xx, z, 1);
    }
    // 車站：上面一棟（候車室）
    const bw = ri(4, 6), bh = ri(3, 4);
    building(m, ri(DC + 2, w - bw - 1), 0, bw, Math.min(bh, railZ - 1), b++, { tag: 'station', doorSide: 's', inner: 'bench' });
  }
  if (p.depot) {
    const bw = ri(4, 6), bh = ri(4, 5), top = chance(0.5);
    building(m, ri(Math.floor(w / 2), w - bw - 1), top ? 0 : h - bh, bw, bh, b++, { tag: 'warehouse', doors: 3, inner: 'crate' });
  }
  // 貨櫃：一欄一欄，每欄是幾段直的或橫的
  const stack = p.stack || 'container';
  for (let x = DC + ri(2, 3); x < w - 1; x += ri(3, 4)) {
    let z = ri(0, 2);
    while (z < h - 1) {
      const len = ri(2, 4);
      if (railZ < 0 || z + len < railZ - 1 || z > railZ + 2) {
        if (chance(0.25)) line(m, x - 1, z, 1, 0, ri(2, 3), T.FULL, stack, DC);
        else line(m, x, z, 0, 1, Math.min(len, railZ >= 0 && z < railZ ? railZ - 1 - z : len), T.FULL, stack, DC);
      }
      z += len + ri(1, 3);
    }
  }
  // 走道上的棧板、油桶、木箱
  const nh = Math.round(w * h * 0.03) + big * 2;
  const halfs = p.halfs || ['pallet', 'barrel', 'crate'];
  for (let i = 0; i < nh; i++) {
    const horiz = chance(0.5);
    line(m, ri(DC, w - 2), ri(0, h - 1), horiz ? 1 : 0, horiz ? 0 : 1, ri(1, 2), T.HALF, halfs[ri(0, halfs.length - 1)], DC);
  }
  const nc = ri(4, 6) + big * 2;
  for (let i = 0; i < nc; i++) concealBlob(m, ri(DC + 1, w - 2), ri(0, h - 1), ri(4, 7), DC);
}

// ---------------- hall：大廳柱網 ----------------
// 規則的柱子（全掩體）；柱子之間停車、擺賭桌或座椅（半掩體）；燈壞掉的暗處是隱蔽區。
// 參數：fill 柱子間擺什麼（car／table／seat）、tall 偶爾出現的一排高的東西（slot 吃角子老虎）、ring 中間有拳擊台、vault 有金庫
function hall(m, c) {
  const { w, h, DC, big, p } = c;
  let b = 0;
  if (p.vault) {
    const bw = ri(4, 5), bh = ri(4, 5);
    building(m, w - bw, ri(0, h - bh), bw, bh, b++, { tag: 'vault', doors: 2, doorSide: 'w', inner: 'cash' });
  }
  if (p.ring) {
    // 拳擊台：4×4 的圍繩（半掩體），每邊留一個缺口
    const x0 = ri(DC + 4, w - 7), z0 = ri(2, h - 6);
    for (let i = 0; i < 4; i++) for (const [x, z] of [[x0 + i, z0], [x0 + i, z0 + 3], [x0, z0 + i], [x0 + 3, z0 + i]]) if (!(i === 1 || i === 2) || chance(0.5)) put(m, x, z, T.HALF, 'ropes');
    for (let x = x0 + 1; x < x0 + 3; x++) for (let z = z0 + 1; z < z0 + 3; z++) m.setFloor(x, z, 2);
  }
  const sx = ri(3, 4), sz = ri(3, 4), ox = DC + ri(1, 2), oz = ri(0, 2);
  for (let x = ox; x < w - 1; x += sx) for (let z = oz; z < h; z += sz) {
    put(m, x, z, T.FULL, 'pillar');
    // 柱子旁邊：停車（橫的兩格）或桌子
    if (chance(0.55)) {
      const fill = p.fill || 'car';
      const dz = chance(0.5) ? 1 : -1;
      line(m, x + 1, z + dz, 1, 0, fill === 'seat' ? ri(2, 3) : ri(1, 2), T.HALF, fill, DC);
      if (fill === 'car') for (let k = 1; k <= 2; k++) if (m.inB(x + k, z + dz)) m.setFloor(x + k, z + dz, 1);
    }
  }
  // 一小段一小段高的東西（吃角子老虎、堆高的箱子）：補足全掩體
  for (let i = 0; i < ri(2, 3) + big; i++) {
    const horiz = chance(0.5);
    line(m, ri(DC + 2, w - 3), ri(1, h - 2), horiz ? 1 : 0, horiz ? 0 : 1, ri(2, 3), T.FULL, p.tall || 'rack', DC);
  }
  // 零散的半掩體（推車、桌子、雜物）
  const nh = Math.round(w * h * 0.02);
  const extra = p.extra || ['crate'];
  for (let i = 0; i < nh; i++) put(m, ri(DC, w - 2), ri(0, h - 1), T.HALF, extra[ri(0, extra.length - 1)]);
  const nc = ri(4, 6) + big * 2;
  for (let i = 0; i < nc; i++) concealBlob(m, ri(DC + 1, w - 2), ri(0, h - 1), ri(5, 8), DC);
}

// ---------------- interior：室內房間 ----------------
// 用牆（全掩體）把空間切成房間和走廊，牆上開門（1～2 格）；有些牆是玻璃隔間（半掩體）。
// 每個房間是自己的責任區。參數：furn 家具（半掩體）、big 大型機器（全掩體）
function interior(m, c) {
  const { w, h, DC, big, p } = c;
  const rooms = [];
  // 二分切割：區域夠大就切一刀，牆上開門
  const split = (x0, z0, x1, z1, depth) => {
    const W = x1 - x0 + 1, H = z1 - z0 + 1;
    const canX = W >= 9, canZ = H >= 8;
    if (depth > 3 || (!canX && !canZ) || (depth >= 2 && chance(0.25))) { rooms.push([x0, z0, x1, z1]); return; }
    const vert = canX && (!canZ || W / H > 1.1 || chance(0.5));
    if (vert) {
      const sx = ri(x0 + 4, x1 - 4);
      const seg = [];
      for (let z = z0; z <= z1; z++) seg.push([sx, z]);
      wall(seg);
      split(x0, z0, sx - 1, z1, depth + 1); split(sx + 1, z0, x1, z1, depth + 1);
    } else {
      const sz = ri(z0 + 3, z1 - 3);
      const seg = [];
      for (let x = x0; x <= x1; x++) seg.push([x, sz]);
      wall(seg);
      split(x0, z0, x1, sz - 1, depth + 1); split(x0, sz + 1, x1, z1, depth + 1);
    }
  };
  const wall = seg => {
    const glass = chance(p.glass ?? 0.25);
    for (const [x, z] of seg) put(m, x, z, glass ? T.HALF : T.FULL, glass ? 'partition' : 'wall', true);
    // 門：每 4～5 格至少一個，寬 1～2
    for (let i = ri(1, 3); i < seg.length - 1; i += ri(3, 5)) {
      for (let k = 0; k < (chance(0.35) ? 2 : 1) && i + k < seg.length; k++) {
        const [x, z] = seg[i + k]; m.set(x, z, T.FLOOR); m.setTag(x, z, ''); m.setFloor(x, z, 1);
      }
    }
  };
  split(DC + 1, 0, w - 1, h - 1, 0);
  // 房間：責任區、家具、地面
  rooms.forEach(([x0, z0, x1, z1], i) => {
    const area = (x1 - x0 + 1) * (z1 - z0 + 1);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (m.get(x, z) === T.FLOOR) m.setZone(x, z, 20 + i);
    const furn = p.furn || ['desk'];
    const nf = Math.round(area * 0.09);
    for (let k = 0; k < nf; k++) {
      const horiz = chance(0.5);
      line(m, ri(x0 + 1, Math.max(x0 + 1, x1 - 1)), ri(z0 + 1, Math.max(z0 + 1, z1 - 1)), horiz ? 1 : 0, horiz ? 0 : 1, ri(1, 2), T.HALF, furn[ri(0, furn.length - 1)], DC);
    }
    if (p.heavy && area >= 20 && chance(0.6)) put(m, ri(x0 + 1, x1 - 1), ri(z0 + 1, z1 - 1), T.FULL, p.heavy);
    if (chance(0.6)) concealBlob(m, ri(x0, x1), ri(z0, z1), ri(4, 7), x0, true);
  });
  // 入口：部署區那一側的外牆
  for (let z = 0; z < h; z++) put(m, DC, z, T.FULL, 'wall');
  const opens = shuffle([...Array(h).keys()]).slice(0, ri(3, 4) + big);
  for (const z of opens) { m.set(DC, z, T.FLOOR); m.setTag(DC, z, ''); m.setFloor(DC, z, 1); }
  for (let x = 0; x < DC; x++) for (let z = 0; z < h; z++) m.setFloor(x, z, 1);
}

// ---------------- garden：戶外庭園 ----------------
// 右邊一棟主建築（教堂、塔、宅邸）；樹籬、樹（全掩體），墓碑、花圃、長椅（半掩體）；碎石小路；高草是隱蔽區。
// 參數：main 主建築 tag、rows 成排的半掩體（grave 墓碑）、fountain 有噴水池
function garden(m, c) {
  const { w, h, DC, big, p } = c;
  // 碎石路：從部署區到主建築
  const pz = ri(3, h - 4);
  let z = pz;
  for (let x = 0; x < w; x++) {
    m.setFloor(x, z, 1);
    if (chance(0.15)) { z = Math.max(1, Math.min(h - 2, z + (chance(0.5) ? 1 : -1))); m.setFloor(x, z, 1); }
  }
  const bw = ri(4, 6), bh = ri(5, 6);
  building(m, w - bw, Math.max(0, Math.min(h - bh, pz - 2)), bw, bh, 0, { tag: p.main || 'manor', doors: 3, doorSide: 'w', inner: p.mainInner || 'bench' });
  if (p.fountain) {
    const fx = ri(Math.floor(w / 2) - 1, Math.floor(w / 2) + 1), fz = Math.floor(h / 2);
    put(m, fx, fz, T.FULL, 'fountain');
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (chance(0.6)) put(m, fx + dx, fz + dz, T.HALF, 'bench');
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (m.inB(fx + dx, fz + dz)) m.setFloor(fx + dx, fz + dz, 1);
  }
  if (p.rows) {
    // 墓碑：一排一排，間隔一格
    const zs = ri(0, 1);
    for (let zz = zs; zz < h; zz += 3) {
      let x = DC + ri(1, 3);
      while (x < w - bw - 1) { x += line(m, x, zz, 1, 0, ri(2, 3), T.HALF, p.rows, DC) + ri(1, 2); }
    }
  }
  // 樹籬：短的一段一段，偶爾 L 形
  const nh = ri(4, 6) + big * 2;
  for (let i = 0; i < nh; i++) {
    const x = ri(DC + 1, w - bw - 2), zz = ri(0, h - 1), horiz = chance(0.5), len = ri(2, 4);
    line(m, x, zz, horiz ? 1 : 0, horiz ? 0 : 1, len, T.FULL, 'hedge', DC);
    if (chance(0.3)) line(m, x, zz, horiz ? 0 : 1, horiz ? 1 : 0, ri(1, 2), T.FULL, 'hedge', DC);
  }
  const nt = ri(3, 5) + big;
  for (let i = 0; i < nt; i++) put(m, ri(DC, w - 2), ri(0, h - 1), T.FULL, 'tree');
  const nf = Math.round(w * h * 0.025);
  const halfs = p.halfs || ['flowerbed', 'bench'];
  for (let i = 0; i < nf; i++) put(m, ri(DC, w - 2), ri(0, h - 1), T.HALF, halfs[ri(0, halfs.length - 1)]);
  const nc = ri(4, 6) + big * 2;
  for (let i = 0; i < nc; i++) concealBlob(m, ri(DC, w - 2), ri(0, h - 1), ri(5, 9), DC);
}

export const LAYOUTS = { field, street, yard, hall, interior, garden };
