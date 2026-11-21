// 劇情演出：三種畫面共用同一種台詞資料
//   vn(steps, opts)     文字冒險：自訂背景圖＋立繪＋下方對話框（擋住整個畫面）
//   battle(steps, opts) 戰鬥畫面當背景：上下黑邊、半透明對話框＋胸像，鏡頭可以跟著說話的人
//   radio(steps)        無線電：左上角小框＋頭像＋文字，不擋操作，自己播完消失
// 台詞（step）：
//   { who: 'akane' | 'b_exec' | 'gunman' | { name, color, img }, text: '...', at: 'left'|'center'|'right', name: '顯示名稱' }
//   { bg: 'url' | 'city' | 'hq' | 'warehouse' }   換背景（vn）
//   { exit: 'akane' }                             立繪退場（vn）
//   { wait: 毫秒 }
// 頭像、立繪直接用遊戲裡的 3D 模型渲染（不用另外準備圖）；who 給 { img } 就用圖片。
import * as THREE from 'three';
import { GIRLS, FAMILY, GODMOTHER } from './girls.js';
import { ENEMY_TYPES } from './config.js';
import { makeUnitMesh, makeImpMesh, makeScarecrowMesh } from './units.js';

let instant = false;
export const setInstant = on => { instant = on; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const hex = c => '#' + c.toString(16).padStart(6, '0');
// 名牌顏色：太暗的顏色（頭目多半是深色）調亮，在深色底上才看得清楚
const tint = c => {
  const r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255;
  if (0.299 * r + 0.587 * g + 0.114 * b > 110) return hex(c);
  const m = v => Math.round(v + (255 - v) * 0.55);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};

// ---------------- 說話的人 ----------------
const GIRL_BY_ID = Object.fromEntries(GIRLS.map(g => [g.id, g]));
const BOSS_NAME = Object.fromEntries([...FAMILY, GODMOTHER].map(m => [m.boss, m]));
export function speaker(who) {
  if (who && typeof who === 'object') return { id: who.name, name: who.name, color: who.color ?? 0x8fd3ff, img: who.img || null };
  const g = GIRL_BY_ID[who];
  if (g) return { id: who, name: g.name, color: g.hair, girl: g };
  const fam = FAMILY.find(m => m.id === who);
  if (fam) who = fam.boss;
  const t = ENEMY_TYPES[who];
  if (t) return { id: who, name: BOSS_NAME[who] ? BOSS_NAME[who].name : t.name, color: t.color, enemy: who, title: BOSS_NAME[who] && BOSS_NAME[who].title };
  return { id: String(who), name: String(who), color: 0x8fd3ff };
}

// ---------------- 用 3D 模型渲染頭像／立繪 ----------------
let R = null;
const shots = new Map();
function rig() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xeef2ff, 0x40384a, 1.5));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 1.6); rim.position.set(-3, 2, -3); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
  R = { renderer, scene, cam };
  return R;
}
function meshOf(sp) {
  if (sp.girl) return makeUnitMesh('player', 'girl', sp.girl.color, (sp.girl.weapons && sp.girl.weapons[0]) || 'ar', 1, { hair: sp.girl.hair, girl: sp.girl.id });
  if (sp.enemy === 'imp') return makeImpMesh();
  if (sp.enemy === 'scarecrow') return makeScarecrowMesh(sp.color);
  if (sp.enemy) { const t = ENEMY_TYPES[sp.enemy]; return makeUnitMesh('enemy', sp.enemy, t.color, 'ar', 1, { boss: !!t.boss, mother: sp.enemy === 'b_mother' }); }
  return null;
}
// kind: 'bust'（胸像，正方形）或 'full'（全身立繪，直的）
export function portrait(who, kind = 'bust') {
  const sp = speaker(who);
  if (sp.img) return sp.img;
  const k = sp.id + ':' + kind;
  if (shots.has(k)) return shots.get(k);
  let url = '';
  try {
    const mesh = meshOf(sp);
    if (!mesh) throw new Error('no mesh');
    const { renderer, scene, cam } = rig();
    mesh.rotation.y = -0.45; // 四分之三側面
    scene.add(mesh);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const h = box.max.y - box.min.y, cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
    const [W, H] = kind === 'full' ? [360, 720] : [256, 256];
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    const viewH = kind === 'full' ? h * 1.08 : Math.max(0.42, h * 0.36);
    const y = kind === 'full' ? box.min.y + h / 2 : box.max.y - viewH * 0.52;
    const d = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(cx + d * 0.18, y + viewH * 0.06, cz + d);
    cam.lookAt(cx, y, cz);
    cam.updateProjectionMatrix();
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, cam);
    url = renderer.domElement.toDataURL('image/png');
    scene.remove(mesh);
  } catch (err) {
    // 沒有模型：用名字第一個字畫一個徽章
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = hex(sp.color); g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(sp.name[0] || '?', 64, 68);
    url = c.toDataURL();
  }
  shots.set(k, url);
  return url;
}

