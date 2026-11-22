// 楓的方塊人皮膚。照 art/pixel/kaede.png：棕色刺刺短髮、額頭上的橘色護目鏡、橘色短外套＋黑色小可愛、
// 斜背的榴彈彈帶、露腰、橄欖色工作褲、棕色半指手套和靴子、榴彈發射器、預設露齒笑。骨架和臉的預設貼圖在 mc-base.js
import { mcRig, rows, bands } from './mc-base.js';

const PAL = {
  s: '#f0b488', d: '#d09468',
  H: '#8a3a18', h: '#642610', L: '#a85028',       // 頭髮
  O: '#e87020', o: '#b85010',                     // 外套橘、深橘
  K: '#2a2420',                                   // 黑色小可愛
  T: '#5a3a20', t: '#8a6a44',                     // 彈帶、榴彈
  P: '#8a7a40', p: '#6a5c2c',                     // 工作褲、陰影／口袋
  Q: '#4a3418', q: '#c8c8c8',                     // 皮帶、皮帶扣
  V: '#5a3a24',                                   // 手套
  B: '#4a3020', b: '#2c1c0e',                     // 靴子、鞋底
  Z: ['#ffb020', 'e'], z: '#34302c',              // 護目鏡鏡片（發光）、鏡框
  G: '#2c2c30', g: '#18181c',                     // 槍、槍口
};

const HEAD_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsshHHHH'],   // 第 0 欄靠臉
  back: [...rows(7, 'HHHHHHHH'), 'hHssssHh'], top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['HHHHHHHH', 'zZZzzZZz', 'hzzHHzzh', 'H.h..h.H', 'H......H', 'h......h', '........', '........'],   // 護目鏡推到額頭上
  side:  ['HHHHHHHH', 'zzzzzzzz', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.hHHhHHH', '..h.HhHH', '.....H.h'],
  back:  ['HHHHHHHH', 'zzzOOzzz', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HhHHHHhH', 'hH.hh.Hh', '.h....h.'],
  top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHLLHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'],
};
const BODY_IN = {
  fill: 'O',
  // 外套敞開露出小可愛，彈帶從她的左肩斜到右腰；下面露腰、皮帶、工作褲
  front: ['OOOssOOO', 'OOKKKtTO', 'OOKKtTOO', 'OOKtTKOO', 'OOtTKKOO', 'osssssso', 'ssssssss', 'ssssssss', 'QQQqqQQQ', 'PPPPPPPP', 'PpPPPPpP', 'PPPPPPPP'],
  back:  ['OOOOOOOO', 'OtTOOOOO', 'OOtTOOOO', 'OOOtTOOO', 'OOOOtTOO', 'osssssso', 'ssssssss', 'ssssssss', 'QQQQQQQQ', 'PPPPPPPP', 'PppPPppP', 'PPPPPPPP'],
  side:  [...rows(5, 'OOOO'), 'ssss', 'ssss', 'ssss', 'QQQQ', 'PPPP', 'PPPP', 'PPPP'],
  top:   ['OOOOOOOO', 'OOOssOOO', 'OOOssOOO', 'OOOOOOOO'], bottom: rows(4, 'PPPPPPPP'),
};

export default mcRig({
  id: 'kaede-mc', name: '楓', pal: PAL,
  head: {
    in: HEAD_IN, out: HEAD_OUT,
    extra(v) {      // 往上、往兩邊炸開的髮尾
      v.box(-3, -2, 33, 33, -2, 0, PAL.H).box(0, 1, 33, 34, -1, 1, PAL.H).box(-1, -1, 33, 35, -3, -2, PAL.h).box(2, 2, 33, 33, -3, -2, PAL.H);
      for (const [a, b] of [[5, 6], [-6, -7]]) v.box(a, a, 26, 28, -2, 0, PAL.H).box(b, b, 27, 28, -2, -1, PAL.h).dot(a, 25, -1, PAL.h);
      v.box(-3, -2, 27, 28, -6, -6, PAL.h).box(1, 2, 26, 28, -6, -6, PAL.H).dot(-1, 29, -6, PAL.H);
    },
  },
  body: { in: BODY_IN },
  armUp: bands('OOOOOo'),            // 袖子捲到手肘
  armLo: bands('sssVVV', { bottom: rows(3, 'sss') }),   // 半指手套
  thigh: bands('PPPPPp', { left: ['PPP', 'PPP', 'PpP', 'PpP', 'PPP', 'ppp'] }),   // 側邊的大口袋
  shin: bands('PPpBBb', { front: ['PPP', 'PPP', 'ppp', 'BOB', 'BOB', 'bbb'] }),   // 褲腳塞進靴子、橘色鞋帶
  gun: {
    hand: 'R', thick: 2, gc: 3, gr: 1, mr: 1, per: 1.0,
    rows: ['...GGGGGGGg',
           'GGGGOOOGGGg',
           'G..G.OOO...'],
  },
  // 她平常就是露齒笑
  expressions: { normal: { eyes: 'open', brows: 'none', mouth: 'grin' } },
  face: { colors: { k: '#3a1a08', r: '#d07010', q: '#ffb040', R: '#703000', b: '#642610', m: '#8a3a28' } },
});
