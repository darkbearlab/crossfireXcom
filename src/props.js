// 場景的模型：地面、掩體（照格局標的 tag 挑模型）、隱蔽區、地圖外的景、燈光。都用方塊加像素貼圖，跟方塊人同一種風格。
// buildSite(世界, S) 把整張地圖蓋起來；cellMesh(主題, 地圖, x, z) 給單一格（楓炸掉掩體時換模型用）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from './config.js';
import { tex } from './pixtex.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pickR = a => a[Math.floor(Math.random() * a.length)];

// ---------- 材質 ----------
// m = { t: 貼圖, c: 貼圖主色, tint: 顏色倍率, e: 發光色, ei: 發光強度, o: 不透明度, basic: 不受光 }
const mats = new Map();
function mat(m) {
  const key = JSON.stringify(m);
  if (mats.has(key)) return mats.get(key);
  let out;
  if (m.basic) out = new THREE.MeshBasicMaterial({ color: m.c, transparent: m.o != null, opacity: m.o ?? 1, depthWrite: m.o == null });
  else {
    out = new THREE.MeshStandardMaterial({
      map: m.t ? tex(m.t, m.c) : null, color: m.t ? new THREE.Color(m.tint ?? 0xffffff) : m.c, roughness: m.r ?? 0.9, metalness: 0,
      transparent: m.o != null, opacity: m.o ?? 1, depthWrite: m.o == null,
    });
    if (m.e != null) { out.emissive = new THREE.Color(m.e); out.emissiveIntensity = m.ei ?? 1; if (m.t) out.emissiveMap = out.map; }
  }
  mats.set(key, out);
  return out;
}
// 方塊的 UV 照實際大小放大：每 1 格長 = 一張 16×16 貼圖，貼圖密度到處一樣
function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const size = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const j = f * 4 + i;
    uv.setXY(j, uv.getX(j) * size[f][0], uv.getY(j) * size[f][1]);
  }
  return g;
}
// 一個道具：一堆方塊，同材質的合併成一個 mesh
function Vox() {
  const parts = new Map();
  const v = {
    box(w, h, d, x, y, z, m, ry = 0) {
      const g = boxGeo(w, h, d);
      if (ry) g.rotateY(ry);
      g.translate(x, y + h / 2, z);
      const key = JSON.stringify(m);
      if (!parts.has(key)) parts.set(key, { m, gs: [] });
      parts.get(key).gs.push(g);
      return v;
    },
    out(shadow = true) {
      const grp = new THREE.Group();
      for (const { m, gs } of parts.values()) {
        const mesh = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat(m));
        if (gs.length > 1) gs.forEach(g => g.dispose());
        mesh.castShadow = shadow && m.o == null && !m.basic; mesh.receiveShadow = !m.basic;
        grp.add(mesh);
      }
      return grp;
    },
  };
  return v;
}

// ---------- 掩體模型 ----------
// ctx：{ k 場景組, day, open(dx,dz) 那一側是不是空地（擺窗戶、招牌）, accent }
const WOOD = { t: 'planks', c: 0x8a6040 }, DARK = { c: 0x222226 }, METAL = { t: 'metal', c: 0x7a8088 };
const lit = (ctx, c, ei = 1.2) => ctx.day ? { c } : { c, e: c, ei };
const CONTAINER_COLORS = [0xb03a2e, 0x2e5ab0, 0x2e8a4a, 0xd07a20, 0x6a6a70, 0x8a2a5a];
const CAR_COLORS = [0xc8c8c8, 0x2a2a30, 0xb03030, 0x2a4a8a, 0xd0b040, 0x5a6a5a];

// 建築的牆：四面看哪一面朝著空地，在那一面貼窗戶或招牌
function facade(v, ctx, h, kind) {
  const [wt, wc] = ctx.k.wall;
  v.box(1, h, 1, 0, 0, 0, { t: wt, c: wc });
  v.box(1.04, 0.08, 1.04, 0, h, 0, { t: 'concrete', c: 0x5a5a5a });
  for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
    if (!ctx.open(dx, dz)) continue;
    const px = dx * 0.51, pz = dz * 0.51;
    if (kind === 'shop') {
      v.box(0.8, 0.75, 0.04, px, 0.05, pz, { t: 'shutter', c: 0x8a9098 }, ry);
      v.box(0.9, 0.3, 0.06, px * 1.02, 0.95, pz * 1.02, ctx.day ? { t: 'sign', c: ctx.k.accent } : { t: 'sign', c: ctx.k.accent, e: 0xffffff, ei: 0.9 }, ry);
    } else if (kind === 'warehouse') {
      v.box(0.9, 1.1, 0.04, px, 0.0, pz, { t: 'shutter', c: 0x9aa4a8 }, ry);
    } else if (kind === 'vault') {
      v.box(0.8, 1.0, 0.04, px, 0.1, pz, METAL, ry);
    } else if (kind !== 'wall') {
      v.box(0.7, 0.55, 0.04, px, 0.6, pz, ctx.day ? { t: 'dayWindow', c: wc } : { t: 'window', c: wc, e: 0xffffff, ei: 0.8 }, ry);
    }
  }
}

