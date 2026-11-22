# 可動方塊模型（voxel rig）

把手排的方塊角色拆成部位、綁上關節，讓它能用程式算出來的動作動起來，臉上的方塊可以換排列來換表情和嘴形。
目前只有朱音（akane）。預覽頁：`voxel-rig.html`。

| 檔案 | 內容 |
|---|---|
| `src/voxel-rig.js` | 共用程式：排方塊工具、網格化、部位組裝、動作、頭髮物理、表情／眨眼／對嘴 |
| `src/rigs/akane.js` | 朱音的資料：部位、站姿、臉的排列、表情、嘴形對照 |
| `voxel-rig.html` | 預覽頁（手機直向可用） |

## 1. 拆法

```
root（腳底，整隻角色）
└ hips 骨盆（y=12）
  ├ thighL ─ shinL（膝蓋 y=8，含靴子）       thighR ─ shinR（鏡像）
  ├ skirt 裙子（腰 y=14）
  ├ ribbon1 ─ ribbon2  背後飄帶（會甩）
  └ torso 上身（腰 y=15）
    ├ bow 胸前蝴蝶結（發光）
    ├ upperArmL ─ lowerArmL ─ gunL ─ flashL（槍口火光，平常藏著）
    ├ upperArmR ─ lowerArmR ─ gunR ─ flashR（鏡像）
    └ head 頭（脖子 y=22，含頭髮、鬢角、耳朵、髮圈）
      ├ 臉的貼片：eyes / brows / mouth / blush 各種排列
      └ pony1 ─ pony2 ─ pony3  馬尾三節（會甩，越後面越軟）
```

- 每個部位是一個 `THREE.Group`，原點就是關節（pivot），轉它就是轉關節。
- 每個部位的方塊合成**一個網格**（同部位裡互相貼著的面不畫），發光的方塊另外一個網格。朱音整隻大約 40 個 draw call。
- 槍在 `lowerArm` 底下、樞紐在手腕，所以手垂下時槍口朝下，手抬平時槍口自然朝前；射擊時要微調只轉 `gun`。

## 2. 角色資料格式（`src/rigs/<id>.js`）

```js
export default {
  id: 'akane', name: '朱音',
  unit: 32,                     // 身高幾格（決定一格多大：s = 身高 / unit）
  parts: {                      // 上層要寫在下層前面
    thighL: {
      parent: 'hips',           // 不寫＝掛在 root
      pivot: [1.5, 12, -0.5],   // 關節位置，跟方塊同一套座標
      build(v) { v.box(1, 2, 8, 11, -1, 0, '#f6cdb0'); },   // 用絕對座標排方塊
    },
    thighR: { mirror: 'thighL' },        // 左右鏡像：x 反過來，上層名字的 L 自動換成 R
    pony2: { parent: 'pony1', pivot: [...], dangle: { k: 55, damp: 6, gain: 0.03 }, build(v) {...} },
    flashL: { parent: 'gunL', pivot: [...], hidden: true, build(v) {...} },
  },
  rest: { upperArmL: { z: 0.22 }, ... },  // 站姿：所有動作都從這裡開始加
  face: {...}, expressions: {...}, visemes: {...},
  clips: {...},                 // （可選）換掉或新增這個角色專用的動作
};
```

**座標**：`+x`＝角色的左手邊、`+y` 往上（0＝腳底）、`+z`＝臉朝的方向。方塊 `(x,y,z)` 佔 `x±0.5、y..y+1、z±0.5`。身體中線在 `x=0, z=-0.5`。

**排方塊工具**（`build(v)` 的 `v`）：
`box(x0,x1,y0,y1,z0,z1,顏色,模式)`、`sym(...)` 左右對稱、`dot(x,y,z,...)`、`clear(...)`、`spike(x,y,z, dx,dy,dz, 步數, 顏色, 粗細)` 往尖端變細的刺（頭髮用）。
模式：`'n'` 一般、`'g'` 半透明、`'e'` 發光。

