// 主動權制（Crossfire 式）單兵戰術：
// - 沒有回合。持有主動權的一方可任意行動，直到某個行動「失敗」才交給對方。
// - 失敗：主動射擊沒造成傷害；移動中被反應射擊命中。
// - 移動：任意角度直線走到任一格，路線要淨空；翻越半掩體是獨立行動。
// - 反應射擊：自動。每個敵人每次移動最多一槍，挑命中率最高的點（同分取離起點近的）。
//   反應射擊打空 → 該單位在這次主動權內不能再開槍。
// - 被命中 → 壓制：開槍與被打命中都下降、不能移動；解除壓制是一個行動（目前必定成功）。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { T, RULES, THEMES, SOLDIER_TEMPLATES, RECRUIT, RECRUIT_NAMES, RECRUIT_COLORS, ENEMY_TYPES } from './config.js';
import { generateMap, ri } from './map.js';
import { hasLOS, coverSides, shotOdds, key, dist, clearMove, lineCells, vaultTargets } from './grid.js';
import { makeUnitMesh } from './units.js';
import * as UI from './ui.js';

// ================= 場景 =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 30;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.2;
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE }; // 單指留給點擊/平移

scene.add(new THREE.HemisphereLight(0xd6e6ff, 0x3a3025, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);
const flash = new THREE.PointLight(0xffd27a, 0, 6);
scene.add(flash);

const world = new THREE.Group();     // 每張地圖重建
const unitGroup = new THREE.Group();
const overlay = new THREE.Group();   // 常駐的提示物件
scene.add(world, unitGroup, overlay);

// 可移動範圍
const MAX_TILES = 400;
const rangeGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
const rangeMesh = new THREE.InstancedMesh(rangeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false }), MAX_TILES);
rangeMesh.setColorAt(0, new THREE.Color());
rangeMesh.frustumCulled = false;
rangeMesh.count = 0;
overlay.add(rangeMesh);
const BLUE = new THREE.Color(0x3fa9ff), PURPLE = new THREE.Color(0xc07bff), GREEN = new THREE.Color(0x4fe08a);

const hoverMark = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2)),
  new THREE.LineBasicMaterial({ color: 0xffffff }));
hoverMark.visible = false;
overlay.add(hoverMark);

const pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8fd3ff }));
overlay.add(pathLine);

const selRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.45, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x4fd6ff, transparent: true }));
selRing.visible = false;
overlay.add(selRing);

const tgtRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 4).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true }));
tgtRing.visible = false;
overlay.add(tgtRing);

const coverIcons = new THREE.Group();
overlay.add(coverIcons);
const shieldMat = [null, new THREE.MeshBasicMaterial({ color: 0xffc44f }), new THREE.MeshBasicMaterial({ color: 0x4fc3ff })];
const shieldGeo = [null, new THREE.BoxGeometry(0.5, 0.28, 0.04), new THREE.BoxGeometry(0.5, 0.56, 0.04)];

// 反應射擊預警標記
const reactMarks = new THREE.Group();
overlay.add(reactMarks);
const reactGeo = new THREE.RingGeometry(0.18, 0.3, 20).rotateX(-Math.PI / 2);
const reactMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9, depthWrite: false });
const reactLineMat = new THREE.LineDashedMaterial({ color: 0xff5a4a, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.8 });

// ================= 狀態 =================
const S = {
  level: 1, initNo: 1, side: 'player', map: null, theme: THEMES[0],
  units: [], selected: null, mode: 'move', targets: [], targetIdx: 0,
  busy: false, moves: null, hover: null, roster: null, gameOver: false,
};

const players = () => S.units.filter(u => u.team === 'player' && u.alive);
const enemies = () => S.units.filter(u => u.team === 'enemy' && u.alive);
const unitAt = (x, z) => S.units.find(u => u.alive && u.x === x && u.z === z);
const occupied = (x, z, except) => S.units.some(u => u.alive && u !== except && u.x === x && u.z === z);
const canAct = u => !!u && u.alive && u.team === 'player' && S.side === 'player' && !S.busy && !S.gameOver && S.mode === 'move';
const canMove = u => canAct(u) && !u.suppressed;
const refresh = () => UI.updateHUD(S);
const oddsVs = (s, t, opts = {}) => shotOdds(S.map, s, s, t, { targetSuppressed: !!t.suppressed, ...opts });

// ================= 補間 / 動畫 =================
const tweens = [];
function tween(dur, fn) {
  return new Promise(res => tweens.push({ t: 0, dur, fn, res }));
}
const wait = s => tween(s, () => {});
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}

// ================= 攝影機 =================
const camGoal = new THREE.Vector3();
let camRot = 0;
const keys = new Set();
const UP = new THREE.Vector3(0, 1, 0);

function focusOn(x, z) { camGoal.set(x, 0, z); }
function focusUnit(u) { focusOn(u.mesh.position.x, u.mesh.position.z); }

