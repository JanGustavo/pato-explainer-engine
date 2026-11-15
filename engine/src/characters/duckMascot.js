import * as THREE from 'three';

export class DuckMascot {
  constructor() {
    this.root = new THREE.Group();
    this.currentAnim = 'idle';
    this.outfit = 'workshop';

    this._buildMaterials();
    this._buildRig();
    this.setOutfit('workshop');
  }

  _buildMaterials() {
    this.mats = {
      body: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, flatShading: true }),
      beak: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4, flatShading: true }),
      eye: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 }),
      eyeWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
      helmet: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, flatShading: true }),
      gogglesFrame: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, flatShading: true }),
      gogglesLens: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        transparent: true,
        opacity: 0.65
      }),
      coat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7, flatShading: true })
    };
  }

  _buildRig() {
    // Pivô principal do corpo (para pulos e inclinação)
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0.65;
    this.root.add(this.bodyPivot);

    // Tronco (esfera alongada)
    const torsoGeo = new THREE.SphereGeometry(0.55, 14, 12);
    torsoGeo.scale(0.95, 1.15, 1.05);
    this.torso = new THREE.Mesh(torsoGeo, this.mats.body);
    this.torso.castShadow = true;
    this.bodyPivot.add(this.torso);

    // Rabinho curto atrás
    const tailGeo = new THREE.ConeGeometry(0.22, 0.45, 8);
    const tail = new THREE.Mesh(tailGeo, this.mats.body);
    tail.position.set(0, -0.15, -0.58);
    tail.rotation.x = -Math.PI * 0.35;
    this.torso.add(tail);

    // Jaleco opcional (para modo 'lab')
    const coatGeo = new THREE.CylinderGeometry(0.54, 0.62, 0.75, 14);
    this.labCoat = new THREE.Mesh(coatGeo, this.mats.coat);
    this.labCoat.position.y = -0.12;
    this.torso.add(this.labCoat);

    // Pivô da Cabeça
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.72, 0.05);
    this.bodyPivot.add(this.headPivot);

    const headGeo = new THREE.SphereGeometry(0.44, 14, 12);
    this.head = new THREE.Mesh(headGeo, this.mats.body);
    this.head.castShadow = true;
    this.headPivot.add(this.head);

    // Olhos
    this.leftEye = this._createEye(-0.18, 0.08, 0.37);
    this.rightEye = this._createEye(0.18, 0.08, 0.37);
    this.headPivot.add(this.leftEye, this.rightEye);

    // Bico Superior e Inferior (articulados para falar e reagir)
    const upperBeakGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.42, 10);
    upperBeakGeo.scale(1.2, 1, 0.45);
    this.upperBeak = new THREE.Mesh(upperBeakGeo, this.mats.beak);
    this.upperBeak.rotation.x = Math.PI / 2;
    this.upperBeak.position.set(0, -0.05, 0.52);
    this.headPivot.add(this.upperBeak);

    const lowerBeakGeo = new THREE.CylinderGeometry(0.13, 0.2, 0.36, 10);
    lowerBeakGeo.scale(1.1, 1, 0.35);
    this.lowerBeak = new THREE.Mesh(lowerBeakGeo, this.mats.beak);
    this.lowerBeak.rotation.x = Math.PI / 2;
    this.lowerBeak.position.set(0, -0.13, 0.48);
    this.headPivot.add(this.lowerBeak);

    // Acessórios de Cabeça
    this._buildHeadGear();

    // Asas (pivô nos ombros)
    this.leftWing = this._createWing(-1);
    this.rightWing = this._createWing(1);
    this.bodyPivot.add(this.leftWing, this.rightWing);

    // Pés (pivô no quadril)
    this.leftFoot = this._createFoot(-0.26);
    this.rightFoot = this._createFoot(0.26);
    this.root.add(this.leftFoot, this.rightFoot);
  }

  _createEye(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), this.mats.eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), this.mats.eye);
    pupil.position.z = 0.06;
    group.add(sclera, pupil);
    return group;
  }

  _createWing(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.52, 0.22, 0);
    const wingGeo = new THREE.SphereGeometry(0.28, 10, 10);
    wingGeo.scale(0.35, 1.35, 0.75);
    const mesh = new THREE.Mesh(wingGeo, this.mats.body);
    mesh.position.set(side * 0.08, -0.25, 0);
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  }

  _createFoot(x) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.14, 0.05);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), this.mats.beak);
    leg.position.y = 0.05;

    const padGeo = new THREE.BoxGeometry(0.32, 0.08, 0.44);
    const pad = new THREE.Mesh(padGeo, this.mats.beak);
    pad.position.set(0, -0.08, 0.1);
    pad.castShadow = true;

    pivot.add(leg, pad);
    return pivot;
  }

  _buildHeadGear() {
    // 1. Capacete de Obra ('construction')
    this.helmetGroup = new THREE.Group();
    this.helmetGroup.position.set(0, 0.32, 0);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      this.mats.helmet
    );
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.05, 14), this.mats.helmet);
    brim.position.set(0, 0.02, 0.06);
    this.helmetGroup.add(dome, brim);
    this.headPivot.add(this.helmetGroup);

    // 2. Óculos de Proteção ('workshop' / 'lab')
    this.gogglesGroup = new THREE.Group();
    this.gogglesGroup.position.set(0, 0.26, 0.32);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.14), this.mats.gogglesFrame);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.16), this.mats.gogglesLens);
    this.gogglesGroup.add(frame, lens);
    this.headPivot.add(this.gogglesGroup);
  }

  setOutfit(outfit) {
    this.outfit = outfit;
    this.helmetGroup.visible = outfit === 'construction';
    this.gogglesGroup.visible = outfit === 'workshop' || outfit === 'lab';
    this.labCoat.visible = outfit === 'lab';
  }

  setAnimation(animName) {
    this.currentAnim = animName || 'idle';
  }

  /**
   * Atualização determinística baseada no tempo global `t` (em segundos)
   */
  update(t, isSpeaking = false) {
    // Reset suave das transformações locais
    this.bodyPivot.position.y = 0.65;
    this.bodyPivot.rotation.set(0, 0, 0);
    this.headPivot.rotation.set(0, 0, 0);
    this.leftWing.rotation.set(0, 0, 0.15);
    this.rightWing.rotation.set(0, 0, -0.15);
    this.leftFoot.position.z = 0.05;
    this.rightFoot.position.z = 0.05;
    this.leftEye.scale.setScalar(1);
    this.rightEye.scale.setScalar(1);

    // Movimento do bico sincronizado com narração
    this.lowerBeak.rotation.x = isSpeaking
      ? Math.PI / 2 + Math.abs(Math.sin(t * 24)) * 0.35
      : Math.PI / 2;

    switch (this.currentAnim) {
      case 'idle':
        this.bodyPivot.position.y = 0.65 + Math.sin(t * 3) * 0.03;
        this.headPivot.rotation.z = Math.sin(t * 1.5) * 0.05;
        break;

      case 'walk':
        this.bodyPivot.position.y = 0.65 + Math.abs(Math.sin(t * 10)) * 0.08;
        this.bodyPivot.rotation.z = Math.sin(t * 10) * 0.08;
        this.leftFoot.position.z = 0.05 + Math.sin(t * 10) * 0.22;
        this.rightFoot.position.z = 0.05 - Math.sin(t * 10) * 0.22;
        this.leftWing.rotation.x = -Math.sin(t * 10) * 0.4;
        this.rightWing.rotation.x = Math.sin(t * 10) * 0.4;
        break;

      case 'shock':
        // Susto nos primeiros 1.5s do gancho
        const jump = Math.max(0, Math.sin(t * 14)) * 0.25;
        this.bodyPivot.position.y = 0.65 + jump;
        this.headPivot.rotation.x = -0.22;
        this.leftWing.rotation.z = 1.2;
        this.rightWing.rotation.z = -1.2;
        this.leftEye.scale.setScalar(1.35);
        this.rightEye.scale.setScalar(1.35);
        this.lowerBeak.rotation.x = Math.PI / 2 + 0.4;
        break;

      case 'confused':
        this.headPivot.rotation.z = 0.32 + Math.sin(t * 2) * 0.06;
        this.rightWing.rotation.z = -2.1; // Asa na cabeça coçando
        this.rightWing.rotation.x = 0.4;
        break;

      case 'point':
        // Asa direita aponta para o mecanismo no centro da tela
        this.rightWing.rotation.z = -1.45;
        this.rightWing.rotation.y = 0.4;
        this.headPivot.rotation.y = 0.25;
        break;

      case 'build':
        // Movimento rápido de martelar/ajustar peça
        this.bodyPivot.rotation.x = 0.15;
        this.rightWing.rotation.x = -1.2 + Math.sin(t * 18) * 0.9;
        this.leftWing.rotation.x = -0.5;
        break;

      case 'celebrate':
        this.bodyPivot.position.y = 0.65 + Math.abs(Math.sin(t * 9)) * 0.32;
        this.leftWing.rotation.z = 2.4 + Math.sin(t * 12) * 0.25;
        this.rightWing.rotation.z = -2.4 - Math.sin(t * 12) * 0.25;
        break;
    }
  }
}