# 可動方塊模型（voxel rig）

把方塊角色拆成部位、綁上關節，讓它能用程式算出來的動作動起來，臉上的貼圖可以換來換表情和嘴形。
七個少女、十種敵人、七名魔女和教母都有方塊人版本。預覽頁：`voxel-rig.html`（上面三排按鈕切換角色，或網址加 `?model=hikari`；`?sheet=cast`／`enemies`／`witches` 整組排一排）。

| 角色 | 檔案 | 特別的部位 |
|---|---|---|
| 朱音 | `src/rigs/akane-mc.js` | 高馬尾、背後飄帶、雙槍（兩手各一把，用共用的雙槍射擊動作） |
| 光 | `src/rigs/hikari-mc.js` | 長直髮、半透明紫紗、步槍 |
| 雪乃 | `src/rigs/yukino-mc.js` | 長直髮、圍巾、長大衣（下襬畫在大腿外層，跟著腿擺）、重機槍 |
| 小桃 | `src/rigs/momo-mc.js` | 個子小（`scale: 0.88`）、雙馬尾、三管大砲、預設臭臉 |
| 千夏 | `src/rigs/chinatsu-mc.js` | 披風、右眼的發光鏡片（臉上多一層 `lens`）、狙擊槍 |
| 楓 | `src/rigs/kaede-mc.js` | 刺刺頭、護目鏡、沒有裙子、榴彈發射器、預設露齒笑 |
| 詩織 | `src/rigs/shiori-mc.js` | 長捲髮、花冠、一對小翅膀、衝鋒槍（垂著拿）、預設微笑 |
| 朱音（參考圖堆疊版） | `src/rigs/akane.js` | 4 頭身，形狀和顏色從像素三視圖堆出來。評價不好，先保留不用。第 1 節以後講的是這一版 |

**敵人**（`src/rigs/enemies-mc.js`，沒有參考圖，照遊戲裡現在的造型和 `config.js` 的顏色）：槍手 `gunman`、狂徒 `zealot`、小弟 `conscript`、幹部 `officer`、打手 `brawler`（球棒，攻擊動作是揮）、狙擊手 `sniper`、機槍手 `mg`、重裝兵 `brute`、人偶 `doll`、稻草人 `scarecrow`。前七種共用檔案裡的 `goon()` 樣板（西裝、襯衫領帶、發光的黃眼睛），每一種只寫不一樣的地方。
使魔巢穴、使魔、烏鴉不是人形，沒有做。

**魔女**（`src/rigs/witches-mc.js`，一樣沒有參考圖）：薇歐拉 `b_eye`、蕾貝卡 `b_exec`、莫妮卡 `b_book`、莉莉絲 `b_sis`、卡蜜拉 `b_perfume`、艾琳娜 `b_hound`、桃樂絲 `b_puppet`、教母瑪格麗特 `b_mother`。代號跟 `config.js` 的 `ENEMY_TYPES` 一樣。

所有版本共用同一套動作、頭髮物理、表情和對嘴（`src/voxel-rig.js`）。方塊人共用的骨架在 `src/rigs/mc-base.js`。

## 方塊人（`src/rigs/mc-base.js` ＋ 每人一個 `src/rigs/<id>-mc.js`）

**原則**：骨架、盒子尺寸、臉的預設貼圖、拿槍的方式全部共用；每個角色的檔案只有「皮膚」（調色盤＋每個面的字元圖）和她特有的部位。

- **比例**：一格 = 皮膚的一個像素。頭 8×8×8、身體 8×12×4、手 2×12×3、腳 3×12×3（比 Minecraft 原本的細，兩腿中間空兩格），總高 32 格。手腳各切成上下兩段（手肘、膝蓋），動作才彎得起來。靴子跟腿一樣粗（畫在內層）。
- **內層和外層**：內層是盒子本身；外層貼在外面多凸一格，只有畫了的格子才有方塊。外層用在頭髮（瀏海、鬢髮）、裙子（身體最下面三列，再往下是掛在骨盆上的獨立一圈 `skirt`）、圍巾、大衣下襬。
- **字元圖怎麼看**：`front`／`back` 是從外面正對著那一面看，上到下、左到右；`side`（或分開寫 `left`／`right`）第 0 欄靠臉那一邊；`top`／`bottom` 第 0 列是後面。`.` 是不畫。調色盤裡 `['#顏色', 'e']` 是發光、`['#顏色', 'g']` 是半透明。
- **寬度是偶數格**（`evenX: true`）：中線在 x=-0.5，左右鏡像用 x → -x-1，程式會把整隻往右挪半格對回中間。

