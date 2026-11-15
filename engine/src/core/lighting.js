import * as THREE from 'three';

const BENCH_WIDTH = 13;
const BENCH_BACK_Z = -3.0;
const BENCH_FRONT_Z = 5.5;
const WALL_Z = -3.3;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mat(color, roughness = 0.85, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true, ...extra });
}

function addBox(parent, w, h, d, material, x, y, z, { cast = false, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function buildBench(group, rand) {
  const depth = BENCH_FRONT_Z - BENCH_BACK_Z;
  const centerZ = (BENCH_FRONT_Z + BENCH_BACK_Z) / 2;
  addBox(group, BENCH_WIDTH, 0.3, depth, mat(0x3a2412), 0, -0.3, centerZ);

  const plankCount = 10;
  const pitch = depth / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const c = new THREE.Color(0xb7793f);
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h + (rand() - 0.5) * 0.02, hsl.s * (0.85 + rand() * 0.2), hsl.l * (0.82 + rand() * 0.3));
    const z = BENCH_BACK_Z + pitch * (i + 0.5);
    addBox(group, BENCH_WIDTH, 0.28, pitch - 0.04, mat(c.getHex()), 0, -0.14, z);
  }

  addBox(group, BENCH_WIDTH, 0.6, 0.25, mat(0x6b4423), 0, -0.6, BENCH_FRONT_Z - 0.1, { cast: true });
  for (const x of [-BENCH_WIDTH / 2 + 0.5, BENCH_WIDTH / 2 - 0.5]) {
    addBox(group, 0.55, 5, 0.55, mat(0x5a3a1c), x, -3.1, BENCH_FRONT_Z - 0.4, { cast: true });
    addBox(group, 0.55, 5, 0.55, mat(0x5a3a1c), x, -3.1, BENCH_BACK_Z + 0.4, { cast: true });
  }

  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 24), mat(0x161a28, 0.95));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5.6;
  floor.receiveShadow = true;
  group.add(floor);
}

function buildWall(group) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 20), mat(0x2b3350, 0.95, { flatShading: false }));
  wall.position.set(0, 8, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);

  const wainscot = mat(0x25405a);
  const wainscotAlt = mat(0x2a4a68);
  for (let i = -14; i <= 14; i++) {
    addBox(group, 0.92, 2.4, 0.12, i % 2 ? wainscot : wainscotAlt, i * 1.0, 1.2, WALL_Z + 0.06);
  }
  addBox(group, 30, 0.18, 0.28, mat(0x8a5a2f), 0, 2.45, WALL_Z + 0.12, { cast: true });

  const PANEL_W = 14;
  const PANEL_H = 6.4;
  const PANEL_Y = 6.0;
  addBox(group, PANEL_W, PANEL_H, 0.1, mat(0x38426a), 0, PANEL_Y, WALL_Z + 0.05);
  const gridMat = mat(0x262e52, 0.9);
  for (let i = 0; i <= 14; i++) {
    addBox(group, 0.035, PANEL_H, 0.04, gridMat, -PANEL_W / 2 + i * (PANEL_W / 14), PANEL_Y, WALL_Z + 0.12, { receive: false });
  }
  for (let j = 0; j <= 6; j++) {
    addBox(group, PANEL_W, 0.035, 0.04, gridMat, 0, PANEL_Y - PANEL_H / 2 + j * (PANEL_H / 6), WALL_Z + 0.12, { receive: false });
  }

  const frameMat = mat(0x8a5a2f);
  addBox(group, PANEL_W + 0.4, 0.2, 0.18, frameMat, 0, PANEL_Y + PANEL_H / 2 + 0.1, WALL_Z + 0.1);
  addBox(group, PANEL_W + 0.4, 0.2, 0.18, frameMat, 0, PANEL_Y - PANEL_H / 2 - 0.1, WALL_Z + 0.1);
  addBox(group, 0.2, PANEL_H + 0.4, 0.18, frameMat, -PANEL_W / 2 - 0.1, PANEL_Y, WALL_Z + 0.1);
  addBox(group, 0.2, PANEL_H + 0.4, 0.18, frameMat, PANEL_W / 2 + 0.1, PANEL_Y, WALL_Z + 0.1);

  addBox(group, 2.2, 3.0, 0.05, mat(0x1d4ed8, 0.7), 4.6, 6.2, WALL_Z + 0.2);
  const lineMat = mat(0xbfdbfe, 0.6);
  addBox(group, 1.6, 0.06, 0.03, lineMat, 4.6, 7.1, WALL_Z + 0.24, { receive: false });
  addBox(group, 1.6, 0.06, 0.03, lineMat, 4.6, 6.4, WALL_Z + 0.24, { receive: false });
  addBox(group, 0.06, 1.8, 0.03, lineMat, 4.0, 6.2, WALL_Z + 0.24, { receive: false });
  const bpCircle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 10), lineMat);
  bpCircle.rotation.x = Math.PI / 2;
  bpCircle.position.set(4.75, 5.55, WALL_Z + 0.24);
  group.add(bpCircle);

  addBox(group, 3.4, 0.14, 0.6, mat(0x8a5a2f), -4.4, 4.0, WALL_Z + 0.4, { cast: true });
  addBox(group, 0.12, 0.5, 0.5, mat(0x5a3a1c), -5.8, 3.75, WALL_Z + 0.38);
  addBox(group, 0.12, 0.5, 0.5, mat(0x5a3a1c), -3.0, 3.75, WALL_Z + 0.38);
  const jarGlass = mat(0x7dd3fc, 0.15, { transparent: true, opacity: 0.55 });
  const jar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.75, 8), jarGlass);
  jar1.position.set(-5.2, 4.45, WALL_Z + 0.4);
  const jar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 8), mat(0xf472b6, 0.2, { transparent: true, opacity: 0.6 }));
  jar2.position.set(-4.55, 4.35, WALL_Z + 0.4);
  const shelfGear = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 8), mat(0xfacc15, 0.4));
  shelfGear.rotation.x = Math.PI / 2;
  shelfGear.position.set(-3.75, 4.4, WALL_Z + 0.4);
  jar1.castShadow = jar2.castShadow = shelfGear.castShadow = true;
  group.add(jar1, jar2, shelfGear);
}

