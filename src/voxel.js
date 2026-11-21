// 方塊模型：讀 art/pixel2voxel.py 產生的 assets/voxels/<名字>.json，做成一個 InstancedMesh
// 模型面向 +z、腳底在 y=0，跟 makeUnitMesh 的模型一樣
import * as THREE from 'three';

const cache = new Map();
export async function loadVoxelData(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then(r => r.json()));
  return cache.get(url);
}
export function voxelMesh(data, height = 1.35) {
  const s = height / data.height;
  const n = data.vox.length / 4;
  const geo = new THREE.BoxGeometry(s, s, s);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  const pal = data.palette.map(h => new THREE.Color(h));
  for (let i = 0; i < n; i++) {
    const [x, y, z, ci] = data.vox.slice(i * 4, i * 4 + 4);
    m.makeTranslation(x * s, (y + 0.5) * s, z * s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(pal[ci]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}
export async function loadVoxelMesh(url, height) {
  return voxelMesh(await loadVoxelData(url), height);
}
