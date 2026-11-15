import * as THREE from 'three';

export class FxManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.currentFx = 'none';
    this._initPools();
  }

  _initPools() {
    this.particles = [];
    const geo = new THREE.DodecahedronGeometry(0.14, 0);

    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);

      this.particles.push({
        mesh,
        angle: i * 2.39996,
        radius: 0.25 + (i % 5) * 0.18,
        speed: 0.8 + (i % 4) * 0.35,
        phase: (i / 24) * Math.PI * 2
      });
    }

    this.speedLinesGroup = new THREE.Group();
    const lineGeo = new THREE.BoxGeometry(0.04, 1.4, 0.04);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const line = new THREE.Mesh(lineGeo, lineMat);
      const dist = 2.6;
      line.position.set(Math.cos(angle) * dist, 1.4 + Math.sin(angle) * dist, -1.5);
      line.rotation.z = angle + Math.PI / 2;
      line.userData.baseDist = dist;
      line.userData.angle = angle;
      this.speedLinesGroup.add(line);
    }
    this.speedLinesGroup.visible = false;
    this.scene.add(this.speedLinesGroup);
  }

  setEffect(fxName) {
    this.currentFx = fxName || 'none';
    const showParticles =
      this.currentFx === 'smoke' || this.currentFx === 'sparks' || this.currentFx === 'sweat';
    this.speedLinesGroup.visible = this.currentFx === 'speed_lines';

    for (const p of this.particles) {
      p.mesh.visible = showParticles;
      if (this.currentFx === 'smoke') p.mesh.material.color.setHex(0x94a3b8);
      else if (this.currentFx === 'sparks') p.mesh.material.color.setHex(0xfacc15);
      else if (this.currentFx === 'sweat') p.mesh.material.color.setHex(0x38bdf8);
    }
  }

  /**
   * @param {number} t tempo absoluto (s)
   * @param {THREE.Vector3} [anchor] posição do Pato (duck.root.position); o suor orbita a cabeça dele
   */
  update(t, anchor = null) {
    const ax = anchor ? anchor.x : 0;
    const ay = anchor ? anchor.y : 0;
    const az = anchor ? anchor.z : 0;

    if (this.currentFx === 'smoke') {
      for (const p of this.particles) {
        const life = (t * p.speed + p.phase) % 1;
        p.mesh.position.set(
          Math.cos(p.angle) * p.radius * (0.5 + life),
          0.6 + life * 2.4,
          Math.sin(p.angle) * p.radius * (0.5 + life)
        );
        p.mesh.scale.setScalar(Math.max(0.01, Math.sin(life * Math.PI) * 1.4));
      }
    } else if (this.currentFx === 'sparks') {
      for (const p of this.particles) {
        const life = (t * p.speed * 1.8 + p.phase) % 1;
        p.mesh.position.set(
          Math.cos(p.angle) * life * 2.2,
          1.2 + Math.sin(p.angle) * life * 2.2 - life * life * 1.2,
          Math.sin(p.phase) * 0.8
        );
        p.mesh.scale.setScalar(Math.max(0.01, (1 - life) * 0.8));
      }
    } else if (this.currentFx === 'sweat') {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (i >= 10) {
          p.mesh.visible = false;
          continue;
        }
        p.mesh.visible = true;
        const life = (t * 1.6 + p.phase) % 1;
        const side = i % 2 === 0 ? -1 : 1;
        const spread = 0.45 + life * 0.85;
        p.mesh.position.set(
          ax + side * spread,
          ay + 1.5 + Math.sin(life * Math.PI) * 0.55 - life * 0.4,
          az + 0.1 + Math.cos(p.phase) * 0.25
        );
        p.mesh.scale.set(0.55, 0.85, 0.55);
      }
    } else if (this.currentFx === 'speed_lines') {
      this.speedLinesGroup.children.forEach((line, idx) => {
        const pulse = ((t * 4 + idx * 0.2) % 1) * 0.45;
        const d = line.userData.baseDist - pulse;
        line.position.x = Math.cos(line.userData.angle) * d;
        line.position.y = 1.4 + Math.sin(line.userData.angle) * d;
      });
    }
  }
}
