const mainVideo   = document.getElementById('main-video');
const seqCanvas   = document.getElementById('seq-canvas');
const poiLayer    = document.getElementById('poi-layer');
const trackEl     = document.getElementById('track');
const loaderEl    = document.getElementById('loader');
const debugHud    = document.getElementById('debug-hud');
const debugCoords = document.getElementById('debug-coords');
const ctx         = seqCanvas.getContext('2d');

// Mobile: hover:none cobre iOS, Android e touch-only devices
const MOBILE = window.matchMedia('(hover: none)').matches || window.innerWidth < 768;

let currentScene = 'aereo';
let busy         = false;
let navGen       = 0;
let poiTimer     = null;
const cache      = new Map();
const videoBlobs = new Map();

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  resizeCanvas();
  if (!MOBILE) initCursor();
  buildTrack();
  showPoster(CONFIG.poster || 'images/seq_arch/aereo_to_piscina_00.jpg', () => startScene('aereo'));
  preloadAllVideos();
});

window.addEventListener('resize', resizeCanvas);

function resizeCanvas() {
  // Mobile: DPR 1 — canvas mais leve, sem diferença visual perceptível em tela pequena
  const dpr = MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  seqCanvas.width        = window.innerWidth  * dpr;
  seqCanvas.height       = window.innerHeight * dpr;
  seqCanvas.style.width  = window.innerWidth  + 'px';
  seqCanvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Video Preload ────────────────────────────────────────────────────────────

function preloadAllVideos() {
  const videos = [...new Set(
    Object.values(CONFIG.scenes)
      .map(s => s.video)
      .filter(Boolean)
  )];

  // Primeiro vídeo (cena inicial) tem prioridade — os demais carregam em sequência
  const loadOne = (src) =>
    fetch(src)
      .then(r => r.blob())
      .then(blob => { videoBlobs.set(src, URL.createObjectURL(blob)); })
      .catch(() => {});

  // Carrega o aereo primeiro, depois o restante em paralelo
  const first = CONFIG.scenes['aereo']?.video;
  const rest  = videos.filter(v => v !== first);

  const chain = first ? loadOne(first) : Promise.resolve();
  chain.then(() => Promise.all(rest.map(loadOne)));
}

// ─── Poster ───────────────────────────────────────────────────────────────────

function showPoster(src, cb) {
  seqCanvas.classList.add('active');
  const img = new Image();
  img.onload  = () => { drawCover(img); cb?.(); };
  img.onerror = () => cb?.();
  img.src = src;
}

// ─── Cena ─────────────────────────────────────────────────────────────────────

function startScene(sceneId) {
  const scene = CONFIG.scenes[sceneId];
  if (!scene) return;
  currentScene = sceneId;
  setActive(sceneId);
  renderPOIs(scene.pois);

  // Pré-carrega só as sequências desta cena em background
  const transitions = CONFIG.transitions[sceneId] || {};
  Object.values(transitions).forEach(id => preload(id));

  if (!scene.video) {
    seqCanvas.classList.remove('active');
    return;
  }

  // Captura a geração atual — callbacks disparados por cenas anteriores são ignorados
  const gen = navGen;

  mainVideo.src  = videoBlobs.get(scene.video) || scene.video;
  mainVideo.loop = true;
  mainVideo.load();

  const onReady = () => {
    if (gen !== navGen) return;
    mainVideo.play().catch(() => {});
    fadeCanvas();
  };

  if (mainVideo.readyState >= 3) {
    onReady();
  } else {
    const evt = MOBILE ? 'loadeddata' : 'canplay';
    mainVideo.addEventListener(evt, onReady, { once: true });
    setTimeout(onReady, MOBILE ? 3000 : 5000);
  }
}

function fadeCanvas() {
  seqCanvas.style.transition = 'opacity 300ms ease';
  seqCanvas.style.opacity    = '0';
  setTimeout(() => {
    seqCanvas.classList.remove('active');
    seqCanvas.style.opacity    = '';
    seqCanvas.style.transition = '';
  }, 300);
}

// ─── Navegação ────────────────────────────────────────────────────────────────

async function navigateTo(targetId) {
  if (busy || targetId === currentScene) return;

  const seqId = CONFIG.transitions?.[currentScene]?.[targetId];
  if (!seqId) return;

  busy = true;
  const gen = ++navGen;
  hidePOIs();

  try {
    const frames = await loadWithLoader(seqId);
    if (gen !== navGen) return;
    await playSequence(frames, CONFIG.sequences[seqId].reverse === true, gen);
    if (gen !== navGen) return;
    startScene(targetId);
  } catch (err) {
    if (gen === navGen) {
      console.error('Erro na sequência:', err);
      seqCanvas.classList.remove('active');
    }
  } finally {
    if (gen === navGen) {
      setTimeout(() => { if (gen === navGen) busy = false; }, 350);
    }
  }
}

function loadWithLoader(seqId) {
  const p     = preload(seqId);
  const timer = setTimeout(() => loaderEl.classList.add('visible'), 400);
  return p.finally(() => { clearTimeout(timer); loaderEl.classList.remove('visible'); });
}

// ─── Pré-carregamento ─────────────────────────────────────────────────────────

function preload(seqId) {
  if (cache.has(seqId)) return cache.get(seqId);

  const seqBase = CONFIG.sequences[seqId];
  // Mobile: usa pasta seq_arch_m com imagens 50% menores e quality 35
  const seq = MOBILE
    ? { ...seqBase, folder: seqBase.folder.replace('images/seq_arch/', 'images/seq_arch_m/') }
    : seqBase;
  const step  = MOBILE ? 2 : 1;
  const total = seq.to - seq.from + 1;
  const indices = [];
  for (let i = seq.from; i <= seq.to; i += step) indices.push(i);

  const frames = new Array(indices.length);
  let loaded   = 0;
  let failed   = false;

  // Mobile: 4 downloads paralelos para não travar a rede; desktop: tudo de uma vez
  const SLOTS   = MOBILE ? 4 : indices.length;
  let nextLoad  = 0;

  const promise = new Promise((resolve, reject) => {
    const loadNext = () => {
      if (nextLoad >= indices.length) return;
      const slot = nextLoad++;
      const num  = String(indices[slot]).padStart(seq.pad, '0');
      const img  = new Image();
      img.src     = `${seq.folder}${seq.prefix}${num}.${seq.ext}`;
      img.onload  = () => {
        frames[slot] = img;
        loadNext();
        if (++loaded === indices.length) resolve(frames);
      };
      img.onerror = () => {
        if (!failed) { failed = true; cache.delete(seqId); reject(new Error(`Falha: ${img.src}`)); }
      };
    };
    for (let k = 0; k < Math.min(SLOTS, indices.length); k++) loadNext();
  });

  cache.set(seqId, promise);
  return promise;
}

// ─── Playback ─────────────────────────────────────────────────────────────────

function playSequence(frames, reverse = false, gen) {
  return new Promise(resolve => {
    seqCanvas.classList.add('active');
    let index = reverse ? frames.length - 1 : 0;

    function loop() {
      if (gen !== navGen) { resolve(); return; }
      if (frames[index]) drawCover(frames[index]);
      index += reverse ? -1 : 1;
      const done = reverse ? index < 0 : index >= frames.length;
      if (done) { resolve(); return; }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
}

function drawCover(img) {
  const cw    = window.innerWidth;
  const ch    = window.innerHeight;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw    = Math.round(img.naturalWidth  * scale);
  const dh    = Math.round(img.naturalHeight * scale);
  const dx    = Math.round((cw - dw) / 2);
  const dy    = Math.round((ch - dh) / 2);
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
    el.innerHTML  = `<div class="poi-btn"><span class="poi-pulse"></span></div><div class="poi-name">${poi.label}</div>`;
    if (poi.target) {
      el.addEventListener('click',      () => navigateTo(poi.target));
      el.addEventListener('touchstart', e  => { e.preventDefault(); navigateTo(poi.target); }, { passive: false });
    }
    poiLayer.appendChild(el);
  });
}

function hidePOIs() {
  clearTimeout(poiTimer);
  poiLayer.classList.add('out');
  poiTimer = setTimeout(() => { poiLayer.innerHTML = ''; poiLayer.classList.remove('out'); }, 300);
}

// ─── Track ────────────────────────────────────────────────────────────────────

function buildTrack() {
  const wrap = document.createElement('div');
  wrap.id = 'track-pts';
  CONFIG.timeline.forEach(item => {
    const btn = document.createElement('button');
    btn.className  = 't-pt';
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', item.label);
    btn.setAttribute('data-label', item.label);
    btn.innerHTML  = item.icon || item.label;
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

  const item    = CONFIG.timeline.find(t => t.id === id);
  const tag     = document.getElementById('scene-tag');
  if (!item || !tag) return;
  tag.textContent = item.label;
  tag.classList.add('show');
}

// ─── Cursor (desktop only) ────────────────────────────────────────────────────

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
  const x   = (e.clientX / window.innerWidth  * 100).toFixed(1);
  const y   = (e.clientY / window.innerHeight * 100).toFixed(1);
  const txt = `x: ${x}, y: ${y}`;
  debugCoords.textContent = txt;
  console.log(txt);
  navigator.clipboard?.writeText(txt);
});
