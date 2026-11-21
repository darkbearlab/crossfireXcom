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
  EVAC_MISSIONS: 2,       // 倒下後送，要再完成幾個任務才回歸（期間每場回 1 顆心）
  EARLY_RETURN: 2 / 3,    // 可出擊不足 SQUAD 人時，後送的人提前歸隊，至少回到這個比例的生命
  // 難度曲線（第四輪代理共識）
  FIRST_BOSS_AT: 4,       // 全戰役完成幾場後，成員才會現身（另外還要拆掉她 2 座設施）
  DETOURS: 2,             // 頭目戰／突襲／決戰輸了，每次失敗可以先改打幾場替代作戰
  MEDAL_WIN: 1,           // 打贏：出擊的人
  MEDAL_LOSS: 0.5,        // 打輸：出擊的人
  MEDAL_BENCH: 0.5,       // 沒出擊的人（每場）
  MEDAL_BOSS: 1,          // 打倒頭目：全員額外
  BOSS_SHOTS: [2, 2, 3, 3], // 頭目每個敵方主動權最多主動開幾槍（依出場順序）；瑪格麗特 3，第 3 段 4
  BOSS_SAME_TARGET: 2,    // 同一名少女一次敵方主動權內最多被頭目打幾槍
  FAC_TIMER: [4, 3],      // 設施條件「增援計時」：每幾個敵方主動權補 2 人（難度 9 起用第二個）
  // 戰役 v2
  CARDS: 3,               // 家族同時準備幾張反制（其中 1 張公開）
  CARD_TURNS: [6, 9],     // 反制的倒數（回合）
  CARD_CLASH: 2,          // 反制之間至少隔幾回合生效；新反制的倒數離別張太近就延後這麼多回合
  REPELS: 2,              // 擊退成員幾次，解鎖她的據點
  APPEAR: [0.25, 0.1, 0.75], // 成員在自己設施現身的機率：基本、每回合沒現身 +、上限
  MANOR_AT: 3,            // 打倒幾名成員後退守莊園（家族 4 人時；人數更多時改成「剩 3 人時」，見 campaign.manorAt）
  MELEE_WOUNDS: 1,        // 朱音近戰：必中，不經過三階直接受傷這麼多次並壓制（無視裝甲）
  ICE_HP: 3,              // 冰塊被打幾下會碎
  ICE_RANGE: 5,           // 冰塊放置距離
  CURSE_TILES: 6,         // 詛咒地 buff 的詛咒格數量
  FOG_PATCHES: 3,         // 迷香 buff 的迷霧片數（每片 4～6 格）
  SQUAD: 3,               // 每場出擊人數
  SQUAD_EXTRA: 1,         // 出擊 3 人時，每張地圖敵人多幾名（原本的敵人數是照 2 人調的）
  MARK_BONUS: [10, 15],   // 千夏的標記：隊友打被標記的敵人每顆骰 +%（魔法 4 起用第二個）
  BLAST_RANGE: [6, 9],    // 楓的爆破距離（魔法 2 起用第二個）
  BLESS_RANGE: [3, 5],    // 詩織的祝福距離（魔法 1 起用第二個）
  GUARD_CHANCE: 30,       // 詩織的被動：相鄰隊友被反應射擊打中時，替她擋下一下的機率（%）
  RUBBLE_CHANCE: 40,      // 楓的榴彈打在掩體上時，把掩體炸掉一級的機率（%）
  WAVE_SIZE: 3,           // 決戰每波增援人數
  CROW_MAX: 3,            // 稻草人的烏鴉數（全部恢復才會再放出）
  CROW_SPEED: 3,          // 烏鴉每次衝動往前飛幾格（再 1 格內就纏上）
  CROW_REGEN: 4,          // 我方每成功行動幾次，稻草人身上回來 1 隻烏鴉

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
  sn:     { name: '狙擊步槍', short: '狙擊', dice: 2, dieMod: 15, mag: 3,  reserve: 12, canReact: false, closeDice: -1,
            ignoreHalf: true, sweet: [7, 10], sweetDice: 1, farRange: 99, note: '2 骰、每骰 +15%；甜蜜距離 7–10 格 +1 骰、3 格內 -1 骰；主動射擊無視半掩體；不能反應射擊' },
  gl:     { name: '榴彈發射器', short: '榴彈', dice: 2, mag: 2, reserve: 6, canReact: false, splash: true, pierce: 1,
            sweet: [4, 8], sweetDice: 1, farRange: 10, note: '2 骰；打中的那一格和周圍 1 格的人（包括自己人）各擲一次；無視裝甲 1 點；可能炸掉目標的掩體；不能反應射擊' },
  smg:    { name: '衝鋒槍', short: '衝鋒', dice: 4, dieMod: -12, mag: 12, reserve: 36, canReact: true, spray: true,
            sweet: [2, 4], sweetDice: 1, note: '4 骰、每骰 -12%；甜蜜距離 2–4 格 +1 骰；主動射擊打空時，有一半機率讓目標累積 1 下' },
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
               desc: '魔女的人偶：不會受阻、不會被壓制（所以反應射擊打中也攔不住它，會走完），每中一顆骰就受 1 傷（主動攻擊它每顆骰 +15%，反應射擊不加）。動作慢：移動 3 格、射程 2、每次主動權只行動一次、不反應射擊。<b>攻擊它卻沒打倒的少女，這次主動權不能再行動</b>（人偶被打倒就解除）' },
  // 稻草人：不會動、不開槍。放出烏鴉去纏住一名少女（不能行動、不能反應射擊）。
  // 解法：空中攔截烏鴉、隊友朝被纏住的人開槍打掉全部烏鴉（之後要慢慢恢復），或打中稻草人（烏鴉立刻傳送回去）
  scarecrow: { name: '稻草人', q: '精銳', maxHp: 4, dice: 1, color: 0xc8a860, scale: 1.1,
               noGun: true, canReact: false, unflinching: true, immobile: true, bigTarget: 15, impulse: 'launch',
               desc: '不會動、不開槍、不會受阻／壓制，每中一顆骰受 1 傷（主動攻擊它每顆骰 +15%）。不做啟動檢定（沒有感情，不會亂了陣腳）。烏鴉 3 隻都在身上時，敵方一行動就會放出去纏住一名少女（會先標出目標）。<b>打中它至少一顆，烏鴉就傳送回它身上</b>' },
  crows:     { name: '烏鴉', maxHp: 3, dice: 1, color: 0x1a1a22,
               noGun: true, canReact: false, unflinching: true, immobile: true, flying: true, summon: true, impulse: 'fly',
               desc: '衝動：往目標飛 3 格，碰到就纏住她。在空中沒有掩體，每中一顆打掉一隻；全部打掉後稻草人要慢慢恢復' },
  // 家族成員（boss）：生命分 3 段，每段 2 傷
  // reinforce：突破階段時叫來的增援。where：watch＝遠處看得到少女的掩體後；ambush＝少女看不到、離少女 4～6 格；guard＝她身邊
  b_eye:     { name: '薇歐拉', maxHp: 6, dice: 3, dieMod: 10, color: 0x5b3f8f, boss: true, impulse: 'shoot', ignoreHalf: true,
               reinforce: { kinds: ['sniper', 'gunman'], where: 'watch' },
               desc: '眼線：主動射擊無視半掩體。突破階段時，狙擊手和槍手出現在遠處（離少女 8 格以上）看得到少女的掩體後。打倒她「千里眼」就失效' },
  b_exec:    { name: '蕾貝卡', maxHp: 6, dice: 3, color: 0x3b2a4a, boss: true, impulse: 'charge', keepFiring: true,
               reinforce: { kinds: ['zealot', 'zealot'], where: 'ambush' },
               desc: '執行人：反應射擊打空不停火。突破階段時，2 名狂徒從少女看不到的地方（離少女 4～6 格）包抄。打倒她「不留活口」就失效' },
  b_book:    { name: '莫妮卡', maxHp: 6, dice: 3, color: 0x2f4a3a, boss: true, impulse: 'shoot',
               reinforce: { kinds: ['gunman', 'gunman', 'gunman'], where: 'guard' },
               desc: '帳房。突破階段時，3 名槍手圍到她身邊。打倒她「人手充足」就失效' },
  b_sis:     { name: '莉莉絲', maxHp: 6, dice: 3, color: 0x7a2a6a, boss: true, impulse: 'curse',
               reinforce: { kinds: [], curse: 2 },
               desc: '魔女姊姊。衝動：把詛咒下在最近的我方腳下。突破階段時，在最近的 2 名少女腳下下詛咒（被壓制）。打倒她「詛咒地」就失效' },
  b_perfume: { name: '卡蜜拉', maxHp: 6, dice: 3, color: 0x6a4a8a, boss: true, impulse: 'gas',
               reinforce: { kinds: ['gunman', 'gunman'], where: 'fog' },
               desc: '調香師。衝動：朝看得到的少女丟毒霧，她和周圍 1 格的少女進入壓制。突破階段時，2 名槍手從少女看不到的迷霧裡出現。打倒她「迷香」就失效' },
  b_hound:   { name: '艾琳娜', maxHp: 6, dice: 3, color: 0x7a5a2a, boss: true, impulse: 'hunt', keepFiring: false,
               reinforce: { kinds: ['zealot', 'zealot'], where: 'rear' },
               desc: '獵犬。衝動：朝最後一個開槍的少女衝 4 格，然後朝她開一槍。突破階段時，2 名狂徒從少女的部署區那一側出現（斷後路）。打倒她「追獵」就失效' },
  b_puppet:  { name: '桃樂絲', maxHp: 6, dice: 3, color: 0xa04060, boss: true, impulse: 'shoot', escort: ['doll', 'doll'],
               reinforce: { kinds: ['doll', 'doll'], where: 'guard' },
               desc: '人偶師。據點裡身邊有 2 具人偶。突破階段時，再叫來 2 具人偶守在身邊。打倒她「提線」就失效' },
  b_mother:  { name: '瑪格麗特', maxHp: 9, dice: 3, dieMod: 5, color: 0x1e1428, boss: true, impulse: 'shoot', keepFiring: true,
               reinforce: { kinds: ['mg', 'gunman'], where: 'guard' },
               desc: '教母：反應射擊打空不停火。突破階段時，機槍手和槍手守到她身邊。打倒她就結束了' },
};