const PROPS = {
  // ----- 全掩體 -----
  wall: (v, ctx) => facade(v, ctx, 1.5, 'wall'),
  bldg: (v, ctx) => facade(v, ctx, 1.6, 'bldg'),
  shop: (v, ctx) => facade(v, ctx, 1.6, 'shop'),
  station: (v, ctx) => facade(v, ctx, 1.6, 'bldg'),
  warehouse: (v, ctx) => facade(v, ctx, 1.6, 'warehouse'),
  vault: (v, ctx) => facade(v, ctx, 1.6, 'vault'),
  manor: (v, ctx) => { facade(v, ctx, 1.6, 'bldg'); v.box(1.1, 0.14, 1.1, 0, 1.6, 0, { t: 'planks', c: 0x7a2a2a }); },
  church: (v, ctx) => { facade(v, ctx, 1.7, 'bldg'); if (Math.random() < 0.25) v.box(0.1, 0.5, 0.1, 0, 1.78, 0, { c: 0x9a9488 }).box(0.34, 0.1, 0.1, 0, 2.05, 0, { c: 0x9a9488 }); },
  tower: (v, ctx) => facade(v, ctx, 1.7, 'bldg'),
  pillar(v, ctx) {
    const casino = ctx.k.label === '賭場' || ctx.k.label === '舊劇場';
    v.box(0.62, 1.7, 0.62, 0, 0, 0, casino ? { t: 'plaster', c: 0xc8b890 } : { t: 'concrete', c: 0x9a9a98 });
    v.box(0.66, 0.3, 0.66, 0, 0, 0, casino ? { c: 0xc8a040, r: 0.4 } : { t: 'hazard', c: 0 });
  },
  kiosk(v, ctx) {
    v.box(0.85, 1.1, 0.85, 0, 0, 0, { t: 'shutter', c: 0x5a8a6a });
    v.box(1, 0.12, 1, 0, 1.1, 0, { t: 'awning', c: ctx.k.accent });
    v.box(0.9, 0.3, 0.9, 0, 1.22, 0, ctx.day ? { t: 'sign', c: ctx.k.accent } : { t: 'sign', c: ctx.k.accent, e: 0xffffff, ei: 1 });
  },
  container(v, ctx) {
    const c = pickR(CONTAINER_COLORS);
    v.box(1, 1.45, 1, 0, 0, 0, { t: 'container', c });
    if (Math.random() < 0.15) v.box(1, 0.04, 1, 0, 1.45, 0, { t: 'container', c: pickR(CONTAINER_COLORS) });
  },
  carpile(v) {
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const c = pickR([0x8a4a2a, 0x6a6058, 0x5a3a2a, 0x7a7a70]);
      v.box(0.92, 0.42, 0.8, rnd(-0.06, 0.06), y, rnd(-0.06, 0.06), { t: 'carbody', c }, rnd(-0.3, 0.3));
      y += 0.46;
    }
  },
  kennel(v) {
    v.box(1, 1.3, 1, 0, 0, 0, { t: 'planks', c: 0x6a5038 });
    v.box(1.06, 0.1, 1.06, 0, 1.3, 0, { t: 'metal', c: 0x5a5e62 });
  },
  train(v, ctx) {
    v.box(1, 1.5, 0.95, 0, 0.1, 0, { t: 'metal', c: 0x3a6a5a });
    v.box(1, 0.1, 0.8, 0, 0, 0, DARK);
    for (const s of [1, -1]) v.box(0.6, 0.4, 0.02, 0, 0.85, s * 0.48, ctx.day ? { t: 'glass', c: 0 } : { c: 0xffe0a0, e: 0xffd080, ei: 0.9 });
    v.box(1, 0.1, 0.95, 0, 1.6, 0, { c: 0x2a3a34 });
  },
  slot(v) {
    v.box(0.75, 1.5, 0.6, 0, 0, 0, { t: 'metal', c: 0x8a1a2a });
    for (const s of [1, -1]) v.box(0.6, 0.6, 0.02, 0, 0.6, s * 0.31, { t: 'slot', c: 0xc8a040, e: 0xffffff, ei: 0.7 });
    v.box(0.75, 0.2, 0.6, 0, 1.5, 0, { c: 0xffd040, e: 0xffa020, ei: 0.8 });
  },
  rack(v) {
    for (const [x, z] of [[-0.42, -0.2], [0.42, -0.2], [-0.42, 0.2], [0.42, 0.2]]) v.box(0.06, 1.6, 0.06, x, 0, z, METAL);
    for (const y of [0.3, 0.8, 1.3]) {
      v.box(0.92, 0.05, 0.5, 0, y, 0, METAL);
      v.box(0.35, 0.3, 0.35, rnd(-0.2, 0.2), y + 0.05, 0, { t: 'crate', c: 0xa08050 });
    }
  },
  machine(v, ctx) {
    v.box(0.92, 1.3, 0.92, 0, 0, 0, { t: 'machine', c: 0x5a6a7a });
    v.box(0.2, 0.5, 0.2, 0.25, 1.3, 0.2, { t: 'metal', c: 0x6a6a6a });
    v.box(0.92, 0.12, 0.92, 0, 0, 0, { t: 'hazard', c: 0 });
  },
  cauldron(v, ctx) {
    v.box(0.9, 0.9, 0.9, 0, 0.1, 0, { c: 0x26222a });
    v.box(0.7, 0.06, 0.7, 0, 0.95, 0, { c: 0x60ff90, e: 0x40ff80, ei: 1.4 });
    v.box(0.5, 0.12, 0.5, 0, 0, 0, { c: 0xff8030, e: 0xff6010, ei: 1.5 });
    v.box(0.15, 0.4, 0.15, 0.3, 1.0, 0.2, { c: 0x60ff90, o: 0.35, basic: true });
  },
  vat(v) { v.box(0.9, 1.4, 0.9, 0, 0, 0, { t: 'metal', c: 0x8a8a90 }); },
  hedge(v) {
    v.box(0.96, 1.3, 0.96, 0, 0, 0, { t: 'leaves', c: 0x3a6a30 });
    v.box(0.8, 0.12, 0.8, 0, 1.3, 0, { t: 'leaves', c: 0x4a7a38 });
  },
  tree(v, ctx) {
    const c = ctx.k.legacy ? ctx.k.legacy.full : 0x3a6a2a;
    v.box(0.24, 0.9, 0.24, 0, 0, 0, { t: 'bark', c: 0x5a3e28 });
    v.box(0.95, 0.6, 0.95, 0, 0.8, 0, { t: 'leaves', c });
    v.box(0.7, 0.45, 0.7, 0, 1.4, 0, { t: 'leaves', c });
    v.box(0.4, 0.3, 0.4, 0, 1.85, 0, { t: 'leaves', c });
  },
  fountain(v) {
    v.box(1, 0.5, 1, 0, 0, 0, { t: 'stone', c: 0xb0aaa0 });
    v.box(0.84, 0.04, 0.84, 0, 0.47, 0, { c: 0x4a8ac0, r: 0.2 });
    v.box(0.24, 1.1, 0.24, 0, 0.5, 0, { t: 'stone', c: 0xc0bab0 });
    v.box(0.5, 0.1, 0.5, 0, 1.3, 0, { t: 'stone', c: 0xc0bab0 });
  },
  // ----- 半掩體 -----
  crate(v) {
    v.box(0.72, 0.62, 0.72, 0, 0, 0, { t: 'crate', c: 0xa07a48 }, rnd(-0.2, 0.2));
    if (Math.random() < 0.3) v.box(0.4, 0.3, 0.4, rnd(-0.1, 0.1), 0.62, 0, { t: 'crate', c: 0xa07a48 }, rnd(0, 1));
  },
  rubble(v, ctx) {
    const [wt, wc] = ctx.k.wall;
    for (let i = 0; i < 4; i++) v.box(rnd(0.3, 0.5), rnd(0.2, 0.55), rnd(0.3, 0.5), rnd(-0.25, 0.25), 0, rnd(-0.25, 0.25), { t: wt, c: wc }, rnd(0, 1));
  },
  counter(v) { v.box(0.95, 0.6, 0.55, 0, 0, 0, WOOD).box(1, 0.06, 0.6, 0, 0.6, 0, { c: 0x5a3a22 }); },
  stall(v, ctx) {
    v.box(0.9, 0.55, 0.62, 0, 0, 0, WOOD);
    v.box(0.86, 0.12, 0.58, 0, 0.55, 0, { t: 'goods', c: 0 });
    for (const [x, z] of [[-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28]]) v.box(0.05, 1.15, 0.05, x, 0, z, DARK);
    v.box(1.02, 0.06, 0.8, 0, 1.15, 0, { t: 'awning', c: pickR([ctx.k.accent, 0x3a9a5a, 0x3a6ac0, 0xe08a20]) });
    if (!ctx.day && Math.random() < 0.6) v.box(0.14, 0.18, 0.14, 0.3, 0.95, 0.3, { t: 'lantern', c: 0xff5030, e: 0xffffff, ei: 1.3 });
  },
  scooter(v) {
    const c = pickR([0xe04040, 0x40a0e0, 0xf0f0f0, 0x60c060, 0xf0c030]);
    v.box(0.28, 0.12, 0.85, 0, 0.12, 0, DARK);
    v.box(0.26, 0.32, 0.5, 0, 0.2, -0.08, { c, r: 0.5 });
    v.box(0.22, 0.12, 0.3, 0, 0.52, -0.1, { c: 0x1a1a1a });
    v.box(0.08, 0.45, 0.08, 0, 0.2, 0.34, DARK).box(0.4, 0.04, 0.04, 0, 0.62, 0.34, DARK);
    v.box(0.08, 0.24, 0.24, 0, 0, 0.34, DARK).box(0.08, 0.24, 0.24, 0, 0, -0.34, DARK);
  },
  bin(v) { v.box(0.5, 0.62, 0.5, 0, 0, 0, { t: 'metal', c: 0x3a6a3a }).box(0.54, 0.06, 0.54, 0, 0.62, 0, { c: 0x2a4a2a }); },
  cart(v) { v.box(0.7, 0.4, 0.5, 0, 0.18, 0, METAL).box(0.6, 0.25, 0.4, 0, 0.58, 0, { t: 'crate', c: 0xa07a48 }).box(0.08, 0.18, 0.5, 0.25, 0, 0, DARK).box(0.08, 0.18, 0.5, -0.25, 0, 0, DARK); },
  pallet(v) {
    v.box(0.9, 0.14, 0.9, 0, 0, 0, { t: 'planks', c: 0xb08a58 });
    v.box(0.7, 0.45, 0.7, 0, 0.14, 0, { t: 'crate', c: 0x9a7a50 }, rnd(-0.15, 0.15));
  },
  barrel(v) {
    for (const [x, z] of [[-0.18, -0.15], [0.2, 0.12]]) {
      const c = pickR([0x2a5a9a, 0xb03a2e, 0x4a6a3a, 0xc08020]);
      v.box(0.36, 0.62, 0.36, x, 0, z, { t: 'metal', c });
      v.box(0.38, 0.05, 0.38, x, 0.3, z, { c: 0x2a2a2a });
    }
  },
  platform(v) {
    v.box(1, 0.6, 1, 0, 0, 0, { t: 'concrete', c: 0x9a9690 });
    v.box(1, 0.04, 0.2, 0, 0.6, 0.4, { c: 0xe8c020 });
  },
  bench(v) {
    v.box(0.9, 0.08, 0.4, 0, 0.38, 0, WOOD);
    v.box(0.9, 0.35, 0.08, 0, 0.42, -0.18, WOOD);
    v.box(0.08, 0.38, 0.36, -0.38, 0, 0, DARK).box(0.08, 0.38, 0.36, 0.38, 0, 0, DARK);
  },
  car(v, ctx) {
    const c = pickR(CAR_COLORS);
    const along = ctx.open(1, 0) || ctx.open(-1, 0) ? 0 : Math.PI / 2;
    v.box(0.95, 0.4, 0.62, 0, 0.12, 0, { t: 'carbody', c }, along);
    v.box(0.55, 0.25, 0.56, 0.05, 0.52, 0, { t: 'glass', c: 0 }, along);
    v.box(0.95, 0.12, 0.66, 0, 0, 0, DARK, along);
  },
  table(v) {
    v.box(0.95, 0.12, 0.7, 0, 0.45, 0, { c: 0x1a6a3a, r: 1 });
    v.box(1, 0.06, 0.75, 0, 0.57, 0, { c: 0x5a3018 });
    v.box(0.7, 0.45, 0.4, 0, 0, 0, { c: 0x4a2a18 });
  },
  seat(v) {
    for (const x of [-0.3, 0, 0.3]) {
      v.box(0.26, 0.3, 0.3, x, 0.12, 0, { c: 0x8a1a2a });
      v.box(0.26, 0.38, 0.08, x, 0.32, -0.15, { c: 0x8a1a2a });
    }
    v.box(0.9, 0.12, 0.36, 0, 0, 0, DARK);
  },
  ropes(v) {
    v.box(0.1, 0.75, 0.1, 0, 0, 0, { c: 0xd0d0d0 });
    for (const y of [0.3, 0.55]) v.box(1, 0.04, 0.04, 0, y, 0, { c: 0xc02020 }).box(0.04, 0.04, 1, 0, y, 0, { c: 0xc02020 });
    v.box(1, 0.18, 1, 0, 0, 0, { t: 'planks', c: 0x4a5a8a });
  },
  cash(v) {
    v.box(0.8, 0.35, 0.6, 0, 0, 0, METAL);
    for (let i = 0; i < 4; i++) v.box(0.22, 0.1, 0.12, rnd(-0.25, 0.25), 0.35 + i * 0.07, rnd(-0.15, 0.15), { c: 0xf0c040, e: 0x604000, ei: 1, r: 0.3 });
  },
  partition(v) {
    v.box(1, 0.08, 0.1, 0, 0, 0, METAL).box(1, 0.06, 0.1, 0, 1.0, 0, METAL);
    v.box(0.96, 0.92, 0.04, 0, 0.08, 0, { c: 0xa8d0e8, o: 0.3 });
  },
  desk(v, ctx) {
    v.box(0.9, 0.08, 0.6, 0, 0.5, 0, { t: 'planks', c: 0x8a6a48 });
    v.box(0.85, 0.5, 0.1, 0, 0, -0.22, { t: 'planks', c: 0x7a5a3a });
    v.box(0.3, 0.22, 0.04, 0.15, 0.6, -0.1, ctx.day ? { c: 0x223040 } : { c: 0x80c0ff, e: 0x60a0ff, ei: 0.9 });
    v.box(0.32, 0.4, 0.32, -0.25, 0, 0.1, { c: 0x2a2a2e });
  },
  shelf(v, ctx) {
    const t = ctx.k.label === '工坊' ? 'goods' : 'books';
    v.box(0.92, 0.85, 0.42, 0, 0, 0, { t, c: 0 });
  },
  grave(v) {
    v.box(0.46, 0.7, 0.16, 0, 0.08, 0, { t: 'grave', c: 0x8a8890 });
    v.box(0.6, 0.08, 0.5, 0, 0, 0.1, { t: 'stone', c: 0x6a6870 });
  },
  flowerbed(v) {
    v.box(0.9, 0.4, 0.9, 0, 0, 0, { t: 'stone', c: 0x8a7a6a });
    v.box(0.8, 0.12, 0.8, 0, 0.4, 0, { t: 'grass', c: 0x3a6a2a });
    for (let i = 0; i < 5; i++) v.box(0.1, 0.1, 0.1, rnd(-0.3, 0.3), 0.52, rnd(-0.3, 0.3), { c: pickR([0xff6080, 0xffd040, 0xffffff, 0xc060ff]) });
  },
  statue(v) {
    v.box(0.7, 0.4, 0.7, 0, 0, 0, { t: 'stone', c: 0x9a9490 });
    v.box(0.3, 0.5, 0.25, 0, 0.4, 0, { t: 'stone', c: 0xb0aaa4 }).box(0.24, 0.24, 0.24, 0, 0.9, 0, { t: 'stone', c: 0xb0aaa4 });
  },
  doghouse(v) {
    v.box(0.7, 0.5, 0.7, 0, 0, 0, { t: 'planks', c: 0xa0582a });
    v.box(0.8, 0.12, 0.8, 0, 0.5, 0, { c: 0x6a2a1a });
    v.box(0.26, 0.3, 0.02, 0, 0.02, 0.36, DARK);
  },
  tire(v) { for (let i = 0; i < 3; i++) v.box(0.6, 0.18, 0.6, rnd(-0.05, 0.05), i * 0.19, rnd(-0.05, 0.05), { c: 0x1e1e20 }); },
  sandbag(v, ctx) { v.box(0.92, 0.55, 0.6, 0, 0, 0, { t: 'sandbag', c: ctx.k.legacy ? ctx.k.legacy.half : 0x9a8a60 }); },
  rock(v, ctx) {
    const c = ctx.k.legacy ? ctx.k.legacy.half : 0x7a7670;
    v.box(0.7, 0.45, 0.6, 0, 0, 0, { t: 'stone', c }, rnd(0, 1)).box(0.4, 0.25, 0.4, 0.1, 0.4, 0, { t: 'stone', c }, rnd(0, 1));
  },
};

