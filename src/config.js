// 遊戲常數與資料表。之後調數值主要改這裡。

export const T = { FLOOR: 0, HALF: 1, FULL: 2 };

export const RULES = {
  SIGHT: 10,              // 警戒中的視野距離（格）。我方永遠算警戒中
  QUIET_SIGHT: 5,         // 未警戒敵人的視野距離；且看不穿半掩體、看不穿也看不進隱蔽區、只看自己的責任區
  NOISE: 6,               // 開槍會驚動射手與目標周圍這麼多格內的敵人
  // 骰子制：一次攻擊擲好幾顆骰，每顆各自判定命中。
  // 每顆的命中率看目標的最終掩體：暴露 / 半掩體 / 全掩體
  DIE_HIT: [50, 33, 17],
  CLOSE_RANGE: 3,         // 朱音槍法 3「近距離 +1 骰」的範圍
  SWEET: [1, 3],          // 沒有指定甜蜜距離的武器（敵人）用這個
  SWEET_DICE: 1,          // 甜蜜距離內 +幾顆骰（武器可另外指定 sweetDice）
  FAR_RANGE: 8,           // 超過此距離，每顆骰每格扣命中
  FAR_PENALTY: 3,
  REACTION_DICE: 1,       // 反應射擊少幾顆骰
  REACTION_MIN: 20,       // 至少中一顆的機率低於此值不會自動反應射擊（避免白白浪費）
  SUPPRESS_DICE: 1,       // 被壓制者開槍少幾顆骰
  DIE_MIN: 5, DIE_MAX: 90,
  // 三階：命中會累積。第 1 下受阻（不能移動），第 2 下壓制，之後每下受傷。
  // 起身只解除狀態，累積的命中不會清掉。
  // 少女受傷一次扣一顆心，而且一次攻擊最多扣一顆；敵人生命以「傷」計（一般 1、精銳 2）。
  PIN_AT: 1, SUP_AT: 2,
  MEDKIT_HEAL: 3,         // 醫療包回復（一顆心）
  HEART_HP: 3,            // 一顆心 = 3 點生命。每次受傷最多扣掉目前這顆心（溢出的傷害作廢）
  AIRDROP_RANGE: 8,       // 空投距離；落點還要在隊友看得見的格子
  PHASE_GUARDS: 2,        // 頭目每突破一個階段叫來的護衛
  // 敵人啟動檢定：每次主動行動前骰一次，失敗＝亂了陣腳：主動權交回我方，沒行動的敵人各自憑衝動行事
  ACT_OFFICER: 10,        // 3 格內有軍官 +
  ACT_SUPPRESSED: 15,     // 被壓制 -
  ACT_DEATHS: 10,         // 這次主動權內有隊友倒下 -
  ACT_HURT: 10,           // 生命低於一半 -
  // 任務之間：彈藥補滿；沒上場的人每張地圖回 BENCH_HEAL；上場且沒倒下的人打贏時回 FIELD_HEAL
  BENCH_HEAL: 3,
  FIELD_HEAL: 3,
  EVAC_MISSIONS: 2,       // 倒下後送，要再完成幾個任務才回歸
  MELEE_WOUNDS: 1,        // 朱音近戰：必中，不經過三階直接受傷這麼多次並壓制（無視裝甲）
  ICE_HP: 3,              // 冰塊被打幾下會碎
  ICE_RANGE: 5,           // 冰塊放置距離
  CURSE_TILES: 6,         // 詛咒地 buff 的詛咒格數量
  WAVE_SIZE: 3,           // 決戰每波增援人數

  // 敵人 AI
  AI_SHOOT: 60,           // 至少中一顆的機率 ≥ 此值就開槍
  AI_GAMBLE: 40,          // 沒有好位置可移動時，機率 ≥ 此值仍會開槍
  AI_RISK: 45,            // 移動路線被打中機率的權重
  AI_MOVE_GAIN: 8,        // 新位置要比現在好多少才移動
  AI_MAX_ACTIONS: 14,     // 一次主動權最多行動次數（防無限迴圈）
};

