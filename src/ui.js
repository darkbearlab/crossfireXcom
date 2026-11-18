// HUD / DOM 介面。
const $ = id => document.getElementById(id);
let H = {};

export function init(handlers) {
  H = handlers;
  $('btn-shoot').onclick = () => H.shoot();
  $('btn-rally').onclick = () => H.rally();
  $('btn-end').onclick = () => H.pass();
  $('btn-start').onclick = () => H.start();
  $('help-toggle').onclick = () => $('help').classList.toggle('open');
}

export function coverName(o) {
  if (o.cover === 2) return '全掩體';
  if (o.cover === 1) return '半掩體';
  return o.flanked ? '側翼！' : '暴露';
}

export function updateHUD(S) {
  $('mission').textContent = `任務 ${S.level}｜${S.theme.name}`;
  const t = $('turn');
  t.textContent = S.side === 'deploy' ? '部署階段' : `主動權：${S.side === 'player' ? '我方' : '敵方'} · 第 ${S.initNo} 輪`;
  t.className = S.side === 'deploy' ? 'player' : S.side;
  const deploying = S.side === 'deploy';
  $('btn-start').hidden = !deploying;
  for (const id of ['btn-shoot', 'btn-rally', 'btn-end']) $(id).hidden = deploying;
  const seen = S.units.filter(u => u.team === 'enemy' && u.alive && u.mesh.visible).length;
  $('enemy-count').textContent = `可見敵人 ${seen}`;

  const sq = $('squad');
  sq.innerHTML = '';
  for (const u of S.units.filter(u => u.team === 'player')) {
    const card = document.createElement('div');
    card.className = 'card' + (u === S.selected ? ' sel' : '') + (u.alive ? '' : ' dead');
    const st = [];
    if (u.alive && u.suppressed) st.push('<span class="sup">壓制中</span>');
    if (u.alive && u.firedOut) st.push('<span class="dim">不能再開槍</span>');
    card.innerHTML = `
      <div class="nm">${u.name}${u.recruit ? '<span class="tag">新兵</span>' : ''}${u.alive ? '' : '<span class="tag kia">陣亡</span>'}</div>
      <div class="hpbar"><i style="width:${Math.max(0, u.hp) / u.maxHp * 100}%"></i><span>${Math.max(0, u.hp)}/${u.maxHp}</span></div>
      <div class="meta">${st.join('') || '<span class="dim">待命</span>'}</div>
      <div class="stats">命中 ${u.aim} · 暴擊 ${u.crit} · 傷害 ${u.dmg[0]}-${u.dmg[1]}</div>`;
    if (u.alive) card.onclick = () => H.select(u);
    sq.appendChild(card);
  }

  const sel = S.selected;
  const can = H.canAct(sel);
  $('btn-shoot').disabled = !can || sel.firedOut;
  $('btn-rally').disabled = !can || !sel.suppressed;
  $('btn-end').disabled = S.side !== 'player' || S.busy || S.gameOver;

  for (const u of S.units) if (u.label) updateLabel(u.label, u);
}

export function showTargeting(list, idx) {
  const el = $('target-panel');
  el.hidden = false;
  el.innerHTML = `<div class="tp-title">選擇目標 <small>Tab 切換 · 點擊敵人也可</small></div>` +
    list.map((t, i) => `
      <div class="tgt ${i === idx ? 'on' : ''}" data-i="${i}">
        <div><b>${t.unit.name}</b> <small>HP ${t.unit.hp}/${t.unit.maxHp}</small></div>
        <div class="hit">${t.odds.hit}%</div>
        <small>暴擊 ${t.odds.crit}% · ${coverName(t.odds)} · 距離 ${t.odds.dist.toFixed(1)}</small>
      </div>`).join('') +
    `<div class="tp-btns"><button id="tp-fire">開火 (Enter)</button><button id="tp-cancel">取消 (Esc)</button></div>`;
  el.querySelectorAll('.tgt').forEach(d => d.onclick = () => H.pickTarget(+d.dataset.i));
  $('tp-fire').onclick = () => H.fire();
  $('tp-cancel').onclick = () => H.cancelTarget();
}

export function hideTargeting() { $('target-panel').hidden = true; }

export function makeLabel(u) {
  const d = document.createElement('div');
  d.className = 'ulabel ' + u.team;
  $('labels').appendChild(d);
  updateLabel(d, u);
  return d;
}

export function updateLabel(d, u) {
  const icons = (u.suppressed ? '<b class="supi">▼</b> ' : '') + (u.firedOut ? '<b class="outi">✕</b> ' : '');
  const html = `<div class="ln">${icons}${u.name}</div>` +
    `<div class="pips">${Array.from({ length: u.maxHp }, (_, i) => `<i class="${i < u.hp ? 'on' : ''}"></i>`).join('')}</div>`;
  if (d._html !== html) { d.innerHTML = html; d._html = html; }
}

export function makeFloat(text, cls) {
  const d = document.createElement('div');
  d.className = 'float ' + (cls || '');
  d.textContent = text;
  $('labels').appendChild(d);
  return d;
}

let bannerTimer;
export function banner(text, cls = '') {
  const b = $('banner');
  b.textContent = text;
  b.className = 'show ' + cls;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (b.className = ''), 1400);
}

let toastTimer;
export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

export function log(text, cls = '') {
  const l = $('log');
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  l.prepend(d);
  while (l.children.length > 8) l.lastChild.remove();
}

export function clearLog() { $('log').innerHTML = ''; }

export function tip(text, x, y) {
  const t = $('tip');
  if (!text) { t.hidden = true; return; }
  t.hidden = false;
  t.innerHTML = text;
  t.style.left = x + 16 + 'px';
  t.style.top = y + 12 + 'px';
}

export function showOverlay(title, html, btn, cb) {
  const o = $('overlay');
  o.hidden = false;
  o.innerHTML = `<div class="panel"><h1>${title}</h1><div class="body">${html}</div><button id="ov-btn">${btn}</button></div>`;
  $('ov-btn').onclick = () => { o.hidden = true; cb(); };
}
