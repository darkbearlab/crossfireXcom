// 手排的方塊模型（照 art/pixel/*.png 的像素圖排）。一格方塊 = 身高的 1/32
// 座標：x 左右（+x＝畫面右，角色的左手邊），y 往上（0＝腳底），z 前後（+z＝臉朝的方向）
// 調色盤每色可以是 'n' 一般、'g' 半透明、'e' 會發光
import * as THREE from 'three';

function builder() {
  const cells = new Map();
  const pal = [], pidx = new Map();
  const ci = (hex, m = 'n') => { const k = hex + m; if (!pidx.has(k)) { pidx.set(k, pal.length); pal.push({ c: hex, m }); } return pidx.get(k); };
  const set = (x, y, z, col, m) => cells.set(`${x},${y},${z}`, [x, y, z, ci(col, m)]);
  const B = {
    box(x0, x1, y0, y1, z0, z1, col, m) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, col, m); return B; },
    // 左右對稱：x0..x1 與 -x1..-x0
    sym(x0, x1, y0, y1, z0, z1, col, m) { B.box(x0, x1, y0, y1, z0, z1, col, m); B.box(-x1, -x0, y0, y1, z0, z1, col, m); return B; },
    dot(x, y, z, col, m) { set(x, y, z, col, m); return B; },
    clear(x0, x1, y0, y1, z0, z1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) cells.delete(`${x},${y},${z}`); return B; },
    // 一根尖刺：從 (x,y,z) 往 (dx,dy,dz) 方向長 n 格，越來越細
    spike(x, y, z, dx, dy, dz, n, col, w = 1) {
      for (let i = 0; i < n; i++) {
        const r = Math.max(0, Math.round(w * (1 - i / n)));
        const cx = Math.round(x + dx * i), cy = Math.round(y + dy * i), cz = Math.round(z + dz * i);
        B.box(cx - r, cx + r, cy, cy, cz - r, cz + r, col);
      }
      return B;
    },
    data(height = 32) {
      const vox = [];
      for (const v of cells.values()) vox.push(...v);
      return { height, palette: pal, vox };
    },
  };
  return B;
}

const SKIN = '#f6cdb0', SKIN_D = '#e0a888';