function buildProps(group) {
  addBox(group, 1.5, 0.8, 0.7, mat(0xdc2626, 0.6), 3.9, 0.4, -2.2, { cast: true });
  addBox(group, 1.56, 0.1, 0.76, mat(0x991b1b, 0.6), 3.9, 0.85, -2.2, { cast: true });
  addBox(group, 0.8, 0.08, 0.1, mat(0x94a3b8, 0.3), 3.9, 1.0, -2.2, { cast: true });

  addBox(group, 1.2, 0.22, 0.85, mat(0x2563eb, 0.7), -3.9, 0.11, -2.1, { cast: true });
  addBox(group, 1.05, 0.2, 0.8, mat(0x16a34a, 0.7), -3.85, 0.32, -2.1, { cast: true });
  addBox(group, 0.9, 0.18, 0.7, mat(0xf59e0b, 0.7), -3.95, 0.51, -2.12, { cast: true });

  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.36, 8), mat(0xf8fafc, 0.5));
  mug.position.set(-2.9, 0.18, -2.3);
  mug.castShadow = true;
  group.add(mug);
}

function buildLamp(group) {
  addBox(group, 0.05, 3.2, 0.05, mat(0x0f172a), 0, 8.4, -2.0);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 0.7, 8, 1, true),
    mat(0xf97316, 0.5, { side: THREE.DoubleSide })
  );
  shade.position.set(0, 6.55, -2.0);
  group.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xffd58a,
    emissiveIntensity: 1.2,
    roughness: 0.4
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbMat);
  bulb.position.set(0, 6.35, -2.0);
  group.add(bulb);
  return bulbMat;
}