function updateCamera(dt) {
  const fwd = controls.target.clone().sub(camera.position).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP);
  const mv = new THREE.Vector3();
  if (keys.has('w') || keys.has('arrowup')) mv.add(fwd);
  if (keys.has('s') || keys.has('arrowdown')) mv.sub(fwd);
  if (keys.has('d') || keys.has('arrowright')) mv.add(right);
  if (keys.has('a') || keys.has('arrowleft')) mv.sub(right);
  if (mv.lengthSq()) camGoal.addScaledVector(mv.normalize(), dt * 10);
  if (S.map) {
    camGoal.x = Math.max(-2, Math.min(S.map.w + 1, camGoal.x));
    camGoal.z = Math.max(-2, Math.min(S.map.h + 1, camGoal.z));
  }
  const d = camGoal.clone().sub(controls.target).multiplyScalar(Math.min(1, dt * 6));
  controls.target.add(d);
  camera.position.add(d);
  if (Math.abs(camRot) > 1e-4) {
    const step = camRot * Math.min(1, dt * 8);
    camRot -= step;
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(UP, step);
    camera.position.copy(controls.target).add(off);
  }
}

// ================= 建立地圖 =================
function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}

function buildWorld() {
  disposeTree(world);
  world.clear();
  const { map, theme: th } = S;
  const { w, h } = map;
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.sky, 28, 60);

  const cx = (w - 1) / 2, cz = (h - 1) / 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, h + 40),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(th.floor).multiplyScalar(0.55), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.1, cz);
  ground.receiveShadow = true;
  world.add(ground);

  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.97, 0.1, 0.97),
    new THREE.MeshStandardMaterial({ roughness: 0.95 }), w * h);
  tiles.receiveShadow = true;
  tiles.frustumCulled = false;
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  const cA = new THREE.Color(th.floor), cB = new THREE.Color(th.floorAlt);
  let n = 0;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    m4.makeTranslation(x, -0.05, z);
    tiles.setMatrixAt(n, m4);
    c.copy((x + z) % 2 ? cA : cB).multiplyScalar(0.94 + Math.random() * 0.1);
    tiles.setColorAt(n, c);
    n++;
  }
  world.add(tiles);

  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const t = map.get(x, z);
    if (t === T.HALF) world.add(makeHalf(th, x, z));
    if (t === T.FULL) world.add(makeFull(th, x, z));
  }

  const R = Math.max(w, h) * 0.8;
  sun.position.set(cx - 8, 18, cz + 6);
  sun.target.position.set(cx, 0, cz);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
}

function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }
function tint(hex) { return new THREE.Color(hex).multiplyScalar(0.88 + Math.random() * 0.2); }

function makeHalf(th, x, z) {
  const mat = new THREE.MeshStandardMaterial({ color: tint(th.half), roughness: 0.85 });
  let m;
  if (th.halfStyle === 'rock') {
    m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45), mat);
    m.scale.set(1, 0.7, 1);
    m.position.set(x, 0.28, z);
    m.rotation.y = Math.random() * 6;
  } else if (th.halfStyle === 'sandbag') {
    m = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.55, 0.6), mat);
    m.position.set(x, 0.27, z);
    m.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
  } else {
    m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.8), mat);
    m.position.set(x, 0.32, z);
    m.rotation.y = (Math.random() - 0.5) * 0.4;
  }
  return shadowed(m);
}

function makeFull(th, x, z) {
  if (th.fullStyle === 'tree') {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a3e28 }));
    trunk.position.y = 0.4;
    const leafMat = new THREE.MeshStandardMaterial({ color: tint(th.full), roughness: 0.9 });
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8), leafMat);
    c1.position.y = 1.2;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 8), leafMat);
    c2.position.y = 1.75;
    g.add(shadowed(trunk), shadowed(c1), shadowed(c2));
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * 6;
    return g;
  }
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1),
    new THREE.MeshStandardMaterial({ color: tint(th.full), roughness: 0.9 }));
  m.position.set(x, 0.75, z);
  return shadowed(m);
}

// ================= 單位 =================
function spawnUnit(u) {
  u.mesh = makeUnitMesh(u.team, u.kind, u.color);
  u.mesh.position.set(u.x, 0, u.z);
  u.mesh.rotation.y = u.team === 'player' ? Math.PI / 2 : -Math.PI / 2;
  u.mesh.userData.unit = u;
  unitGroup.add(u.mesh);
  u.label = UI.makeLabel(u);
  S.units.push(u);
}

function clearUnits() {
  for (const u of S.units) {
    if (u.label) u.label.remove();
    u.label = null;
  }
  disposeTree(unitGroup);
  unitGroup.clear();
  S.units = [];
}

function newSoldier(tpl) {
  return { ...tpl, dmg: [...tpl.dmg], hp: tpl.maxHp, team: 'player', kind: 'soldier' };
}

function newRecruit() {
  const name = RECRUIT_NAMES[ri(0, RECRUIT_NAMES.length - 1)];
  return { ...newSoldier({ ...RECRUIT, name, color: RECRUIT_COLORS[ri(0, RECRUIT_COLORS.length - 1)] }), recruit: true };
}

// ================= 任務流程 =================
function newGame() {
  S.level = 1;
  S.roster = SOLDIER_TEMPLATES.map(newSoldier);
  UI.clearLog();
  startMission();
}

