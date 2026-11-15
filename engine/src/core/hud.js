const STAGE_W = 1080;
const STAGE_H = 1920;

const MAX_WORDS_PER_CHUNK = 3;
const STRONG_END = /[.!?…]$/;
const SOFT_END = /[,;:—–]$/;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const coreLen = (w) => w.replace(/[^\p{L}\p{N}]/gu, '').length;

function buildCaptionChunks(narration, start, speechEnd) {
  const words = (narration || '').match(/\S+/g) || [];
  const speechDur = speechEnd - start;
  if (!words.length || speechDur <= 0) return [];

  const units = words.map((w, i) => {
    const body = Math.max(1, coreLen(w)) + 1.5;
    let pause = 0;
    if (i < words.length - 1) {
      if (STRONG_END.test(w)) pause = 5;
      else if (SOFT_END.test(w)) pause = 3;
    }
    return { body, pause };
  });
  const total = units.reduce((s, u) => s + u.body + u.pause, 0);
  const unit = speechDur / total;

  let cursor = start;
  const timed = words.map((w, i) => {
    const ws = cursor;
    const we = cursor + units[i].body * unit;
    cursor = we + units[i].pause * unit;
    return { w, start: ws, end: we };
  });

  const groups = [];
  let cur = [];
  timed.forEach((tw, i) => {
    cur.push(i);
    const strong = STRONG_END.test(tw.w);
    const soft = SOFT_END.test(tw.w);
    if (cur.length >= MAX_WORDS_PER_CHUNK || strong || (soft && cur.length >= 2) || (cur.length >= 2 && coreLen(tw.w) >= 9)) {
      groups.push(cur);
      cur = [];
    }
  });
  if (cur.length) groups.push(cur);

  const merged = [];
  groups.forEach((g) => {
    const prev = merged[merged.length - 1];
    if (g.length === 1 && prev && prev.length < 4 && !STRONG_END.test(timed[prev[prev.length - 1]].w)) {
      prev.push(...g);
    } else {
      merged.push(g);
    }
  });

  return merged.map((g, ci) => {
    const ws = g.map((i) => timed[i]);
    const next = merged[ci + 1];
    return {
      text: ws.map((x) => x.w).join(' '),
      start: ws[0].start,
      end: next ? timed[next[0]].start : speechEnd,
      words: ws
    };
  });
}

const CSS = `
#hud-labels{position:absolute;left:0;top:0;width:${STAGE_W}px;height:${STAGE_H}px;pointer-events:none;overflow:hidden;}
#hud-labels svg{position:absolute;left:0;top:0;width:${STAGE_W}px;height:${STAGE_H}px;}
.hud-label{position:absolute;white-space:nowrap;background:#fde047;color:#0f172a;border:6px solid #0f172a;
  border-radius:14px;padding:12px 26px;font:900 46px/1.05 Impact,'Arial Black',system-ui,sans-serif;
  letter-spacing:1px;text-transform:uppercase;box-shadow:8px 8px 0 #0f172a;opacity:0;will-change:transform;}
.hud-sub-word{display:inline-block;margin:0 0.24em;will-change:transform;}
`;

export class HudController {
  constructor() {
    this.bannerEl = document.getElementById('hook-banner');
    this.subtitleEl = document.getElementById('subtitles-box');
    this.rewindEl = document.getElementById('rewind-overlay');

    this._fallbackChunks = new WeakMap();
    this._chunk = null;
    this._wordEls = [];
    this._labelKey = '';
    this._labelItems = [];

    this._injectStyle();
    this._setupSubtitleBox();
    this._setupLabelsLayer();
  }

  _injectStyle() {
    if (document.getElementById('hud-dynamic-style')) return;
    const style = document.createElement('style');
    style.id = 'hud-dynamic-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  _setupSubtitleBox() {
    Object.assign(this.subtitleEl.style, {
      position: 'absolute',
      left: '50%',
      bottom: '400px',
      width: '960px',
      transform: 'translateX(-50%)',
      textAlign: 'center',
      background: 'none',
      border: 'none',
      boxShadow: 'none',
      padding: '0',
      margin: '0',
      font: "900 88px/1.12 Impact,'Arial Black',system-ui,sans-serif",
      textTransform: 'uppercase',
      color: '#ffffff',
      webkitTextStroke: '11px #0b1020',
      whiteSpace: 'nowrap',
      paintOrder: 'stroke fill',
      textShadow: '0 8px 0 #0b1020',
      display: 'none'
    });
  }