function buildLivingRoom(group) {
  // Piso de tábuas claras correndo em Z (linhas de fuga dão profundidade). Topo em y = 0.
  addBox(group, 16, 0.3, 14, mat(0x7a5230), 0, -0.2, 3.5);
  const rand = mulberry32(2026);
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Color(0xd2a46a);
    c.offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    addBox(group, 0.96, 0.12, 14, mat(c.getHex()), -7.5 + i, -0.06, 3.5);
  }

  // Tapete
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.05, 14), mat(0x7f1d1d, 0.95));
  rug.position.set(0, 0.025, 0.2);
  rug.receiveShadow = true;
  const rugInner = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.06, 14), mat(0xb91c1c, 0.95));
  rugInner.position.set(0, 0.03, 0.2);
  rugInner.receiveShadow = true;
  group.add(rug, rugInner);

  // Parede, lambri e rodapé
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 20), mat(0xe8d5b5, 0.95, { flatShading: false }));
  wall.position.set(0, 8, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);
  addBox(group, 30, 1.6, 0.12, mat(0xf5ecd9), 0, 0.8, WALL_Z + 0.06);
  addBox(group, 30, 0.18, 0.2, mat(0x8b5a2b), 0, 1.65, WALL_Z + 0.1);
  addBox(group, 30, 0.25, 0.16, mat(0x8b5a2b), 0, 0.125, WALL_Z + 0.08);

  // Janela com sol estourado
  addBox(group, 3.4, 4.0, 0.2, mat(0xf8fafc, 0.6), 3.4, 4.6, WALL_Z + 0.1);
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c8, emissive: 0xffe08a, emissiveIntensity: 1.4, roughness: 0.4
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.6, 0.05), sunMat);
  glass.position.set(3.4, 4.6, WALL_Z + 0.2);
  group.add(glass);
  addBox(group, 0.1, 3.6, 0.08, mat(0xf8fafc, 0.6), 3.4, 4.6, WALL_Z + 0.25, { receive: false });
  addBox(group, 3.0, 0.1, 0.08, mat(0xf8fafc, 0.6), 3.4, 4.6, WALL_Z + 0.25, { receive: false });
  const sunDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.03, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2a8, emissiveIntensity: 1.8 })
  );
  sunDisc.rotation.x = Math.PI / 2;
  sunDisc.position.set(3.0, 5.2, WALL_Z + 0.24);
  group.add(sunDisc);

  // Quadro
  addBox(group, 2.0, 1.4, 0.08, mat(0x8a5a2f), -3.6, 5.0, WALL_Z + 0.1, { cast: true });
  addBox(group, 1.7, 1.1, 0.06, mat(0x93c5fd, 0.6), -3.6, 5.0, WALL_Z + 0.15, { receive: false });

  // Planta
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 8), mat(0xc2410c));
  pot.position.set(-4.4, 0.3, -2.2);
  pot.castShadow = true;
  group.add(pot);
  const leafMat = mat(0x16a34a, 0.8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.1, 5), leafMat);
    leaf.position.set(-4.4 + Math.cos(a) * 0.22, 1.1, -2.2 + Math.sin(a) * 0.22);
    leaf.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    leaf.castShadow = true;
    group.add(leaf);
  }

  return sunMat;
}

export function setupLighting(scene) {
  scene.background = new THREE.Color(0x1e2433);
  scene.fog = new THREE.Fog(0x1e2433, 20, 44);

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x6b4423, 0.75);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1d6, 1.6);
  key.position.set(5, 10, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  const d = 7;
  key.shadow.camera.left = -d;
  key.shadow.camera.right = d;
  key.shadow.camera.top = d;
  key.shadow.camera.bottom = -d;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x7dd3fc, 0.6);
  fill.position.set(-7, 4, 6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xa78bfa, 0.9);
  rim.position.set(-5, 6, -6);
  scene.add(rim);

  const bounce = new THREE.DirectionalLight(0xffc27a, 0.35);
  bounce.position.set(3, 2, 8);
  scene.add(bounce);

  // Cenários
  const workshop = new THREE.Group();
  buildBench(workshop, mulberry32(1337));
  buildWall(workshop);
  buildProps(workshop);
  const bulbMat = buildLamp(workshop);
  scene.add(workshop);

  const livingRoom = new THREE.Group();
  const sunMat = buildLivingRoom(livingRoom);
  scene.add(livingRoom);

  const ENVS = {
    workshop: {
      group: workshop, bg: 0x1e2433, fog: [20, 44],
      key: [0xfff1d6, 1.6], fill: [0x7dd3fc, 0.6], rim: [0xa78bfa, 0.9],
      hemi: [0xdbeafe, 0x6b4423, 0.75]
    },
    living_room: {
      group: livingRoom, bg: 0x3a2a24, fog: [22, 48],
      key: [0xffb066, 1.9], fill: [0xffd9a8, 0.5], rim: [0xfb923c, 0.8],
      hemi: [0xffe4c4, 0x7c4a21, 0.85]
    }
  };

  /** Determinístico: o estado depende só do nome do ambiente. */
  function setEnvironment(name = 'workshop') {
    const env = ENVS[name] || ENVS.workshop;
    for (const e of Object.values(ENVS)) e.group.visible = e === env;
    scene.background.setHex(env.bg);
    scene.fog.color.setHex(env.bg);
    scene.fog.near = env.fog[0];
    scene.fog.far = env.fog[1];
    key.color.setHex(env.key[0]);
    key.intensity = env.key[1];
    fill.color.setHex(env.fill[0]);
    fill.intensity = env.fill[1];
    rim.color.setHex(env.rim[0]);
    rim.intensity = env.rim[1];
    hemi.color.setHex(env.hemi[0]);
    hemi.groundColor.setHex(env.hemi[1]);
    hemi.intensity = env.hemi[2];
  }
  setEnvironment('workshop');

  return {
    setEnvironment,
    update(t) {
      bulbMat.emissiveIntensity = 1.2 + Math.sin(t * 2.1) * 0.12;
      sunMat.emissiveIntensity = 1.4 + Math.sin(t * 1.3) * 0.15;
    }
  };
}
