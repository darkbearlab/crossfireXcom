// 可動的方塊角色：部位拆開、樞紐在關節、程式算的動作、換方塊排列的表情和嘴形
// 角色資料放在 src/rigs/<id>.js（格式見 docs/voxel-rig.md），這裡是所有角色共用的程式
//
// 座標（跟 voxel-models.js 一樣）：一格方塊 = 身高的 1/unit
//   x 左右（+x＝角色的左手邊）、y 往上（0＝腳底）、z 前後（+z＝臉朝的方向）
//   方塊 (x,y,z) 佔的空間是 x±0.5、y..y+1、z±0.5；樞紐用同一套座標（可以是 .5）
import * as THREE from 'three';

// ───────── 排方塊的小工具 ─────────
export function voxelBuilder() {
  const cells = new Map();
  const set = (x, y, z, c, m = 'n') => cells.set(`${x},${y},${z}`, { x, y, z, c, m });
  const B = {
    box(x0, x1, y0, y1, z0, z1, c, m) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
          for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) set(x, y, z, c, m);
      return B;
    },
    // 左右對稱：x0..x1 與 -x1..-x0
    sym(x0, x1, y0, y1, z0, z1, c, m) { B.box(x0, x1, y0, y1, z0, z1, c, m); return B.box(-x1, -x0, y0, y1, z0, z1, c, m); },
    dot(x, y, z, c, m) { set(x, y, z, c, m); return B; },
    clear(x0, x1, y0, y1, z0, z1) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) cells.delete(`${x},${y},${z}`);
      return B;
    },
    // 尖刺：從 (x,y,z) 每步走 (dx,dy,dz)，走 n 步，粗細 w 往尖端變細
    spike(x, y, z, dx, dy, dz, n, c, w = 1, m) {
      const ax = Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) >= Math.abs(dz) ? 0 : Math.abs(dy) >= Math.abs(dz) ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const r = Math.max(0, Math.round(w * (1 - i / n)));
        const p = [Math.round(x + dx * i), Math.round(y + dy * i), Math.round(z + dz * i)];
        const lo = p.map((v, k) => k === ax ? v : v - r), hi = p.map((v, k) => k === ax ? v : v + r);
        B.box(lo[0], hi[0], lo[1], hi[1], lo[2], hi[2], c, m);
      }
      return B;
    },
    list: () => [...cells.values()],
  };
  return B;
}

// ───────── 方塊 → 網格（同一個部位裡互相貼著的面不畫）─────────
const FACES = [
  { d: [1, 0, 0], v: [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]] },
  { d: [-1, 0, 0], v: [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]] },
  { d: [0, 1, 0], v: [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]] },
  { d: [0, -1, 0], v: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]] },
  { d: [0, 0, 1], v: [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]] },
  { d: [0, 0, -1], v: [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]] },
];
const MATS = {
  n: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
  g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false }),
  e: new THREE.MeshBasicMaterial({ vertexColors: true }), // 發光：不吃光影
};
// cells: [{x,y,z,c,m}]；origin：樞紐；s：一格多大；zc/zd：貼花（臉）用，z 中心和厚度
function meshCells(cells, origin, s, deco) {
  const occ = new Map(cells.map(v => [`${v.x},${v.y},${v.z}`, v.m]));
  const buf = {};
  const col = new THREE.Color();
  for (const v of cells) {
    const b = buf[v.m] ??= { p: [], n: [], c: [] };
    col.set(v.c);
    const cx = v.x - origin[0], cy = v.y + 0.5 - origin[1];
    const cz = (deco ? deco.zc : v.z) - origin[2], sz = deco ? deco.zd : 1;
    for (const f of FACES) {
      const nb = occ.get(`${v.x + f.d[0]},${v.y + f.d[1]},${v.z + f.d[2]}`);
      if (nb && (nb === 'g') === (v.m === 'g')) continue;
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const q = f.v[i];
        b.p.push((cx + q[0]) * s, (cy + q[1]) * s, (cz + q[2] * sz) * s);
        b.n.push(...f.d);
        b.c.push(col.r, col.g, col.b);
      }
    }
  }
  const g = new THREE.Group();
  for (const [m, b] of Object.entries(buf)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    const mesh = new THREE.Mesh(geo, MATS[m]);
    mesh.castShadow = m !== 'g';
    g.add(mesh);
  }
  return g;
}