function startMission() {
  clearUnits();
  const gen = generateMap(S.level);
  S.map = gen.map;
  S.theme = THEMES[ri(0, THEMES.length - 1)];
  S.gameOver = false;
  buildWorld();

  S.roster.forEach((r, i) => {
    Object.assign(r, { x: gen.playerSpawns[i].x, z: gen.playerSpawns[i].z, alive: true, suppressed: false, firedOut: false });
    spawnUnit(r);
  });
  gen.pods.forEach((pod, podId) => pod.forEach(p => {
    const tpl = ENEMY_TYPES[p.type];
    spawnUnit({ ...tpl, dmg: [...tpl.dmg], kind: p.type, team: 'enemy', hp: tpl.maxHp,
      x: p.x, z: p.z, alive: true, suppressed: false, firedOut: false, alerted: false, podId });
  }));

  const p0 = gen.playerSpawns[0];
  controls.target.set(p0.x + 3, 0, p0.z);
  camera.position.set(p0.x + 3, 14, p0.z + 11);
  focusOn(p0.x + 3, p0.z);

  UI.log(`── 任務 ${S.level}：${S.theme.name}（敵人 ${gen.pods.flat().length}）──`, 'sys');
  S.initNo = 0;
  S.deployZone = gen.deployZone;
  S.side = 'deploy';
  S.busy = false;
  updateVisibility();
  UI.banner('部署階段', 'player');
  UI.log('部署：點士兵再點綠色格子擺位，按 Enter 開始', 'sys');
  selectUnit(players()[0]);
}

function startBattle() {
  if (S.side !== 'deploy' || S.gameOver) return;
  clearOverlays();
  updateVisibility();
  giveInitiative('player');
}

function deployTo(u, t) {
  const other = unitAt(t.x, t.z);
  if (other === u) return;
  if (other && other.team === 'player') {
    other.x = u.x; other.z = u.z;
    other.mesh.position.set(other.x, 0, other.z);
  }
  u.x = t.x; u.z = t.z;
  u.mesh.position.set(u.x, 0, u.z);
  refresh();
}

function nextMission() {
  S.level++;
  S.roster = S.roster.map(r => {
    if (!r.alive) return newRecruit();
    r.hp = Math.min(r.maxHp, r.hp + RULES.HEAL_BETWEEN_MAPS);
    return r;
  });
  startMission();
}

function checkEnd() {
  if (S.gameOver) return true;
  if (!players().length) {
    S.gameOver = true;
    clearOverlays();
    setTimeout(() => UI.showOverlay('任務失敗', `<p>小隊全滅。</p><p>你完成了 <b>${S.level - 1}</b> 張地圖。</p>`, '重新開始', newGame), 900);
    return true;
  }
  if (!enemies().length) {
    S.gameOver = true;
    clearOverlays();
    const rows = S.units.filter(u => u.team === 'player').map(u =>
      `<li>${u.name}：${u.alive ? `HP ${u.hp}/${u.maxHp} → 回復 +${RULES.HEAL_BETWEEN_MAPS}` : '陣亡（由新兵遞補）'}</li>`).join('');
    setTimeout(() => UI.showOverlay(`任務 ${S.level} 完成`, `<p>區域已清除，主動權交換了 ${S.initNo - 1} 次。</p><ul>${rows}</ul>`, '前往下一張地圖 ▶', nextMission), 900);
    return true;
  }
  return false;
}

// ================= 主動權 =================
async function giveInitiative(side) {
  if (S.gameOver) return;
  for (const u of S.units) u.firedOut = false;
  S.initNo++;
  S.side = side;
  S.mode = 'move';
  UI.hideTargeting();
  clearOverlays();

  if (side === 'player') {
    S.busy = false;
    UI.banner('我方取得主動權', 'player');
    selectUnit(S.selected && S.selected.alive && S.selected.team === 'player' ? S.selected : players()[0]);
    return;
  }

  S.busy = true;
  S.selected = null;
  refresh();
  const anyAlert = enemies().some(e => e.alerted);
  if (anyAlert) { UI.banner('敵方取得主動權', 'enemy'); await wait(0.8); }
  const failed = await enemyInitiative();
  if (S.gameOver || checkEnd()) return;
  if (!failed && anyAlert) UI.log('敵方放棄主動權', 'dim');
  await wait(0.3);
  giveInitiative('player');
}

// 一個行動結束後：成功 → 繼續；失敗 → 交出主動權
async function resolvePlayerAction(ok) {
  refresh();
  if (checkEnd()) return;
  if (!ok) {
    UI.log('行動失敗，交出主動權', 'warn');
    await wait(0.5);
    giveInitiative('enemy');
    return;
  }
  selectUnit(S.selected && S.selected.alive ? S.selected : players()[0]);
}

// ================= 視野 / 警覺 =================
function updateVisibility() {
  const ps = players();
  for (const e of enemies()) {
    const vis = ps.some(p => hasLOS(S.map, p, e));
    e.mesh.visible = vis;
    if (vis && !e.alerted) alertPod(e.podId);
  }
}

function alertPod(podId) {
  let any = false;
  for (const e of enemies()) {
    if (e.podId === podId && !e.alerted) { e.alerted = true; any = true; }
  }
  if (any) { UI.banner('發現敵人！', 'enemy'); UI.log('發現敵方小隊！', 'warn'); }
}

