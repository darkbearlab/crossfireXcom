// 單位模型（暫用方塊人，之後可換成正式模型）。正面朝 +Z。
import * as THREE from 'three';

// gun: 'ar' | 'sg' | 'sn' | 'lmg' | 'pistol' | 'duals' | 'hmg' | 'tri' | 'magnum'（只影響外觀）
// opt: { hair, girl, boss, mother }
export function makeUnitMesh(team, kind, color, gun = 'ar', scale = 1, opt = {}) {
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

  if (kind === 'girl') {
    const skin = new THREE.MeshStandardMaterial({ color: 0xffe2cf, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: opt.hair || 0x553322, roughness: 0.55 });
    const sock = new THREE.MeshStandardMaterial({ color: 0xf4f4f8, roughness: 0.8 });
    mats.push(skin, hair);
    const leg = new THREE.BoxGeometry(0.11, 0.42, 0.12);
    add(leg, sock, -0.08, 0.21, 0);
    add(leg, sock, 0.08, 0.21, 0);
    add(new THREE.CylinderGeometry(0.17, 0.3, 0.26, 10), body, 0, 0.52, 0);   // 裙子
    add(new THREE.BoxGeometry(0.32, 0.34, 0.2), body, 0, 0.8, 0);             // 上衣
    add(new THREE.BoxGeometry(0.12, 0.08, 0.04), glow, 0, 0.9, 0.11);         // 胸前蝴蝶結
    add(new THREE.SphereGeometry(0.16, 16, 12), skin, 0, 1.13, 0);            // 頭
    const cap = add(new THREE.SphereGeometry(0.175, 16, 12), hair, 0, 1.17, -0.03); // 頭髮
    cap.scale.set(1, 0.95, 1);
    add(new THREE.BoxGeometry(0.035, 0.04, 0.02), dark, -0.06, 1.13, 0.155);  // 眼睛
    add(new THREE.BoxGeometry(0.035, 0.04, 0.02), dark, 0.06, 1.13, 0.155);
    if (opt.girl === 'momo') {          // 雙馬尾
      add(new THREE.CylinderGeometry(0.05, 0.02, 0.36, 8), hair, -0.2, 1.02, -0.04);
      add(new THREE.CylinderGeometry(0.05, 0.02, 0.36, 8), hair, 0.2, 1.02, -0.04);
    } else if (opt.girl === 'hikari') { // 馬尾 + 大蝴蝶結
      add(new THREE.CylinderGeometry(0.06, 0.025, 0.42, 8), hair, 0, 1.02, -0.2);
      add(new THREE.BoxGeometry(0.22, 0.08, 0.05), glow, 0, 1.3, -0.08);
    } else if (opt.girl === 'yukino') { // 長直髮
      add(new THREE.BoxGeometry(0.32, 0.42, 0.08), hair, 0, 0.98, -0.12);
    } else {                            // 短髮 + 髮夾
      add(new THREE.BoxGeometry(0.06, 0.03, 0.03), glow, 0.12, 1.24, 0.1);
    }
  } else {
    const leg = new THREE.BoxGeometry(0.15, 0.5, 0.17);
    add(leg, dark, -0.11, 0.25, 0);
    add(leg, dark, 0.11, 0.25, 0);
    add(new THREE.BoxGeometry(0.44, 0.5, 0.28), body, 0, 0.76, 0);
    if (isP) {
      add(new THREE.SphereGeometry(0.15, 16, 12), body, 0, 1.17, 0);
      add(new THREE.BoxGeometry(0.2, 0.06, 0.06), glow, 0, 1.18, 0.13);
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
  }
  if (opt.boss) { // 魔女帽
    const hat = new THREE.MeshStandardMaterial({ color: 0x2a1838, roughness: 0.7 });
    const band = new THREE.MeshStandardMaterial({ color: 0xc040ff, emissive: 0x8020c0, emissiveIntensity: 1.2 });
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20), hat, 0, 1.3, 0.04);
    const cone = add(new THREE.ConeGeometry(0.17, opt.mother ? 0.7 : 0.5, 16), hat, 0, opt.mother ? 1.65 : 1.55, 0.02);
    cone.rotation.z = 0.25;
    add(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 16), band, 0, 1.34, 0.04);
  }
  if (kind === 'sniper') gun = 'sn';
  if (kind === 'mg') gun = 'lmg';

  // 槍
  const G = {
    ar: [0.08, 0.1, 0.55, 0.32], sg: [0.1, 0.11, 0.45, 0.28], sn: [0.06, 0.08, 0.8, 0.45],
    lmg: [0.13, 0.14, 0.6, 0.34], pistol: [0.06, 0.09, 0.2, 0.2], duals: [0.06, 0.09, 0.26, 0.24],
    hmg: [0.15, 0.16, 0.72, 0.36], tri: [0.13, 0.1, 0.42, 0.28], magnum: [0.07, 0.1, 0.28, 0.22],
  }[gun] || [0.08, 0.1, 0.55, 0.32];
  const gx = kind === 'girl' ? 0.2 : 0.22, gy = kind === 'girl' ? 0.78 : 0.85;
  const gm = add(new THREE.BoxGeometry(G[0], G[1], G[2]), dark, gx, gy, G[3]);
  if (gun === 'duals') add(new THREE.BoxGeometry(G[0], G[1], G[2]), dark, -gx, gy, G[3]);
  g.userData.gunMesh = gm;

  g.scale.setScalar(scale);
  g.userData.baseScale = scale;
  g.userData.mats = mats;
  g.userData.muzzle = new THREE.Vector3(gx, gy + 0.01, G[3] + G[2] / 2);
  return g;
}

// 光變身後的光環
export function addHalo(mesh) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffd040, emissiveIntensity: 2 }));
  m.rotation.x = Math.PI / 2;
  m.position.y = 1.45;
  mesh.add(m);
  const wing = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc0e0, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.34), wing);
    w.position.set(0.2 * s, 0.95, -0.2);
    w.rotation.y = 0.5 * s;
    mesh.add(w);
  }
}

// 愛心形狀（小桃的彈坑）
export function heartShape(s = 0.35) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-1.2 * s, -0.1 * s, -0.9 * s, 0.9 * s, 0, 0.35 * s);
  h.bezierCurveTo(0.9 * s, 0.9 * s, 1.2 * s, -0.1 * s, 0, -0.9 * s);
  return h;
}
