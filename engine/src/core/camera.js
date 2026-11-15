import * as THREE from 'three';

const PRESETS = {
  hero_wide: { pos: [0, 2.5, 7.6], target: [0, 1.15, 0], fov: 44 },
  duck_closeup: { pos: [-0.85, 1.75, 4.6], target: [-0.75, 1.25, 0.5], fov: 40 },
  cutaway_center: { pos: [-0.15, 2.2, 6.4], target: [-0.15, 1.15, 0], fov: 44 },
  top_isometric: { pos: [3.2, 4.8, 6.2], target: [-0.1, 1.0, 0], fov: 44 },
  shake_impact: { pos: [0, 2.3, 6.2], target: [0, 1.1, 0], fov: 44 }
};

export class CameraRig {
  constructor() {
    // Aspect ratio fixo 9:16 (1080 / 1920)
    this.camera = new THREE.PerspectiveCamera(44, 1080 / 1920, 0.1, 100);
    this.currentPos = new THREE.Vector3(...PRESETS.hero_wide.pos);
    this.currentTarget = new THREE.Vector3(...PRESETS.hero_wide.target);
    this.prevPos = this.currentPos.clone();
    this.prevTarget = this.currentTarget.clone();
    this.goalPos = this.currentPos.clone();
    this.goalTarget = this.currentTarget.clone();
    this.presetName = 'hero_wide';
  }

  setPreset(name) {
    const chosen = PRESETS[name] || PRESETS.hero_wide;
    if (this.presetName !== name) {
      this.prevPos.copy(this.currentPos);
      this.prevTarget.copy(this.currentTarget);
      this.goalPos.set(...chosen.pos);
      this.goalTarget.set(...chosen.target);
      this.camera.fov = chosen.fov;
      this.camera.updateProjectionMatrix();
      this.presetName = name;
    }
  }

  /**
   * Atualiza posição de forma determinística usando o tempo decorrido na cena atual
   */
  update(globalTime, sceneTime) {
    // Transição suave nos primeiros 0.45s da cena (easeOutCubic)
    const alpha = Math.min(1, Math.max(0, sceneTime / 0.45));
    const ease = 1 - Math.pow(1 - alpha, 3);

    this.currentPos.lerpVectors(this.prevPos, this.goalPos, ease);
    this.currentTarget.lerpVectors(this.prevTarget, this.goalTarget, ease);

    this.camera.position.copy(this.currentPos);

    // Tremor determinístico nos primeiros 0.5s se o preset for shake_impact
    if (this.presetName === 'shake_impact' && sceneTime < 0.5) {
      const decay = 1 - sceneTime / 0.5;
      this.camera.position.x += Math.sin(globalTime * 55) * 0.14 * decay;
      this.camera.position.y += Math.cos(globalTime * 48) * 0.14 * decay;
    }

    this.camera.lookAt(this.currentTarget);
  }
}