// ---------------- 程式畫的背景（沒有圖片時用） ----------------
const bgs = new Map();
export function backdrop(name) {
  if (/^(data:|https?:|\.?\/|[\w-]+\.(png|jpe?g|webp))/.test(name)) return name; // 自訂圖片
  if (bgs.has(name)) return bgs.get(name);
  const c = document.createElement('canvas'); c.width = 960; c.height = 600;
  const g = c.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const grad = (stops) => { const l = g.createLinearGradient(0, 0, 0, 600); stops.forEach(([t, col]) => l.addColorStop(t, col)); return l; };
  if (name === 'hq') { // 作戰室：昏暗的室內、窗外夜景、桌上的地圖
    g.fillStyle = grad([[0, '#1d2433'], [1, '#0c0f16']]); g.fillRect(0, 0, 960, 600);
    g.fillStyle = '#0a1220'; g.fillRect(560, 70, 300, 220);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,${rnd(180, 230)},120,${rnd(0.3, 0.9)})`; g.fillRect(rnd(570, 850), rnd(150, 280), 3, 4); }
    g.strokeStyle = '#3a4458'; g.lineWidth = 8; g.strokeRect(560, 70, 300, 220); g.beginPath(); g.moveTo(710, 70); g.lineTo(710, 290); g.stroke();
    g.fillStyle = '#2b2219'; g.fillRect(0, 430, 960, 170);
    g.fillStyle = '#c9b48a'; g.save(); g.translate(300, 470); g.rotate(-0.06); g.fillRect(0, 0, 320, 90);
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(rnd(0, 320), 0); g.lineTo(rnd(0, 320), 90); g.stroke(); }
    g.fillStyle = '#c0392b'; g.beginPath(); g.arc(220, 40, 7, 0, 7); g.fill(); g.restore();
    const lamp = g.createRadialGradient(420, 0, 10, 420, 0, 420); lamp.addColorStop(0, 'rgba(255,220,150,0.35)'); lamp.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = lamp; g.fillRect(0, 0, 960, 600);
  } else if (name === 'warehouse') { // 碼頭倉庫：鐵捲門、貨櫃、路燈
    g.fillStyle = grad([[0, '#0e1a26'], [0.6, '#1a2632'], [1, '#101418']]); g.fillRect(0, 0, 960, 600);
    const cols = ['#7a2e24', '#2e5a7a', '#5a6a2e', '#6a4a2a'];
    for (let i = 0; i < 7; i++) { const x = i * 140 - 20, hh = rnd(140, 260); g.fillStyle = cols[i % 4]; g.fillRect(x, 420 - hh, 130, hh);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; for (let j = 8; j < 130; j += 12) { g.beginPath(); g.moveTo(x + j, 420 - hh); g.lineTo(x + j, 420); g.stroke(); } }
    g.fillStyle = '#1a1c20'; g.fillRect(0, 420, 960, 180);
    const l = g.createRadialGradient(700, 120, 5, 700, 120, 300); l.addColorStop(0, 'rgba(255,200,120,0.5)'); l.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = l; g.fillRect(0, 0, 960, 600); g.fillStyle = '#333'; g.fillRect(696, 120, 8, 300);
  } else { // city：夜晚的街道、月亮、大樓剪影
    g.fillStyle = grad([[0, '#1a1036'], [0.55, '#4a2a5a'], [1, '#e07a6a']]); g.fillRect(0, 0, 960, 600);
    for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.8)})`; g.fillRect(rnd(0, 960), rnd(0, 260), 2, 2); }
    g.fillStyle = '#fff4d8'; g.beginPath(); g.arc(760, 110, 46, 0, 7); g.fill();
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? '#0e0a1a' : '#2a1d3a';
      for (let x = -20; x < 980;) { const w = rnd(50, 110), hh = rnd(140, 330) - layer * 60; g.fillRect(x, 600 - hh, w, hh);
        if (layer) for (let wy = 600 - hh + 12; wy < 590; wy += 18) for (let wx = x + 8; wx < x + w - 8; wx += 14) if (Math.random() < 0.3) { g.fillStyle = 'rgba(255,214,140,0.85)'; g.fillRect(wx, wy, 6, 8); g.fillStyle = '#0e0a1a'; }
        x += w + rnd(0, 12); }
    }
  }
  const url = c.toDataURL('image/jpeg', 0.85);
  bgs.set(name, url);
  return url;
}