// ================= 移動 + 反應射擊 =================
function moveOptions(u) {
  const blocked = (x, z) => occupied(x, z, u);
  const out = new Map();
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
    if (clearMove(S.map, u, { x, z }, blocked)) out.set(key(x, z), { x, z, vault: false });
  }
  for (const v of vaultTargets(S.map, u, blocked)) {
    if (!out.has(key(v.x, v.z))) out.set(key(v.x, v.z), { ...v, vault: true });
  }
  return out;
}

function pathCells(u, dest) {
  return dest.vault ? [{ x: dest.x, z: dest.z, t: 1 }] : lineCells(u, dest);
}

// 誰會對這次移動開反應槍、在哪一格開。knownOnly = 只算玩家看得到的敵人（給預覽用，不洩漏迷霧）
function planReactions(mover, cells, knownOnly = false) {
  const out = [];
  for (const r of S.units) {
    if (!r.alive || r.team === mover.team || r.firedOut) continue;
    if (r.team === 'enemy' && !r.alerted) continue;
    if (knownOnly && r.team === 'enemy' && !r.mesh.visible) continue;
    let best = null;
    cells.forEach((c, i) => {
      if (!hasLOS(S.map, r, c)) return;
      const o = shotOdds(S.map, r, r, c, { reaction: true });
      if (o.hit >= RULES.REACTION_MIN && (!best || o.hit > best.odds.hit)) best = { shooter: r, idx: i, odds: o };
    });
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.idx - b.idx);
}

const hitChance = plan => 1 - plan.reduce((p, r) => p * (1 - r.odds.hit / 100), 1);

// 回傳 true = 移動成功；false = 被反應射擊命中（行動失敗）
async function performMove(u, dest) {
  const start = { x: u.x, z: u.z };
  const cells = pathCells(u, dest);
  const plan = planReactions(u, cells);
  const len = dist(start, dest);
  u.mesh.rotation.y = Math.atan2(dest.x - start.x, dest.z - start.z);
  if (dest.vault) UI.log(`${u.name} 翻越掩體`, 'dim');

  let curT = 0;
  const posAt = t => new THREE.Vector3(start.x + (dest.x - start.x) * t, 0, start.z + (dest.z - start.z) * t);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const a = posAt(curT), b = posAt(c.t);
    const dur = dest.vault ? 0.45 : Math.max(0.04, (c.t - curT) * len * 0.11);
    await tween(dur, k => {
      u.mesh.position.lerpVectors(a, b, k);
      u.mesh.position.y = dest.vault ? Math.sin(k * Math.PI) * 0.5 : Math.abs(Math.sin(k * Math.PI)) * 0.05;
    });
    curT = c.t;
    u.x = c.x;
    u.z = c.z;
    updateVisibility();
    if (u.mesh.visible) focusUnit(u);

    for (const r of plan.filter(p => p.idx === i)) {
      const s = r.shooter;
      if (!s.alive || s.firedOut || !u.alive) continue;
      floatText(s, '反應射擊！', 'ow');
      const hit = await shoot(s, u, { reaction: true });
      if (hit) {
        const p = u.mesh.position.clone();
        await tween(0.12, k => u.mesh.position.lerpVectors(p, new THREE.Vector3(c.x, 0, c.z), k));
        return false;
      }
      s.firedOut = true;
      if (s.label) UI.updateLabel(s.label, s);
    }
  }
  u.mesh.position.set(dest.x, 0, dest.z);
  refresh();
  return true;
}

// ================= 射擊 =================
function visibleTargets(u) {
  return S.units
    .filter(e => e.alive && e.team !== u.team && hasLOS(S.map, u, e))
    .map(e => ({ unit: e, odds: oddsVs(u, e) }))
    .sort((a, b) => b.odds.hit - a.odds.hit);
}

function spawnTracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tween(0.15, k => (mat.opacity = 1 - k)).then(() => { scene.remove(line); geo.dispose(); mat.dispose(); });
}

// 回傳是否命中（命中必定造成傷害）
async function shoot(s, t, { reaction = false } = {}) {
  const odds = oddsVs(s, t, { reaction });
  s.mesh.rotation.y = Math.atan2(t.x - s.x, t.z - s.z);
  s.mesh.updateMatrixWorld(true);
  s.mesh.visible = true;
  if (t.team === 'enemy' && !t.alerted) alertPod(t.podId);

  const hit = Math.random() * 100 < odds.hit;
  const crit = hit && Math.random() * 100 < odds.crit;
  const muzzle = s.mesh.localToWorld(s.mesh.userData.muzzle.clone());
  const aim = new THREE.Vector3(t.mesh.position.x, 0.9 * t.mesh.scale.y, t.mesh.position.z);
  for (let i = 0; i < 3; i++) {
    const end = aim.clone();
    if (!hit) {
      const side = new THREE.Vector3(t.z - s.z, 0, -(t.x - s.x)).normalize();
      end.addScaledVector(side, (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6));
      end.y += (Math.random() - 0.3) * 0.6;
      end.add(end.clone().sub(muzzle).normalize().multiplyScalar(4));
    } else {
      end.add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2));
    }
    spawnTracer(muzzle, end);
    flash.position.copy(muzzle);
    flash.intensity = 4;
    await wait(0.06);
    flash.intensity = 0;
    await wait(0.03);
  }

  const tag = `${s.name}${reaction ? '（反應）' : ''} → ${t.name}（${odds.hit}%）`;
  if (hit) {
    let dmg = ri(s.dmg[0], s.dmg[1]);
    if (crit) dmg = Math.ceil(dmg * RULES.CRIT_MULT);
    UI.log(`${tag} ${crit ? '暴擊' : '命中'} -${dmg}`, s.team === 'player' ? 'good' : 'bad');
    await damage(t, dmg, crit);
  } else {
    floatText(t, '未命中', 'miss');
    UI.log(`${tag} 未命中`, 'dim');
  }
  await wait(0.35);
  updateVisibility();
  refresh();
  return hit;
}