// 單一格的模型（沒有掩體就回傳 null）
export function cellMesh(theme, map, x, z) {
  const t = map.get(x, z);
  if (t === T.FLOOR) return null;
  const k = theme.k;
  let tag = map.tagAt(x, z) || (t === T.FULL ? k.full : k.half);
  // 全掩體格標成半掩體的樣子（或反過來）時，用場景組的預設，避免「長椅擋住整格」
  const fullTags = ['wall', 'bldg', 'shop', 'station', 'warehouse', 'vault', 'manor', 'church', 'tower', 'pillar', 'kiosk', 'container', 'carpile', 'kennel', 'train', 'slot', 'rack', 'machine', 'cauldron', 'vat', 'hedge', 'tree', 'fountain'];
  if ((t === T.FULL) !== fullTags.includes(tag)) tag = t === T.FULL ? k.full : k.half;
  const open = (dx, dz) => map.inB(x + dx, z + dz) && map.get(x + dx, z + dz) === T.FLOOR;
  const v = Vox();
  (PROPS[tag] || PROPS.crate)(v, { k, day: theme.day && !k.indoor, open, accent: k.accent });
  const g = v.out();
  g.position.set(x, 0, z);
  return g;
}

// ---------- 整張地圖 ----------
// 燈光：白天照舊；晚上天空變暗、月光偏藍，再加幾盞點光源（燈籠、路燈、探照燈……）
export function applyLighting(scene, hemi, sun, theme) {
  const k = theme.k, day = theme.day && !k.indoor;
  const sky = day ? k.skyDay : k.sky;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, day ? 30 : 24, day ? 64 : 52);
  if (day) {
    hemi.color.set(0xd6e6ff); hemi.groundColor.set(0x3a3025); hemi.intensity = 1.1;
    sun.color.set(0xfff0d8); sun.intensity = 2.4;
  } else if (k.indoor) {
    hemi.color.set(0xc8d0e0); hemi.groundColor.set(0x302820); hemi.intensity = theme.day ? 0.9 : 0.6;
    sun.color.set(0xfff4e0); sun.intensity = theme.day ? 1.4 : 0.9;
  } else {
    hemi.color.set(0x8a9ac8); hemi.groundColor.set(0x2a2228); hemi.intensity = 0.8;
    sun.color.set(0xa8c0ff); sun.intensity = 1.1;
  }
}