**會甩的部位 `dangle`**：彈簧＋慣性。關節在世界裡往哪加速，部位就往反方向甩；還會受重力（倒地時馬尾會垂到地上）。
參數：`k` 彈性（大＝硬）、`damp` 阻尼、`gain` 甩的力道、`grav` 重力、`limit` 最大角度（弧度）、`maxAcc` 加速度上限（被打飛時不要甩過頭）。

### 臉：換方塊排列

臉是貼在 `head` 前面的薄片，分四層，每一層有好幾種排列，**一次只顯示一種**：

```js
face: {
  part: 'head', x0: -4, z: 3.5,            // 最左一格的 x；貼在臉的表面（z=3.5）
  colors: { k: '#3a0a12', r: '#c01018', w: '#ffffff', m: '#7a1f2a', ... },
  blinkEyes: 'closed',                      // 眨眼時換成哪一種眼睛
  layers: {
    eyes: { y: 28, variants: {              // y＝第一列在哪一格高
      open:  ['.kk...kk.', '.wr...wr.', '.rR...rR.', '.qq...qq.'],
      happy: ['.........', '.kk...kk.', 'k..k.k..k', '.........'],
      ...
    }},
    brows: { z: 3.5, depth: 1.1, variants: { angry: { y: 30, rows: [...] }, ... } }, // 眉毛疊在瀏海前面
    mouth: { y: 24, variants: { rest: [...], big: [...], ... } },
    blush: { y: 24, variants: { on: ['pp.....pp'] } },
  },
},
expressions: {                               // 表情＝每層用哪一種
  normal: { eyes: 'open', brows: 'normal', mouth: 'rest' },
  smile:  { eyes: 'happy', brows: 'normal', mouth: 'smile', blush: 'on', blink: false },
  ...
},
visemes: { closed: 'rest', small: 'small', big: 'big', i: 'i', u: 'u' },  // 對嘴的五種嘴形 → 這個角色的排列
```

每一個字元＝一格方塊，`.` 是空的；左到右對應 `x0, x0+1, ...`，上到下對應 `y, y-1, ...`。
要加新表情：在某一層加一種排列，再在 `expressions` 組合起來，不用改程式。

朱音目前有：
- 表情：普通 normal、笑 smile、生氣 angry、驚訝 surprised、痛 pain、閉眼 blink、昏倒 ko
- 嘴形：閉 closed、小開 small、大開 big、ㄧ i、ㄨ u（另外還有表情用的 smile、frown、grit、wavy）

## 3. 程式介面

```js
import { buildRig } from './src/voxel-rig.js';
import akane from './src/rigs/akane.js';

const rig = buildRig(akane, 1.35);   // 身高（世界單位）
scene.add(rig.object);               // 面向 +z、腳底 y=0，跟 makeUnitMesh 一樣
rig.update(dt);                      // 每一幀

rig.play('walk');                    // idle walk run shoot hurt down
rig.play('hurt', { next: 'shoot' }); // 一次性的動作播完接什麼
rig.setExpression('angry');
rig.mouthOverride = 'big';           // 手動指定嘴形（null＝跟表情）
rig.say('全部給我趴下！', 9);         // 整句對嘴（每秒 9 字），回傳秒數
rig.speakChar('趴');                 // 打字機每打一個字呼叫一次
rig.autoBlink = true; rig.physics = true;
rig.parts.head.group                 // 任何部位的 Group，要掛東西（例如特效）可以掛上去
```

**動作**是程式算的姿勢：`fn(t, P)`，`P('部位')` 拿到 `{x, y, z（轉角，弧度）, px, py, pz（位移，格）, visible}`，在站姿上加減。
切換動作時會用 0.2 秒淡入（受傷 0.05 秒）。動作可以帶 `face`（例如射擊自動換生氣臉、受傷換痛、倒地換昏倒），播完就回到原本的表情。

| 動作 | 說明 |
|---|---|
| idle 待機 | 呼吸、頭微微晃、重心換腳 |
| walk 走路 / run 跑步 | 腿、膝蓋、手臂反向擺、身體扭轉、上下起伏；跑步前傾、擺幅大 |
| shoot 射擊 | 雙手抬平、左右輪流開火、後座力、槍口火光、前後腳站姿 |
| hurt 受傷 | 往後一震再回來（0.6 秒後接回原本的動作） |
| down 倒地 | 膝蓋一軟、往後倒、躺平後停住 |

