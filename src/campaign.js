// 戰役狀態（v2）：回合、家族的反制（黑地事件）、家族威脅、成員現身／擊退／據點、莊園、隊伍（後送/獎章/成長樹/道具）、存檔。
// 每個回合在作戰室做一件事：出擊（不論輸贏）或休整。回合結束時反制倒數 -1，倒數到 0 就生效、家族威脅 +1。
import { RULES, enemyCount, ITEMS, SLOTS, COUNTERS, MARKET, ROSTER } from './config.js';
import { GIRLS, GIRL, FAMILY, FAMILY_BY_ID, FACILITIES, GODMOTHER } from './girls.js';

const SAVE = 'mgx_save_v2', META = 'mgx_meta_v1';
export let C = null;

const freshGirls = ids => ids.map(id => ({ id, hp: GIRL[id].maxHp, gun: 0, magic: 0, medals: 0, evac: 0, slots: [] }));
export const girlState = id => C.girls.find(g => g.id === id);

// ---------- 名單：每場戰役開始時決定雙方的名單 ----------
// pick：手選的 id 陣列（不夠的隨機補滿）；沒給就從池子裡隨機挑。池子不比名單大時就是全員
export function pickRoster(pool, size, pick = []) {
  const ids = pool.map(x => x.id);
  const out = pick.filter(id => ids.includes(id)).slice(0, size);
  const rest = ids.filter(id => !out.includes(id)).sort(() => Math.random() - 0.5);
  while (out.length < size && rest.length) out.push(rest.shift());
  return ids.filter(id => out.includes(id)); // 照池子的順序
}
export const rosterGirls = () => C.girls.map(g => GIRLS.find(d => d.id === g.id));
export const rosterFamily = () => (C.family || FAMILY.map(m => m.id)).map(id => FAMILY_BY_ID[id]);
// 退守莊園的門檻：家族 4 人時打倒 3 人；人數更多時，剩 3 人就退守
export const manorAt = () => { const n = rosterFamily().length; return n <= 4 ? Math.min(RULES.MANOR_AT, n) : n - 3; };
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickOne = a => a[Math.floor(Math.random() * a.length)];
// 設施的外觀名稱：一開始不知道是誰的
const SITES = ['碼頭倉庫', '地下停車場', '廢棄工廠', '商業大樓', '老舊公寓', '貨運站', '夜市後巷', '舊車站'];

// opts = { girls:[id], family:[id] }：手選的名單（可以只選一部分，其餘隨機）
export function newStory(opts = {}) {
  const girls = pickRoster(GIRLS, ROSTER.girls, opts.girls);
  const family = pickRoster(FAMILY, ROSTER.family, opts.family);
  C = {
    mode: 'story', v: 2, turn: 0, threat: 0, phase: 'field', production: 3, manorRaids: 0, family,
    members: family.map(id => ({ id, alive: true, repels: 0, lastSeen: 0, boost: 0 })),
    girls: freshGirls(girls), deploy: [], op: null, board: null, cards: [], mods: {}, lost: null, lostGen: null,
    stash: { medkit: 2, flash: 1 }, loot: 0, market: null, bossOrder: [], done: 0, hv: 1,
  };
  fillCards();
  C.board = makeBoard();
  C.market = makeMarket();
  save();
}

export function newEndless() {
  const meta = loadMeta();
  const base = meta.girls || freshGirls(pickRoster(GIRLS, ROSTER.girls));
  C = {
    mode: 'endless', v: 2, done: 0, buffs: [], deploy: [], op: null, retry: false, nextOp: null, hv: 1, mods: {}, stash: { medkit: 2, flash: 1 },
    loot: 0, market: null, family: meta.family || FAMILY.map(m => m.id),
    girls: base.filter(g => GIRL[g.id]).map(g => ({ ...g, hp: GIRL[g.id].maxHp, evac: 0, medals: g.medals || 0, slots: [] })),
  };
  C.market = makeMarket();
  save();
}

export function load() {
  try { const s = localStorage.getItem(SAVE); if (s) { C = JSON.parse(s); return true; } } catch (e) { /* 沒有存檔 */ }
  return false;
}
export function hasSave() { try { return !!localStorage.getItem(SAVE); } catch (e) { return false; } }
export function save() { try { localStorage.setItem(SAVE, JSON.stringify(C)); } catch (e) { /* 私密模式等 */ } }
export function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) { /* */ } }
export function loadMeta() { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch (e) { return {}; } }
function saveMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) { /* */ } }
export const mod = k => (C && C.mods && C.mods[k]) || 0;

