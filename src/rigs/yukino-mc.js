// 雪乃的方塊人皮膚。照 art/pixel/yukino.png：淡藍長直髮＋雪花髮夾、藍圍巾、深藍長大衣（淺藍滾邊、銀扣）、
// 白裙、黑褲襪、白色長靴、黑色重機槍。骨架和臉的預設貼圖在 mc-base.js
import { mcRig, rows, bands, longHair } from './mc-base.js';

const PAL = {
  s: '#fbdcc8', d: '#e6b8a4',
  H: '#a8d4f8', h: '#7fb2e6', L: '#d8eeff',       // 頭髮
  N: '#1c2a58', n: '#121c3e', T: '#6aa0e8',       // 大衣、大衣裡面／陰影、淺藍滾邊
  U: '#2444d8', u: '#1830a0',                     // 圍巾
  W: '#f4f6fa', w: '#ccd4e2',                     // 白（裙子、靴子）
  X: '#1a1c2c',                                   // 褲襪
  S: '#c8d0e0',                                   // 銀扣
  I: ['#e8f8ff', 'e'],                            // 雪花
  G: '#2a2c30', g: '#484a52',                     // 槍
};

const HEAD_IN = {
  fill: 's',
  front: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', 'dssssssd'],
  side:  ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'sHHHHHHH', 'ssHHHHHH', 'sdsHHHHH', 'ssHHHHHH', 'dsHHHHHH'],   // 第 0 欄靠臉
  back: rows(8, 'HHHHHHHH'), top: rows(8, 'HHHHHHHH'), bottom: rows(8, 'ssssssss'),
};
const HEAD_OUT = {
  front: ['HHHHHHHH', 'HLHHHHLH', 'HHHhHHHH', 'HhHHhH.H', 'H......H', 'H......H', 'H......H', 'h......h'],   // 長瀏海蓋到眼睛上緣
  side:  ['HHHHHHHH', 'HHLHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'hHHHHHHH', '.HHHHHHH', '.hHHHHHH', '..HHHHHH'],
  back:  ['HHHHHHHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH', 'HHhHHhHH', 'HHHHHHHH', 'HhHHHHhH', 'HHHHHHHH'],
  top:   ['HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH', 'HHLHHLHH', 'HHHHHHHH', 'HHHHHHHH', 'HHHHHHHH'],
};
const BODY_IN = {
  fill: 'N',
  // 大衣敞開，露出裡面的深色上衣和白裙；圍巾一端垂在胸前（角色的左邊）
  front: ['UUUUUUUU', 'NUUUUUUN', 'NSnnUUNN', 'NNnnUUNN', 'NSnnUUNN', 'NNnnUUNN', 'NSnSUUNN', 'NNnnuuNN', 'NSWWWWNN', 'NNWWWWNN', 'NSWWWWNN', 'NNWWWWNN'],
  back:  ['UUUUUUUU', ...rows(11, 'NNNNNNNN')],
  side:  ['UUUU', ...rows(11, 'NNNN')],
  top:   rows(4, 'UUUUUUUU'), bottom: rows(4, 'XXXXXXXX'),
};
// 圍巾：身體最上面一圈外層，比脖子粗
const BODY_OUT = { front: ['UUUUUUUU', '.uUUUUu.'], back: ['UUUUUUUU', '.uUUUUu.'], side: ['UUUU'], top: ['UUUUUUUU', 'U......U', 'U......U', 'UUUUUUUU'] };
// 大衣下襬畫在大腿的外層：跟著腿一起擺，前面敞開、後面中間開衩
const COAT = {
  front: ['..N', '..N', '..N', '..N', '..T', '...'],
  back:  ['NNN', 'NNN', 'NNN', 'NNN', 'TTT', '...'],
  left:  ['NNN', 'NNN', 'NNN', 'NNN', 'TTT', '...'],
};

export default mcRig({
  id: 'yukino-mc', name: '雪乃', pal: PAL,
  head: {
    in: HEAD_IN, out: HEAD_OUT,
    extra(v) {      // 雪花髮夾（角色的左邊）
      const I = PAL.I[0];
      v.dot(2, 29, 4, I, 'e').dot(1, 29, 4, I, 'e').dot(3, 29, 4, I, 'e').dot(2, 30, 4, I, 'e').dot(2, 28, 4, I, 'e').dot(2, 29, 5, '#ffffff', 'e');
    },
  },
  body: { in: BODY_IN, out: BODY_OUT },
  armUp: bands('NNNNNN'),
  armLo: bands('NNNNTs'),            // 袖口淺藍滾邊、手
  thigh: bands('WWWXXX'),            // 白裙、褲襪
  thighOut: COAT,
  shin: bands('XWWWWn', { front: ['XXX', 'WTW', 'WWW', 'WWW', 'WWW', 'nnn'], back: ['XXX', 'WUW', 'WUW', 'WUW', 'WUW', 'nnn'] }),   // 白色長靴，後面一條藍線
  gun: {
    hand: 'R', thick: 2, gr: 1, mr: 1, per: 0.11,
    rows: ['...gg.........',
           'GGGGGGGGgggggg',
           'GGGGGGG...g...',
           '.GGG......g...',
           '.GGG..........'],
  },
  parts: {
    ...longHair(PAL, { c: 'H', d: 'h', y1: 16, y2: 8 }),
  },
  face: { colors: { k: '#1a2440', r: '#2850c8', q: '#6aa0f0', R: '#102060', b: '#5a80b8', m: '#a05058' } },
});
