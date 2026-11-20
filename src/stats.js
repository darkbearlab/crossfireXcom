// 戰鬥統計與紀錄匯出（平衡用）。
// 每張地圖一份紀錄：完整戰鬥紀錄 + 主動權 / 射擊 / 壓制等統計。
// 存在獨立的 localStorage 鍵，不碰存檔。最近 50 場的摘要、最近 5 場的完整紀錄。
const KEY = 'mxc_stats_v1';
const KEEP_SUM = 50, KEEP_FULL = 5;

let M = null;      // 這張地圖的紀錄
let kind = null;   // 我方下一個行動的種類（resolvePlayerAction 前標記）

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
const avg = (a, b) => b ? (a / b).toFixed(2) : '—';

export function begin(meta) {
  M = {
    meta, start: now(), end: null, result: null, log: [], inits: [], cur: null,
    shots: {}, supGirl: 0, supEnemy: 0, rally: { n: 0, fail: 0 }, eRally: 0,
    dmgGirl: 0, dmgEnemy: 0, blocked: 0, kills: 0, fled: 0, downed: 0,
    heartLines: 0, grabSaves: 0, saveKinds: {}, girlHits: 0, hesitate: 0, impulses: 0,
  };
  kind = null;
}
export const active = () => !!M;

// ui.log 的每一行都會進來
export function log(text, cls) {
  if (!M) return;
  const c = M.cur;
  M.log.push(`${c ? `#${c.no}${c.side === 'player' ? '我' : '敵'}` : '--'}\t${cls || ''}\t${text}`);
}

export function initiative(side, no, girls) {
  if (!M) return;
  M.cur = {
    side, no, acts: [], hesitated: false, impulses: 0, hitsOnGirls: 0,
    girlsSup: girls.filter(g => g.suppressed).length, girls: girls.length,
  };
  M.inits.push(M.cur);
  persistCur();
}

export function tag(k) { kind = k; }

// 我方一個行動的結果（已套用心線、變身之後）
export function playerAct(ok, saved = '') {
  if (!M || !M.cur) return;
  M.cur.acts.push({ k: kind || '其他', ok, saved });
  if (saved) { M.grabSaves++; M.saveKinds[saved] = (M.saveKinds[saved] || 0) + 1; }
  kind = null;
}

export function enemyAct(k, ok) {
  if (!M || !M.cur) return;
  M.cur.acts.push({ k, ok });
}

export function shot(team, reaction, chance, hit) {
  if (!M) return;
  const key = `${team === 'player' ? '我方' : '敵方'}${reaction ? '反應' : '主動'}`;
  const s = M.shots[key] || (M.shots[key] = { n: 0, hit: 0, sum: 0 });
  s.n++; s.sum += chance; if (hit) s.hit++;
}

export function damage(t, dmg, cut) {
  if (!M) return;
  if (t.team === 'player') { M.dmgGirl += dmg; M.blocked += cut; M.girlHits++; if (M.cur && M.cur.side === 'enemy') M.cur.hitsOnGirls++; }
  else M.dmgEnemy += dmg;
}

export function count(what) {
  if (!M) return;
  if (what in M) M[what]++;
  if (what === 'hesitate' && M.cur) M.cur.hesitated = true;
  if (what === 'impulses' && M.cur) M.cur.impulses++;
}

export function suppressed(t) {
  if (!M) return;
  if (t.team === 'player') M.supGirl++; else M.supEnemy++;
}

export function rally(team, ok) {
  if (!M) return;
  if (team !== 'player') { M.eRally++; return; }
  M.rally.n++; if (!ok) M.rally.fail++;
}

// ---- 摘要 ----
function summary(m) {
  const pi = m.inits.filter(i => i.side === 'player');
  const ei = m.inits.filter(i => i.side === 'enemy');
  const okRun = i => { let n = 0; for (const a of i.acts) { if (!a.ok) break; n++; } return n; };
  const played = pi.filter(i => i.acts.length); // 沒做任何行動的（例如戰鬥直接結束）不算
  const pOk = played.map(okRun);
  const zero = pOk.filter(n => n === 0).length;
  let drought = 0, run = 0;
  for (const n of pOk) { run = n === 0 ? run + 1 : 0; drought = Math.max(drought, run); }
  const eActs = ei.map(i => i.acts.length);
  const startSup = pi.filter(i => i.girlsSup > 0).length;
  const allSup = pi.filter(i => i.girls && i.girlsSup === i.girls).length;
  const kinds = {};
  for (const i of pi) for (const a of i.acts) {
    const k = kinds[a.k] || (kinds[a.k] = { n: 0, fail: 0 });
    k.n++; if (!a.ok) k.fail++;
  }
  return {
    result: m.result, meta: m.meta, start: m.start,
    inits: m.inits.length, pInits: pi.length, eInits: ei.length,
    pActsAvg: avg(pOk.reduce((a, b) => a + b, 0), played.length),
    pZero: zero, pZeroPct: pct(zero, played.length), drought,
    eActsAvg: avg(eActs.reduce((a, b) => a + b, 0), ei.length), eActsMax: Math.max(0, ...eActs),
    eHitsAvg: avg(ei.reduce((a, i) => a + i.hitsOnGirls, 0), ei.length),
    startSupPct: pct(startSup, pi.length), allSupPct: pct(allSup, pi.length),
    shots: Object.fromEntries(Object.entries(m.shots).map(([k, s]) => [k, `${s.hit}/${s.n} 中（${pct(s.hit, s.n)}，平均命中率 ${s.n ? Math.round(s.sum / s.n) : '—'}%）`])),
    kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, `${v.n} 次，失敗 ${v.fail}（${pct(v.fail, v.n)}）`])),
    supGirl: m.supGirl, supEnemy: m.supEnemy,
    rally: `${m.rally.n} 次，被打斷 ${m.rally.fail}`, eRally: m.eRally,
    dmgGirl: m.dmgGirl, blocked: m.blocked, dmgEnemy: m.dmgEnemy,
    kills: m.kills, fled: m.fled, downed: m.downed,
    heartLines: m.heartLines, grabSaves: m.grabSaves, saveKinds: m.saveKinds || {}, girlHits: m.girlHits || 0, hesitate: m.hesitate, impulses: m.impulses,
  };
}