// ---------- 家族的反制 ----------
// 同時準備 RULES.CARDS 張；至少 1 張公開，其他蓋著（只知道倒數）。情報可以翻開蓋著的
function fillCards() {
  while (C.cards.length < RULES.CARDS) {
    const used = C.cards.map(c => c.id);
    const pool = Object.keys(COUNTERS).filter(k => !used.includes(k) && !(COUNTERS[k].once && mod(k))); // 疊兩次沒意義的不會再抽到
    // 一回合最多生效一張：倒數撞到別張就延後
    let left = rnd(RULES.CARD_TURNS[0], RULES.CARD_TURNS[1]);
    while (C.cards.some(c => Math.abs(c.left - left) < RULES.CARD_CLASH)) left += RULES.CARD_CLASH;
    C.cards.push({ id: pickOne(pool), left, revealed: false });
  }
  if (!C.cards.some(c => c.revealed)) C.cards.reduce((a, b) => (b.left < a.left ? b : a)).revealed = true;
}
export const revealedCards = () => C.cards.filter(c => c.revealed);

function applyCard(c, notes) {
  C.mods[c.id] = (C.mods[c.id] || 0) + 1;
  C.threat++;
  let extra = '';
  if (c.id === 'production') C.production++;
  if (c.id === 'member') {
    const alive = C.members.filter(m => m.alive);
    if (alive.length) { const m = pickOne(alive); m.boost++; extra = `（${FAMILY_BY_ID[m.id].name}）`; }
  }
  notes.push(`⚠ 家族的反制生效：${COUNTERS[c.id].name}${extra}——${COUNTERS[c.id].desc}。家族威脅 ${C.threat}`);
}

// 回合結束：反制倒數，生效的換新的，重排作戰清單
function endTurn(notes) {
  C.turn++;
  // 家族擴張：每 EXPAND_EVERY 回合威脅自動 +1
  if (C.turn % RULES.EXPAND_EVERY === 0) { C.threat++; notes.push(`⚠ 家族擴張了勢力：家族威脅 ${C.threat}（每 ${RULES.EXPAND_EVERY} 回合 +1）`); }
  for (const c of [...C.cards]) {
    c.left--;
    if (c.left <= 0) { applyCard(c, notes); C.cards.splice(C.cards.indexOf(c), 1); }
  }
  fillCards();
  C.board = makeBoard();
  C.market = makeMarket();
}

// 情報：翻開一張蓋著的反制
function intel(notes) {
  const hid = C.cards.filter(c => !c.revealed);
  if (!hid.length) return;
  const c = pickOne(hid);
  c.revealed = true;
  notes.push(`情報：家族正在準備「${COUNTERS[c.id].name}」（${c.left} 回合後生效）——${COUNTERS[c.id].desc}`);
}

// ---------- 作戰清單（每回合重排一次） ----------
export const opKey = o => o ? o.kind + ':' + o.name + ':' + (o.member || '') + ':' + (o.card || '') : '';

function makeBoard() {
  const out = [];
  if (C.lost) out.push({ ...C.lost, retry: true });
  const alive = C.members.filter(m => m.alive);
  if (C.phase === 'field') {
    // 據點：擊退夠多次的成員
    for (const m of alive) if (m.repels >= RULES.REPELS) {
      const d = FAMILY_BY_ID[m.id];
      const o = { kind: 'boss', member: m.id, name: `${d.title}・${d.name}的據點` };
      if (!out.some(x => opKey(x) === opKey(o))) out.push(o);
    }
    // 設施：1～2 個，不知道是誰的
    const sites = [...SITES].sort(() => Math.random() - 0.5);
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < n && alive.length; i++) out.push({ kind: 'facility', member: pickOne(alive).id, name: sites[i] });
  } else if (C.phase === 'manor') {
    if (C.manorRaids < 3) out.push({ kind: 'manor', name: `突襲莊園（第 ${C.manorRaids + 1} 次）` });
    out.push({ kind: 'finale', name: `決戰：${GODMOTHER.title}${GODMOTHER.name}` });
  }
  // 特殊作戰：阻止公開的反制，或物資作戰
  const rev = revealedCards();
  if (rev.length && Math.random() < 0.6) {
    const c = rev.reduce((a, b) => (b.left < a.left ? b : a));
    out.push({ kind: 'stop', card: c.id, name: `阻止反制：${COUNTERS[c.id].name}` });
  } else {
    const reward = [pickOne(Object.keys(ITEMS)), pickOne(['medkit', 'apround', 'flash', 'calm'])];
    out.push({ kind: 'growth', reward, name: `物資作戰（${reward.map(k => ITEMS[k].name).join('、')}）` });
  }
  out.push({ kind: 'rest', name: '休整' });
  return out;
}