async function damage(t, dmg, crit) {
  t.hp -= dmg;
  floatText(t, (crit ? '暴擊 ' : '') + '-' + dmg, crit ? 'crit' : 'dmg');
  const mats = t.mesh.userData.mats;
  await tween(0.25, k => mats.forEach(m => m.emissive.setRGB((1 - k) * 0.9, 0, 0)));
  if (t.hp <= 0) { await die(t); return; }
  if (!t.suppressed) {
    t.suppressed = true;
    floatText(t, '壓制', 'sup');
    setSuppressedPose(t, true);
  }
}

function setSuppressedPose(u, on) {
  // 被壓制：蹲低
  const base = u.kind === 'brute' ? 1.2 : 1;
  const from = u.mesh.scale.y, to = base * (on ? 0.78 : 1);
  tween(0.2, k => { u.mesh.scale.y = from + (to - from) * k; });
}

async function die(u) {
  u.alive = false;
  u.hp = 0;
  u.suppressed = false;
  if (u.label) { u.label.remove(); u.label = null; }
  UI.log(`${u.name} 倒下了`, u.team === 'player' ? 'bad' : 'good');
  const m = u.mesh;
  await tween(0.5, k => {
    m.rotation.x = -k * Math.PI / 2;
    m.position.y = 0.12 * k;
  });
  m.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.55; } });
}

function rally(u) {
  u.suppressed = false;
  setSuppressedPose(u, false);
  floatText(u, '解除壓制', 'ow');
  UI.log(`${u.name} 解除壓制`, 'dim');
}

// ================= 玩家操作 =================
function selectUnit(u) {
  if (!u || !u.alive) return;
  S.selected = u;
  S.mode = 'move';
  UI.hideTargeting();
  tgtRing.visible = false;
  focusUnit(u);
  refreshMoves();
  refresh();
}

function nextSoldier() {
  const ps = players();
  if (!ps.length) return;
  selectUnit(ps[(ps.indexOf(S.selected) + 1) % ps.length]);
}

function refreshMoves() {
  const u = S.selected;
  S.moves = canMove(u) ? moveOptions(u) : null;
  drawRange();
  updateHover();
}

function drawRange() {
  let n = 0;
  if (S.side === 'deploy' && S.deployZone) {
    const m4 = new THREE.Matrix4();
    for (const p of S.deployZone) {
      m4.makeTranslation(p.x, 0.015, p.z);
      rangeMesh.setMatrixAt(n, m4);
      rangeMesh.setColorAt(n, GREEN);
      n++;
    }
  } else if (S.moves) {
    const m4 = new THREE.Matrix4();
    for (const mv of S.moves.values()) {
      if (n >= MAX_TILES) break;
      m4.makeTranslation(mv.x, 0.015, mv.z);
      rangeMesh.setMatrixAt(n, m4);
      rangeMesh.setColorAt(n, mv.vault ? PURPLE : BLUE);
      n++;
    }
  }
  rangeMesh.count = n;
  rangeMesh.instanceMatrix.needsUpdate = true;
  if (rangeMesh.instanceColor) rangeMesh.instanceColor.needsUpdate = true;
}

function clearReactMarks() {
  reactMarks.children.forEach(o => { if (o.isLine) o.geometry.dispose(); });
  reactMarks.clear();
}

function clearOverlays() {
  pendingTap = null;
  S.moves = null;
  drawRange();
  pathLine.visible = false;
  coverIcons.clear();
  clearReactMarks();
  hoverMark.visible = false;
  tgtRing.visible = false;
  UI.tip(null);
}