// ───────── 對嘴：文字 → 嘴形 ─────────
// 中文沒有拼音表，只能粗略：用字碼挑一個開口的嘴形，看起來像在講話就好
const ZHUYIN = { big: 'ㄚㄛㄞㄠㄢㄤㄜ', i: 'ㄧㄝㄟㄣㄥㄦㄓㄔㄕㄖㄗㄘㄙ', u: 'ㄨㄡㄩㄛ', closed: 'ㄅㄆㄇ' };
const CJK_CYCLE = ['big', 'small', 'i', 'big', 'u', 'small', 'i', 'big'];
export function visemeFor(ch) {
  if (!ch || /[\s，。！？、…,.!?~～—\-「」『』（）()：:；;]/.test(ch)) return null; // 停頓
  const lc = ch.toLowerCase();
  if ('a'.includes(lc)) return 'big';
  if ('eiy'.includes(lc)) return 'i';
  if ('ouw'.includes(lc)) return 'u';
  if ('mbp'.includes(lc)) return 'closed';
  if (/[a-z0-9]/.test(lc)) return 'small';
  for (const [v, s] of Object.entries(ZHUYIN)) if (s.includes(ch)) return v;
  const code = ch.codePointAt(0);
  return CJK_CYCLE[(code * 7 + (code >> 4)) % CJK_CYCLE.length];
}

// ───────── 動作（所有角色共用；角色可以在資料裡的 clips 換掉或加新的）─────────
// 一個動作 = fn(t, P, rig)：t 是動作開始後的秒數；P(部位) 拿到 {x,y,z 轉角(弧度), px,py,pz 位移(格)}
// 部位名稱約定：root hips torso head upperArmL/R lowerArmL/R gunL/R flashL/R thighL/R shinL/R skirt ribbon1..
const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
function restPose(P, rig) {
  for (const [name, r] of Object.entries(rig.def.rest || {})) Object.assign(P(name), r);
}
export const CLIPS = {
  idle: {
    loop: true,
    fn(t, P) {
      const b = Math.sin(t * 2.2), sway = Math.sin(t * 0.8);
      P('torso').x += 0.03 * b; P('torso').py += 0.12 * b;
      P('head').x -= 0.04 * b; P('head').z += 0.05 * Math.sin(t * 0.65); P('head').y += 0.08 * Math.sin(t * 0.37);
      P('hips').z += 0.025 * sway;
      for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
        P('upperArm' + side).z += 0.04 * s * (1 + b);
        P('lowerArm' + side).x -= 0.05 * (1 + b);
      }
    },
  },
  walk: { loop: true, fn: (t, P) => gait(t, P, 1.7, 0.55, 0.45, 0.08, 0.5) },
  run: { loop: true, fn: (t, P) => gait(t, P, 2.5, 0.85, 0.8, 0.28, 1.0) },
  shoot: {
    loop: true, face: 'angry',
    fn(t, P) {
      const per = 0.36;
      P('root').py -= 0.3; P('hips').y += 0.12;
      P('thighL').x -= 0.3; P('shinL').x += 0.15; P('thighR').x += 0.25; P('shinR').x += 0.35;
      for (const [s, side, off] of [[1, 'L', 0], [-1, 'R', per / 2]]) {
        const tt = (t + off) % per;
        const k = Math.exp(-tt * 22);
        const ua = P('upperArm' + side), la = P('lowerArm' + side), gun = P('gun' + side);
        ua.x = -1.45 - 0.3 * k; ua.y = -0.13 * s; ua.z = 0.05 * s;
        la.x = -0.05 - 0.15 * k; la.z = 0;
        gun.x = 0; gun.z = -0.05 * s;
        P('flash' + side).visible = tt < 0.06;
        P('torso').x -= 0.03 * k; P('torso').y += 0.04 * s * k;
      }
      P('torso').x -= 0.05; P('head').x += 0.05;
    },
  },
  hurt: {
    dur: 0.6, next: 'idle', face: 'pain', fade: 0.05,
    fn(t, P) {
      const e = t < 0.06 ? t / 0.06 : Math.exp(-(t - 0.06) * 6);
      P('root').pz -= 1.6 * e; P('root').py -= 0.4 * e;
      P('torso').x -= 0.3 * e; P('head').x -= 0.25 * e; P('head').z += 0.15 * e;
      for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
        P('upperArm' + side).x += 0.5 * e; P('upperArm' + side).z += 0.45 * s * e;
        P('lowerArm' + side).x -= 0.4 * e;
        P('shin' + side).x += 0.25 * e; P('thigh' + side).x -= 0.15 * e;
      }
    },
  },
  down: {
    dur: 1.1, hold: true, face: 'ko', fade: 0.08,
    fn(t, P) {
      const k = sm(t / 0.35);                    // 膝蓋一軟
      const f = sm((t - 0.25) / 0.6) ** 1.6;     // 往後倒
      const bounce = t > 0.85 ? Math.sin(Math.min(1, (t - 0.85) / 0.25) * Math.PI) * 0.06 : 0;
      const R = P('root');
      R.x = -Math.PI / 2 * f + bounce; R.py += -2.2 * k * (1 - f) + 2.6 * f; R.pz += 13 * f;
      P('hips').x += 0.2 * k;
      P('torso').x += 0.35 * k * (1 - f) - 0.1 * f;
      P('head').x += 0.3 * k * (1 - f) - 0.25 * f; P('head').y += 0.55 * f; P('head').z += 0.15 * f;
      for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
        P('thigh' + side).x -= (0.9 * k * (1 - f) + 0.35 * f) * (s > 0 ? 1 : 0.6);
        P('shin' + side).x += 1.2 * k * (1 - f) + (s > 0 ? 0.7 : 0.25) * f;
        P('upperArm' + side).z += s * (0.3 * k + 1.0 * f); P('upperArm' + side).x -= 0.4 * f;
        P('lowerArm' + side).x -= 0.5 * f;
      }
    },
  },
};
// 走路／跑步共用：cad 步頻、leg 腿擺幅、arm 手擺幅、lean 前傾、bob 上下
function gait(t, P, cad, leg, arm, lean, bob) {
  const w = t * Math.PI * 2 * cad * 0.5, sw = Math.sin(w), cw = Math.cos(w);
  P('root').py += bob * (1 - Math.abs(sw)) - bob * 0.3;
  P('thighL').x -= leg * sw; P('shinL').x += leg * 1.5 * Math.max(0, cw) + 0.05;
  P('thighR').x += leg * sw; P('shinR').x += leg * 1.5 * Math.max(0, -cw) + 0.05;
  P('upperArmL').x += arm * sw; P('upperArmR').x -= arm * sw;
  P('lowerArmL').x -= 0.2 + arm * 0.6 * Math.max(0, -sw) + lean;
  P('lowerArmR').x -= 0.2 + arm * 0.6 * Math.max(0, sw) + lean;
  P('torso').x += lean; P('torso').y += 0.12 * sw; P('hips').y -= 0.12 * sw;
  P('head').x -= lean * 0.5; P('head').y -= 0.06 * sw;
  P('skirt').x -= 0.06 * Math.abs(sw);
}