// 這張地圖生效的家族加持（成員 id；無盡模式可重複）
export function activeBuffs(op = C.op) {
  if (C.mode === 'endless') return C.buffs;
  const alive = id => C.members.some(m => m.id === id && m.alive);
  if (op && (op.kind === 'facility' || op.kind === 'boss')) return op.member && alive(op.member) ? [op.member] : [];
  if (op && (op.kind === 'stop' || op.kind === 'growth' || op.kind === 'rest')) return [];
  return C.members.filter(m => m.alive).map(m => m.id);
}

export function enemyEstimate(op) {
  if (op.kind === 'rest') return 0;
  const book = activeBuffs(op).filter(b => b === 'book').length;
  const extra = { boss: 2, finale: 2 }[op.kind] || 0;
  return enemyCount(level(op)) + 2 * book + extra + mod('extra') + RULES.SQUAD_EXTRA;
}
// 作戰室顯示用：「人類 N＋使魔 M」（使魔加在人類之上）
export const enemyText = op => { const n = Math.max(4, enemyEstimate(op)); return `人類 ${n}＋使魔 ${Math.round(n * RULES.IMP_RATIO)}`; };

export function ops() {
  if (C.mode === 'endless') {
    if (C.retry && C.op) return [C.op];
    if (!C.nextOp) {
      const all = Object.values(FACILITIES).flat();
      C.nextOp = { kind: 'facility', member: null, name: all[Math.floor(Math.random() * all.length)] };
    }
    return [C.nextOp];
  }
  if (!C.board) C.board = makeBoard();
  return C.phase === 'done' ? [] : C.board;
}

// 頭目（據點）的出場順序：第一個比較弱
export function bossIndex(member) {
  const order = C.bossOrder || [];
  const i = order.indexOf(member);
  return i >= 0 ? i : order.length;
}
export function markBoss(member) {
  C.bossOrder = C.bossOrder || [];
  if (!C.bossOrder.includes(member)) { C.bossOrder.push(member); save(); }
}

// 難度跟著家族威脅走（每生效一張反制，威脅 +1、難度 +2）
export function level(op) {
  if (C.mode === 'endless') return 5 + C.done;
  if (op.kind === 'rest') return 0;
  const boss = op.kind === 'boss' ? (bossIndex(op.member) === 0 ? 0 : 1) : 0;
  return 2 + C.threat * 2 + boss + ({ manor: 2, finale: 2, stop: 2 }[op.kind] || 0); // 阻止作戰：家族嚴加看守
}

// 成員在自己的設施現身的機率
export function appearChance(member) {
  if (C.mode !== 'story') return 0;
  const m = C.members.find(x => x.id === member);
  if (!m || !m.alive) return 0;
  const [base, per, cap] = RULES.APPEAR;
  return Math.min(cap, base + per * Math.max(0, C.turn - m.lastSeen - 1));
}

// 無盡模式：可出擊的人不到 RULES.SQUAD 個時，後送最快回來的人提前歸隊。戰役模式改由休整處理
export function ensureAvailable() {
  if (C.mode !== 'endless') return [];
  return recallFastest();
}
function recallFastest() {
  const recalled = [];
  const ev = C.girls.filter(g => g.evac > 0).sort((a, b) => a.evac - b.evac);
  while (C.girls.filter(g => g.evac === 0).length < RULES.SQUAD && ev.length) {
    const g = ev.shift();
    g.evac = 0;
    g.hp = Math.max(g.hp, Math.ceil(GIRL[g.id].maxHp * RULES.EARLY_RETURN));
    recalled.push(g.id);
  }
  if (recalled.length) save();
  return recalled;
}