### 角色檔的欄位（丟給 `mcRig({...})`）

| 欄位 | 內容 |
|---|---|
| `id`、`name`、`pal`、`scale` | 代號、名字、調色盤（字元 → 顏色）、個子（預設 1） |
| `head: { in, out, extra(v) }` | 頭的內層、外層（頭髮）、另外加的方塊（髮飾、帽子）。`headOf('long'｜'bob'｜'updo'｜'short'｜'bald')` 給現成的髮型；帽子有 `fedora()`、`witchHat()` |
| `body: { in, out }` | 身體的內層、外層。`torsoOf({ front, back, side })` 可以只畫正面，背面和側面給一串字 |
| `skirt: { rows, faces }` | 掛在骨盆上的一圈裙襬（空心），`rows` 是幾列高。沒有裙子就不寫 |
| `armUp`、`armLo`、`thigh`、`shin` | 手腳的皮膚。通常寫 `bands('WWssKW')`：由上到下每一列整圈一個顏色；第二個參數可以蓋掉某一面 |
| `thighOut`、`shinOut`、`armUpOut`、`armLoOut` | 手腳的外層（雪乃的大衣下襬） |
| `gun: { hand, rows, gc, gr, mr, thick, carry, per }` | 槍：`rows` 是槍的側面圖（槍口朝右）。握把那一欄（`gc`）緊貼在手的前面，握把正上方那一列（`gr`，機匣）壓在前臂上緣，所以握把左邊的欄（槍托）會沿著前臂往手肘伸，右邊是槍管。`mr` 槍口在哪一列、`thick` 幾格厚、`hand: 'both'` 是雙槍、`carry: false` 是垂著拿（預設端在腰邊）、`per` 幾秒一發、`melee: true` 是近戰武器。會自動做出槍、槍口火光、射擊動作。現成的槍在 `GUNS`（`tommy` `lmg` `sg` `sn` `pistol` `magnum` `dbl` `bat`） |
| `thighWide`、`shinWide` | 長裙／長大衣，用 `...gown('CCCCCCCCCc..', 1)` 產生：12 個字是由上到下每一列的顏色，第二個參數是前面敞開幾格。畫在腿的外層，跟著腿擺 |
| `parts` | 其他部位，直接併進去：馬尾、披風、翅膀。`longHair(pal, {...})` 會給兩節會甩的長髮，`plane(v, 字元圖, pal, {...})` 排一片直立的薄片 |
| `rest`、`clips`、`expressions` | 站姿、動作、表情的覆寫（小桃把 `normal` 換成臭臉） |
| `face: { colors, layers }` | 臉：換顏色，換掉或新增貼圖（跟預設的合併） |

### 臉（表情是貼圖，可以直接改）

預設的貼圖在 `mc-base.js` 的 `FACE`：每一層（`eyes`、`brows`、`mouth`、`blush`）有好幾張貼圖，每張是一組字元圖，一個字元一格、`.` 是透明、顏色在 `colors`。眼睛在第 1–2、5–6 欄，三列高；嘴巴兩列。`EXPRESSIONS` 決定每個表情用哪幾張，`visemes` 決定對嘴的五種嘴形各用哪張嘴巴。

- 改 `mc-base.js` 的貼圖：七個人一起變。
- 只改一個人：在她的檔案寫 `face: { layers: { eyes: { variants: { open: [...] } } } }`，同名的貼圖會蓋掉預設。
- 每個人的瞳孔、睫毛、眉毛顏色寫在她的 `face.colors`（`k` 睫毛、`r`／`q`／`R` 瞳孔、`b` 眉毛、`m` 嘴）。
- 多一層永遠顯示的東西（千夏的鏡片）：在 `face.layers` 加一層，裡面放一張叫 `on` 的貼圖。

改完重新整理預覽頁就看得到，「看臉」按鈕可以拉近。

### 加新的方塊人

複製一個最像的角色檔，改調色盤和字元圖，到 `voxel-rig.html` 的 `CAST` 加一行（敵人加在 `enemies-mc.js` 的 `ENEMIES`、魔女加在 `witches-mc.js` 的 `WITCHES`，預覽頁會自己出現）。參考圖在 `art/pixel/<id>.png`（朱音和光以外的五張目前只在 main 上）。

