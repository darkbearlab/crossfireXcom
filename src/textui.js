// 純文字介面：讓代理（或人）不用看 3D 畫面就能測試。
// 用法（瀏覽器主控台或自動化工具）：
//   await TXT.do('help')        // 指令列表
//   await TXT.do('look')        // 目前狀態（地圖、單位、可以做的事）
//   await TXT.do('move 5 3')    // 執行指令，等到輪到我方或戰鬥結束，回傳期間的戰鬥紀錄與狀態
// 網址加上 ?text 會在畫面右側顯示文字面板（含指令輸入框）。
// 第一次呼叫 TXT.do（或網址有 ?text）就開啟「快速模式」：動畫瞬間完成，不受畫面是否顯示影響。
// 一般玩家沒用到 TXT 時，動畫照常。
import { RULES, T, WEAPONS } from './config.js';
import { GIRL, TREES } from './girls.js';
import * as UI from './ui.js';
import * as Rec from './stats.js';

let G = null;           // main.js 提供的內部函式
let fastSet = false;    // 快速模式是否已經設定過
const logBuf = [];      // 所有戰鬥紀錄
const GIRL_KEY = { akane: 'A', hikari: 'H', yukino: 'Y', momo: 'M' };

export function init(api) {
  G = api;
  UI.addLogListener((text, cls) => logBuf.push(cls ? `[${cls}] ${text}` : text));
  window.TXT = { do: run, look: () => look(), help: () => HELP, fast: on => { fastSet = true; G.setInstant(on !== false); } };
  if (/[?&]text\b/.test(location.search)) { G.setInstant(true); fastSet = true; panel(); }
}

const HELP = `指令（座標是 x z；角色用代號 A 朱音 / H 光 / Y 雪乃 / M 小桃；敵人用地圖上的編號）
  look [all]          目前狀態；all＝連看不到的敵人也顯示（除錯用）
  title               回到標題畫面
  new | endless       開新戰役 / 無盡模式（會覆蓋這個網站的存檔）
  continue            讀取存檔
  ok                  按下畫面上的主要按鈕（劇情、結算畫面）
  hq                  作戰室：列出作戰與少女
  op N                選第 N 個作戰（從 1 開始）
  squad A H           選出擊的兩人
  learn A gun|magic   用獎章學下一格成長樹
  go                  出擊
  deploy A x z        部署階段：把角色擺到 (x,z)
  start               部署完成，開始行動
  sel A               選角色
  moves [A] [n]       列出可移動的格子（含反應射擊風險）
  move [A] x z        移動
  targets [A]         列出可以射擊的目標與機率
  shoot [A] N [triple] 射擊編號 N 的敵人（triple＝小桃三管齊發）
  rally [A]           起身（解除受阻／壓制）
  reload [A] [yes] | swap [A] [yes]   換彈／換槍；會交出主動權的要加 yes 確認
  plant [A] | pass
  magic [A] [x z]     魔法：不給座標＝列出可用位置；光的變身不用座標
  log [n]             最近 n 行戰鬥紀錄
  stats               這場的統計
  fast on|off         快速模式（動畫瞬間完成；預設開）`;

// ---------- 狀態 ----------
const gKey = u => GIRL_KEY[u.girl] || '?';
// 敵人編號（e.tag）在生成時就固定，戰鬥紀錄裡的名字也帶著它（例如「槍手3」）
const eKey = (S, e) => e.tag || '?';
const pips = u => '●'.repeat(Math.min(2, u.stress || 0)) + '○'.repeat(2 - Math.min(2, u.stress || 0));
const status = u => u.suppressed ? '壓制' : u.pinned ? '受阻' : '正常';

function findGirl(S, k) {
  if (!k) return S.selected && S.selected.team === 'player' ? S.selected : null;
  k = k.toUpperCase();
  return S.units.find(u => u.team === 'player' && (gKey(u) === k || u.name === k)) || null;
}
function findEnemy(S, k) {
  k = String(k).toLowerCase();
  return S.units.find(u => u.team === 'enemy' && String(u.tag).toLowerCase() === k) || null;
}