// ---------- 成長樹 ----------
export const nodeCost = i => (i >= 4 ? 2 : 1);
export function learn(id, tree) {
  const g = girlState(id);
  if (!g || g.evac > 0 || g[tree] >= 5 || g.medals < nodeCost(g[tree])) return false;
  g.medals -= nodeCost(g[tree]);
  g[tree]++;
  save();
  return true;
}
export const maxed = g => g.gun >= 5 && g.magic >= 5;
export function spend(id, what) {
  const g = girlState(id);
  if (!g || !maxed(g) || g.medals < 1) return false;
  if (what === 'heal') {
    if (g.evac > 0 || g.hp >= GIRL[id].maxHp) return false;
    g.hp = Math.min(GIRL[id].maxHp, g.hp + RULES.HEART_HP);
  } else if (what === 'evac') {
    if (g.evac <= 0) return false;
    g.evac--;
    if (g.evac === 0) g.hp = GIRL[id].maxHp;
  } else return false;
  g.medals--;
  save();
  return true;
}

// ---------- 道具與裝備（每人 SLOTS 格） ----------
// 有些裝備只能裝在特定武器上（瞄準鏡、紅點）
export const fits = (id, item) => !ITEMS[item] || !ITEMS[item].fits || !!(GIRL[id] && GIRL[id].weapons.some(w => ITEMS[item].fits.includes(w)));
export function equip(id, item) {
  const g = girlState(id);
  if (!g || !ITEMS[item] || !(C.stash[item] > 0) || !fits(id, item)) return false;
  g.slots = g.slots || [];
  if (g.slots.length >= SLOTS) return false;
  C.stash[item]--;
  g.slots.push(item);
  save();
  return true;
}
export function unequip(id, item) {
  const g = girlState(id);
  const i = g ? (g.slots || []).indexOf(item) : -1;
  if (i < 0) return false;
  g.slots.splice(i, 1);
  C.stash[item] = (C.stash[item] || 0) + 1;
  save();
  return true;
}
// 戰鬥中用掉消耗品
export function consume(id, item) {
  const g = girlState(id);
  const i = g ? (g.slots || []).indexOf(item) : -1;
  if (i >= 0) { g.slots.splice(i, 1); save(); }
}

// ---------- 黑市：用戰利品買、賣道具換戰利品、以物易物。每回合換貨 ----------
function makeMarket() {
  const keys = Object.keys(ITEMS);
  const mul = () => MARKET.DISCOUNT[0] + Math.random() * (MARKET.DISCOUNT[1] - MARKET.DISCOUNT[0]);
  const buy = [...keys].sort(() => Math.random() - 0.5).slice(0, MARKET.BUY)
    .map(item => ({ item, price: Math.max(1, Math.round(ITEMS[item].price * mul())) }));
  const trades = [];
  for (let i = 0; i < MARKET.TRADES; i++) {
    const get = keys[Math.floor(Math.random() * keys.length)];
    const give = keys.filter(k => k !== get)[Math.floor(Math.random() * (keys.length - 1))];
    // 價值接近：便宜的換貴的要多給幾個
    const n = Math.max(1, Math.round(ITEMS[get].price / ITEMS[give].price));
    trades.push({ give, n, get });
  }
  return { buy, trades };
}
export const sellPrice = item => Math.max(1, Math.floor(ITEMS[item].price * MARKET.SELL));
export function market() { if (!C.market) C.market = makeMarket(); return C.market; }
export function buy(i) {
  const o = market().buy[i];
  if (!o || o.sold || (C.loot || 0) < o.price) return false;
  C.loot -= o.price;
  o.sold = true;
  C.stash[o.item] = (C.stash[o.item] || 0) + 1;
  save();
  return true;
}
export function sell(item) {
  if (!ITEMS[item] || !(C.stash[item] > 0)) return false;
  C.stash[item]--;
  C.loot = (C.loot || 0) + sellPrice(item);
  save();
  return true;
}
export function trade(i) {
  const t = market().trades[i];
  if (!t || t.done || (C.stash[t.give] || 0) < t.n) return false;
  C.stash[t.give] -= t.n;
  C.stash[t.get] = (C.stash[t.get] || 0) + 1;
  t.done = true;
  save();
  return true;
}
function gainLoot(r, notes) {
  const n = (r.win ? MARKET.LOOT_WIN : MARKET.LOOT_LOSS) + Math.floor((r.kills || 0) / MARKET.LOOT_PER_KILLS);
  C.loot = (C.loot || 0) + n;
  notes.push(`戰利品 +${n}（共 ${C.loot}）：可以在黑市用`);
}

