import * as THREE from 'three';
import { setupLighting } from './core/lighting.js';
import { CameraRig } from './core/camera.js';
import { HudController } from './core/hud.js';
import { DuckMascot } from './characters/duckMascot.js';
import { SceneObjectBuilder } from './builders/primitives.js';
import { FxManager } from './fx/particles.js';

const STAGE_W = 1080;
const STAGE_H = 1920;
const renderScale = new URLSearchParams(window.location.search).get('renderScale') === '0.5' ? 0.5 : 1;
if (renderScale !== 1) {
  document.body.style.transform = `scale(${renderScale})`;
  document.body.style.transformOrigin = 'top left';
}

const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(STAGE_W * renderScale, STAGE_H * renderScale, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const lighting = setupLighting(scene);

const cameraRig = new CameraRig();
const hud = new HudController();
const duck = new DuckMascot();
scene.add(duck.root);

const objectBuilder = new SceneObjectBuilder(scene);
const fxManager = new FxManager(scene);

const _proj = new THREE.Vector3();
function resolveAnchor(a) {
  if (Array.isArray(a)) return a;
  if (a && typeof a === 'object' && a.obj) return objectBuilder.getWorldPoint(a.obj, a.local || [0, 0, 0]);
  return null;
}

function projectToStage(anchor) {
  const p = resolveAnchor(anchor);
  if (!p) return null;
  const cam = cameraRig.camera;
  cam.updateMatrixWorld(true);
  _proj.set(p[0], p[1], p[2]).project(cam);
  return {
    x: (_proj.x * 0.5 + 0.5) * STAGE_W,
    y: (-_proj.y * 0.5 + 0.5) * STAGE_H,
    visible: _proj.z < 1
  };
}

let timeline = null;
let activeSceneIndex = -1;
let isHeadlessRender = false;
const DEFAULT_DUCK_POS = [-0.8, 0, 0.7];
const DEFAULT_DUCK_ROT_Y = 0.55;

window.loadTimeline = function (data) {
  timeline = data;
  activeSceneIndex = -1;
  duck.setOutfit(data.outfit || 'workshop');
  hud.reset();
  window.renderAtTime(0);
};

window.renderAtTime = function (t) {
  if (!timeline || !Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
    duck.update(t, false);
    lighting?.update?.(t);
    cameraRig.update(t, t);
    renderer.render(scene, cameraRig.camera);
    return;
  }

  let idx = timeline.scenes.findIndex((s) => t >= s.start && t < s.end);
  if (idx === -1) {
    idx = t < timeline.scenes[0].start ? 0 : timeline.scenes.length - 1;
  }

  const currentScene = timeline.scenes[idx];
  const sceneTime = Math.max(0, t - currentScene.start);

  if (idx !== activeSceneIndex) {
    activeSceneIndex = idx;
    cameraRig.setPreset(currentScene.camera || 'hero_wide');
    lighting.setEnvironment(currentScene.environment || 'workshop');
    duck.setAnimation(currentScene.duck?.anim || 'idle');
    duck.root.position.set(...(currentScene.duck?.pos ?? DEFAULT_DUCK_POS));
    duck.root.rotation.y =
      typeof currentScene.duck?.rotY === 'number' ? currentScene.duck.rotY : DEFAULT_DUCK_ROT_Y;

    objectBuilder.loadObjects(currentScene.objects || []);
    fxManager.setEffect(currentScene.fx || 'none');
  }

  const speechEnd = currentScene.speech_end ?? currentScene.end;
  const isSpeaking = Boolean(currentScene.narration) && t < speechEnd;

  duck.update(t, isSpeaking);
  lighting?.update?.(t);
  objectBuilder.update(t);
  fxManager.update(t, duck.root.position);
  cameraRig.update(t, sceneTime);
  hud.update(currentScene, sceneTime, t, projectToStage);

  renderer.render(scene, cameraRig.camera);
};

window.__ENGINE_READY__ = true;

let previewStart = performance.now();
function previewLoop(now) {
  if (isHeadlessRender) return;
  const elapsed = (now - previewStart) / 1000;
  window.renderAtTime(elapsed);
  requestAnimationFrame(previewLoop);
}

window.enableHeadlessMode = function () {
  isHeadlessRender = true;
};

requestAnimationFrame(previewLoop);
