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
// - 魔法少女：四人輪替、每張地圖出 2 人；每人一個被動、一個魔法（每圖一次），兩條成長樹。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { T, RULES, THEMES, ENEMY_TYPES, WEAPONS } from './config.js';
import { generateMap, ri, GameMap } from './map.js';
import { hasLOS, quietLOS, coverSides, shotOdds, key, dist, clearMove, lineCells, vaultTargets, ORTH } from './grid.js';
import { makeUnitMesh, addHalo, heartShape } from './units.js';
import * as UI from './ui.js';
import * as Camp from './campaign.js';
import * as HQ from './hq.js';
import { GIRL, FAMILY, FAMILY_BY_ID, STORY } from './girls.js';

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

// 責任區 / 撤離點底色
const zoneMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }), 600);
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
const unitAt = (x, z) => S.units.find(u => u.alive && u.x === x && u.z === z);
const occupied = (x, z, except) => S.units.some(u => u.alive && u !== except && u.x === x && u.z === z);
const canAct = u => !!u && u.alive && u.team === 'player' && S.side === 'player' && !S.busy && !S.gameOver && S.mode === 'move';
const canMove = u => canAct(u) && !u.suppressed;
const refresh = () => UI.updateHUD(S);
const weapon = u => u.team === 'player' ? u.weapons[u.wi] : u.gun;
const lv = (u, t) => (t === 'gun' ? u.gunLv : u.magicLv) || 0;
// 射手的條件加成（成長樹、壓制加重）
function aimBonus(s) {
  let b = 0;
  if (s.girl === 'yukino' && s.raised && lv(s, 'gun') >= 2) b += 10;
  if (s.transformed && lv(s, 'gun') >= 4) b += 10;
  if (s.braced) b += 10;
  if (s.suppressed && s.heavySup) b -= 10;
  return b;
}
const oddsVs = (s, t, opts = {}) => shotOdds(S.map, s, s, t, {
  targetSuppressed: !!t.suppressed, weapon: weapon(s), aimBonus: aimBonus(s), raised: !!t.raised, hardy: !!t.hardy, ...opts });
const iceAt = (x, z) => S.ice.find(i => i.x === x && i.z === z);
const isExit = p => S.mission && S.mission.exits.some(e => e.x === p.x && e.z === p.z);
const adjObjective = u => {
  const o = S.mission && S.mission.objective;
  return !!o && Math.abs(u.x - o.x) <= 1 && Math.abs(u.z - o.z) <= 1;
};
const canPlant = u => canAct(u) && S.mission.type === 'sabotage' && !S.mission.objective.planted && adjObjective(u);

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
    if (map.isConceal(x, z)) c.lerp(new THREE.Color(th.conceal), 0.35).multiplyScalar(0.8);
    tiles.setColorAt(n, c);
    n++;
  }
  world.add(tiles);

  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const t = map.get(x, z);
    if (t === T.HALF) world.add(makeHalf(th, x, z));
    if (t === T.FULL) world.add(makeFull(th, x, z));
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
  return { ...w, id, dmg: [...w.dmg], ammo: w.mag, reserve: w.sidearm ? Infinity : w.reserve };
}

// 依槍法樹組裝武器（每張地圖都補滿）
function outfit(d, gs) {
  const ws = d.weapons.map(makeWeapon);
  const p = ws[0], g = gs.gun;
  if (d.id === 'akane') {
    if (g >= 1) p.aim += 5;
    if (g >= 2) { p.mag += 2; p.ammo = p.mag; }
    if (g >= 3) p.closeCrit = 15;
    if (g >= 4) p.noReactPenalty = true;
  } else if (d.id === 'hikari') {
    if (g >= 1) p.aim += 5;
    if (g >= 2) p.reserve += 6;
    if (g >= 3) p.crit += 10;
  } else if (d.id === 'yukino') {
    if (g >= 1) { p.mag += 3; p.ammo = p.mag; }
    if (g >= 3) p.keepFiring = true;
  } else if (d.id === 'momo') {
    if (g >= 1) p.closeBonus += 10;
    if (g >= 2) ws[1].dmg = ws[1].dmg.map(v => v + 1);
    if (g >= 4) ws[1].canReact = true;
  }
  return ws;
}