// ---------- 休整：不戰鬥，算一個回合 ----------
export function restTurn() {
  const notes = ['休整了一個回合'];
  for (const g of C.girls) {
    if (g.evac > 0) {
      g.evac--;
      if (g.evac === 0) { g.hp = GIRL[g.id].maxHp; notes.push(`${GIRL[g.id].name} 歸隊了`); }
      else g.hp = Math.min(GIRL[g.id].maxHp, g.hp + RULES.HEART_HP);
    } else if (g.hp < GIRL[g.id].maxHp) {
      g.hp = Math.min(GIRL[g.id].maxHp, g.hp + RULES.BENCH_HEAL);
      notes.push(`${GIRL[g.id].name} 休息 +1 心`);
    }
  }
  // 保底：可出擊的人不足 RULES.SQUAD 名時，最快回來的人提前歸隊
  for (const id of recallFastest()) notes.push(`${GIRL[id].name} 提前歸隊（至少 2/3 血）`);
  endTurn(notes);
  C.op = null;
  save();
  return notes;
}

// ---------- 任務結束 ----------
// r = { win, deployed:[id], hp:{id:hp}, downed:[id], killed:[memberId], repelled:[memberId], appeared:[memberId], bossPhase }
export function finish(r) {
  const notes = [];
  const nm = id => GIRL[id].name;
  for (const id of r.deployed) girlState(id).hp = r.hp[id];
  for (const id of r.downed) {
    const g = girlState(id);
    g.evac = RULES.EVAC_MISSIONS;
    g.hp = 0;
    notes.push(`${nm(id)} 倒下後送，${RULES.EVAC_MISSIONS} 個回合後歸隊`);
  }
  gainLoot(r, notes);
  if (C.mode !== 'story') return finishEndless(r, notes);

  const op = C.op;
  for (const mid of r.killed) {
    const m = C.members.find(x => x.id === mid);
    if (m && m.alive) {
      m.alive = false;
      const d = FAMILY_BY_ID[mid];
      notes.push(`${d.title}・${d.name} 被打倒了！「${d.buff}」失效`);
    }
  }
  for (const mid of r.appeared || []) { const m = C.members.find(x => x.id === mid); if (m) m.lastSeen = C.turn + 1; }
  for (const mid of r.repelled || []) {
    const m = C.members.find(x => x.id === mid);
    if (!m || !m.alive) continue;
    m.repels++;
    const d = FAMILY_BY_ID[mid];
    notes.push(m.repels >= RULES.REPELS ? `${d.name} 被擊退了 ${m.repels} 次：找到她的據點了！` : `${d.name} 被擊退了（${m.repels}/${RULES.REPELS}）`);
  }

  // 獎章：出擊的人打贏 1、打輸 0.5；沒出擊的人 0.5；打倒成員全員再 +1
  const bossDown = r.killed.length > 0;
  for (const g of C.girls) {
    g.medals = (g.medals || 0) + (r.deployed.includes(g.id) ? (r.win ? RULES.MEDAL_WIN : RULES.MEDAL_LOSS) : RULES.MEDAL_BENCH)
      + (bossDown ? RULES.MEDAL_BOSS : 0);
  }
  notes.push(`獎章：出擊的人 +${r.win ? RULES.MEDAL_WIN : RULES.MEDAL_LOSS}、沒出擊的人 +${RULES.MEDAL_BENCH}${bossDown ? `；打倒成員，全員再 +${RULES.MEDAL_BOSS}` : ''}`);

  const key = opKey(op);
  if (r.win) {
    if (C.lost && opKey(C.lost) === key) { C.lost = null; C.lostGen = null; }
    C.done++;
    if (op.kind === 'facility') {
      notes.push(`這是 ${FAMILY_BY_ID[op.member].name} 的設施`);
      intel(notes);
    } else if (op.kind === 'stop') {
      const i = C.cards.findIndex(c => c.id === op.card);
      if (i >= 0) { C.cards.splice(i, 1); notes.push(`阻止了家族的反制「${COUNTERS[op.card].name}」`); }
    } else if (op.kind === 'growth') {
      for (const k of op.reward) C.stash[k] = (C.stash[k] || 0) + 1;
      notes.push(`拿到物資：${op.reward.map(k => ITEMS[k].name).join('、')}`);
    } else if (op.kind === 'manor') {
      C.manorRaids++;
      C.production = Math.max(1, C.production - 1);
      notes.push(`莊園增援產能降到 ${C.production}`);
    } else if (op.kind === 'finale') {
      C.phase = 'done';
      const meta = loadMeta();
      meta.endless = true;
      meta.girls = C.girls.map(g => ({ id: g.id, gun: g.gun, magic: g.magic, medals: g.medals }));
      meta.family = C.family;
      saveMeta(meta);
    }
    if (op.kind === 'finale') C.finaleKeep = 0;
    if (op.kind === 'boss') C.bossKeep = null;
  } else if (op.kind !== 'stop' && op.kind !== 'growth') {
    // 輸了：這場留在清單上可以重打（同一張地圖），也可以先做別的事；時間照樣過去
    const { retry, ...keep } = op;
    C.lost = keep;
    C.lostGen = C.retryGen;
    if (op.kind === 'finale' && r.bossPhase > 1) { C.finaleKeep = 1; notes.push('教母的第 1 段已經打破，重打決戰時從第 2 段開始'); }
    if (op.kind === 'boss' && r.bossPhase > 1) { C.bossKeep = op.member; notes.push('她的第 1 段已經打破，重打據點時從第 2 段開始'); }
    notes.push(`「${op.name}」留在作戰清單上，可以重打（同一張地圖），也可以先做別的事`);
  }
  if (C.phase === 'field' && C.members.filter(m => !m.alive).length >= manorAt()) {
    C.phase = 'manor';
    if (C.lost && (C.lost.kind === 'facility' || C.lost.kind === 'boss')) { C.lost = null; C.lostGen = null; }
    notes.push('家族退守莊園！剩下的成員會在決戰時和教母一起出現');
  }
  rest(r, notes, r.win);
  if (C.phase !== 'done') endTurn(notes);
  C.op = null;
  save();
  return notes;
}