// ---------------- 樣式 ----------------
const CSS = `
.scn { position: fixed; inset: 0; z-index: 60; user-select: none; -webkit-user-select: none; font-family: inherit; }
.scn .scn-bg { position: absolute; inset: 0; background: #000 center/cover no-repeat; transition: background-image .5s, opacity .5s; }
.scn .scn-stage { position: absolute; left: 0; right: 0; bottom: 0; height: 88%; pointer-events: none; }
.scn .scn-actor { position: absolute; bottom: 0; height: 100%; aspect-ratio: 1 / 2; background: center bottom/contain no-repeat;
  transform: translateX(-50%); transition: filter .25s, opacity .35s, transform .35s; filter: brightness(.55) saturate(.7); opacity: 0; }
.scn .scn-actor.in { opacity: 1; } .scn .scn-actor.talk { filter: none; transform: translateX(-50%) scale(1.03); }
.scn .scn-box { position: absolute; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%);
  width: min(920px, calc(100vw - 24px)); min-height: 120px; box-sizing: border-box; padding: 26px 22px 18px;
  background: linear-gradient(#0f1620ee, #0a0f16f2); border: 1px solid #4fd6ff88; border-radius: 10px; box-shadow: 0 6px 30px #000a; }
.scn .scn-name { position: absolute; top: -15px; left: 18px; padding: 3px 14px; border-radius: 6px; font-weight: bold; font-size: 15px;
  color: #0c1118; background: var(--c, #8fd3ff); box-shadow: 0 2px 8px #0008; }
.scn .scn-text { font-size: 17px; line-height: 1.7; color: #eef4fa; min-height: 3.4em; white-space: pre-wrap; }
.scn .scn-next { position: absolute; right: 14px; bottom: 8px; color: #8fd3ff; font-size: 13px; animation: scn-bob 1s infinite; background: none; border: 0; padding: 4px; cursor: pointer; }
.scn .scn-next[hidden] { display: none; }
.scn .scn-tools { position: absolute; top: max(10px, env(safe-area-inset-top)); right: 10px; display: flex; gap: 6px; z-index: 2; }
.scn .scn-tools button { padding: 5px 10px; font-size: 13px; background: #0f1620cc; border: 1px solid #4fd6ff66; border-radius: 5px; color: #cfe8ff; }
.scn .scn-tools button.on { background: #1d4a68; }
@keyframes scn-bob { 50% { transform: translateY(3px); } }
/* 戰鬥畫面當背景：上下黑邊，看得到戰場 */
.scn.battle { pointer-events: auto; }
.scn.battle .scn-bg { background: none; }
.scn.battle::before, .scn.battle::after { content: ''; position: absolute; left: 0; right: 0; height: 0; background: #000; transition: height .35s; z-index: 0; }
.scn.battle::before { top: 0; } .scn.battle::after { bottom: 0; }
.scn.battle.open::before { height: 11vh; } .scn.battle.open::after { height: 9vh; }
.scn.battle .scn-box { display: flex; gap: 14px; align-items: flex-start; padding: 22px 18px 16px 18px; background: linear-gradient(#0b1119dd, #070b10ee); z-index: 1; }
.scn.battle .scn-bust { flex: none; width: 92px; height: 92px; border-radius: 8px; background: #182230 center/cover no-repeat; border: 2px solid var(--c, #8fd3ff); margin-top: -2px; }
.scn.battle .scn-name { left: 124px; }
.scn.battle .scn-text { flex: 1; }
body.scn-cine #actions, body.scn-cine #log, body.scn-cine #squad, body.scn-cine #cam-btns, body.scn-cine #help, body.scn-cine #target-panel { opacity: 0; pointer-events: none; transition: opacity .3s; }
/* 無線電：左上角，不擋操作 */
.scn-radio { position: fixed; top: calc(max(8px, env(safe-area-inset-top)) + 40px); left: 8px; z-index: 55; width: min(380px, calc(100vw - 16px));
  display: flex; gap: 10px; padding: 8px 10px 8px 8px; box-sizing: border-box; border-radius: 8px; cursor: pointer;
  background: linear-gradient(90deg, #08131cf0, #0b1824e0); border: 1px solid #3fd08a99; box-shadow: 0 4px 18px #000a;
  transform: translateX(-110%); transition: transform .28s ease-out; }
.scn-radio.show { transform: none; }
.scn-radio .r-face { flex: none; width: 64px; height: 64px; border-radius: 5px; background: #10202a center/cover no-repeat; position: relative; overflow: hidden; border: 1px solid var(--c, #3fd08a); }
.scn-radio .r-face::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(#0000 0 2px, #0006 2px 3px); animation: r-flick .12s steps(2) infinite; mix-blend-mode: multiply; }
@keyframes r-flick { 50% { opacity: .6; } }
.scn-radio .r-body { flex: 1; min-width: 0; }
.scn-radio .r-head { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #7fe0b0; letter-spacing: .05em; }
.scn-radio .r-head b { color: var(--c, #fff); font-size: 14px; letter-spacing: 0; }
.scn-radio .r-dot { width: 7px; height: 7px; border-radius: 50%; background: #3fd08a; box-shadow: 0 0 6px #3fd08a; animation: r-blink 1s infinite; }
@keyframes r-blink { 50% { opacity: .25; } }
.scn-radio .r-text { font-size: 14px; line-height: 1.5; color: #e4f2ea; margin-top: 2px; white-space: pre-wrap; }
@media (max-width: 600px) {
  .scn .scn-text { font-size: 15px; } .scn .scn-box { min-height: 104px; padding: 22px 14px 16px; }
  .scn .scn-stage { height: 62%; bottom: 120px; }
  .scn .scn-actor { height: 70%; }
  .scn.battle .scn-bust { width: 64px; height: 64px; } .scn.battle .scn-name { left: 92px; }
  .scn-radio .r-face { width: 52px; height: 52px; }
}`;
function ensureCss() {
  if (document.getElementById('scn-css')) return;
  const s = document.createElement('style'); s.id = 'scn-css'; s.textContent = CSS; document.head.appendChild(s);
}