export function buildSite(world, S) {
  const { map, theme } = S;
  const k = theme.k, { w, h } = map;
  const day = theme.day && !k.indoor;
  const cx = (w - 1) / 2, cz = (h - 1) / 2;
  const tint = day ? 1 : 0.85;

  // 地面：三種地面各一個 InstancedMesh，貼圖照場景組
  const floorGeo = boxGeo(0.98, 0.1, 0.98);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let f = 0; f < 3; f++) {
    const cells = [];
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (map.floorAt(x, z) === f) cells.push([x, z]);
    if (!cells.length) continue;
    const [ft, fc] = k.floors[f];
    const im = new THREE.InstancedMesh(floorGeo, mat({ t: ft, c: fc }), cells.length);
    im.receiveShadow = true; im.frustumCulled = false;
    cells.forEach(([x, z], i) => {
      im.setMatrixAt(i, m4.makeTranslation(x, -0.05, z));
      c.setScalar(tint * (0.92 + Math.random() * 0.12));
      if (map.isConceal(x, z)) c.multiplyScalar(k.conceal.style === 'dark' ? 0.45 : 0.75);
      im.setColorAt(i, c);
    });
    world.add(im);
  }
  // 地圖外的地面
  // 室內：牆外是一片暗，不鋪地毯；室外：主要地面往外延伸
  const [gt, gc] = k.backdrop === 'indoor' ? ['concrete', 0x202022] : k.floors[0];
  const gtex = tex(gt, gc).clone(); gtex.repeat.set(w + 40, h + 40); gtex.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, h + 40),
    new THREE.MeshStandardMaterial({ map: gtex, color: new THREE.Color(0xffffff).multiplyScalar(0.6), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.1, cz); ground.receiveShadow = true;
  world.add(ground);

  // 掩體
  S.cellMesh = new Map();
  const obj = S.mission && S.mission.objective;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    if (obj && obj.x === x && obj.z === z) continue; // 終端機自己有模型
    const m = cellMesh(theme, map, x, z);
    if (m) { world.add(m); S.cellMesh.set(x + ',' + z, m); }
  }

  concealDecor(world, S);
  backdrop(world, S);
  lights(world, S);
}

