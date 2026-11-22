// 把方塊人（src/rigs/）接到遊戲的單位模型上：units.js 的 makeUnitMesh 先來這裡問有沒有方塊人，有就用。
// 回傳的東西跟舊模型一樣是一個 Group（面向 +z、腳底 y=0），userData 多一個 rig（動作、表情都找它）。
// 網址加 ?lowpoly 會全部退回舊的低面數模型。
import * as THREE from 'three';
import { buildRig } from './voxel-rig.js';
import { GUNS } from './rigs/mc-base.js';
import akane from './rigs/akane-mc.js';
import hikari from './rigs/hikari-mc.js';
import yukino from './rigs/yukino-mc.js';
import momo from './rigs/momo-mc.js';
import chinatsu from './rigs/chinatsu-mc.js';
import kaede from './rigs/kaede-mc.js';
import shiori from './rigs/shiori-mc.js';
import { ENEMIES } from './rigs/enemies-mc.js';
import { WITCHES } from './rigs/witches-mc.js';

export const USE_RIGS = !new URLSearchParams(location.search).has('lowpoly');
const GIRL_RIGS = { akane, hikari, yukino, momo, chinatsu, kaede, shiori };
// 少女的皮膚檔裡畫的是主武器；拿副武器時換成現成的槍
const PRIMARY = { akane: 'duals', hikari: 'ar', yukino: 'hmg', momo: 'tri', chinatsu: 'sn', kaede: 'gl', shiori: 'smg' };
const SIDEARM = { pistol: 'pistol', magnum: 'magnum', sg: 'sg' };
const variants = new Map();

// 這個單位有沒有方塊人？有就回傳它的資料
export function rigDefFor(team, kind, gun, opt = {}) {
  if (!USE_RIGS) return null;
  if (kind === 'girl') {
    const def = GIRL_RIGS[opt.girl];
    if (!def || gun === PRIMARY[opt.girl] || !SIDEARM[gun]) return def || null;
    const key = opt.girl + ':' + gun;
    if (!variants.has(key)) variants.set(key, def.variant({ gun: GUNS[SIDEARM[gun]] }));
    return variants.get(key);
  }
  return WITCHES[kind] || ENEMIES[kind] || null;
}

// scale：遊戲給的大小（config.js 的 scale）；是 1 的時候用皮膚檔自己的（小桃 0.88、教母 1.08）
export function makeRigMesh(def, scale = 1) {
  const rig = buildRig({ ...def, scale: 1 }, 1.35, { ownMats: true });
  const g = rig.object;
  if (scale === 1) scale = def.scale || 1;
  // 槍口位置：擺出射擊姿勢量一次（子彈的光跡從這裡出發）
  const muzzle = new THREE.Vector3(0, 1, 0.3);
  const flash = rig.parts.flashR || rig.parts.flashL;
  if (flash) {
    rig.physics = false;
    rig.play('shoot', { fade: 0 }); rig.update(0.2);
    g.updateMatrixWorld(true);
    flash.group.getWorldPosition(muzzle);
    rig.play('idle', { fade: 0 });
    rig.physics = true;
  }
  rig.time = Math.random() * 5; rig.update(0); rig.resetDangles();    // 每隻的待機錯開，不要全場同步呼吸
  g.scale.setScalar(scale);
  g.userData.rig = rig;
  g.userData.baseScale = scale;
  g.userData.mats = [rig.mats.n];        // 受傷閃紅光用
  g.userData.muzzle = muzzle;
  return g;
}