// ---------------- 對話框（vn、battle 共用） ----------------
// 回傳 promise：台詞全部播完（或按「跳過」）才 resolve
async function dialogue(steps, mode, opts = {}) {
  if (instant) { // 文字介面／快速模式：只把台詞丟給 onLine，不擋流程
    for (const st of steps) if (st.text && opts.onLine) opts.onLine(st, speaker(st.who));
    return;
  }
  ensureCss();
  const root = document.createElement('div');
  root.className = 'scn ' + mode;
  root.innerHTML = `<div class="scn-bg"></div><div class="scn-stage"></div>
    <div class="scn-tools"><button class="scn-auto">自動</button><button class="scn-skip">跳過 ⏭</button></div>
    <div class="scn-box">${mode === 'battle' ? '<div class="scn-bust"></div>' : ''}<div class="scn-name" hidden></div><div class="scn-text"></div><button class="scn-next" id="scn-next" hidden>▼</button></div>`;
  document.body.appendChild(root);
  if (mode === 'battle') { document.body.classList.add('scn-cine'); requestAnimationFrame(() => root.classList.add('open')); }
  const $ = s => root.querySelector(s);
  const bg = $('.scn-bg'), stage = $('.scn-stage'), nameEl = $('.scn-name'), textEl = $('.scn-text'), next = $('.scn-next');
  if (mode === 'vn') bg.style.backgroundImage = `url(${backdrop(opts.bg || 'city')})`;
  const actors = new Map();
  const slotX = { left: 22, center: 50, right: 78 };
  let skip = false, auto = false, tap = null;
  const waitTap = () => new Promise(r => { tap = r; });
  const fire = () => { if (tap) { const t = tap; tap = null; t(); } };
  root.addEventListener('pointerup', e => { if (!e.target.closest('.scn-tools')) fire(); });
  const onKey = e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); fire(); } if (e.key === 'Escape') { skip = true; fire(); } };
  addEventListener('keydown', onKey);
  $('.scn-skip').onclick = () => { skip = true; fire(); };
  $('.scn-auto').onclick = e => { auto = !auto; e.currentTarget.classList.toggle('on', auto); if (auto) fire(); };

  for (const st of steps) {
    if (skip) break;
    if (st.bg && mode === 'vn') { bg.style.backgroundImage = `url(${backdrop(st.bg)})`; continue; }
    if (st.exit) { const a = actors.get(speaker(st.exit).id); if (a) { a.classList.remove('in'); setTimeout(() => a.remove(), 400); actors.delete(speaker(st.exit).id); } continue; }
    if (st.wait) { await sleep(st.wait); continue; }
    if (!st.text) continue;
    const sp = speaker(st.who);
    root.style.setProperty('--c', tint(sp.color));
    nameEl.hidden = !st.who; nameEl.textContent = st.name || sp.name;
    if (mode === 'vn' && st.who) { // 立繪：第一次出場放到指定位置，說話的人亮起來
      let a = actors.get(sp.id);
      if (!a) {
        a = document.createElement('div'); a.className = 'scn-actor';
        a.style.backgroundImage = `url(${portrait(st.who, 'full')})`;
        stage.appendChild(a); actors.set(sp.id, a);
        requestAnimationFrame(() => a.classList.add('in'));
      }
      if (st.at || !a.style.left) a.style.left = slotX[st.at || (actors.size === 1 ? 'center' : actors.size === 2 ? 'right' : 'left')] + '%';
      for (const [, o] of actors) o.classList.toggle('talk', o === a);
    }
    if (mode === 'battle') $('.scn-bust').style.backgroundImage = st.who ? `url(${portrait(st.who, 'bust')})` : 'none';
    if (opts.onLine) opts.onLine(st, sp);
    // 打字機：點一下先把這句顯示完，再點一下才下一句
    next.hidden = true;
    const txt = String(st.text);
    let done = false;
    const typing = (async () => {
      for (let i = 1; i <= txt.length && !done; i++) { textEl.textContent = txt.slice(0, i); await sleep(26); }
      textEl.textContent = txt; done = true;
    })();
    await Promise.race([typing, waitTap()]);
    done = true; tap = null; await typing;
    if (skip) break;
    next.hidden = false;
    await (auto ? Promise.race([sleep(900 + txt.length * 45), waitTap()]) : waitTap());
    tap = null;
  }
  removeEventListener('keydown', onKey);
  root.classList.remove('open');
  document.body.classList.remove('scn-cine');
  root.style.transition = 'opacity .25s'; root.style.opacity = '0';
  await sleep(250);
  root.remove();
}
export const vn = (steps, opts = {}) => dialogue(steps, 'vn', opts);
export const battle = (steps, opts = {}) => dialogue(steps, 'battle', opts);