  _setupLabelsLayer() {
    const host = this.subtitleEl.parentElement || document.body;
    this.labelsEl = document.createElement('div');
    this.labelsEl.id = 'hud-labels';
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('viewBox', `0 0 ${STAGE_W} ${STAGE_H}`);
    this.labelsEl.appendChild(this.svgEl);
    host.appendChild(this.labelsEl);
  }

  reset() {
    this._chunk = null;
    this._wordEls = [];
    this.subtitleEl.innerHTML = '';
    this.subtitleEl.style.display = 'none';
    this._clearLabels();
    this._labelKey = '';
  }

  update(sceneData, sceneTime, t = (sceneData?.start ?? 0) + sceneTime, project = null) {
    if (!sceneData) return;

    if (sceneData.hud_text) {
      this.bannerEl.textContent = sceneData.hud_text;
      const popIn = Math.min(1, sceneTime / 0.18);
      const scale = 0.85 + 0.15 * (1 - Math.pow(1 - popIn, 3));
      this.bannerEl.style.opacity = String(popIn);
      this.bannerEl.style.transform = `scale(${scale.toFixed(4)})`;
    } else {
      this.bannerEl.style.opacity = '0';
    }

    this._updateSubtitles(sceneData, t);
    this._updateLabels(sceneData, sceneTime, project);

    const isRewind = sceneData.fx === 'rewind';
    this.rewindEl.style.display = isRewind ? 'flex' : 'none';
  }

  _getChunks(scene) {
    if (Array.isArray(scene.caption_chunks) && scene.caption_chunks.length) return scene.caption_chunks;
    if (!scene.narration) return [];
    let c = this._fallbackChunks.get(scene);
    if (!c) {
      c = buildCaptionChunks(scene.narration, scene.start ?? 0, scene.speech_end ?? scene.end ?? 0);
      this._fallbackChunks.set(scene, c);
    }
    return c;
  }

  _updateSubtitles(scene, t) {
    const chunks = this._getChunks(scene);
    let chunk = null;
    for (const c of chunks) {
      if (t >= c.start && t < c.end) {
        chunk = c;
        break;
      }
    }

    if (!chunk) {
      this.subtitleEl.style.display = 'none';
      this._chunk = null;
      return;
    }

    this.subtitleEl.style.display = 'block';

    if (chunk !== this._chunk) {
      this._chunk = chunk;
      this.subtitleEl.innerHTML = '';

      const line = document.createElement('span');
      line.style.cssText = 'display:inline-block;white-space:nowrap;transform-origin:50% 50%;';
      const words = chunk.words && chunk.words.length ? chunk.words : [{ w: chunk.text, start: chunk.start }];
      this._wordEls = words.map((w) => {
        const el = document.createElement('span');
        el.className = 'hud-sub-word';
        el.textContent = w.w;
        line.appendChild(el);
        return el;
      });
      this.subtitleEl.appendChild(line);

      const fit = Math.min(1, 940 / Math.max(1, line.offsetWidth));
      line.style.transform = `scale(${fit.toFixed(4)})`;
      this._chunkWords = words;
    }

    const age = t - chunk.start;
    const pop = easeOutBack(clamp01(age / 0.12));
    const blockScale = 0.8 + 0.2 * pop;
    this.subtitleEl.style.transform = `translateX(-50%) scale(${blockScale.toFixed(4)})`;
    this.subtitleEl.style.opacity = String(clamp01(age / 0.06 + 0.4));

    let active = 0;
    for (let i = 0; i < this._chunkWords.length; i++) {
      if (t >= this._chunkWords[i].start) active = i;
    }
    this._wordEls.forEach((el, i) => {
      const on = i === active;
      el.style.color = on ? '#facc15' : '#ffffff';
      el.style.transform = on ? 'scale(1.16) rotate(-2deg)' : 'scale(1)';
    });
  }