function akane() {
  const R = '#d8222c', R_D = '#a3151d', R_L = '#ff4a4a', HAIR = '#e5202a', HAIR_D = '#a8121c', BOOT = '#6e1a20', BOOT_L = '#9c2430', GOLD = '#e8b440';
  const v = builder();
  // 靴子（及膝）＋腳尖
  v.sym(1, 3, 0, 7, -1, 1, BOOT).sym(1, 3, 0, 1, 2, 2, BOOT).sym(1, 3, 7, 8, -1, 1, BOOT_L);
  // 腿
  v.sym(1, 2, 9, 11, -1, 0, SKIN);
  // 百褶短裙（往外散開，深淺交錯的褶）
  for (let x = -5; x <= 5; x++) v.box(x, x, 11, 12, -3, 3, x % 2 ? R : R_D);
  for (let x = -4; x <= 4; x++) v.box(x, x, 13, 14, -3, 3, x % 2 ? R : R_D);
  v.clear(-5, -5, 11, 12, -3, -3).clear(5, 5, 11, 12, -3, -3).clear(-5, -5, 11, 12, 3, 3).clear(5, 5, 11, 12, 3, 3);
  // 上衣（窄一點，頭才顯得大）、金色腰線
  v.box(-2, 2, 15, 15, -2, 1, GOLD).box(-2, 2, 16, 21, -2, 1, R).box(-2, 2, 21, 21, -2, 1, R_D);
  // 胸前發光的青色蝴蝶結
  v.box(-2, -1, 18, 19, 2, 2, '#4ff0f0', 'e').box(1, 2, 18, 19, 2, 2, '#4ff0f0', 'e').dot(0, 18, 2, '#c0ffff', 'e');
  // 背後的腰帶飄帶
  v.box(-2, -1, 6, 15, -3, -3, '#7a1420').box(1, 2, 5, 15, -3, -3, '#8a1824');
  // 手臂（無袖）＋雙槍
  v.sym(3, 3, 14, 21, -1, 0, SKIN).sym(3, 4, 12, 13, -1, 0, SKIN);
  v.sym(4, 4, 9, 12, 0, 2, '#2a2a32').sym(4, 4, 12, 12, 1, 3, '#3a3a44');
  // 脖子、金項圈
  v.box(-1, 1, 22, 22, -1, 0, GOLD);
  // 頭：比身體寬的大頭（Q 版）
  v.box(-4, 4, 23, 30, -3, 2, SKIN).box(-3, 3, 23, 23, -2, 2, SKIN_D);
  // 紅眼睛（2×3，有亮點）
  v.box(-3, -2, 25, 27, 3, 3, '#c01018').box(2, 3, 25, 27, 3, 3, '#c01018').dot(-2, 27, 3, '#ffffff').dot(3, 27, 3, '#ffffff');
  v.box(-1, 1, 24, 27, 3, 3, SKIN).box(-4, 4, 23, 24, 3, 3, SKIN).dot(0, 24, 3, '#e87070');
  // 頭髮：頭頂、後腦、側邊，加上鋸齒狀的瀏海
  v.box(-5, 5, 30, 33, -4, 3, HAIR).box(-5, 5, 22, 33, -4, -4, HAIR).sym(5, 5, 22, 32, -4, 2, HAIR);
  for (let x = -4; x <= 4; x++) v.box(x, x, 28 + (x + 5) % 2, 30, 4, 4, x % 2 ? HAIR : HAIR_D);
  v.dot(-4, 27, 4, HAIR).dot(4, 27, 4, HAIR).dot(0, 27, 4, HAIR_D);
  // 翹起的鬢角（刺刺的）
  v.spike(6, 27, 0, 1, -0.5, 0, 4, HAIR).spike(-6, 27, 0, -1, -0.5, 0, 4, HAIR);
  v.spike(6, 24, -1, 1, -0.3, 0, 3, HAIR_D).spike(-6, 24, -1, -1, -0.3, 0, 3, HAIR_D);
  // 高馬尾：髮圈＋三根往上往後的大尖刺
  v.box(-1, 1, 34, 34, -2, 0, '#5a0a14');
  v.spike(0, 35, -2, 0, 1, -0.55, 9, HAIR, 1.4).spike(0, 34, -3, 0.55, 0.55, -0.85, 7, HAIR_D, 1).spike(0, 34, -3, -0.55, 0.55, -0.85, 7, HAIR_D, 1);
  v.spike(0, 33, -4, 0, -0.1, -1, 6, HAIR, 1);
  return v.data(32);
}