function mapText(S, all) {
  const m = S.map, lines = [];
  const at = new Map();
  for (const u of S.units) {
    if (!u.alive || u.flying) continue; // 烏鴉列在敵人清單，不畫在地圖上
    if (u.team === 'enemy' && !all && !u.mesh.visible) continue;
    at.set(G.key(u.x, u.z), u.team === 'player' ? gKey(u) : eKey(S, u));
  }
  const exits = new Set((S.mission.exits || []).map(e => G.key(e.x, e.z)));
  const obj = S.mission.objective;
  const crates = new Set((S.crates || []).map(c => G.key(c.x, c.z)));
  const ice = new Set((S.ice || []).map(i => G.key(i.x, i.z)));
  const deploy = S.side === 'deploy' && S.deployZone ? new Set(S.deployZone.map(p => G.key(p.x, p.z))) : null;
  let head = '    ';
  for (let x = 0; x < m.w; x++) head += x % 10;
  lines.push(head);
  for (let z = 0; z < m.h; z++) {
    let row = String(z).padStart(3) + ' ';
    for (let x = 0; x < m.w; x++) {
      const k = G.key(x, z);
      let c = '.';
      const t = m.get(x, z);
      if (t === T.FULL) c = '#';
      else if (t === T.HALF) c = '+';
      else if (m.isConceal(x, z)) c = ',';
      if (ice.has(k)) c = 'I';
      if (S.curse && S.curse.has(k)) c = '*';
      if (crates.has(k)) c = 'c';
      if (exits.has(k)) c = 'X';
      if (obj && obj.x === x && obj.z === z) c = 'O';
      if (deploy && deploy.has(k) && c === '.') c = '_';
      if (at.has(k)) c = at.get(k);
      row += c;
    }
    lines.push(row);
  }
  lines.push('圖例：# 全掩體  + 半掩體  , 隱蔽區  . 空地  X 撤離點  O 終端  c 補給箱  I 冰塊  * 詛咒格' + (deploy ? '  _ 部署區' : '') +
    '  A/H/Y/M 少女  其他數字/小寫字母＝敵人編號（不用 c i l o x）');
  return lines.join('\n');
}

function girlLine(S, u) {
  if (!u.alive) return `${gKey(u)} ${u.name}：倒下後送`;
  const w = u.weapons[u.wi];
  const hearts = Math.ceil(Math.max(0, u.hp) / u.heartHp), maxH = Math.ceil(u.maxHp / u.heartHp);
  const mi = G.magicInfo(u);
  const flags = [u.crowLocked && '被烏鴉纏住（隊友朝她開槍打掉烏鴉，或打中稻草人）', u.locked && '被人偶纏住（這次主動權不能再行動）', u.firedOut && '這次主動權不能再開槍', u.transformed && '變身中', u.raised && '冰上', u.dodge && '閃避×' + u.dodge,
    S.selected === u && '◀ 選取中'].filter(Boolean);
  const ri = G.reloadInfo(u);
  return `${gKey(u)} ${u.name} (${u.x},${u.z})  心 ${hearts}/${maxH}（${u.hp}/${u.maxHp}）${u.lineUsed ? ' 心線：已用或沒有' : ` 心線：掉到 ${u.lineHp / u.heartHp} 心時`}  累積 ${pips(u)} ${status(u)}` +
    `\n    ${w.name} ${w.ammo}/${w.mag}${isFinite(w.reserve) ? ` 備 ${w.reserve}` : ''}${ri && ri.gives ? '（換彈會交出主動權）' : ''}` +
    (u.weapons.length > 1 ? `（另一把：${u.weapons[1 - u.wi].name} ${u.weapons[1 - u.wi].ammo}/${u.weapons[1 - u.wi].mag}）` : '') +
    (mi ? `  魔法：${mi.label}${mi.usable ? '' : '（' + (mi.why || '不可用') + '）'}` : '') + (flags.length ? '  ' + flags.join('、') : '');
}