// 地圖生成規則
export const MAPGEN = {
  ATTEMPTS: 600,
  DEPLOY_COLS: 3,         // 部署區寬度（從左邊算起）；這幾欄不屬於任何敵人的責任區
  DEPLOY_ROWS: 7,         // 部署區高度
  MIN_ENEMY_DIST: 7,      // 敵人崗哨離部署區至少幾格
};

export const THEMES = [
  { name: '城市廢墟', floor: 0x3d434a, floorAlt: 0x363b41, half: 0x9a7440, full: 0x737a83, fullStyle: 'wall', halfStyle: 'crate', sky: 0x1a1f25, conceal: 0x6b6258, concealName: '瓦礫陰影' },
  { name: '林地', floor: 0x3a5530, floorAlt: 0x324b29, half: 0x7d7262, full: 0x2f6b34, fullStyle: 'tree', halfStyle: 'rock', sky: 0x18241a, conceal: 0x7fae4a, concealName: '高草' },
  { name: '沙漠前哨', floor: 0xb89c6c, floorAlt: 0xab8f60, half: 0x8a7a55, full: 0xa57d52, fullStyle: 'wall', halfStyle: 'sandbag', sky: 0x3a2f22, conceal: 0x6f7a45, concealName: '偽裝網' },
  { name: '雪原基地', floor: 0xd5dce4, floorAlt: 0xc8d0da, half: 0x5a6b7d, full: 0x7f8c9a, fullStyle: 'wall', halfStyle: 'crate', sky: 0x28313d, conceal: 0xf4f8fc, concealName: '雪堆' },
];

// 玩家武器：有彈匣與備彈（戰役資源）。
// dice：基本骰數；sweet：甜蜜距離 [近, 遠]（格，四捨五入），sweetDice：在甜蜜距離內 +幾顆骰；
// exposedDice：目標沒有掩體（暴露/被側翼）時 +幾顆骰；dieMod：每顆骰的命中修正（%）。
// 手槍與霰彈槍是突擊武器：甜蜜距離很近、加的骰多，打沒掩體的目標也多一顆。
// 換主武器、主武器換彈 → 做完交出主動權；換手槍、手槍換彈很快 → 不交出主動權。
export const WEAPONS = {
  ar:     { name: '突擊步槍', short: '步槍', dice: 3, mag: 6,  reserve: 24, canReact: true,
            sweet: [4, 7], sweetDice: 1, note: '3 骰；甜蜜距離 4–7 格 +1 骰' },
  sg:     { name: '霰彈槍',   short: '霰彈', dice: 2, mag: 4,  reserve: 16, canReact: true,
            sweet: [1, 2], sweetDice: 2, exposedDice: 1, farRange: 5, farPenalty: 8, note: '2 骰；甜蜜距離 1–2 格 +2 骰、打沒掩體的目標 +1 骰，5 格外每格 -8%' },
  sn:     { name: '狙擊步槍', short: '狙擊', dice: 2, dieMod: 15, mag: 3,  reserve: 12, canReact: false,
            ignoreHalf: true, sweet: [9, 99], sweetDice: 1, farRange: 99, note: '2 骰、每骰 +15%；甜蜜距離 9 格以上 +1 骰；主動射擊無視半掩體；不能反應射擊' },
  lmg:    { name: '輕機槍',   short: '機槍', dice: 3, mag: 10, reserve: 30, canReact: true,
            keepFiring: true, sweet: [5, 8], sweetDice: 1, note: '3 骰；甜蜜距離 5–8 格 +1 骰；反應射擊打空也不會停火' },
  pistol: { name: '手槍',     short: '手槍', dice: 2, mag: 8,  canReact: false, sidearm: true,
            sweet: [1, 3], sweetDice: 1, exposedDice: 1, note: '2 骰；無限備彈；不能反應射擊；甜蜜距離 1–3 格 +1 骰、打沒掩體的目標 +1 骰' },
  duals:  { name: '雙自動手槍', short: '雙槍', dice: 3, mag: 10, reserve: 30, canReact: true,
            sweet: [1, 3], sweetDice: 1, exposedDice: 1, fastReload: true, note: '3 骰；換彈不交出主動權；甜蜜距離 1–3 格 +1 骰、打沒掩體的目標 +1 骰' },
  hmg:    { name: '重機槍',   short: '重機槍', dice: 3, mag: 8, reserve: 24, canReact: true,
            sweet: [5, 8], sweetDice: 1, pin: true, note: '3 骰；甜蜜距離 5–8 格 +1 骰；主動射擊沒命中也會壓制目標' },
  tri:    { name: '三管霰彈槍', short: '霰彈', dice: 2, mag: 3, reserve: 12, canReact: true,
            sweet: [1, 2], sweetDice: 2, exposedDice: 1, farRange: 5, farPenalty: 8, recoil: true, note: '中折式三管；2 骰；開槍後自己被擊退 1 格；甜蜜距離 1–2 格 +2 骰、打沒掩體的目標 +1 骰' },
  magnum: { name: '麥格農左輪', short: '左輪', dice: 2, dieMod: 5, mag: 6, canReact: false, sidearm: true,
            sweet: [1, 3], sweetDice: 1, exposedDice: 1, note: '2 骰、每骰 +5%；無限備彈；甜蜜距離 1–3 格 +1 骰、打沒掩體的目標 +1 骰' },
};

