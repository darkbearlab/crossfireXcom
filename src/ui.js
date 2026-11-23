// HUD / DOM 介面。
import * as Rec from './stats.js';
import { RULES } from './config.js';
const $ = id => document.getElementById(id);
let H = {};

export function init(handlers) {
  H = handlers;
  $('btn-shoot').onclick = () => H.shoot();
  $('btn-reload').onclick = () => H.reload();
  $('btn-swap').onclick = () => H.swap();
  $('btn-rally').onclick = () => H.rally();
  $('btn-plant').onclick = () => H.plant();
  $('btn-magic').onclick = () => H.magic();
  $('btn-item').onclick = () => H.items();
  $('btn-end').onclick = () => H.pass();
  $('btn-start').onclick = () => H.start();
  $('cam-l').onclick = () => H.rotL();
  $('cam-r').onclick = () => H.rotR();
  $('help-toggle').onclick = () => $('help').classList.toggle('open');
  // 戰鬥紀錄匯出：說明面板、任務結束畫面、作戰室都有按鈕（用事件委派，畫面重畫也有效）
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('.rec-dl, .rec-cp, .rec-all, .rec-allcp');
    if (!b) return;
    if (b.classList.contains('rec-dl')) Rec.exportCurrent();
    else if (b.classList.contains('rec-all')) Rec.exportAll();
    else {
      const ok = await Rec.copy(b.classList.contains('rec-cp') ? Rec.currentText() : Rec.allText());
      toast(ok ? '已複製到剪貼簿' : '複製失敗，請改用匯出');
    }
  });
}

export function coverName(o) {
  const why = [o.duck && '壓制 +1', o.small && '小個子 +1', o.broke && '破防'].filter(Boolean);
  const tail = why.length ? `（${why.join('、')}）` : '';
  if (o.cover === 2) return '全掩體' + tail;
  if (o.cover === 1) return '半掩體' + tail;
  if (o.ignored) return '無視半掩體' + tail;
  return (o.flanked ? '側翼！' : '暴露') + tail;
}

export function missionText(m) {
  if (m.type === 'hunt') return `目標：打倒${m.bossName || '家族成員'}`;
  if (m.type === 'extract') return '目標：抵達右側撤離點';
  return m.objective.planted ? '目標：撤回左側撤離點' : '目標：在終端安裝炸藥';
}

function weaponLine(u) {
  const w = u.weapons[u.wi], p = u.weapons[0];
  const amm = `<b class="${w.ammo === 0 ? 'empty' : ''}">${w.ammo}/${w.mag}</b>`;
  if (u.wi === 0) return `${w.name} ${amm} <span class="dim">備 ${w.reserve}</span>`;
  if (!p) return `${w.name} ${amm}`;
  return `${w.name} ${amm} <span class="dim">· ${p.short} ${p.ammo}/${p.mag} 備 ${p.reserve}</span>`;
}