function makeGirlUnit(gs) {
  const d = GIRL[gs.id];
  return {
    girl: d.id, name: d.name, title: d.title, color: d.color, hair: d.hair, team: 'player', kind: 'girl',
    maxHp: d.maxHp, hp: gs.hp, aim: d.aim, crit: d.crit, gunLv: gs.gun, magicLv: gs.magic,
    ability: d.ability, weapons: outfit(d, gs), wi: 0,
    uses: gs.magic >= 5 && d.ability !== 'transform' ? 2 : 1,
    dodge: d.id === 'akane' ? 1 : 0, dashDodge: 0, hardy: d.id === 'momo',
    transformed: false, raised: false, braced: false,
  };
}

const memberOf = type => (FAMILY.find(m => m.boss === type) || {}).id || null;

function spawnEnemy(type, x, z, zone, alerted = false) {
  const tpl = ENEMY_TYPES[type];
  const u = { ...tpl, dmg: [...tpl.dmg], kind: type, team: 'enemy', hp: tpl.maxHp,
    gun: { aim: 0, crit: 0, dmg: tpl.dmg, canReact: tpl.canReact !== false, keepFiring: !!tpl.keepFiring,
      ignoreHalf: !!tpl.ignoreHalf, ammo: Infinity, mag: Infinity },
    x, z, alive: true, suppressed: false, firedOut: false, alerted, spotted: false, zone, member: memberOf(type),
    // 不留活口（執行人的加持）：每次主動權第一次反應射擊打空不停火
    execBuff: S.buffs.includes('exec') && !tpl.keepFiring, spareUsed: false };
  spawnUnit(u);
  return u;
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
  S.quietSight = S.buffs.includes('eye') ? 7 : RULES.QUIET_SIGHT;
  const opKey = op.kind + ':' + op.name;
  let gen;
  if (C.retry && S.genCopy && S.genOp === opKey) gen = cloneGen(S.genCopy);
  else {
    const extra = [];
    let type;
    if (op.kind === 'boss') { type = 'hunt'; extra.push([FAMILY_BY_ID[op.member].boss, 'gunman']); }
    else if (op.kind === 'finale') { type = 'hunt'; extra.push(['b_mother', 'brute']); }
    else if (op.kind === 'manor') {
      const alive = C.members.filter(m => m.alive);
      if (alive.length && Math.random() < 0.5) extra.push([FAMILY_BY_ID[alive[ri(0, alive.length - 1)].id].boss]);
    }
    gen = generateMap(Camp.level(op), { type, extra, bonus: 2 * S.buffs.filter(b => b === 'book').length });
    gen.curse = S.buffs.includes('sis') ? pickCurse(gen) : [];
    gen.theme = THEMES[ri(0, THEMES.length - 1)];
    S.genCopy = cloneGen(gen);
    S.genOp = opKey;
  }
  S.map = gen.map;
  S.mission = gen.mission;
  S.crates = gen.crates;
  S.theme = gen.theme;
  S.curse = new Set(gen.curse);
  S.waves = op.kind === 'finale' ? C.production : 0;
  S.opName = op.name;
  S.triple = false;
  S.gameOver = false;
  buildWorld();
  drawCurse();

  C.deploy.forEach((id, i) => {
    const u = makeGirlUnit(Camp.girlState(id));
    Object.assign(u, { x: gen.playerSpawns[i].x, z: gen.playerSpawns[i].z, alive: true, suppressed: false, firedOut: false });
    spawnUnit(u);
  });
  for (const p of gen.enemies) {
    const mid = memberOf(p.type);
    if (mid && C.mode === 'story' && !C.members.find(m => m.id === mid).alive) continue;
    const e = spawnEnemy(p.type, p.x, p.z, p.zone);
    if (e.boss && S.mission.type === 'hunt' && !S.mission.boss) { S.mission.boss = e; S.mission.bossName = e.name; }
  }

  const p0 = gen.playerSpawns[0];
  controls.target.set(p0.x + 3, 0, p0.z);
  const near = camera.aspect < 0.8 ? 0.62 : 1; // 直式手機：預設拉近
  camera.position.set(p0.x + 3, 14 * near, p0.z + 11 * near);
  focusOn(p0.x + 3, p0.z);

  UI.clearLog();
  UI.log(`── ${S.opName}：${S.theme.name}（敵人 ${enemies().length}）──`, 'sys');
  UI.log(UI.missionText(S.mission) + (S.mission.type === 'sabotage' ? '，再撤回左側' : ''), 'sys');
  if (S.buffs.length) UI.log('家族加持：' + [...new Set(S.buffs)].map(b => FAMILY_BY_ID[b].buff).join('、'), 'warn');
  if (S.waves) UI.log(`增援會分 ${S.waves} 波抵達`, 'warn');
  if (enemies().some(e => e.member) && S.mission.type !== 'hunt') UI.log('有家族成員在場！打倒她可以拔掉加持', 'warn');
  S.initNo = 0;
  S.deployZone = gen.deployZone;
  S.side = 'deploy';
  S.busy = false;
  updateVisibility();
  UI.banner(S.mission.type === 'hunt' ? `任務：打倒${S.mission.bossName}` : S.mission.type === 'extract' ? '任務：突破撤離' : '任務：破壞終端', 'player');
  UI.log('部署：點角色再點綠色格子擺位，按「開始行動」', 'sys');
  selectUnit(players()[0]);
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
  if (!ps.length) {
    S.gameOver = true;
    clearOverlays();
    setTimeout(() => endMission(false), 900);
    return true;
  }
  const hunt = S.mission.type === 'hunt';
  const bossDown = hunt && S.mission.boss && !S.mission.boss.alive;
  const cleared = !enemies().length && !S.waves;
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
  const girls = S.units.filter(u => u.girl);
  const hp = {};
  for (const u of girls) hp[u.girl] = u.alive ? Math.max(1, Math.min(u.hp, GIRL[u.girl].maxHp)) : 0;
  const killed = S.units.filter(u => u.member && !u.alive && !u.fled).map(u => u.member);
  const notes = Camp.finish({ win, deployed: girls.map(u => u.girl), hp, downed: girls.filter(u => !u.alive).map(u => u.girl), killed });
  const rows = girls.map(u => `<li>${u.name}：${u.alive ? `HP ${hp[u.girl]}/${GIRL[u.girl].maxHp}` : '倒下後送'}</li>`).join('');
  const body = (win ? `<p>${why}，主動權交換了 ${S.initNo - 1} 次。</p>` : '<p>上場的兩人都倒下了。這張地圖要重打。</p>') +
    `<ul>${rows}</ul>` + (notes.length ? `<ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : '') +
    (win ? '<p style="opacity:.6">彈藥會在下張地圖補滿。</p>' : '');
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
  for (const u of S.units) { u.firedOut = false; u.spareUsed = false; }
  S.initNo++;
  S.side = side;
  S.mode = 'move';
  S.magicOpts = null;
  UI.hideTargeting();
  clearOverlays();

  if (side === 'player') {
    if (S.waves > 0 && enemies().length <= 4) { S.busy = true; await spawnWave(); }
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
// actor：做這個行動的角色（光的變身只看她自己的失敗）
async function resolvePlayerAction(ok, actor = null) {
  refresh();
  if (S.waves > 0 && !enemies().length && !S.gameOver) await spawnWave();
  if (checkEnd()) return;
  if (!ok && actor && actor.alive && actor.ability === 'transform' && !actor.transformed) {
    S.busy = true;
    await transform(actor, false);
    S.busy = false;
    ok = true;
  }
  if (!ok) {
    UI.log('行動失敗，交出主動權', 'warn');
    await wait(0.5);
    giveInitiative('enemy');
    return;
  }
  selectUnit(S.selected && S.selected.alive ? S.selected : players()[0]);
}

// ================= 視野 / 警覺 =================
// 我方永遠算警戒中：用完整視線看敵人。看到敵人不會驚動他。
function updateVisibility() {
  const ps = players();
  for (const e of enemies()) {
    const vis = ps.some(p => hasLOS(S.map, p, e));
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
  for (const e of fresh) {
    e.alerted = true;
    if (e.mesh.visible) floatText(e, '！警戒', 'sup');
    if (e.label) UI.updateLabel(e.label, e);
  }
  if (why === 'spot') {
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
  alertEnemies(enemies().filter(e => zones.has(e.zone)), 'spot');
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
    if (!S.map.walkable(x, z) || n >= 600) continue;
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
  if (u.frozen) return out; // 被抬到冰塊上的敵人不能移動
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
    // 被壓制中的單位抬不起頭，不能反應射擊
    if (!r.alive || r.team === mover.team || r.firedOut || r.suppressed) continue;
    if (r.team === 'enemy' && !r.alerted) continue;
    // 我方不會對還沒察覺的敵人自動開槍（會暴露位置）
    if (r.team === 'player' && mover.team === 'enemy' && !mover.alerted) continue;
    if (knownOnly && r.team === 'enemy' && !r.mesh.visible) continue;
    const w = weapon(r);
    if (!w.canReact || w.ammo <= 0) continue;
    let best = null;
    cells.forEach((c, i) => {
      if (!hasLOS(S.map, r, c)) return;
      const o = shotOdds(S.map, r, r, c, { reaction: true, weapon: w, aimBonus: aimBonus(r), raised: !!mover.raised, hardy: !!mover.hardy });
      if (o.hit >= RULES.REACTION_MIN && (!best || o.hit > best.odds.hit)) best = { shooter: r, idx: i, odds: o };
    });
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.idx - b.idx);
}

const hitChance = plan => 1 - plan.reduce((p, r) => p * (1 - r.odds.hit / 100), 1);
// 考慮「必定落空」（朱音）的被命中機率
function moveRisk(u, plan, extra = 0) {
  let skip = (u.dodge || 0) + extra;
  return 1 - plan.reduce((p, r) => { if (skip > 0) { skip--; return p; } return p * (1 - r.odds.hit / 100); }, 1);
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
    if (hit) return true;
    if (!weapon(s).keepFiring) {
      if (s.execBuff && !s.spareUsed) {
        s.spareUsed = true;
        floatText(s, '不留活口！', 'sup');
        UI.log(`${s.name}（不留活口）打空了，但這次還能繼續開槍`, 'warn');
      } else s.firedOut = true;
    }
    if (s.label) UI.updateLabel(s.label, s);
  }
  return false;
}

// 回傳 true = 移動成功；false = 被反應射擊命中（行動失敗）
async function performMove(u, dest) {
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
    .filter(e => e.alive && e.team !== u.team && hasLOS(S.map, u, e))
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
  s.braced = false;
  if (s.team === 'player') w.ammo = Math.max(0, w.ammo - (triple ? 3 : 1)); // 反應射擊也耗彈
  s.mesh.rotation.y = Math.atan2(t.x - s.x, t.z - s.z);
  s.mesh.updateMatrixWorld(true);
  s.mesh.visible = true;

  const hit = !forceMiss && Math.random() * 100 < odds.hit;
  const crit = hit && Math.random() * 100 < odds.crit;
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

  const tag = `${s.name}${reaction ? '（反應）' : triple ? '（三管齊發）' : ''} → ${t.name}（${forceMiss ? '必定落空' : odds.hit + '%'}）`;
  if (hit) {
    let dmg = ri(w.dmg[0], w.dmg[1]);
    if (triple) dmg += ri(w.dmg[0], w.dmg[1]) + ri(w.dmg[0], w.dmg[1]);
    if (crit) dmg = Math.ceil(dmg * RULES.CRIT_MULT);
    if (t.armor) dmg = Math.max(1, dmg - t.armor);
    UI.log(`${tag} ${crit ? '暴擊' : '命中'} -${dmg}`, s.team === 'player' ? 'good' : 'bad');
    await damage(t, dmg, crit, s);
  } else {
    floatText(t, '未命中', 'miss');
    UI.log(`${tag} 未命中`, 'dim');
  }
  chipIce(s, t);
  makeNoise(s, t);
  await wait(0.35);
  if (s.alive && s.team === 'player' && w.recoil) await recoil(s, t);
  updateVisibility();
  refresh();
  return hit;
}

async function damage(t, dmg, crit, src = null) {
  t.hp -= dmg;
  floatText(t, (crit ? '暴擊 ' : '') + '-' + dmg, crit ? 'crit' : 'dmg');
  const mats = t.mesh.userData.mats;
  await tween(0.25, k => mats.forEach(m => m.emissive.setRGB((1 - k) * 0.9, 0, 0)));
  if (t.hp <= 0) {
    await die(t);
    if (src && src.girl === 'yukino' && Math.random() < 0.15) {
      floatText(src, '（背肌）', 'ow');
      UI.log(`${src.name} 默默擺出了背肌的姿勢`, 'dim');
    }
    return;
  }
  suppress(t);
  if (src && src.girl === 'yukino' && lv(src, 'gun') >= 4) t.heavySup = true;
}

function suppress(t, label = '壓制') {
  if (!t.alive || t.suppressed) return;
  t.suppressed = true;
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
  u.alive = false;
  u.hp = 0;
  u.suppressed = false;
  if (u.label) { u.label.remove(); u.label = null; }
  if (u.iceRef) { const ice = u.iceRef; ice.rider = null; u.iceRef = null; u.raised = false; u.frozen = false; S.map.set(ice.x, ice.z, T.FULL); }
  if (u.team === 'player') { u.downed = true; UI.log(`${u.name} 倒下了，緊急後送`, 'bad'); }
  else UI.log(`${u.name} 倒下了`, 'good');
  if (u.boss) UI.banner(`${u.name} 被打倒了！`, 'player');
  if (u.officer && !enemies().some(e => e.officer)) {
    UI.log('軍官陣亡！徵召兵士氣崩潰', 'good');
    UI.banner('軍官陣亡', 'player');
  }
  const m = u.mesh;
  await tween(0.5, k => {
    m.rotation.x = -k * Math.PI / 2;
    m.position.y = 0.12 * k;
  });
  m.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0.55; } });
}

function rally(u) {
  u.suppressed = false;
  u.heavySup = false;
  setSuppressedPose(u, false);
  floatText(u, '解除壓制', 'ow');
  UI.log(`${u.name} 解除壓制`, 'dim');
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
  const rows = plan.map(r => `${r.shooter.name} ${skip-- > 0 ? '<b>必定落空</b>' : r.odds.hit + '%'}`).join('<br>');
  return `<br><span class="warn">⚠ 反應射擊</span><br>${rows}<br>被命中機率 <b>${Math.round(moveRisk(u, plan, extra) * 100)}%</b>`;
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
    const info = `<div class="desc">${occ.alerted ? '警戒中' : '未察覺：只看黃色責任區'}${occ.raised ? '・在冰塊上（不能移動）' : ''}${occ.desc ? '<br>' + occ.desc : ''}${occ.execBuff ? `<br><span class="warn">不留活口：這次主動權第一次反應打空不停火${occ.spareUsed ? '（已用掉）' : ''}</span>` : ''}</div>`;
    if (!canAct(u)) showTip(`<b>${occ.name}</b>${info}`);
    else if (u.firedOut) showTip(`<b>${occ.name}</b><br><small>此單位這次主動權不能再開槍</small>${info}`);
    else if (weapon(u).ammo <= 0) showTip(`<b>${occ.name}</b><br><small>彈匣空了</small>${info}`);
    else if (hasLOS(S.map, u, occ)) {
      const o = oddsVs(u, occ);
      showTip(`<b>${occ.name}</b> 命中 <b>${o.hit}%</b><br><small>${UI.coverName(o)}${occ.suppressed ? ' · 壓制中' : ''} · 點敵人瞄準</small>${info}`);
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
  showTip(`<b>${head}</b>${spotRow(spot)}${riskRows(u, plan)}`);
}

function magicHover(u, t) {
  const opt = S.magicOpts && S.magicOpts.get(key(t.x, t.z));
  if (!opt) { showTip('<small>橘色格子才能用・再按魔法鍵或 Esc 取消</small>'); return; }
  const m = lv(u, 'magic');
  if (opt.kind === 'dash') {
    const cells = pathCells(u, opt.mv);
    const { plan, spot } = drawPreview(u, cells, [u, t], 0xffa04f);
    const tg = enemies().filter(e => dist(e, opt) < 1.5).sort((a, b) => a.hp - b.hp)[0];
    showTip(`<b>突進 → 近戰 ${tg ? tg.name : ''}</b>${confirmHint()}<br><small>近戰 ${RULES.MELEE_DMG} 傷、必中、不發出槍聲</small>${spotRow(spot)}${riskRows(u, plan, m >= 4 ? 1 : 0)}`);
  } else if (opt.kind === 'ice') {
    const r = opt.rider;
    const sub = r ? (r.team === 'enemy' ? '被抬起的敵人不能移動、算半掩體' : '站在冰塊上算半掩體') : `全掩體・擋視線・耐久 ${m >= 1 ? 5 : RULES.ICE_HP}`;
    showTip(`<b>${r ? `把 ${r.name} 抬到冰塊上` : '放置冰塊'}</b>${confirmHint()}<br><small>${sub}</small>`);
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
  UI.showTargeting(S.targets, S.targetIdx, canTriple(u) ? S.triple : null);
}

function cancelTarget() {
  if (S.mode !== 'target') return;
  S.mode = 'move';
  selectUnit(S.selected);
}

const canTriple = u => !!u && u.girl === 'momo' && lv(u, 'gun') >= 5 && weapon(u).id === 'tri' && weapon(u).ammo >= 3;

// 朱音雙槍齊射 / 雪乃掃射的第二個目標
function secondTarget(u, prim) {
  if (u.girl === 'akane' && lv(u, 'gun') >= 5) return visibleTargets(u).map(o => o.unit).find(e => e !== prim) || null;
  if (u.girl === 'yukino' && lv(u, 'gun') >= 5 && u.wi === 0) {
    return enemies().find(e => e !== prim && e.mesh.visible && dist(e, prim) < 1.5 && hasLOS(S.map, u, e)) || null;
  }
  return null;
}

async function fire() {
  if (S.mode !== 'target' || S.busy) return;
  const t = S.targets[S.targetIdx];
  const u = S.selected;
  const triple = S.triple && canTriple(u);
  S.mode = 'move';
  UI.hideTargeting();
  tgtRing.visible = false;
  S.busy = true;
  const second = secondTarget(u, t.unit);
  let hit = await shoot(u, t.unit, { triple });
  if (second && second.alive && u.alive && weapon(u).ammo > 0) {
    UI.log(u.girl === 'akane' ? `${u.name} 雙槍齊射！` : `${u.name} 掃射！`, 'dim');
    hit = (await shoot(u, second)) || hit;
  }
  S.busy = false;
  await resolvePlayerAction(hit, u);
}

const actions = {
  shoot() { if (S.mode === 'target') fire(); else enterTargetMode(); },
  async rally() {
    const u = S.selected;
    if (!canAct(u) || !u.suppressed) return;
    rally(u);
    await resolvePlayerAction(true);
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
    if (!info.gives) { UI.log(`${u.name} ${w.name}換彈（不交出主動權）`, 'dim'); await resolvePlayerAction(true); return; }
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
    swapGunMesh(u);
    floatText(u, `換${nw.short}`, 'ow');
    if (!gives) { UI.log(`${u.name} 拔出${nw.name}`, 'dim'); await resolvePlayerAction(true); return; }
    await endWithHandover(`${u.name} 換回${nw.name}，交出主動權`);
  },
  async plant() {
    const u = S.selected;
    if (!canPlant(u)) return;
    S.mission.objective.planted = true;
    floatText(u, '炸藥安裝完成', 'ow');
    UI.log(`${u.name} 在終端安裝了炸藥，撤回左側！`, 'good');
    UI.banner('炸藥已安裝', 'player');
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
  const name = { dash: '突進', ice: '冰塊', airdrop: '空投' }[u.ability];
  let usable = u.uses > 0, why = u.uses > 0 ? '' : '這張地圖已經用完了';
  if (usable && u.ability !== 'ice' && u.suppressed) { usable = false; why = '被壓制中，先解除壓制'; }
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
    for (let z = 0; z < S.map.h; z++) for (let x = 0; x < S.map.w; x++) {
      if (!S.map.walkable(x, z) || unitAt(x, z)) continue;
      out.set(key(x, z), { kind: 'airdrop', x, z });
    }
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
  UI.toast({ dash: '選擇突進終點（橘色格子）', ice: '選擇放冰塊的位置（可以放在隊友腳下）', airdrop: '選擇落點（橘色格子）' }[u.ability], 2200);
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
  let ok = true;
  if (opt.kind === 'dash') ok = await dash(u, opt);
  else if (opt.kind === 'ice') { placeIce(opt.x, opt.z, opt.rider, u); await wait(0.4); }
  else if (opt.kind === 'airdrop') ok = await airdrop(u, opt);
  S.busy = false;
  await resolvePlayerAction(ok, u);
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
  const adj = enemies().filter(e => dist(e, u) < 1.5).sort((a, b) => a.hp - b.hp);
  if (adj.length) await melee(u, adj[0]);
  return true;
}

async function melee(u, t) {
  u.mesh.rotation.y = Math.atan2(t.x - u.x, t.z - u.z);
  const p0 = u.mesh.position.clone(), p1 = p0.clone().lerp(new THREE.Vector3(t.x, p0.y, t.z), 0.4);
  await tween(0.1, k => u.mesh.position.lerpVectors(p0, p1, k));
  floatText(u, '近戰！', 'ow');
  await tween(0.12, k => u.mesh.position.lerpVectors(p1, p0, k));
  if (!t.alerted) alertEnemies([t], 'melee'); // 只驚動被打的那個：近戰不發出槍聲
  const dmg = t.armor ? Math.max(1, RULES.MELEE_DMG - t.armor) : RULES.MELEE_DMG;
  UI.log(`${u.name} 近戰 → ${t.name} -${dmg}`, 'good');
  await damage(t, dmg, false, u);
  const m = lv(u, 'magic');
  if (t.alive && m >= 1) {
    await knockback(t, Math.sign(t.x - u.x), Math.sign(t.z - u.z), m >= 2 ? 2 : 1, { collide: m >= 2, splash: m >= 3 });
  }
}

// 擊退：一格一格推，撞到牆或單位就停
async function knockback(t, dx, dz, n, { collide = false, splash = false } = {}) {
  if (t.raised || !(dx || dz)) return;
  let moved = false;
  for (let i = 0; i < n && t.alive; i++) {
    const to = { x: t.x + dx, z: t.z + dz };
    const occ = unitAt(to.x, to.z);
    const free = S.map.walkable(to.x, to.z) && !occ && clearMove(S.map, t, to, (x, z) => occupied(x, z, t));
    if (!free) {
      if (collide) {
        floatText(t, '撞！', 'crit');
        UI.log(`${t.name} 被撞上${occ ? occ.name : '障礙物'}`, 'good');
        await damage(t, 1, false);
        if (occ && occ.alive) await damage(occ, 1, false);
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
  const bonus = m >= 2 ? 3 : 2;
  u.maxHp += bonus;
  u.hp += bonus;
  UI.banner(`${u.name} 變身！`, 'player');
  UI.log(manual ? `${u.name} 主動變身！` : `${u.name} 的行動失敗了……可是她變身了！敵人沒能拿到主動權`, 'good');
  addHalo(u.mesh);
  const base = u.mesh.scale.clone();
  await tween(0.5, k => u.mesh.scale.copy(base).multiplyScalar(1 + Math.sin(k * Math.PI) * 0.25));
  floatText(u, `變身！ +${bonus} HP`, 'crit');
  if (m >= 1 && u.suppressed) rally(u);
  if (m >= 3) for (const e of enemies()) if (dist(e, u) <= 3) suppress(e, '閃光！');
  if (m >= 4) for (const p of players()) if (p !== u && p.suppressed) rally(p);
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
  if (m >= 4) {
    ally = players().find(p => p !== u && dist(p, u) < 1.5 && !p.suppressed) || null;
    if (ally) {
      const spots = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = opt.x + dx, z = opt.z + dz;
        if ((dx || dz) && S.map.walkable(x, z) && !unitAt(x, z)) spots.push({ x, z });
      }
      allyTo = spots.sort((a, b) => dist(a, from) - dist(b, from))[0] || null;
      if (!allyTo) ally = null;
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
  if (lv(s, 'gun') >= 3 && coverSides(S.map, s).length) s.braced = true;
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
      const def = shotOdds(S.map, p, p, pos); // 玩家打這格的命中率
      s -= def.hit * 0.35;
      const o = shotOdds(S.map, e, pos, p, { targetSuppressed: !!p.suppressed });
      if (o.hit > bestHit) bestHit = o.hit;
      if (o.cover === 0) flank = true;
    } else s += 6;
  }
  s += bestHit * 0.5 + (flank ? 15 : 0);
  if (e.kind === 'zealot') s -= nearest * 4;            // 狂徒：越近越好
  else if (e.kind === 'sniper') { if (nearest < 5) s -= (5 - nearest) * 6; }
  else if (nearest > 8) s -= (nearest - 8) * 5;
  if (nearest < 2 && e.kind !== 'zealot') s -= 10;
  return s;
}

function aiChoose(moveCount, acted) {
  const es = enemies().filter(e => e.alerted && !(e.cumbersome && acted.has(e)));
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
  const moveCount = new Map();
  const acted = new Set();
  let failed = false;
  for (let i = 0; i < RULES.AI_MAX_ACTIONS && !S.gameOver; i++) {
    const act = aiChoose(moveCount, acted);
    if (!act) break;
    acted.add(act.e);
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
    if (!ok) { failed = true; break; }
  }
  // 主動權即將易手：這輪沒行動的敵人執行衝動
  await impulses(acted);
  return failed;
}

const edgeDist = p => Math.min(p.x, p.z, S.map.w - 1 - p.x, S.map.h - 1 - p.z);

async function impulses(acted) {
  const officerAlive = enemies().some(e => e.officer);
  for (const e of enemies()) {
    if (S.gameOver) return;
    if (!e.alive || acted.has(e) || e.suppressed) continue;
    if (!e.alerted) { await patrol(e); }
    else if (e.impulse === 'shoot') {
      const t = visibleTargets(e)[0];
      if (!t || e.firedOut) continue;
      impulseNote(e, '開槍');
      await shoot(e, t.unit);
    } else if (e.impulse === 'charge') {
      const ps = players();
      if (!ps.length) return;
      const near = p => Math.min(...ps.map(q => dist(p, q)));
      const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 3);
      if (!opts.length) continue;
      const best = opts.reduce((a, b) => near(b) < near(a) ? b : a);
      if (near(best) >= near(e)) continue;
      impulseNote(e, '衝鋒');
      await performMove(e, best);
    } else if (e.impulse === 'curse') {
      const ps = players().filter(p => hasLOS(S.map, e, p));
      if (!ps.length) continue;
      const p = ps.reduce((a, b) => dist(e, b) < dist(e, a) ? b : a);
      impulseNote(e, '詛咒');
      S.curse.add(key(p.x, p.z));
      drawCurse();
      suppress(p, '詛咒！');
      UI.log(`${p.name} 腳下被下了詛咒`, 'bad');
    } else if (e.impulse === 'flee' && !officerAlive) {
      const opts = [...moveOptions(e).values()].filter(m => !m.vault && dist(e, m) <= 3);
      if (!opts.length) continue;
      const best = opts.reduce((a, b) => edgeDist(b) < edgeDist(a) ? b : a);
      impulseNote(e, '逃跑');
      const ok = await performMove(e, best);
      if (ok && e.alive && edgeDist(e) === 0) flee(e);
    } else continue;
    refresh();
    if (checkEnd()) return;
  }
}

function impulseNote(e, what) {
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
  e.mesh.visible = false;
  if (e.label) { e.label.remove(); e.label = null; }
  UI.log(`${e.name} 逃離了戰場`, 'good');
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

  updateLabels(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function boot() {
  HQ.showTitle({
    onContinue: () => { Camp.load(); enterHQ(); },
    onNew: () => { Camp.newStory(); HQ.showStory('序章', STORY.intro, '前往作戰室 ▶', () => enterHQ()); },
    onEndless: () => { Camp.newEndless(); enterHQ(); },
  });
}
boot();
requestAnimationFrame(frame);
window.__game = { S, actions, camera, THREE, scene, zoneMesh, Camp, // 除錯用
  dbg: { playerMove, moveOptions, quietSees, enemies, players, weapon, step: updateTweens, magicOptions, execMagic, pushInfo, execPush,
    startMission, enterHQ, transform, spawnWave } };
