import * as THREE from 'three';

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
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
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

      const [px = 0, py = 0.5, pz = 0] = spec.pos || [];
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

  _createPrimitive(spec) {
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
        // Tubo oco (ideal para encanamento, calhas e fluxo interno)
        const outer = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true);
        mat.side = THREE.DoubleSide;
        mesh = new THREE.Mesh(outer, mat);
        break;
      }

      case 'water_flow': {
        // Conjunto de esferas representando fluxo de ar ou água em movimento
        mesh = new THREE.Group();
        const dropGeo = new THREE.SphereGeometry(0.14, 8, 8);
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

  /**
   * Animações contínuas opcionais declaradas no JSON (spin, pulse, flow)
   */
  update(t) {
    for (const item of this.activeItems) {
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