// 敵人：普通武器不追蹤彈藥。impulse = 衝動：主動權易手時，這輪沒行動過的單位會強制做的事。
// act / q = 啟動值與品質（新兵 45、老手 60、精銳 70、軍官 80）。頭目不檢定，改成生命分 3 段。
// maxHp 以「傷」計（一般 1、精銳 2）；dice = 骰數（甜蜜距離 1–3 格再 +1），dieMod = 每顆骰的命中修正（%）。
// armor：每次攻擊少算 1 下命中。裝甲和多血不並存：有裝甲的只有 1 傷，頭目不穿裝甲。
export const ENEMY_TYPES = {
  gunman:    { name: '槍手',   act: 60, q: '老手', maxHp: 1, dice: 2, color: 0xc0453a, impulse: 'shoot',
               desc: '衝動：對最近的可見目標開槍' },
  zealot:    { name: '狂徒',   act: 60, q: '老手', maxHp: 1, dice: 2, dieMod: -5, color: 0xd8752a, impulse: 'charge',
               desc: '衝動：朝最近的我方衝 3 格' },
  conscript: { name: '徵召兵', act: 45, q: '新兵', maxHp: 1, dice: 1, color: 0x8a7a5a, impulse: 'flee', scale: 0.9,
               desc: '衝動：軍官不在時往地圖邊緣逃，逃出即消失' },
  officer:   { name: '軍官',   act: 80, q: '軍官', maxHp: 2, dice: 2, dieMod: 5, color: 0xd0b040, officer: true,
               desc: '活著時徵召兵不會逃' },
  sniper:    { name: '狙擊手', act: 70, q: '精銳', maxHp: 1, dice: 2, dieMod: 10, color: 0x5a6a8a, canReact: false, ignoreHalf: true,
               desc: '主動射擊無視半掩體；不會反應射擊' },
  mg:        { name: '機槍手', act: 70, q: '精銳', maxHp: 2, dice: 3, dieMod: -5, color: 0x7a3434, keepFiring: true, cumbersome: true,
               desc: '3 骰。笨重：每次主動權只行動一次；反應射擊打空不會停火' },
  brute:     { name: '重裝兵', act: 70, q: '精銳', maxHp: 1, dice: 2, color: 0x8e2f6e, armor: 1, scale: 1.2,
               desc: '裝甲：每次攻擊少算 1 下命中' },
  // 人偶：專門打亂單騎戰術。不會受阻/壓制、每中一顆骰受 1 傷（打它每顆骰 +bigTarget%）。
  // 攻擊它卻沒打倒的少女，這次主動權不能再行動（lockOnHit）。動作慢：移動 3、射程 2、笨重、不反應射擊
  doll:      { name: '人偶',   act: 70, q: '精銳', maxHp: 6, dice: 2, dieMod: 25, sweetDice: 0, color: 0xd8c8b8, scale: 1.25,
               canReact: false, cumbersome: true, unflinching: true, lockOnHit: true, moveRange: 3, range: 2, bigTarget: 15, impulse: 'charge',
               desc: '魔女的人偶：不會受阻、不會被壓制，每中一顆骰就受 1 傷（主動攻擊它每顆骰 +15%，反應射擊不加）。動作慢：移動 3 格、射程 2、每次主動權只行動一次、不反應射擊。<b>攻擊它卻沒打倒的少女，這次主動權不能再行動</b>' },
  // 家族成員（boss）：生命分 3 段，每段 2 傷
  b_eye:     { name: '薇歐拉', maxHp: 6, dice: 3, dieMod: 10, color: 0x5b3f8f, boss: true, impulse: 'shoot', ignoreHalf: true,
               desc: '眼線：主動射擊無視半掩體。打倒她「千里眼」就失效' },
  b_exec:    { name: '蕾貝卡', maxHp: 6, dice: 3, color: 0x3b2a4a, boss: true, impulse: 'charge', keepFiring: true,
               desc: '執行人：反應射擊打空不停火。打倒她「不留活口」就失效' },
  b_book:    { name: '莫妮卡', maxHp: 6, dice: 3, color: 0x2f4a3a, boss: true, impulse: 'shoot',
               desc: '帳房。打倒她「人手充足」就失效' },
  b_sis:     { name: '莉莉絲', maxHp: 6, dice: 3, color: 0x7a2a6a, boss: true, impulse: 'curse',
               desc: '魔女姊姊。衝動：把詛咒下在最近的我方腳下。打倒她「詛咒地」就失效' },
  b_mother:  { name: '瑪格麗特', maxHp: 9, dice: 3, dieMod: 5, color: 0x1e1428, boss: true, impulse: 'shoot', keepFiring: true,
               desc: '教母：反應射擊打空不停火。打倒她就結束了' },
};