  _clearLabels() {
    this._labelItems = [];
    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);
    this.labelsEl.querySelectorAll('.hud-label').forEach((n) => n.remove());
  }

  _svg(name, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  _rebuildLabels(labels) {
    this._clearLabels();

    labels.forEach((raw, i) => {
      const o = typeof raw === 'string' ? { text: raw } : { ...raw };
      const text = String(o.text ?? '');
      if (!text) return;

      const side = o.side || (i % 2 === 0 ? 'left' : 'right');
      const row = Math.floor(i / 2);
      const top = o.top ?? 560 + row * 190 + (i % 2) * 54;
      const at = typeof o.at === 'number' ? o.at : 0.35 + i * 0.45;
      const rot = i % 2 === 0 ? -2 : 2;

      const box = document.createElement('div');
      box.className = 'hud-label';
      box.textContent = text;
      box.style.top = `${top}px`;
      box.style.left = '0px';
      this.labelsEl.appendChild(box);

      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const left = side === 'left' ? 40 : STAGE_W - 40 - w;
      box.style.left = `${left}px`;

      const attach = {
        x: side === 'left' ? left + w : left,
        y: top + h / 2
      };
      const defaultTarget = {
        x: STAGE_W / 2 + (side === 'left' ? -70 : 70),
        y: 740 + i * 80
      };

      const outline = this._svg('line', { stroke: '#0f172a', 'stroke-width': 14, 'stroke-linecap': 'round' });
      const line = this._svg('line', { stroke: '#fde047', 'stroke-width': 7, 'stroke-linecap': 'round' });
      const dot = this._svg('circle', { r: 15, fill: '#fde047', stroke: '#0f172a', 'stroke-width': 6 });
      this.svgEl.append(outline, line, dot);

      this._labelItems.push({
        box, outline, line, dot, side, at, rot, attach, defaultTarget,
        anchor: o.anchor || null,
        phase: i * 0.9
      });
    });
  }

  _updateLabels(scene, sceneTime, project) {
    const labels = Array.isArray(scene.labels) ? scene.labels : [];
    const key = labels.length ? `${scene.start}|${JSON.stringify(labels)}` : '';
    if (key !== this._labelKey) {
      this._labelKey = key;
      this._rebuildLabels(labels);
    }
    if (!this._labelItems.length) return;

    const dur = (scene.end ?? 0) - (scene.start ?? 0);
    const fadeOut = dur > 0 ? clamp01((dur - sceneTime) / 0.25) : 1;

    for (const it of this._labelItems) {
      const age = sceneTime - it.at;
      const p = clamp01(age / 0.25);
      const lp = easeOutCubic(clamp01((age - 0.12) / 0.3));
      const visible = age >= 0 && fadeOut > 0;

      if (!visible) {
        it.box.style.opacity = '0';
        it.outline.setAttribute('opacity', '0');
        it.line.setAttribute('opacity', '0');
        it.dot.setAttribute('opacity', '0');
        continue;
      }

      let target = it.defaultTarget;
      if (it.anchor && project) {
        const pr = project(it.anchor);
        if (pr && pr.visible !== false) {
          target = {
            x: Math.min(STAGE_W - 50, Math.max(50, pr.x)),
            y: Math.min(STAGE_H - 50, Math.max(50, pr.y))
          };
        }
      }

      const bob = Math.sin(sceneTime * 2.2 + it.phase) * 4;
      const scale = 0.7 + 0.3 * easeOutBack(p);
      const opacity = p * fadeOut;

      it.box.style.opacity = String(opacity);
      it.box.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${it.rot}deg) scale(${scale.toFixed(4)})`;

      const ax = it.attach.x;
      const ay = it.attach.y + bob;
      const ex = ax + (target.x - ax) * lp;
      const ey = ay + (target.y - ay) * lp;
      for (const l of [it.outline, it.line]) {
        l.setAttribute('x1', ax.toFixed(1));
        l.setAttribute('y1', ay.toFixed(1));
        l.setAttribute('x2', ex.toFixed(1));
        l.setAttribute('y2', ey.toFixed(1));
        l.setAttribute('opacity', String(opacity));
      }

      const pulse = 1 + 0.18 * Math.sin(sceneTime * 6 + it.phase);
      it.dot.setAttribute('cx', target.x.toFixed(1));
      it.dot.setAttribute('cy', target.y.toFixed(1));
      it.dot.setAttribute('r', (15 * lp * pulse).toFixed(2));
      it.dot.setAttribute('opacity', String(opacity * (lp > 0.01 ? 1 : 0)));
    }
  }
}