function summaryText(s) {
  const L = [
    `任務：${s.meta.op}（${s.meta.map}，難度 ${s.meta.level}）  結果：${s.result || '進行中'}  開始：${s.start}`,
    `出擊：${s.meta.girls}　敵人：${s.meta.enemies}`,
    `主動權：共 ${s.inits} 次（我方 ${s.pInits}／敵方 ${s.eInits}；易手 ${Math.max(0, s.inits - 1)} 次）`,
    `我方每次主動權成功行動：平均 ${s.pActsAvg}；第一個行動就失敗 ${s.pZero} 次（${s.pZeroPct}）；最長連續「拿到就失敗」${s.drought} 次`,
    `我方拿到主動權時：有人被壓制 ${s.startSupPct}；全員被壓制 ${s.allSupPct}`,
    `敵方每次主動權：平均行動 ${s.eActsAvg}、最多 ${s.eActsMax}；平均命中少女 ${s.eHitsAvg} 次（只算敵方主動權內）。整場少女被命中 ${s.girlHits} 次（含我方行動時的反應射擊）`,
    `射擊：` + (Object.entries(s.shots).map(([k, v]) => `${k} ${v}`).join('；') || '—'),
    `我方行動種類：` + (Object.entries(s.kinds).map(([k, v]) => `${k} ${v}`).join('；') || '—'),
    `壓制：少女被壓制 ${s.supGirl} 次、敵人被壓制 ${s.supEnemy} 次；我方起身 ${s.rally}；敵方起身 ${s.eRally} 次`,
    `傷害：少女受到 ${s.dmgGirl}（愛心擋下 ${s.blocked}）、敵人受到 ${s.dmgEnemy}`,
    `打倒 ${s.kills}、逃跑 ${s.fled}、少女倒下 ${s.downed}`,
    `心線觸發 ${s.heartLines} 次；失敗行動被救回 ${s.grabSaves} 次（${Object.entries(s.saveKinds || {}).map(([k, v]) => `${k} ${v}`).join('、') || '—'}）；敵人亂了陣腳 ${s.hesitate} 次、衝動 ${s.impulses} 次`,
  ];
  return L.join('\n');
}