// ---------- 戰役 v2：道具與裝備（每人 3 格） ----------
// use：消耗品，戰鬥中用掉就沒了；gear：裝備，一直帶著
export const ITEMS = {
  medkit: { name: '醫療包', kind: 'use', price: 2, desc: '行動：回 1 顆心（不交主動權）' },
  apround: { name: '穿甲彈', kind: 'use', price: 2, desc: '裝填後，下一次主動射擊無視裝甲（不交主動權）' },
  flash: { name: '閃光彈', kind: 'use', price: 3, desc: '丟向 6 格內看得到的敵人：她和周圍 1 格的敵人進入壓制（會發出聲響）' },
  vest: { name: '防彈背心', kind: 'gear', price: 5, desc: '上場時多 1 顆心（只在這場內）' },
  mag: { name: '擴充彈匣', kind: 'gear', price: 4, desc: '主武器彈匣 +2、備彈 +4' },
  scope: { name: '瞄準鏡', kind: 'gear', price: 6, fits: ['ar', 'lmg', 'hmg', 'sn'], desc: '步槍、機槍、狙擊槍：這次主動權還沒移動過時，每顆骰 +15%（手槍、霰彈槍不能裝）' },
  reddot: { name: '紅點瞄具', kind: 'gear', price: 4, fits: ['pistol', 'magnum', 'duals'], desc: '手槍類（手槍、左輪、雙槍）每顆骰 +5%，移動後也有效' },
  calm: { name: '鎮定劑', kind: 'use', price: 3, desc: '行動：解除自己的受阻和壓制（不會吃反應射擊），這次主動權內不會再被壓制或受阻（不交主動權）' },
};
export const SLOTS = 3;

