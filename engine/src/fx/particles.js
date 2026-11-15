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
    // Pool de fumaça / faíscas (24 partículas determinísticas)
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

      // Ângulos pré-calculados deterministicamente (Golden Angle)
      const angle = i * 2.39996;
      const radius = 0.25 + (i % 5) * 0.18;
      this.particles.push({
        mesh,
        angle,
        radius,
        speed: 0.8 + (i % 4) * 0.35,
        phase: (i / 24) * Math.PI * 2
      });
    }

    // Linhas de velocidade (Speed Lines) nas bordas para ganchos
    this.speedLinesGroup = new THREE.Group();
    const lineGeo = new THREE.BoxGeometry(0.04, 1.4, 0.04);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45
    });

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
    const showParticles = this.currentFx === 'smoke' || this.currentFx === 'sparks';
    this.speedLinesGroup.visible = this.currentFx === 'speed_lines';

    for (const p of this.particles) {
      p.mesh.visible = showParticles;
      if (this.currentFx === 'smoke') {
        p.mesh.material.color.setHex(0x94a3b8);
      } else if (this.currentFx === 'sparks') {
        p.mesh.material.color.setHex(0xfacc15);
      }
    }
  }

  update(t) {
    if (this.currentFx === 'smoke') {
      for (const p of this.particles) {
        const life = (t * p.speed + p.phase) % 1;
        p.mesh.position.set(
          Math.cos(p.angle) * p.radius * (0.5 + life),
          0.6 + life * 2.4,
          Math.sin(p.angle) * p.radius * (0.5 + life)
        );
        const s = Math.sin(life * Math.PI) * 1.4;
        p.mesh.scale.setScalar(Math.max(0.01, s));
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