export function updateHUD(S) {
  // 設施的名稱就是地點：只顯示白天／夜晚；據點、莊園這類名稱才把地點寫出來
  $('mission').textContent = `${S.opName}｜${S.theme.place && S.opName.includes(S.theme.place) ? S.theme.time : S.theme.name}`;
  $('objective').textContent = S.mission ? missionText(S.mission) : '';
  const t = $('turn');
  t.textContent = S.side === 'deploy' ? '部署階段' : `主動權：${S.side === 'player' ? '我方' : '敵方'} · 第 ${S.initNo} 輪`;
  t.className = S.side === 'deploy' ? 'player' : S.side;
  const deploying = S.side === 'deploy';
  $('btn-start').hidden = !deploying;
  for (const id of ['btn-shoot', 'btn-reload', 'btn-swap', 'btn-magic', 'btn-item', 'btn-end']) $(id).hidden = deploying;
  const seen = S.units.filter(u => u.team === 'enemy' && u.alive && u.mesh.visible).length;
  // 還沒全殲時提示「還有敵人的氣息」（不說在哪、有幾個）
  const hidden = S.side !== 'deploy' && S.units.some(u => u.team === 'enemy' && u.alive && !u.mesh.visible);
  $('enemy-count').textContent = `可見敵人 ${seen}` + (hidden ? ' · 還有敵人的氣息' : '');

  const sq = $('squad');
  sq.innerHTML = '';
  for (const u of S.units.filter(u => u.team === 'player')) {
    const card = document.createElement('div');
    card.className = 'card' + (u === S.selected ? ' sel' : '') + (u.alive ? '' : ' dead');
    const st = [];
    if (u.alive && u.suppressed) st.push('<span class="sup">壓制中</span>');
    else if (u.alive && u.pinned) st.push('<span class="sup">受阻</span>');
    else if (u.alive && u.steady) st.push('<span>穩住：這次主動權不會被壓制</span>');
    if (u.alive && u.locked) st.push('<span class="sup">被人偶纏住：這次主動權不能再行動</span>');
    if (u.alive && u.bitten && u.bitten.alive) st.push(`<span class="sup">被 ${u.bitten.hp} 隻使魔咬住：敵方交出主動權時每隻 ${RULES.BITE_CHANCE}% 咬傷她，隊友朝她開槍可以打掉</span>`);
    if (u.alive && u.crowLocked) st.push('<span class="sup">被烏鴉纏住：隊友朝她開槍打掉烏鴉，或打中稻草人</span>');
    if (u.alive && u.crowAimed) st.push(`<span class="sup">⚠ ${u.crowAimed.name}的烏鴉瞄準她：敵方一行動就會放出${u.crowAimedLast ? '（只剩她能行動，被纏住就輸）' : ''}</span>`);
    if (u.alive && u.firedOut) st.push('<span class="dim">不能再開槍</span>');
    if (u.alive && u.transformed) st.push('<span class="mg">變身中</span>');
    if (u.alive && u.raised) st.push('<span class="ice">冰上</span>');
    if (u.alive && u.dodge) st.push('<span class="mg">閃避</span>');
    card.style.borderLeftColor = u.hair ? '#' + u.hair.toString(16).padStart(6, '0') : '';
    card.innerHTML = `
      <div class="nm">${u.name}<span class="tag">${u.title || ''}</span>${u.alive ? '' : '<span class="tag kia">後送</span>'}</div>
      <div class="hrow">${heartsHtml(u)}<span>${Math.max(0, u.hp)}/${u.maxHp}<span class="ln2">${u.lineUsed ? '' : ' · 心線未用'}</span></span></div>
      <div class="wl">${weaponLine(u)}</div>
      <div class="meta">${st.join('') || '<span class="dim">待命</span>'}</div>
      <div class="stats">累積命中 ${stressPips(u)}</div>`;
    if (u.alive) card.onclick = () => H.select(u);
    sq.appendChild(card);
  }

  const sel = S.selected;
  const can = H.canAct(sel);
  const w = sel && sel.weapons ? sel.weapons[sel.wi] : null;
  $('btn-shoot').disabled = !can || sel.firedOut || !w || w.ammo <= 0;

  const rl = can ? H.reloadInfo(sel) : null;
  $('btn-reload').disabled = !rl;
  $('btn-reload').classList.toggle('gives', !!(rl && rl.gives));

  const sw = sel && sel.weapons ? sel.weapons[sel.wi === 0 ? 1 : 0] : null;
  $('btn-swap').disabled = !can || !sw;
  const mi = sel ? H.magicInfo(sel) : null;
  const inMagic = H.magicMode();
  $('magic-label').textContent = inMagic ? '取消' : mi ? mi.label : '魔法';
  $('btn-magic').disabled = !inMagic && !(can && mi && mi.usable);
  $('btn-magic').classList.toggle('on', inMagic);
  $('btn-swap').classList.toggle('gives', !!(sw && !sw.sidearm));
  $('swap-label').textContent = sw ? `換${sw.short}` : '換槍';

  const down = sel && sel.alive && (sel.suppressed || sel.pinned);
  $('btn-rally').hidden = deploying || !down;
  $('btn-rally').disabled = !can || !down;
  $('btn-plant').hidden = deploying || !(can && H.canPlant(sel));
  $('btn-end').disabled = S.side !== 'player' || S.busy || S.gameOver;

  for (const u of S.units) if (u.label) updateLabel(u.label, u);
}

