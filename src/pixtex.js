// 像素貼圖：程式畫的 16×16 小圖（磚牆、鐵捲門、貨櫃、木箱、柏油、磁磚……），放大時不模糊，跟方塊人同一種風格。
// 每張用名字當亂數種子，所以每次畫出來都一樣。tex(名字, 主色) 會快取。
import * as THREE from 'three';

const cache = new Map();
const N = 16;

function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
// 顏色亮暗：k>1 亮、<1 暗
function shade(hex, k) {
  const r = Math.min(255, ((hex >> 16) & 255) * k), g = Math.min(255, ((hex >> 8) & 255) * k), b = Math.min(255, (hex & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// 每種貼圖：(畫筆, 亂數, 主色) → 在 16×16 上畫
const DRAW = {
  // 磚牆：錯縫的紅磚
  brick(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.6));
    for (let row = 0; row < 4; row++) for (let i = -1; i < 3; i++) {
      const x = i * 8 + (row % 2) * 4, y = row * 4;
      p.fill(x, y, 7, 3, shade(c, 0.85 + r() * 0.3));
      p.fill(x, y, 7, 1, shade(c, 1.15));
    }
  },
  // 灰泥牆：淡淡的斑點和裂縫
  plaster(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let i = 0; i < 22; i++) p.dot(r() * N, r() * N, shade(c, 0.85 + r() * 0.25));
    let x = r() * N, y = 0;
    for (; y < 8; y++) { p.dot(x, y, shade(c, 0.6)); x += r() < 0.5 ? -1 : 1; }
  },
  concrete(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let i = 0; i < 40; i++) p.dot(r() * N, r() * N, shade(c, 0.8 + r() * 0.35));
    p.fill(0, 15, N, 1, shade(c, 0.7));
  },
  // 鐵捲門：橫條紋
  shutter(p, r, c) {
    for (let y = 0; y < N; y++) p.fill(0, y, N, 1, shade(c, y % 2 ? 0.75 : 1.05));
    p.fill(0, 14, N, 2, shade(c, 0.5));
    for (let i = 0; i < 4; i++) p.dot(r() * N, r() * 13, shade(0x8a5a30, 1)); // 鏽
  },
  // 貨櫃：直條肋
  container(p, r, c) {
    for (let x = 0; x < N; x++) p.fill(x, 0, 1, N, shade(c, x % 3 === 0 ? 0.7 : x % 3 === 1 ? 1.1 : 0.95));
    p.fill(0, 0, N, 1, shade(c, 0.6)); p.fill(0, 15, N, 1, shade(c, 0.5));
    for (let i = 0; i < 5; i++) p.dot(r() * N, r() * N, shade(0x7a4a28, 1));
  },
  // 木箱：外框加斜撐
  crate(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.95));
    for (let y = 0; y < N; y += 4) p.fill(1, y + 3, 14, 1, shade(c, 0.75));
    p.fill(0, 0, N, 2, shade(c, 0.7)); p.fill(0, 14, N, 2, shade(c, 0.7));
    p.fill(0, 0, 2, N, shade(c, 0.7)); p.fill(14, 0, 2, N, shade(c, 0.7));
    for (let i = 2; i < 14; i++) p.dot(i, i, shade(c, 0.65)), p.dot(i + 1, i, shade(c, 0.8));
  },
  planks(p, r, c) {
    for (let x = 0; x < N; x += 4) {
      const k = 0.85 + r() * 0.3;
      p.fill(x, 0, 4, N, shade(c, k));
      p.fill(x, 0, 1, N, shade(c, 0.65));
      p.dot(x + 2, (r() * N) | 0, shade(c, 0.6));
    }
  },
  asphalt(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let i = 0; i < 60; i++) p.dot(r() * N, r() * N, shade(c, 0.75 + r() * 0.55));
  },
  // 人行道地磚
  pavers(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.7));
    for (let y = 0; y < N; y += 8) for (let x = 0; x < N; x += 8) p.fill(x + 1, y + 1, 7, 7, shade(c, 0.95 + r() * 0.15));
  },
  tiles(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.75));
    for (let y = 0; y < N; y += 4) for (let x = 0; x < N; x += 4) p.fill(x, y, 3, 3, shade(c, 0.95 + r() * 0.1));
  },
  // 賭場地毯：菱形花紋
  carpet(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d > 6 && d < 7.5) p.dot(x, y, shade(0xd8b040, 1));
      else if (d < 2) p.dot(x, y, shade(c, 1.4));
    }
  },
  woodfloor(p, r, c) {
    for (let y = 0; y < N; y += 4) {
      const off = (r() * N) | 0;
      p.fill(0, y, N, 4, shade(c, 0.9 + r() * 0.2));
      p.fill(0, y + 3, N, 1, shade(c, 0.65));
      p.fill(off, y, 1, 3, shade(c, 0.65));
    }
  },
  cobble(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.55));
    for (let i = 0; i < 14; i++) {
      const x = (r() * 14) | 0, y = (r() * 14) | 0;
      p.fill(x, y, 3, 3, shade(c, 0.9 + r() * 0.3));
    }
  },
  grass(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let i = 0; i < 50; i++) p.dot(r() * N, r() * N, shade(c, 0.75 + r() * 0.5));
  },
  gravel(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.85));
    for (let i = 0; i < 70; i++) p.dot(r() * N, r() * N, shade(c, 0.6 + r() * 0.7));
  },
  // 鐵軌：枕木加兩條軌道（沿 x 方向延伸）
  rail(p, r, c) {
    p.fill(0, 0, N, N, shade(0x6a6058, 1));
    for (let i = 0; i < 40; i++) p.dot(r() * N, r() * N, shade(0x6a6058, 0.7 + r() * 0.6));
    for (let x = 1; x < N; x += 5) p.fill(x, 1, 3, 14, shade(0x5a3e28, 0.9 + r() * 0.2));
    p.fill(0, 4, N, 1, shade(0xb0b4b8, 1)); p.fill(0, 11, N, 1, shade(0xb0b4b8, 1));
  },
  // 停車格：柏油加一條白線
  parking(p, r, c) {
    DRAW.asphalt(p, r, c);
    p.fill(0, 0, 1, N, '#d8d8d0');
  },
  metal(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.9));
    for (let y = 0; y < N; y += 4) for (let x = (y / 4 % 2) * 2; x < N; x += 4) p.fill(x, y, 2, 1, shade(c, 1.25));
  },
  hazard(p, r, c) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) p.dot(x, y, ((x + y) >> 2) % 2 ? '#e8c020' : '#222');
  },
  leaves(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.8));
    for (let i = 0; i < 70; i++) p.dot(r() * N, r() * N, shade(c, 0.6 + r() * 0.8));
  },
  bark(p, r, c) {
    for (let x = 0; x < N; x++) p.fill(x, 0, 1, N, shade(c, 0.8 + r() * 0.4));
  },
  stone(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.6));
    for (let row = 0; row < 2; row++) for (let i = -1; i < 2; i++) {
      const x = i * 8 + row * 4, y = row * 8;
      p.fill(x + 1, y + 1, 7, 7, shade(c, 0.9 + r() * 0.2));
    }
  },
  // 窗戶（亮燈／暗）：建築立面用
  window(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]]) {
      const lit = r() < 0.55;
      p.fill(x, y, 5, 5, lit ? (r() < 0.5 ? '#ffd890' : '#fff0c0') : '#1c2430');
      if (lit) p.fill(x, y, 5, 1, '#fff8e0');
    }
  },
  dayWindow(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]]) { p.fill(x, y, 5, 5, '#7fa8c8'); p.fill(x, y, 2, 2, '#d8ecff'); }
  },
  // 招牌：亮色底加幾個方塊「字」
  sign(p, r, c) {
    p.fill(0, 0, N, N, '#181018');
    p.fill(1, 3, 14, 10, shade(c, 0.4));
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 4;
      for (let k = 0; k < 6; k++) if (r() < 0.6) p.dot(x + ((r() * 3) | 0), 5 + ((r() * 6) | 0), shade(c, 1.4));
    }
  },
  // 燈籠紙
  lantern(p, r, c) {
    for (let y = 0; y < N; y++) p.fill(0, y, N, 1, shade(c, y % 4 === 0 ? 0.7 : 1.1));
    p.fill(0, 0, N, 2, '#2a1a10'); p.fill(0, 14, N, 2, '#2a1a10');
  },
  // 帆布：條紋遮雨棚
  awning(p, r, c) {
    for (let x = 0; x < N; x++) p.fill(x, 0, 1, N, (x >> 2) % 2 ? shade(c, 1) : '#f0ece0');
  },
  // 吃角子老虎的螢幕
  slot(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.6));
    p.fill(2, 3, 12, 6, '#111');
    for (let i = 0; i < 3; i++) p.fill(3 + i * 4, 4, 3, 4, ['#ff4060', '#ffd040', '#40e0ff'][((r() * 3) | 0)]);
    p.fill(2, 11, 12, 2, shade(c, 1.3));
  },
  // 貨架上的東西
  goods(p, r, c) {
    p.fill(0, 0, N, N, '#3a2a1a');
    for (let y = 0; y < N; y += 5) {
      p.fill(0, y + 4, N, 1, '#6a5030');
      for (let x = 0; x < N; x += 3) p.fill(x, y + 1, 2, 3, shade([0xc04040, 0x40a060, 0x4070c0, 0xd0b040, 0xa050c0][(r() * 5) | 0], 1));
    }
  },
  // 墓碑表面
  grave(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let i = 0; i < 20; i++) p.dot(r() * N, r() * N, shade(c, 0.8 + r() * 0.3));
    p.fill(7, 3, 2, 8, shade(c, 0.6)); p.fill(5, 5, 6, 2, shade(c, 0.6));
  },
  // 機器面板：燈號和格柵
  machine(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    for (let y = 9; y < 15; y += 2) p.fill(2, y, 12, 1, shade(c, 0.6));
    for (let i = 0; i < 3; i++) p.fill(2 + i * 4, 3, 2, 2, ['#40ff80', '#ff5040', '#ffd040'][i]);
  },
  // 書架、檔案櫃
  books(p, r, c) {
    p.fill(0, 0, N, N, '#3a2618');
    for (let y = 0; y < N; y += 8) {
      p.fill(0, y + 7, N, 1, '#5a3a22');
      for (let x = 0; x < N; x += 2) p.fill(x, y + 1 + ((r() * 2) | 0), 2, 6, shade([0x8a2a2a, 0x2a5a3a, 0x2a3a6a, 0x8a6a2a][(r() * 4) | 0], 0.9 + r() * 0.3));
    }
  },
  sandbag(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 0.7));
    for (let row = 0; row < 3; row++) for (let i = -1; i < 3; i++) p.fill(i * 7 + (row % 2) * 3, row * 5 + 1, 6, 4, shade(c, 0.95 + r() * 0.15));
  },
  // 汽車烤漆：上面一條窗
  carbody(p, r, c) {
    p.fill(0, 0, N, N, shade(c, 1));
    p.fill(0, 0, N, 2, shade(c, 1.25));
    p.fill(0, 13, N, 3, '#1a1a1a');
  },
  glass(p, r, c) {
    p.fill(0, 0, N, N, '#20303c');
    p.fill(2, 2, 3, 1, '#8ab0c8'); p.fill(2, 3, 1, 2, '#8ab0c8');
  },
};

export function tex(name, color = 0x888888) {
  const key = name + ':' + color;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const p = {
    fill(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); },
    dot(x, y, col) { g.fillStyle = col; g.fillRect(Math.floor(x), Math.floor(y), 1, 1); },
  };
  (DRAW[name] || DRAW.concrete)(p, rng(key), color);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}
export const TEX_NAMES = Object.keys(DRAW);