// ---------- 黑市（像 XCOM2 的黑市）：用戰利品買、把道具賣掉換戰利品、以物易物。每回合換貨 ----------
export const MARKET = {
  BUY: 3,                 // 每回合賣幾樣
  TRADES: 2,              // 每回合幾筆以物易物
  SELL: 0.5,              // 賣回去拿到原價的幾成（無條件捨去，至少 1）
  DISCOUNT: [0.7, 1.3],   // 這回合價格浮動
  LOOT_WIN: 3, LOOT_LOSS: 1, LOOT_PER_KILLS: 2, // 戰利品：打贏 3、打輸 1，每打倒 2 名敵人再 +1
};

// ---------- 名單：每場戰役開始時決定雙方的名單 ----------
// 池子：魔法少女 7 名、家族成員 7 名。開新戰役時手選或隨機
export const ROSTER = {
  girls: 5,               // 一場戰役的魔法少女人數（每場出擊 RULES.SQUAD 人）
  family: 4,              // 一場戰役的家族成員人數（不含教母）
};

// ---------- 戰役 v2：家族的反制（像黑地事件）。生效一張，家族威脅 +1 ----------
export const COUNTERS = {
  sight: { name: '監視網', desc: '未警戒敵人的視野 +2' },
  extra: { name: '擴編', desc: '每張地圖敵人 +1' },
  armor: { name: '重裝化', desc: '每張地圖有 1 名槍手換成重裝兵' },
  doll: { name: '魔女的玩偶', once: true, desc: '設施圖必定有人偶或稻草人' },
  supply: { name: '封鎖補給', once: true, desc: '地圖上的補給箱減半' },
  drill: { name: '操練', desc: '敵人的啟動率 +5%' },
  production: { name: '補給線', desc: '莊園增援產能 +1' },
  member: { name: '成員強化', desc: '一名成員（生效時決定）之後現身與據點戰 +1 骰' },
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
  if (level >= 6) pool.push('scarecrow');
  let special = 0; // 人偶、稻草人：每張地圖合計最多 1 個
  const pick = () => {
    let k = pool[Math.floor(Math.random() * pool.length)];
    if (k === 'doll' || k === 'scarecrow') { if (special) k = 'gunman'; else special++; }
    return k;
  };
  while (n > 0) {
    if (n >= 2 && Math.random() < 0.3) { groups.push([pick(), pick()]); n -= 2; }
    else { groups.push([pick()]); n--; }
  }
  return groups;
}
