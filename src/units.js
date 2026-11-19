// 單位模型（暫用方塊人，之後可換成正式模型）。正面朝 +Z。
import * as THREE from 'three';

// gun: 'ar' | 'sg' | 'sn' | 'lmg' | 'pistol'（只影響外觀）
export function makeUnitMesh(team, kind, color, gun = 'ar', scale = 1) {
  const g = new THREE.Group();
  const isP = team === 'player';
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.8 });
  const glow = new THREE.MeshStandardMaterial({
    color: isP ? 0x9be7ff : 0xffd34d,
    emissive: isP ? 0x4fd6ff : 0xffb000,
    emissiveIntensity: 1.6,
  });
  const mats = [body, dark];

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  const leg = new THREE.BoxGeometry(0.15, 0.5, 0.17);
  add(leg, dark, -0.11, 0.25, 0);
  add(leg, dark, 0.11, 0.25, 0);
  add(new THREE.BoxGeometry(0.44, 0.5, 0.28), body, 0, 0.76, 0);
  if (isP) {
    add(new THREE.SphereGeometry(0.15, 16, 12), body, 0, 1.17, 0);
    add(new THREE.BoxGeometry(0.2, 0.06, 0.06), glow, 0, 1.18, 0.13);
    add(new THREE.BoxGeometry(0.3, 0.2, 0.12), dark, 0, 0.82, -0.2); // 背包
  } else {
    add(new THREE.BoxGeometry(0.3, 0.26, 0.3), body, 0, 1.15, 0.04);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.03), glow, -0.07, 1.18, 0.2);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.03), glow, 0.07, 1.18, 0.2);
    if (kind === 'brute' || kind === 'mg') {
      add(new THREE.BoxGeometry(0.2, 0.2, 0.32), body, -0.3, 1.0, 0); // 肩甲
      add(new THREE.BoxGeometry(0.2, 0.2, 0.32), body, 0.3, 1.0, 0);
    }
    if (kind === 'officer') add(new THREE.BoxGeometry(0.36, 0.06, 0.4), glow, 0, 1.31, 0.04); // 帽簷
    if (kind === 'zealot') add(new THREE.BoxGeometry(0.46, 0.08, 0.3), glow, 0, 0.92, 0);     // 頭巾/布條
  }
  if (kind === 'sniper') gun = 'sn';
  if (kind === 'mg') gun = 'lmg';

  // 槍
  const G = {
    ar: [0.08, 0.1, 0.55, 0.32], sg: [0.1, 0.11, 0.45, 0.28], sn: [0.06, 0.08, 0.8, 0.45],
    lmg: [0.13, 0.14, 0.6, 0.34], pistol: [0.06, 0.09, 0.2, 0.2],
  }[gun] || [0.08, 0.1, 0.55, 0.32];
  const gm = add(new THREE.BoxGeometry(G[0], G[1], G[2]), dark, 0.22, 0.85, G[3]);
  g.userData.gunMesh = gm;

  g.scale.setScalar(scale);
  g.userData.baseScale = scale;
  g.userData.mats = mats;
  g.userData.muzzle = new THREE.Vector3(0.22, 0.86, G[3] + G[2] / 2);
  return g;
}