// 難度 → 一般敵人數量：難度 1 = 4 人，之後大約每升 2 級多 1 人，最多 10 人
export const enemyCount = level => Math.min(10, 3 + Math.ceil(level * 0.6));

// 每張地圖的敵人編組（同一組會擺在同一個責任區）
export function enemyGroups(level, bonus = 0) {
  let n = enemyCount(level) + bonus;
  const groups = [];
  if (level >= 2 && n >= 5 && Math.random() < 0.6) { groups.push(['officer', 'conscript', 'conscript']); n -= 3; }
  const pool = ['gunman', 'gunman', 'zealot'];
  if (level >= 3) pool.push('mg', 'sniper');
  if (level >= 4) pool.push('brute');
  if (level >= 8) pool.push('brute', 'brute'); // 後期小兵多穿裝甲
  if (level >= 5) pool.push('doll');
  let dolls = 0; // 人偶每張地圖最多 1 個
  const pick = () => {
    let k = pool[Math.floor(Math.random() * pool.length)];
    if (k === 'doll') { if (dolls) k = 'gunman'; else dolls++; }
    return k;
  };
  while (n > 0) {
    if (n >= 2 && Math.random() < 0.3) { groups.push([pick(), pick()]); n -= 2; }
    else { groups.push([pick()]); n--; }
  }
  return groups;
}