| 檔案 | 內容 |
|---|---|
| `src/voxel-rig.js` | 共用程式：排方塊工具、網格化、部位組裝、動作、頭髮物理、表情／眨眼／對嘴 |
| `src/rigs/mc-base.js` | 方塊人共用的骨架、臉的預設貼圖、單手槍 |
| `src/rigs/<id>-mc.js` | 每個人的方塊人皮膚 |
| `src/rigs/akane.js` | 朱音（參考圖堆疊版）的資料：部位、站姿、臉的排列、表情、嘴形對照 |
| `art/rig_carve.py` | 分部位剪影堆疊：照部位框從像素三視圖堆出每個部位的方塊 |
| `art/pixel/akane.rig.json` | 朱音的部位框（哪個部位在三視圖的哪裡） |
| `src/rigs/akane.carved.js` | 上面兩個產生的方塊資料（不要手改，改規格重跑） |
| `voxel-rig.html` | 預覽頁（手機直向可用） |

## 1. 形狀怎麼來的：分部位剪影堆疊＋手修

朱音試過三種做法：

1. **手排 Q 版（32 格）**：好認，但比例跟參考圖差很多。
2. **手排、照參考圖量比例（48 格）**：比例對了，但輪廓還是「我畫的」，不是參考圖的。
3. **分部位剪影堆疊（現在用的）**：輪廓直接從參考圖的像素來。

第 3 種的做法（`art/rig_carve.py`）：

- 參考圖每 15 像素當一格，腳底是第 0 列、頭頂大約第 50 列（`unit: 48`）。
- 每個部位在規格檔裡有一個框：佔哪幾列（`y`）、左右和前後的搜尋範圍（`x`、`z`）。
- 框裡「正面剪影有、側面剪影也有」的格子就是這個部位的方塊；顏色正面取正面圖、背面取背面圖、側面取側面圖。
- **一個部位一個框**，所以手臂、腿、身體不會黏在一起（整隻一起堆的 `pixel2voxel.py` 會）。
- **扳直**：參考圖是 A 字站姿，手腳是斜的。`fx`／`sz` 指定每一列要平移多少才對得到參考圖，堆出來的手腳是直的；斜度改寫在 `rest`（站姿）裡，由骨架擺回去。
- **只收某些顏色**（`f`、`s`）：手臂只收膚色，才不會吃到旁邊的衣服；身體的側面被手臂擋住，就設成「不是背景都算」。
- **修圓**（`round`、`dome`）：兩張剪影交出來的截面是方的，用超橢圓修圓；頭頂另外往上收，才是圓頂。
- **堆出來的部位都用細一倍的格子**（`fine: 2`，每 7.5 像素一格；骨架和手排的部位是 15 像素一格）。臉寬 15 格、一隻眼睛 6×5 格，跟參考圖的比例一樣。`fine` 部位的 `build` 用細格子的座標，`pivot` 還是骨架的格子。
- **顏色直接用參考圖的**（規格檔的 `quant` 把顏色取整，不然會有上百種）：裙褶、金邊、領子、靴子的明暗、胸前的蝴蝶結都是圖上的像素。黑色描邊不收（改抓旁邊的顏色）。青色的格子在 `build` 裡用 `glow` 改成發光。
- **只存表面**：每格多記一個數字表示哪幾面露在外面，裡面是空的，檔案和面數都小很多。
- **臉直接從參考圖搬**（規格檔的 `face`）：眼睛、鼻子、嘴巴的框裡，跟膚色差很多的像素原樣變成貼片，一個取樣點一片。貼片用比頭再細一倍的格子（`fine: 4`，3.75 像素一片），因為參考圖一個像素大約 5～6 px。「普通」表情用的就是這一組（資料裡的 `REF('eyes')`）；笑、生氣、閉眼這些參考圖沒有的排列還是手畫（`EYES(...)`，用頭的格子畫再放大成 2×2 片）。`noSkin` 會略過皮膚的陰影色，才不會把眼睛旁邊的陰影也搬過來。
- **臉削平**（`cap`、`skin`）：臉那幾列的 z 削到同一個平面，眼睛嘴巴的位置塗回膚色，表情改用貼片。

幾個要另外處理的部位：

| 部位 | 做法 |
|---|---|
| 馬尾 | 兩張剪影交起來是實心的一整塊（從斜後方看像一片板子）。存成實心（`solid`），在 `build` 裡用 `keepNear(PONY)` 削成一根一根；每根刺的尖端是對著正面和側面的剪影抓的。沿前後切成三節才會甩 |
| 飄帶 | 正面被腿擋住，所以形狀只取側面（`f: "all"`），堆一條、另一條鏡像；從背面看往兩邊張開的角度寫在站姿裡 |
| 槍 | 只收槍的灰色（`f: "G"`），跟著前臂一起扳直 |
| 脖子 | 參考圖沒有（下巴貼著領子），是另外補的一小段 |
| 槍口火光、參考圖沒有的表情和嘴形 | 手排／手畫 |

