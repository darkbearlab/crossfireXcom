// 戰役狀態：家族成員、設施、莊園、隊伍（後送/獎章/成長樹）、存檔。
import { RULES, enemyCount } from './config.js';
import { GIRLS, GIRL, FAMILY, FAMILY_BY_ID, FACILITIES, GODMOTHER } from './girls.js';

const SAVE = 'mgx_save_v1', META = 'mgx_meta_v1';
export let C = null;

const freshGirls = () => GIRLS.map(g => ({ id: g.id, hp: g.maxHp, gun: 0, magic: 0, medals: 0, evac: 0 }));
export const girlState = id => C.girls.find(g => g.id === id);

export function newStory() {
  C = {
    mode: 'story', done: 0, phase: 'facilities', production: 3, manorRaids: 0,
    members: FAMILY.map(m => ({ id: m.id, alive: true, facilities: 2 })),
    girls: freshGirls(), deploy: [], op: null, retry: false,
  };
  save();
}

export function newEndless() {
  const meta = loadMeta();
  const base = meta.girls || freshGirls();
  C = {
    mode: 'endless', done: 0, buffs: [], deploy: [], op: null, retry: false, nextOp: null,
    girls: base.map(g => ({ ...g, hp: GIRL[g.id].maxHp, evac: 0, medals: g.medals || 0 })),
  };
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

// 這張地圖生效的家族加持（成員 id；無盡模式可重複）
// 莊園之前：成員的加持只在她自己的設施（和她現身的那一戰）生效。莊園裡：所有仍存活成員的加持都生效。
export function activeBuffs(op = C.op) {
  if (C.mode === 'endless') return C.buffs;
  const alive = id => C.members.some(m => m.id === id && m.alive);
  if (op && (op.kind === 'facility' || op.kind === 'boss')) return op.member && alive(op.member) ? [op.member] : [];
  return C.members.filter(m => m.alive).map(m => m.id);
}

// 這場作戰的敵人數（一般敵人 + 帳房加持 + 成員本人與護衛）
export function enemyEstimate(op) {
  const book = activeBuffs(op).filter(b => b === 'book').length;
  const extra = { boss: 2, finale: 2 }[op.kind] || 0;
  return enemyCount(level(op)) + 2 * book + extra;
}

// 可以選的作戰
export function ops() {
  if (C.retry && C.op) return [C.op];
  if (C.mode === 'endless') {
    if (!C.nextOp) {
      const all = Object.values(FACILITIES).flat();
      C.nextOp = { kind: 'facility', member: null, name: all[Math.floor(Math.random() * all.length)] };
    }
    return [C.nextOp];
  }
  const out = [];
  if (C.phase === 'facilities') {
    for (const m of C.members) {
      if (!m.alive) continue;
      const d = FAMILY_BY_ID[m.id];
      if (m.facilities > 0) out.push({ kind: 'facility', member: m.id, name: FACILITIES[m.id][2 - m.facilities] });
      else out.push({ kind: 'boss', member: m.id, name: `${d.title}・${d.name}現身` });
    }
  } else if (C.phase === 'manor') {
    if (C.manorRaids < 3) out.push({ kind: 'manor', name: `突襲莊園（第 ${C.manorRaids + 1} 次）` });
    out.push({ kind: 'finale', name: `決戰：${GODMOTHER.title}${GODMOTHER.name}` });
  }
  return out;
}

export function level(op) {
  if (C.mode === 'endless') return 5 + C.done;
  return 1 + C.done + ({ boss: 1, manor: 2, finale: 2 }[op.kind] || 0);
}

// 可出擊的人不到 2 個時，後送最快回來的人提前歸隊（半血）
export function ensureAvailable() {
  const recalled = [];
  const ev = C.girls.filter(g => g.evac > 0).sort((a, b) => a.evac - b.evac);
  while (C.girls.filter(g => g.evac === 0).length < 2 && ev.length) {
    const g = ev.shift();
    g.evac = 0;
    g.hp = Math.ceil(GIRL[g.id].maxHp / 2);
    recalled.push(g.id);
  }
  if (recalled.length) save();
  return recalled;
}

export function learn(id, tree) {
  const g = girlState(id);
  if (!g || g.medals <= 0 || g[tree] >= 5) return false;
  g[tree]++;
  g.medals--;
  save();
  return true;
}

// 任務結束。r = { win, deployed:[id], hp:{id:hp}, downed:[id], killed:[memberId] }。回傳結算訊息
export function finish(r) {
  const notes = [];
  const nm = id => GIRL[id].name;
  for (const id of r.deployed) girlState(id).hp = r.hp[id];
  for (const id of r.downed) {
    const g = girlState(id);
    g.evac = RULES.EVAC_MISSIONS;
    g.hp = 0;
    notes.push(`${nm(id)} 倒下後送，完成 ${RULES.EVAC_MISSIONS} 個任務後歸隊`);
  }
  if (C.mode === 'story') {
    for (const mid of r.killed) {
      const m = C.members.find(x => x.id === mid);
      if (m && m.alive) {
        m.alive = false;
        const d = FAMILY_BY_ID[mid];
        notes.push(`${d.title}・${d.name} 被打倒了！「${d.buff}」失效`);
      }
    }
  }
  if (!r.win) {
    C.retry = true;
    save();
    return notes;
  }

  C.retry = false;
  C.done++;
  for (const g of C.girls) g.medals++;
  notes.push('每個人都拿到 1 枚獎章');
  for (const g of C.girls) {
    if (r.deployed.includes(g.id)) continue;
    if (g.evac > 0) {
      if (r.downed.includes(g.id)) continue;
      g.evac--;
      if (g.evac === 0) { g.hp = GIRL[g.id].maxHp; notes.push(`${nm(g.id)} 歸隊了`); }
    } else if (g.hp < GIRL[g.id].maxHp) {
      g.hp = Math.min(GIRL[g.id].maxHp, g.hp + RULES.BENCH_HEAL);
      notes.push(`${nm(g.id)} 休息 +${RULES.BENCH_HEAL} HP`);
    }
  }

  const op = C.op;
  if (C.mode === 'story') {
    if (op.kind === 'facility') {
      const m = C.members.find(x => x.id === op.member);
      if (m.alive && m.facilities > 0) {
        m.facilities--;
        if (m.facilities === 0) notes.push(`${FAMILY_BY_ID[m.id].name} 坐不住了，準備現身`);
      }
    }
    if (op.kind === 'manor') {
      C.manorRaids++;
      C.production = Math.max(0, C.production - 1);
      notes.push(`莊園增援產能降到 ${C.production}`);
    }
    if (op.kind === 'finale') {
      C.phase = 'done';
      const meta = loadMeta();
      meta.endless = true;
      meta.girls = C.girls.map(g => ({ id: g.id, gun: g.gun, magic: g.magic, medals: g.medals }));
      saveMeta(meta);
    }
    if (C.phase === 'facilities' && C.members.filter(m => !m.alive).length >= 3) {
      C.phase = 'manor';
      notes.push('家族退守莊園！');
    }
  } else {
    if (C.done % 2 === 0) {
      const id = FAMILY[Math.floor(Math.random() * FAMILY.length)].id;
      C.buffs.push(id);
      notes.push(`敵人得到新的加持：${FAMILY_BY_ID[id].buff}`);
    }
    const meta = loadMeta();
    meta.best = Math.max(meta.best || 0, C.done);
    saveMeta(meta);
    C.nextOp = null;
  }
  C.op = null;
  save();
  return notes;
}