let lastMouse = { x: 0, y: 0 };
let touchMode = false; // 最近一次輸入是觸控
const tipPos = () => touchMode ? { x: innerWidth / 2 - 110, y: 96 } : lastMouse;
function showTip(html) { const p = tipPos(); UI.tip(html, p.x, p.y); }
function updateHover() {
  const t = S.hover;
  coverIcons.clear();
  clearReactMarks();
  pathLine.visible = false;
  UI.tip(null);
  if (!t || (S.side !== 'player' && S.side !== 'deploy') || S.busy || S.gameOver) { hoverMark.visible = false; return; }
  hoverMark.visible = true;
  hoverMark.position.set(t.x, 0.03, t.z);

  if (S.mode !== 'move') return;
  const u = S.selected;
  const occ = unitAt(t.x, t.z);
  if (occ && occ.team === 'enemy' && occ.mesh.visible && canAct(u)) {
    if (u.firedOut) showTip(`<b>${occ.name}</b><br><small>此單位這次主動權不能再開槍</small>`);
    else if (hasLOS(S.map, u, occ)) {
      const o = oddsVs(u, occ);
      showTip(`<b>${occ.name}</b> 命中 <b>${o.hit}%</b><br><small>${UI.coverName(o)}${occ.suppressed ? ' · 壓制中' : ''} · 點敵人瞄準</small>`);
    } else showTip(`<b>${occ.name}</b><br><small>無視線</small>`);
    return;
  }
  if (!S.map.walkable(t.x, t.z)) return;
  for (const s of coverSides(S.map, t)) {
    const m = new THREE.Mesh(shieldGeo[s.c], shieldMat[s.c]);
    m.position.set(t.x + s.dx * 0.4, s.c === 2 ? 0.3 : 0.16, t.z + s.dz * 0.4);
    if (s.dx) m.rotation.y = Math.PI / 2;
    coverIcons.add(m);
  }

  const mv = S.moves && S.moves.get(key(t.x, t.z));
  if (!mv || !canMove(u)) return;
  pathLine.geometry.dispose();
  pathLine.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(u.x, 0.08, u.z), new THREE.Vector3(t.x, 0.08, t.z)]);
  pathLine.material.color.set(mv.vault ? 0xd6a6ff : 0x8fd3ff);
  pathLine.visible = true;

  // 反應射擊預覽
  const cells = pathCells(u, mv);
  const plan = planReactions(u, cells, true);
  for (const r of plan) {
    const c = cells[r.idx];
    const ring = new THREE.Mesh(reactGeo, reactMat);
    ring.position.set(c.x, 0.05, c.z);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(r.shooter.x, 0.9, r.shooter.z), new THREE.Vector3(c.x, 0.5, c.z)]), reactLineMat);
    line.computeLineDistances();
    reactMarks.add(ring, line);
  }
  const head = (mv.vault ? '翻越' : `移動 ${dist(u, mv).toFixed(1)} 格`) + (touchMode ? '　<span class="hint">再點一次確認</span>' : '');
  if (plan.length) {
    const rows = plan.map(r => `${r.shooter.name} ${r.odds.hit}%`).join('<br>');
    showTip(`<b>${head}</b><br><span class="warn">⚠ 反應射擊</span><br>${rows}<br>被命中機率 <b>${Math.round(hitChance(plan) * 100)}%</b>`);
  } else {
    showTip(`<b>${head}</b><br><small>已知敵人無法反應射擊</small>`);
  }
}

async function playerMove(u, mv) {
  S.busy = true;
  clearOverlays();
  const ok = await performMove(u, mv);
  S.busy = false;
  await resolvePlayerAction(ok);
}

function enterTargetMode(pref) {
  const u = S.selected;
  if (!canAct(u)) return;
  if (u.firedOut) { UI.toast('此單位這次主動權不能再開槍'); return; }
  const ts = visibleTargets(u);
  if (!ts.length) { UI.toast('沒有視線內的目標'); return; }
  S.mode = 'target';
  S.targets = ts;
  S.targetIdx = Math.max(0, ts.findIndex(t => t.unit === pref));
  S.moves = null;
  drawRange();
  pathLine.visible = false;
  coverIcons.clear();
  clearReactMarks();
  UI.tip(null);
  updateTargeting();
  refresh();
}

function updateTargeting() {
  const t = S.targets[S.targetIdx].unit;
  const u = S.selected;
  tgtRing.visible = true;
  tgtRing.position.set(t.x, 0.04, t.z);
  focusOn((t.x + u.x) / 2, (t.z + u.z) / 2);
  u.mesh.rotation.y = Math.atan2(t.x - u.x, t.z - u.z);
  UI.showTargeting(S.targets, S.targetIdx);
}

function cancelTarget() {
  if (S.mode !== 'target') return;
  S.mode = 'move';
  selectUnit(S.selected);
}

async function fire() {
  if (S.mode !== 'target' || S.busy) return;
  const t = S.targets[S.targetIdx];
  S.mode = 'move';
  UI.hideTargeting();
  tgtRing.visible = false;
  S.busy = true;
  const hit = await shoot(S.selected, t.unit);
  S.busy = false;
  await resolvePlayerAction(hit);
}

const actions = {
  shoot() { if (S.mode === 'target') fire(); else enterTargetMode(); },
  async rally() {
    const u = S.selected;
    if (!canAct(u) || !u.suppressed) return;
    rally(u);
    await resolvePlayerAction(true);
  },
  pass() {
    if (S.side !== 'player' || S.busy || S.gameOver) return;
    if (S.mode === 'target') cancelTarget();
    UI.log('我方放棄主動權', 'dim');
    giveInitiative('enemy');
  },
  select(u) { if ((S.side === 'player' || S.side === 'deploy') && !S.busy) selectUnit(u); },
  start: startBattle,
  rotL() { camRot += Math.PI / 4; },
  rotR() { camRot -= Math.PI / 4; },
  canAct,
  pickTarget(i) { S.targetIdx = i; updateTargeting(); },
  fire,
  cancelTarget,
};
UI.init(actions);