**疊圖檢查**：`voxel-rig.html?overlay=front`（或 `side`、`back`）會用正交鏡頭把參考圖半透明疊在模型上，位置照格子對齊。`&op=0.5` 調透明度（0＝只看模型），`&ovh=1&ovy=1.4` 拉近到某個高度。改完規格重跑之後用它對一輪。

重跑：`python art/rig_carve.py art/pixel/akane.rig.json`

**故意跟參考圖不一樣的地方**（使用者要求）：肩膀放低一格、肩線削斜；頭抬高半格（資料裡的 `UP`），中間補一小段細脖子（參考圖的下巴直接貼著領子）。

## 2. 拆法

比例：大約 4 頭身，腿佔身高將近一半（靴子和膝蓋 0–13、大腿 14–22、裙子 23–27、上身 28–38、脖子 39–41、頭 41–52、馬尾到 64）。

```
root（腳底，整隻角色）
└ hips 骨盆（y=24）
  ├ thighL ─ shinL（髖 y=23、膝蓋 y=14，含靴子）   thighR ─ shinR（鏡像）
  ├ skirt 裙子（腰 y=27.5）
  ├ ribbon1 ─ ribbon2  腰後的大蝴蝶結和兩條飄帶（會甩）
  └ torso 上身（腰 y=28）
    ├ bow 胸前蝴蝶結（發光）
    ├ upperArmL ─ lowerArmL ─ gunL ─ flashL（肩 y=36.5、肘 y=30、槍的樞紐在手掌；flash 是槍口火光，平常藏著）
    ├ upperArmR ─ lowerArmR ─ gunR ─ flashR（鏡像）
    └ head 頭（脖子 y=41，細格子，含頭髮、鬢角、耳朵、髮圈）
      ├ 臉的貼片：eyes / brows / mouth / blush 各種排列
      └ pony1 ─ pony2 ─ pony3  馬尾三節（會甩，越後面越軟）
```

- 每個部位是一個 `THREE.Group`，原點就是關節（pivot），轉它就是轉關節。
- 每個部位的方塊合成**一個網格**（同部位裡互相貼著的面不畫），發光的方塊另外一個網格。朱音整隻大約 40 個 draw call。
- 槍在 `lowerArm` 底下、樞紐在手腕，所以手垂下時槍口朝下，手抬平時槍口自然朝前；射擊時要微調只轉 `gun`。

## 3. 角色資料格式（`src/rigs/<id>.js`）

