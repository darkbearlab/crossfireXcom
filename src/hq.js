// 標題畫面與作戰室（任務之間：選作戰、點成長樹、選出擊的兩人）。
import * as Camp from './campaign.js';
import { GIRLS, TREES, FAMILY, FAMILY_BY_ID, STORY } from './girls.js';
import { WEAPONS } from './config.js';

const $ = id => document.getElementById(id);
const hex = c => '#' + c.toString(16).padStart(6, '0');
let st = { op: 0, detail: null, onGo: null, notes: [], recalled: [] };

function open(html, cls = '') {
  const o = $('overlay');
  o.hidden = false;
  o.innerHTML = `<div class="panel ${cls}">${html}</div>`;
  o.scrollTop = 0;
  return o;
}

export function showTitle({ onContinue, onNew, onEndless }) {
  const meta = Camp.loadMeta();
  const has = Camp.hasSave();
  const o = open(`
    <h1>魔法少女 vs 魔女黑手黨</h1>
    <p class="sub">主動權制小隊戰術（暫定名）</p>
    <div class="title-btns">
      ${has ? '<button id="t-cont">繼續</button>' : ''}
      <button id="t-new">${has ? '重新開始戰役' : '開始戰役'}</button>
      ${meta.endless ? `<button id="t-end">無盡模式${meta.best ? `（最佳 ${meta.best}）` : ''}</button>` : ''}
    </div>`, 'title');
  if (has) o.querySelector('#t-cont').onclick = onContinue;
  o.querySelector('#t-new').onclick = () => {
    if (has && !confirm('目前的進度會被覆蓋，確定重新開始？')) return;
    onNew();
  };
  if (meta.endless) o.querySelector('#t-end').onclick = () => {
    if (has && !confirm('目前的進度會被覆蓋，確定開始無盡模式？')) return;
    onEndless();
  };
}

export function showStory(title, html, btn, cb) {
  const o = open(`<h1>${title}</h1><div class="story">${html}</div><button id="s-ok">${btn}</button>`);
  o.querySelector('#s-ok').onclick = cb;
}

export function showHQ(onGo, notes = []) {
  st = { op: 0, detail: null, onGo, notes, recalled: Camp.ensureAvailable() };
  const C = Camp.C;
  const avail = C.girls.filter(g => g.evac === 0).map(g => g.id);
  C.deploy = (C.deploy || []).filter(id => avail.includes(id));
  for (const id of avail) if (C.deploy.length < 2 && !C.deploy.includes(id)) C.deploy.push(id);
  render();
}

function opDesc(op) {
  if (op.kind === 'facility') return op.member ? `${FAMILY_BY_ID[op.member].title}・${FAMILY_BY_ID[op.member].name} 的設施` : '隨機設施';
  if (op.kind === 'boss') return `打倒她，拔掉「${FAMILY_BY_ID[op.member].buff}」`;
  if (op.kind === 'manor') return '削弱增援產能；也許會有成員在場';
  return `增援 ${Camp.C.production} 波。打倒教母就結束`;
}

function opStory(op) {
  if (!op) return '';
  if (op.kind === 'facility') return STORY.facility(op.name);
  if (op.kind === 'boss') return FAMILY_BY_ID[op.member].line;
  if (op.kind === 'manor') return STORY.manorRaid;
  return STORY.finale;
}

