// 場景組：每個地點用哪一種格局、長什麼樣子（地面、掩體的模型和貼圖、隱蔽區、燈光、地圖外的景）。
// 任務的名稱決定地點：設施用自己的名稱（夜市後巷、舊車站……），成員據點用她的設施（girls.js 的 FACILITIES），
// 莊園、決戰用莊園；物資作戰、阻止反制從城市的地點裡抽。野戰主題（林地、沙漠、雪原、城市廢墟）留著備用。
import { FACILITIES } from './girls.js';
import { THEMES } from './config.js';

// 一個場景組：
//   layout / params：layouts.js 的格局和參數
//   day：白天的機率；sky / skyDay：天空顏色
//   floors：[主要, 第二種, 特殊] 地面，各是 [貼圖, 顏色]
//   full / half：沒標 tag 的掩體預設長什麼樣子
//   conceal：{ name 名稱, style 樣子（junk 雜物堆、dark 暗處、grass 高草、laundry 晾衣、tarp 帆布）, color }
//   wall：建築外牆 [貼圖, 顏色]；accent：招牌、燈籠的顏色
//   lights：燈的樣子（lantern 燈籠串、streetlamp 路燈、flood 探照燈、ceiling 天花板燈、candle 燭台、neon 霓虹）
//   backdrop：地圖外的景（city 街道建築、harbor 海和吊車、rail 鐵道圍籬、indoor 室內圍牆、estate 圍牆和樹林、field 野地）
export const KITS = {
  market: {
    label: '夜市', layout: 'street', params: { stalls: 0.9, deep: 2, shops: 1, stall: 'stall', kiosk: 'kiosk', shopInner: 'counter' },
    day: 0.1, sky: 0x14101c, skyDay: 0x9ec4e0,
    floors: [['asphalt', 0x4a4a50], ['pavers', 0x8a8070], ['tiles', 0xb8a890]],
    full: 'bldg', half: 'stall', wall: ['plaster', 0xb8a890], accent: 0xff4060,
    conceal: { name: '雜物堆', style: 'junk', color: 0x6a5a48 }, lights: 'lantern', backdrop: 'city',
  },
  apartments: {
    label: '老公寓', layout: 'street', params: { stalls: 0.15, deep: 3, shops: 2, stall: 'cart', kiosk: 'bin', shopInner: 'shelf' },
    day: 0.4, sky: 0x161a24, skyDay: 0xa8c0d0,
    floors: [['asphalt', 0x505258], ['pavers', 0x7a7a78], ['woodfloor', 0x8a6a48]],
    full: 'bldg', half: 'scooter', wall: ['brick', 0x8a5a48], accent: 0x60c0ff,
    conceal: { name: '晾衣處', style: 'laundry', color: 0x7a7468 }, lights: 'streetlamp', backdrop: 'city',
  },
  dock: {
    label: '碼頭', layout: 'yard', params: { stack: 'container', depot: true, halfs: ['pallet', 'barrel', 'crate'] },
    day: 0.35, sky: 0x101820, skyDay: 0x9cc0d8,
    floors: [['concrete', 0x6a6a68], ['hazard', 0], ['planks', 0x7a6048]],
    full: 'container', half: 'pallet', wall: ['shutter', 0x7a8a90], accent: 0xffb040,
    conceal: { name: '貨櫃陰影', style: 'dark', color: 0x303438 }, lights: 'flood', backdrop: 'harbor',
  },
  station: {
    label: '舊車站', layout: 'yard', params: { stack: 'container', rail: true, halfs: ['crate', 'bench', 'bin'] },
    day: 0.3, sky: 0x141820, skyDay: 0xa8c4d8,
    floors: [['concrete', 0x707070], ['pavers', 0x9a9488], ['rail', 0]],
    full: 'container', half: 'crate', wall: ['brick', 0x7a5040], accent: 0x60ff90,
    conceal: { name: '月台陰影', style: 'dark', color: 0x2c3036 }, lights: 'streetlamp', backdrop: 'rail',
  },
  junkyard: {
    label: '廢車場', layout: 'yard', params: { stack: 'carpile', halfs: ['tire', 'barrel', 'car'] },
    day: 0.5, sky: 0x18161a, skyDay: 0xb4b8b0,
    floors: [['gravel', 0x6a6458], ['asphalt', 0x4a4a4a], ['grass', 0x4a5a30]],
    full: 'carpile', half: 'tire', wall: ['shutter', 0x6a5a48], accent: 0xffa030,
    conceal: { name: '廢鐵堆', style: 'junk', color: 0x5a5048 }, lights: 'flood', backdrop: 'field',
  },
  kennel: {
    label: '狗場', layout: 'yard', params: { stack: 'kennel', halfs: ['doghouse', 'barrel', 'crate'] },
    day: 0.4, sky: 0x16141a, skyDay: 0xb0b8a8,
    floors: [['grass', 0x4a5a30], ['gravel', 0x7a7060], ['concrete', 0x6a6a68]],
    full: 'kennel', half: 'doghouse', wall: ['planks', 0x6a5038], accent: 0xff6040,
    conceal: { name: '高草', style: 'grass', color: 0x6a8a38 }, lights: 'flood', backdrop: 'field',
  },
  parking: {
    label: '地下停車場', layout: 'hall', params: { fill: 'car', extra: ['barrel', 'cart'] },
    day: 0, indoor: true, sky: 0x0c0e12,
    floors: [['asphalt', 0x4a4c52], ['parking', 0x4a4c52], ['hazard', 0]],
    full: 'pillar', half: 'car', wall: ['concrete', 0x8a8a88], accent: 0x60ff80,
    conceal: { name: '燈壞掉的暗處', style: 'dark', color: 0x1a1c20 }, lights: 'ceiling', backdrop: 'indoor',
  },
  casino: {
    label: '賭場', layout: 'hall', params: { fill: 'table', tall: 'slot', vault: true, extra: ['table', 'bench'] },
    day: 0, indoor: true, sky: 0x100810,
    floors: [['carpet', 0x6a1020], ['woodfloor', 0x6a4028], ['tiles', 0xd8d0b8]],
    full: 'pillar', half: 'table', wall: ['plaster', 0x5a1828], accent: 0xffd040,
    conceal: { name: '燈光照不到的角落', style: 'dark', color: 0x200810 }, lights: 'neon', backdrop: 'indoor',
  },
  fightclub: {
    label: '地下拳場', layout: 'hall', params: { fill: 'bench', ring: true, extra: ['crate', 'barrel'] },
    day: 0, indoor: true, sky: 0x0c0a0a,
    floors: [['concrete', 0x5a5654], ['planks', 0x6a5038], ['carpet', 0x2a3a6a]],
    full: 'pillar', half: 'crate', wall: ['brick', 0x5a4038], accent: 0xff3030,
    conceal: { name: '暗處', style: 'dark', color: 0x181412 }, lights: 'ceiling', backdrop: 'indoor',
  },
  theatre: {
    label: '舊劇場', layout: 'hall', params: { fill: 'seat', extra: ['seat', 'crate'] },
    day: 0, indoor: true, sky: 0x0e0a10,
    floors: [['carpet', 0x5a1a28], ['woodfloor', 0x6a4a30], ['woodfloor', 0x8a6040]],
    full: 'pillar', half: 'seat', wall: ['plaster', 0x6a3040], accent: 0xffc060,
    conceal: { name: '布幕陰影', style: 'tarp', color: 0x5a1020 }, lights: 'candle', backdrop: 'indoor',
  },
  office: {
    label: '辦公樓', layout: 'interior', params: { furn: ['desk', 'desk', 'shelf'], heavy: 'rack', glass: 0.45 },
    day: 0.4, indoor: true, sky: 0x101418, skyDay: 0x9ab0c0,
    floors: [['tiles', 0x9a9a98], ['carpet', 0x3a4a5a], ['tiles', 0x9a9a98]],
    full: 'wall', half: 'desk', wall: ['plaster', 0xc8c4b8], accent: 0x60c0ff,
    conceal: { name: '熄燈的隔間', style: 'dark', color: 0x202428 }, lights: 'ceiling', backdrop: 'indoor',
  },
  factory: {
    label: '工廠', layout: 'interior', params: { furn: ['crate', 'rack', 'barrel'], heavy: 'machine', glass: 0.1 },
    day: 0.4, indoor: true, sky: 0x12100e, skyDay: 0xa8a8a0,
    floors: [['concrete', 0x6a6864], ['metal', 0x5a5e62], ['hazard', 0]],
    full: 'wall', half: 'crate', wall: ['brick', 0x7a4a3a], accent: 0xffa030,
    conceal: { name: '蒸氣', style: 'dark', color: 0x40403c }, lights: 'ceiling', backdrop: 'indoor',
  },
  laboratory: {
    label: '工坊', layout: 'interior', params: { furn: ['shelf', 'desk', 'barrel'], heavy: 'cauldron', glass: 0.2 },
    day: 0.2, indoor: true, sky: 0x100c14, skyDay: 0xa0a0b0,
    floors: [['woodfloor', 0x5a4030], ['stone', 0x6a6070], ['tiles', 0x5a4a6a]],
    full: 'wall', half: 'shelf', wall: ['stone', 0x6a6070], accent: 0xb060ff,
    conceal: { name: '魔藥煙霧', style: 'dark', color: 0x40304a }, lights: 'candle', backdrop: 'indoor',
  },
  church: {
    label: '教堂', layout: 'garden', params: { main: 'church', rows: 'grave', halfs: ['grave', 'flowerbed'], mainInner: 'bench' },
    day: 0.3, sky: 0x100c18, skyDay: 0xa8b8c8,
    floors: [['grass', 0x3a4a2c], ['gravel', 0x8a8478], ['stone', 0x7a7480]],
    full: 'hedge', half: 'grave', wall: ['stone', 0x8a8490], accent: 0xb060ff,
    conceal: { name: '高草', style: 'grass', color: 0x5a7030 }, lights: 'candle', backdrop: 'estate',
  },
  tower: {
    label: '望遠鏡塔', layout: 'garden', params: { main: 'tower', halfs: ['rock', 'flowerbed', 'bench'] },
    day: 0.6, sky: 0x0e1220, skyDay: 0x98c0e8,
    floors: [['grass', 0x4a6a34], ['gravel', 0x8a8478], ['stone', 0x8a8480]],
    full: 'tree', half: 'rock', wall: ['stone', 0x9a9488], accent: 0x60c0ff,
    conceal: { name: '高草', style: 'grass', color: 0x6a8a38 }, lights: 'streetlamp', backdrop: 'estate',
  },
  manor: {
    label: '莊園', layout: 'garden', params: { main: 'manor', fountain: true, halfs: ['flowerbed', 'bench', 'statue'] },
    day: 0.2, sky: 0x120c14, skyDay: 0xa0b8d0,
    floors: [['grass', 0x3e5a30], ['gravel', 0x9a9080], ['woodfloor', 0x6a4028]],
    full: 'hedge', half: 'flowerbed', wall: ['plaster', 0xd8ccb8], accent: 0xffd060,
    conceal: { name: '花叢', style: 'grass', color: 0x5a7a38 }, lights: 'streetlamp', backdrop: 'estate',
  },
};
// 野戰主題（備用）：舊的四個主題包成場景組，用原本的格局和模型
THEMES.forEach((t, i) => {
  KITS['field' + i] = {
    label: t.name, layout: 'field', params: {}, legacy: t, day: 1, sky: t.sky, skyDay: t.sky,
    floors: [['concrete', t.floor], ['concrete', t.floorAlt], ['concrete', t.floor]],
    full: t.fullStyle === 'tree' ? 'tree' : 'wall', half: t.halfStyle === 'rock' ? 'rock' : t.halfStyle === 'sandbag' ? 'sandbag' : 'crate',
    wall: ['concrete', t.full], accent: 0xffd060,
    conceal: { name: t.concealName, style: 'grass', color: t.conceal }, lights: null, backdrop: 'field',
  };
});