// triple：null = 不能三管齊發；true/false = 目前的開關
export function showTargeting(list, idx, triple = null) {
  const el = $('target-panel');
  el.hidden = false;
  el.innerHTML = `<div class="tp-title">選擇目標 <small>Tab 切換 · 點擊敵人也可</small></div>` +
    list.map((t, i) => {
      const a = t.armor ?? (t.unit.armor || 0), n = triple ? t.odds.dice * 2 : t.odds.dice, eff = effHit(t.odds, a, n);
      const arm = a ? `<br><small class="${eff ? 'warn' : 'bad'}">裝甲 ${a}：要中 ${a + 1} 顆才有效${eff ? '' : '，這槍不可能有效'}（至少中一顆 ${effHit(t.odds, 0, n)}%）</small>` : '';
      return `
      <div class="tgt ${i === idx ? 'on' : ''}" data-i="${i}">
        <div><b>${t.unit.name}</b> <small>生命 ${t.unit.hp}/${t.unit.maxHp} · ${t.unit.flying ? (t.unit.attached ? `纏在${t.unit.attached.name}身上，每中一顆打掉一隻（不會傷到她）` : '在空中（沒有掩體），每中一顆打掉一隻') : t.unit.kind === 'scarecrow' ? `打中一顆，烏鴉就傳送回它身上${t.unit.flock ? '（現在有烏鴉在外面）' : ''}` : t.unit.unflinching ? '不會受阻／壓制，每中一顆受 1 傷' : '累積 ' + stressPips(t.unit)}${t.unit.alerted ? '' : ' · 未察覺'}</small></div>
        <div class="hit">${a ? eff : t.odds.hit}%</div>
        <small>${diceLine(t.odds, triple)} · ${coverName(t.odds)} · 距離 ${t.odds.dist.toFixed(1)}${t.odds.sweet ? ' · 甜蜜距離' : ''}</small>${arm}${t.unit.lockOnHit ? `<br><small class="warn">⛓ 沒打倒的話，這次主動權她不能再行動（主動攻擊人偶每顆骰 +${t.unit.bigTarget}%）</small>` : ''}
      </div>`;
    }).join('') +
    (triple === null ? '' : `<button id="tp-triple" class="${triple ? 'on' : ''}">三管齊發：${triple ? '開' : '關'}（耗 3 發、骰數加倍）</button>`) +
    `<div class="tp-btns"><button id="tp-fire">開火 (Enter)</button><button id="tp-cancel">取消 (Esc)</button></div>`;
  el.querySelectorAll('.tgt').forEach(d => d.onclick = () => H.pickTarget(+d.dataset.i));
  $('tp-fire').onclick = () => H.fire();
  $('tp-cancel').onclick = () => H.cancelTarget();
  if (triple !== null) $('tp-triple').onclick = () => H.toggleTriple();
}

export function hideTargeting() { $('target-panel').hidden = true; }

// 道具選單：list = [{ label, desc, go, sub:[{label, go}] }]（用目標面板的位置顯示）
export function showItemMenu(list) {
  const el = $('target-panel');
  el.hidden = false;
  el.innerHTML = `<div class="tp-title">使用道具</div>` + list.map((it, i) => `
    <div class="tgt" data-i="${i}"><div><b>${it.label}</b></div><small>${it.desc}</small>
      ${it.sub ? (it.sub.length ? it.sub.map((s, j) => `<button class="it-sub" data-i="${i}" data-j="${j}">${s.label}</button>`).join(' ') : '<br><small class="bad">6 格內沒有看得到的敵人</small>') : ''}</div>`).join('') +
    `<div class="tp-btns"><button id="tp-cancel">取消 (Esc)</button></div>`;
  el.querySelectorAll('.tgt').forEach(d => d.onclick = ev => {
    if (ev.target.classList.contains('it-sub')) return;
    const it = list[+d.dataset.i];
    if (it.go) { el.hidden = true; it.go(); }
  });
  el.querySelectorAll('.it-sub').forEach(b => b.onclick = () => { el.hidden = true; list[+b.dataset.i].sub[+b.dataset.j].go(); });
  $('tp-cancel').onclick = () => { el.hidden = true; };
}

// 扣掉裝甲後「真正有效」的機率：n 顆骰至少中 armor+1 顆
export function effHit(o, armor = 0, n = o.dice) {
  const p = o.die / 100;
  if (!armor) return Math.round((1 - Math.pow(1 - p, n)) * 100);
  let miss = 0, c = 1;
  for (let k = 0; k <= armor && k <= n; k++) {
    miss += c * Math.pow(p, k) * Math.pow(1 - p, n - k);
    c = c * (n - k) / (k + 1);
  }
  return Math.max(0, Math.round((1 - miss) * 100));
}

// 累積命中：● 已累積 ○ 未累積（滿了之後每下受傷）
export function stressPips(u) {
  const n = Math.min(2, u.stress || 0);
  return '●'.repeat(n) + '○'.repeat(2 - n);
}

function diceLine(o, triple) {
  const n = triple ? o.dice * 2 : o.dice;
  const p = triple ? Math.round((1 - Math.pow(1 - o.die / 100, n)) * 100) : o.hit;
  return `${n} 骰 × 每顆 ${o.die}%${triple ? `（至少中一顆 ${p}%）` : ''} · 平均中 ${(n * o.die / 100).toFixed(1)}`;
}