function fullText(m) {
  const s = summary(m);
  const inits = m.inits.map(i => `#${i.no} ${i.side === 'player' ? '我方' : '敵方'}：` +
    (i.acts.map(a => `${a.k}${a.ok ? '✓' : '✗'}${a.saved ? `(${a.saved})` : ''}`).join(' ') || '（無行動）') +
    (i.hesitated ? ' 亂了陣腳' : '') + (i.impulses ? ` 衝動×${i.impulses}` : '') +
    (i.side === 'player' && i.girlsSup ? ` [開始時 ${i.girlsSup}/${i.girls} 被壓制]` : '') +
    (i.hitsOnGirls ? ` [命中少女 ${i.hitsOnGirls}]` : '')).join('\n');
  return `==== 戰鬥紀錄 ====\n${summaryText(s)}\n\n---- 主動權流程 ----\n${inits}\n\n---- 完整紀錄（主動權編號 / 類別 / 內容）----\n${m.log.join('\n')}\n`;
}

// ---- 保存 ----
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || { sums: [], full: [] }; } catch (e) { return { sums: [], full: [] }; } }
function store(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* 空間不足或私密模式 */ } }
function persistCur() {
  // 中途關掉也不會全丟：目前這場的完整紀錄另存一份
  try { localStorage.setItem(KEY + '_cur', fullText(M)); } catch (e) { /* */ }
}

export function end(result) {
  if (!M) return;
  M.result = result;
  M.end = now();
  const d = load();
  d.sums.push(summary(M));
  d.full.push(fullText(M));
  d.sums = d.sums.slice(-KEEP_SUM);
  d.full = d.full.slice(-KEEP_FULL);
  store(d);
  try { localStorage.removeItem(KEY + '_cur'); } catch (e) { /* */ }
}

export function currentText() {
  if (M) return fullText(M);
  try { return localStorage.getItem(KEY + '_cur') || ''; } catch (e) { return ''; }
}

export function allText() {
  const d = load();
  const cols = ['start', 'result', 'op', 'level', 'inits', 'pInits', 'eInits', 'pActsAvg', 'pZeroPct', 'drought', 'eActsAvg', 'eActsMax', 'eHitsAvg', 'startSupPct', 'allSupPct', 'supGirl', 'supEnemy', 'dmgGirl', 'blocked', 'dmgEnemy', 'kills', 'downed', 'heartLines', 'hesitate', 'impulses'];
  const row = s => cols.map(c => c === 'op' ? s.meta.op : c === 'level' ? s.meta.level : s[c]).join('\t');
  const table = [cols.join('\t'), ...d.sums.map(row)].join('\n');
  const cur = currentText();
  return `==== 魔法少女 vs 魔女黑手黨：戰鬥統計（最近 ${d.sums.length} 場）====\n匯出時間：${now()}\n\n` +
    `---- 每場摘要（Tab 分隔，可貼進試算表）----\n${table}\n\n` +
    d.sums.map(s => summaryText(s)).join('\n\n') +
    `\n\n==== 最近 ${d.full.length} 場完整紀錄 ====\n\n` + d.full.join('\n\n') +
    (cur && !d.full.includes(cur) ? `\n\n==== 進行中／未結束的一場 ====\n\n${cur}` : '');
}

export function hasAny() { return load().sums.length > 0 || !!currentText(); }

// ---- 匯出 ----
export function download(name, text) {
  const b = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 舊瀏覽器 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* */ }
  ta.remove();
  return ok;
}

const stamp = () => now().replace(/[: ]/g, '').replace(/-/g, '');
export const exportCurrent = () => download(`戰鬥紀錄_${stamp()}.txt`, currentText() || '（還沒有紀錄）');
export const exportAll = () => download(`戰鬥統計_${stamp()}.txt`, allText());
