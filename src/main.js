// 主動權制（Crossfire 式）單兵戰術：
// - 沒有回合。持有主動權的一方可任意行動，直到某個行動「失敗」才交給對方。
// - 失敗：主動射擊沒造成傷害；移動中被反應射擊命中。
// - 移動：任意角度直線走到任一格，路線要淨空；翻越半掩體是獨立行動。
// - 反應射擊：自動。每個敵人每次移動最多一槍，挑命中率最高的點（同分取離起點近的）。
//   反應射擊打空 → 該單位在這次主動權內不能再開槍。
// - 被命中 → 壓制：開槍與被打命中都下降、不能移動；解除壓制是一個行動（目前必定成功）。
// - 潛入：敵人一開始未警戒，只看自己的責任區、視距短、看不穿半掩體與隱蔽區。被看到或聽到槍聲才警戒。
// - 玩家武器有彈匣；換主武器、主武器換彈 → 交出主動權。手槍則不會。
// - 敵人衝動：主動權交回玩家時，這輪沒行動的敵人會做自己的衝動行為。
// - 魔法少女：7 人池子挑 5 人、每張地圖出 3 人；每人一個被動、一個魔法（每圖一次），兩條成長樹。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ITEMS, T, RULES, THEMES, ENEMY_TYPES, WEAPONS } from './config.js';
import { generateMap, ri, GameMap } from './map.js';
import { hasLOS, quietLOS, coverSides, coverAt, shotOdds, key, dist, clearMove, lineCells, vaultTargets, ORTH } from './grid.js';
import { makeUnitMesh, makeScarecrowMesh, makeCrowMesh, makeImpMesh, makeBiteMesh, makeNestMesh, addHalo, heartShape } from './units.js';
import * as UI from './ui.js';
import * as Camp from './campaign.js';
import * as HQ from './hq.js';
import * as Rec from './stats.js';
import * as TextUI from './textui.js';
import * as Scene from './scene.js';
import { GIRL, FAMILY, FAMILY_BY_ID, STORY } from './girls.js';

// ================= 場景 =================
// 畫面大小一律取 #app（position: fixed; inset: 0，和 HUD 同一個框），
// 不用 innerWidth/innerHeight：平板瀏覽器的網址列伸縮、頁面被捲動時兩者會對不上，點擊就會偏
const appEl = document.getElementById('app');
const view = { w: appEl.clientWidth || innerWidth, h: appEl.clientHeight || innerHeight };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(view.w, view.h);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, view.w / view.h, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 30;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = 1.2;
// 觸控：單指留給點擊/平移；雙指只縮放不旋轉（旋轉用 ⟲ ⟳ 按鈕，每次 45°）
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN }; // enablePan=false → 只剩縮放

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
const MAX_TILES = 900;
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

// 責任區 / 撤離點底色
const zoneMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }), 900);
zoneMesh.setColorAt(0, new THREE.Color());
zoneMesh.frustumCulled = false;
zoneMesh.count = 0;
overlay.add(zoneMesh);
const ZONE_C = new THREE.Color(0xffcc33), EXIT_C = new THREE.Color(0x3fe0b0);
const spotGeo = new THREE.RingGeometry(0.26, 0.4, 24).rotateX(-Math.PI / 2);
const spotMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0.9, depthWrite: false });
const spotLineMat = new THREE.LineDashedMaterial({ color: 0xffcc33, dashSize: 0.12, gapSize: 0.12, transparent: true, opacity: 0.8 });
const ORANGE = new THREE.Color(0xff9a3c);

// 詛咒格
const curseMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xb040ff, transparent: true, opacity: 0.45, depthWrite: false }), 64);
curseMesh.frustumCulled = false;
curseMesh.count = 0;
overlay.add(curseMesh);
const ICE_H = 0.8;

// ================= 狀態 =================
const S = {
  level: 1, initNo: 1, side: 'player', map: null, theme: THEMES[0],
  units: [], selected: null, mode: 'move', targets: [], targetIdx: 0,
  busy: false, moves: null, hover: null, roster: null, gameOver: false,
  mission: null, crates: [], objMesh: null, confirm: null,
  ice: [], curse: new Set(), waves: 0, opName: '', triple: false, magicOpts: null,
  quietSight: RULES.QUIET_SIGHT, buffs: [], genCopy: null, genOp: '',
};

const players = () => S.units.filter(u => u.team === 'player' && u.alive);
const enemies = () => S.units.filter(u => u.team === 'enemy' && u.alive);
const unitAt = (x, z) => S.units.find(u => u.alive && !u.flying && u.x === x && u.z === z); // 飛行的烏鴉不佔格
const occupied = (x, z, except) => S.units.some(u => u.alive && !u.flying && u !== except && u.x === x && u.z === z);
const canAct = u => !!u && u.alive && u.team === 'player' && !u.locked && !u.crowLocked && S.side === 'player' && !S.busy && !S.gameOver && S.mode === 'move';
const canMove = u => canAct(u) && !u.suppressed && !u.pinned;
const refresh = () => { syncBites(); markCrowAims(); UI.updateHUD(S); };
const weapon = u => u.team === 'player' ? u.weapons[u.wi] : u.gun;
const lv = (u, t) => (t === 'gun' ? u.gunLv : u.magicLv) || 0;
// 射手的條件骰數加減（成長樹、壓制加重）
function diceBonus(s) {
  let b = 0;
  if (s.girl === 'yukino' && s.raised && lv(s, 'gun') >= 2) b += 1;
  if (s.transformed && lv(s, 'gun') >= 4) b += 1;
  if (s.suppressed && s.heavySup) b -= 1;
  if (s.marked && s.markLv >= 1) b -= 1; // 被千夏標記（魔法 1）
  return b;
}
// 破防：打被壓制的敵人時，不算壓制給的那 1 級掩體
const breach = s => s.team === 'player' && lv(s, 'gun') >= ({ akane: 2, hikari: 3, momo: 3 }[s.girl] || 99);
// 千夏：這次主動權還沒移動過 → 視野 +3、看得穿迷霧
const keenEye = u => !!u && u.girl === 'chinatsu' && u.movedInit !== S.initNo;
const sees = (a, b) => hasLOS(S.map, a, b, keenEye(a) ? RULES.SIGHT + 3 : RULES.SIGHT, keenEye(a));
// 瞄準鏡：步槍、機槍、狙擊槍，這次主動權還沒移動過才有加值（反應射擊沒有）
const SCOPED = ['ar', 'lmg', 'hmg', 'sn'];
const scopeBonus = s => s.scope && s.movedInit !== S.initNo && SCOPED.includes(weapon(s).id) ? 15 : 0;
// 千夏的標記：隊友打被標記的敵人每顆骰 +10%（+15%）；千夏槍法 4 再 +1 骰
const markDie = (s, t) => s.team === 'player' && t.marked ? RULES.MARK_BONUS[t.markLv >= 4 ? 1 : 0] : 0;
const markDice = (s, t) => s.girl === 'chinatsu' && lv(s, 'gun') >= 4 && t.marked ? 1 : 0;
const oddsVs = (s, t, opts = {}) => shotOdds(S.map, s, s, t, {
  suppressed: !!t.suppressed, breach: breach(s), weapon: weapon(s), diceBonus: diceBonus(s) + markDice(s, t), dieBonus: (opts.reaction ? 0 : (t.bigTarget || 0) + scopeBonus(s)) + markDie(s, t), air: !!t.flying || !!t.wings, raised: !!t.raised, hardy: !!t.hardy, ...opts });
const iceAt = (x, z) => S.ice.find(i => i.x === x && i.z === z);
const isExit = p => S.mission && S.mission.exits.some(e => e.x === p.x && e.z === p.z);
const adjObjective = u => {
  const o = S.mission && S.mission.objective;
  return !!o && Math.abs(u.x - o.x) <= 1 && Math.abs(u.z - o.z) <= 1;
};
const canPlant = u => canAct(u) && S.mission.type === 'sabotage' && !S.mission.objective.planted && adjObjective(u);

// ================= 補間 / 動畫 =================
const tweens = [];
// 快速模式（文字介面用）：動畫瞬間完成，不必等畫面更新
let instant = false;
function tween(dur, fn) {
  if (instant) { fn(1); return Promise.resolve(); }
  return new Promise(res => tweens.push({ t: 0, dur, fn, res }));
}
const wait = s => tween(s, () => {});
// 方塊人的動作：單位的模型如果是方塊人（userData.rig），叫它播某個動作；舊模型就什麼都不做
const rigOf = u => u && u.mesh && u.mesh.userData.rig;
function anim(u, name, opt = {}) {
  const r = rigOf(u);
  if (!r || !r.clips[name]) return;
  if (r.clips[name].loop) u.mesh.userData.loop = name;      // 記住現在的常態動作，受傷完要回到它
  r.rate = opt.rate || 1;
  r.play(name, opt);
}
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
    if (map.isConceal(x, z)) c.lerp(new THREE.Color(th.conceal), 0.35).multiplyScalar(0.8);
    tiles.setColorAt(n, c);
    n++;
  }
  world.add(tiles);

  S.cellMesh = new Map(); // 每格掩體的模型（楓炸掉掩體時換掉）
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const t = map.get(x, z);
    const m = t === T.HALF ? makeHalf(th, x, z) : t === T.FULL ? makeFull(th, x, z) : null;
    if (m) { world.add(m); S.cellMesh.set(key(x, z), m); }
  }

  // 迷霧（卡蜜拉的「迷香」）
  const fogTiles = [];
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (map.isFog(x, z)) fogTiles.push([x, z]);
  if (fogTiles.length) {
    const fogMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.3, 1),
      new THREE.MeshStandardMaterial({ color: 0xb8a0d8, transparent: true, opacity: 0.38, depthWrite: false, roughness: 1 }), fogTiles.length);
    fogTiles.forEach(([x, z], i) => fogMesh.setMatrixAt(i, m4.makeTranslation(x, 0.65, z)));
    world.add(fogMesh);
  }

  // 隱蔽區：草叢/瓦礫的細長突起
  const cTiles = [];
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (map.isConceal(x, z)) cTiles.push([x, z]);
  if (cTiles.length) {
    const per = 7;
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.62, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), cTiles.length * per);
    tufts.castShadow = true;
    let i = 0;
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
    for (const [x, z] of cTiles) for (let j = 0; j < per; j++) {
      const hgt = 0.7 + Math.random() * 0.6;
      pos.set(x + (Math.random() - 0.5) * 0.85, 0.31 * hgt, z + (Math.random() - 0.5) * 0.85);
      q.setFromEuler(e.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4));
      sc.set(1, hgt, 1);
      tufts.setMatrixAt(i, m4.compose(pos, q, sc));
      tufts.setColorAt(i, c.set(th.conceal).multiplyScalar(0.75 + Math.random() * 0.4));
      i++;
    }
    world.add(tufts);
  }

  // 任務目標：終端機
  S.objMesh = null;
  const obj = S.mission.objective;
  if (obj) {
    const g = new THREE.Group();
    g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0x2c333b, roughness: 0.6 }))));
    g.children[0].position.y = 0.45;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x66ffcc, emissive: 0x33ffaa, emissiveIntensity: 1.4 }));
    scr.position.set(0, 0.62, 0.231);
    const scr2 = scr.clone(); scr2.rotation.y = Math.PI; scr2.position.z = -0.231;
    g.add(scr, scr2);
    g.userData.screen = scr.material;
    g.position.set(obj.x, 0, obj.z);
    world.add(g);
    S.objMesh = g;
  }

  // 補給箱
  for (const cr of S.crates) {
    const ammo = cr.type === 'ammo';
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.32),
      new THREE.MeshStandardMaterial({ color: ammo ? 0x4f6b3a : 0xe8e8e8, roughness: 0.7 }));
    box.position.y = 0.14;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(ammo ? 0.3 : 0.2, 0.02, ammo ? 0.08 : 0.06),
      new THREE.MeshStandardMaterial({ color: ammo ? 0xffcf3a : 0xd03030, emissive: ammo ? 0x664400 : 0x500000 }));
    mark.position.y = 0.29;
    g.add(shadowed(box), mark);
    if (!ammo) { const m2 = mark.clone(); m2.rotation.y = Math.PI / 2; g.add(m2); }
    g.position.set(cr.x, 0, cr.z);
    world.add(g);
    cr.mesh = g;
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
function meshFor(u) {
  if (u.kind === 'scarecrow') return makeScarecrowMesh(u.color, u.scale || 1);
  if (u.kind === 'crows') return makeCrowMesh(u.maxHp);
  if (u.kind === 'imp') return makeImpMesh();
  if (u.kind === 'bites') return makeBiteMesh();
  if (u.kind === 'nest') return makeNestMesh();
  const m = makeUnitMesh(u.team, u.kind, u.color, u.weapons ? u.weapons[u.wi].id : 'ar', u.scale || 1,
    { hair: u.hair, girl: u.girl, boss: !!u.boss, mother: u.kind === 'b_mother' });
  if (u.transformed) addHalo(m);
  return m;
}