// ───────── 組裝 ─────────
const blank = () => ({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, visible: undefined });
const swapSide = n => n?.replace(/L$/, 'R');

export function buildRig(def, height = 1.35) {
  return new VoxelRig(def, height);
}

export class VoxelRig {
  constructor(def, height = 1.35) {
    this.def = def;
    const s = this.s = height / def.unit;
    this.clips = { ...CLIPS, ...(def.clips || {}) };
    this.object = new THREE.Group();          // 外面拿來放到場上的
    const root = new THREE.Group(); root.name = 'root';
    this.object.add(root);
    this.parts = { root: { name: 'root', group: root, pivot: [0, 0, 0], rest: new THREE.Vector3() } };
    // 展開左右鏡像
    const defs = [];
    for (const [name, p] of Object.entries(def.parts)) {
      if (p.mirror) {
        const src = def.parts[p.mirror];
        defs.push([name, {
          ...src, ...p, parent: p.parent ?? swapSide(src.parent), pivot: [-src.pivot[0], src.pivot[1], src.pivot[2]],
          cells: () => { const b = voxelBuilder(); src.build(b); return b.list().map(v => ({ ...v, x: -v.x })); },
        }]);
      } else defs.push([name, { ...p, cells: () => { const b = voxelBuilder(); p.build?.(b); return b.list(); } }]);
    }
    for (const [name, p] of defs) {
      const parent = this.parts[p.parent || 'root'];
      if (!parent) throw new Error(`${def.id}: 部位 ${name} 的上層 ${p.parent} 要寫在它前面`);
      const g = new THREE.Group(); g.name = name; g.rotation.order = 'YXZ';
      const rest = new THREE.Vector3(...p.pivot.map((v, i) => (v - parent.pivot[i]) * s));
      g.position.copy(rest);
      g.add(meshCells(p.cells(), p.pivot, s));
      if (p.hidden) g.visible = false;
      parent.group.add(g);
      const part = this.parts[name] = { name, group: g, pivot: p.pivot, rest, hidden: !!p.hidden };
      if (p.dangle) part.dangle = { k: 60, damp: 7, gain: 0.03, grav: 900, limit: 0.9, maxAcc: 500, ...p.dangle, ax: 0, az: 0, vx: 0, vz: 0, prev: null, vel: null };
    }
    this.buildFace();
    // 狀態
    this.clipName = null; this.time = 0;
    this.fadeFrom = null; this.fadeT = 0; this.fadeDur = 0.2;
    this.lastPose = {};
    this.expression = 'normal'; this.clipFace = null;
    this.mouthOverride = null;           // 手動指定嘴形（預覽頁用）
    this.talk = null;                    // { seq:[{t0,t1,v}], t }
    this.charMouth = null; this.charMouthT = 0;
    this.autoBlink = true; this.blinkT = 0; this.nextBlink = 1.5 + Math.random() * 2; this.blinking = 0;
    this.physics = true;
    this.play('idle');
    this.update(0);
  }