// ---------------- 無線電 ----------------
const radioQ = [];
let radioBusy = false;
// 不等它播完也可以（遊戲照常進行）；回傳的 promise 在這幾句播完時 resolve
export function radio(steps, opts = {}) {
  return new Promise(res => { radioQ.push({ steps, opts, res }); if (!radioBusy) radioLoop(); });
}
async function radioLoop() {
  radioBusy = true;
  ensureCss();
  while (radioQ.length) {
    const { steps, opts, res } = radioQ.shift();
    if (instant) { for (const st of steps) if (st.text && opts.onLine) opts.onLine(st, speaker(st.who)); res(); continue; }
    let box = document.querySelector('.scn-radio');
    if (!box) {
      box = document.createElement('div'); box.className = 'scn-radio';
      box.innerHTML = '<div class="r-face"></div><div class="r-body"><div class="r-head"><i class="r-dot"></i>通訊 <b></b></div><div class="r-text"></div></div>';
      document.body.appendChild(box);
    }
    let tapped = false;
    box.onclick = () => { tapped = true; };
    for (const st of steps) {
      if (!st.text) continue;
      const sp = speaker(st.who);
      box.style.setProperty('--c', tint(sp.color));
      box.querySelector('.r-face').style.backgroundImage = `url(${portrait(st.who, 'bust')})`;
      box.querySelector('b').textContent = st.name || sp.name;
      if (opts.onLine) opts.onLine(st, sp);
      requestAnimationFrame(() => box.classList.add('show'));
      const t = box.querySelector('.r-text'), txt = String(st.text);
      tapped = false;
      for (let i = 1; i <= txt.length && !tapped; i++) { t.textContent = txt.slice(0, i); await sleep(30); }
      t.textContent = txt; tapped = false;
      for (let ms = 0; ms < 1600 + txt.length * 55 && !tapped; ms += 50) await sleep(50);
    }
    res();
    if (!radioQ.length) { box.classList.remove('show'); await sleep(300); if (!radioQ.length) box.remove(); }
  }
  radioBusy = false;
}

