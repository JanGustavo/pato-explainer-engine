export class HudController {
  constructor() {
    this.bannerEl = document.getElementById('hook-banner');
    this.subtitleEl = document.getElementById('subtitles-box');
    this.rewindEl = document.getElementById('rewind-overlay');
  }

  update(sceneData, sceneTime) {
    if (!sceneData) return;

    // Banner superior (ex.: "NÃO FABRICA VENTO?!")
    if (sceneData.hud_text) {
      this.bannerEl.textContent = sceneData.hud_text;
      const popIn = Math.min(1, sceneTime / 0.18);
      const scale = 0.85 + 0.15 * (1 - Math.pow(1 - popIn, 3));
      this.bannerEl.style.opacity = String(popIn);
      this.bannerEl.style.transform = `scale(${scale.toFixed(4)})`;
    } else {
      this.bannerEl.style.opacity = '0';
    }

    // Legenda inferior
    if (sceneData.narration) {
      this.subtitleEl.style.display = 'block';
      this.subtitleEl.textContent = sceneData.narration;
    } else {
      this.subtitleEl.style.display = 'none';
    }

    // Efeito Rewind
    const isRewind = sceneData.fx === 'rewind';
    this.rewindEl.style.display = isRewind ? 'flex' : 'none';
  }
}