import * as THREE from 'three';

export function setupLighting(scene) {
  // Luz ambiente hemisférica (céu frio / chão quente)
  const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x334155, 0.85);
  hemiLight.position.set(0, 12, 0);
  scene.add(hemiLight);

  // Luz principal (Key Light) com sombras nítidas
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 30;

  const d = 6;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // Luz de recorte traseira (Rim Light) para separar o personagem do fundo
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
  rimLight.position.set(-5, 6, -6);
  scene.add(rimLight);

  // Plano de chão sutil para receber sombras
  const floorGeo = new THREE.CircleGeometry(14, 32);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x232738,
    roughness: 0.9,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}