// ---------------- 預覽（標題畫面的「劇情演出預覽」、文字介面 scene demo） ----------------
export async function demo(which = 'all', hooks = {}) {
  const was = instant; instant = false; // 預覽一定要演出來（文字介面平常會關掉演出）
  try { await demoBody(which, hooks); } finally { instant = was; }
}
async function demoBody(which, hooks) {
  if (which === 'all' || which === 'vn') {
    await vn([
      { bg: 'hq' },
      { who: 'akane', text: '大家都到了吧？今晚的目標是碼頭那間倉庫。', at: 'left' },
      { who: 'hikari', text: '是莫妮卡的帳房在用的地方對吧。只要拿到帳本，就能知道她們把人手藏在哪裡。', at: 'right' },
      { who: 'chinatsu', text: '倉庫四周有三個崗哨，正面全是掩體。從側面繞比較好。', at: 'center' },
      { who: 'akane', text: '好！那就照千夏說的，從側面切進去！' },
      { bg: 'warehouse' },
      { exit: 'hikari' },
      { who: 'b_book', text: '哎呀，客人這麼晚還來對帳？……帳本上的數字，可不能少一個喔。', at: 'right' },
      { who: 'akane', text: '那就由我們來幫妳把帳算清楚！' },
    ], { bg: 'hq' });
  }
  if (which === 'all' || which === 'battle') {
    await battle([
      { who: 'b_exec', text: '家族的規矩只有一條：別留活口。' },
      { who: 'kaede', text: '那還真巧，我們的規矩也只有一條——把妳們全部打趴！' },
      { who: 'yukino', text: '……楓，至少先找掩體。' },
    ], hooks);
  }
  if (which === 'all' || which === 'radio') {
    await radio([
      { who: 'chinatsu', text: '這裡是千夏。左邊高台上有狙擊手，別從那條路走。' },
      { who: 'momo', text: '囉嗦！我直接飛過去就好了啦！' },
      { who: 'shiori', text: '大家……要平安回來喔。' },
    ], hooks);
  }
}