function render() {
  const C = Camp.C;
  const ops = Camp.ops();
  if (st.op >= ops.length) st.op = 0;
  const op = ops[st.op];

  let fam = '';
  if (C.mode === 'story') {
    fam = FAMILY.map(d => {
      const m = C.members.find(x => x.id === d.id);
      const left = m.alive && C.phase === 'facilities' ? ` · 設施 ${m.facilities}` : '';
      return `<div class="fam ${m.alive ? '' : 'down'}"><b>${d.title}・${d.name}</b>${left}<br><small>${d.buff}：${d.desc}</small></div>`;
    }).join('');
    if (C.phase === 'manor') fam += `<div class="fam prod"><b>莊園增援產能 ${C.production}</b><br><small>決戰時的增援波數</small></div>`;
  } else {
    const counts = {};
    for (const b of C.buffs) counts[b] = (counts[b] || 0) + 1;
    fam = Object.keys(counts).length
      ? Object.entries(counts).map(([id, n]) => `<div class="fam"><b>${FAMILY_BY_ID[id].buff}${n > 1 ? ' ×' + n : ''}</b><br><small>${FAMILY_BY_ID[id].desc}</small></div>`).join('')
      : '<div class="fam"><small>敵人還沒有加持（每 2 張地圖多一種）</small></div>';
  }

  const head = C.mode === 'story'
    ? `作戰室 · 已完成 ${C.done} 個任務${C.phase === 'manor' ? ' · 莊園階段' : ''}`
    : `無盡模式 · 已完成 ${C.done} 張地圖`;

  const opsHtml = C.phase === 'done' ? '' : ops.map((o, i) => `
    <button class="op ${i === st.op ? 'on' : ''} ${o.kind}" data-o="${i}">
      <b>${C.retry ? '重打：' : ''}${o.name}</b><small>${opDesc(o)} · 難度 ${Camp.level(o)}</small>
    </button>`).join('');

  const girls = GIRLS.map(d => {
    const g = Camp.girlState(d.id);
    const dep = C.deploy.includes(d.id);
    const trees = ['gun', 'magic'].map(t => {
      const nodes = TREES[d.id][t].map((txt, i) =>
        `<button class="node ${i < g[t] ? 'got' : i === g[t] ? 'next' : ''} ${st.detail && st.detail.g === d.id && st.detail.t === t && st.detail.i === i ? 'sel' : ''}" data-g="${d.id}" data-t="${t}" data-i="${i}">${i + 1}</button>`).join('');
      return `<div class="tree"><span class="tl">${t === 'gun' ? '槍法' : '魔法'}</span>${nodes}</div>`;
    }).join('');
    let det = '';
    if (st.detail && st.detail.g === d.id) {
      const { t, i } = st.detail;
      const can = i === g[t] && g.medals > 0;
      const state = i < g[t] ? '（已學會）' : i === g[t] ? (g.medals > 0 ? '' : '（需要獎章）') : '（要先學前一格）';
      det = `<div class="det"><b>${t === 'gun' ? '槍法' : '魔法'} ${i + 1}</b> ${TREES[d.id][t][i]} <span class="dim">${state}</span>
        ${can ? `<button class="learn" data-g="${d.id}" data-t="${t}">學習（1 枚獎章）</button>` : ''}</div>`;
    }
    const weap = d.weapons.map(w => WEAPONS[w].name).join(' ＋ ');
    const status = g.evac > 0
      ? `<span class="evac-tag">後送中：再 ${g.evac} 個任務</span>`
      : `<button class="dep ${dep ? 'on' : ''}" data-g="${d.id}">${dep ? '出擊 ✓' : '待命'}</button>`;
    return `<div class="gcard ${dep ? 'on' : ''} ${g.evac > 0 ? 'evac' : ''}">
      <div class="gh"><i class="dot" style="background:${hex(d.hair)}"></i><b>${d.name}</b><span class="t">${d.title}</span>
        <span class="hp">HP ${g.hp}/${d.maxHp}</span></div>
      <div class="gw">${weap}</div>
      <div class="gw dim">被動：${d.passive}<br>魔法：${d.active}</div>
      ${trees}${det}
      <div class="gf"><span class="medal">獎章 ${g.medals}</span>${status}</div>
    </div>`;
  }).join('');

  const avail = C.girls.filter(g => g.evac === 0).length;
  const need = Math.min(2, avail);
  const ready = C.phase !== 'done' && C.deploy.length === need && op;
  const notes = [...st.notes, ...st.recalled.map(id => `${GIRLS.find(g => g.id === id).name} 提前歸隊（半血）`)];

  const o = open(`
    <h1>${head}</h1>
    ${notes.length ? `<ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
    ${C.phase === 'done' ? `<div class="story">${STORY.victory}</div><button id="hq-title">回到標題</button>` : ''}
    <div class="sec">家族的加持</div><div class="fams">${fam}</div>
    ${opsHtml ? `<div class="sec">選擇作戰</div><div class="ops">${opsHtml}</div><div class="story small">${opStory(op)}</div>` : ''}
    <div class="sec">魔法少女（選 ${need} 人出擊；點數字看成長樹）</div>
    <div class="girls">${girls}</div>
    ${C.phase !== 'done' ? `<button id="hq-go" ${ready ? '' : 'disabled'}>出擊 ▶</button>` : ''}
  `, 'hq');

  o.querySelectorAll('.op').forEach(b => b.onclick = () => { st.op = +b.dataset.o; render(); });
  o.querySelectorAll('.node').forEach(b => b.onclick = () => {
    const d = { g: b.dataset.g, t: b.dataset.t, i: +b.dataset.i };
    st.detail = st.detail && st.detail.g === d.g && st.detail.t === d.t && st.detail.i === d.i ? null : d;
    render();
  });
  o.querySelectorAll('.learn').forEach(b => b.onclick = () => { Camp.learn(b.dataset.g, b.dataset.t); render(); });
  o.querySelectorAll('.dep').forEach(b => b.onclick = () => {
    const id = b.dataset.g;
    if (C.deploy.includes(id)) C.deploy = C.deploy.filter(x => x !== id);
    else { C.deploy.push(id); if (C.deploy.length > need) C.deploy.shift(); }
    render();
  });
  const go = o.querySelector('#hq-go');
  if (go) go.onclick = () => {
    if (!ready) return;
    C.op = op;
    Camp.save();
    o.hidden = true;
    st.onGo();
  };
  const back = o.querySelector('#hq-title');
  if (back) back.onclick = () => location.reload();
}
