import * as THREE from 'three';

const BROW_BASE_Y = 0.255;

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
      brow: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, flatShading: true }),
      helmet: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, flatShading: true }),
      cap: new THREE.MeshStandardMaterial({
        color: 0x14b8a6, roughness: 0.55, flatShading: true, side: THREE.DoubleSide
      }),
      capDark: new THREE.MeshStandardMaterial({
        color: 0x0f766e, roughness: 0.6, flatShading: true, side: THREE.DoubleSide
      }),
      emblem: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, flatShading: true }),
      emblemDark: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, flatShading: true }),
      coat: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7, flatShading: true })
    };
  }

  _buildRig() {
    this.bodyPivot = new THREE.Group();
    this.bodyPivot.position.y = 0.65;
    this.root.add(this.bodyPivot);

    const torsoGeo = new THREE.SphereGeometry(0.55, 14, 12);
    torsoGeo.scale(0.95, 1.15, 1.05);
    this.torso = new THREE.Mesh(torsoGeo, this.mats.body);
    this.torso.castShadow = true;
    this.bodyPivot.add(this.torso);

    const tailGeo = new THREE.ConeGeometry(0.22, 0.45, 8);
    const tail = new THREE.Mesh(tailGeo, this.mats.body);
    tail.position.set(0, -0.15, -0.58);
    tail.rotation.x = -Math.PI * 0.35;
    this.torso.add(tail);

    const coatGeo = new THREE.CylinderGeometry(0.54, 0.62, 0.75, 14);
    this.labCoat = new THREE.Mesh(coatGeo, this.mats.coat);
    this.labCoat.position.y = -0.12;
    this.torso.add(this.labCoat);

    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.72, 0.05);
    this.bodyPivot.add(this.headPivot);

    const headGeo = new THREE.SphereGeometry(0.44, 14, 12);
    this.head = new THREE.Mesh(headGeo, this.mats.body);
    this.head.castShadow = true;
    this.headPivot.add(this.head);

    this.leftEye = this._createEye(-0.18, 0.08, 0.37);
    this.rightEye = this._createEye(0.18, 0.08, 0.37);
    this.headPivot.add(this.leftEye, this.rightEye);

    this.leftBrow = this._createBrow(-1);
    this.rightBrow = this._createBrow(1);
    this.headPivot.add(this.leftBrow.root, this.rightBrow.root);

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

    this._buildHeadGear();

    this.leftWing = this._createWing(-1);
    this.rightWing = this._createWing(1);
    this.bodyPivot.add(this.leftWing, this.rightWing);

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

  _createBrow(side) {
    const root = new THREE.Group();
    root.position.set(side * 0.18, BROW_BASE_Y, 0.355);
    root.rotation.y = side * 0.4;

    const tilt = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.05), this.mats.brow);
    tilt.add(mesh);
    root.add(tilt);
    return { root, tilt };
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

    this.capGroup = new THREE.Group();
    this.capGroup.position.set(0, 0.3, -0.03);
    this.capGroup.rotation.x = -0.3;

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.47, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5),
      this.mats.cap
    );
    crown.scale.set(1, 0.62, 1);
    crown.castShadow = true;
    this.capGroup.add(crown);

    const underside = new THREE.Mesh(new THREE.CircleGeometry(0.47, 12), this.mats.capDark);
    underside.rotation.x = Math.PI / 2;
    this.capGroup.add(underside);

    const button = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.mats.capDark);
    button.position.set(0, 0.3, 0);
    this.capGroup.add(button);

    const brimGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.05, 16, 1, false, -Math.PI / 2, Math.PI);
    const pos = brimGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, pos.getY(i) - 0.5 * x * x - 0.18 * z * z);
    }
    pos.needsUpdate = true;
    brimGeo.computeVertexNormals();
    const capBrim = new THREE.Mesh(brimGeo, this.mats.capDark);
    capBrim.position.set(0, 0.0, 0.25);
    capBrim.rotation.x = 0.4;
    capBrim.castShadow = true;
    this.capGroup.add(capBrim);

    const badge = new THREE.Group();
    badge.position.set(0, 0.127, 0.435);
    badge.rotation.x = Math.PI / 2 - 0.65;
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 8), this.mats.emblem);
    badge.add(gear);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.045), this.mats.emblem);
      tooth.position.set(Math.sin(a) * 0.105, 0, Math.cos(a) * 0.105);
      tooth.rotation.y = a;
      badge.add(tooth);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 10), this.mats.emblemDark);
    badge.add(hub);
    this.capGroup.add(badge);

    this.headPivot.add(this.capGroup);
  }

  setOutfit(outfit) {
    this.outfit = outfit;
    this.helmetGroup.visible = outfit === 'construction';
    this.capGroup.visible = outfit !== 'construction';
    this.labCoat.visible = outfit === 'lab';
  }

  setAnimation(animName) {
    this.currentAnim = animName || 'idle';
  }

  _applyBrow(brow, side, lift, tilt) {
    brow.root.position.y = BROW_BASE_Y + lift;
    brow.tilt.rotation.z = side * tilt;
  }

  update(t, isSpeaking = false) {
    this.bodyPivot.position.set(0, 0.65, 0);
    this.bodyPivot.rotation.set(0, 0, 0);
    this.headPivot.rotation.set(0, 0, 0);
    this.leftWing.rotation.set(0, 0, 0.15);
    this.rightWing.rotation.set(0, 0, -0.15);
    this.leftFoot.position.z = 0.05;
    this.rightFoot.position.z = 0.05;
    this.leftEye.scale.setScalar(1);
    this.rightEye.scale.setScalar(1);

    this.lowerBeak.rotation.x = isSpeaking
      ? Math.PI / 2 + Math.abs(Math.sin(t * 24)) * 0.35
      : Math.PI / 2;

    let L = { lift: 0, tilt: 0 };
    let R = { lift: 0, tilt: 0 };
    let canBlink = true;

    switch (this.currentAnim) {
      case 'idle':
        this.bodyPivot.position.y = 0.65 + Math.sin(t * 3) * 0.03;
        this.headPivot.rotation.z = Math.sin(t * 1.5) * 0.05;
        break;

      case 'overheat':
        this.bodyPivot.position.y = 0.58 + Math.sin(t * 8) * 0.02;
        this.bodyPivot.rotation.x = -0.16;
        this.headPivot.rotation.x = -0.18 + Math.sin(t * 8) * 0.05;
        this.headPivot.rotation.z = Math.sin(t * 3) * 0.08;
        this.rightWing.rotation.x = -1.6;
        this.rightWing.rotation.z = -0.6 + Math.sin(t * 22) * 0.55;
        this.leftWing.rotation.z = 0.35;
        this.leftEye.scale.set(1.05, 0.55, 1);
        this.rightEye.scale.set(1.05, 0.55, 1);
        this.lowerBeak.rotation.x = Math.PI / 2 + 0.32 + Math.abs(Math.sin(t * 14)) * 0.18;
        canBlink = false;
        L = { lift: -0.02, tilt: -0.26 };
        R = { lift: -0.02, tilt: -0.26 };
        break;

      case 'fourth_wall': {
        // Compensa a rotação do root para encarar a câmera (70% corpo, 30% cabeça)
        const facing = -this.root.rotation.y;
        this.bodyPivot.rotation.y = facing * 0.7;
        this.headPivot.rotation.y = facing * 0.3;

        this.bodyPivot.position.z = 0.22;
        this.bodyPivot.position.y = 0.65 + Math.sin(t * 4) * 0.03;
        this.bodyPivot.rotation.x = 0.16;
        this.headPivot.rotation.x = -0.12;
        this.headPivot.rotation.z = -0.08;
        this.rightWing.rotation.x = -1.35;
        this.rightWing.rotation.z = -0.25 + Math.sin(t * 10) * 0.08;
        this.leftWing.rotation.z = 0.45;
        L = { lift: 0.04, tilt: -0.1 };
        R = { lift: -0.01, tilt: 0.28 };
        break;
      }

      case 'walk':
        this.bodyPivot.position.y = 0.65 + Math.abs(Math.sin(t * 10)) * 0.08;
        this.bodyPivot.rotation.z = Math.sin(t * 10) * 0.08;
        this.leftFoot.position.z = 0.05 + Math.sin(t * 10) * 0.22;
        this.rightFoot.position.z = 0.05 - Math.sin(t * 10) * 0.22;
        this.leftWing.rotation.x = -Math.sin(t * 10) * 0.4;
        this.rightWing.rotation.x = Math.sin(t * 10) * 0.4;
        break;

      case 'shock': {
        const jump = Math.max(0, Math.sin(t * 14)) * 0.25;
        this.bodyPivot.position.y = 0.65 + jump;
        this.headPivot.rotation.x = -0.22;
        this.leftWing.rotation.z = 1.2;
        this.rightWing.rotation.z = -1.2;
        this.leftEye.scale.setScalar(1.35);
        this.rightEye.scale.setScalar(1.35);
        this.lowerBeak.rotation.x = Math.PI / 2 + 0.4;
        canBlink = false;
        L = { lift: 0.07, tilt: -0.18 };
        R = { lift: 0.07, tilt: -0.18 };
        break;
      }

      case 'confused':
        this.headPivot.rotation.z = 0.32 + Math.sin(t * 2) * 0.06;
        this.rightWing.rotation.z = -2.1;
        this.rightWing.rotation.x = 0.4;
        L = { lift: 0.06 + Math.sin(t * 2) * 0.012, tilt: -0.15 };
        R = { lift: -0.01, tilt: 0.4 };
        break;

      case 'point':
        this.rightWing.rotation.z = -1.45;
        this.rightWing.rotation.y = 0.4;
        this.headPivot.rotation.y = 0.25;
        L = { lift: 0.02, tilt: 0.08 };
        R = { lift: 0.02, tilt: 0.08 };
        break;

      case 'build': {
        this.bodyPivot.rotation.x = 0.15;
        this.rightWing.rotation.x = -1.2 + Math.sin(t * 18) * 0.9;
        this.leftWing.rotation.x = -0.5;
        const focus = 0.42 + Math.sin(t * 18) * 0.04;
        L = { lift: -0.015, tilt: focus };
        R = { lift: -0.015, tilt: focus };
        break;
      }

      case 'celebrate': {
        const bounce = Math.abs(Math.sin(t * 9));
        this.bodyPivot.position.y = 0.65 + bounce * 0.32;
        this.leftWing.rotation.z = 2.4 + Math.sin(t * 12) * 0.25;
        this.rightWing.rotation.z = -2.4 - Math.sin(t * 12) * 0.25;
        L = { lift: 0.05 + bounce * 0.02, tilt: -0.12 };
        R = { lift: 0.05 + bounce * 0.02, tilt: -0.12 };
        break;
      }
    }

    if (canBlink) {
      const cycle = t % 3.4;
      if (cycle < 0.14) {
        const sy = 1 - 0.9 * Math.sin((cycle / 0.14) * Math.PI);
        this.leftEye.scale.y = sy;
        this.rightEye.scale.y = sy;
      }
    }

    const talkLift = isSpeaking ? Math.max(0, Math.sin(t * 6.5)) * 0.02 : 0;
    this._applyBrow(this.leftBrow, -1, L.lift + talkLift, L.tilt);
    this._applyBrow(this.rightBrow, 1, R.lift + talkLift, R.tilt);
  }
}
