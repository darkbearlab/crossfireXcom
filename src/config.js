// 遊戲常數與資料表。之後調數值主要改這裡。

export const T = { FLOOR: 0, HALF: 1, FULL: 2 };

export const RULES = {
  SIGHT: 10,              // 警戒中的視野距離（格）。我方永遠算警戒中
  QUIET_SIGHT: 5,         // 未警戒敵人的視野距離；且看不穿半掩體、看不穿也看不進隱蔽區、只看自己的責任區
  NOISE: 6,               // 開槍會驚動射手與目標周圍這麼多格內的敵人
  COVER_DEF: [0, 30, 50], // 無 / 半掩體 / 全掩體 的防禦值
  FULL_COVER_DR: 1,       // 全掩體後面的人每次受傷 -1（最低 1）
  CLOSE_RANGE: 3,         // 朱音「近距離暴擊」的範圍
  SWEET: [1, 3],          // 沒有指定甜蜜距離的武器（敵人）用這個
  SWEET_BONUS: 10,
  FAR_RANGE: 8,           // 超過此距離每格扣命中
  FAR_PENALTY: 3,
  REACTION_PENALTY: 10,   // 反應射擊命中懲罰
  REACTION_MIN: 20,       // 命中率低於此值不會自動反應射擊（避免白白浪費）
  SUPPRESS_AIM: 20,       // 被壓制者開槍命中 -
  FLANK_CRIT: 40,         // 側翼/暴露時暴擊加成
  CRIT_MULT: 1.5,
  MEDKIT_HEAL: 3,         // 醫療包回復
  // 任務之間：彈藥補滿；生命只有沒上場的人每張地圖回 BENCH_HEAL
  BENCH_HEAL: 1,
  EVAC_MISSIONS: 2,       // 倒下後送，要再完成幾個任務才回歸
  MELEE_DMG: 2,           // 朱音近戰傷害（必中）
  ICE_HP: 3,              // 冰塊被打幾下會碎
  ICE_RANGE: 5,           // 冰塊放置距離
  CURSE_TILES: 6,         // 詛咒地 buff 的詛咒格數量
  WAVE_SIZE: 3,           // 決戰每波增援人數

  // 敵人 AI
  AI_SHOOT: 60,           // 命中率 ≥ 此值就開槍
  AI_GAMBLE: 40,          // 沒有好位置可移動時，命中率 ≥ 此值仍會開槍
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
// sweet：甜蜜距離 [近, 遠]（格，四捨五入），sweetBonus：在甜蜜距離內的命中加成。
// exposedBonus：目標沒有掩體（暴露/被側翼）時的命中加成。
// 手槍與霰彈槍是突擊武器：甜蜜距離很近、加成很大，打沒掩體的目標也特別準。
// 換主武器、主武器換彈 → 做完交出主動權；換手槍、手槍換彈很快 → 不交出主動權。
export const WEAPONS = {
  ar:     { name: '突擊步槍', short: '步槍', aim: 8,  crit: 10, dmg: [4, 6], mag: 6,  reserve: 24, canReact: true,
            sweet: [4, 7], sweetBonus: 10, note: '甜蜜距離 4–7 格 +10' },
  sg:     { name: '霰彈槍',   short: '霰彈', aim: 4,  crit: 20, dmg: [5, 8], mag: 4,  reserve: 16, canReact: true,
            sweet: [1, 2], sweetBonus: 35, exposedBonus: 20, farRange: 5, farPenalty: 8, note: '甜蜜距離 1–2 格 +35、打沒掩體的目標 +20，5 格外每格 -8' },
  sn:     { name: '狙擊步槍', short: '狙擊', aim: 15, crit: 25, dmg: [5, 7], mag: 3,  reserve: 12, canReact: false,
            ignoreHalf: true, sweet: [9, 99], sweetBonus: 15, farRange: 99, note: '甜蜜距離 9 格以上 +15；主動射擊無視半掩體；不能反應射擊' },
  lmg:    { name: '輕機槍',   short: '機槍', aim: 0,  crit: 5,  dmg: [3, 5], mag: 10, reserve: 30, canReact: true,
            keepFiring: true, sweet: [5, 8], sweetBonus: 10, note: '甜蜜距離 5–8 格 +10；反應射擊打空也不會停火' },
  pistol: { name: '手槍',     short: '手槍', aim: -5, crit: 5,  dmg: [2, 3], mag: 8,  canReact: false, sidearm: true,
            sweet: [1, 3], sweetBonus: 25, exposedBonus: 15, note: '無限備彈；不能反應射擊；甜蜜距離 1–3 格 +25、打沒掩體的目標 +15' },
  duals:  { name: '雙自動手槍', short: '雙槍', aim: 2, crit: 10, dmg: [3, 4], mag: 10, reserve: 30, canReact: true,
            sweet: [1, 3], sweetBonus: 30, exposedBonus: 20, fastReload: true, note: '換彈不交出主動權；甜蜜距離 1–3 格 +30、打沒掩體的目標 +20' },
  hmg:    { name: '重機槍',   short: '重機槍', aim: 4, crit: 5, dmg: [4, 6], mag: 8, reserve: 24, canReact: true,
            sweet: [5, 8], sweetBonus: 10, pin: true, note: '甜蜜距離 5–8 格 +10；主動射擊沒命中也會壓制目標' },
  tri:    { name: '三管霰彈槍', short: '霰彈', aim: 4, crit: 20, dmg: [5, 8], mag: 3, reserve: 12, canReact: true,
            sweet: [1, 2], sweetBonus: 35, exposedBonus: 20, farRange: 5, farPenalty: 8, recoil: true, note: '中折式三管；開槍後自己被擊退 1 格；甜蜜距離 1–2 格 +35、打沒掩體的目標 +20' },
  magnum: { name: '麥格農左輪', short: '左輪', aim: 0, crit: 15, dmg: [4, 5], mag: 6, canReact: false, sidearm: true,
            sweet: [1, 3], sweetBonus: 25, exposedBonus: 15, note: '無限備彈；甜蜜距離 1–3 格 +25、打沒掩體的目標 +15' },
};

// 敵人：普通武器不追蹤彈藥。impulse = 衝動：主動權易手時，這輪沒行動過的單位會強制做的事。
export const ENEMY_TYPES = {
  gunman:    { name: '槍手',   maxHp: 4, aim: 58, crit: 5,  dmg: [2, 4], color: 0xc0453a, impulse: 'shoot',
               desc: '衝動：對最近的可見目標開槍' },
  zealot:    { name: '狂徒',   maxHp: 4, aim: 50, crit: 10, dmg: [2, 4], color: 0xd8752a, impulse: 'charge',
               desc: '衝動：朝最近的我方衝 3 格' },
  conscript: { name: '徵召兵', maxHp: 3, aim: 48, crit: 0,  dmg: [1, 3], color: 0x8a7a5a, impulse: 'flee', scale: 0.9,
               desc: '衝動：軍官不在時往地圖邊緣逃，逃出即消失' },
  officer:   { name: '軍官',   maxHp: 6, aim: 64, crit: 5,  dmg: [2, 4], color: 0xd0b040, officer: true,
               desc: '活著時徵召兵不會逃' },
  sniper:    { name: '狙擊手', maxHp: 3, aim: 68, crit: 20, dmg: [3, 5], color: 0x5a6a8a, canReact: false, ignoreHalf: true,
               desc: '主動射擊無視半掩體；不會反應射擊' },
  mg:        { name: '機槍手', maxHp: 6, aim: 52, crit: 0,  dmg: [2, 4], color: 0x7a3434, keepFiring: true, cumbersome: true,
               desc: '笨重：每次主動權只行動一次；反應射擊打空不會停火' },
  brute:     { name: '重裝兵', maxHp: 7, aim: 55, crit: 5,  dmg: [3, 5], color: 0x8e2f6e, armor: 1, scale: 1.2,
               desc: '裝甲 1：每次受傷 -1' },
  // 家族成員（boss）
  b_eye:     { name: '薇歐拉', maxHp: 10, aim: 70, crit: 15, dmg: [3, 5], color: 0x5b3f8f, boss: true, impulse: 'shoot', ignoreHalf: true,
               desc: '眼線：主動射擊無視半掩體。打倒她「千里眼」就失效' },
  b_exec:    { name: '蕾貝卡', maxHp: 12, aim: 64, crit: 10, dmg: [3, 5], color: 0x3b2a4a, boss: true, impulse: 'charge', armor: 1, keepFiring: true,
               desc: '執行人：裝甲 1，反應射擊打空不停火。打倒她「不留活口」就失效' },
  b_book:    { name: '莫妮卡', maxHp: 10, aim: 62, crit: 5, dmg: [3, 4], color: 0x2f4a3a, boss: true, impulse: 'shoot',
               desc: '帳房。打倒她「人手充足」就失效' },
  b_sis:     { name: '莉莉絲', maxHp: 10, aim: 62, crit: 10, dmg: [3, 4], color: 0x7a2a6a, boss: true, impulse: 'curse',
               desc: '魔女姊姊。衝動：把詛咒下在最近的我方腳下。打倒她「詛咒地」就失效' },
  b_mother:  { name: '瑪格麗特', maxHp: 16, aim: 68, crit: 10, dmg: [3, 5], color: 0x1e1428, boss: true, impulse: 'shoot', armor: 1, keepFiring: true,
               desc: '教母：裝甲 1，反應射擊打空不停火。打倒她就結束了' },
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
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  while (n > 0) {
    if (n >= 2 && Math.random() < 0.3) { groups.push([pick(), pick()]); n -= 2; }
    else { groups.push([pick()]); n--; }
  }
  return groups;
}