function enemyLine(S, e, all) {
  const seen = e.mesh.visible;
  if (!e.alive) return e.summon ? null : `${eKey(S, e)} ${e.name}：${e.fled ? '逃走' : '倒下'}`; // 烏鴉離場不算倒下
  if (!seen && !all) return null;
  return `${eKey(S, e)} ${e.name} (${e.x},${e.z})  生命 ${e.hp}/${e.maxHp}  累積 ${pips(e)} ${status(e)}  ${e.alerted ? '警戒' : '未察覺'}` +
    (e.noGun ? '  不開槍' : `  ${e.dice} 骰${e.dieMod ? `(${e.dieMod > 0 ? '+' : ''}${e.dieMod}%)` : ''}`) +
    (e.act ? `  啟動 ${G.actChance(e)}%` : e.boss ? `  頭目第 ${e.phase} 段` : '') +
    (e.impulse ? `  衝動:${e.impulse}` : '') + (e.firedOut ? '  ✕不能再開槍' : '') +
    (e.kind === 'doll' ? `  不會受阻/壓制、每中一顆受 1 傷、移動 ${e.moveRange} 射程 ${e.range}、不反應射擊；攻擊它沒打倒的人這次主動權不能再行動` : '') +
    (e.kind === 'scarecrow' ? `  不會動/不開槍/不會受阻壓制；身上烏鴉 ${e.crows}/${e.crowMax}${e.flock ? '（飛出中）' : e.crows < e.crowMax ? `（恢復 ${e.regen}/4）` : ''}；打中它烏鴉就傳送回去` : '') +
    (e.kind === 'crows' ? `  烏鴉 ${e.hp} 隻，${e.attached ? '纏在 ' + e.attached.name + ' 身上' : '在空中飛向 ' + (e.target ? e.target.name : '?')}；沒有掩體，每中一顆打掉一隻` : '') + (seen ? '' : '  （看不到）');
}

function targetsText(S, u) {
  const ts = G.visibleTargets(u).filter(t => t.unit.team === 'enemy');
  if (!ts.length) return '  （沒有視線內的目標）';
  if (u.weapons[u.wi].ammo <= 0) return `  （彈匣空了：reload 換彈，或 swap 換槍；看得到 ${ts.map(t => eKey(S, t.unit)).join(' ')}）`;
  if (u.firedOut) return '  （這次主動權不能再開槍）';
  return ts.map(t => {
    const o = t.odds;
    const ef = t.unit.armor ? UI.effHit(o, t.unit.armor) : 0;
    const armor = t.unit.armor ? `，裝甲 ${t.unit.armor}：實際生效 ${ef}%${ef ? '' : '（不可能有效，開不了）'}` : '';
    const lock = t.unit.lockOnHit ? '，⛓沒打倒的話這次主動權不能再行動' : '';
    return `  ${eKey(S, t.unit)} ${t.unit.name}：${o.dice} 骰 × ${o.die}% → 至少中一顆 ${o.hit}%，平均中 ${(o.dice * o.die / 100).toFixed(1)}${armor}${lock}` +
      `  ${UI.coverName(o)}  距離 ${o.dist.toFixed(1)}${o.sweet ? ' 甜蜜距離' : ''}`;
  }).join('\n');
}