// 隱蔽區的樣子
function concealDecor(world, S) {
  const { map, theme } = S, k = theme.k, st = k.conceal.style;
  const v = Vox();
  for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
    if (!map.isConceal(x, z)) continue;
    if (st === 'grass') {
      for (let i = 0; i < 6; i++) { const hh = rnd(0.35, 0.7); v.box(0.08, hh, 0.08, x + rnd(-0.4, 0.4), 0, z + rnd(-0.4, 0.4), { t: 'leaves', c: k.conceal.color }); }
    } else if (st === 'junk') {
      for (let i = 0; i < 3; i++) v.box(rnd(0.2, 0.32), rnd(0.15, 0.3), rnd(0.2, 0.32), x + rnd(-0.35, 0.35), 0, z + rnd(-0.35, 0.35), pickR([{ c: 0x1e2a22 }, { c: 0x1a1a1e }, { t: 'crate', c: 0x9a7a50 }]), rnd(0, 1));
    } else if (st === 'laundry') {
      if ((x + z) % 2 === 0) {
        v.box(0.05, 1.5, 0.05, x - 0.45, 0, z, DARK).box(0.9, 0.03, 0.03, x, 1.48, z, DARK);
        v.box(0.35, 0.4, 0.02, x + rnd(-0.2, 0.2), 1.05, z, { c: pickR([0xe8e8f0, 0x6a9ad0, 0xd06a7a, 0xe8c860]) });
      }
    } else if (st === 'tarp') {
      if ((x + z) % 2 === 0) v.box(0.9, 0.04, 0.9, x, 1.5, z, { c: k.conceal.color }).box(0.04, 0.7, 0.9, x + 0.45, 0.8, z, { c: k.conceal.color });
    } else { // dark：暗處，一點點電線和水漥
      if (Math.random() < 0.4) v.box(0.3, 0.02, 0.4, x + rnd(-0.3, 0.3), 0.01, z + rnd(-0.3, 0.3), { c: 0x10141a, r: 0.1 });
      if (Math.random() < 0.3) v.box(0.03, 0.03, 0.9, x + rnd(-0.4, 0.4), 0.02, z, { c: 0x111111 });
    }
  }
  world.add(v.out(false));
}

