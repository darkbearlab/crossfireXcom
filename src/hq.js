// 標題畫面與作戰室（任務之間：選作戰、點成長樹、選出擊的兩人）。
import * as Camp from './campaign.js';
import { GIRLS, TREES, FAMILY, FAMILY_BY_ID, STORY } from './girls.js';
import { WEAPONS, RULES, ITEMS, SLOTS, COUNTERS } from './config.js';
const GIRL_BY = id => GIRLS.find(g => g.id === id);

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

// 重畫作戰室，保留目前選的作戰（裝備、黑市之後用；showHQ 會重設選擇）
export function refresh() { if (st.onGo) render(); }

export function showHQ(onGo, notes = []) {
  st = { op: 0, detail: null, onGo, notes, recalled: Camp.ensureAvailable() };
  const C = Camp.C;
  const avail = C.girls.filter(g => g.evac === 0).map(g => g.id);
  C.deploy = (C.deploy || []).filter(id => avail.includes(id));
  for (const id of avail) if (C.deploy.length < 2 && !C.deploy.includes(id)) C.deploy.push(id);
  render();
}

function opDesc(op) {
  const story = Camp.C.mode === 'story';
  if (op.kind === 'facility') return story ? '家族的設施（不知道是誰的；她可能親自現身）。打贏得到情報：翻開一張蓋著的反制' : (op.member ? `${FAMILY_BY_ID[op.member].title}・${FAMILY_BY_ID[op.member].name} 的設施` : '隨機設施');
  if (op.kind === 'boss') return `她的據點：三段生命的頭目戰。打倒她，拔掉「${FAMILY_BY_ID[op.member].buff}」`;
  if (op.kind === 'manor') return '削弱增援產能；也許會有成員在場';
  if (op.kind === 'stop') return `打贏就取消這張反制：${COUNTERS[op.card].desc}`;
  if (op.kind === 'growth') return `打贏拿到：${op.reward.map(k => ITEMS[k].name).join('、')}`;
  if (op.kind === 'rest') return '不出擊。全員回 1 顆心、後送倒數 -1；可出擊的人不足 2 名時最快回來的人提前歸隊。家族的反制照樣推進';
  const left = story ? Camp.C.members.filter(m => m.alive).map(m => FAMILY_BY_ID[m.id].name) : [];
  return `增援 ${Camp.C.production} 波。打倒教母就結束${left.length ? `（${left.join('、')} 也在莊園）` : ''}`;
}

function opBuffs(op) {
  if (op.kind === 'rest') return '';
  if (op.kind === 'facility' && Camp.C.mode === 'story') return '加持：不明（看是誰的設施）';
  const bs = [...new Set(Camp.activeBuffs(op))];
  return bs.length ? '加持：' + bs.map(b => `${FAMILY_BY_ID[b].buff}（${FAMILY_BY_ID[b].desc}）`).join('、') : '沒有家族加持';
}