function spawnUnit(u) {
  u.mesh = meshFor(u);
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

function makeWeapon(id) {
  const w = WEAPONS[id];
  return { ...w, id, ammo: w.mag, reserve: w.sidearm ? Infinity : w.reserve };
}

// 依槍法樹組裝武器（每張地圖都補滿）
function outfit(d, gs) {
  const ws = d.weapons.map(makeWeapon);
  const p = ws[0], g = gs.gun;
  if (d.id === 'akane') {
    if (g >= 1) p.dieMod = (p.dieMod || 0) + 5;
    if (g >= 3) p.closeDice = 1;
    if (g >= 4) p.noReactPenalty = true;
  } else if (d.id === 'hikari') {
    if (g >= 1) p.dieMod = (p.dieMod || 0) + 5;
    if (g >= 2) p.reserve += 6;
  } else if (d.id === 'yukino') {
    if (g >= 1) { p.mag += 3; p.ammo = p.mag; }
    if (g >= 3) p.keepFiring = true;
  } else if (d.id === 'momo') {
    if (g >= 1) p.sweetDice += 1;
    if (g >= 2) ws[1].dice += 1;
    if (g >= 4) ws[1].canReact = true;
  } else if (d.id === 'chinatsu') {
    if (g >= 1) p.dieMod = (p.dieMod || 0) + 5;
    if (g >= 2) { p.mag += 1; p.ammo = p.mag; p.reserve += 4; }
    if (g >= 3) p.closeDice = 0;
    if (g >= 5) p.canReact = true;
  } else if (d.id === 'kaede') {
    ws[1].sidearm = true; ws[1].reserve = Infinity; // 霰彈槍是她的副武器：快速切換、無限備彈
    if (g >= 1) p.noFriendly = true;
    if (g >= 2) { p.mag += 1; p.ammo = p.mag; p.reserve += 3; }
    if (g >= 3) p.pierce = 2;
    if (g >= 4) ws[1].dice += 1;
    if (g >= 5) p.rubbleSure = true;
  } else if (d.id === 'shiori') {
    if (g >= 1) p.sweetDice += 1;
    if (g >= 2) p.spraySure = true;
    if (g >= 3) p.noReactPenalty = true;
    if (g >= 4) p.dieMod = (p.dieMod || 0) + 5;
    if (g >= 5) { p.mag += 4; p.ammo = p.mag; p.reserve += 8; }
  }
  return ws;
}

function makeGirlUnit(gs) {
  const d = GIRL[gs.id];
  const u = baseGirlUnit(gs, d);
  // 道具與裝備（每人 3 格）：裝備直接生效，消耗品放進 u.items
  const slots = gs.slots || [];
  if (slots.includes('vest')) { u.maxHp += RULES.HEART_HP; u.hp += RULES.HEART_HP; }
  if (slots.includes('mag')) { const p = u.weapons[0]; p.mag += 2; p.ammo = p.mag; if (isFinite(p.reserve)) p.reserve += 4; }
  if (slots.includes('scope')) u.scope = true;
  if (slots.includes('reddot')) for (const w of u.weapons) if (w.sidearm || w.id === 'duals') w.dieMod = (w.dieMod || 0) + 5;
  if (d.ability === 'bless') u.uses = u.usesMax = 2 + (gs.magic >= 4 ? 1 : 0); // 詩織的祝福：每張地圖 2 次（魔法 4：3 次）
  u.items = slots.filter(k => ITEMS[k] && ITEMS[k].kind === 'use');
  u.gear = slots.filter(k => ITEMS[k] && ITEMS[k].kind === 'gear');
  return u;
}
function baseGirlUnit(gs, d) {
  return {
    girl: d.id, name: d.name, title: d.title, color: d.color, hair: d.hair, team: 'player', kind: 'girl',
    maxHp: d.maxHp, hp: gs.hp, gunLv: gs.gun, magicLv: gs.magic, stress: 0, pinned: false,
    ability: d.ability, weapons: outfit(d, gs), wi: 0,
    uses: gs.magic >= 5 && d.ability !== 'transform' ? 2 : 1,
    usesMax: gs.magic >= 5 && d.ability !== 'transform' ? 2 : 1,
    dodge: d.id === 'akane' ? 1 : 0, dodgeMax: d.id === 'akane' ? 1 : 0, dashDodge: 0, hardy: d.id === 'momo',
    transformed: false, raised: false,
    // 愛心：一顆心 = HEART_HP 點；第一次掉到一半愛心（往下取整）時觸發心線
    // 心線：以上場時的心數算一半（帶傷上場也有一次保險；只剩一顆心就沒有）
    heartHp: RULES.HEART_HP, lineHp: Math.floor(Math.ceil(gs.hp / RULES.HEART_HP) / 2) * RULES.HEART_HP,
    lineUsed: Math.floor(Math.ceil(gs.hp / RULES.HEART_HP) / 2) === 0,
  };
}

const memberOf = type => (FAMILY.find(m => m.boss === type) || {}).id || null;
// 敵人編號：照生成順序，跳過和地圖符號容易混淆的 c i l o x
const ENEMY_TAGS = '123456789abdefghjkmnpqrstuvwyz';

function spawnEnemy(type, x, z, zone, alerted = false) {
  const tpl = ENEMY_TYPES[type];
  const n = S.units.filter(o => o.team === 'enemy').length;
  const tag = ENEMY_TAGS[n] || '#' + (n + 1);
  const u = { ...tpl, kind: type, team: 'enemy', hp: tpl.maxHp, stress: 0, pinned: false, tag,
    name: tpl.boss ? tpl.name : tpl.name + tag,
    gun: { dice: tpl.dice, sweetDice: tpl.sweetDice, canReact: tpl.canReact !== false, keepFiring: !!tpl.keepFiring,
      ignoreHalf: !!tpl.ignoreHalf, ammo: Infinity, mag: Infinity, ...(tpl.gunX || {}) },
    x, z, alive: true, suppressed: false, firedOut: false, alerted, spotted: false, zone, member: memberOf(type),
    // 頭目血條分 3 段（由高到低的分段點）
    cuts: tpl.boss ? [Math.round(tpl.maxHp * 2 / 3), Math.round(tpl.maxHp / 3)] : null, phase: 1,
    // 不留活口（執行人的加持）：每次主動權第一次反應射擊打空不停火
    execBuff: S.buffs.includes('exec') && !tpl.keepFiring, spareUsed: false,
    // 稻草人：身上的烏鴉數、恢復進度、放出去的烏鴉群
    crows: type === 'scarecrow' ? RULES.CROW_MAX : 0, crowMax: RULES.CROW_MAX, regen: 0, flock: null };
  // 反制：鐵拳（打手生命 +1）、護具（打手裝甲 1）
  if (type === 'brawler') { u.maxHp += Camp.mod('bfist'); u.hp = u.maxHp; if (Camp.mod('bguard')) u.armor = 1; }
  // 反制：防彈衣（槍手 1 點裝甲）、精銳化（小弟變老手）。增援也一樣
  if (Camp.mod('kevlar') && type === 'gunman') u.armor = 1;
  if (Camp.mod('elite') && type === 'conscript') { u.act = 60; u.q = '老手'; }
  spawnUnit(u);
  return u;
}

// 地圖存進存檔用：typed array 轉成一般陣列、主題存索引
function packGen(g) {
  const { map, theme, ...rest } = g;
  return JSON.parse(JSON.stringify({ ...rest, theme: THEMES.indexOf(theme),
    map: { w: map.w, h: map.h, tiles: Array.from(map.tiles), conceal: Array.from(map.conceal), zone: Array.from(map.zone) } }));
}
function unpackGen(p) {
  const m = new GameMap(p.map.w, p.map.h);
  m.tiles.set(p.map.tiles);
  m.conceal.set(p.map.conceal);
  m.zone.set(p.map.zone);
  const g = JSON.parse(JSON.stringify(p));
  return { ...g, map: m, theme: THEMES[p.theme] || THEMES[0], curse: g.curse || [], fog: g.fog || [] };
}

function cloneGen(g) {
  const m = new GameMap(g.map.w, g.map.h);
  m.tiles.set(g.map.tiles);
  m.conceal.set(g.map.conceal);
  m.zone.set(g.map.zone);
  return { ...g, map: m, enemies: g.enemies.map(e => ({ ...e })), crates: g.crates.map(c => ({ x: c.x, z: c.z, type: c.type })),
    mission: JSON.parse(JSON.stringify(g.mission)), curse: [...(g.curse || [])] };
}

function pickCurse(gen) {
  const m = gen.map, out = [];
  const bad = new Set(gen.enemies.map(e => key(e.x, e.z)));
  for (let t = 0; t < 500 && out.length < RULES.CURSE_TILES; t++) {
    const x = ri(4, m.w - 2), z = ri(0, m.h - 1), k = key(x, z);
    if (m.walkable(x, z) && !bad.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

// 迷霧：幾片隨機漫步的區塊（不在部署區）
function pickFog(gen) {
  const m = gen.map, out = new Set();
  const bad = new Set(gen.enemies.map(e => key(e.x, e.z)));
  for (let i = 0; i < RULES.FOG_PATCHES; i++) {
    let x = ri(5, m.w - 2), z = ri(0, m.h - 1);
    const len = ri(4, 6);
    for (let j = 0, n = 0; j < 30 && n < len; j++) {
      if (m.walkable(x, z) && !out.has(key(x, z))) { out.add(key(x, z)); n++; }
      const [dx, dz] = ORTH[ri(0, 3)];
      x = Math.max(5, Math.min(m.w - 1, x + dx));
      z = Math.max(0, Math.min(m.h - 1, z + dz));
    }
  }
  return [...out].filter(k => !bad.has(k) || Math.random() < 0.5); // 有些崗哨就站在霧裡
}

function drawCurse() {
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (const k of S.curse) {
    if (n >= 64) break;
    const [x, z] = k.split(',').map(Number);
    m4.makeTranslation(x, 0.02, z);
    curseMesh.setMatrixAt(n++, m4);
  }
  curseMesh.count = n;
  curseMesh.instanceMatrix.needsUpdate = true;
}

// ================= 任務流程 =================
function enterHQ(notes = []) {
  HQ.showHQ(startMission, notes);
}

function startMission() {
  const C = Camp.C, op = C.op;
  clearUnits();
  S.ice = [];
  S.buffs = Camp.activeBuffs(op);
  S.quietSight = (S.buffs.includes('eye') ? 7 : RULES.QUIET_SIGHT) + 2 * Camp.mod('sight'); // 反制「監視網」
  S.actBonus = 5 * Camp.mod('drill'); // 反制「操練」
  const opKey = op.kind + ':' + op.name;
  let gen;
  const story = C.mode === 'story';
  if (op.kind === 'boss' && story) Camp.markBoss(op.member); // 記下頭目的出場順序
  const retryGen = story ? (op.retry && C.lostGen) : (C.retry && C.retryOp === opKey && C.retryGen);
  if (retryGen) gen = unpackGen(retryGen);
  else {
    const extra = [];
    let type;
    if (op.kind === 'boss') { const b = FAMILY_BY_ID[op.member].boss; type = 'hunt'; extra.push([b, ...(ENEMY_TYPES[b].escort || ['gunman'])]); }
    else if (op.kind === 'finale') {
      type = 'hunt';
      extra.push(['b_mother', 'brute']);
      // 沒在據點解決掉的成員，和教母一起在莊園等著
      if (story) for (const m of C.members.filter(x => x.alive)) extra.push([FAMILY_BY_ID[m.id].boss]);
    } else if (op.kind === 'manor') {
      const alive = C.members.filter(m => m.alive);
      if (alive.length && Math.random() < 0.5) extra.push([FAMILY_BY_ID[alive[ri(0, alive.length - 1)].id].boss]);
    } else if (op.kind === 'facility' && story && op.member && Math.random() < Camp.appearChance(op.member)) {
      extra.push([FAMILY_BY_ID[op.member].boss, 'gunman']); // 成員親自現身（天選者），帶 1 名護衛
    }
    gen = generateMap(Camp.level(op), { type, extra, bonus: 2 * S.buffs.filter(b => b === 'book').length + Camp.mod('extra') + RULES.SQUAD_EXTRA });
    gen.curse = S.buffs.includes('sis') ? pickCurse(gen) : [];
    gen.fog = S.buffs.includes('perfume') ? pickFog(gen) : [];
    // 桃樂絲的「提線」：每張地圖至少 1 具人偶
    if (S.buffs.includes('puppet') && !gen.enemies.some(p => p.type === 'doll')) {
      const pref = gen.enemies.filter(p => p.type === 'gunman' || p.type === 'zealot');
      const c = pref.length ? pref : gen.enemies.filter(p => !ENEMY_TYPES[p.type].boss && !['officer', 'scarecrow', 'crows'].includes(p.type));
      if (c.length) c[ri(0, c.length - 1)].type = 'doll';
    }
    gen.theme = THEMES[ri(0, THEMES.length - 1)];
    gen.conds = ['facility', 'stop', 'growth'].includes(op.kind) ? facilityConds(gen, Camp.level(op)) : [];
    // 反制「重裝化」：每層把 1 名槍手換成重裝兵；「封鎖補給」：補給箱減半
    for (let i = 0; i < Camp.mod('armor'); i++) { const g = gen.enemies.find(p => p.type === 'gunman'); if (g) g.type = 'brute'; }
    for (let i = 0; i < Camp.mod('countersnipe'); i++) { const g = gen.enemies.find(p => p.type === 'gunman'); if (g) g.type = 'sniper'; }
    if (Camp.mod('supply')) gen.crates = gen.crates.filter((_, i) => i % 2 === 0);
    C.retryGen = packGen(gen); // 輸了要重打同一張：存進存檔，重新載入也不會換圖
    C.retryOp = opKey;
    Camp.save();
  }
  S.map = gen.map;
  S.map.fog.fill(0);
  for (const k of gen.fog || []) { const [x, z] = k.split(',').map(Number); S.map.setFog(x, z, 1); }
  S.lastShooter = null;
  S.idlePasses = 0;
  S.stallWaves = 0;
  S.mission = gen.mission;
  S.crates = gen.crates;
  S.theme = gen.theme;
  S.curse = new Set(gen.curse);
  S.waves = op.kind === 'finale' ? C.production : 0;
  S.conds = gen.conds || [];
  S.lvl = Camp.level(op);
  S.airdrop = Camp.mod('airdrop') ? { count: 0, mark: null, mesh: null } : null;
  S.condTimer = S.conds.includes('timer') ? { every: RULES.FAC_TIMER[Camp.level(op) >= 9 ? 1 : 0], count: null } : null;
  S.opName = op.name;
  S.triple = false;
  S.gameOver = false;
  buildWorld();
  drawCurse();

  C.deploy.forEach((id, i) => {
    const u = makeGirlUnit(Camp.girlState(id));
    const sp = gen.playerSpawns[i] || gen.deployZone[gen.deployZone.length - 1 - i]; // 舊存檔的地圖只有 2 個出生點
    Object.assign(u, { x: sp.x, z: sp.z, alive: true, suppressed: false, firedOut: false });
    spawnUnit(u);
  });
  for (const p of gen.enemies) {
    const mid = memberOf(p.type);
    if (mid && C.mode === 'story' && !C.members.find(m => m.id === mid).alive) continue;
    const e = spawnEnemy(p.type, p.x, p.z, p.zone);
    if (e.boss && S.mission.type === 'hunt' && (!S.mission.boss || (op.kind === 'finale' && e.kind === 'b_mother'))) { S.mission.boss = e; S.mission.bossName = e.name; }
  }
  S.appeared = [];
  for (const e of enemies()) if (e.boss) tuneBoss(e, op);
  // 敵人變聰明：難度 SMART_LEVEL 起（或反制「散兵戰術」）
  S.smart = Camp.level(op) >= RULES.SMART_LEVEL || Camp.mod('skirmish') > 0;
  // 反制「防彈衣」「精銳化」在 spawnEnemy 套用（增援也算）

  const p0 = gen.playerSpawns[0];
  controls.target.set(p0.x + 3, 0, p0.z);
  const near = camera.aspect < 0.8 ? 0.62 : 1; // 直式手機：預設拉近
  camera.position.set(p0.x + 3, 14 * near, p0.z + 11 * near);
  focusOn(p0.x + 3, p0.z);

  UI.clearLog();
  Rec.begin({ op: S.opName, map: S.theme.name, level: Camp.level(op),
    girls: players().map(u => u.name).join('、'),
    enemies: Object.entries(enemies().reduce((a, e) => { const n = ENEMY_TYPES[e.kind].name; a[n] = (a[n] || 0) + 1; return a; }, {})).map(([n, c]) => `${n}×${c}`).join('、') });
  UI.log(`── ${S.opName}：${S.theme.name}（敵人 ${enemies().length}）──`, 'sys');
  UI.log(UI.missionText(S.mission) + (S.mission.type === 'sabotage' ? '，再撤回左側' : ''), 'sys');
  if (S.buffs.length) UI.log('家族加持：' + [...new Set(S.buffs)].map(b => FAMILY_BY_ID[b].buff).join('、'), 'warn');
  if (S.waves) UI.log(`增援會分 ${S.waves} 波抵達`, 'warn');
  for (const c of S.conds) UI.log('設施條件：' + COND_TEXT[c](), 'warn');
  for (const e of enemies()) if (e.appearance) { UI.log(`${e.name} 親自現身了！打掉她這段生命就能把她擊退（不擊退也能完成任務）`, 'warn'); UI.banner(`${e.name} 現身！`, 'enemy'); }
  if (enemies().some(e => e.member && !e.appearance) && S.mission.type !== 'hunt') UI.log('有家族成員在場！打倒她可以拔掉加持', 'warn');
  S.initNo = 0;
  S.deployZone = gen.deployZone;
  S.side = 'deploy';
  S.busy = false;
  updateVisibility();
  UI.banner(S.mission.type === 'hunt' ? `任務：打倒${S.mission.bossName}` : S.mission.type === 'extract' ? '任務：突破撤離' : '任務：破壞終端', 'player');
  UI.log('部署：點角色再點綠色格子擺位，按「開始行動」', 'sys');
  selectUnit(players()[0]);
  missionTalk();
}

// ================= 劇情演出（台詞） =================
// 說話時：記到戰鬥紀錄；戰鬥演出時鏡頭轉向說話的人
const sayHook = { onLine: (st, sp) => {
  UI.log(`${st.name || sp.name}：「${st.text}」`, 'sys');
  const u = S.units && S.units.find(o => o.alive && o.mesh && (o.girl === st.who || o.kind === st.who || o.member === st.who));
  if (u && u.mesh.visible !== false) focusUnit(u);
} };
const GIRL_TALK = {
  start: {
    akane: ['好，上吧！動作快就不會被發現！', '我打頭陣，大家跟上！'],
    hikari: ['大家小心，我們一個一個慢慢解決。', '不管對手是誰，我們一定會贏！'],
    yukino: ['……風向不錯，腳步聲傳不過去。', '保持距離，我來掩護。'],
    momo: ['哼，這種地方三兩下就搞定了啦！', '誰先被發現誰請吃可麗餅！'],
    chinatsu: ['崗哨的位置記下來了，照計畫走。', '先找高處，我負責看。'],
    kaede: ['哈！找到要炸的東西就交給我！', '牆擋路的話，炸開就好！'],
    shiori: ['大家……要平安回來喔。', '我會跟在後面，受傷了就叫我。'],
  },
  spotted: {
    akane: ['被發現了！既然這樣就正面衝！'], hikari: ['被發現了！大家找掩體！'], yukino: ['……被看到了。壓低身體。'],
    momo: ['可惡，被發現了啦！'], chinatsu: ['暴露了。改成速戰速決。'], kaede: ['好啊，熱鬧起來了！'], shiori: ['哇、被、被看到了！'],
  },
  brawler: {
    akane: ['有人拿著球棒衝過來了！'], hikari: ['近戰的傢伙衝過來了，先攔住他！'], yukino: ['……有人在跑過來。不要讓他靠近。'],
    momo: ['拿球棒的笨蛋衝過來了！'], chinatsu: ['打手出動了。反應射擊準備。'], kaede: ['來得好，正面接他！'], shiori: ['有、有人衝過來了！'],
  },
};
const pickLine = (kind, u) => { const ls = GIRL_TALK[kind][u.girl] || ['……']; return ls[ri(0, ls.length - 1)]; };
function girlRadio(kind) {
  const ps = players();
  if (!ps.length) return;
  const u = ps[ri(0, ps.length - 1)];
  Scene.radio([{ who: u.girl, text: pickLine(kind, u) }], sayHook);
}
// 任務開始：家族成員在場就演一段（戰鬥畫面當背景），不然用無線電講一句
function missionTalk() {
  const boss = enemies().find(e => e.boss && e.member && (e.appearance || S.mission.type === 'hunt'));
  if (boss) {
    const m = FAMILY_BY_ID[boss.member];
    const g = players()[0];
    const reply = { akane: '少廢話，接招吧！', hikari: '我們不會讓妳得逞的！', yukino: '……妳的話，太多了。', momo: '吵死了，看我把妳打飛！',
      chinatsu: '目標確認。開始行動。', kaede: '正好，我早就想跟妳打一場了！', shiori: '請、請妳收手吧！' }[g.girl] || '上吧！';
    S.busy = true;
    Scene.battle([{ who: boss.member, name: `${m.title}・${m.name}`, text: m.line.replace(/^「|」$/g, '') }, { who: g.girl, text: reply }], sayHook)
      .then(() => { S.busy = false; if (S.selected) focusUnit(S.selected); });
    return;
  }
  girlRadio('start');
}

function startBattle() {
  if (S.side !== 'deploy' || S.gameOver) return;
  clearOverlays();
  updateVisibility();
  detect();
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

function checkEnd() {
  if (S.gameOver) return true;
  const ps = players();
  if (!ps.length || ps.every(p => p.crowLocked)) {
    if (ps.length) UI.log('最後一個人也被烏鴉纏住了，沒有人能救她', 'bad');
    S.gameOver = true;
    clearOverlays();
    setTimeout(() => endMission(false, ps.length ? '最後一個人被烏鴉纏住了，沒有人能救她' : ''), 900);
    return true;
  }
  const hunt = S.mission.type === 'hunt';
  const bossDown = hunt && S.mission.boss && !S.mission.boss.alive;
  const cleared = !enemies().some(e => !e.summon) && !S.waves;
  const objDone = S.mission.type !== 'sabotage' || S.mission.objective.planted;
  const out = !hunt && objDone && ps.every(isExit);
  if (cleared || bossDown || out) {
    S.gameOver = true;
    clearOverlays();
    const why = bossDown ? `${S.mission.bossName} 被打倒了` : cleared ? '區域已清除'
      : (S.mission.type === 'extract' ? '小隊成功突破撤離' : '終端已破壞，小隊成功撤離');
    setTimeout(() => endMission(true, why), 900);
    return true;
  }
  return false;
}

function endMission(win, why) {
  Rec.end(win ? `勝利（${why}）` : '失敗');
  const girls = S.units.filter(u => u.girl);
  const hp = {};
  for (const u of girls) hp[u.girl] = u.alive ? Math.max(1, Math.min(u.hp, GIRL[u.girl].maxHp)) : 0;
  const killed = S.units.filter(u => u.member && !u.alive && !u.fled).map(u => u.member);
  const detour = false;
  const repelled = S.units.filter(u => u.repelled).map(u => u.member);
  const kills = S.units.filter(u => u.team === 'enemy' && !u.summon && !u.alive && !u.fled).length;
  const notes = Camp.finish({ win, deployed: girls.map(u => u.girl), hp, downed: girls.filter(u => !u.alive).map(u => u.girl), killed,
    repelled, appeared: S.appeared || [], kills, bossPhase: S.mission.boss ? S.mission.boss.phase : 0 });
  const rows = girls.map(u => {
    const now = Camp.girlState(u.girl).hp;
    return `<li>${u.name}：${u.alive ? `HP ${hp[u.girl]}${now !== hp[u.girl] ? ` → ${now}` : ''}/${GIRL[u.girl].maxHp}` : '倒下後送'}</li>`;
  }).join('');
  const body = (win ? `<p>${why}。主動權共 ${S.initNo} 次（易手 ${S.initNo - 1} 次）。</p>` : `<p>${why || '上場的人都倒下了'}。${Camp.C.mode === 'story' ? '這場留在作戰清單上，可以重打，也可以先做別的事。' : '這張地圖要重打。'}</p>`) +
    `<ul>${rows}</ul>` + (notes.length ? `<ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : '') +
    (win ? '<p style="opacity:.6">彈藥會在下張地圖補滿。</p>' : '') +
    '<p class="rec-btns"><button class="rec-dl">匯出這場紀錄</button> <button class="rec-cp">複製</button></p>';
  UI.showOverlay(win ? '任務完成' : '任務失敗', body, '回到作戰室 ▶', () => {
    const C = Camp.C;
    if (C.mode === 'story' && C.phase === 'manor' && !C.seenManor) {
      C.seenManor = true;
      Camp.save();
      HQ.showStory('退守莊園', STORY.manor, '回到作戰室 ▶', () => enterHQ());
    } else enterHQ();
  });
}

// ================= 主動權 =================
async function giveInitiative(side) {
  if (S.gameOver) return;
  for (const u of S.units) { u.firedOut = false; u.spareUsed = false; u.shield = false; u.locked = false; u.shotsUsed = 0; u.shotAt = null; u.steady = false; u.scouted = false; u.meleeDone = false; }
  S.grab = false;       // 心線：要把主動權搶回我方
  S.forceEnemy = false; // 頭目突破階段：主動權要交給敵方
  S.initDeaths = 0;     // 這次主動權內倒下的敵人數（啟動檢定用）
  S.initNo++;
  S.side = side;
  Rec.initiative(side, S.initNo, players());
  S.mode = 'move';
  S.magicOpts = null;
  UI.hideTargeting();
  clearOverlays();

  if (side === 'player') {
    if (S.waves > 0 && enemies().length <= 4) { S.busy = true; await spawnWave(); }
    S.busy = false;
    UI.banner('我方取得主動權', 'player');
    const free = players().filter(p => !p.crowLocked);
    selectUnit(S.selected && free.includes(S.selected) ? S.selected : (free[0] || players()[0]));
    return;
  }

  S.busy = true;
  S.selected = null;
  await reviveDolls();
  refresh();
  await facilityTimer();
  await nestTick();
  await airdropLand();
  const anyAlert = enemies().some(e => e.alerted);
  if (anyAlert) { UI.banner('敵方取得主動權', 'enemy'); await wait(0.8); }
  const failed = await enemyInitiative();
  if (!S.gameOver) await biteCheck(); // 交出主動權：咬著的使魔咬傷判定
  if (!S.gameOver) airdropPlan();
  if (S.gameOver || checkEnd()) return;
  await wait(0.3);
  giveInitiative('player');
}

// 一個行動結束後：成功 → 繼續；失敗 → 交出主動權
// actor：做這個行動的角色（光的變身只看她自己的失敗）
async function resolvePlayerAction(ok, actor = null) {
  for (const e of enemies()) e.shield = false; // 頭目的階段護盾只撐到這個行動結束
  refresh();
  if (S.waves > 0 && !enemies().length && !S.gameOver) await spawnWave();
  if (checkEnd()) { Rec.playerAct(ok); return; }
  if (S.forceEnemy) {
    Rec.playerAct(ok, '頭目階段');
    S.forceEnemy = false;
    S.grab = false;
    UI.log('頭目突破了階段，主動權交給敵方', 'warn');
    await wait(0.5);
    giveInitiative('enemy');
    return;
  }
  let saved = '';
  const realOk = ok; // 心線、變身救回來的失敗不觸發偵查
  if (!ok && S.grab) {
    S.grab = false;
    UI.log('心線：這次行動不算失敗，主動權留在我方', 'good');
    ok = true;
    saved = '心線';
  }
  S.grab = false;
  if (!ok && actor && actor.alive && actor.ability === 'transform' && !actor.transformed) {
    S.busy = true;
    await transform(actor, false);
    S.busy = false;
    ok = true;
    saved = '變身';
  }
  Rec.playerAct(ok, saved);
  if (!ok) {
    UI.log('行動失敗，交出主動權', 'warn');
    await wait(0.5);
    giveInitiative('enemy');
    return;
  }
  crowTick();
  if (realOk && await scoutCheck(actor || S.selected)) return; // 使魔偵查：搶走主動權（不算失敗）
  // 人偶／烏鴉：被纏住的少女不能行動；全員都被纏住就交出主動權（不算失敗）
  const free = players().filter(p => !p.locked && !p.crowLocked);
  if (!free.length) {
    UI.log('大家都被人偶纏住了，主動權交給敵方', 'warn');
    await wait(0.5);
    giveInitiative('enemy');
    return;
  }
  selectUnit(S.selected && S.selected.alive && !S.selected.locked ? S.selected : free[0]);
}

// ================= 視野 / 警覺 =================
// 我方永遠算警戒中：用完整視線看敵人。看到敵人不會驚動他。
function updateVisibility() {
  const ps = players();
  syncBites();
  for (const e of enemies()) {
    const vis = !!e.marked || e.biteCluster || ps.some(p => sees(p, e)); // 被標記的敵人一直看得到
    e.mesh.visible = vis;
    if (vis) e.spotted = true;
  }
  drawZones();
}

// 未警戒的敵人看不看得到 p：只看自己的責任區、視距短、看不穿半掩體與隱蔽區
const quietSees = (e, p) => S.map.zoneAt(p.x, p.z) === e.zone && quietLOS(S.map, e, p, S.quietSight);

function alertEnemies(list, why) {
  const fresh = list.filter(e => e.alive && !e.alerted);
  if (!fresh.length) return false;
  const firstAlarm = !enemies().some(e => e.alerted && !e.nest && !e.biteCluster) && fresh.some(e => !e.nest);
  // 打手：只要哪裡響起警報，全圖的打手都會醒來衝過來
  const brs = enemies().filter(e => e.brawler && !e.alerted && !fresh.includes(e));
  if (brs.length) { UI.log(`${brs.length} 名打手聽到動靜，衝過來了`, 'warn'); girlRadio('brawler'); }
  for (const e of fresh.concat(brs)) {
    e.alerted = true;
    if (e.mesh.visible) floatText(e, '！警戒', 'sup');
    if (e.label) UI.updateLabel(e.label, e);
  }
  if (firstAlarm) for (const n of enemies().filter(e => e.nest)) hatch(n, true); // 警報一響，巢穴立刻多孵一次
  if (S.condTimer && S.condTimer.count === null) {
    S.condTimer.count = 0;
    UI.log(`警報響了：之後每 ${S.condTimer.every} 個敵方主動權，會有 2 名增援從撤離點那一側趕到`, 'warn');
  }
  if (why === 'spot') {
    girlRadio('spotted');
    UI.banner('被發現了！', 'enemy');
    UI.log('被發現了！敵人進入警戒', 'warn');
  } else if (why === 'noise') {
    UI.log(`槍聲驚動了 ${fresh.length} 名敵人`, 'warn');
  }
  drawZones();
  return true;
}

// 檢查有沒有未警戒的敵人看到我方。被看到的敵人會呼叫同責任區的同伴。
function detect() {
  const ps = players();
  const found = enemies().filter(e => !e.alerted && ps.some(p => quietSees(e, p)));
  if (!found.length) return false;
  const zones = new Set(found.map(e => e.zone));
  const hunt = S.buffs.includes('hound'); // 艾琳娜的「追獵」：全圖警戒
  if (hunt) UI.log('家族加持「追獵」：全圖的敵人都被叫醒了', 'warn');
  alertEnemies(enemies().filter(e => hunt || zones.has(e.zone)), 'spot');
  return true;
}

function makeNoise(...where) {
  alertEnemies(enemies().filter(e => where.some(p => dist(e, p) <= RULES.NOISE)), 'noise');
}

// 已知（看過）且未警戒的敵人，畫出他們的責任區；撤離點也畫出來
function drawZones() {
  if (!S.map) return;
  const zs = new Set(enemies().filter(e => !e.alerted && e.spotted).map(e => e.zone));
  const ex = new Set(S.mission.exits.map(p => key(p.x, p.z)));
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
    if (!S.map.walkable(x, z) || n >= 900) continue;
    const isEx = ex.has(key(x, z));
    if (!isEx && !zs.has(S.map.zoneAt(x, z))) continue;
    m4.makeTranslation(x, 0.008, z);
    zoneMesh.setMatrixAt(n, m4);
    zoneMesh.setColorAt(n, isEx ? EXIT_C : ZONE_C);
    n++;
  }
  zoneMesh.count = n;
  zoneMesh.instanceMatrix.needsUpdate = true;
  if (zoneMesh.instanceColor) zoneMesh.instanceColor.needsUpdate = true;
}

// ================= 移動 + 反應射擊 =================
function moveOptions(u) {
  const blocked = (x, z) => occupied(x, z, u);
  const out = new Map();
  if (u.frozen || u.immobile) return out; // 被抬到冰塊上的敵人、稻草人不能移動
  const far = p => u.moveRange && dist(u, p) > u.moveRange + 0.01; // 人偶：移動距離短
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
    if (!far({ x, z }) && clearMove(S.map, u, { x, z }, blocked)) out.set(key(x, z), { x, z, vault: false });
  }
  for (const v of vaultTargets(S.map, u, blocked)) {
    if (!far(v) && !out.has(key(v.x, v.z))) out.set(key(v.x, v.z), { ...v, vault: true });
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
    // 被壓制中的單位抬不起頭，不能反應射擊
    if (!r.alive || r.team === mover.team || r.firedOut || r.suppressed || r.crowLocked) continue;
    if (r.team === 'enemy' && !r.alerted) continue;
    // 我方不會對還沒察覺的敵人自動開槍（會暴露位置）
    if (r.team === 'player' && mover.team === 'enemy' && !mover.alerted) continue;
    if (knownOnly && r.team === 'enemy' && !r.mesh.visible) continue;
    const w = weapon(r);
    if (!w.canReact || w.ammo <= 0) continue;
    let best = null;
    cells.forEach((c, i) => {
      if (!hasLOS(S.map, r, c)) return;
      const o = shotOdds(S.map, r, r, c, { reaction: true, weapon: w, diceBonus: diceBonus(r), raised: !!mover.raised, hardy: !!mover.hardy, suppressed: !!mover.suppressed, breach: breach(r) });
      if (o.hit >= RULES.REACTION_MIN && (!best || o.hit > best.odds.hit)) best = { shooter: r, idx: i, odds: o };
    });
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.idx - b.idx);
}

const hitChance = plan => 1 - plan.reduce((p, r) => p * (1 - r.odds.hit / 100), 1);
// 考慮「必定落空」（朱音）的被命中機率
// 閃避只擋掉那一發；打空不停火的射手（機槍手、不留活口）之後還會再開，照樣算
const keepsFiring = s => !!(weapon(s).keepFiring || (s.execBuff && !s.spareUsed));
function moveRisk(u, plan, extra = 0) {
  let skip = (u.dodge || 0) + extra;
  return 1 - plan.reduce((p, r) => {
    if (skip > 0) { skip--; return keepsFiring(r.shooter) ? p * (1 - r.odds.hit / 100) : p; }
    return p * (1 - r.odds.hit / 100);
  }, 1);
}

// 移動中第 i 格的反應射擊。回傳 true = 被命中（行動失敗）
async function reactAt(u, plan, i) {
  for (const r of plan.filter(p => p.idx === i)) {
    const s = r.shooter;
    if (!s.alive || s.firedOut || s.suppressed || !u.alive || weapon(s).ammo <= 0) continue;
    floatText(s, '反應射擊！', 'ow');
    let forceMiss = false;
    if (u.dashDodge > 0) { u.dashDodge--; forceMiss = true; }
    else if (u.dodge > 0) { u.dodge--; forceMiss = true; }
    const hit = await shoot(s, u, { reaction: true, forceMiss });
    if (forceMiss) { floatText(u, '閃過！', 'ow'); UI.log(`${u.name} 閃過了子彈！`, 'good'); }
    if (hit) {
      // 打中也算用掉這次反應：光變身、心線把主動權保住時，同一名敵人不能再反應
      s.firedOut = true;
      if (s.label) UI.updateLabel(s.label, s);
      if (!(u.unflinching && u.alive)) return true;
      continue; // 不會受阻、不會被壓制：打中也攔不住，繼續走
    }
    if (!weapon(s).keepFiring) {
      if (s.execBuff && !s.spareUsed) {
        s.spareUsed = true;
        floatText(s, '不留活口！', 'sup');
        UI.log(`家族加持「不留活口」：${s.name} 這發沒中不算用掉反應射擊，還能再開`, 'warn');
      } else s.firedOut = true;
    }
    if (s.label) UI.updateLabel(s.label, s);
  }
  return false;
}

// 回傳 true = 移動成功；false = 被反應射擊命中（行動失敗）
async function performMove(u, dest) {
  anim(u, 'run', { rate: 1.6, fade: 0.1 });
  try { return await performMove0(u, dest); }
  finally { if (u.alive) anim(u, 'idle'); }
}
async function performMove0(u, dest) {
  u.movedInit = S.initNo;
  if (u.raised) leaveIce(u);
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

    if (await reactAt(u, plan, i)) {
      const p = u.mesh.position.clone();
      await tween(0.12, k => u.mesh.position.lerpVectors(p, new THREE.Vector3(c.x, 0, c.z), k));
      return false;
    }
    // 被未警戒的敵人看到 → 移動停在這一格（不算失敗）
    if (u.alive && i < cells.length - 1 && detect()) {
      const p = u.mesh.position.clone();
      await tween(0.1, k => u.mesh.position.lerpVectors(p, new THREE.Vector3(c.x, 0, c.z), k));
      refresh();
      return true;
    }
  }
  detect();
  u.mesh.position.set(dest.x, 0, dest.z);
  refresh();
  return true;
}

// ================= 射擊 =================
function visibleTargets(u) {
  return S.units
    .filter(e => e.alive && e.team !== u.team && !(e.biteCluster && e.attached === u) && (u.team === 'player' ? sees(u, e) : hasLOS(S.map, u, e)) && (!u.range || dist(u, e) <= u.range + 0.5)) // 人偶：射程短
    .map(e => ({ unit: e, odds: oddsVs(u, e) }))
    // 仇恨：變身後的光是敵人的優先目標
    .sort((a, b) => (b.odds.hit + (b.unit.transformed ? 25 : 0)) - (a.odds.hit + (a.unit.transformed ? 25 : 0)));
}

function spawnTracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tween(0.15, k => (mat.opacity = 1 - k)).then(() => { scene.remove(line); geo.dispose(); mat.dispose(); });
}

// 回傳是否命中（命中必定造成傷害）
// forceMiss：朱音的「必定落空」；triple：小桃三管齊發
async function shoot(s, t, { reaction = false, forceMiss = false, triple = false } = {}) {
  const w = weapon(s);
  const odds = oddsVs(s, t, { reaction });
  const n = triple ? odds.dice * 2 : odds.dice; // 三管齊發：骰數加倍
  if (s.team === 'player') w.ammo = Math.max(0, w.ammo - (triple ? 3 : 1)); // 反應射擊也耗彈
  s.mesh.rotation.y = Math.atan2(t.x - s.x, t.z - s.z);
  s.mesh.updateMatrixWorld(true);
  s.mesh.visible = true;
  if (rigOf(s)) { anim(s, 'shoot', { fade: 0.08 }); await wait(0.1); }      // 先舉槍

  let rolled = 0;
  if (!forceMiss) for (let i = 0; i < n; i++) if (Math.random() * 100 < odds.die) rolled++;
  const hit = rolled > 0;
  const muzzle = s.mesh.localToWorld(s.mesh.userData.muzzle.clone());
  const aim = new THREE.Vector3(t.mesh.position.x, 0.9 * t.mesh.scale.y, t.mesh.position.z);
  for (let i = 0; i < (triple ? 5 : 3); i++) {
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
  if (s.alive) anim(s, 'idle');

  const ap = !reaction && s.apNext && t.armor; // 穿甲彈：這一槍無視裝甲
  if (!reaction && s.apNext) { s.apNext = false; if (ap) UI.log(`${s.name} 的穿甲彈無視了裝甲`, 'good'); }
  const arm = Math.max(0, (t.armor || 0) - (!reaction && w.pierce ? w.pierce : 0)); // 榴彈無視裝甲 1～2 點
  let eff = hit && arm && !ap ? Math.max(0, rolled - arm) : rolled; // 扣掉裝甲後真正生效的命中
  if (s.team === 'player' && !reaction) S.lastShooter = s; // 艾琳娜追的是最後一個開槍的少女
  // 詩織：相鄰的隊友被反應射擊打中時，有機率替她擋下一下
  const guard = reaction && eff > 0 && s.team === 'enemy' && t.team === 'player'
    ? players().find(p => p.girl === 'shiori' && p !== t && dist(p, t) < 1.5 && !p.suppressed) : null;
  let guarded = false;
  if (guard && Math.random() * 100 < RULES.GUARD_CHANCE) { eff--; guarded = true; }
  Rec.shot(s.team, reaction, forceMiss ? 0 : (triple ? Math.round((1 - Math.pow(1 - odds.die / 100, n)) * 100) : odds.hit), eff > 0);
  const tag = `${s.name}${reaction ? '（反應）' : triple ? '（三管齊發）' : ''} → ${t.name}（${forceMiss ? '必定落空' : `${n} 骰×${odds.die}%`}）`;
  if (hit) {
    const blocked = rolled - eff - (guarded ? 1 : 0); // 裝甲擋掉的（詩織擋下的那一下另外記）
    UI.log(`${tag} 中 ${rolled}${blocked > 0 ? (eff || guarded ? `（裝甲擋掉 ${blocked}）` : '（全被裝甲擋掉，沒有效果）') : ''}${guarded ? `（${guard.name}擋下 1）` : ''}`,
      eff ? (s.team === 'player' ? 'good' : 'bad') : (s.team === 'player' ? 'warn' : 'dim'));
    if (!eff && !guarded) floatText(t, '裝甲', 'miss');
    if (guarded) {
      floatText(guard, '擋下！', 'ow');
      UI.log(`${guard.name} 替 ${t.name} 擋下了一下`, 'good');
      await strike(guard, 1, s);
    }
    await strike(t, eff, s);
  } else {
    floatText(t, '未命中', 'miss');
    UI.log(`${tag} 未命中`, 'dim');
    // 詩織的衝鋒槍：打空也有機率讓目標累積 1 下
    if (!reaction && w.spray && !forceMiss && t.alive && !t.unflinching && !t.shield && (w.spraySure || Math.random() < 0.5)) {
      UI.log(`彈幕讓 ${t.name} 抬不起頭（累積 1 下）`, 'good');
      addStress(t);
    }
  }
  if (!reaction && w.splash) await grenade(s, t, w); // 榴彈：波及周圍 1 格、可能炸掉掩體
  if (!reaction && s.team === 'player' && w.pin && !t.shield) pinFire(s, t); // 頭目剛重新部署：不跟著壓制
  chipIce(s, t);
  makeNoise(s, t);
  await wait(0.35);
  if (s.alive && s.team === 'player' && w.recoil) await recoil(s, t);
  updateVisibility();
  refresh();
  return eff > 0;
}

// 分段血條的下限：愛心（魔法少女）或頭目的階段。每次受傷最多扣到這裡，溢出的傷害作廢
function segFloor(u) {
  if (u.heartHp) return (Math.ceil(u.hp / u.heartHp) - 1) * u.heartHp;
  if (u.cuts) return u.cuts.find(v => v < u.hp) ?? 0;
  return 0;
}

// 三階：命中累積。stress 到 PIN_AT 受阻、到 SUP_AT 壓制，之後每下受傷。
// 少女受傷一次扣一顆心；敵人一次扣 1 傷。一次攻擊最多扣到 segFloor（愛心一顆／頭目一段），溢出作廢。
// direct：不經過受阻、壓制，直接受傷（使魔咬傷）
async function strike(t, hits, src = null, direct = false) {
  if (!t.alive || hits <= 0) return;
  if (t.shield) { floatText(t, '階段護盾', 'miss'); UI.log(`${t.name} 剛突破階段，這個行動內打不動`, 'dim'); return; }
  const floor = segFloor(t);
  let wounds = 0;
  if (t.unflinching || direct || t.fragile) wounds = hits; // 人偶、打手、小弟：不經過三階，每中一顆骰受 1 傷
  else for (let i = 0; i < hits; i++) {
    if (t.stress < RULES.SUP_AT) t.stress++;
    else wounds++;
  }
  let dmg = 0, cut = 0;
  if (wounds) {
    const unit = t.heartHp || 1;
    // 少女：受傷一次＝扣到下一顆心的開頭（部分扣血的心也整顆扣掉）
    dmg = t.heartHp ? (t.hp - (Math.ceil(t.hp / unit) - 1) * unit) + (wounds - 1) * unit : wounds;
    if (floor > 0 && t.hp - dmg < floor) { cut = dmg - (t.hp - floor); dmg = t.hp - floor; }
    t.hp -= dmg;
    floatText(t, t.heartHp ? `-${Math.ceil(dmg / unit)} 心` : t.summon ? `-${dmg} 隻` : `-${dmg} 傷`, 'dmg');
    if (t.summon) updateBirds(t);
    if (cut) UI.log(`${t.name} 的${t.heartHp ? '愛心' : '階段護盾'}擋下了 ${t.heartHp ? Math.round(cut / unit) + ' 顆心' : cut + ' 傷'}`, 'dim');
  }
  Rec.damage(t, dmg, cut);
  const mats = t.mesh.userData.mats;
  if (t.hp > 0) anim(t, 'hurt', { next: t.mesh.userData.loop || 'idle' });
  await tween(0.25, k => mats.forEach(m => m.emissive.setRGB((1 - k) * 0.9, 0, 0)));
  if (t.hp <= 0) {
    await die(t);
    if (src && src.girl === 'yukino' && Math.random() < 0.15) {
      floatText(src, '（背肌）', 'ow');
      UI.log(`${src.name} 默默擺出了背肌的姿勢`, 'dim');
    }
    return;
  }
  if (t.kind === 'scarecrow' && t.flock) recallCrows(t);
  if (t.unflinching) { /* 不會受阻、不會被壓制 */ }
  else if (t.steady) { /* 起身後穩住了：這次主動權內不會再被壓制或受阻 */ }
  else if (t.stress >= RULES.SUP_AT) suppress(t);
  else if (t.stress >= RULES.PIN_AT) pin(t);
  if (src && src.girl === 'yukino' && lv(src, 'gun') >= 4 && t.suppressed) t.heavySup = true;
  if (t.heartHp && !t.lineUsed && t.hp <= t.lineHp) await heartLine(t);
  if (t.cuts && floor > 0 && t.hp === floor) await bossPhase(t);
}

const standUp = u => {
  u.suppressed = false;
  u.pinned = false;
  u.heavySup = false;
  setSuppressedPose(u, false);
  if (u.label) UI.updateLabel(u.label, u);
};

// 心線：第一次掉到一半愛心 → 咬牙起身，主動權回到我方
async function heartLine(u) {
  Rec.count('heartLines');
  u.lineUsed = true;
  u.stress = 0; // 咬牙起身：累積的命中歸零
  S.grab = true;
  standUp(u);
  UI.banner(`${u.name}：心線！`, 'player');
  floatText(u, '心線！', 'crit');
  UI.log(`${u.name} 掉到心線，咬牙起身！主動權回到我方`, 'good');
  refresh();
  await wait(0.5);
}

// 頭目突破階段：起身、叫來護衛、主動權交給敵方
// 頭目突破階段：
// 1. 重新部署：頭目自己挑一個安全的位置（不是移動，不會觸發反應射擊）。專屬地圖可以用 S.mission.bossSpots 指定候選點
// 2. 增援從別的方向趕到，是新的局面而不是再攻堅一次。專屬地圖可以用 S.mission.reinforceSpots 指定
// 3. 少女們振奮起來：每張地圖一次的技能（魔法次數、朱音的閃避）恢復
// 累積的命中歸零；頭目在這個行動結束前打不動（不會被一口氣連跳兩段）
async function bossPhase(b) {
  b.phase++;
  standUp(b);
  b.stress = 0;
  UI.banner(`${b.name}：第 ${b.phase} 階段`, 'enemy');
  floatText(b, '階段突破！', 'crit');
  const ps = players();
  const free = p => S.map.inB(p.x, p.z) && S.map.walkable(p.x, p.z) && !unitAt(p.x, p.z) && !iceAt(p.x, p.z);
  const allFloor = [];
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) if (free({ x, z })) allFloor.push({ x, z });
  // 安全度：沒有少女看得到最好；看得到的話，要被掩體擋著
  const safety = p => ps.reduce((s, g) => s + (!hasLOS(S.map, g, p) ? 3 : coverAt(S.map, p, g) > 0 ? 1 : -4), 0);

  // 1. 頭目重新部署
  const bossCands = (S.mission.bossSpots || []).filter(free);
  const far = allFloor.filter(p => ps.every(g => dist(g, p) >= 5));
  const covered = far.filter(p => coverSides(S.map, p).length && ps.every(g => !hasLOS(S.map, g, p) || coverAt(S.map, p, g) > 0));
  const pool = bossCands.length ? bossCands : covered.length ? covered : far; // 不停在暴露的格子
  const spot = pool.map(p => ({ p, s: safety(p) * 10 + coverSides(S.map, p).length * 3 + Math.min(...ps.map(g => dist(g, p))) + Math.random() * 2 }))
    .sort((a, c) => c.s - a.s)[0];
  if (spot) {
    const from = { x: b.x, z: b.z };
    b.x = spot.p.x; b.z = spot.p.z;
    b.mesh.position.set(b.x, 0, b.z);
    b.zone = S.map.zoneAt(b.x, b.z);
    UI.log(`${b.name} 從 (${from.x},${from.z}) 退到新的位置重新部署`, 'warn');
  }

  // 2. 增援：每個頭目有自己的增援方式（ENEMY_TYPES 的 reinforce）。專屬地圖可以用 S.mission.reinforceSpots 指定位置
  const base = b.reinforce || { kinds: Array(RULES.PHASE_GUARDS).fill('gunman'), where: 'guard' };
  const rule = b.reinforceCut ? { ...base, kinds: base.kinds.slice(0, Math.max(1, base.kinds.length - b.reinforceCut)) } : base;
  if (b.kind === 'b_mother' && b.phase >= 3) b.shotCap = 4;
  const reCands = (S.mission.reinforceSpots || []).filter(free);
  const group = reCands.length ? reCands.slice(0, rule.kinds.length) : reinforceSpots(b, ps, allFloor.filter(free), rule);
  group.forEach((p, i) => { spawnEnemy(rule.kinds[i], p.x, p.z, S.map.zoneAt(p.x, p.z), true).firedOut = true; }); // 剛到場：這次主動權內不開槍
  if (rule.curse) { // 莉莉絲：在最近的少女腳下下詛咒
    const ts = [...ps].sort((a, c) => dist(a, b) - dist(c, b)).slice(0, rule.curse);
    for (const p of ts) { S.curse.add(key(p.x, p.z)); suppress(p, '詛咒！'); }
    drawCurse();
    if (ts.length) UI.log(`${b.name} 在 ${ts.map(p => p.name).join('、')} 腳下下了詛咒`, 'warn');
  }
  if (group.length) UI.log(`增援 ${group.map((p, i) => `${ENEMY_TYPES[rule.kinds[i]].name}(${p.x},${p.z})`).join('、')} 趕到（剛到場，這次主動權內不能開槍）`, 'warn');

  // 3. 振奮
  for (const p of ps) { p.uses = Math.max(p.uses, p.usesMax || 0); p.dodge = Math.max(p.dodge || 0, p.dodgeMax || 0); }
  UI.log('少女們振奮起來：每張地圖一次的技能恢復了', 'good');

  b.shield = true;
  updateVisibility();
  refresh();
  await wait(0.6);
}

// 頭目的增援位置。watch：遠處、看得到少女、對每個看得到它的少女都有掩體
// ambush：少女都看不到、離最近的少女 4～6 格，偏向頭目的另一側（包抄）；guard：頭目身邊 3 格內、靠掩體
function reinforceSpots(b, ps, floor, rule) {
  const n = rule.kinds.length;
  const seers = p => ps.filter(g => hasLOS(S.map, g, p));
  const near = p => Math.min(...ps.map(g => dist(g, p)));
  const covered = p => seers(p).every(g => coverAt(S.map, p, g) > 0);
  const side = p => coverSides(S.map, p).length;
  const score = {
    watch: p => near(p) < 8 || !seers(p).length || !covered(p) ? null : side(p) * 3 + seers(p).length * 4 - (near(p) - 8),
    ambush: p => seers(p).length || near(p) < 4 || near(p) > 6.5 ? null : dist(p, b) * 0.5 - Math.abs(near(p) - 5) * 2 + side(p),
    guard: p => dist(p, b) > 3 || near(p) < 4 ? null : side(p) * 3 + (covered(p) ? 4 : -4) - dist(p, b),
    fog: p => !S.map.isFog(p.x, p.z) || seers(p).length || near(p) < 3 ? null : side(p) - Math.abs(near(p) - 5),
    rear: p => p.x > 4 || near(p) < 3 ? null : (seers(p).length ? 0 : 3) + side(p) - p.x,
  }[rule.where] || (() => null);
  const pick = (sc, gap) => {
    const out = [];
    const cands = floor.map(p => ({ p, s: sc(p) })).filter(c => c.s !== null)
      .map(c => ({ ...c, s: c.s + Math.random() * 2 })).sort((a, c) => c.s - a.s);
    for (const c of cands) {
      if (out.length >= n) break;
      if (out.some(q => dist(q, c.p) < gap)) continue; // 不同格，watch／ambush 還要分開一點
      out.push(c.p);
    }
    return out;
  };
  let out = pick(score, rule.where === 'guard' ? 1 : 2);
  // 地形不允許時退而求其次：離少女至少 5 格、靠掩體
  if (out.length < n) {
    const used = out;
    const want = ['ambush', 'fog', 'rear'].includes(rule.where) ? 5 : 7; // 包抄型還是要近（4～6 格），其他照原本離遠一點
    const rest = pick(p => near(p) < 4 || used.some(q => q.x === p.x && q.z === p.z) ? null : side(p) * 3 - Math.abs(near(p) - want) * 2, 1);
    out = [...used, ...rest.filter(p => !used.some(q => dist(q, p) < 1))].slice(0, n);
  }
  return out;
}

// ---------- 頭目的強度與射擊上限（依出場順序） ----------
// 第一個出場的頭目 -1 骰、突破時增援少 1 人；第 3、4 個 +1 骰。射擊上限見 RULES.BOSS_SHOTS
function tuneBoss(e, op) {
  const C = Camp.C;
  const m = C.mode === 'story' && e.member ? C.members.find(x => x.id === e.member) : null;
  const boost = m ? m.boost || 0 : 0; // 反制「成員強化」
  if (boost) { e.gun.dice += boost; e.dice = e.gun.dice; }
  if (e.member && op.kind === 'facility') {
    // 現身戰：只有 1 段生命，打掉就撤退（擊退）
    e.appearance = true;
    e.alerted = true; // 她是來找妳們的
    e.maxHp = RULES.APPEAR_HP;
    e.hp = RULES.APPEAR_HP;
    e.cuts = null;
    e.shotCap = 2;
    S.appeared.push(e.member);
    return;
  }
  if (e.member && op.kind === 'finale') { e.shotCap = 3; return; } // 莊園裡的成員
  if (e.kind === 'b_mother') {
    e.shotCap = 3;
    const C = Camp.C;
    if (op.kind === 'finale' && C.finaleKeep && e.cuts) { // 決戰重打：保留已打破的第 1 段
      e.phase = 2;
      e.hp = e.cuts[0];
      UI.log(`${e.name} 的第 1 段上次已經打破了，這次從第 2 段開始`, 'good');
    }
    return;
  }
  const idx = C.mode === 'story' && e.member ? Camp.bossIndex(e.member) : 1;
  if (op.kind === 'boss' && C.bossKeep === e.member && e.cuts) { // 據點重打：保留已打破的第 1 段
    e.phase = 2;
    e.hp = e.cuts[0];
    UI.log(`${e.name} 的第 1 段上次已經打破了，這次從第 2 段開始`, 'good');
  }
  if (idx === 0) {
    e.gun.dice = Math.max(1, e.gun.dice - 1);
    e.dice = e.gun.dice;
    e.reinforceCut = 1;
  } else if (idx >= 2) {
    e.gun.dice += 1;
    e.dice = e.gun.dice;
  }
  e.shotCap = RULES.BOSS_SHOTS[Math.min(idx, RULES.BOSS_SHOTS.length - 1)];
}
const bossCapped = e => !!e.shotCap && (e.shotsUsed || 0) >= e.shotCap;
const bossMayShoot = (e, t) => !e.shotCap || ((e.shotAt && e.shotAt.get(t)) || 0) < RULES.BOSS_SAME_TARGET;
function countBossShot(e, t) {
  if (!e.shotCap) return;
  e.shotsUsed = (e.shotsUsed || 0) + 1;
  e.shotAt = e.shotAt || new Map();
  e.shotAt.set(t, (e.shotAt.get(t) || 0) + 1);
  if (e.label) UI.updateLabel(e.label, e);
}

// ---------- 設施條件（難度 3 起 1 個、難度 9 起 2 個；人偶／稻草人要難度 5 起） ----------
const COND_TEXT = {
  timer: () => `警報響起後，每 ${S.condTimer ? S.condTimer.every : 4} 個敵方主動權會有 2 名增援從撤離點那一側趕到`,
  plant: () => '裝好炸藥後，撤退路線的兩側會立刻冒出 2 名增援（各 1 名），全圖進入警戒',
  special: () => '這裡有魔女的東西（人偶或稻草人）',
  nest: () => `這裡有使魔巢穴：從一開始就每 ${RULES.NEST_EVERY} 個敵方主動權孵出 ${RULES.NEST_SPAWN} 隻使魔，打掉就停`,
};
function facilityConds(gen, level) {
  const doll = Camp.mod('doll') > 0; // 反制「魔女的玩偶」：不管難度，設施圖必定有人偶或稻草人
  if (level < 3) return doll ? ['special'] : []; // 難度 1、2 是教學
  const pool = level >= 5 || doll ? ['timer', 'special'] : ['timer'];
  if (gen.mission.type === 'sabotage') pool.push('plant');
  if (level >= 4 && gen.enemies.some(p => p.type === 'imp')) pool.push('nest');
  const out = [];
  const n = level >= 9 ? 2 : 1;
  if (Camp.mod('doll') && pool.includes('special')) out.push(pool.splice(pool.indexOf('special'), 1)[0]);
  while (out.length < n && pool.length) out.push(pool.splice(ri(0, pool.length - 1), 1)[0]);
  if (out.includes('special') && !gen.enemies.some(p => p.type === 'doll' || p.type === 'scarecrow')) {
    const cand = gen.enemies.filter(p => p.type === 'gunman' || p.type === 'zealot');
    if (cand.length) cand[ri(0, cand.length - 1)].type = Math.random() < 0.5 ? 'doll' : 'scarecrow';
  }
  if (out.includes('nest')) { // 一隻使魔換成巢穴（留在使魔群的責任區）
    // 放在離「部署區 → 目標」路線最遠的那隻使魔：要特地繞路去拆
    const imps = gen.enemies.filter(p => p.type === 'imp');
    const ex = gen.mission.exits || [];
    const goal = gen.mission.objective || (ex.length ? ex[Math.floor(ex.length / 2)] : { x: gen.map.w - 1, z: gen.map.h / 2 });
    const a = gen.deployZone.length ? gen.deployZone[Math.floor(gen.deployZone.length / 2)] : { x: 1, z: gen.map.h / 2 };
    const off = p => { // 點到線段 a→goal 的距離
      const vx = goal.x - a.x, vz = goal.z - a.z, L = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / L));
      return Math.hypot(p.x - a.x - t * vx, p.z - a.z - t * vz);
    };
    // 部署區（含千夏多 3 格的視野）看得到的不選
    const seen = p => gen.deployZone.some(d => hasLOS(gen.map, d, p, RULES.SIGHT + 3, true));
    imps.sort((p, q) => (seen(p) - seen(q)) * 100 + off(q) - off(p) + (Math.random() - 0.5));
    imps[0].type = 'nest';
  }
  return out;
}
const exitCenter = () => {
  const ex = S.mission.exits || [];
  if (!ex.length) return { x: 0, z: S.map.h / 2 };
  return { x: ex.reduce((s, p) => s + p.x, 0) / ex.length, z: ex.reduce((s, p) => s + p.z, 0) / ex.length };
};
// 在 score(p) 最高的空格叫出 n 名敵人（離少女至少 minD 格、彼此分開）
function callIn(kind, n, score, minD) {
  const ps = players();
  const c = [];
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
    const p = { x, z };
    if (!S.map.walkable(x, z) || unitAt(x, z) || iceAt(x, z) || isExit(p) || ps.some(g => dist(g, p) < minD)) continue;
    const s = score(p);
    if (s !== null) c.push({ p, s: s + Math.random() * 0.5 });
  }
  c.sort((a, b) => b.s - a.s);
  const out = [];
  for (const o of c) {
    if (out.length >= n) break;
    if (out.some(q => dist(q, o.p) < 1.5)) continue;
    out.push(o.p);
  }
  return out.map(p => spawnEnemy(kind, p.x, p.z, S.map.zoneAt(p.x, p.z), true));
}
async function facilityTimer() {
  const t = S.condTimer;
  if (!t || t.count === null || S.gameOver) return;
  t.count++;
  if (t.count % t.every) return;
  const ex = exitCenter();
  const edge = p => p.x === 0 || p.z === 0 || p.x === S.map.w - 1 || p.z === S.map.h - 1;
  const got = callIn('gunman', 2, p => edge(p) ? -dist(p, ex) : null, 4);
  if (!got.length) return;
  UI.banner('設施增援抵達！', 'enemy');
  UI.log(`增援 ${got.map(e => `${e.name}(${e.x},${e.z})`).join('、')} 從撤離點那一側趕到`, 'warn');
  updateVisibility();
  refresh();
  await wait(0.5);
}
async function plantAlarm() {
  const o = S.mission.objective, ex = exitCenter();
  // 增援出現在撤退路線的兩側（各 1 名，離路線約 3 格、在路程中段），不直接擋在路上
  const dx = ex.x - o.x, dz = ex.z - o.z, len = Math.hypot(dx, dz) || 1;
  const flank = side => p => {
    const t = ((p.x - o.x) * dx + (p.z - o.z) * dz) / (len * len); // 沿路線的位置 0～1
    const perp = ((p.x - o.x) * dz - (p.z - o.z) * dx) / len;      // 離路線幾格（正負＝哪一側）
    if (t < 0.25 || t > 0.8 || Math.sign(perp) !== side || Math.abs(perp) < 2) return null;
    return -Math.abs(Math.abs(perp) - 3) - Math.abs(t - 0.5) * 3 + coverSides(S.map, p).length * 0.5;
  };
  let got = [...callIn('gunman', 1, flank(1), 3), ...callIn('gunman', 1, flank(-1), 3)];
  if (got.length < 2) { // 有一側擠不下（貼著地圖邊）：補在另一側
    const side = got.length && Math.sign(((got[0].x - o.x) * dz - (got[0].z - o.z) * dx)) || 1;
    got = got.concat(callIn('gunman', 2 - got.length, flank(side), 3));
  }
  alertEnemies(enemies(), 'plant');
  if (got.length) {
    UI.banner('警報！增援從撤退路線兩側包過來', 'enemy');
    UI.log(`炸藥觸發警報：${got.map(e => `${e.name}(${e.x},${e.z})`).join('、')} 從撤退路線的兩側冒出來，全圖進入警戒`, 'warn');
  }
  updateVisibility();
  refresh();
  await wait(0.4);
}

// 敵人啟動檢定
function actChance(e) {
  if (!e.act) return 100;
  let c = e.act;
  if (enemies().some(o => o !== e && o.officer && dist(o, e) <= 3)) c += RULES.ACT_OFFICER;
  if (e.suppressed) c -= RULES.ACT_SUPPRESSED;
  if (S.initDeaths) c -= RULES.ACT_DEATHS;
  c += S.actBonus || 0;
  if (e.hp < e.maxHp / 2) c -= RULES.ACT_HURT;
  return Math.max(5, Math.min(95, c));
}


// 起身、換彈這類「暴露」的行動：看得到她的敵人可以原地開一次反應射擊。回傳 true = 被命中
async function exposeReact(u) {
  const plan = planReactions(u, [{ x: u.x, z: u.z, t: 1 }]);
  if (!plan.length) return false;
  return reactAt(u, plan, 0);
}

// 雪乃的重機槍：主動射擊不管有沒有命中都壓制目標；「壓制火網」連目標周圍 1 格的敵人也壓制
function pinFire(s, t) {
  const heavy = s.girl === 'yukino' && lv(s, 'gun') >= 4;
  const pin = u => { suppress(u); if (heavy && u.suppressed) u.heavySup = true; };
  if (t.alive) pin(t);
  if (s.girl === 'yukino' && lv(s, 'gun') >= 5) {
    const near = S.units.filter(e => e.alive && e !== t && e.team !== s.team && dist(e, t) < 1.5);
    if (near.length) UI.log(`${s.name} 壓制火網！`, 'good');
    near.forEach(pin);
  }
}

// 累積 1 下（不受傷）：到門檻就受阻／壓制
function addStress(t) {
  if (!t.alive || t.unflinching || t.steady) return;
  if (t.stress < RULES.SUP_AT) t.stress++;
  if (t.stress >= RULES.SUP_AT) suppress(t);
  else if (t.stress >= RULES.PIN_AT) pin(t);
  if (t.label) UI.updateLabel(t.label, t);
}

// 受阻：不能移動（還能開槍、反應射擊）
function pin(t, label = '受阻') {
  if (!t.alive || t.suppressed || t.pinned || t.unflinching) return;
  t.pinned = true;
  floatText(t, label, 'sup');
  if (t.label) UI.updateLabel(t.label, t);
}

function suppress(t, label = '壓制') {
  if (!t.alive || t.suppressed) return;
  if (t.unflinching) { floatText(t, '不為所動', 'miss'); return; }
  t.suppressed = true;
  t.pinned = false;
  Rec.suppressed(t);
  floatText(t, label, 'sup');
  setSuppressedPose(t, true);
  if (t.label) UI.updateLabel(t.label, t);
}

function setSuppressedPose(u, on) {
  // 被壓制：蹲低
  const base = u.mesh.userData.baseScale || 1;
  const from = u.mesh.scale.y, to = base * (on ? 0.78 : 1);
  tween(0.2, k => { u.mesh.scale.y = from + (to - from) * k; });
}

async function die(u) {
  if (!u.alive) return; // 已經倒下（同一批指令的後續射擊）
  if (u.appearance) { // 現身的成員：撤退（擊退 1 次），不算打倒
    u.alive = false;
    u.fled = true;
    u.repelled = true;
    if (u.label) { u.label.remove(); u.label = null; }
    floatText(u, '撤退！', 'crit');
    UI.banner(`${u.name} 被擊退了！`, 'player');
    UI.log(`${u.name} 撤退了（擊退 1 次）`, 'good');
    await tween(0.4, k => { u.mesh.position.y = k * 2; u.mesh.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 1 - k; } }); });
    u.mesh.visible = false;
    refresh();
    return;
  }
  if (u.biteCluster) { // 咬著少女的使魔全被打掉
    const p = u.attached;
    u.alive = false;
    if (u.label) { u.label.remove(); u.label = null; }
    unitGroup.remove(u.mesh);
    if (p) { p.bitten = null; if (p.label) UI.updateLabel(p.label, p); }
    UI.log(`咬著${p ? ' ' + p.name + ' ' : ''}的使魔全被打掉了`, 'good');
    refresh();
    return;
  }
  if (u.familiar || u.nest) { // 使魔：命中即倒，消散；巢穴：被摧毀
    u.alive = false;
    if (u.label) { u.label.remove(); u.label = null; }
    if (u.nest) UI.banner('使魔巢穴被摧毀了！', 'player');
    UI.log(u.nest ? `${u.name} 被摧毀了，不會再孵出使魔` : `${u.name} 消散了`, 'good');
    const m = u.mesh;
    await tween(0.3, k => { m.scale.setScalar(1 - k * 0.9); m.position.y = -k * 0.3; });
    unitGroup.remove(m);
    refresh();
    return;
  }
  if (u.summon) { // 烏鴉被打散
    const o = u.owner;
    removeFlock(u);
    if (o) { o.crows = 0; o.regen = -1; if /* -1：打散烏鴉的那個行動不算恢復 */ (o.label) UI.updateLabel(o.label, o); }
    UI.log(`${u.name} 全被打散了，${o ? o.name + '要慢慢恢復' : ''}`, 'good');
    refresh();
    return;
  }
  if (u.flock && u.flock.alive) { removeFlock(u.flock); UI.log('稻草人倒下，烏鴉一哄而散', 'good'); }
  if (u.lockOnHit) for (const p of players()) if (p.locked === u) {
    p.locked = false;
    UI.log(`${u.name} 倒下，${p.name} 不再被纏住`, 'good');
    if (p.label) UI.updateLabel(p.label, p);
  }
  if (u.crowLocked) { const f = u.crowLocked, o = f.owner; if (o) o.crows = f.hp; removeFlock(f); }
  if (u.bitten) releaseBites(u, `${u.name} 倒下，`);
  if (u.kind === 'doll' && S.buffs.includes('puppet') && !u.revived) { u.revivePending = true; UI.log('（桃樂絲的線還連在人偶身上……）', 'warn'); }
  u.alive = false;
  u.hp = 0;
  u.suppressed = false;
  u.pinned = false;
  if (u.label) { u.label.remove(); u.label = null; }
  if (u.iceRef) { const ice = u.iceRef; ice.rider = null; u.iceRef = null; u.raised = false; u.frozen = false; S.map.set(ice.x, ice.z, T.FULL); }
  Rec.count(u.team === 'player' ? 'downed' : 'kills');
  if (u.team === 'player') { u.downed = true; UI.log(`${u.name} 倒下了，緊急後送`, 'bad'); }
  else { UI.log(`${u.name} 倒下了`, 'good'); S.initDeaths = (S.initDeaths || 0) + 1; }
  if (u.boss) UI.banner(`${u.name} 被打倒了！`, 'player');
  if (u.officer && !enemies().some(e => e.officer)) {
    UI.log('幹部倒了！小弟們作鳥獸散', 'good');
    UI.banner('幹部倒了', 'player');
  }
  const m = u.mesh;
  if (rigOf(u)) { anim(u, 'down'); await wait(0.9); }       // 方塊人：膝蓋一軟往後倒
  else await tween(0.5, k => {
    m.rotation.x = -k * Math.PI / 2;
    m.position.y = 0.12 * k;
  });
  m.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.55; } });
}

function rally(u) {
  u.suppressed = false;
  u.pinned = false;
  u.heavySup = false;
  setSuppressedPose(u, false);
  floatText(u, '起身', 'ow');
  UI.log(`${u.name} 起身`, 'dim');
}

// ================= 玩家操作 =================
function selectUnit(u) {
  if (!u || !u.alive) return;
  S.selected = u;
  S.mode = 'move';
  S.confirm = null;
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
  } else if (S.mode === 'magic' && S.magicOpts) {
    const m4 = new THREE.Matrix4();
    for (const o of S.magicOpts.values()) {
      if (n >= MAX_TILES) break;
      m4.makeTranslation(o.x, 0.015, o.z);
      rangeMesh.setMatrixAt(n, m4);
      rangeMesh.setColorAt(n, ORANGE);
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
function setPathLine(pts, color) {
  pathLine.geometry.dispose();
  pathLine.geometry = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p.x, 0.08, p.z)));
  pathLine.material.color.set(color);
  pathLine.visible = true;
}

// 畫出路線、會被發現的位置（黃圈）與反應射擊（紅圈）
function drawPreview(u, cells, line, color) {
  setPathLine(line, color);
  let spot = null;
  if (u.team === 'player') {
    const watchers = enemies().filter(e => !e.alerted && e.mesh.visible);
    for (let i = 0; i < cells.length && !spot; i++) {
      const e = watchers.find(e => quietSees(e, cells[i]));
      if (e) spot = { e, idx: i };
    }
  }
  if (spot) {
    const c = cells[spot.idx];
    const ring = new THREE.Mesh(spotGeo, spotMat);
    ring.position.set(c.x, 0.05, c.z);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(spot.e.x, 1.1, spot.e.z), new THREE.Vector3(c.x, 0.5, c.z)]), spotLineMat);
    ln.computeLineDistances();
    reactMarks.add(ring, ln);
  }
  const plan = planReactions(u, cells, true).filter(r => !spot || r.idx <= spot.idx);
  for (const r of plan) {
    const c = cells[r.idx];
    const ring = new THREE.Mesh(reactGeo, reactMat);
    ring.position.set(c.x, 0.05, c.z);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(r.shooter.x, 0.9, r.shooter.z), new THREE.Vector3(c.x, 0.5, c.z)]), reactLineMat);
    ln.computeLineDistances();
    reactMarks.add(ring, ln);
  }
  return { plan, spot };
}

const spotRow = spot => spot ? `<br><span class="spot">👁 會被 ${spot.e.name} 發現，移動停在黃圈</span>` : '';
function riskRows(u, plan, extra = 0) {
  if (!plan.length) return '<br><small>已知敵人無法反應射擊</small>';
  let skip = (u.dodge || 0) + extra;
  const rows = plan.map(r => `${r.shooter.name} ${skip-- > 0 ? (keepsFiring(r.shooter) ? `<b>第一發落空</b>，之後 ${r.odds.hit}%` : '<b>必定落空</b>') : r.odds.hit + '%'}`).join('<br>');
  return `<br><span class="warn">⚠ 反應射擊</span><br>${rows}<br>被命中機率 <b>${Math.round(moveRisk(u, plan, extra) * 100)}%</b>（只算已知敵人）`;
}
const confirmHint = () => touchMode ? '　<span class="hint">再點一次確認</span>' : '';

function updateHover() {
  const t = S.hover;
  coverIcons.clear();
  clearReactMarks();
  pathLine.visible = false;
  UI.tip(null);
  if (!t || (S.side !== 'player' && S.side !== 'deploy') || S.busy || S.gameOver) { hoverMark.visible = false; return; }
  hoverMark.visible = true;
  hoverMark.position.set(t.x, 0.03, t.z);

  const u = S.selected;
  if (S.mode === 'magic') { magicHover(u, t); return; }
  if (S.mode !== 'move') return;
  const occ = unitAt(t.x, t.z);
  const ice = iceAt(t.x, t.z);
  const pi = ice && (!ice.rider || ice.rider.team === 'player') && canMove(u) ? pushInfo(u, ice) : null;
  if (pi) { pushHover(u, pi); return; }
  if (occ && occ.team === 'enemy' && occ.mesh.visible) {
    const info = `<div class="desc">${occ.alerted ? '警戒中' : '未察覺：只看黃色責任區'}${occ.raised ? '・在冰塊上（不能移動）' : ''}${occ.desc ? '<br>' + occ.desc : ''}<br>${occ.noGun ? '不開槍' : `${occ.dice} 骰${occ.dieMod ? `（每骰 ${occ.dieMod > 0 ? '+' : ''}${occ.dieMod}%）` : ''}`} · 累積命中 ${occ.stress}/${RULES.SUP_AT}${occ.act ? `<br>品質：${occ.q}（啟動 ${actChance(occ)}%）` : occ.cuts ? `<br>頭目：不做啟動檢定；生命分 3 段，第 ${occ.phase} 段` : ''}${occ.execBuff ? `<br><span class="warn">不留活口：這次主動權第一次反應打空不停火${occ.spareUsed ? '（已用掉）' : ''}</span>` : ''}</div>`;
    if (!canAct(u)) showTip(`<b>${occ.name}</b>${info}`);
    else if (u.firedOut) showTip(`<b>${occ.name}</b><br><small>此單位這次主動權不能再開槍</small>${info}`);
    else if (weapon(u).ammo <= 0) showTip(`<b>${occ.name}</b><br><small>彈匣空了</small>${info}`);
    else if (sees(u, occ)) {
      const o = oddsVs(u, occ);
      showTip(`<b>${occ.name}</b> ${o.dice} 骰×${o.die}%：至少中一顆 <b>${o.hit}%</b>${occ.armor ? `<br>裝甲 ${occ.armor}：要中 ${occ.armor + 1} 顆才有效 <b>${UI.effHit(o, occ.armor)}%</b>` : ''}<br><small>${UI.coverName(o)}${occ.suppressed ? ' · 壓制中' : occ.pinned ? ' · 受阻' : ''} · 點敵人瞄準</small>${info}`);
    } else showTip(`<b>${occ.name}</b><br><small>無視線</small>${info}`);
    return;
  }
  if (ice && !ice.rider) { showTip(`<b>冰塊</b><br><small>全掩體・擋視線・還能挨 ${ice.hp} 下${u && u.ability === 'ice' ? '<br>雪乃站在旁邊時點它可以推動' : ''}</small>`); return; }
  if (!S.map.walkable(t.x, t.z)) return;
  for (const s of coverSides(S.map, t)) {
    const m = new THREE.Mesh(shieldGeo[s.c], shieldMat[s.c]);
    m.position.set(t.x + s.dx * 0.4, s.c === 2 ? 0.3 : 0.16, t.z + s.dz * 0.4);
    if (s.dx) m.rotation.y = Math.PI / 2;
    coverIcons.add(m);
  }

  const mv = S.moves && S.moves.get(key(t.x, t.z));
  if (!mv || !canMove(u)) return;
  const cells = pathCells(u, mv);
  const { plan, spot } = drawPreview(u, cells, [u, t], mv.vault ? 0xd6a6ff : 0x8fd3ff);
  const extra = [];
  if (S.map.isConceal(t.x, t.z)) extra.push(S.theme.concealName);
  if (isExit(t)) extra.push('撤離點');
  if (S.curse.has(key(t.x, t.z))) extra.push('<span class="warn">詛咒格</span>');
  const cr = S.crates.find(c => c.x === t.x && c.z === t.z);
  if (cr) extra.push(cr.type === 'ammo' ? '彈藥箱' : '醫療包');
  const head = (mv.vault ? '翻越' : `移動 ${dist(u, mv).toFixed(1)} 格`) + (extra.length ? `（${extra.join('・')}）` : '') + confirmHint();
  const sc = scouters(t).filter(e => e.mesh.visible).length; // 只算看得到的使魔，不洩漏迷霧
  const scRow = sc ? `<br><span class="warn">偵查：${sc} 隻使魔看得到這裡，${scoutOdds(sc)}% 搶走主動權</span>` : '';
  showTip(`<b>${head}</b>${spotRow(spot)}${riskRows(u, plan)}${scRow}`);
}

function magicHover(u, t) {
  const opt = S.magicOpts && S.magicOpts.get(key(t.x, t.z));
  if (!opt) { showTip('<small>橘色格子才能用・再按魔法鍵或 Esc 取消</small>'); return; }
  const m = lv(u, 'magic');
  if (opt.kind === 'dash') {
    const cells = pathCells(u, opt.mv);
    const { plan, spot } = drawPreview(u, cells, [u, t], 0xffa04f);
    const tg = enemies().filter(e => dist(e, opt) < 1.5).sort((a, b) => a.hp - b.hp)[0];
    showTip(`<b>突進 → 近戰 ${tg ? tg.name : ''}</b>${confirmHint()}<br><small>近戰必中：直接受傷 ${RULES.MELEE_WOUNDS} 次並壓制（無視裝甲）、不發出槍聲。沒碰到敵人就退回次數</small>${spotRow(spot)}${riskRows(u, plan, m >= 4 ? 1 : 0)}`);
  } else if (opt.kind === 'ice') {
    const r = opt.rider;
    const sub = r ? (r.team === 'enemy' ? '被抬起的敵人不能移動、算半掩體' : '站在冰塊上算半掩體') : `全掩體・擋視線・耐久 ${m >= 1 ? 5 : RULES.ICE_HP}`;
    showTip(`<b>${r ? `把 ${r.name} 抬到冰塊上` : '放置冰塊'}</b>${confirmHint()}<br><small>${sub}</small>`);
  } else if (opt.kind === 'mark') {
    showTip(`<b>標記 ${opt.unit.name}</b>${confirmHint()}<br><small>一直看得到她；隊友打她每顆骰 +${RULES.MARK_BONUS[m >= 4 ? 1 : 0]}%${m >= 1 ? '・她開槍 -1 骰' : ''}${m >= 2 ? '・受阻' : ''}${m >= 3 ? '・擴散到周圍 1 格的敵人' : ''}</small>`);
  } else if (opt.kind === 'blast') {
    const occ = iceAt(t.x, t.z) ? '冰塊' : S.map.get(t.x, t.z) === T.FULL ? '全掩體' : '半掩體';
    const r = m >= 3 ? 2.5 : 1.5;
    const hit = enemies().filter(e => e.mesh.visible && dist(e, t) <= r);
    showTip(`<b>爆破${occ}</b>${confirmHint()}<br><small>炸成空地；周圍 ${m >= 3 ? 2 : 1} 格的敵人進入壓制${m >= 1 ? '並各吃 1 下命中' : ''}${hit.length ? `（${hit.map(e => e.name).join('、')}）` : ''}・會發出聲響</small>`);
  } else if (opt.kind === 'bless') {
    const p = opt.unit;
    showTip(`<b>祝福 ${p.name}</b>${confirmHint()}<br><small>回 ${m >= 5 ? 2 : 1} 顆心${p.suppressed || p.pinned ? '、解除' + (p.suppressed ? '壓制' : '受阻') + '（不會吃反應射擊）' : ''}${m >= 2 ? '・這次主動權內不會再被壓制' : ''}${m >= 3 ? '・累積歸零' : ''}</small>`);
  } else {
    const cells = [{ x: t.x, z: t.z, t: 1 }];
    const { plan, spot } = drawPreview(u, cells, [u, t], 0xff8fc0);
    showTip(`<b>空投到這裡</b>${confirmHint()}<br><small>備彈 -3・起跳${m >= 3 ? '不發出槍聲' : '的槍聲會驚動附近敵人'}</small>${spotRow(spot)}${riskRows(u, plan)}`);
  }
}

function pushHover(u, pi) {
  const r = pi.ice.rider;
  const end = pi.cells[pi.cells.length - 1];
  let txt = `<b>推冰塊 ${pi.cells.length} 格</b>${confirmHint()}`;
  if (r) {
    const { plan, spot } = drawPreview(r, pi.cells, [pi.ice, end], 0x9fe8ff);
    txt += `<br><small>${r.name} 跟著滑（半掩體）</small>${spotRow(spot)}${riskRows(r, plan)}`;
  } else setPathLine([pi.ice, end], 0x9fe8ff);
  if (pi.blocker && pi.blocker.team === 'enemy' && lv(u, 'magic') >= 2) txt += `<br><small>撞上 ${pi.blocker.name}，把她擊退 1 格</small>`;
  showTip(txt);
}

async function playerMove(u, mv) {
  Rec.tag(mv.vault ? '翻越' : '移動');
  S.busy = true;
  clearOverlays();
  const ok = await performMove(u, mv);
  if (u.alive) { pickupCrate(u); landed(u); }
  S.busy = false;
  await resolvePlayerAction(ok, u);
}

function pickupCrate(u) {
  const i = S.crates.findIndex(c => c.x === u.x && c.z === u.z);
  if (i < 0) return;
  const cr = S.crates[i];
  if (cr.type !== 'ammo' && u.hp >= u.maxHp) { UI.log(`${u.name} 生命是滿的，醫療包留在原地`, 'dim'); return; }
  S.crates.splice(i, 1);
  if (cr.mesh) { world.remove(cr.mesh); disposeTree(cr.mesh); }
  if (cr.type === 'ammo') {
    const w = u.weapons[0];
    const n = w.mag * 2;
    w.reserve += n;
    floatText(u, `+${n} 發`, 'ow');
    UI.log(`${u.name} 撿到彈藥：${w.name} 備彈 +${n}`, 'good');
  } else {
    const n = Math.min(RULES.MEDKIT_HEAL, u.maxHp - u.hp);
    u.hp += n;
    floatText(u, `+${n} HP`, 'ow');
    UI.log(`${u.name} 使用醫療包 +${n} HP`, 'good');
  }
}

// ---------- 武器操作 ----------
function reloadInfo(u) {
  if (!u || !u.weapons) return null;
  const w = weapon(u);
  if (w.ammo >= w.mag) return null;
  if (!w.sidearm && w.reserve <= 0) return null;
  return { gives: !(w.sidearm || w.fastReload || (u.transformed && lv(u, 'gun') >= 5)) };
}

// 會交出主動權的操作要按兩次確認（手機上避免誤觸）
function confirmGive(kind, text) {
  if (S.confirm === kind) { S.confirm = null; return true; }
  S.confirm = kind;
  UI.toast(`再按一次確認：${text}後會交出主動權`, 2500);
  setTimeout(() => { if (S.confirm === kind) S.confirm = null; }, 2500);
  return false;
}

async function endWithHandover(msg) {
  Rec.playerAct(true);
  S.grab = false;
  S.forceEnemy = false;
  refresh();
  UI.log(msg, 'warn');
  S.busy = true;
  await wait(0.5);
  S.busy = false;
  giveInitiative('enemy');
}

function swapGunMesh(u) {
  const keep = { pos: u.mesh.position.clone(), rot: u.mesh.rotation.y, vis: u.mesh.visible, sy: u.mesh.scale.y };
  unitGroup.remove(u.mesh);
  disposeTree(u.mesh);
  u.mesh = meshFor(u);
  u.mesh.position.copy(keep.pos);
  u.mesh.rotation.y = keep.rot;
  u.mesh.visible = keep.vis;
  u.mesh.scale.y = keep.sy;
  u.mesh.userData.unit = u;
  unitGroup.add(u.mesh);
}

function enterTargetMode(pref) {
  const u = S.selected;
  if (!canAct(u)) return;
  if (u.firedOut) { UI.toast('此單位這次主動權不能再開槍'); return; }
  if (weapon(u).ammo <= 0) { UI.toast('彈匣空了：換彈或換槍'); return; }
  const ts = visibleTargets(u);
  if (!ts.length) { UI.toast('沒有視線內的目標'); return; }
  S.mode = 'target';
  S.targets = ts.map(t => ({ ...t, armor: u.apNext ? 0 : Math.max(0, (t.unit.armor || 0) - (weapon(u).pierce || 0)) })); // 裝了穿甲彈就不算裝甲；榴彈無視 1～2 點
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
  UI.showTargeting(S.targets, S.targetIdx, canTriple(u) ? S.triple : null);
}

function cancelTarget() {
  if (S.mode !== 'target') return;
  S.mode = 'move';
  selectUnit(S.selected);
}

const canTriple = u => !!u && u.girl === 'momo' && lv(u, 'gun') >= 5 && weapon(u).id === 'tri' && weapon(u).ammo >= 3;

// 朱音雙槍齊射的第二個目標
function secondTarget(u, prim) {
  // 不自動挑人偶：打人偶要自己決定（會被纏住），補射不能拿來繞過這條規則
  if (u.girl === 'akane' && lv(u, 'gun') >= 5) return visibleTargets(u).map(o => o.unit).find(e => e !== prim && !e.lockOnHit) || null;
  return null;
}

async function fire() {
  if (S.mode !== 'target' || S.busy) return;
  const t = S.targets[S.targetIdx];
  const u = S.selected;
  const triple = S.triple && canTriple(u);
  // 扣掉裝甲後不可能有效的射擊：擋下來，免得白白交出主動權
  if (t.armor && UI.effHit(t.odds, t.armor, triple ? t.odds.dice * 2 : t.odds.dice) === 0) {
    cancelTarget();
    const why = `${t.unit.name} 有裝甲：${triple ? t.odds.dice * 2 : t.odds.dice} 骰就算全中也會被擋光，這槍不可能有效（沒有開槍）`;
    UI.toast(why, 2600);
    UI.log(why, 'warn');
    return;
  }
  S.mode = 'move';
  UI.hideTargeting();
  tgtRing.visible = false;
  S.busy = true;
  const second = secondTarget(u, t.unit);
  Rec.tag(triple ? '三管齊發' : '射擊');
  let hit = await shoot(u, t.unit, { triple });
  if (second && second.alive && u.alive && weapon(u).ammo > 0) {
    UI.log(`${u.name} 雙槍齊射！`, 'dim');
    hit = (await shoot(u, second)) || hit;
  }
  lockAfterAttack(u, t.unit);
  S.busy = false;
  await resolvePlayerAction(hit, u);
}

// 戰鬥中使用消耗品。回傳說明文字（不能用時）或 null
const flashTargets = u => enemies().filter(e => e.mesh.visible && dist(u, e) <= 6.5 && hasLOS(S.map, u, e));
async function useItem(u, item, target = null) {
  if (!canAct(u)) return '現在不能行動';
  if (!(u.items || []).includes(item)) return `${u.name} 沒有帶${ITEMS[item] ? ITEMS[item].name : item}`;
  if (item === 'medkit') {
    if (u.hp >= u.maxHp) return `${u.name} 沒有受傷`;
    u.hp = Math.min(u.maxHp, u.hp + RULES.HEART_HP);
    floatText(u, '+1 心', 'ow');
    UI.log(`${u.name} 用了醫療包，回 1 顆心`, 'good');
  } else if (item === 'apround') {
    if (u.apNext) return '穿甲彈已經裝好了';
    u.apNext = true;
    floatText(u, '穿甲彈', 'ow');
    UI.log(`${u.name} 裝填穿甲彈：下一次主動射擊無視裝甲`, 'good');
  } else if (item === 'flash') {
    const ts = flashTargets(u);
    const t = target && ts.includes(target) ? target : null;
    if (!t) return ts.length ? '要指定 6 格內看得到的敵人' : '6 格內沒有看得到的敵人';
    S.busy = true;
    floatText(t, '閃光！', 'crit');
    const hit = [t, ...enemies().filter(e => e !== t && dist(e, t) < 1.5)];
    for (const e of hit) suppress(e, '閃光！');
    UI.log(`${u.name} 丟出閃光彈：${hit.map(e => e.name).join('、')} 進入壓制`, 'good');
    makeNoise(u, t);
    S.busy = false;
  } else if (item === 'calm') {
    if (u.steady && !u.suppressed && !u.pinned) return `${u.name} 已經穩住了`;
    if (u.suppressed || u.pinned) rally(u); // 不算暴露：不吃反應射擊
    u.steady = true;
    floatText(u, '鎮定', 'ow');
    UI.log(`${u.name} 用了鎮定劑：這次主動權內不會再被壓制`, 'good');
  } else return '不能用';
  u.items.splice(u.items.indexOf(item), 1);
  Camp.consume(u.girl, item);
  Rec.tag('道具：' + ITEMS[item].name);
  refresh();
  await resolvePlayerAction(true, u);
  return null;
}

const actions = {
  shoot() { if (S.mode === 'target') fire(); else enterTargetMode(); },
  // 道具按鈕：列出選取角色的消耗品
  items() {
    const u = S.selected;
    if (!canAct(u) || !(u.items || []).length) { UI.toast(u && u.items && !u.items.length ? '沒有帶可用的道具' : '現在不能用道具'); return; }
    UI.showItemMenu(u.items.map((k, i) => ({
      label: ITEMS[k].name, desc: ITEMS[k].desc, key: k + i,
      sub: k === 'flash' ? flashTargets(u).map(e => ({ label: `丟向 ${e.name}`, go: () => useItem(u, k, e).then(m => m && UI.toast(m)) })) : null,
      go: k === 'flash' ? null : () => useItem(u, k).then(m => m && UI.toast(m)),
    })));
  },
  async rally() {
    const u = S.selected;
    if (!canAct(u) || !(u.suppressed || u.pinned)) return;
    S.busy = true;
    rally(u);
    if (u.girl === 'yukino') u.steady = true; // 很壯：起身後這次主動權內不會再被壓制
    const hit = await exposeReact(u); // 抬頭的瞬間會被盯上
    S.busy = false;
    Rec.rally('player', !hit);
    Rec.tag('起身');
    await resolvePlayerAction(!hit, u);
  },
  async reload() {
    const u = S.selected;
    if (!canAct(u)) return;
    const info = reloadInfo(u);
    if (!info) { UI.toast(weapon(u).ammo >= weapon(u).mag ? '彈匣是滿的' : '沒有備彈了'); return; }
    const w = weapon(u);
    if (info.gives && !confirmGive('reload', `${w.name}換彈`)) return;
    const n = Math.min(w.mag - w.ammo, w.reserve);
    w.ammo += n;
    w.reserve -= n;
    floatText(u, '換彈', 'ow');
    Rec.tag(info.gives ? '換彈（交出）' : '換彈');
    if (!info.gives) { UI.log(`${u.name} ${w.name}換彈（不交出主動權）`, 'dim'); await resolvePlayerAction(true); return; }
    S.busy = true;
    await exposeReact(u);
    S.busy = false;
    if (checkEnd()) return;
    await endWithHandover(`${u.name} ${w.name}換彈，交出主動權`);
  },
  async swap() {
    const u = S.selected;
    if (!canAct(u)) return;
    if (u.weapons.length < 2) { UI.toast(`${u.name} 沒有副武器`); return; }
    const to = u.wi === 0 ? 1 : 0;
    const nw = u.weapons[to];
    const gives = !nw.sidearm;
    if (gives && !confirmGive('swap', `換回${nw.name}`)) return;
    u.wi = to;
    Rec.tag(gives ? '換主武器（交出）' : '拔副武器');
    swapGunMesh(u);
    floatText(u, `換${nw.short}`, 'ow');
    if (!gives) { UI.log(`${u.name} 拔出${nw.name}`, 'dim'); await resolvePlayerAction(true); return; }
    let also = '';
    if (nw.ammo <= 0 && nw.reserve > 0) { // 換回來的主武器是空的：一起換彈（反正都要交出主動權）
      const k = Math.min(nw.mag, nw.reserve);
      nw.ammo += k;
      nw.reserve -= k;
      also = '並換好彈';
    }
    S.busy = true;
    await exposeReact(u);
    S.busy = false;
    if (checkEnd()) return;
    await endWithHandover(`${u.name} 換回${nw.name}${also}，交出主動權`);
  },
  async plant() {
    const u = S.selected;
    if (!canPlant(u)) return;
    S.mission.objective.planted = true;
    Rec.tag('炸藥');
    floatText(u, '炸藥安裝完成', 'ow');
    UI.log(`${u.name} 在終端安裝了炸藥，撤回左側！`, 'good');
    UI.banner('炸藥已安裝', 'player');
    if (S.conds.includes('plant')) await plantAlarm();
    drawZones();
    await resolvePlayerAction(true);
  },
  reloadInfo,
  canPlant,
  magic: useMagic,
  magicInfo,
  magicMode: () => S.mode === 'magic',
  toggleTriple() { S.triple = !S.triple; updateTargeting(); },
  pass() {
    if (S.side !== 'player' || S.busy || S.gameOver) return;
    if (S.mode === 'target') cancelTarget();
    if (S.mode === 'magic') exitMagic();
    UI.log('我方放棄主動權', 'dim');
    Rec.tag('放棄');
    Rec.playerAct(true);
    giveInitiative('enemy');
  },
  select(u) { if ((S.side === 'player' || S.side === 'deploy') && !S.busy) { S.magicOpts = null; selectUnit(u); } },
  start: startBattle,
  rotL() { camRot += Math.PI / 4; },
  rotR() { camRot -= Math.PI / 4; },
  canAct,
  pickTarget(i) { S.targetIdx = i; updateTargeting(); },
  fire,
  cancelTarget,
};
UI.init(actions);

// ================= 魔法少女的能力 =================
// 落地檢查：詛咒格
function landed(u) {
  u.movedInit = S.initNo;
  if (!u.alive || u.team !== 'player') return;
  if (S.curse.has(key(u.x, u.z)) && !u.suppressed) {
    UI.log(`${u.name} 踩到詛咒格，被壓制了`, 'bad');
    suppress(u, '詛咒！');
  }
}

function magicInfo(u) {
  if (!u || u.team !== 'player' || !u.ability) return null;
  if (u.ability === 'transform') {
    if (u.transformed) return { label: '已變身', usable: false, why: '已經變身了' };
    if (lv(u, 'magic') >= 5) return { label: '變身', usable: true };
    return { label: '變身', usable: false, why: '她自己的行動失敗時會自動變身' };
  }
  const name = { dash: '突進', ice: '冰塊', airdrop: '空投', mark: '標記', blast: '爆破', bless: '祝福' }[u.ability];
  let usable = u.uses > 0, why = u.uses > 0 ? '' : '這張地圖已經用完了';
  if (usable && u.ability !== 'ice' && u.ability !== 'bless' && (u.suppressed || u.pinned)) { usable = false; why = u.suppressed ? '被壓制中，先起身' : '受阻中，先起身'; }
  if (usable && u.ability === 'airdrop' && u.weapons[0].reserve < 3) { usable = false; why = '霰彈備彈不足 3 發，不能空投'; }
  return { label: `${name}×${u.uses}`, usable, why };
}

function magicOptions(u) {
  const out = new Map();
  if (u.ability === 'dash') {
    for (const mv of moveOptions(u).values()) {
      if (mv.vault) continue;
      if (enemies().some(e => e.mesh.visible && dist(e, mv) < 1.5)) out.set(key(mv.x, mv.z), { kind: 'dash', x: mv.x, z: mv.z, mv });
    }
  } else if (u.ability === 'ice') {
    for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
      const p = { x, z };
      if (!S.map.walkable(x, z) || dist(u, p) > RULES.ICE_RANGE || iceAt(x, z)) continue;
      if (!(x === u.x && z === u.z) && !hasLOS(S.map, u, p)) continue;
      if (S.crates.some(c => c.x === x && c.z === z)) continue;
      const occ = unitAt(x, z);
      if (occ && occ.team === 'enemy' && (!occ.mesh.visible || lv(u, 'magic') < 4)) continue;
      out.set(key(x, z), { kind: 'ice', x, z, rider: occ || null });
    }
  } else if (u.ability === 'airdrop') {
    // 最多 AIRDROP_RANGE 格，而且落點要在隊友（含自己）看得見的地方
    const ps = players();
    for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
      const p = { x, z };
      if (!S.map.walkable(x, z) || unitAt(x, z) || dist(u, p) > RULES.AIRDROP_RANGE) continue;
      if (!ps.some(q => dist(q, p) <= RULES.SIGHT && hasLOS(S.map, q, p))) continue;
      out.set(key(x, z), { kind: 'airdrop', x, z });
    }
  } else if (u.ability === 'mark') {
    for (const e of enemies()) if (e.mesh.visible && !e.summon && sees(u, e)) out.set(key(e.x, e.z), { kind: 'mark', x: e.x, z: e.z, unit: e });
  } else if (u.ability === 'blast') {
    const R = RULES.BLAST_RANGE[lv(u, 'magic') >= 2 ? 1 : 0];
    for (const p of blastCells(u, R)) out.set(key(p.x, p.z), { kind: 'blast', x: p.x, z: p.z });
  } else if (u.ability === 'bless') {
    const R = RULES.BLESS_RANGE[lv(u, 'magic') >= 1 ? 1 : 0];
    for (const p of players()) if (dist(u, p) <= R + 0.01 && (p === u || hasLOS(S.map, u, p))) out.set(key(p.x, p.z), { kind: 'bless', x: p.x, z: p.z, unit: p });
  }
  return out;
}

async function useMagic() {
  if (S.mode === 'magic') { exitMagic(); return; }
  const u = S.selected;
  if (!canAct(u)) return;
  const info = magicInfo(u);
  if (!info) return;
  if (!info.usable) { UI.toast(info.why); return; }
  if (u.ability === 'transform') {
    Rec.tag('魔法：變身');
    S.busy = true;
    await transform(u, true);
    S.busy = false;
    await resolvePlayerAction(true, u);
    return;
  }
  const opts = magicOptions(u);
  if (!opts.size) { UI.toast(u.ability === 'dash' ? '沒有能直線突進到敵人旁邊的位置' : '沒有可以用的位置'); return; }
  S.mode = 'magic';
  S.magicOpts = opts;
  S.moves = null;
  pendingTap = null;
  drawRange();
  updateHover();
  refresh();
  UI.toast({ dash: '選擇突進終點（橘色格子）', ice: '選擇放冰塊的位置（可以放在隊友腳下）', airdrop: '選擇落點（橘色格子）',
    mark: '選擇要標記的敵人', blast: '選擇要炸掉的掩體或冰塊', bless: '選擇要祝福的隊友（可以選自己）' }[u.ability], 2200);
}

function exitMagic() {
  if (S.mode !== 'magic') return;
  S.mode = 'move';
  S.magicOpts = null;
  selectUnit(S.selected);
}

async function execMagic(u, opt) {
  S.mode = 'move';
  S.magicOpts = null;
  S.busy = true;
  clearOverlays();
  u.uses--;
  Rec.tag('魔法：' + ({ dash: '突進', ice: '冰牆', airdrop: '空投', mark: '標記', blast: '爆破', bless: '祝福' }[opt.kind] || opt.kind));
  let ok = true;
  if (opt.kind === 'dash') ok = await dash(u, opt);
  else if (opt.kind === 'ice') { placeIce(opt.x, opt.z, opt.rider, u); await wait(0.4); }
  else if (opt.kind === 'airdrop') ok = await airdrop(u, opt);
  else if (opt.kind === 'mark') markEnemy(u, opt.unit);
  else if (opt.kind === 'blast') await blast(u, opt);
  else if (opt.kind === 'bless') bless(u, opt.unit);
  S.busy = false;
  await resolvePlayerAction(ok, u);
}

// ---------- 千夏：標記 ----------
function markEnemy(u, t) {
  const m = lv(u, 'magic');
  const list = [t, ...(m >= 3 ? enemies().filter(e => e !== t && !e.summon && dist(e, t) < 1.5) : [])];
  for (const e of list) {
    e.marked = true;
    e.markLv = Math.max(e.markLv || 0, m);
    e.mesh.visible = true;
    e.spotted = true;
    floatText(e, '標記', 'crit');
    if (m >= 2) pin(e, '標記・受阻');
    if (e.label) UI.updateLabel(e.label, e);
  }
  UI.log(`${u.name} 標記了 ${list.map(e => e.name).join('、')}：一直看得到她們，隊友打她們每顆骰 +${RULES.MARK_BONUS[m >= 4 ? 1 : 0]}%`, 'good');
  refresh();
}

// ---------- 楓：榴彈、爆破、炸掉掩體 ----------
const isObjective = (x, z) => !!S.mission.objective && S.mission.objective.x === x && S.mission.objective.z === z;
// 掩體降一級（或直接變成 to）：換掉模型
function degradeCell(x, z, to = null) {
  const cur = S.map.get(x, z);
  if (cur === T.FLOOR || isObjective(x, z) || iceAt(x, z)) return false;
  const next = to ?? (cur === T.FULL ? T.HALF : T.FLOOR);
  const k = key(x, z), old = S.cellMesh && S.cellMesh.get(k);
  if (old) { world.remove(old); disposeTree(old); S.cellMesh.delete(k); }
  S.map.set(x, z, next);
  if (next === T.HALF) { const nm = makeHalf(S.theme, x, z); world.add(nm); S.cellMesh.set(k, nm); }
  floatText({ mesh: { position: { x, z } } }, next === T.HALF ? '炸成半掩體' : '炸掉了', 'crit');
  updateVisibility();
  return true;
}
// 目標面對射手那一側的掩體（最高的一格）
function coverCellFacing(t, s) {
  const vx = s.x - t.x, vz = s.z - t.z, L = Math.hypot(vx, vz) || 1;
  let best = null;
  for (const [dx, dz] of ORTH) {
    const x = t.x + dx, z = t.z + dz, c = S.map.get(x, z);
    if (!S.map.inB(x, z) || c === T.FLOOR || isObjective(x, z) || iceAt(x, z) || (dx * vx + dz * vz) / L < 0.35) continue;
    if (!best || c > best.c) best = { x, z, c };
  }
  return best;
}
async function grenade(s, t, w) {
  // 波及：目標周圍 1 格的人各擲一次（楓槍法 1 起不打自己人）
  const near = S.units.filter(o => o.alive && o !== t && o !== s && !o.flying && dist(o, t) < 1.5 && !(w.noFriendly && o.team === s.team)
    && !(t.biteCluster && o === t.attached)); // 打向被咬的隊友：只打掉使魔，不傷她
  for (const o of near) {
    const od = oddsVs(s, o);
    let r = 0;
    for (let i = 0; i < od.dice; i++) if (Math.random() * 100 < od.die) r++;
    const a = Math.max(0, (o.armor || 0) - (w.pierce || 0));
    const e2 = Math.max(0, r - a);
    UI.log(`榴彈波及 ${o.name}（${od.dice} 骰×${od.die}%）${r ? `中 ${r}${e2 < r ? `（裝甲擋掉 ${r - e2}）` : ''}` : '未命中'}`, o.team === s.team ? 'bad' : e2 ? 'good' : 'dim');
    if (e2) await strike(o, e2, s);
  }
  // 炸掉目標的掩體
  {
    const c = coverCellFacing(t, s);
    if (c && (w.rubbleSure || Math.random() * 100 < RULES.RUBBLE_CHANCE)) {
      degradeCell(c.x, c.z);
      UI.log(`榴彈把 (${c.x},${c.z}) 的${c.c === T.FULL ? '全掩體炸成半掩體' : '半掩體炸掉了'}`, 'good');
    }
  }
}
function blastCells(u, R) {
  const out = [];
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
    const p = { x, z };
    if (dist(u, p) > R + 0.01 || isObjective(x, z)) continue;
    const ice = iceAt(x, z);
    if (!ice && S.map.get(x, z) === T.FLOOR) continue;
    if (!hasLOS(S.map, u, p, R + 0.5)) continue;
    out.push(p);
  }
  return out;
}
async function blast(u, opt) {
  const m = lv(u, 'magic');
  floatText(u, '爆破！', 'ow');
  const ice = iceAt(opt.x, opt.z);
  if (ice) breakIce(ice);
  else degradeCell(opt.x, opt.z, T.FLOOR);
  if (m >= 4) { // 連旁邊一格一起炸
    const side = ORTH.map(([dx, dz]) => ({ x: opt.x + dx, z: opt.z + dz })).find(p => S.map.inB(p.x, p.z) && S.map.get(p.x, p.z) !== T.FLOOR && !isObjective(p.x, p.z) && !iceAt(p.x, p.z));
    if (side) degradeCell(side.x, side.z, T.FLOOR);
  }
  const r = m >= 3 ? 2.5 : 1.5;
  const hit = enemies().filter(e => dist(e, opt) <= r);
  UI.log(`${u.name} 爆破 (${opt.x},${opt.z})${hit.length ? `：${hit.map(e => e.name).join('、')} 進入壓制` : ''}`, 'good');
  for (const e of hit) {
    suppress(e, '爆破！');
    if (m >= 1) await strike(e, 1, u);
  }
  makeNoise(u, opt);
  await wait(0.3);
}

// ---------- 詩織：祝福 ----------
function bless(u, p) {
  const m = lv(u, 'magic');
  const heal = (m >= 5 ? 2 : 1) * RULES.HEART_HP;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + heal);
  if (p.suppressed || p.pinned) rally(p); // 不算暴露：不吃反應射擊
  if (m >= 2) p.steady = true;
  if (m >= 3) p.stress = 0;
  floatText(p, `祝福${p.hp > before ? ` +${Math.round((p.hp - before) / RULES.HEART_HP)} 心` : ''}`, 'ow');
  UI.log(`${u.name} 祝福了 ${p.name === u.name ? '自己' : p.name}${p.hp > before ? `，回 ${Math.round((p.hp - before) / RULES.HEART_HP)} 顆心` : ''}`, 'good');
  if (p.label) UI.updateLabel(p.label, p);
  refresh();
}

// ---------- 桃樂絲的「提線」：被打倒的人偶在下一次敵方主動權站起來 ----------
async function reviveDolls() {
  for (const e of S.units) {
    if (e.alive || !e.revivePending || S.gameOver) continue;
    e.revivePending = false;
    if (unitAt(e.x, e.z)) continue;
    e.revived = true;
    e.alive = true;
    e.hp = Math.ceil(e.maxHp / 2);
    e.stress = 0;
    e.mesh.rotation.x = 0;
    e.mesh.position.y = 0;
    e.mesh.traverse(o => { if (o.material) { o.material.opacity = 1; o.material.transparent = false; } });
    anim(e, 'idle', { fade: 0.4 });
    e.label = UI.makeLabel(e);
    if (e.mesh.visible) { focusUnit(e); floatText(e, '提線！', 'crit'); }
    UI.log(`${e.name} 被線拉了起來（生命 ${e.hp}）`, 'warn');
    await wait(0.4);
  }
}

// ---------- 朱音：突進 + 近戰 ----------
async function dash(u, opt) {
  floatText(u, '突進！', 'ow');
  UI.log(`${u.name} 突進！`, 'dim');
  u.dashDodge = lv(u, 'magic') >= 4 ? 1 : 0;
  const ok = await performMove(u, opt.mv);
  u.dashDodge = 0;
  if (!u.alive) return ok;
  pickupCrate(u);
  landed(u);
  if (!ok) return false;
  // 預定的目標：指定的那個，否則是終點旁邊看得到的敵人。中途停下時，不會改打旁邊另一個敵人
  const planned = opt.target ? [opt.target] : enemies().filter(e => e.mesh.visible && dist(e, opt.mv) < 1.5);
  const adj = enemies().filter(e => dist(e, u) < 1.5 && planned.includes(e)).sort((a, b) => a.hp - b.hp);
  const pick = adj[0]; // 打血最少的預定目標
  if (pick) await melee(u, pick);
  else { u.uses++; Rec.tag('魔法：突進（退回）'); UI.log(`${u.name} 的突進沒碰到敵人（被發現停下），次數退回`, 'warn'); }
  return true;
}

async function melee(u, t) {
  u.mesh.rotation.y = Math.atan2(t.x - u.x, t.z - u.z);
  const p0 = u.mesh.position.clone(), p1 = p0.clone().lerp(new THREE.Vector3(t.x, p0.y, t.z), 0.4);
  anim(u, 'shoot', { fade: 0.05 });
  await tween(0.1, k => u.mesh.position.lerpVectors(p0, p1, k));
  floatText(u, '近戰！', 'ow');
  await tween(0.12, k => u.mesh.position.lerpVectors(p1, p0, k));
  anim(u, 'idle');
  if (!t.alerted) alertEnemies([t], 'melee'); // 只驚動被打的那個：近戰不發出槍聲
  UI.log(`${u.name} 近戰 → ${t.name}：直接受傷 ${RULES.MELEE_WOUNDS} 次`, 'good');
  if (!t.shield && !t.unflinching) t.stress = RULES.SUP_AT; // 近戰不經過三階
  await strike(t, RULES.MELEE_WOUNDS, u);
  const m = lv(u, 'magic');
  if (t.alive && m >= 1) {
    await knockback(t, Math.sign(t.x - u.x), Math.sign(t.z - u.z), m >= 2 ? 2 : 1, { collide: m >= 2, splash: m >= 3 });
  }
  lockAfterAttack(u, t);
}

// ================= 稻草人與烏鴉 =================
// 烏鴉的目標：稻草人看得到、還沒被纏住的少女。變身中的光最顯眼，否則挑最近的
function crowTarget(e) {
  const ps = players().filter(p => !p.crowLocked && hasLOS(S.map, e, p));
  if (!ps.length) return null;
  return ps.find(p => p.transformed) || ps.reduce((a, b) => dist(e, b) < dist(e, a) ? b : a);
}
const canLaunch = e => e.kind === 'scarecrow' && e.alive && e.alerted && !e.flock && e.crows >= e.crowMax && !!crowTarget(e);

// 放烏鴉前的警告：烏鴉滿了的稻草人標出下一個目標（敵方一行動就會放）
function markCrowAims() {
  if (!S.units) return;
  const ps = players();
  const before = new Map(ps.map(p => [p, p.crowAimed]));
  for (const p of ps) { p.crowAimed = null; p.crowAimedLast = false; }
  for (const e of enemies()) {
    if (e.kind !== 'scarecrow') continue;
    const pc = e.mesh && e.mesh.userData.perched; // 身上停著的烏鴉跟著數量
    if (pc) pc.forEach((c, i) => (c.visible = i < e.crows));
    const prev = e.crowAim;
    e.crowAim = canLaunch(e) ? crowTarget(e) : null;
    const t = e.crowAim;
    if (t) {
      t.crowAimed = e;
      t.crowAimedLast = ps.filter(p => !p.crowLocked).length <= 1;
      if (prev !== t) UI.log(`⚠ ${e.name} 的烏鴉滿了：敵方一行動就會放向 ${t.name}${t.crowAimedLast ? '（只剩她能行動，被纏住就輸）' : ''}`, 'warn');
    }
    if (prev !== t && e.label) UI.updateLabel(e.label, e);
  }
  for (const p of ps) if (before.get(p) !== p.crowAimed && p.label) UI.updateLabel(p.label, p);
}

function launchCrows(e) {
  const t = crowTarget(e);
  if (!t) return false;
  const f = spawnEnemy('crows', e.x, e.z, e.zone, true);
  f.owner = e;
  f.target = t;
  f.hp = e.crows;
  e.flock = f;
  e.crows = 0;
  f.mesh.position.y = 0.7;
  updateBirds(f);
  floatText(e, '放出烏鴉', 'ow');
  UI.log(`${e.name} 放出了烏鴉，飛向 ${t.name}（還沒纏上前可以在空中打掉）`, 'bad');
  if (e.label) UI.updateLabel(e.label, e);
  updateVisibility();
  refresh();
  return true;
}

// 烏鴉的衝動：往目標直線飛 CROW_SPEED 格（不管牆），再 1 格內就纏上
async function flyCrows(f) {
  let t = f.target;
  if (!t || !t.alive || t.crowLocked) {
    t = f.target = players().filter(p => !p.crowLocked).sort((a, b) => dist(f, a) - dist(f, b))[0];
  }
  if (!t) return;
  impulseNote(f, `飛向 ${t.name}`);
  const d = dist(f, t);
  if (d <= RULES.CROW_SPEED + 1.01) { await moveFlock(f, t, 1.0); attachCrows(f, t); return; }
  let dest = null;
  for (let s = RULES.CROW_SPEED; s >= 1 && !dest; s -= 0.5) {
    const x = Math.round(f.x + (t.x - f.x) * s / d), z = Math.round(f.z + (t.z - f.z) * s / d);
    if (S.map.walkable(x, z)) dest = { x, z };
  }
  if (dest) await moveFlock(f, dest, 0.7);
}

async function moveFlock(f, p, y) {
  const a = f.mesh.position.clone(), b = new THREE.Vector3(p.x, y, p.z);
  f.mesh.rotation.y = Math.atan2(p.x - f.x, p.z - f.z);
  await tween(0.45, k => { f.mesh.position.lerpVectors(a, b, k); f.mesh.position.y += Math.sin(k * Math.PI) * 0.4; });
  f.x = p.x;
  f.z = p.z;
  updateVisibility();
}

function attachCrows(f, t) {
  f.attached = t;
  t.crowLocked = f;
  f.x = t.x;
  f.z = t.z;
  f.mesh.position.set(t.x, 1.0, t.z);
  floatText(t, '被烏鴉纏住！', 'dmg');
  UI.log(`${t.name} 被烏鴉纏住了：不能行動、不能反應射擊。隊友朝她開槍打掉全部烏鴉，或打中稻草人，才能解除`, 'bad');
  if (t.label) UI.updateLabel(t.label, t);
  refresh();
  checkEnd();
}

function updateBirds(f) {
  (f.mesh.userData.birds || []).forEach((b, i) => (b.visible = i < f.hp));
}

// 烏鴉離場（被打散、傳送回去、稻草人倒下）：放開纏住的少女
function removeFlock(f) {
  f.alive = false;
  if (f.label) { f.label.remove(); f.label = null; }
  unitGroup.remove(f.mesh);
  const t = f.attached;
  if (t) { t.crowLocked = null; f.attached = null; if (t.label) UI.updateLabel(t.label, t); }
  if (f.owner && f.owner.flock === f) f.owner.flock = null;
}

// 打中稻草人：烏鴉（剩幾隻就回幾隻）立刻傳送回它身上
function recallCrows(e) {
  const f = e.flock;
  if (!f || !f.alive) return;
  e.crows = f.hp;
  const t = f.attached;
  removeFlock(f);
  floatText(e, '烏鴉飛回來了', 'ow');
  UI.log(`${e.name} 被打中，${e.crows} 隻烏鴉傳送回它身上${t ? `，${t.name} 自由了` : ''}`, 'good');
  if (e.label) UI.updateLabel(e.label, e);
  refresh();
}

// 我方每成功行動一次：烏鴉不在外面的稻草人恢復進度 +1
function crowTick() {
  for (const e of enemies()) {
    if (e.kind !== 'scarecrow' || e.flock || e.crows >= e.crowMax) continue;
    if (++e.regen >= RULES.CROW_REGEN) {
      e.regen = 0;
      e.crows++;
      UI.log(`${e.name} 身上回來了 1 隻烏鴉（${e.crows}/${e.crowMax}）`, 'dim');
    }
    if (e.label) UI.updateLabel(e.label, e);
  }
}

// 人偶：直接攻擊它（不含波及）卻沒打倒，攻擊者這次主動權不能再行動。沒打中也算
function lockAfterAttack(u, t) {
  if (!t.lockOnHit || !t.alive || !u.alive || u.team !== 'player') return;
  u.locked = t; // 記住是哪一具人偶：它倒下就解除
  floatText(u, '被纏住了', 'sup');
  UI.log(`${u.name} 沒能打倒${t.name}，被它纏住：這次主動權不能再行動`, 'warn');
  if (u.label) UI.updateLabel(u.label, u);
}

// 擊退：一格一格推，撞到牆或單位就停
async function knockback(t, dx, dz, n, { collide = false, splash = false } = {}) {
  if (t.raised || t.immobile || !(dx || dz)) return;
  let moved = false;
  for (let i = 0; i < n && t.alive; i++) {
    const to = { x: t.x + dx, z: t.z + dz };
    const occ = unitAt(to.x, to.z);
    const free = S.map.walkable(to.x, to.z) && !occ && clearMove(S.map, t, to, (x, z) => occupied(x, z, t));
    if (!free) {
      if (collide) {
        floatText(t, '撞！', 'crit');
        UI.log(`${t.name} 被撞上${occ ? occ.name : '障礙物'}`, 'good');
        await strike(t, 1);
        if (occ && occ.alive) await strike(occ, 1);
      }
      break;
    }
    const a = t.mesh.position.clone(), b = new THREE.Vector3(to.x, 0, to.z);
    await tween(0.14, k => t.mesh.position.lerpVectors(a, b, k));
    t.x = to.x;
    t.z = to.z;
    moved = true;
  }
  if (moved && t.alive) {
    floatText(t, '擊退', 'ow');
    if (splash) for (const e of enemies()) if (e !== t && dist(e, t) < 1.5) suppress(e);
    if (t.team === 'player') landed(t);
  }
  updateVisibility();
}

// ---------- 光：變身 ----------
async function transform(u, manual = false) {
  u.transformed = true;
  const m = lv(u, 'magic');
  const hearts = m >= 2 ? 2 : 1;
  const bonus = hearts * RULES.HEART_HP;
  u.maxHp += bonus;
  u.hp += bonus;
  UI.banner(`${u.name} 變身！`, 'player');
  UI.log(manual ? `${u.name} 主動變身！` : `${u.name} 的行動失敗了……可是她變身了！敵人沒能拿到主動權`, 'good');
  addHalo(u.mesh);
  const base = u.mesh.scale.clone();
  await tween(0.5, k => u.mesh.scale.copy(base).multiplyScalar(1 + Math.sin(k * Math.PI) * 0.25));
  floatText(u, `變身！ +${hearts} 心`, 'crit');
  if (m >= 1 && (u.suppressed || u.pinned)) rally(u);
  if (m >= 3) for (const e of enemies()) if (dist(e, u) <= 3) suppress(e, '閃光！');
  if (m >= 4) for (const p of players()) if (p !== u && (p.suppressed || p.pinned)) rally(p);
  await wait(0.3);
  refresh();
}

// ---------- 雪乃：冰塊 ----------
function placeIce(x, z, rider, caster) {
  const m = lv(caster, 'magic');
  const mat = new THREE.MeshStandardMaterial({ color: 0xbfe9ff, emissive: 0x2a5a7a, emissiveIntensity: 0.4,
    roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, ICE_H, 0.9), mat);
  mesh.position.set(x, ICE_H / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  world.add(mesh);
  const hp = m >= 1 ? 5 : RULES.ICE_HP;
  const ice = { x, z, hp, max: hp, lv: m, mesh, rider: null };
  S.ice.push(ice);
  if (rider) mountIce(ice, rider);
  else S.map.set(x, z, T.FULL);
  tween(0.3, k => mesh.scale.set(1, Math.max(0.01, k), 1));
  floatText(caster, '冰塊！', 'ow');
  UI.log(rider ? `${caster.name} 把 ${rider.name} 抬到冰塊上` : `${caster.name} 變出一塊冰`, 'dim');
  updateVisibility();
}

function mountIce(ice, u) {
  ice.rider = u;
  u.raised = true;
  u.iceRef = ice;
  if (u.team === 'enemy') u.frozen = true;
  S.map.set(ice.x, ice.z, T.FLOOR);
  const y0 = u.mesh.position.y;
  tween(0.3, k => { u.mesh.position.y = y0 + (ICE_H - y0) * k; });
}

function leaveIce(u) {
  const ice = u.iceRef;
  if (!ice) return;
  ice.rider = null;
  u.raised = false;
  u.iceRef = null;
  u.frozen = false;
  S.map.set(ice.x, ice.z, T.FULL);
}

function breakIce(ice) {
  S.ice.splice(S.ice.indexOf(ice), 1);
  world.remove(ice.mesh);
  ice.mesh.geometry.dispose();
  ice.mesh.material.dispose();
  const r = ice.rider;
  if (r) {
    r.raised = false; r.iceRef = null; r.frozen = false;
    if (r.alive) { const y0 = r.mesh.position.y; tween(0.2, k => { r.mesh.position.y = y0 * (1 - k); }); }
  } else S.map.set(ice.x, ice.z, T.FLOOR);
  UI.log('冰塊碎了', 'dim');
  if (ice.lv >= 3) for (const e of enemies()) if (dist(e, ice) < 1.5) suppress(e, '冰爆！');
  updateVisibility();
}

// 子彈打在提供掩體的冰塊上（不論命中與否）
function chipIce(s, t) {
  let ice = t.raised ? t.iceRef : null;
  if (!ice) {
    const vx = s.x - t.x, vz = s.z - t.z, L = Math.hypot(vx, vz) || 1;
    for (const [dx, dz] of ORTH) {
      const i = iceAt(t.x + dx, t.z + dz);
      if (i && !i.rider && (dx * vx + dz * vz) / L >= 0.35) { ice = i; break; }
    }
  }
  if (!ice || !S.ice.includes(ice)) return;
  ice.hp--;
  ice.mesh.material.opacity = 0.4 + 0.42 * Math.max(0, ice.hp) / ice.max;
  if (ice.hp <= 0) breakIce(ice);
}

// 雪乃站在冰塊旁 → 往反方向直線推到撞上障礙物
function pushInfo(u, ice) {
  if (!u || u.ability !== 'ice' || !ice || u.suppressed) return null;
  const dx = ice.x - u.x, dz = ice.z - u.z;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return null;
  const cells = [];
  let x = ice.x, z = ice.z, blocker = null;
  for (;;) {
    const nx = x + dx, nz = z + dz;
    if (!S.map.walkable(nx, nz)) break;
    const occ = unitAt(nx, nz);
    if (occ) { blocker = occ; break; }
    x = nx; z = nz;
    cells.push({ x, z });
  }
  if (!cells.length) return null;
  cells.forEach((c, i) => { c.t = (i + 1) / cells.length; });
  return { ice, dx, dz, cells, blocker };
}

async function execPush(u, info) {
  Rec.tag('推冰牆');
  S.busy = true;
  clearOverlays();
  const { ice, cells } = info;
  const r = ice.rider;
  if (!r) S.map.set(ice.x, ice.z, T.FLOOR);
  const plan = r ? planReactions(r, cells) : [];
  u.mesh.rotation.y = Math.atan2(info.dx, info.dz);
  floatText(u, '推！', 'ow');
  UI.log(`${u.name} 推動冰塊${r ? `（${r.name} 跟著滑）` : ''}`, 'dim');
  let ok = true, stopped = false;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const a = ice.mesh.position.clone(), b = new THREE.Vector3(c.x, ICE_H / 2, c.z);
    const ra = r ? r.mesh.position.clone() : null;
    await tween(0.09, k => {
      ice.mesh.position.lerpVectors(a, b, k);
      if (r) r.mesh.position.set(ra.x + (c.x - ra.x) * k, ICE_H, ra.z + (c.z - ra.z) * k);
    });
    ice.x = c.x;
    ice.z = c.z;
    if (r) { r.x = c.x; r.z = c.z; updateVisibility(); if (r.mesh.visible) focusUnit(r); }
    if (r && await reactAt(r, plan, i)) { ok = false; stopped = true; break; }
    if (!S.ice.includes(ice)) { stopped = true; break; }
    if (r && r.alive && r.team === 'player' && i < cells.length - 1 && detect()) { stopped = true; break; }
  }
  if (S.ice.includes(ice) && !ice.rider) S.map.set(ice.x, ice.z, T.FULL);
  const bl = info.blocker;
  if (!stopped && bl && bl.alive && bl.team === 'enemy' && ice.lv >= 2) await knockback(bl, info.dx, info.dz, 1);
  if (r && r.alive) { pickupCrate(r); landed(r); }
  updateVisibility();
  S.busy = false;
  await resolvePlayerAction(ok, u);
}

// ---------- 小桃：空投、後座力 ----------
async function airdrop(u, opt) {
  const sg = u.weapons[0];
  sg.reserve -= 3;
  sg.ammo = sg.mag; // 落地前就換好彈
  const m = lv(u, 'magic');
  const from = { x: u.x, z: u.z };
  let ally = null, allyTo = null;
  if (m >= 4 && !u.carryUsed) { // 帶人空投每張地圖 1 次
    ally = players().find(p => p !== u && dist(p, u) < 1.5 && !p.suppressed && !p.pinned) || null;
    if (ally) {
      const spots = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = opt.x + dx, z = opt.z + dz;
        if ((dx || dz) && S.map.walkable(x, z) && !unitAt(x, z)) spots.push({ x, z });
      }
      allyTo = spots.sort((a, b) => dist(a, from) - dist(b, from))[0] || null;
      if (!allyTo) ally = null;
      else u.carryUsed = true;
    }
  }
  if (u.raised) leaveIce(u);
  if (ally && ally.raised) leaveIce(ally);
  u.wi = 0;
  swapGunMesh(u);
  u.mesh.rotation.y = Math.atan2(opt.x - u.x, opt.z - u.z);
  flash.position.set(u.x, 0.3, u.z);
  flash.intensity = 6;
  floatText(u, '砰砰砰！', 'crit');
  UI.log(`${u.name} 槍口抵地三管齊發，把自己彈上天${ally ? `（帶著 ${ally.name}）` : ''}`, 'dim');
  addHeartMark(from, m >= 2);
  if (m < 3) makeNoise(from);
  await wait(0.08);
  flash.intensity = 0;

  const flyers = [[u, opt]];
  if (ally) flyers.push([ally, allyTo]);
  const starts = flyers.map(([f]) => f.mesh.position.clone());
  await tween(0.9, k => flyers.forEach(([f, to], i) => {
    f.mesh.position.set(starts[i].x + (to.x - starts[i].x) * k, Math.sin(k * Math.PI) * 4, starts[i].z + (to.z - starts[i].z) * k);
  }));
  for (const [f, to] of flyers) { f.x = to.x; f.z = to.z; f.mesh.position.set(to.x, 0, to.z); }
  if (m >= 2 && !unitAt(from.x, from.z) && S.map.get(from.x, from.z) === T.FLOOR) S.map.set(from.x, from.z, T.HALF);
  updateVisibility();
  focusUnit(u);
  if (m >= 1) for (const e of enemies()) if (dist(e, u) < 1.5) suppress(e, '衝擊！');
  let ok = true;
  for (const [f] of flyers) {
    const cell = { x: f.x, z: f.z, t: 1 };
    if (await reactAt(f, planReactions(f, [cell]), 0)) ok = false;
  }
  detect();
  for (const [f] of flyers) if (f.alive) { pickupCrate(f); landed(f); }
  return ok;
}

// 起跳處的愛心彈痕；solid = 變成半掩體
function addHeartMark(p, solid) {
  const shape = heartShape(0.42);
  const mat = new THREE.MeshStandardMaterial({ color: solid ? 0x8a5a5a : 0x2a1a1a, roughness: 1 });
  const geo = solid
    ? new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }).rotateX(-Math.PI / 2)
    : new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p.x, solid ? 0 : 0.012, p.z);
  mesh.castShadow = solid;
  mesh.receiveShadow = true;
  world.add(mesh);
}

// 小桃開霰彈槍後往目標反方向退 1 格；後面擋住就不動
async function recoil(s, t) {
  if (s.raised || !s.alive) return;
  const vx = s.x - t.x, vz = s.z - t.z, L = Math.hypot(vx, vz) || 1;
  const dx = Math.round(vx / L), dz = Math.round(vz / L);
  const to = { x: s.x + dx, z: s.z + dz };
  if (!(dx || dz) || !S.map.walkable(to.x, to.z) || unitAt(to.x, to.z) || !clearMove(S.map, s, to, (x, z) => occupied(x, z, s))) return;
  const a = s.mesh.position.clone(), b = new THREE.Vector3(to.x, 0, to.z);
  await tween(0.15, k => { s.mesh.position.lerpVectors(a, b, k); s.mesh.position.y = Math.sin(k * Math.PI) * 0.15; });
  s.x = to.x;
  s.z = to.z;
  floatText(s, '後座力！', 'ow');
  UI.log(`${s.name} 被後座力推到 (${s.x},${s.z})`, 'dim');
  pickupCrate(s);
  landed(s);
  updateVisibility();
}

// ---------- 決戰：增援 ----------
async function spawnWave() {
  S.waves--;
  const spots = [];
  for (let z = 0; z < S.map.h; z++) for (let x = S.map.w - 3; x < S.map.w; x++) if (S.map.walkable(x, z) && !unitAt(x, z)) spots.push({ x, z });
  const types = ['gunman', 'zealot', 'brute', 'gunman', 'mg'];
  const n = Math.min(RULES.WAVE_SIZE, spots.length);
  for (let i = 0; i < n; i++) {
    const p = spots.splice(ri(0, spots.length - 1), 1)[0];
    spawnEnemy(types[ri(0, types.length - 1)], p.x, p.z, S.map.zoneAt(p.x, p.z), true);
  }
  UI.banner('莊園增援抵達！', 'enemy');
  UI.log(`增援 ${n} 人從右側抵達（還有 ${S.waves} 波）`, 'warn');
  updateVisibility();
  refresh();
  await wait(0.8);
}

// ================= 敵人 AI（同一套規則） =================
function evalTile(e, pos, ps) {
  let s = 0, nearest = Infinity, bestHit = 0, flank = false;
  for (const p of ps) {
    nearest = Math.min(nearest, dist(pos, p));
    if (hasLOS(S.map, pos, p)) {
      // 玩家打這格的命中率。人偶不怕被打（不會受阻、壓制），不在乎站不站在射界裡，免得在原地來回晃
      if (!e.unflinching) s -= shotOdds(S.map, p, p, pos, { weapon: weapon(p), dieBonus: e.bigTarget || 0 }).hit * 0.35;
      if (e.range && dist(pos, p) > e.range + 0.5) continue; // 射程外
      const o = shotOdds(S.map, e, pos, p, { weapon: e.gun, suppressed: !!p.suppressed, hardy: !!p.hardy, raised: !!p.raised });
      if (o.hit > bestHit) bestHit = o.hit;
      if (o.cover === 0) flank = true;
    } else if (!e.unflinching) s += 6;
  }
  s += bestHit * 0.5 + (flank ? 15 : 0);
  if (e.boss && !bestHit) s -= 40 + nearest * 3; // 頭目：躲著不動不是她的作風，沒有射擊角度就往少女靠近去找
  if (e.boss) for (const p of ps) if (hasLOS(S.map, pos, p) && coverAt(S.map, pos, p) === 0) s -= 30; // 頭目不站在被看得到又沒掩體的地方
  if (e.kind === 'zealot' || e.kind === 'doll') s -= nearest * 4; // 狂徒、人偶：越近越好
  else if (e.kind === 'sniper') { if (nearest < 5) s -= (5 - nearest) * 6; }
  else if (nearest > 8) s -= (nearest - 8) * 5;
  if (nearest < 2 && e.kind !== 'zealot' && e.kind !== 'doll') s -= 10;
  if (S.smart && !e.boss) s -= 8 * enemies().filter(o => o !== e && !o.summon && dist(o, pos) < 1.6).length; // 散開，不擠在一起被一發炸到
  return s;
}

function aiChoose(moveCount, acted) {
  const es = enemies().filter(e => e.alerted && !e.summon && !(e.cumbersome && acted.has(e)));
  if (!es.length) return null;
  // 頭目先行動：敵方主動權一開始由她出手（她不用檢定），不會被手下的「亂了陣腳」吃掉
  const boss = es.find(e => e.boss && !acted.has(e));
  // 她沒有好的射擊或移動時，只要有一步能改善位置（找角度、靠近）就走，不把回合讓給手下發呆
  if (boss) {
    const c = aiChooseFor([boss], moveCount, 0) || bossSeek(boss, moveCount);
    if (c) return c;
  }
  // 打手：能衝就衝（被壓制、受阻的交給一般 AI 起身）
  const br = es.find(e => e.brawler && !acted.has(e) && !e.pinned && !e.suppressed && rushPlan(e));
  if (br) return { type: 'rush', e: br };
  return aiChooseFor(es.filter(e => !e.brawler || e.suppressed), moveCount);
}

// 頭目看不到任何少女、又沒有更好的位置時：挑一步縮短和最近少女距離的移動（風險低的優先）。
// 不這樣做的話，靠近少女的路都有反應射擊風險，扣掉風險後「不動」永遠最划算，她就一直發呆
function bossSeek(e, moveCount) {
  if (e.suppressed || e.pinned || (moveCount.get(e) || 0) >= 2 || visibleTargets(e).length) return null;
  const ps = players();
  if (!ps.length) return null;
  const near = p => Math.min(...ps.map(g => dist(g, p)));
  const now = near(e);
  let best = null;
  for (const mv of moveOptions(e).values()) {
    const d = near(mv);
    if (d >= now - 0.5) continue;
    const risk = hitChance(planReactions(e, pathCells(e, mv)));
    if (risk >= RULES.BOSS_RISK_MAX) continue; // 不走進反應射擊網
    const s = (now - d) * 3 - risk * 20 + (ps.some(g => hasLOS(S.map, mv, g)) ? 6 : 0);
    if (!best || s > best.s) best = { s, mv };
  }
  return best ? { type: 'move', e, dest: best.mv, gain: best.s } : null;
}

// 射擊目標的優先度：命中率，聰明的敵人再加上「先打千夏、最後開槍的人」（反狙擊：狙擊手更執著）
function prio(e, o) {
  let s = o.odds.hit;
  if (S.smart || (e.kind === 'sniper' && Camp.mod('countersnipe'))) {
    const u = o.unit;
    if (u.girl === 'chinatsu') s += e.kind === 'sniper' ? 25 : 15;
    if (u === S.lastShooter) s += 10;
  }
  return s;
}

// minGain：移動至少要改善多少才走
function aiChooseFor(es, moveCount, minGain = RULES.AI_MOVE_GAIN) {
  const sc = es.find(e => canLaunch(e));
  if (sc) return { type: 'launch', e: sc };

  let shot = null;
  for (const e of es) {
    if (e.firedOut || e.noGun || bossCapped(e)) continue;
    const t = visibleTargets(e).filter(o => bossMayShoot(e, o.unit)).sort((a, b) => prio(e, b) - prio(e, a))[0];
    if (t && (!shot || prio(e, t) > prio(shot.e, shot))) shot = { e, t: t.unit, odds: t.odds, unit: t.unit };
  }
  if (shot && shot.odds.hit >= RULES.AI_SHOOT) return { type: 'shoot', ...shot };

  const ps = players();
  let move = null;
  for (const e of es) {
    if (e.pinned || e.suppressed || (moveCount.get(e) || 0) >= 2) continue;
    const cur = evalTile(e, e, ps);
    for (const mv of moveOptions(e).values()) {
      if (dist(e, mv) > 9) continue;
      const risk = hitChance(planReactions(e, pathCells(e, mv)));
      const smart = S.smart && !e.unflinching;
      if (e.boss && risk >= RULES.BOSS_RISK_MAX) continue; // 頭目不走進反應射擊網
      if (smart && !e.boss && risk >= RULES.SMART_RISK_MAX) continue;
      const gain = evalTile(e, mv, ps) - risk * (smart || e.boss ? RULES.AI_RISK_SMART : RULES.AI_RISK) - cur;
      if (!move || gain > move.gain) move = { type: 'move', e, dest: mv, gain };
    }
  }
  if (move && move.gain > minGain) return move;
  // 被壓制的先起身——但放在好的射擊和移動之後：不然留一隻被壓制的雜兵，它每次先啟動、亂了陣腳，整個敵方主動權就被它拖掉
  const sup = es.find(e => e.suppressed);
  if (sup) return { type: 'rally', e: sup };
  if (shot && shot.odds.hit >= RULES.AI_GAMBLE) return { type: 'shoot', ...shot };
  // 受阻的敵人沒有好槍可開：起身，下次才能移動
  const pinned = es.find(e => e.pinned && (moveCount.get(e) || 0) < 2);
  if (pinned) { moveCount.set(pinned, 9); return { type: 'rally', e: pinned }; }
  return null;
}

async function stallWave() {
  const ps = players();
  if (!ps.length) return;
  const anchor = enemies().find(e => e.boss) || enemies()[0] || { x: S.map.w - 1, z: Math.floor(S.map.h / 2) };
  const floor = [];
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) if (S.map.walkable(x, z) && !unitAt(x, z) && !iceAt(x, z)) floor.push({ x, z });
  const spots = reinforceSpots(anchor, ps, floor, { kinds: ['gunman', 'gunman'], where: 'ambush' });
  const got = spots.map(p => spawnEnemy('gunman', p.x, p.z, S.map.zoneAt(p.x, p.z), true));
  if (!got.length) return;
  UI.banner('敵方等得不耐煩了！', 'enemy');
  UI.log(`雙方僵持不下：增援 ${got.map(e => `${e.name}(${e.x},${e.z})`).join('、')} 從看不到的地方包抄過來`, 'warn');
  updateVisibility();
  refresh();
  await wait(0.5);
}

// 回傳 true = 因行動失敗而交出主動權
async function enemyInitiative() {
  const moveCount = new Map();
  const acted = new Set();
  let failed = false;
  for (let i = 0; i < RULES.AI_MAX_ACTIONS && !S.gameOver; i++) {
    const act = aiChoose(moveCount, acted);
    if (!act) break;
    const chance = actChance(act.e);
    if (Math.random() * 100 >= chance) {
      // 啟動失敗＝亂了陣腳：敵方的指揮斷了，主動權交回我方，沒行動的敵人（包括這一個）各自憑衝動行事
      if (act.e.mesh.visible) { focusUnit(act.e); floatText(act.e, '亂了陣腳', 'miss'); }
      UI.log(`${act.e.name} 亂了陣腳（啟動 ${chance}% 失敗）：敵方的指揮斷了，沒行動的敵人各自憑衝動行事`, 'good');
      Rec.count('hesitate');
      await wait(0.5);
      failed = true;
      break;
    }
    acted.add(act.e);
    let ok = true;
    if (act.type === 'rally') {
      rally(act.e);
      await wait(0.3);
      ok = !(await exposeReact(act.e));
      Rec.rally('enemy', ok);
    } else if (act.type === 'shoot') {
      focusOn((act.e.x + act.t.x) / 2, (act.e.z + act.t.z) / 2);
      await wait(0.35);
      countBossShot(act.e, act.t);
      ok = await shoot(act.e, act.t);
    } else if (act.type === 'launch') {
      if (act.e.mesh.visible) { focusUnit(act.e); await wait(0.3); }
      ok = launchCrows(act.e);
    } else if (act.type === 'rush') {
      ok = await rush(act.e);
    } else {
      moveCount.set(act.e, (moveCount.get(act.e) || 0) + 1);
      if (act.e.mesh.visible) { focusUnit(act.e); await wait(0.3); }
      ok = await performMove(act.e, act.dest);
    }
    Rec.enemyAct({ rally: '起身', shoot: '射擊', launch: '放烏鴉', rush: '衝鋒' }[act.type] || '移動', ok);
    for (const e of enemies()) e.shield = false;
    refresh();
    if (checkEnd()) return true;
    if (S.grab) { S.grab = false; UI.banner('心線：敵方主動權被打斷', 'player'); return true; }
    if (!ok) { failed = true; break; }
  }
  // 主動權即將易手（亂了陣腳、行動失敗或放棄）：這輪沒行動的敵人執行衝動，衝動不做啟動檢定。
  // 放棄（沒有想做的事）時，沒有衝動的敵人也會對最好的目標開一槍，不讓我方的失手白白沒有代價
  const passed = !failed && !S.gameOver && enemies().some(e => e.alerted);
  if (passed) UI.log('敵方放棄主動權，沒行動的敵人結算衝動', 'dim');
  // 僵局：敵方連續 2 次一個行動都沒做就放棄 → 等得不耐煩，2 名增援從少女看不到的地方包抄（每張地圖最多 3 次）
  S.idlePasses = passed && !acted.size ? (S.idlePasses || 0) + 1 : 0;
  if (S.idlePasses >= 2 && (S.stallWaves || 0) < 3) { S.idlePasses = 0; S.stallWaves = (S.stallWaves || 0) + 1; await stallWave(); }
  const grabbed = await impulses(acted, passed);
  if (!grabbed && !S.gameOver) await familiarPhase(); // 使魔群飛：被攔下的不影響後面的
  return failed;
}

// ================= 使魔 =================
// 飛行路線：飛得過半掩體，全掩體（含冰塊）擋住
function flyClear(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, steps = Math.ceil(Math.hypot(dx, dz) * 4);
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(a.x + dx * i / steps), z = Math.round(a.z + dz * i / steps);
    if (!S.map.inB(x, z) || S.map.get(x, z) === T.FULL) return false;
  }
  return true;
}
function flyOptions(e, range = RULES.IMP_MOVE) {
  const out = [], r = Math.ceil(range);
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: e.x + dx, z: e.z + dz };
    if ((!dx && !dz) || Math.hypot(dx, dz) > range + 0.01) continue;
    if (!S.map.walkable(c.x, c.z) || occupied(c.x, c.z, e) || iceAt(c.x, c.z)) continue;
    if (flyClear(e, c)) out.push(c);
  }
  return out;
}
// 飛過去：途中照樣吃反應射擊。回傳 false＝被打掉了
async function flyMove(e, dest) {
  const start = { x: e.x, z: e.z };
  const cells = lineCells(e, dest);
  const plan = planReactions(e, cells);
  const len = dist(start, dest);
  const fast = !e.mesh.visible;
  e.mesh.rotation.y = Math.atan2(dest.x - start.x, dest.z - start.z);
  let curT = 0;
  const posAt = t => new THREE.Vector3(start.x + (dest.x - start.x) * t, 0, start.z + (dest.z - start.z) * t);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const a = posAt(curT), b = posAt(c.t);
    await tween(Math.max(0.02, (c.t - curT) * len * (fast ? 0.02 : 0.07)), k => e.mesh.position.lerpVectors(a, b, k));
    curT = c.t;
    if (S.map.walkable(c.x, c.z)) { e.x = c.x; e.z = c.z; } // 飛越半掩體上方時不算停在那裡
    updateVisibility();
    if (await reactAt(e, plan, i)) return false;
    if (!e.alive) return false;
  }
  e.x = dest.x;
  e.z = dest.z;
  e.mesh.position.set(dest.x, 0, dest.z);
  updateVisibility();
  return e.alive;
}
async function impPatrol(e) {
  if (Math.random() < 0.5) return;
  const opts = flyOptions(e, 3).filter(c => S.map.zoneAt(c.x, c.z) === e.zone);
  if (!opts.length) return;
  await flyMove(e, opts[ri(0, opts.length - 1)]);
  detect();
}
// 敵方主動權最後：使魔一起飛向少女，離得最遠的先飛（讓牠們盡量同時抵達）
async function familiarPhase() {
  const nearD = e => { const ps = players(); return ps.length ? Math.min(...ps.map(p => dist(e, p))) : 99; };
  const near = pathDistToGirls(null, true); // 實際飛行距離（會繞過全掩體）
  const fam = enemies().filter(e => e.familiar).sort((a, b) => near(b) - near(a) || nearD(b) - nearD(a));
  let told = false;
  for (const e of fam) {
    if (S.gameOver) return;
    if (!e.alive) continue;
    if (!e.alerted) { await impPatrol(e); continue; }
    const ps = players();
    if (!ps.length) return;
    const adj = ps.filter(p => dist(e, p) < 1.5).sort((a, b) => dist(e, a) - dist(e, b))[0];
    if (adj) { bite(e, adj); continue; }
    let best = null, bs = -Infinity;
    for (const c of flyOptions(e)) {
      const d = Math.min(...ps.map(p => dist(c, p)));
      const s = d < 1.5 ? 100 - dist(e, c) * 0.1 : -near(c);
      if (s > bs) { bs = s; best = c; }
    }
    if (!best || bs <= -near(e)) continue; // 沒有更近的地方可以飛
    if (!told && e.mesh.visible) { told = true; UI.log('使魔成群飛過來了！', 'warn'); }
    if (!(await flyMove(e, best))) continue;
    const t = players().filter(p => dist(e, p) < 1.5).sort((a, b) => dist(e, a) - dist(e, b))[0];
    if (t) bite(e, t);
  }
  refresh();
}
// 咬住：這隻使魔併進少女身上的使魔團
function biteCluster(p, n) {
  const c = spawnEnemy('bites', p.x, p.z, S.map.zoneAt(p.x, p.z), true);
  c.attached = p;
  c.hp = n;
  c.maxHp = n;
  p.bitten = c;
  updateBirds(c);
  if (c.label) UI.updateLabel(c.label, c);
  return c;
}
function bite(e, p) {
  e.alive = false;
  e.absorbed = true;
  if (e.label) { e.label.remove(); e.label = null; }
  unitGroup.remove(e.mesh);
  const c = p.bitten && p.bitten.alive ? p.bitten : null;
  if (c) { c.hp++; c.maxHp = Math.max(c.maxHp, c.hp); updateBirds(c); if (c.label) UI.updateLabel(c.label, c); }
  else biteCluster(p, 1);
  floatText(p, '被使魔咬住！', 'dmg');
  UI.log(`${p.name} 被使魔咬住了（${p.bitten.hp} 隻）：敵方交出主動權時可能咬傷她，隊友朝她開槍可以打掉`, 'bad');
  if (p.label) UI.updateLabel(p.label, p);
  syncBites();
}
function syncBites() {
  if (!S.units) return;
  for (const c of S.units) if (c.alive && c.biteCluster && c.attached) { c.x = c.attached.x; c.z = c.attached.z; }
}
// 掙脫：使魔落在她身邊的空格（由近到遠找），沒地方落的繼續咬著
function releaseBites(p, why = '') {
  const c = p.bitten;
  p.bitten = null;
  if (p.label) UI.updateLabel(p.label, p);
  if (!c || !c.alive) return;
  const n = c.hp;
  c.alive = false;
  if (c.label) { c.label.remove(); c.label = null; }
  unitGroup.remove(c.mesh);
  const spots = freeAround(p, n);
  const got = spots.map(s => spawnEnemy('imp', s.x, s.z, S.map.zoneAt(s.x, s.z), true));
  if (got.length < n && p.alive) biteCluster(p, n - got.length);
  UI.log(`${why}${got.length} 隻使魔掙脫，落在 ${p.name} 身邊${got.length < n ? `（${n - got.length} 隻沒地方落，還咬著）` : ''}`, 'warn');
  updateVisibility();
  refresh();
}
// p 周圍由近到遠的 n 個空格（3 圈內）
function freeAround(p, n) {
  const spots = [];
  for (let r = 1; r <= 3 && spots.length < n; r++) {
    const ring = [];
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = p.x + dx, z = p.z + dz;
      if (S.map.walkable(x, z) && !unitAt(x, z) && !iceAt(x, z)) ring.push({ x, z, s: Math.random() });
    }
    ring.sort((a, b) => a.s - b.s);
    spots.push(...ring.slice(0, n - spots.length));
  }
  return spots;
}

// ================= 打手 =================
// 到最近少女的「實際路徑」距離（繞牆；斜走不能切牆角）。其他敵人站的格子走得過但代價高，能繞就繞開
// fly：使魔飛行（半掩體飛得過、全掩體擋住、不怕撞到人）
// 打手（不是 fly）：被 2 名以上少女盯著的格子多算 3，會繞開交叉火網
let watchCache = { key: '', w: null };
function watchMap() {
  const ps = players(), W = S.map.w, H = S.map.h;
  const key = S.map.w + ':' + ps.map(p => p.x + ',' + p.z).join(';');
  if (watchCache.key === key) return watchCache.w;
  const w = new Uint8Array(W * H);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (!S.map.walkable(x, z)) continue;
    const c = { x, z };
    for (const p of ps) if (sees(p, c)) w[z * W + x]++;
  }
  watchCache = { key, w };
  return w;
}
function pathDistToGirls(self = null, fly = false) {
  const W = S.map.w, H = S.map.h, D = new Float32Array(W * H).fill(Infinity);
  const pass = fly ? (x, z) => S.map.inB(x, z) && S.map.get(x, z) !== T.FULL : (x, z) => S.map.walkable(x, z);
  const watch = fly ? null : watchMap();
  const q = [];
  for (const p of players()) { D[p.z * W + p.x] = 0; q.push(p.z * W + p.x); }
  // 簡單的 Dijkstra（格子不多，用排序佇列就夠）
  while (q.length) {
    let bi = 0;
    for (let i = 1; i < q.length; i++) if (D[q[i]] < D[q[bi]]) bi = i;
    const c = q[bi]; q[bi] = q[q.length - 1]; q.pop();
    const cx = c % W, cz = (c - cx) / W;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (!pass(nx, nz)) continue;
      if (dx && dz && (!pass(cx + dx, cz) || !pass(cx, cz + dz))) continue;
      const nd = D[c] + (dx && dz ? 1.414 : 1)
        + (!fly && occupied(nx, nz, self) && !players().some(p => p.x === nx && p.z === nz) ? 8 : 0)
        + (watch && watch[nz * W + nx] >= 2 ? 3 : 0);
      if (nd < D[nz * W + nx]) { D[nz * W + nx] = nd; q.push(nz * W + nx); }
    }
  }
  return p => D[p.z * W + p.x];
}
// 下一段衝鋒的落點：能碰到少女就選最近的貼身格；否則選「實際路徑」離少女最近、而且至少近 1 格的地方。沒有就 null
function rushStep(e) {
  const ps = players();
  if (!ps.length) return null;
  const near = pathDistToGirls(e);
  const cur = near(e);
  let best = null, bs = Infinity;
  for (const m of moveOptions(e).values()) {
    const d = ps.some(p => dist(m, p) < 1.5) ? 0 : near(m);
    const s = !d ? -100 + dist(e, m) * 0.01 : d;
    if (s < bs) { bs = s; best = m; }
  }
  if (!best || (bs >= 0 && bs > cur - 1)) return null;
  return best;
}
const rushPlan = e => e.alive && e.alerted && !e.meleeDone && (players().some(p => dist(e, p) < 1.5) || !!rushStep(e));
// 衝鋒：一段一段直線衝，沒被攔下就繼續；碰到少女揮一拳（每個主動權一次）。回傳 false＝被反應射擊攔下
async function rush(e) {
  for (let seg = 0; seg < 30 && e.alive && !S.gameOver; seg++) {
    const ps = players();
    if (!ps.length) return true;
    const adj = ps.filter(p => dist(e, p) < 1.5).sort((a, b) => dist(e, a) - dist(e, b))[0];
    if (adj) { if (!e.meleeDone) await brawlerHit(e, adj); return true; }
    const dest = rushStep(e);
    if (!dest) return true;
    if (!seg && e.mesh.visible) { focusUnit(e); UI.log(`${e.name} 衝過來了！`, 'warn'); await wait(0.2); }
    if (!(await performMove(e, dest))) return false;
  }
  return true;
}
async function brawlerHit(e, p) {
  e.meleeDone = true;
  e.mesh.visible = true;
  e.mesh.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
  const a = e.mesh.position.clone(), b = new THREE.Vector3((e.x + p.x) / 2, 0, (e.z + p.z) / 2);
  anim(e, 'shoot', { fade: 0.05, t: 0.25 });      // 打手的 shoot 是揮球棒
  await tween(0.12, k => e.mesh.position.lerpVectors(a, b, k));
  await tween(0.12, k => e.mesh.position.lerpVectors(b, a, k));
  if (rigOf(e)) await wait(0.25);
  anim(e, 'idle');
  floatText(p, '重擊！', 'dmg');
  UI.log(`${e.name} 衝到 ${p.name} 身邊揮出一棍：必中，直接受傷 1 次`, 'bad');
  await strike(p, 1, e, true);
  refresh();
}

// ================= 使魔巢穴、空投增援 =================
async function nestTick() {
  const nests = enemies().filter(e => e.nest);
  if (!nests.length) return; // 一開始就在孵；警報響前孵出的使魔先在責任區巡邏
  const alarm = enemies().some(e => e.alerted && !e.nest);
  for (const n of nests) {
    n.count = (n.count || 0) + 1;
    if (n.count % RULES.NEST_EVERY) continue;
    hatch(n, alarm);
  }
  updateVisibility();
  refresh();
}
function hatch(n, alerted) {
  const got = freeAround(n, RULES.NEST_SPAWN).map(c => spawnEnemy('imp', c.x, c.z, n.zone, alerted));
  if (!got.length) return;
  if (n.mesh.visible) floatText(n, '孵出使魔', 'ow');
  UI.log(`${n.name} 孵出了 ${got.length} 隻使魔`, 'warn');
  updateVisibility();
}
// 敵方主動權結束時：輪到就標出下一次空投的落點（離最近的少女 3～5 格、少女看得到的空地）
function airdropPlan() {
  const A = S.airdrop;
  if (!A || A.mark || !enemies().some(e => e.alerted)) return;
  if (++A.count % RULES.AIRDROP_EVERY) return;
  const ps = players();
  if (!ps.length) return;
  const c = [];
  for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
    const p = { x, z };
    if (!S.map.walkable(x, z) || unitAt(x, z) || iceAt(x, z)) continue;
    const d = Math.min(...ps.map(q => dist(p, q)));
    if (d < 3 || d > 5 || !ps.some(q => hasLOS(S.map, q, p))) continue;
    c.push(p);
  }
  if (!c.length) return;
  const p = c[ri(0, c.length - 1)];
  A.mark = p;
  const m = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 24), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(p.x, 0.05, p.z);
  unitGroup.add(m);
  A.mesh = m;
  UI.log(`⚠ 空投增援：下次敵方主動權開始時，使魔會落在 (${p.x},${p.z})（紅圈）`, 'warn');
}
async function airdropLand() {
  const A = S.airdrop;
  if (!A || !A.mark) return;
  const p = A.mark;
  A.mark = null;
  if (A.mesh) { unitGroup.remove(A.mesh); A.mesh.geometry.dispose(); A.mesh = null; }
  const cells = [...(unitAt(p.x, p.z) ? [] : [p]), ...freeAround(p, RULES.AIRDROP_SIZE + 1)];
  const got = [];
  if (S.lvl >= 10 && cells.length) { const c = cells.shift(); got.push(spawnEnemy('brawler', c.x, c.z, S.map.zoneAt(c.x, c.z), true)); }
  for (const c of cells.slice(0, RULES.AIRDROP_SIZE)) got.push(spawnEnemy('imp', c.x, c.z, S.map.zoneAt(c.x, c.z), true));
  if (!got.length) return;
  UI.banner('空投增援落地！', 'enemy');
  UI.log(`空投增援：${got.map(e => e.name).join('、')} 落在 (${p.x},${p.z}) 附近`, 'warn');
  focusOn(p.x, p.z);
  updateVisibility();
  refresh();
  await wait(0.5);
}

// 敵方交出主動權時：咬著的使魔每隻丟一顆骰，任何一顆中＝受傷 1 次，然後全部掙脫
async function biteCheck() {
  for (const p of players()) {
    const c = p.bitten;
    if (!c || !c.alive || S.gameOver) continue;
    let hits = 0;
    for (let i = 0; i < c.hp; i++) if (Math.random() * 100 < RULES.BITE_CHANCE) hits++;
    if (!hits) { UI.log(`咬著 ${p.name} 的 ${c.hp} 隻使魔這次沒咬傷她`, 'dim'); continue; }
    focusUnit(p);
    floatText(p, '咬傷！', 'dmg');
    UI.log(`使魔咬傷了 ${p.name}！（${c.hp} 隻裡 ${hits} 隻咬中）`, 'bad');
    await strike(p, 1, null, true);
    if (p.alive) releaseBites(p, '咬傷後，');
    if (checkEnd()) return;
  }
  refresh();
}
// 偵查：看得到 at 這一格的使魔（咬著人的不算，每個主動權每隻一次）
function scouters(at) {
  return enemies().filter(e => e.familiar && !e.scouted && (e.alerted ? hasLOS(S.map, e, at) : quietSees(e, at)));
}
const scoutOdds = n => Math.round((1 - Math.pow(1 - RULES.SCOUT_CHANCE / 100, n)) * 100);
// 少女的行動成功結算完：看得到她的使魔丟骰，中了就搶走主動權（不算失敗）
async function scoutCheck(p) {
  if (!p || !p.alive || p.team !== 'player' || S.gameOver) return false;
  const es = scouters(p);
  if (!es.length) return false;
  let who = null;
  for (const e of es) { e.scouted = true; if (!who && Math.random() * 100 < RULES.SCOUT_CHANCE) who = e; }
  if (!who) { UI.log(`${es.length} 隻使魔盯著 ${p.name}，這次沒被偵查到`, 'dim'); return false; }
  who.mesh.visible = true;
  floatText(who, '偵查！', 'crit');
  UI.banner('被使魔偵查到了！', 'enemy');
  UI.log(`${who.name} 偵查到 ${p.name} 的行動：主動權被敵方搶走（不算行動失敗）`, 'warn');
  alertEnemies(enemies().filter(e => e.zone === who.zone), 'scout');
  await wait(0.5);
  giveInitiative('enemy');
  return true;
}

const edgeDist = p => Math.min(p.x, p.z, S.map.w - 1 - p.x, S.map.h - 1 - p.z);

async function impulses(acted, passed = false) {
  const officerAlive = enemies().some(e => e.officer);
  for (const e of enemies()) {
    if (S.gameOver) return;
    if (S.grab) { S.grab = false; UI.banner('心線：敵方主動權被打斷', 'player'); return true; }
    if (!e.alive || acted.has(e) || e.suppressed) continue;
    if (e.familiar || e.biteCluster || e.nest) continue; // 使魔另外群飛；巢穴自己孵
    if (e.pinned && (e.impulse === 'charge' || e.impulse === 'flee' || e.impulse === 'rush')) continue; // 受阻不能移動
    if (!e.alerted) { await patrol(e); }
    else if (e.impulse === 'shoot') {
      const t = bossCapped(e) ? null : visibleTargets(e).find(o => bossMayShoot(e, o.unit));
      if (!t || e.firedOut) continue;
      impulseNote(e, '開槍');
      countBossShot(e, t.unit);
      await shoot(e, t.unit);
    } else if (e.impulse === 'charge') {
      const ps = players();
      if (!ps.length) return;
      const near = p => Math.min(...ps.map(q => dist(p, q)));
      const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 3 &&
        !(e.boss && hitChance(planReactions(e, pathCells(e, m))) >= RULES.BOSS_RISK_MAX)); // 頭目不衝進反應射擊網
      if (!opts.length) continue;
      const best = opts.reduce((a, b) => near(b) < near(a) ? b : a);
      if (near(best) >= near(e)) continue;
      impulseNote(e, '衝鋒');
      const moved = await performMove(e, best);
      // 狂徒：衝完在射程內就開一槍
      if (moved && e.chargeShoot && e.alive && !e.firedOut) {
        const t = visibleTargets(e).find(o => o.unit.team === 'player');
        if (t) await shoot(e, t.unit);
      }
    } else if (e.impulse === 'rush') { // 打手：衝動也是衝鋒
      if (!rushPlan(e)) continue;
      impulseNote(e, '衝鋒');
      await rush(e);
    } else if (e.impulse === 'curse') {
      const ps = players().filter(p => hasLOS(S.map, e, p));
      if (!ps.length) continue;
      const p = ps.reduce((a, b) => dist(e, b) < dist(e, a) ? b : a);
      impulseNote(e, '詛咒');
      S.curse.add(key(p.x, p.z));
      drawCurse();
      suppress(p, '詛咒！');
      UI.log(`${p.name} 腳下被下了詛咒`, 'bad');
    } else if (e.impulse === 'gas') { // 卡蜜拉：毒霧
      const ps = players().filter(p => hasLOS(S.map, e, p));
      if (!ps.length) continue;
      const crowd = p => players().filter(q => dist(q, p) < 1.5).length;
      const p = ps.reduce((a, b) => crowd(b) > crowd(a) || (crowd(b) === crowd(a) && dist(e, b) < dist(e, a)) ? b : a);
      impulseNote(e, '毒霧');
      const hit = players().filter(q => dist(q, p) < 1.5);
      for (const q of hit) suppress(q, '毒霧！');
      UI.log(`${e.name} 朝 ${p.name} 丟出毒霧：${hit.map(q => q.name).join('、')} 被壓制`, 'bad');
      const t = !e.firedOut && !bossCapped(e) ? visibleTargets(e).find(o => bossMayShoot(e, o.unit)) : null;
      if (t) { countBossShot(e, t.unit); await shoot(e, t.unit); } // 趁她們抬不起頭補一槍
    } else if (e.impulse === 'hunt') { // 艾琳娜：追最後一個開槍的少女，衝 4 格後開一槍
      const ps = players();
      if (!ps.length) return;
      const prey = S.lastShooter && S.lastShooter.alive ? S.lastShooter : ps.reduce((a, b) => dist(e, b) < dist(e, a) ? b : a);
      if (!e.pinned) {
        const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 4 &&
          hitChance(planReactions(e, pathCells(e, m))) < RULES.BOSS_RISK_MAX); // 不衝進反應射擊網
        const best = opts.length ? opts.reduce((a, b) => dist(b, prey) < dist(a, prey) ? b : a) : null;
        if (best && dist(best, prey) < dist(e, prey)) {
          impulseNote(e, `追獵 ${prey.name}`);
          await performMove(e, best);
        }
      }
      if (e.alive && !e.firedOut && !bossCapped(e) && hasLOS(S.map, e, prey) && bossMayShoot(e, prey) && prey.alive) {
        countBossShot(e, prey);
        await shoot(e, prey);
      }
    } else if (e.impulse === 'launch') {
      if (!canLaunch(e)) continue;
      impulseNote(e, '放出烏鴉');
      launchCrows(e);
    } else if (e.impulse === 'fly') {
      if (e.attached) continue;
      await flyCrows(e);
    } else if (passed && !e.impulse && !e.firedOut) {
      const t = visibleTargets(e).find(o => o.unit.team === 'player');
      if (!t || t.odds.hit < RULES.AI_GAMBLE) continue;
      impulseNote(e, '開槍（待機）');
      await shoot(e, t.unit);
    } else if (e.impulse === 'flee' && !officerAlive) {
      const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 3);
      if (!opts.length) continue;
      const best = opts.reduce((a, b) => edgeDist(b) < edgeDist(a) ? b : a);
      if (edgeDist(best) >= edgeDist(e)) continue; // 被困住了：沒有更靠近邊緣的路，不硬寫逃跑
      impulseNote(e, '逃跑');
      const ok = await performMove(e, best);
      if (ok && e.alive && edgeDist(e) === 0) flee(e);
    } else continue;
    refresh();
    if (checkEnd()) return;
  }
}

function impulseNote(e, what) {
  Rec.count('impulses');
  if (e.mesh.visible) floatText(e, `衝動：${what}`, 'ow');
  UI.log(`${e.name}（衝動）${what}`, 'dim');
}

// 未警戒：在自己的責任區內巡邏
async function patrol(e) {
  if (Math.random() < 0.5) return;
  const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 3 && S.map.zoneAt(m.x, m.z) === e.zone);
  if (!opts.length) return;
  await performMove(e, opts[ri(0, opts.length - 1)]);
}

function flee(e) {
  e.alive = false;
  e.fled = true;
  Rec.count('fled');
  e.mesh.visible = false;
  if (e.label) { e.label.remove(); e.label = null; }
  UI.log(`${e.name} 逃離了戰場`, 'good');
}

// ================= 輸入 =================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(UP, 0);

function pickTile(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
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
  const scale = camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 2 / view.h;
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
  if (S.mode === 'magic') {
    const opt = S.magicOpts && S.magicOpts.get(key(t.x, t.z));
    if (!opt) { if (occ && occ === S.selected) exitMagic(); else { S.hover = t; updateHover(); } return; }
    if (touch && pendingTap !== 'm' + key(t.x, t.z)) { pendingTap = 'm' + key(t.x, t.z); S.hover = t; updateHover(); return; }
    pendingTap = null;
    execMagic(S.selected, opt);
    return;
  }
  if (S.mode === 'target') {
    const i = S.targets.findIndex(o => o.unit === occ);
    if (i < 0) return;
    if (i === S.targetIdx) fire(); else { S.targetIdx = i; updateTargeting(); }
    return;
  }
  // 雪乃推冰塊（冰上站著隊友時也一起推）
  const ice = iceAt(t.x, t.z);
  const pi = ice && (!ice.rider || ice.rider.team === 'player') && canMove(S.selected) ? pushInfo(S.selected, ice) : null;
  if (pi) {
    if (touch && pendingTap !== 'p' + key(t.x, t.z)) { pendingTap = 'p' + key(t.x, t.z); S.hover = t; updateHover(); return; }
    pendingTap = null;
    execPush(S.selected, pi);
    return;
  }
  if (occ && occ.team === 'player') { selectUnit(occ); return; }
  if (occ && occ.team === 'enemy' && occ.mesh.visible) { enterTargetMode(occ); return; }
  const u = S.selected;
  if (!canAct(u)) return;
  if (u.suppressed || u.pinned) { UI.toast(u.suppressed ? '被壓制中，需先起身' : '受阻中，需先起身才能移動'); return; }
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
// iOS Safari 會忽略 user-scalable=no：擋掉頁面的雙指縮放與雙擊放大（按鈕另靠 CSS touch-action: manipulation）
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });

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
  if (k === 'r') actions.reload();
  if (k === 'x') actions.swap();
  if (k === 'f') actions.plant();
  if (k === 'g') actions.magic();
  if (k === 't') actions.items();
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (S.side === 'deploy') startBattle();
    else if (S.mode === 'target') fire();
  }
  if (e.key === 'Escape') { cancelTarget(); exitMagic(); }
  if (e.key === 'Backspace') { e.preventDefault(); actions.pass(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function onResize() {
  view.w = appEl.clientWidth || innerWidth;
  view.h = appEl.clientHeight || innerHeight;
  if (scrollX || scrollY) scrollTo(0, 0);
  camera.aspect = view.w / view.h;
  camera.fov = camera.aspect < 0.8 ? 62 : 42; // 直式螢幕視角放寬
  camera.updateProjectionMatrix();
  renderer.setSize(view.w, view.h);
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 300));
if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
if (window.ResizeObserver) new ResizeObserver(onResize).observe(appEl);
// 頁面不該捲動；平板上點輸入框或拉動時被捲上去，畫面就會整個往上偏
addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); });
onResize();

// ================= 標籤 / 漂浮文字 =================
const floats = [];
function floatText(u, text, cls) {
  floats.push({ d: UI.makeFloat(text, cls), pos: new THREE.Vector3(u.mesh.position.x, 1.8, u.mesh.position.z), t: 0 });
}

const tmpV = new THREE.Vector3();
function toScreen(v) {
  tmpV.copy(v).project(camera);
  return { x: (tmpV.x + 1) / 2 * view.w, y: (1 - tmpV.y) / 2 * view.h };
}

function updateLabels(dt) {
  for (const u of S.units) {
    if (!u.label) continue;
    const show = u.alive && u.mesh.visible;
    u.label.style.display = show ? '' : 'none';
    if (!show) continue;
    const p = toScreen(tmpV.set(u.mesh.position.x, 1.55 * u.mesh.scale.y + u.mesh.position.y, u.mesh.position.z));
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
  // 保險：有些平板瀏覽器網址列伸縮時不一定送 resize
  if (appEl.clientWidth !== view.w || appEl.clientHeight !== view.h || scrollY) onResize();
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
  spotMat.opacity = 0.6 + Math.sin(time * 6) * 0.3;
  if (S.objMesh && S.mission.objective.planted) {
    const on = Math.sin(time * 10) > 0;
    S.objMesh.userData.screen.emissive.setHex(on ? 0xff2020 : 0x330000);
  }

  if (S.units) for (const u of S.units) {      // 方塊人的動作、頭髮、眨眼（看不到的不算）
    const r = u.mesh && u.mesh.userData.rig;
    if (r && u.mesh.visible && u.mesh.parent) r.update(dt);
  }
  if (S.units) for (const u of S.units) {
    const imps = u.alive && u.mesh.userData.imps;
    if (!imps) continue;
    if (u.biteCluster && u.attached) { u.mesh.position.x = u.attached.mesh.position.x; u.mesh.position.z = u.attached.mesh.position.z; u.mesh.rotation.y += dt * 2.5; }
    imps.forEach((m, i) => { const f = Math.sin(time * 22 + i * 1.7) * 0.5; m.userData.wings[0].rotation.z = 0.45 + f; m.userData.wings[1].rotation.z = -0.45 - f; });
  }
  updateLabels(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const continueGame = () => { Camp.load(); enterHQ(); };
// opts：手選的名單 { girls:[id], family:[id] }，不足的隨機補
const newGame = (opts = {}) => { Camp.newStory(opts); HQ.showStory('序章', STORY.intro, '前往作戰室 ▶', () => enterHQ()); };
const newEndless = () => { Camp.newEndless(); enterHQ(); };
function boot() {
  HQ.showTitle({ onContinue: continueGame, onNew: () => HQ.showRoster(newGame), onEndless: newEndless, onScene: () => Scene.demo('all', sayHook) });
}
boot();
requestAnimationFrame(frame);
window.__game = { S, actions, camera, THREE, scene, zoneMesh, Camp, // 除錯用
  useItem,
  dbg: { pickTile, strike, melee, dash, giveInitiative, rush, rushStep, pathDistToGirls, actChance, spawnEnemy, segFloor, playerMove, moveOptions, quietSees, enemies, players, weapon, step: updateTweens, magicOptions, execMagic, pushInfo, execPush,
    startMission, enterHQ, transform, spawnWave, bossPhase, performMove, die, aiChoose, lockAfterAttack, enemyInitiative, impulses, reviveDolls } };
// 純文字介面（給代理測試用）：window.TXT
TextUI.init({ S, actions, Camp, key, coverSides, players, enemies, weapon, visibleTargets, moveOptions, playerMove, selectUnit,
  enterTargetMode, cancelTarget, fire, magicOptions, execMagic, magicInfo, canAct, startBattle, deployTo, actChance,
  planReactions, pathCells, moveRisk, reloadInfo, canTriple, canPlant, newGame, newEndless, continueGame, useItem, flashTargets, enterHQ, refreshHQ: () => HQ.refresh(), setInstant: on => { instant = on; Scene.setInstant(on); }, Scene });
