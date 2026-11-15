import * as THREE from 'three';
import { setupLighting } from './core/lighting.js';
import { CameraRig } from './core/camera.js';
import { HudController } from './core/hud.js';
import { DuckMascot } from './characters/duckMascot.js';
import { SceneObjectBuilder } from './builders/primitives.js';
import { FxManager } from './fx/particles.js';

const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true // Essencial para captura limpa de screenshots
});
renderer.setSize(1080, 1920, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c29);
scene.fog = new THREE.Fog(0x1a1c29, 12, 26);

setupLighting(scene);

const cameraRig = new CameraRig();
const hud = new HudController();
const duck = new DuckMascot();
scene.add(duck.root);

const objectBuilder = new SceneObjectBuilder(scene);
const fxManager = new FxManager(scene);

// Estado da timeline carregada
let timeline = null;
let activeSceneIndex = -1;
let isHeadlessRender = false;

/**
 * Carrega o JSON enriquecido com timestamps de áudio (start, end)
 */
window.loadTimeline = function (data) {
  timeline = data;
  activeSceneIndex = -1;
  duck.setOutfit(data.outfit || 'workshop');
  window.renderAtTime(0);
};

/**
 * Renderiza exatamente o instante `t` (em segundos)
 */
window.renderAtTime = function (t) {
  if (!timeline || !Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
    duck.update(t, false);
    cameraRig.update(t, t);
    renderer.render(scene, cameraRig.camera);
    return;
  }

  // Encontra a cena correspondente ao tempo `t`
  let idx = timeline.scenes.findIndex((s) => t >= s.start && t < s.end);
  if (idx === -1) {
    idx = t < timeline.scenes[0].start ? 0 : timeline.scenes.length - 1;
  }

  const currentScene = timeline.scenes[idx];
  const sceneTime = Math.max(0, t - currentScene.start);

  // Troca de estado apenas quando muda de cena
  if (idx !== activeSceneIndex) {
    activeSceneIndex = idx;
    cameraRig.setPreset(currentScene.camera || 'hero_wide');
    duck.setAnimation(currentScene.duck?.anim || 'idle');

    if (currentScene.duck?.pos) {
      duck.root.position.set(...currentScene.duck.pos);
    }
    if (typeof currentScene.duck?.rotY === 'number') {
      duck.root.rotation.y = currentScene.duck.rotY;
    }

    objectBuilder.loadObjects(currentScene.objects || []);
    fxManager.setEffect(currentScene.fx || 'none');
  }

  const isSpeaking = Boolean(currentScene.narration && sceneTime < (currentScene.speech_end ?? currentScene.end - currentScene.start));

  duck.update(t, isSpeaking);
  objectBuilder.update(t);
  fxManager.update(t);
  cameraRig.update(t, sceneTime);
  hud.update(currentScene, sceneTime);

  renderer.render(scene, cameraRig.camera);
};

// Sinaliza para o Playwright que o motor está pronto
window.__ENGINE_READY__ = true;

// Preview automático no navegador caso você abra manualmente para testar o Pato
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