const mainVideo  = document.getElementById('main-video');
const seqCanvas  = document.getElementById('seq-canvas');
const poiLayer   = document.getElementById('poi-layer');
const trackEl    = document.getElementById('track');
const debugHud   = document.getElementById('debug-hud');
const debugCoords = document.getElementById('debug-coords');
const ctx        = seqCanvas.getContext('2d');

let currentScene = 'aereo';
let busy         = false;
const cache      = new Map();

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  resizeCanvas();
  initCursor();
  buildTrack();
  enterScene('aereo');
  Object.keys(CONFIG.sequences).forEach(preload);
});

window.addEventListener('resize', resizeCanvas);

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  seqCanvas.width        = window.innerWidth  * dpr;
  seqCanvas.height       = window.innerHeight * dpr;
  seqCanvas.style.width  = window.innerWidth  + 'px';
  seqCanvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Cursor ───────────────────────────────────────────────────────────────────

function initCursor() {
  const cursor = document.getElementById('cursor');
  const ring   = document.getElementById('ring');
  if (!cursor) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  (function loop() {
    cursor.style.left = mx + 'px';
    cursor.style.top  = my + 'px';
    const dx = (mx - rx) * 0.12;
    const dy = (my - ry) * 0.12;
    rx += dx; ry += dy;
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
    }
    requestAnimationFrame(loop);
  })();

  document.addEventListener('mouseover', e => {
    cursor.classList.toggle('on', !!e.target.closest('button,.t-pt,.poi'));
  });
}

// ─── Cena ─────────────────────────────────────────────────────────────────────

function enterScene(sceneId) {
  const scene = CONFIG.scenes[sceneId];
  if (!scene) return;
  currentScene = sceneId;

  if (scene.video) {
    mainVideo.src = scene.video;
    mainVideo.play().catch(() => {});
    mainVideo.style.display = 'block';
  } else {
    mainVideo.pause();
    mainVideo.style.display = 'none';
  }

  setActive(sceneId);
  renderPOIs(scene.pois);
}

// ─── Navegação ────────────────────────────────────────────────────────────────

async function navigateTo(targetId) {
  if (busy || targetId === currentScene) return;

  const seqId = CONFIG.transitions?.[currentScene]?.[targetId];
  if (!seqId) return;

  busy = true;
  hidePOIs();

  try {
    const frames = await preload(seqId);
    await playSequence(frames);
    enterScene(targetId);
  } catch (err) {
    console.error('Erro na sequência:', err);
  } finally {
    busy = false;
  }
}

// ─── Pré-carregamento ─────────────────────────────────────────────────────────

function preload(seqId) {
  if (cache.has(seqId)) return cache.get(seqId);

  const seq    = CONFIG.sequences[seqId];
  const total  = seq.to - seq.from + 1;
  const frames = new Array(total);
  let loaded   = 0;
  let failed   = false;

  const promise = new Promise((resolve, reject) => {
    for (let i = seq.from; i <= seq.to; i++) {
      const idx = i - seq.from;
      const num = String(i).padStart(seq.pad, '0');
      const img = new Image();
      img.src     = `${seq.folder}${seq.prefix}${num}.${seq.ext}`;
      img.onload  = () => { frames[idx] = img; if (++loaded === total) resolve(frames); };
      img.onerror = () => {
        if (!failed) { failed = true; cache.delete(seqId); reject(new Error(`Falha: ${img.src}`)); }
      };
    }
  });

  cache.set(seqId, promise);
  return promise;
}

// ─── Playback ─────────────────────────────────────────────────────────────────

function playSequence(frames) {
  return new Promise(resolve => {
    seqCanvas.classList.add('active');
    let index = 0;

    function loop() {
      drawCover(frames[index]);
      if (++index >= frames.length) { resolve(); return; }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
}

function drawCover(img) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw = Math.round(img.naturalWidth  * scale);
  const dh = Math.round(img.naturalHeight * scale);
  const dx = Math.round((cw - dw) / 2);
  const dy = Math.round((ch - dh) / 2);
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ─── POIs ─────────────────────────────────────────────────────────────────────

function renderPOIs(pois) {
  poiLayer.innerHTML = '';
  pois.forEach((poi, i) => {
    const el = document.createElement('div');
    el.className  = 'poi';
    el.style.left = poi.x + '%';
    el.style.top  = poi.y + '%';
    el.style.animationDelay = (i * 80) + 'ms';

    el.innerHTML = `
      <div class="poi-btn">
        <span class="poi-pulse"></span>
      </div>
      <div class="poi-name">${poi.label}</div>
    `;

    if (poi.target) el.addEventListener('click', () => navigateTo(poi.target));
    poiLayer.appendChild(el);
  });
}

function hidePOIs() {
  poiLayer.classList.add('out');
  setTimeout(() => { poiLayer.innerHTML = ''; poiLayer.classList.remove('out'); }, 300);
}

// ─── Track (dock inferior) ────────────────────────────────────────────────────

function buildTrack() {
  const wrap = document.createElement('div');
  wrap.id = 'track-pts';

  CONFIG.timeline.forEach(item => {
    const btn = document.createElement('button');
    btn.className  = 't-pt';
    btn.dataset.id = item.id;
    btn.textContent = item.label;
    btn.addEventListener('click', () => navigateTo(item.id));
    wrap.appendChild(btn);
  });

  trackEl.appendChild(wrap);
  trackEl.classList.add('show');
}

function setActive(id) {
  document.querySelectorAll('.t-pt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });
}

// ─── Debug (tecla D) ──────────────────────────────────────────────────────────

let debugOn = false;

document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'd') return;
  debugOn = !debugOn;
  debugHud.hidden = !debugOn;
  document.body.style.cursor = debugOn ? 'crosshair' : '';
});

document.addEventListener('click', e => {
  if (!debugOn) return;
  const x = (e.clientX / window.innerWidth  * 100).toFixed(1);
  const y = (e.clientY / window.innerHeight * 100).toFixed(1);
  const txt = `x: ${x}, y: ${y}`;
  debugCoords.textContent = txt;
  console.log(txt);
  navigator.clipboard?.writeText(txt);
});
