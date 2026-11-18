// 遊戲常數與資料表。之後調數值主要改這裡。

export const T = { FLOOR: 0, HALF: 1, FULL: 2 };

export const RULES = {
  SIGHT: 10,              // 視野距離（格）
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
  HEAL_BETWEEN_MAPS: 3,   // 地圖之間回復 HP

  // 敵人 AI
  AI_SHOOT: 60,           // 命中率 ≥ 此值就開槍
  AI_GAMBLE: 40,          // 沒有好位置可移動時，命中率 ≥ 此值仍會開槍
  AI_RISK: 45,            // 移動路線被打中機率的權重
  AI_MOVE_GAIN: 8,        // 新位置要比現在好多少才移動
  AI_MAX_ACTIONS: 12,     // 一次主動權最多行動次數（防無限迴圈）
};

// 地圖生成規則
export const MAPGEN = {
  // 開場時，雙方都至少要「移動這麼多次」才能看到對方部署區/位置。
  // 2 = 原地看不到，而且任何一次直線移動後也看不到。
  MIN_CONTACT_MOVES: 2,
  STRICT_ATTEMPTS: 2000,  // 嚴格條件嘗試次數，失敗後退回「至少原地看不到」
  DEPLOY_COLS: 3,         // 部署區寬度（從左邊算起）
  DEPLOY_ROWS: 7,         // 部署區高度
};

export const THEMES = [
  { name: '城市廢墟', floor: 0x3d434a, floorAlt: 0x363b41, half: 0x9a7440, full: 0x737a83, fullStyle: 'wall', halfStyle: 'crate', sky: 0x1a1f25 },
  { name: '林地', floor: 0x3a5530, floorAlt: 0x324b29, half: 0x7d7262, full: 0x2f6b34, fullStyle: 'tree', halfStyle: 'rock', sky: 0x18241a },
  { name: '沙漠前哨', floor: 0xb89c6c, floorAlt: 0xab8f60, half: 0x8a7a55, full: 0xa57d52, fullStyle: 'wall', halfStyle: 'sandbag', sky: 0x3a2f22 },
  { name: '雪原基地', floor: 0xd5dce4, floorAlt: 0xc8d0da, half: 0x5a6b7d, full: 0x7f8c9a, fullStyle: 'wall', halfStyle: 'crate', sky: 0x28313d },
];

export const SOLDIER_TEMPLATES = [
  { name: '獵鷹', maxHp: 7, aim: 72, crit: 10, dmg: [3, 5], color: 0x3d7bd9 },
  { name: '灰狼', maxHp: 8, aim: 66, crit: 15, dmg: [3, 5], color: 0x2fa37a },
];

export const RECRUIT = { maxHp: 6, aim: 62, crit: 5, dmg: [2, 4] };
export const RECRUIT_NAMES = ['渡鴉', '黑蛇', '山貓', '夜鶯', '鐵砧', '野火', '白鷺', '石像', '寒鴉', '赤狐'];
export const RECRUIT_COLORS = [0x6a8fd0, 0x4fb08a, 0xc9a23a, 0x8a6fd0];

export const ENEMY_TYPES = {
  grunt: { name: '掠奪者', maxHp: 4, aim: 60, crit: 5, dmg: [2, 4], color: 0xc0453a },
  brute: { name: '重裝獸', maxHp: 7, aim: 55, crit: 5, dmg: [3, 5], color: 0x8e2f6e },
};