// ================= 敵人 AI（同一套規則） =================
function evalTile(e, pos, ps) {
  let s = 0, nearest = Infinity, bestHit = 0, flank = false;
  for (const p of ps) {
    nearest = Math.min(nearest, dist(pos, p));
    if (hasLOS(S.map, pos, p)) {
      const def = shotOdds(S.map, p, p, pos); // 玩家打這格的命中率
      s -= def.hit * 0.35;
      const o = shotOdds(S.map, e, pos, p, { targetSuppressed: !!p.suppressed });
      if (o.hit > bestHit) bestHit = o.hit;
      if (o.cover === 0) flank = true;
    } else s += 6;
  }
  s += bestHit * 0.5 + (flank ? 15 : 0);
  if (nearest > 8) s -= (nearest - 8) * 5;
  if (nearest < 2) s -= 10;
  return s;
}

function aiChoose(moveCount) {
  const es = enemies().filter(e => e.alerted);
  if (!es.length) return null;
  const sup = es.find(e => e.suppressed);
  if (sup) return { type: 'rally', e: sup };

  let shot = null;
  for (const e of es) {
    if (e.firedOut) continue;
    const t = visibleTargets(e)[0];
    if (t && (!shot || t.odds.hit > shot.odds.hit)) shot = { e, t: t.unit, odds: t.odds };
  }
  if (shot && shot.odds.hit >= RULES.AI_SHOOT) return { type: 'shoot', ...shot };

  const ps = players();
  let move = null;
  for (const e of es) {
    if ((moveCount.get(e) || 0) >= 2) continue;
    const cur = evalTile(e, e, ps);
    for (const mv of moveOptions(e).values()) {
      if (dist(e, mv) > 9) continue;
      const risk = hitChance(planReactions(e, pathCells(e, mv)));
      const gain = evalTile(e, mv, ps) - risk * RULES.AI_RISK - cur;
      if (!move || gain > move.gain) move = { type: 'move', e, dest: mv, gain };
    }
  }
  if (move && move.gain > RULES.AI_MOVE_GAIN) return move;
  if (shot && shot.odds.hit >= RULES.AI_GAMBLE) return { type: 'shoot', ...shot };
  return null;
}

// 回傳 true = 因行動失敗而交出主動權
async function enemyInitiative() {
  // 未警覺的敵人：巡邏
  for (const e of enemies().filter(e => !e.alerted)) {
    if (Math.random() < 0.5) continue;
    const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 3);
    if (!opts.length) continue;
    const ok = await performMove(e, opts[ri(0, opts.length - 1)]);
    if (checkEnd()) return true;
    if (!ok) return true;
  }

  const moveCount = new Map();
  for (let i = 0; i < RULES.AI_MAX_ACTIONS && !S.gameOver; i++) {
    const act = aiChoose(moveCount);
    if (!act) return false;
    let ok = true;
    if (act.type === 'rally') {
      rally(act.e);
      await wait(0.4);
    } else if (act.type === 'shoot') {
      focusOn((act.e.x + act.t.x) / 2, (act.e.z + act.t.z) / 2);
      await wait(0.35);
      ok = await shoot(act.e, act.t);
    } else {
      moveCount.set(act.e, (moveCount.get(act.e) || 0) + 1);
      if (act.e.mesh.visible) { focusUnit(act.e); await wait(0.3); }
      ok = await performMove(act.e, act.dest);
    }
    refresh();
    if (checkEnd()) return true;
    if (!ok) return true;
  }
  return false;
}

// ================= 輸入 =================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(UP, 0);

function pickTile(ev) {
  ndc.set(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const vis = S.units.filter(u => u.alive && u.mesh.visible).map(u => u.mesh);
  const hit = raycaster.intersectObjects(vis, true)[0];
  if (hit) {
    let o = hit.object;
    while (o && !o.userData.unit) o = o.parent;
    if (o) return { x: o.userData.unit.x, z: o.userData.unit.z };
  }
  const p = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
  const x = Math.round(p.x), z = Math.round(p.z);
  return S.map && S.map.inB(x, z) ? { x, z } : null;
}

// 指標輸入：點一下 = 動作；拖曳 = 平移鏡頭（滑鼠左鍵或單指）；雙指 = 縮放/旋轉（OrbitControls）
// 觸控時沒有 hover，所以移動要「點一下預覽、同一格再點一下確認」
const downs = new Map();
let pendingTap = null;

function dragPan(dx, dy) {
  const fwd = controls.target.clone().sub(camera.position).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP);
  const scale = camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 / innerHeight;
  const d = right.multiplyScalar(-dx * scale).addScaledVector(fwd, dy * scale * 1.4);
  camGoal.add(d);
  controls.target.add(d);
  camera.position.add(d);
}

renderer.domElement.addEventListener('pointerdown', ev => {
  downs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, moved: false, type: ev.pointerType, button: ev.button });
  if (downs.size > 1) for (const d of downs.values()) d.moved = true; // 雙指手勢不算點擊
});

