// 遊戲常數與資料表。之後調數值主要改這裡。

export const T = { FLOOR: 0, HALF: 1, FULL: 2 };

export const RULES = {
  SIGHT: 10,              // 警戒中的視野距離（格）。我方永遠算警戒中
  QUIET_SIGHT: 5,         // 未警戒敵人的視野距離；且看不穿半掩體、看不穿也看不進隱蔽區、只看自己的責任區
  NOISE: 6,               // 開槍會驚動射手與目標周圍這麼多格內的敵人
  COVER_DEF: [0, 20, 40], // 無 / 半掩體 / 全掩體 的防禦值
  CLOSE_RANGE: 3,         // 近距離加成範圍
  CLOSE_BONUS: 10,
  FAR_RANGE: 8,           // 超過此距離每格扣命中
  FAR_PENALTY: 3,
  REACTION_PENALTY: 10,   // 反應射擊命中懲罰
  REACTION_MIN: 20,       // 命中率低於此值不會自動反應射擊（避免白白浪費）
  SUPPRESS_AIM: 20,       // 被壓制者開槍命中 -
  SUPPRESS_DEF: 20,       // 打被壓制者命中 -
  FLANK_CRIT: 40,         // 側翼/暴露時暴擊加成
  CRIT_MULT: 1.5,
  MEDKIT_HEAL: 3,         // 醫療包回復
  // 任務之間不會自動回血、補彈：生命和彈藥都是戰役資源

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
// 換主武器、主武器換彈 → 做完交出主動權；換手槍、手槍換彈很快 → 不交出主動權。
export const WEAPONS = {
  ar:     { name: '突擊步槍', short: '步槍', aim: 8,  crit: 10, dmg: [4, 6], mag: 6,  reserve: 24, canReact: true },
  sg:     { name: '霰彈槍',   short: '霰彈', aim: 4,  crit: 20, dmg: [5, 8], mag: 4,  reserve: 16, canReact: true,
            closeBonus: 25, farRange: 5, farPenalty: 8, note: '近距離 +25，5 格外每格 -8' },
  sn:     { name: '狙擊步槍', short: '狙擊', aim: 15, crit: 25, dmg: [5, 7], mag: 3,  reserve: 12, canReact: false,
            ignoreHalf: true, closeBonus: -10, farRange: 99, note: '主動射擊無視半掩體；不能反應射擊' },
  lmg:    { name: '輕機槍',   short: '機槍', aim: 0,  crit: 5,  dmg: [3, 5], mag: 10, reserve: 30, canReact: true,
            keepFiring: true, note: '反應射擊打空也不會停火' },
  pistol: { name: '手槍',     short: '手槍', aim: -5, crit: 5,  dmg: [2, 3], mag: 8,  canReact: false, sidearm: true,
            note: '無限備彈；不能反應射擊' },
};

export const SOLDIER_TEMPLATES = [
  { name: '獵鷹', maxHp: 7, aim: 70, crit: 5, weapon: 'ar', color: 0x3d7bd9 },
  { name: '灰狼', maxHp: 8, aim: 64, crit: 5, weapon: 'sg', color: 0x2fa37a },
];

export const RECRUIT = { maxHp: 6, aim: 60, crit: 0 };
export const RECRUIT_WEAPONS = ['ar', 'ar', 'lmg', 'sn', 'sg'];
export const RECRUIT_NAMES = ['渡鴉', '黑蛇', '山貓', '夜鶯', '鐵砧', '野火', '白鷺', '石像', '寒鴉', '赤狐'];
export const RECRUIT_COLORS = [0x6a8fd0, 0x4fb08a, 0xc9a23a, 0x8a6fd0];

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
};

// 每張地圖的敵人編組（同一組會擺在同一個責任區）
export function enemyGroups(level) {
  let n = Math.min(10, 4 + Math.floor((level - 1) * 0.7));
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