```js
export default {
  id: 'akane', name: '朱音',
  unit: 48,                     // 身高幾格（決定一格多大：s = 身高 / unit）
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

**座標**：`+x`＝角色的左手邊、`+y` 往上（0＝腳底）、`+z`＝臉朝的方向。方塊 `(x,y,z)` 佔 `x±0.5、y..y+1、z±0.5`。朱音的身體中線在 `x=0, z=0`。

**解析度不同的角色可以共用動作**：動作裡的位移（`px/py/pz`）和頭髮物理的參數都是用「32 格身高」寫的，程式會依 `unit` 自動換算，所以 48 格的朱音和之後 32 格或 64 格的角色用同一套動作和 `dangle` 參數。

**排方塊工具**（`build(v)` 的 `v`）：
`box(x0,x1,y0,y1,z0,z1,顏色,模式)`、`sym(...)` 左右對稱、`dot(x,y,z,...)`、`clear(...)`、`spike(x,y,z, dx,dy,dz, 步數, 顏色, 粗細)` 往尖端變細的刺（頭髮用）。
堆出來的部位：`put(CARVED.thighL)` 放進一整包、`tint(格子 => 顏色)` 重新上色、`paint(範圍, 顏色)` 只改已經有的格子、`under(範圍, 顏色)` 只補空的格子。
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
    eyes: { y: 44, variants: {              // y＝第一列在哪一格高
      open:  ['.kk...kk.', '.wr...wr.', '.rR...rR.', '.qq...qq.'],
      happy: ['.........', '.kk...kk.', 'k..k.k..k', '.........'],
      ...
    }},
    brows: { z: 3.5, depth: 1.1, variants: { angry: { y: 46, rows: [...] }, ... } }, // 眉毛疊在瀏海前面
    mouth: { y: 40, variants: { rest: [...], big: [...], ... } },
    blush: { y: 40, variants: { on: ['pp.....pp'] } },
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

## 4. 程式介面

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

## 5. 預覽頁網址參數

面板在背景時 rAF 會被節流，截圖時用參數把姿勢固定：

| 參數 | 意思 |
|---|---|
| `?clip=walk&t=0.4` | 動作和時間；有 `t` 就從 0 模擬到 t 然後凍結（頭髮物理也算進去） |
| `?expr=smile` `?mouth=big` | 表情、嘴形 |
| `?angle=0.6` | 角色轉幾度（弧度） |
| `?cam=face` `?board` `?zoom=1.5` `?y=1.1` | 看臉、地圖視角、拉近、鏡頭高度 |
| `?panel=0` | 收起按鈕面板 |
| `?sheet=expr` / `mouth` / `clip` | 一次排一整排（每個表情／嘴形／動作一隻） |
| `?model=hikari` | 換角色：`akane`（預設）`hikari` `yukino` `momo` `chinatsu` `kaede` `shiori`，`carved` 是朱音的參考圖堆疊版 |
| `?sheet=cast` / `enemies` / `witches` | 少女／敵人／魔女整組排一排（可以再加 `&clip=shoot&t=0.2`） |

## 6. 加新角色

1. 準備像素三視圖 `art/pixel/<id>.png`（正面、側面朝右、背面，背景單色）。
2. 複製 `art/pixel/akane.rig.json`，改中線（`front`、`side`、`back` 的像素 x）和腳底（`feet`），再照格子圖調每個部位的框。手腳是斜的就填 `fx`／`sz`。
3. 跑 `python art/rig_carve.py art/pixel/<id>.rig.json`，得到 `src/rigs/<id>.carved.js`。
4. 複製 `src/rigs/akane.js` 成 `src/rigs/<id>.js`：堆出來的部位用 `put`，樞紐填關節位置；頭髮、披風、武器這些手排。
   部位名稱照約定（`hips torso head upperArmL/R lowerArmL/R gunL/R thighL/R shinL/R skirt`），共用的動作才會動到它們；多出來的部位自己取名字，加 `dangle` 就會甩。
5. 武器不一樣（例如光的步槍要兩手抱）就在 `clips` 裡寫一個這個角色的 `shoot` 蓋掉共用的。
6. 臉：`face` 可以整段沿用，只換 `colors`（眼睛顏色）和位置（`x0`、`y`、`z`）；規格檔的 `cap`、`skin` 要對到臉的位置。
7. `rest` 填站姿（扳直時量到的斜度）。
8. 在 `voxel-rig.html` 換掉 `DEF`（之後可以加角色選單）。

## 7. 接進遊戲的方案（這次還沒做）

遊戲現在的角色在 `src/units.js` 的 `makeUnitMesh`（面向 +z、腳底 y=0、約 1.35 高），動作是在 `main.js` 直接移動整個 mesh。建議分三步：

1. **外觀替換**：`makeUnitMesh` 裡，少女有 `rigs/<id>.js` 的就回傳 `buildRig(def, 1.35).object`，並把 rig 存在 `mesh.userData.rig`；沒有的維持舊模型。外框、選取光圈、血條這些掛在外層 group 上的東西不受影響。
2. **動作對接**：在主迴圈每幀對所有 `userData.rig` 呼叫 `update(dt)`；
   移動動畫開始時 `play('walk')`（衝刺用 `run`）、結束 `play('idle')`；
   開火時 `play('shoot')`，子彈飛行時間跑完回 `idle`；
   被打到 `play('hurt')`；死亡 `play('down')`（停在最後一格，屍體留在地上）。
   頭髮物理是看世界加速度算的，所以只要整個 mesh 在移動，馬尾就會自己甩。
3. **劇情對話**：`src/scene.js` 的打字機每打一個字呼叫 `rig.speakChar(ch)`；角色立繪如果改成從這個模型即時算（而不是事先渲染好的圖），表情可以跟台詞資料走（例如每句台詞加 `face: 'angry'`）。

效能：每隻約 40 個 draw call（解析度提高只會讓頂點變多，draw call 不變），戰場上十幾隻還可以；之後如果手機吃力，可以把同材質的部位合併到一個 `SkinnedMesh`（每個部位一根骨頭），一隻就降到 2～3 個 draw call，資料格式不用變。

## 8. 已知限制／之後可以做

- 倒地時馬尾和飄帶會穿進地板（沒有碰撞）。
- 臉只有正面有，側面、背面看不到表情（Q 版正常）。
- 對嘴是隨機嘴形，不是真的照發音；要更準可以接注音／拼音表。
- 要再細一階：規格檔的 `cell` 改成 10（`unit: 72`），部位框和手排部位的座標乘 1.5 重跑。
- 左右手腳只堆左邊再鏡像，參考圖左右不對稱的細節會不見。
- 走路時會把 A 字站姿的外八收掉 65%（寫在共用的 `gait` 裡）。