// 魔法少女的愛心：每顆 heartHp 點，部分扣血的心只填一部分；黃線＝心線（還沒用掉時）
export function heartsHtml(u) {
  const H = u.heartHp, n = Math.ceil(u.maxHp / H), hp = Math.max(0, u.hp);
  let s = '';
  for (let i = 0; i < n; i++) {
    const f = Math.max(0, Math.min(1, (hp - i * H) / H));
    s += `<i class="ht" style="--f:${(f * 100).toFixed(0)}%"></i>`;
    if (!u.lineUsed && (i + 1) * H === u.lineHp) s += '<b class="hl"></b>';
  }
  return `<div class="hearts">${s}</div>`;
}

export function makeLabel(u) {
  const d = document.createElement('div');
  d.className = 'ulabel ' + u.team + (u.boss ? ' boss' : '');
  $('labels').appendChild(d);
  updateLabel(d, u);
  return d;
}

export function updateLabel(d, u) {
  const icons = (u.team === 'enemy' && !u.alerted ? '<b class="calm">?</b> ' : '') + (u.marked ? '<b class="execi" title="被千夏標記：一直看得到，打她每顆骰加成">◎</b> ' : '') +
    (u.steady && !u.suppressed ? '<b class="calm" title="穩住：這次主動權不會被壓制">◆</b> ' : '') +
    (u.execBuff && !u.spareUsed && !u.firedOut ? '<b class="execi" title="不留活口">⚔</b> ' : '') +
    (u.suppressed ? '<b class="supi">▼</b> ' : u.pinned ? '<b class="supi">▽</b> ' : '') + (u.firedOut ? '<b class="outi">✕</b> ' : '') + (u.locked ? '<b class="outi" title="被人偶纏住">⛓</b> ' : '') + (u.crowLocked ? '<b class="outi" title="被烏鴉纏住">🐦</b> ' : '') + (u.bitten && u.bitten.alive ? `<b class="outi" title="被使魔咬住">🦇${u.bitten.hp}</b> ` : '') + (u.biteCluster ? `<b class="stri" title="咬著的使魔數">×${u.hp}</b> ` : '') + (u.crowAimed ? '<b class="outi" title="稻草人的烏鴉瞄準她：敵方一行動就會放出">⚠🐦</b> ' : '') +
    (u.shotCap ? `<b class="stri" title="這次敵方主動權已開槍／最多開槍（同一人最多 ${2} 槍）">🔫${u.shotsUsed || 0}/${u.shotCap}</b> ` : '') + (u.kind === 'scarecrow' ? `<b class="stri" title="身上的烏鴉">🐦${u.crows}/${u.crowMax}${u.flock ? ' 飛出中' : u.crowAim ? `→${u.crowAim.name}` : u.crows < u.crowMax ? ` 恢復${u.regen}/4` : ''}</b> ` : '') +
    (u.stress ? `<b class="stri">${'•'.repeat(Math.min(2, u.stress))}</b> ` : '');
  const bar = u.heartHp ? heartsHtml(u)
    : `<div class="pips">${Array.from({ length: u.maxHp }, (_, i) => `<i class="${i < u.hp ? 'on' : ''}${u.cuts && u.cuts.includes(i) ? ' cut' : ''}"></i>`).join('')}</div>`;
  const html = `<div class="ln">${icons}${u.name}</div>` + bar;
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
export function toast(text, ms = 1600) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

const logListeners = [];
export function addLogListener(fn) { logListeners.push(fn); }

export function log(text, cls = '') {
  for (const fn of logListeners) fn(text, cls);
  const l = $('log');
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  Rec.log(text, cls);
  l.prepend(d);
  while (l.children.length > 8) l.lastChild.remove();
}

export function clearLog() { $('log').innerHTML = ''; }

export function tip(text, x, y) {
  const t = $('tip');
  if (!text) { t.hidden = true; return; }
  t.hidden = false;
  t.innerHTML = text;
  // 保持在畫面內（手機窄螢幕）
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 16)) + 'px';
  t.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 12)) + 'px';
}

export function showOverlay(title, html, btn, cb) {
  const o = $('overlay');
  o.hidden = false;
  o.innerHTML = `<div class="panel"><h1>${title}</h1><div class="body">${html}</div><button id="ov-btn">${btn}</button></div>`;
  $('ov-btn').onclick = () => { o.hidden = true; cb(); };
}