function opStory(op) {
  if (!op) return '';
  if (op.kind === 'rest') return '先喘口氣。家族不會等妳們的。';
  if (op.kind === 'stop') return '情報指出家族正在準備反制。趕在它生效之前破壞掉。';
  if (op.kind === 'growth') return '有一批物資沒人看守……大概吧。';
  if (op.kind === 'facility') return Camp.C.mode === 'story' ? `目標：${op.name}。家族的某個成員在這裡做生意。` : STORY.facility(op.name);
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
    fam = Camp.rosterFamily().map(d => {
      const m = C.members.find(x => x.id === d.id);
      const left = m.alive && C.phase === 'field' ? (m.repels >= RULES.REPELS ? ' · 找到據點了' : ` · 擊退 ${m.repels}/${RULES.REPELS}`) + (m.boost ? ` · 強化 +${m.boost} 骰` : '') : '';
      return `<div class="fam ${m.alive ? '' : 'down'}"><b>${d.title}・${d.name}</b>${left}<br><small>${d.buff}：${d.desc}</small></div>`;
    }).join('');
    if (C.phase === 'field') fam += `<div class="fam note"><small>成員會在自己的設施偶爾現身，擊退 ${RULES.REPELS} 次就找到她的據點。打倒 ${Camp.manorAt()} 名成員後家族退守莊園，剩下的成員會和教母一起出現。</small></div>`;
    const cards = C.cards.map(c => c.revealed
      ? `<div class="fam card"><b>${COUNTERS[c.id].name}</b> · ${c.left} 回合後生效<br><small>${COUNTERS[c.id].desc}</small></div>`
      : `<div class="fam card hidden"><b>？？？</b> · ${c.left} 回合後生效<br><small>蓋著的反制。打贏設施作戰可以翻開</small></div>`).join('');
    const done = Object.entries(C.mods || {}).filter(([, n]) => n > 0).map(([k, n]) => `${COUNTERS[k].name}${n > 1 ? '×' + n : ''}`).join('、');
    fam = `<div class="fam threat"><b>家族威脅 ${C.threat}</b><br><small>每生效一張反制 +1，難度跟著上升${done ? `。已生效：${done}` : ''}</small></div>` + cards + fam;
    if (C.phase === 'manor') fam += `<div class="fam prod"><b>莊園增援產能 ${C.production}</b><br><small>決戰時的增援波數</small></div>`;
  } else {
    const counts = {};
    for (const b of C.buffs) counts[b] = (counts[b] || 0) + 1;
    fam = Object.keys(counts).length
      ? Object.entries(counts).map(([id, n]) => `<div class="fam"><b>${FAMILY_BY_ID[id].buff}${n > 1 ? ' ×' + n : ''}</b><br><small>${FAMILY_BY_ID[id].desc}</small></div>`).join('')
      : '<div class="fam"><small>敵人還沒有加持（每 2 張地圖多一種）</small></div>';
  }

  const head = C.mode === 'story'
    ? `作戰室 · 第 ${C.turn + 1} 回合${C.phase === 'manor' ? ' · 莊園階段' : ''}`
    : `無盡模式 · 已完成 ${C.done} 張地圖`;

  const opsHtml = C.phase === 'done' ? '' : ops.map((o, i) => `
    <button class="op ${i === st.op ? 'on' : ''} ${o.kind}" data-o="${i}">
      <b>${o.retry || (C.retry && C.mode !== 'story') ? '重打：' : ''}${o.name}</b><small>${opDesc(o)}${o.kind === 'rest' ? '' : ` · 難度 ${Camp.level(o)}（敵人 ${Camp.enemyEstimate(o)}${o.kind === 'manor' ? '，可能有成員在場' : o.kind === 'finale' ? `，增援 ${C.production} 波×3` : ''}）`}</small>
      <small class="opbuff">${opBuffs(o)}</small>
    </button>`).join('');

  const stashList = Object.entries(C.stash || {}).filter(([, n]) => n > 0);
  const girls = Camp.rosterGirls().map(d => {
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
      const cost = Camp.nodeCost(i);
      const can = i === g[t] && g.medals >= cost;
      const state = i < g[t] ? '（已學會）' : i === g[t] ? (g.medals >= cost ? '' : `（需要 ${cost} 枚獎章）`) : '（要先學前一格）';
      det = `<div class="det"><b>${t === 'gun' ? '槍法' : '魔法'} ${i + 1}</b> ${TREES[d.id][t][i]} <span class="dim">${state}</span>
        ${can ? `<button class="learn" data-g="${d.id}" data-t="${t}">學習（${cost} 枚獎章）</button>` : ''}</div>`;
    }
    const weap = d.weapons.map(w => WEAPONS[w].name).join(' ＋ ');
    const status = g.evac > 0
      ? `<span class="evac-tag">後送中：再 ${g.evac} 個回合</span>`
      : `<button class="dep ${dep ? 'on' : ''}" data-g="${d.id}">${dep ? '出擊 ✓' : '待命'}</button>`;
    return `<div class="gcard ${dep ? 'on' : ''} ${g.evac > 0 ? 'evac' : ''}">
      <div class="gh"><i class="dot" style="background:${hex(d.hair)}"></i><b>${d.name}</b><span class="t">${d.title}</span>
        <span class="hp">${'♥'.repeat(Math.ceil(g.hp / 3))}<span class="dim">${'♡'.repeat(d.hearts - Math.ceil(g.hp / 3))}</span> ${g.hp}/${d.maxHp}</span></div>
      <div class="gw">${weap}</div>
      <div class="gw dim">被動：${d.passive}<br>魔法：${d.active}</div>
      ${trees}${det}
      <div class="gf"><span class="medal">獎章 ${g.medals}</span>${status}</div>
      <div class="gf slots">道具 ${(g.slots || []).length}/${SLOTS}：${(g.slots || []).map(k => `<button class="unequip" data-g="${d.id}" data-k="${k}" title="${ITEMS[k].desc}（點一下放回倉庫）">${ITEMS[k].name} ✕</button>`).join(' ') || '<span class="dim">沒帶</span>'}
        ${(g.slots || []).length < SLOTS && stashList.length ? `<select class="equip" data-g="${d.id}"><option value="">＋ 帶上…</option>${stashList.filter(([k]) => Camp.fits(d.id, k)).map(([k, n]) => `<option value="${k}">${ITEMS[k].name}（${n}）</option>`).join('')}</select>` : ''}</div>
      ${Camp.maxed(g) && g.medals >= 1 ? `<div class="gf spend">成長樹已滿：${g.evac > 0 ? `<button class="spend" data-g="${d.id}" data-w="evac">1 枚：後送少 1 場</button>` : g.hp < d.maxHp ? `<button class="spend" data-g="${d.id}" data-w="heal">1 枚：回 1 顆心</button>` : '<span class="dim">獎章留著，受傷或後送時可以用</span>'}</div>` : ''}
    </div>`;
  }).join('');

  const avail = C.girls.filter(g => g.evac === 0).length;
  const need = Math.min(2, avail);
  const isRest = op && op.kind === 'rest';
  const ready = C.phase !== 'done' && op && (isRest || (C.deploy.length === need && need > 0));
  const mk = Camp.market();
  const loot = C.loot || 0;
  const marketHtml = C.phase === 'done' ? '' : `<div class="sec">黑市 · 戰利品 ${loot}</div><div class="market">
    ${mk.buy.map((o, i) => `<button class="mk-buy" data-i="${i}" ${o.sold || loot < o.price ? 'disabled' : ''} title="${ITEMS[o.item].desc}">${o.sold ? '（已買）' : ''}${ITEMS[o.item].name}：${o.price} 戰利品</button>`).join('')}
    ${mk.trades.map((t, i) => `<button class="mk-trade" data-i="${i}" ${t.done || (C.stash[t.give] || 0) < t.n ? 'disabled' : ''} title="${ITEMS[t.get].desc}">${t.done ? '（已換）' : ''}${ITEMS[t.give].name}×${t.n} → ${ITEMS[t.get].name}</button>`).join('')}
    ${stashList.length ? `<select class="mk-sell"><option value="">賣掉倉庫的東西…</option>${stashList.map(([k, n]) => `<option value="${k}">${ITEMS[k].name}（${n}）→ ${Camp.sellPrice(k)} 戰利品</option>`).join('')}</select>` : ''}
    <small class="dim">黑市每回合換貨；戰利品打贏 3、打輸 1，每打倒 2 名敵人再 +1。買賣不花回合</small></div>`;
  const stashHtml = stashList.length ? stashList.map(([k, n]) => `<span title="${ITEMS[k].desc}">${ITEMS[k].name}×${n}</span>`).join('、') : '<span class="dim">空的</span>';
  const notes = [...st.notes, ...st.recalled.map(id => `${GIRL_BY(id).name} 提前歸隊（至少 2/3 血）`)];

  const o = open(`
    <h1>${head}</h1>
    ${notes.length ? `<ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}
    ${C.phase === 'done' ? `<div class="story">${STORY.victory}</div><button id="hq-title">回到標題</button>` : ''}
    <div class="sec">${C.mode === 'story' ? '家族與反制' : '家族的加持'}</div><div class="fams">${fam}</div>
    ${opsHtml ? `<div class="sec">選擇作戰</div><div class="ops">${opsHtml}</div><div class="story small">${opStory(op)}</div>` : ''}
    <div class="sec">魔法少女（選 ${need} 人出擊；點數字看成長樹）</div>
    ${marketHtml}
    <div class="stash"><b>倉庫</b>：${stashHtml}<br><small class="dim">每人帶 ${SLOTS} 個道具或裝備。${Object.entries(ITEMS).map(([, it]) => `${it.name}：${it.desc}`).join('；')}</small></div>
    <div class="girls">${girls}</div>
    ${C.phase !== 'done' ? `<button id="hq-go" ${ready ? '' : 'disabled'}>${isRest ? '休整（不出擊）▶' : '出擊 ▶'}</button>` : ''}
    <p class="rec-btns dim">戰鬥統計（平衡用）：<button class="rec-all">匯出全部</button> <button class="rec-allcp">複製全部</button></p>
  `, 'hq');

  o.querySelectorAll('.op').forEach(b => b.onclick = () => { st.op = +b.dataset.o; render(); });
  o.querySelectorAll('.node').forEach(b => b.onclick = () => {
    const d = { g: b.dataset.g, t: b.dataset.t, i: +b.dataset.i };
    st.detail = st.detail && st.detail.g === d.g && st.detail.t === d.t && st.detail.i === d.i ? null : d;
    render();
  });
  o.querySelectorAll('.learn').forEach(b => b.onclick = () => { Camp.learn(b.dataset.g, b.dataset.t); render(); });
  o.querySelectorAll('.spend').forEach(b => b.onclick = () => { Camp.spend(b.dataset.g, b.dataset.w); render(); });
  o.querySelectorAll('.mk-buy').forEach(b => b.onclick = () => { Camp.buy(+b.dataset.i); render(); });
  o.querySelectorAll('.mk-trade').forEach(b => b.onclick = () => { Camp.trade(+b.dataset.i); render(); });
  o.querySelectorAll('.mk-sell').forEach(s => s.onchange = () => { if (s.value) Camp.sell(s.value); render(); });
  o.querySelectorAll('.unequip').forEach(b => b.onclick = () => { Camp.unequip(b.dataset.g, b.dataset.k); render(); });
  o.querySelectorAll('.equip').forEach(s => s.onchange = () => { if (s.value) Camp.equip(s.dataset.g, s.value); render(); });
  o.querySelectorAll('.dep').forEach(b => b.onclick = () => {
    const id = b.dataset.g;
    if (C.deploy.includes(id)) C.deploy = C.deploy.filter(x => x !== id);
    else { C.deploy.push(id); if (C.deploy.length > need) C.deploy.shift(); }
    render();
  });
  const go = o.querySelector('#hq-go');
  if (go) go.onclick = () => {
    if (!ready) return;
    if (isRest) { st.notes = Camp.restTurn(); st.op = 0; render(); return; }
    C.op = op;
    Camp.save();
    o.hidden = true;
    st.onGo();
  };
  const back = o.querySelector('#hq-title');
  if (back) back.onclick = () => location.reload();
}