// 地圖外的景：讓地圖不是浮在一片空地上。遠的那一邊（z<0）和左右兩邊可以高，近的那一邊（z>h）放矮的，不擋鏡頭
function backdrop(world, S) {
  const { map, theme } = S, k = theme.k, { w, h } = map;
  const day = theme.day && !k.indoor;
  const v = Vox();
  const [wt, wc] = k.wall;
  const win = day ? { t: 'dayWindow', c: wc } : { t: 'window', c: wc, e: 0xffffff, ei: 0.7 };
  const ring = (fn, gap = 1) => {
    for (let x = -3; x < w + 3; x += gap) { fn(x, -2, 'far'); fn(x, h + 1, 'near'); }
    for (let z = -1; z < h + 1; z += gap) { fn(-2, z, 'side'); fn(w + 1, z, 'side'); }
  };
  if (k.backdrop === 'city') {
    // 遠處的建築：一棟一棟高低不同，牆上有窗；近的一邊是矮圍牆和停著的機車
    for (let x = -4; x < w + 4; x += 2) {
      const hh = rnd(2.5, 5);
      v.box(2, hh, 2, x + 0.5, 0, -3, { t: wt, c: wc });
      for (let y = 0.6; y < hh - 0.5; y += 1) v.box(0.7, 0.55, 0.04, x + 0.5 + rnd(-0.4, 0.4), y, -1.98, win);
      if (!day && Math.random() < 0.35) v.box(0.9, 0.5, 0.06, x + 0.5, hh - 0.9, -1.95, { t: 'sign', c: pickR([k.accent, 0x40e0ff, 0xff60c0]), e: 0xffffff, ei: 1 });
    }
    for (const sx of [-3, w + 2]) for (let z = -1; z < h + 1; z += 2) {
      const hh = rnd(2, 3.5);
      v.box(2, hh, 2, sx, 0, z + 0.5, { t: wt, c: wc });
      for (let y = 0.6; y < hh - 0.5; y += 1) v.box(0.04, 0.55, 0.7, sx + (sx < 0 ? 1.02 : -1.02), y, z + 0.5, win);
    }
    for (let x = -1; x < w + 1; x++) v.box(1, 0.5, 0.3, x, 0, h + 0.8, { t: 'concrete', c: 0x8a8a88 });
  } else if (k.backdrop === 'harbor') {
    // 遠的一邊是海、碼頭邊和吊車；兩側是一疊疊貨櫃
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, 16), new THREE.MeshStandardMaterial({ color: day ? 0x2a5a7a : 0x0a1a2a, roughness: 0.25, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set((w - 1) / 2, -0.06, -10); world.add(sea);
    for (let x = -3; x < w + 3; x++) v.box(1, 0.3, 0.4, x, -0.1, -1.7, { t: 'hazard', c: 0 });
    for (const x of [Math.floor(w * 0.25), Math.floor(w * 0.7)]) {
      for (const dx of [-1, 1]) v.box(0.25, 6, 0.25, x + dx, 0, -3, { c: 0xd08a20 });
      v.box(4.5, 0.4, 0.5, x + 0.8, 6, -3, { c: 0xd08a20 }).box(0.06, 2.5, 0.06, x + 2.5, 3.5, -3, DARK);
      v.box(1, 1, 1, x + 2.5, 2.5, -3, { t: 'container', c: pickR(CONTAINER_COLORS) });
    }
    for (const sx of [-2.5, w + 1.5]) for (let z = -1; z < h + 1; z++) for (let y = 0; y < (Math.random() < 0.5 ? 2 : 1); y++) v.box(1, 1.4, 1, sx, y * 1.45, z, { t: 'container', c: pickR(CONTAINER_COLORS) });
    for (let x = -1; x < w + 1; x++) v.box(1, 0.6, 0.15, x, 0, h + 0.8, { t: 'metal', c: 0x6a6e72 });
  } else if (k.backdrop === 'rail') {
    for (let x = -3; x < w + 3; x++) {
      v.box(1, 1.2, 0.1, x, 0, -1.6, { t: 'metal', c: 0x5a6068 });
      if (x % 5 === 0) { const hh = rnd(2.5, 4.5); v.box(3, hh, 2, x, 0, -4, { t: 'brick', c: 0x7a5040 }); v.box(0.8, 0.6, 0.04, x, hh - 1.2, -2.98, win); }
    }
    for (const sx of [-2, w + 1]) for (let z = -1; z < h + 1; z++) v.box(0.1, 1.2, 1, sx, 0, z, { t: 'metal', c: 0x5a6068 });
    for (let x = -1; x < w + 1; x++) v.box(1, 0.5, 0.15, x, 0, h + 0.8, { t: 'metal', c: 0x5a6068 });
  } else if (k.backdrop === 'indoor') {
    // 室內：四面牆，遠的一邊高、近的一邊矮；牆上偶爾有門、管線
    for (let x = -1; x < w + 1; x++) {
      v.box(1, 2.6, 0.5, x, 0, -1.25, { t: wt, c: wc });
      if (Math.random() < 0.15) v.box(0.7, 1.2, 0.04, x, 0, -0.99, { t: 'shutter', c: 0x6a7078 });
      v.box(1, 0.5, 0.5, x, 0, h + 0.25, { t: wt, c: wc });
    }
    for (const sx of [-1.25, w + 0.25]) for (let z = -1; z < h + 1; z++) v.box(0.5, 2.0, 1, sx, 0, z, { t: wt, c: wc });
    v.box(w + 2, 0.12, 0.12, (w - 1) / 2, 2.3, -0.9, { t: 'metal', c: 0x6a6e72 });
  } else if (k.backdrop === 'estate') {
    // 石牆加樹林
    for (let x = -2; x < w + 2; x++) { v.box(1, 1.1, 0.4, x, 0, -1.3, { t: 'stone', c: 0x8a8480 }); v.box(1, 0.5, 0.3, x, 0, h + 0.8, { t: 'stone', c: 0x8a8480 }); }
    for (const sx of [-1.8, w + 0.8]) for (let z = -1; z < h + 1; z++) v.box(0.4, 1.1, 1, sx, 0, z, { t: 'stone', c: 0x8a8480 });
    for (let i = 0; i < w + 8; i++) {
      const x = rnd(-4, w + 4), z = rnd(-6, -2.5), s = rnd(0.8, 1.4);
      v.box(0.3, 1.2 * s, 0.3, x, 0, z, { t: 'bark', c: 0x4a3420 }).box(1.2 * s, 1.2 * s, 1.2 * s, x, 1.1 * s, z, { t: 'leaves', c: 0x2a4a24 });
    }
  } else { // field：零星的樹和石頭
    for (let i = 0; i < 14; i++) {
      const side = Math.random() < 0.5, x = side ? pickR([-3, w + 2]) + rnd(-1, 1) : rnd(-2, w + 2), z = side ? rnd(-2, h + 1) : -3 + rnd(-1, 0.5);
      v.box(0.6, rnd(0.3, 0.8), 0.6, x, 0, z, { t: 'stone', c: 0x6a6660 });
    }
  }
  world.add(v.out(true));
}

// 燈：晚上（或室內）放幾盞點光源，加上看得到的燈具。手機效能：點光源最多 6 盞、不投影
function lights(world, S) {
  const { map, theme } = S, k = theme.k, { w, h } = map;
  const day = theme.day && !k.indoor;
  if (!k.lights) return;
  const v = Vox();
  const pts = [];
  const add = (x, y, z, color, intensity, dist) => pts.push({ x, y, z, color, intensity, dist });
  const style = k.lights;
  if (style === 'lantern') {
    // 燈籠串：橫越街道的兩三條線，每隔一格一顆燈籠
    for (let i = 0; i < 3; i++) {
      const x0 = Math.round(rnd(4, w - 2));
      for (let z = 0; z < h; z += 1) if (z % 2 === 0) v.box(0.2, 0.26, 0.2, x0, 1.9, z, day ? { t: 'lantern', c: 0xd04020 } : { t: 'lantern', c: 0xff5030, e: 0xffffff, ei: 1.4 });
      v.box(0.02, 0.02, h, x0, 2.16, (h - 1) / 2, DARK);
      add(x0, 2.2, h / 2, 0xff8040, 14, 9);
    }
    add(w * 0.2, 2.5, h * 0.5, 0xffa060, 10, 10);
  } else if (style === 'streetlamp' || style === 'flood') {
    const flood = style === 'flood';
    const spots = flood ? [[-1.5, -1.5], [w + 0.5, -1.5], [w / 2, -1.5], [-1.5, h + 0.5]] : [[w * 0.25, -1.2], [w * 0.6, -1.2], [w * 0.9, h + 0.3], [-1.2, h * 0.5], [w + 0.2, h * 0.4]];
    for (const [x, z] of spots) {
      const H = flood ? 4.5 : 2.6;
      v.box(0.12, H, 0.12, x, 0, z, DARK);
      v.box(flood ? 0.6 : 0.35, 0.15, flood ? 0.3 : 0.35, x, H, z, day ? { c: 0xddd8c8 } : { c: 0xfff0c0, e: 0xfff0c0, ei: 2 });
      add(x, H - 0.2, z + (z < 0 ? 1 : -1), flood ? 0xe8f0ff : 0xffd8a0, flood ? 40 : 18, flood ? 22 : 11);
    }
  } else if (style === 'ceiling' || style === 'neon') {
    // 天花板燈管：吊在 2.4 高
    for (let x = 3; x < w; x += 5) for (let z = 1; z < h; z += 5) {
      v.box(0.12, 0.06, 0.9, x, 2.4, z, { c: style === 'neon' ? pickR([0xff40a0, 0x40e0ff, 0xffd040]) : 0xe8f4ff, e: 0xffffff, ei: 1.8, basic: true });
      if (pts.length < 6) add(x, 2.2, z, style === 'neon' ? pickR([0xff60b0, 0x60d0ff, 0xffd060]) : 0xe0ecff, 14, 9);
    }
  } else if (style === 'candle') {
    const spots = [[w * 0.3, h * 0.3], [w * 0.7, h * 0.3], [w * 0.3, h * 0.75], [w * 0.75, h * 0.75], [w * 0.5, h * 0.5]];
    for (const [x, z] of spots) add(x, 2, z, k.accent === 0xb060ff ? 0xc080ff : 0xffb060, 10, 8);
  }
  world.add(v.out(false));
  if (day) return;
  for (const p of pts.slice(0, 6)) {
    const L = new THREE.PointLight(p.color, p.intensity, p.dist, 1.6);
    L.position.set(p.x, p.y, p.z);
    world.add(L);
  }
}