// 地點名稱 → 場景組
const PLACE = {
  夜市後巷: 'market', 老舊公寓: 'apartments', 洗錢洗衣店: 'apartments',
  碼頭倉庫: 'dock', 貨運站: 'dock', 武器倉庫: 'dock', 舊車站: 'station', 廢車場: 'junkyard', 狗場: 'kennel',
  地下停車場: 'parking', 賭場金庫: 'casino', 地下拳場: 'fightclub', 舊劇場: 'theatre',
  商業大樓: 'office', 電話交換所: 'office', 廢棄工廠: 'factory', 詛咒娃娃工廠: 'factory',
  魔藥工坊: 'laboratory', 香水工坊: 'laboratory', 地下藥局: 'laboratory',
  黑彌撒教堂: 'church', 望遠鏡塔: 'tower', 莊園: 'manor',
};
const CITY = ['夜市後巷', '老舊公寓', '碼頭倉庫', '貨運站', '舊車站', '地下停車場', '廢棄工廠', '商業大樓'];
const pick = a => a[Math.floor(Math.random() * a.length)];

// 這場任務在哪裡：回傳 { kit（場景組 id）, place（地點名稱）, day（白天？）}
export function siteFor(op) {
  let place;
  if (op.kind === 'facility' && PLACE[op.name]) place = op.name;
  else if (op.kind === 'boss' && FACILITIES[op.member]) place = pick(FACILITIES[op.member]);
  else if (op.kind === 'manor' || op.kind === 'finale') place = '莊園';
  else if (PLACE[op.name]) place = op.name;
  else place = pick(CITY);
  const kit = PLACE[place];
  return { kit, place, day: Math.random() < KITS[kit].day };
}
// 存檔、顯示用：S.theme 是這個物件（name 給畫面上方顯示，concealName 給隱蔽區的說明）
export function themeOf(site) {
  const k = KITS[site.kit] || KITS.field0;
  const time = k.indoor ? '室內' : site.day ? '白天' : '夜晚';
  return { ...site, k, time, name: `${site.place || k.label}・${time}`, concealName: k.conceal.name };
}
// 舊存檔（只有主題編號）→ 野戰場景組
export const legacySite = i => ({ kit: 'field' + (THEMES[i] ? i : 0), place: (THEMES[i] || THEMES[0]).name, day: true });