function hikari() {
  const W = '#f6f2f8', W_D = '#d8d0e0', P = '#f27aa6', P_L = '#ffb6d0', HAIR = '#f6a8c6', HAIR_D = '#e486ac', GOLD = '#e8c060';
  const v = builder();
  // 白色長靴（頂端粉紅、金色寶石）
  v.sym(1, 3, 0, 8, -1, 1, W).sym(1, 3, 0, 1, 2, 2, W).sym(1, 3, 0, 0, -1, 2, P).sym(1, 3, 9, 9, -1, 1, P).sym(2, 2, 8, 8, 2, 2, GOLD);
  // 過膝襪
  v.sym(1, 2, 10, 12, -1, 0, W).sym(1, 2, 12, 12, -1, 0, P_L);
  // 白色多層裙＋粉紅裙邊
  v.box(-5, 5, 12, 12, -3, 3, P).box(-5, 5, 13, 15, -3, 3, W).box(-4, 4, 16, 16, -2, 2, W_D);
  v.clear(-5, -5, 12, 15, -3, -3).clear(5, 5, 12, 15, -3, -3).clear(-5, -5, 12, 15, 3, 3).clear(5, 5, 12, 15, 3, 3);
  // 半透明的淡紫外層裙擺（兩側、後面垂下來）
  v.sym(6, 6, 8, 15, -3, 2, '#d6c4f4', 'g').box(-6, 6, 8, 15, -4, -4, '#d6c4f4', 'g');
  // 上衣（窄一點）
  v.box(-2, 2, 17, 21, -2, 1, W);
  // 胸前大蝴蝶結（中間發光）
  v.box(-3, -1, 18, 21, 2, 2, P).box(1, 3, 18, 21, 2, 2, P).box(-2, -2, 19, 20, 2, 2, P_L).box(2, 2, 19, 20, 2, 2, P_L);
  v.box(0, 0, 19, 20, 2, 2, '#ffe0f0', 'e').box(-1, 1, 16, 17, 2, 2, P);
  // 背後的蝴蝶結
  v.box(-3, 3, 14, 16, -5, -5, P).box(-1, 1, 15, 15, -6, -6, GOLD);
  // 泡泡袖、白手套（金邊）
  v.sym(3, 4, 19, 21, -2, 1, W).sym(3, 3, 13, 18, -1, 0, W).sym(3, 3, 18, 18, -1, 0, GOLD);
  // 突擊步槍：白色槍身、粉紅槍口和彈匣，斜抱在胸前
  for (let i = 0; i <= 10; i++) { const x = -4 + i, y = 15 - Math.round(i * 0.3); v.box(x, x, y, y + 1, 3, 3, i > 8 ? P : W); }
  v.box(0, 1, 11, 13, 3, 3, P).box(-5, -4, 15, 17, 3, 3, W_D);
  // 脖子
  v.box(-1, 1, 22, 22, -1, 0, W_D);
  // 大頭：臉、粉紅眼睛
  v.box(-4, 4, 23, 30, -3, 2, SKIN).box(-3, 3, 23, 23, -2, 2, SKIN_D);
  v.box(-3, -2, 25, 27, 3, 3, '#e0457e').box(2, 3, 25, 27, 3, 3, '#e0457e').dot(-2, 27, 3, '#ffffff').dot(3, 27, 3, '#ffffff');
  v.box(-1, 1, 24, 27, 3, 3, SKIN).box(-4, 4, 23, 24, 3, 3, SKIN).dot(0, 24, 3, '#f08098');
  // 頭髮：頭頂、整齊的瀏海、兩側垂到胸前、後面長到腰下
  v.box(-5, 5, 30, 33, -4, 3, HAIR).box(-4, 4, 28, 30, 4, 4, HAIR).dot(-4, 27, 4, HAIR_D).dot(4, 27, 4, HAIR_D).dot(0, 27, 4, HAIR_D);
  v.sym(5, 5, 12, 32, -3, 2, HAIR).sym(4, 4, 12, 22, 1, 2, HAIR_D);
  v.box(-5, 5, 8, 33, -5, -4, HAIR);
  for (let x = -5; x <= 5; x += 2) v.box(x, x, 8, 26, -6, -6, HAIR_D);
  v.box(-4, 4, 6, 7, -5, -4, HAIR).box(-2, 2, 5, 5, -5, -4, HAIR);
  // 白色髮飾花（黃色花心）
  for (const sd of [-1, 1]) v.box(6 * sd, 6 * sd, 29, 31, 0, 2, '#ffffff').box(5 * sd, 5 * sd, 30, 30, 3, 3, '#ffffff').dot(7 * sd, 30, 1, '#ffd060', 'e');
  return v.data(32);
}

export const HAND_MODELS = { akane, hikari };

export function handVoxelMesh(id, height = 1.35) {
  const data = HAND_MODELS[id]();
  const s = height / data.height;
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(s, s, s);
  const mats = {
    n: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    g: new THREE.MeshStandardMaterial({ roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false }),
    e: new THREE.MeshBasicMaterial(), // 發光：不吃光影，顏色全亮
  };
  for (const kind of ['n', 'g', 'e']) {
    const list = [];
    for (let i = 0; i < data.vox.length; i += 4) if (data.palette[data.vox[i + 3]].m === kind) list.push(i);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geo, mats[kind], list.length);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach((i, n) => {
      const [x, y, z, ci] = data.vox.slice(i, i + 4);
      m.makeTranslation(x * s, (y + 0.5) * s, z * s);
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, c.set(data.palette[ci].c));
    });
    if (kind === 'g') mesh.castShadow = false;
    g.add(mesh);
  }
  return g;
}