// recent = 附上最近紀錄（指令輸出已經列出這次的新紀錄時不重複附）
function look(all = false, recent = true) {
  const S = G.S;
  const ov = document.getElementById('overlay');
  if (ov && !ov.hidden) {
    const txt = ov.innerText.replace(/\n{2,}/g, '\n').trim();
    return `【畫面】\n${txt.slice(0, 3000)}\n（用 ok / hq / op / go 等指令操作）`;
  }
  if (!S.map) return '（還沒有地圖）';
  const out = [];
  const side = { player: '我方', enemy: '敵方', deploy: '部署中' }[S.side] || S.side;
  out.push(`== ${S.opName || ''}：${S.theme ? S.theme.name : ''}  主動權：${side}（第 ${S.initNo} 次）${S.busy ? '  處理中…' : ''}${S.gameOver ? '  戰鬥結束' : ''}`);
  out.push(UI.missionText(S.mission) + (S.mission.objective ? (S.mission.objective.planted ? '（炸藥已安裝，撤回左側 X）' : `（終端 O 在 ${S.mission.objective.x},${S.mission.objective.z}）`) : ''));
  out.push(mapText(S, all));
  out.push('-- 魔法少女');
  for (const u of S.units.filter(u => u.team === 'player')) out.push(girlLine(S, u));
  out.push('-- 敵人');
  const es = S.units.filter(u => u.team === 'enemy').map(e => enemyLine(S, e, all)).filter(Boolean);
  out.push(es.length ? es.join('\n') : '  （看不到敵人）');
  if (!all && S.side !== 'deploy' && S.units.some(u => u.team === 'enemy' && u.alive && !u.mesh.visible)) out.push('  （還有敵人的氣息）');
  const u = S.selected;
  if (S.side === 'player' && u && u.alive && u.team === 'player') {
    out.push(`-- ${u.name} 可以射擊的目標`);
    out.push(targetsText(S, u));
    const mv = G.moveOptions(u);
    out.push(`-- ${u.name} 可移動 ${u.suppressed || u.pinned ? 0 : mv.size} 格（用 moves 列出）`);
  }
  if (recent) out.push('-- 最近紀錄\n' + logBuf.slice(-8).join('\n'));
  return out.join('\n');
}

function movesText(S, u, n = 30) {
  if (!u) return '先選角色';
  if (u.suppressed || u.pinned) return `${u.name} ${status(u)}中，不能移動（先 rally）`;
  const list = [...G.moveOptions(u).values()].map(mv => {
    const plan = G.planReactions(u, G.pathCells(u, mv), true);
    const risk = Math.round(G.moveRisk(u, plan) * 100);
    return { mv, risk, d: Math.hypot(mv.x - u.x, mv.z - u.z), cover: G.coverSides(S.map, mv).length };
  });
  list.sort((a, b) => a.risk - b.risk || b.mv.x - a.mv.x);
  return `${u.name} 可移動 ${list.length} 格（依風險排序，前 ${Math.min(n, list.length)} 個；風險＝路上被反應射擊打中的機率，只算看得到的敵人）\n` +
    list.slice(0, n).map(o => `  (${o.mv.x},${o.mv.z}) 距離 ${o.d.toFixed(1)}${o.mv.vault ? ' 翻越' : ''} 掩體面 ${o.cover} 風險 ${o.risk}%${S.curse && S.curse.has(G.key(o.mv.x, o.mv.z)) ? ' ✖詛咒格（會被壓制）' : ''}`).join('\n');
}

// ---------- 指令 ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function idle(timeout = 60000) {
  const S = G.S, t0 = Date.now();
  await sleep(0);
  while (Date.now() - t0 < timeout) {
    const ov = document.getElementById('overlay');
    if (ov && !ov.hidden) return;
    if (S.gameOver && !S.busy) { await sleep(1000); return; }
    if (!S.busy && (S.side === 'player' || S.side === 'deploy')) return;
    await sleep(20);
  }
}

function clickBtn(match) {
  const bs = [...document.querySelectorAll('#overlay button')].filter(b => b.offsetParent);
  const b = typeof match === 'function' ? bs.find(match) : bs.find(b => b.textContent.includes(match));
  if (!b) return false;
  b.click();
  return true;
}