**對嘴**：中文沒有拼音表，所以照字碼挑一個開口嘴形（看起來像在講話就好）；英文字母和注音照母音挑；標點停頓閉嘴。

## 4. 預覽頁網址參數

面板在背景時 rAF 會被節流，截圖時用參數把姿勢固定：

| 參數 | 意思 |
|---|---|
| `?clip=walk&t=0.4` | 動作和時間；有 `t` 就從 0 模擬到 t 然後凍結（頭髮物理也算進去） |
| `?expr=smile` `?mouth=big` | 表情、嘴形 |
| `?angle=0.6` | 角色轉幾度（弧度） |
| `?cam=face` `?board` `?zoom=1.5` `?y=1.1` | 看臉、地圖視角、拉近、鏡頭高度 |
| `?panel=0` | 收起按鈕面板 |
| `?sheet=expr` / `mouth` / `clip` | 一次排一整排（每個表情／嘴形／動作一隻） |

## 5. 加新角色

1. 複製 `src/rigs/akane.js` 成 `src/rigs/<id>.js`。
2. 部位名稱照約定（`hips torso head upperArmL/R lowerArmL/R gunL/R thighL/R shinL/R skirt`），共用的動作才會動到它們；多出來的部位（長髮、披風、帽子）自己取名字，加 `dangle` 就會甩。
3. 武器不一樣（例如光的步槍要兩手抱）就在 `clips` 裡寫一個這個角色的 `shoot` 蓋掉共用的。
4. 臉：位置跟朱音一樣的話 `face` 可以整段沿用，只換 `colors`（眼睛顏色）；臉比較大或比較小就改 `x0`、`y`、`z`。
5. `rest` 調站姿（手張多開、拿什麼）。
6. 在 `voxel-rig.html` 換掉 `DEF`（之後可以加角色選單）。

## 6. 接進遊戲的方案（這次還沒做）

遊戲現在的角色在 `src/units.js` 的 `makeUnitMesh`（面向 +z、腳底 y=0、約 1.35 高），動作是在 `main.js` 直接移動整個 mesh。建議分三步：

1. **外觀替換**：`makeUnitMesh` 裡，少女有 `rigs/<id>.js` 的就回傳 `buildRig(def, 1.35).object`，並把 rig 存在 `mesh.userData.rig`；沒有的維持舊模型。外框、選取光圈、血條這些掛在外層 group 上的東西不受影響。
2. **動作對接**：在主迴圈每幀對所有 `userData.rig` 呼叫 `update(dt)`；
   移動動畫開始時 `play('walk')`（衝刺用 `run`）、結束 `play('idle')`；
   開火時 `play('shoot')`，子彈飛行時間跑完回 `idle`；
   被打到 `play('hurt')`；死亡 `play('down')`（停在最後一格，屍體留在地上）。
   頭髮物理是看世界加速度算的，所以只要整個 mesh 在移動，馬尾就會自己甩。
3. **劇情對話**：`src/scene.js` 的打字機每打一個字呼叫 `rig.speakChar(ch)`；角色立繪如果改成從這個模型即時算（而不是事先渲染好的圖），表情可以跟台詞資料走（例如每句台詞加 `face: 'angry'`）。

效能：每隻約 40 個 draw call，戰場上十幾隻還可以；之後如果手機吃力，可以把同材質的部位合併到一個 `SkinnedMesh`（每個部位一根骨頭），一隻就降到 2～3 個 draw call，資料格式不用變。

## 7. 已知限制／之後可以做

- 倒地時馬尾和飄帶會穿進地板（沒有碰撞）。
- 臉只有正面有，側面、背面看不到表情（Q 版正常）。
- 對嘴是隨機嘴形，不是真的照發音；要更準可以接注音／拼音表。
- 手臂只有一格寬，從正面看細；如果覺得太細可以改成 2 格（只要改 `upperArmL`、`lowerArmL` 的 `build`）。
