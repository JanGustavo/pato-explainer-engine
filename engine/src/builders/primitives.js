import * as THREE from 'three';
import { makeScenery, setProgress, updateScenery } from '../vendor/willian3d/scenery/index.js';

export class SceneObjectBuilder {
  constructor(scene) {
    this.scene = scene;
    this.container = new THREE.Group();
    this.scene.add(this.container);
    this.activeItems = [];
  }

  clear() {
    for (const item of this.activeItems) {
      this.container.remove(item.mesh);
      item.mesh.traverse((child) => {
        if (child.geometry && !child.geometry.userData?.kitShared) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => { if (!m.userData?.kitShared) m.dispose(); });
          } else {
            if (!child.material.userData?.kitShared) child.material.dispose();
          }
        }
      });
    }
    this.activeItems = [];
  }

  loadObjects(objectsSpec = []) {
    this.clear();

    for (const spec of objectsSpec) {
      const mesh = this._createPrimitive(spec);
      if (!mesh) continue;

      const [px = 0, py = 0, pz = 0] = spec.pos || [];
      const [rx = 0, ry = 0, rz = 0] = spec.rot || [];
      const [sx = 1, sy = 1, sz = 1] = spec.scale || [];

      mesh.position.set(px, py, pz);
      mesh.rotation.set(rx, ry, rz);
      mesh.scale.set(sx, sy, sz);

      this.container.add(mesh);
      this.activeItems.push({
        spec,
        mesh,
        basePos: new THREE.Vector3(px, py, pz)
      });
    }
  }

  /** Ponto local de um objeto (por spec.id) convertido para coordenadas de mundo [x,y,z]. */
  getWorldPoint(id, local = [0, 0, 0]) {
    const item = this.activeItems.find((i) => i.spec.id === id);
    if (!item) return null;
    item.mesh.updateWorldMatrix(true, false);
    const v = new THREE.Vector3(local[0], local[1], local[2]);
    return item.mesh.localToWorld(v).toArray();
  }

  _mat(hex, extra = {}) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      roughness: 0.45,
      metalness: 0.15,
      flatShading: true,
      ...extra
    });
  }

  _buildElectricFan(spec) {
    const group = new THREE.Group();
    const cutaway = Boolean(spec.cutaway);
    const showCage = spec.cage !== false && !cutaway;
    const pitch = THREE.MathUtils.degToRad(spec.pitch_deg ?? 28);

    const bodyMat = this._mat(spec.color || '#1e293b');
    const accentMat = this._mat('#38bdf8');
    const metalMat = this._mat('#cbd5e1', { metalness: 0.6, roughness: 0.3 });
    const copperMat = this._mat('#f97316', { metalness: 0.5, roughness: 0.3 });

    // Base + botões
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.14, 16), bodyMat);
    base.position.y = 0.07;
    group.add(base);

    ['#94a3b8', '#38bdf8', '#facc15', '#ef4444'].forEach((c, idx) => {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.12), this._mat(c));
      btn.position.set(-0.21 + idx * 0.14, 0.15, 0.32);
      group.add(btn);
    });

    // Pescoço
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.95, 12), metalMat);
    neck.position.y = 0.58;
    group.add(neck);

    // Cabeça (centro em y = 1.15)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.15, 0);
    group.add(headGroup);

    // Carcaça do motor (transparente no cutaway)
    const housingMat = cutaway
      ? this._mat('#94a3b8', { transparent: true, opacity: 0.25 })
      : bodyMat;
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.48, 14), housingMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.z = -0.22;
    headGroup.add(housing);

    // Estator: anel + 8 bobinas de cobre
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 14), copperMat);
    ring.position.z = -0.22;
    headGroup.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const coil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.22), copperMat);
      coil.position.set(Math.cos(a) * 0.165, Math.sin(a) * 0.165, -0.22);
      coil.rotation.z = a;
      headGroup.add(coil);
    }

    // Rotor (gira junto com as pás)
    const rotorGroup = new THREE.Group();
    rotorGroup.position.z = 0.05;
    headGroup.add(rotorGroup);
    group.userData.rotor = rotorGroup;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.56, 10), metalMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.22;
    rotorGroup.add(shaft);

    // Núcleo + 4 ímãs: dão movimento visível ao rotor dentro do cutaway
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), metalMat);
    core.rotation.x = Math.PI / 2;
    core.position.z = -0.27;
    rotorGroup.add(core);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.26), accentMat);
      bar.position.set(Math.cos(a) * 0.06, Math.sin(a) * 0.06, -0.27);
      bar.rotation.z = a;
      rotorGroup.add(bar);
    }

    // Hub + 4 pás inclinadas
    const spinner = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), accentMat);
    spinner.scale.set(1, 1, 0.9);
    spinner.position.z = 0.06;
    rotorGroup.add(spinner);

    for (let i = 0; i < 4; i++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (i * Math.PI) / 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.52, 0.025), accentMat);
      blade.position.set(0, 0.34, 0.05);
      blade.rotation.y = pitch;
      bladePivot.add(blade);
      rotorGroup.add(bladePivot);
    }

    // Grade: toda na frente do hub (z = 0.30) para o hub não atravessar a tampa
    if (showCage) {
      const cageMat = this._mat('#e2e8f0', { metalness: 0.4, roughness: 0.35 });
      const frontRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.022, 8, 28), cageMat);
      frontRing.position.z = 0.3;
      const backRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.022, 8, 28), cageMat);
      backRing.position.z = -0.04;
      headGroup.add(frontRing, backRing);

      for (let i = 0; i < 8; i++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.46, 6), cageMat);
        spoke.rotation.z = (i * Math.PI) / 8;
        spoke.position.z = 0.3;
        headGroup.add(spoke);
      }

      const logoCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 14), bodyMat);
      logoCap.rotation.x = Math.PI / 2;
      logoCap.position.z = 0.31;
      headGroup.add(logoCap);
    }

    return group;
  }

  _buildSofa(spec) {
    const group = new THREE.Group();
    const fabricMat = this._mat(spec.color || '#dc2626', { roughness: 0.85 });
    const cushionMat = this._mat(new THREE.Color(spec.color || '#dc2626').offsetHSL(0, 0, 0.07), { roughness: 0.8 });
    const legMat = this._mat('#451a03');

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.95), fabricMat);
    base.position.y = 0.25;
    group.add(base);

    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.78, 0.26), fabricMat);
    back.position.set(0, 0.72, -0.34);
    group.add(back);

    [-0.52, 0.52].forEach((x) => {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.18, 0.72), cushionMat);
      seat.position.set(x, 0.48, 0.08);
      group.add(seat);
    });

    [-1.02, 1.02].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.54, 0.96), fabricMat);
      arm.position.set(x, 0.52, 0);
      group.add(arm);
    });

    [
      [-0.95, -0.38],
      [0.95, -0.38],
      [-0.95, 0.38],
      [0.95, 0.38]
    ].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.12, 8), legMat);
      leg.position.set(x, 0.06, z);
      group.add(leg);
    });

    return group;
  }

  _buildThermometer(spec) {
    const group = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.35, 0.08), this._mat('#f8fafc'));
    board.position.y = 0.75;
    group.add(board);

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 1.0, 10),
      this._mat('#cbd5e1', { transparent: true, opacity: 0.55 })
    );
    glass.position.set(0, 0.82, 0.05);
    group.add(glass);

    const hotMat = this._mat('#ef4444');
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hotMat);
    bulb.position.set(0, 0.28, 0.06);
    group.add(bulb);

    const mercury = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.92, 10), hotMat);
    mercury.position.set(0, 0.78, 0.055);
    group.add(mercury);
    group.userData.mercury = mercury;

    return group;
  }

  _createPrimitive(spec) {
    if (spec.type === 'kit') {
      return makeScenery(spec.asset, spec.params || {});
    }
    if (spec.type === 'electric_fan') {
      const fan = this._buildElectricFan(spec);
      fan.traverse((c) => {
        if (c.isMesh && !c.material.transparent) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      return fan;
    }

    if (spec.type === 'sofa') {
      const sofa = this._buildSofa(spec);
      sofa.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      return sofa;
    }

    if (spec.type === 'thermometer') {
      const thermo = this._buildThermometer(spec);
      thermo.traverse((c) => {
        if (c.isMesh) c.castShadow = true;
      });
      return thermo;
    }

    const color = new THREE.Color(spec.color || '#94a3b8');
    const isTransparent = spec.opacity !== undefined && spec.opacity < 1;

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: spec.metalness ?? 0.15,
      flatShading: true,
      transparent: isTransparent,
      opacity: spec.opacity ?? 1
    });

    let mesh;

    switch (spec.type) {
      case 'box':
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
        break;
      case 'cylinder':
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 16), mat);
        break;
      case 'sphere':
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), mat);
        break;
      case 'torus':
        mesh = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 10, 20), mat);
        break;
      case 'pipe': {
        const outer = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true);
        mat.side = THREE.DoubleSide;
        mesh = new THREE.Mesh(outer, mat);
        break;
      }
      case 'water_flow': {
        mesh = new THREE.Group();
        const dropGeo = new THREE.SphereGeometry(0.12, 8, 8);
        for (let i = 0; i < 6; i++) {
          const drop = new THREE.Mesh(dropGeo, mat.clone());
          drop.position.set((i - 2.5) * 0.35, 0, 0);
          drop.userData.flowIndex = i;
          mesh.add(drop);
        }
        break;
      }
      case 'arrow': {
        mesh = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 10), mat);
        shaft.position.y = -0.15;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 10), mat);
        head.position.y = 0.35;
        mesh.add(shaft, head);
        break;
      }
      case 'spark_burst': {
        mesh = new THREE.Group();
        const spikeGeo = new THREE.ConeGeometry(0.08, 0.45, 6);
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const spike = new THREE.Mesh(spikeGeo, mat.clone());
          spike.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, 0);
          spike.rotation.z = angle - Math.PI / 2;
          mesh.add(spike);
        }
        break;
      }
      default:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    }

    mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = !isTransparent;
        child.receiveShadow = true;
      }
    });

    return mesh;
  }

  update(t) {
    for (const item of this.activeItems) {
      if (item.spec.type === 'kit') {
        updateScenery(item.mesh, t);
        if (item.spec.progress !== undefined) setProgress(item.mesh, item.spec.progress);
      }
      if (item.spec.type === 'electric_fan' && item.mesh.userData.rotor) {
        const speed = item.spec.spin_speed ?? 14;
        item.mesh.userData.rotor.rotation.z = -t * speed;
      }

      if (item.spec.type === 'thermometer' && item.mesh.userData.mercury) {
        const s = 0.94 + Math.sin(t * 7) * 0.06;
        item.mesh.userData.mercury.scale.y = s;
      }

      const anim = item.spec.anim;
      if (anim === 'spin_y') {
        item.mesh.rotation.y = t * 8;
      } else if (anim === 'spin_z') {
        item.mesh.rotation.z = t * 10;
      } else if (anim === 'pulse') {
        const s = 1 + Math.sin(t * 8) * 0.12;
        item.mesh.scale.set(
          (item.spec.scale?.[0] ?? 1) * s,
          (item.spec.scale?.[1] ?? 1) * s,
          (item.spec.scale?.[2] ?? 1) * s
        );
      }

      if (item.spec.type === 'water_flow') {
        item.mesh.children.forEach((drop, idx) => {
          const offset = ((t * 2.2 + idx * 0.35) % 2.1) - 1.05;
          drop.position.x = offset;
          drop.position.y = Math.sin(t * 6 + idx) * 0.08;
        });
      }
    }
  }
}