async function run(line) {
  const S = G.S;
  if (!fastSet) { fastSet = true; G.setInstant(true); }
  const from = logBuf.length;
  const args = String(line).trim().split(/\s+/);
  const cmd = (args.shift() || 'look').toLowerCase();
  let msg = '';
  const girlArg = () => (args[0] && /^[a-z]$/i.test(args[0]) && findGirl(S, args[0])) ? findGirl(S, args.shift()) : findGirl(S, null);
  const needAct = u => {
    if (!u) return '先選角色（sel A）';
    if (u.crowLocked) return `${u.name} 被烏鴉纏住了：要隊友朝她開槍（targets 裡的烏鴉）打掉全部烏鴉，或打中稻草人`;
    if (u.locked && S.side === 'player') return `${u.name} 被人偶纏住了，這次主動權不能再行動（換另一個人，或 pass）`;
    if (!G.canAct(u)) return `${u.name} 現在不能行動（主動權：${S.side}${S.busy ? '，處理中' : ''}）`;
    return '';
  };
  try {
    switch (cmd) {
      case 'help': return HELP;
      case 'look': return look(args[0] === 'all');
      case 'title': location.reload(); return '重新載入中…';
      case 'new': G.newGame(); await sleep(20); clickBtn(b => b.id === 's-ok'); break;
      case 'endless': G.newEndless(); break;
      case 'continue': if (!G.Camp.hasSave()) return '沒有存檔'; G.continueGame(); break;
      case 'ok': if (!clickBtn(b => ['s-ok', 'ov-btn'].includes(b.id))) return '畫面上沒有主要按鈕'; break;
      case 'hq': {
        const ops = G.Camp.ops(), C = G.Camp.C;
        return (document.querySelector('#overlay #s-ok') ? '（畫面上還有劇情，先 ok 才會回到作戰室）\n' : '') + '作戰：\n' + ops.map((o, i) => `  ${i + 1}. ${o.name}（${o.kind}）難度 ${G.Camp.level(o)} 敵人約 ${G.Camp.enemyEstimate(o)}`).join('\n') +
          '\n少女：\n' + C.girls.map(g => `  ${GIRL_KEY[g.id]} ${GIRL[g.id].name} 生命 ${g.hp}/${GIRL[g.id].maxHp} 槍法 ${g.gun} 魔法 ${g.magic} 獎章 ${g.medals}` +
            `${g.evac ? ` 後送中（${g.evac}）` : ''}${(C.deploy || []).includes(g.id) ? ' ✓出擊' : ''}`).join('\n');
      }
      case 'op': if (!clickBtn(b => b.dataset.o === String(+args[0] - 1))) return '沒有這個作戰（先 hq）'; return run('hq');
      case 'squad': {
        const want = args.map(a => Object.keys(GIRL_KEY).find(id => GIRL_KEY[id] === a.toUpperCase())).filter(Boolean);
        for (const id of [...(G.Camp.C.deploy || [])]) if (!want.includes(id)) clickBtn(b => b.classList.contains('dep') && b.dataset.g === id);
        for (const id of want) if (!(G.Camp.C.deploy || []).includes(id)) clickBtn(b => b.classList.contains('dep') && b.dataset.g === id);
        return run('hq');
      }
      case 'learn': {
        const id = Object.keys(GIRL_KEY).find(k => GIRL_KEY[k] === (args[0] || '').toUpperCase());
        const t = args[1] === 'magic' ? 'magic' : 'gun';
        const g = id && G.Camp.girlState(id);
        if (!g) return '用法：learn A gun';
        clickBtn(b => b.classList.contains('node') && b.dataset.g === id && b.dataset.t === t && +b.dataset.i === g[t]);
        await sleep(20);
        if (g.evac > 0) return `${GIRL[id].name} 後送中，歸隊後才能學`;
        if (document.querySelector('#overlay #s-ok')) return '畫面上還有劇情，先 ok';
        const node = TREES[id][t][g[t]];
        if (!clickBtn(b => b.classList.contains('learn'))) return '學不了：要在作戰室，而且有獎章、還沒學滿';
        return `學會了 ${GIRL[id].name} ${t === 'gun' ? '槍法' : '魔法'} ${g[t]}：${node}\n` + await run('hq');
      }
      case 'go': if (!clickBtn(b => b.id === 'hq-go' && !b.disabled)) return '還不能出擊（選作戰與兩名少女）'; break;
      case 'deploy': {
        const u = findGirl(S, args[0]);
        if (S.side !== 'deploy' || !u) return '用法（部署階段）：deploy A x z';
        const x = +args[1], z = +args[2];
        if (!S.deployZone.some(p => p.x === x && p.z === z)) return `(${x},${z}) 不在部署區`;
        G.deployTo(u, { x, z });
        break;
      }
      case 'start': if (S.side !== 'deploy') return '不在部署階段'; G.startBattle(); break;
      case 'sel': { const u = findGirl(S, args[0]); if (!u || !u.alive) return '沒有這名少女'; G.selectUnit(u); return girlLine(S, u); }
      case 'moves': { const u = girlArg(); return movesText(S, u, +args[0] || 30); }
      case 'targets': { const u = girlArg(); return u ? targetsText(S, u) : '先選角色'; }
      case 'move': {
        const u = girlArg(); const e = needAct(u); if (e) return e;
        if (u !== S.selected) G.selectUnit(u);
        if (u.suppressed || u.pinned) return `${u.name} ${status(u)}中，先 rally`;
        const mv = G.moveOptions(u).get(G.key(+args[0], +args[1]));
        if (!mv) return `(${args[0]},${args[1]}) 不能直接移動過去（用 moves 看可走的格子）`;
        await G.playerMove(u, mv);
        break;
      }
      case 'shoot': {
        const u = girlArg(); const e = needAct(u); if (e) return e;
        if (u !== S.selected) G.selectUnit(u);
        const t = findEnemy(S, args[0]);
        if (!t || !t.alive) return '沒有這個敵人（用 targets 看編號）';
        if (u.weapons[u.wi].ammo <= 0) return `${u.name} 的${u.weapons[u.wi].name}彈匣空了：reload 換彈，或 swap 換槍`;
        if (u.firedOut) return `${u.name} 這次主動權不能再開槍（反應射擊打空了）`;
        G.enterTargetMode(t);
        if (S.mode !== 'target') return `${u.name} 看不到 ${t.name}`;
        const i = S.targets.findIndex(o => o.unit === t);
        if (i < 0) { G.cancelTarget(); return `看不到 ${t.name}`; }
        S.targetIdx = i;
        if (args[1] === 'triple' && !G.canTriple(u)) { G.cancelTarget(); return '不能三管齊發：要小桃槍法 5、拿三管霰彈槍、彈匣至少 3 發'; }
        S.triple = args[1] === 'triple';
        await G.fire();
        break;
      }
      case 'rally': case 'reload': case 'swap': case 'plant': {
        const u = girlArg(); const e = needAct(u); if (e) return e;
        if (u !== S.selected) G.selectUnit(u);
        if (cmd === 'plant' && !G.canPlant(u)) return S.mission.type !== 'sabotage' ? '這張地圖不用安裝炸藥' : S.mission.objective.planted ? '炸藥已經裝好了，撤回左側' : `要站在終端旁邊（終端在 ${S.mission.objective.x},${S.mission.objective.z}）`;
        if (cmd === 'rally' && !(u.suppressed || u.pinned)) return `${u.name} 沒有受阻或被壓制，不用起身`;
        if (cmd === 'reload' && !G.reloadInfo(u)) { const w = u.weapons[u.wi]; return w.ammo >= w.mag ? `${w.name}彈匣是滿的${u.weapons.length > 1 && u.weapons[1 - u.wi].ammo < u.weapons[1 - u.wi].mag ? `（另一把 ${u.weapons[1 - u.wi].name} 沒滿：先 swap）` : ''}` : `${w.name}沒有備彈了`; }
        if (cmd === 'reload' || cmd === 'swap') {
          const ri = cmd === 'reload' ? G.reloadInfo(u) : null;
          const gives = cmd === 'reload' ? !!(ri && ri.gives) : (u.weapons.length > 1 && !u.weapons[1 - u.wi].sidearm);
          if (gives && args[0] !== 'yes') return `⚠ ${cmd === 'reload' ? '主武器換彈' : '換回主武器'}會交出主動權，看得到她的敵人也會開一次反應射擊。確定請用：${cmd} ${gKey(u)} yes`;
          S.confirm = cmd; // 確認過了，不用再按第二次
        }
        await G.actions[cmd]();
        break;
      }
      case 'pass': G.actions.pass(); break;
      case 'magic': {
        const u = girlArg(); const e = needAct(u); if (e) return e;
        if (u !== S.selected) G.selectUnit(u);
        const mi = G.magicInfo(u);
        if (!mi || !mi.usable) return `不能用魔法：${mi ? mi.why : '沒有魔法'}`;
        if (u.ability === 'transform') { await G.actions.magic(); break; }
        const opts = G.magicOptions(u);
        if (args.length < 2) {
          const list = [...opts.values()].map(o => {
            if (o.kind === 'ice') return { o, txt: `(${o.x},${o.z})${o.rider ? '抬起' + o.rider.name : ''}`, r: 0 };
            const cells = o.kind === 'dash' ? G.pathCells(u, o.mv) : [{ x: o.x, z: o.z, t: 1 }];
            const r = Math.round(G.moveRisk(u, G.planReactions(u, cells, true), o.kind === 'dash' && u.magicLv >= 4 ? 1 : 0) * 100);
            const tg = o.kind === 'dash' ? G.enemies().filter(e => Math.hypot(e.x - o.x, e.z - o.z) < 1.5).map(e => e.tag).join('') : '';
            return { o, r, txt: `(${o.x},${o.z})${tg ? '→' + tg : ''} ${r}%` };
          }).sort((a, b) => a.r - b.r);
          return `${u.name} 魔法可用位置（${list.length}，依風險排序；% 是途中被反應射擊打中的機率，只算已知敵人${u.ability === 'dash' ? '；→ 後面是能近戰的敵人編號' : ''}）：\n` +
            list.slice(0, 120).map(x => x.txt).join('  ');
        }
        const opt = opts.get(G.key(+args[0], +args[1]));
        if (!opt) return '那裡不能用魔法（不帶座標可列出可用位置）';
        await G.execMagic(u, opt);
        break;
      }
      case 'log': return logBuf.slice(-(+args[0] || 20)).join('\n');
      case 'stats': return Rec.currentText().split('---- 完整紀錄')[0];
      case 'fast': fastSet = true; G.setInstant(args[0] !== 'off'); return '快速模式：' + (args[0] !== 'off' ? '開' : '關');
      default: return `不認得的指令：${cmd}\n` + HELP;
    }
  } catch (err) {
    msg = `錯誤：${err && err.message}\n${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : ''}`;
  }
  await idle();
  const lines = logBuf.slice(from);
  const out = `> ${line}\n` + (msg ? msg + '\n' : '') + (lines.length ? lines.join('\n') + '\n' : '') + '\n' + look(false, !lines.length);
  updatePanel(out);
  return out;
}

// ---------- 頁面上的文字面板（?text）----------
let pre = null;
function panel() {
  const d = document.createElement('div');
  d.id = 'txt-panel';
  d.innerHTML = '<pre></pre><form><input placeholder="指令（help）" autocomplete="off"></form>';
  document.body.appendChild(d);
  pre = d.querySelector('pre');
  const input = d.querySelector('input');
  d.querySelector('form').onsubmit = async ev => {
    ev.preventDefault();
    const v = input.value; input.value = '';
    pre.textContent = '執行中…';
    await run(v || 'look');
  };
  // 沒在打指令時，每 2 秒更新一次狀態（剛執行完的輸出保留 5 秒）
  setInterval(() => {
    if (!pre || document.activeElement === input || Date.now() - lastOut < 5000) return;
    pre.textContent = look();
  }, 2000);
  pre.textContent = look();
}
let lastOut = 0;
function updatePanel(text) { if (pre) { lastOut = Date.now(); pre.textContent = text; } }