  // ───── 臉：每一層（眼睛、眉毛、嘴巴、臉紅）每一種排列各做一個網格，切換時只換看得到的那個 ─────
  buildFace() {
    const F = this.def.face; if (!F) return;
    const head = this.parts[F.part];
    this.face = {};
    for (const [lname, L] of Object.entries(F.layers)) {
      const layer = this.face[lname] = { cur: null, meshes: {} };
      for (const [vname, V] of Object.entries(L.variants)) {
        const rows = Array.isArray(V) ? V : V.rows, y0 = V.y ?? L.y, x0 = V.x ?? L.x ?? F.x0;
        const cells = [];
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === '.' || ch === ' ') return;
          const col = F.colors[ch]; if (!col) throw new Error(`臉的顏色 ${ch} 沒定義`);
          cells.push({ x: x0 + c, y: y0 - r, z: 0, c: Array.isArray(col) ? col[0] : col, m: Array.isArray(col) ? col[1] : 'n' });
        }));
        const z = L.z ?? F.z, d = L.depth ?? 0.2;
        const g = meshCells(cells, head.pivot, this.s, { zc: z + d / 2, zd: d });
        g.visible = false; g.name = `${lname}:${vname}`;
        head.group.add(g);
        layer.meshes[vname] = g;
      }
    }
  }
  setLayer(lname, vname) {
    const layer = this.face?.[lname]; if (!layer || layer.cur === vname) return;
    if (layer.cur && layer.meshes[layer.cur]) layer.meshes[layer.cur].visible = false;
    layer.cur = vname;
    if (vname && layer.meshes[vname]) layer.meshes[vname].visible = true;
  }
  get expressions() { return Object.keys(this.def.expressions || {}); }
  get visemes() { return Object.keys(this.def.visemes || {}); }
  setExpression(name) { if (this.def.expressions?.[name]) this.expression = name; }

  // 講一句話：照文字排好嘴形時間表（cps＝每秒幾個字）
  say(text, cps = 9) {
    const seq = []; let t = 0; const step = 1 / cps;
    for (const ch of text) {
      const v = visemeFor(ch);
      if (v) { seq.push({ t0: t, t1: t + step * 0.7, v }); t += step; }
      else t += step * 2.5;
    }
    this.talk = { seq, t: 0, end: t };
    return t;
  }
  // 給打字機用：每打一個字呼叫一次
  speakChar(ch) { const v = visemeFor(ch); this.charMouth = v; this.charMouthT = v ? 0.1 : 0; }
  stopTalk() { this.talk = null; this.charMouth = null; }

  play(name, opt = {}) {
    if (!this.clips[name]) return;
    if (this.clipName && opt.fade !== 0) {
      this.fadeFrom = this.lastPose; this.fadeT = 0;
      this.fadeDur = opt.fade ?? this.clips[name].fade ?? 0.2;
    }
    this.clipName = name; this.time = opt.t ?? 0; this.nextClip = opt.next || null;
    this.clipFace = opt.face === false ? null : this.clips[name].face || null;
  }

  // 算這一刻的姿勢（還沒套用）
  pose(name, t) {
    const pose = {};
    const P = n => pose[n] ??= blank();
    restPose(P, this);
    this.clips[name].fn(t, P, this);
    return pose;
  }

  update(dt) {
    const clip = this.clips[this.clipName];
    this.time += dt;
    if (!clip.loop && this.time >= clip.dur && !clip.hold) { this.play(this.nextClip || clip.next || 'idle'); }
    const cur = this.clips[this.clipName];
    let pose = this.pose(this.clipName, cur.loop || !cur.hold ? this.time : Math.min(this.time, cur.dur));
    if (this.fadeFrom) {
      this.fadeT += dt;
      const w = sm(this.fadeT / this.fadeDur);
      if (w >= 1) this.fadeFrom = null;
      else {
        const mixed = {};
        for (const n of new Set([...Object.keys(pose), ...Object.keys(this.fadeFrom)])) {
          const a = this.fadeFrom[n] || blank(), b = pose[n] || blank(), o = mixed[n] = blank();
          for (const k of ['x', 'y', 'z', 'px', 'py', 'pz']) o[k] = a[k] + (b[k] - a[k]) * w;
          o.visible = b.visible;
        }
        pose = mixed;
      }
    }
    this.lastPose = pose;
    // 套用
    const s = this.s;
    for (const part of Object.values(this.parts)) {
      const p = pose[part.name] || blank(), g = part.group;
      g.rotation.set(p.x, p.y, p.z);
      g.position.set(part.rest.x + p.px * s, part.rest.y + p.py * s, part.rest.z + p.pz * s);
      g.visible = p.visible ?? !part.hidden;
    }
    if (this.physics) this.stepDangles(dt);
    this.updateFace(dt);
  }

  // 馬尾、飄帶：彈簧＋慣性。關節（樞紐）在世界裡怎麼加速，就往反方向甩
  stepDangles(dt) {
    const list = Object.values(this.parts).filter(p => p.dangle);
    if (!list.length) return;
    this.object.updateMatrixWorld(true);
    const wp = new THREE.Vector3(), q = new THREE.Quaternion(), a = new THREE.Vector3(), gl = new THREE.Vector3();
    const h = Math.min(dt, 1 / 20);
    for (const part of list) {
      const D = part.dangle, g = part.group;
      g.getWorldPosition(wp); wp.divideScalar(this.s);       // 換成「格」
      if (!D.prev || h <= 0) { D.prev = wp.clone(); D.vel = new THREE.Vector3(); a.set(0, 0, 0); }
      else {
        const v = wp.clone().sub(D.prev).divideScalar(h);
        a.copy(v).sub(D.vel).divideScalar(h);
        D.prev.copy(wp); D.vel.copy(v);
      }
      if (a.length() > D.maxAcc) a.setLength(D.maxAcc);         // 被打飛、瞬移時不要甩過頭
      g.parent.getWorldQuaternion(q).invert();
      a.applyQuaternion(q);                                     // 換到上層的座標
      gl.set(0, -1, 0).applyQuaternion(q);                      // 重力在上層座標裡的方向
      const fx = a.x - D.grav * (gl.x), fz = a.z - D.grav * (gl.z);
      const n = Math.max(1, Math.ceil(h / (1 / 120))), sh = h / n;
      for (let i = 0; i < n; i++) {
        D.vx += (-D.k * D.ax - D.damp * D.vx - D.gain * fz) * sh;
        D.vz += (-D.k * D.az - D.damp * D.vz + D.gain * fx) * sh;
        D.ax = THREE.MathUtils.clamp(D.ax + D.vx * sh, -D.limit, D.limit);
        D.az = THREE.MathUtils.clamp(D.az + D.vz * sh, -D.limit, D.limit);
      }
      g.rotation.x += D.ax; g.rotation.z += D.az;
      g.updateMatrixWorld(true);
    }
  }
  resetDangles() { for (const p of Object.values(this.parts)) if (p.dangle) Object.assign(p.dangle, { ax: 0, az: 0, vx: 0, vz: 0, prev: null }); }

  updateFace(dt) {
    if (!this.face) return;
    const E = this.def.expressions[this.clipFace || this.expression] || {};
    // 眨眼
    let eyes = E.eyes;
    if (this.autoBlink && E.blink !== false) {
      this.blinkT += dt;
      if (this.blinking > 0) { this.blinking -= dt; eyes = this.def.face.blinkEyes || 'closed'; }
      else if (this.blinkT >= this.nextBlink) {
        this.blinking = 0.12; this.blinkT = 0;
        this.nextBlink = Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3.5;
        eyes = this.def.face.blinkEyes || 'closed';
      }
    }
    // 嘴：手動 > 講話 > 表情
    let mouth = E.mouth;
    if (this.talk) {
      this.talk.t += dt;
      const seg = this.talk.seq.find(s => this.talk.t >= s.t0 && this.talk.t < s.t1);
      mouth = this.def.visemes[seg ? seg.v : 'closed'] || mouth;
      if (this.talk.t > this.talk.end) this.talk = null;
    } else if (this.charMouthT > 0) {
      this.charMouthT -= dt;
      mouth = this.def.visemes[this.charMouth] || mouth;
    }
    if (this.mouthOverride) mouth = this.def.visemes[this.mouthOverride] || this.mouthOverride;
    this.setLayer('eyes', eyes); this.setLayer('brows', E.brows); this.setLayer('mouth', mouth); this.setLayer('blush', E.blush || null);
  }
}