// 一場任務過去後的休養。win：上場沒倒下的人整頓回一顆心（只有打贏才有）
function rest(r, notes, win) {
  const nm = id => GIRL[id].name;
  for (const g of C.girls) {
    if (r.deployed.includes(g.id)) {
      if (win && !r.downed.includes(g.id) && g.hp < GIRL[g.id].maxHp) {
        g.hp = Math.min(GIRL[g.id].maxHp, g.hp + RULES.FIELD_HEAL);
        notes.push(`${nm(g.id)} 整頓 +1 心`);
      }
      continue;
    }
    if (g.evac > 0) {
      if (r.downed.includes(g.id)) continue;
      g.evac--;
      if (g.evac === 0) { g.hp = GIRL[g.id].maxHp; notes.push(`${nm(g.id)} 歸隊了`); }
      else g.hp = Math.min(GIRL[g.id].maxHp, g.hp + RULES.HEART_HP);
    } else if (g.hp < GIRL[g.id].maxHp) {
      g.hp = Math.min(GIRL[g.id].maxHp, g.hp + RULES.BENCH_HEAL);
      notes.push(`${nm(g.id)} 休息 +${RULES.BENCH_HEAL} HP`);
    }
  }
}

function finishEndless(r, notes) {
  for (const g of C.girls) g.medals = (g.medals || 0) + (r.deployed.includes(g.id) ? (r.win ? RULES.MEDAL_WIN : RULES.MEDAL_LOSS) : RULES.MEDAL_BENCH);
  if (!r.win) {
    C.retry = true;
    rest(r, notes, false);
    save();
    return notes;
  }
  C.retry = false;
  C.done++;
  rest(r, notes, true);
  if (C.done % 2 === 0) {
    const fam = rosterFamily();
    const id = fam[Math.floor(Math.random() * fam.length)].id;
    C.buffs.push(id);
    notes.push(`敵人得到新的加持：${FAMILY_BY_ID[id].buff}`);
  }
  if (Math.random() < 0.5) { const k = pickOne(Object.keys(ITEMS)); C.stash[k] = (C.stash[k] || 0) + 1; notes.push(`拿到物資：${ITEMS[k].name}`); }
  const meta = loadMeta();
  meta.best = Math.max(meta.best || 0, C.done);
  saveMeta(meta);
  C.nextOp = null;
  C.op = null;
  C.market = makeMarket();
  save();
  return notes;
}