renderer.domElement.addEventListener('pointermove', ev => {
  const d = downs.get(ev.pointerId);
  if (d) {
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 10) d.moved = true;
    if (d.moved && downs.size === 1 && d.button === 0) dragPan(ev.clientX - d.lx, ev.clientY - d.ly);
    d.lx = ev.clientX;
    d.ly = ev.clientY;
  }
  if (ev.pointerType === 'touch') return;
  touchMode = false;
  lastMouse = { x: ev.clientX, y: ev.clientY };
  const t = pickTile(ev);
  if (t?.x !== S.hover?.x || t?.z !== S.hover?.z) { S.hover = t; updateHover(); }
});

const endPointer = ev => {
  const d = downs.get(ev.pointerId);
  downs.delete(ev.pointerId);
  if (ev.type === 'pointerup' && d && !d.moved && d.button === 0) onTap(ev, d.type === 'touch');
};
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);

function onTap(ev, touch) {
  if (S.busy || S.gameOver) return;
  const t = pickTile(ev);
  if (!t) return;
  const occ = unitAt(t.x, t.z);
  touchMode = touch;
  if (S.side === 'deploy') {
    if (occ && occ.team === 'player' && occ !== S.selected) { selectUnit(occ); return; }
    if (S.selected && S.deployZone.some(p => p.x === t.x && p.z === t.z)) deployTo(S.selected, t);
    return;
  }
  if (S.side !== 'player') return;
  if (S.mode === 'target') {
    const i = S.targets.findIndex(o => o.unit === occ);
    if (i < 0) return;
    if (i === S.targetIdx) fire(); else { S.targetIdx = i; updateTargeting(); }
    return;
  }
  if (occ && occ.team === 'player') { selectUnit(occ); return; }
  if (occ && occ.team === 'enemy' && occ.mesh.visible) { enterTargetMode(occ); return; }
  const u = S.selected;
  if (!canAct(u)) return;
  if (u.suppressed) { UI.toast('被壓制中，需先解除壓制'); return; }
  const mv = S.moves && S.moves.get(key(t.x, t.z));
  if (!mv) { pendingTap = null; S.hover = t; updateHover(); return; }
  if (touch && pendingTap !== key(t.x, t.z)) {
    // 第一下：預覽路線與反應射擊
    pendingTap = key(t.x, t.z);
    S.hover = t;
    updateHover();
    return;
  }
  pendingTap = null;
  playerMove(u, mv);
}
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) keys.add(k);
  if (k === 'q') camRot += Math.PI / 4;
  if (k === 'e') camRot -= Math.PI / 4;
  if (e.key === 'Tab') {
    e.preventDefault();
    if (S.mode === 'target') { S.targetIdx = (S.targetIdx + 1) % S.targets.length; updateTargeting(); }
    else if (S.side === 'player' && !S.busy) nextSoldier();
  }
  if (k === '1') actions.shoot();
  if (k === '2') actions.rally();
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (S.side === 'deploy') startBattle();
    else if (S.mode === 'target') fire();
  }
  if (e.key === 'Escape') cancelTarget();
  if (e.key === 'Backspace') { e.preventDefault(); actions.pass(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 62 : 42; // 直式螢幕視角放寬
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
onResize();

// ================= 標籤 / 漂浮文字 =================
const floats = [];
function floatText(u, text, cls) {
  floats.push({ d: UI.makeFloat(text, cls), pos: new THREE.Vector3(u.mesh.position.x, 1.8, u.mesh.position.z), t: 0 });
}

const tmpV = new THREE.Vector3();
function toScreen(v) {
  tmpV.copy(v).project(camera);
  return { x: (tmpV.x + 1) / 2 * innerWidth, y: (1 - tmpV.y) / 2 * innerHeight };
}

function updateLabels(dt) {
  for (const u of S.units) {
    if (!u.label) continue;
    const show = u.alive && u.mesh.visible;
    u.label.style.display = show ? '' : 'none';
    if (!show) continue;
    const p = toScreen(tmpV.set(u.mesh.position.x, 1.55 * u.mesh.scale.y, u.mesh.position.z));
    u.label.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    f.pos.y += dt * 0.6;
    const p = toScreen(f.pos);
    f.d.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    f.d.style.opacity = String(1 - Math.max(0, (f.t - 0.9) / 0.5));
    if (f.t > 1.4) { f.d.remove(); floats.splice(i, 1); }
  }
}

// ================= 主迴圈 =================
let last = performance.now(), time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  updateTweens(dt);
  updateCamera(dt);
  controls.update();

  const u = S.selected;
  selRing.visible = !!(u && u.alive && (S.side === 'player' || S.side === 'deploy'));
  if (selRing.visible) {
    selRing.position.set(u.mesh.position.x, 0.03, u.mesh.position.z);
    selRing.material.opacity = 0.6 + Math.sin(time * 5) * 0.3;
  }
  if (tgtRing.visible) tgtRing.rotation.y += dt * 1.5;
  reactMat.opacity = 0.6 + Math.sin(time * 8) * 0.3;

  updateLabels(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

newGame();
requestAnimationFrame(frame);
window.__game = { S, actions, camera, THREE }; // 除錯用
