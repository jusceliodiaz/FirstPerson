const mainVideo   = document.getElementById('main-video');
const seqCanvas   = document.getElementById('seq-canvas');
const poiLayer    = document.getElementById('poi-layer');
const trackEl     = document.getElementById('track');
const loaderEl    = document.getElementById('loader');
const debugHud    = document.getElementById('debug-hud');
const debugCoords = document.getElementById('debug-coords');

// alpha:false = compositing mais barato
const ctx = seqCanvas.getContext('2d', { alpha: false });

const MOBILE = window.matchMedia('(hover: none)').matches || window.innerWidth < 768;

const MAX_SEQ = 3;  // LRU: máximo de sequências em memória
let _w = innerWidth, _h = innerHeight, lastFrame = null;

const LEAD = {
  whatsapp: "5541987831394",
  empreendimento: "Factory Interactive — Demo",
  endpoint: "/api/leads",
};

const TOUR_ROUTE = ["aereo", "pool", "living", "kitchen", "jardim"];

let mode         = "dia";
let currentScene = 'aereo';
let busy         = false;
let navGen       = 0;
let poiTimer     = null;
let tourTimer    = null;
let touring      = false;
const cache      = new Map();
const videoBlobs = new Map();

// ─── Analytics ───────────────────────────────────────────────────────────────

function sessionId() {
  let s = sessionStorage.getItem('sid');
  if (!s) { s = crypto.randomUUID(); sessionStorage.setItem('sid', s); }
  return s;
}

function track(event, props = {}) {
  const payload = {
    event, ...props,
    slug: CONFIG?.slug,
    ts: Date.now(),
    session: sessionId(),
    device: MOBILE ? 'mobile' : 'desktop',
  };
  if (window.gtag) gtag('event', event, props);
  navigator.sendBeacon?.('/api/track', JSON.stringify(payload));
}

let dwellStart = Date.now();
let dwellScene = 'aereo';

function markDwell(newScene) {
  track('dwell', { scene: dwellScene, ms: Date.now() - dwellStart });
  dwellScene = newScene;
  dwellStart = Date.now();
}

window.addEventListener('pagehide', () => markDwell(dwellScene));

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  resizeCanvas();
  if (!MOBILE) initCursor();
  buildTrack();
  showPoster('images/seq_arch/aereo_to_piscina_00.jpg', () => startScene(sceneFromHash()));
  preloadNeighbors('aereo');
  (window.requestIdleCallback || setTimeout)(() => preloadAllVideos(), 2500);
  initCTA();
});

// resize inteligente: ignora variações de altura da barra de endereço mobile
window.addEventListener('resize', () => {
  if (innerWidth === _w && Math.abs(innerHeight - _h) < 120) return;
  _w = innerWidth; _h = innerHeight;
  resizeCanvas();
  if (lastFrame) drawCover(lastFrame);
});

function resizeCanvas() {
  const dpr = MOBILE ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  seqCanvas.width        = innerWidth  * dpr;
  seqCanvas.height       = innerHeight * dpr;
  seqCanvas.style.width  = innerWidth  + 'px';
  seqCanvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Deep link ────────────────────────────────────────────────────────────────

function sceneFromHash() {
  const id = new URLSearchParams(location.hash.slice(1)).get('cena');
  return CONFIG.scenes[id] ? id : 'aereo';
}

function syncHash(sceneId) {
  history.replaceState(null, '', `#cena=${sceneId}`);
}

// ─── Video source ─────────────────────────────────────────────────────────────

function videoSrc(scene) {
  let v = scene.video;
  if (v && (v.dia || v.noite)) v = v[mode] || v.dia;
  if (!v) return null;
  if (typeof v === 'string') return v;
  const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  return (MOBILE || safari) ? (v.mp4 || v.webm) : (v.webm || v.mp4);
}

// ─── Video Preload ────────────────────────────────────────────────────────────

const loadOne = (src) => {
  if (!src || videoBlobs.has(src)) return Promise.resolve();
  return fetch(src)
    .then(r => r.blob())
    .then(blob => { videoBlobs.set(src, URL.createObjectURL(blob)); })
    .catch(() => {});
};

function preloadNeighbors(sceneId) {
  const want = new Set([videoSrc(CONFIG.scenes[sceneId])]);
  Object.keys(CONFIG.transitions[sceneId] || {})
    .forEach(d => want.add(videoSrc(CONFIG.scenes[d])));
  [...want].filter(Boolean).forEach(loadOne);
}

function preloadAllVideos() {
  const srcs = [...new Set(
    Object.values(CONFIG.scenes).map(s => videoSrc(s)).filter(Boolean)
  )];
  const firstSrc = videoSrc(CONFIG.scenes['aereo']);
  const rest = srcs.filter(s => s !== firstSrc);
  const chain = firstSrc ? loadOne(firstSrc) : Promise.resolve();
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

  markDwell(sceneId);
  currentScene = sceneId;
  setActive(sceneId);
  syncHash(sceneId);
  renderPOIs(scene.pois);

  preloadNeighbors(sceneId);
  const transitions = CONFIG.transitions[sceneId] || {};
  Object.values(transitions).forEach(id => preload(id));

  const src = videoSrc(scene);
  if (!src) { seqCanvas.classList.remove('active'); return; }

  const gen = navGen;
  mainVideo.src  = videoBlobs.get(src) || src;
  mainVideo.loop = true;
  mainVideo.load();

  const onReady = () => {
    if (gen !== navGen) return;
    let faded = false;
    const doFade = () => {
      if (faded || gen !== navGen) return;
      faded = true;
      fadeCanvas();
    };
    mainVideo.addEventListener('playing',    doFade, { once: true });
    mainVideo.addEventListener('timeupdate', doFade, { once: true });
    mainVideo.play().catch(doFade);
    setTimeout(doFade, 500);
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

    // passa fps correto; no mobile metade dos frames → mesma duração
    const seq = CONFIG.sequences[seqId];
    const fps = (seq.fps || 30) / (MOBILE ? 2 : 1);
    await playSequence(frames, seq.reverse === true, gen, fps);

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

// ─── Pré-carregamento (LRU + img.decode) ─────────────────────────────────────

function rememberSeq(seqId, promise) {
  cache.set(seqId, promise);
  if (cache.size > MAX_SEQ) {
    const oldest = cache.keys().next().value;
    if (oldest !== seqId) cache.delete(oldest);
  }
}

function preload(seqId) {
  if (cache.has(seqId)) return cache.get(seqId);

  const seqBase = CONFIG.sequences[seqId];
  const seq = MOBILE
    ? { ...seqBase, folder: seqBase.folder.replace('images/seq_arch/', 'images/seq_arch_m/') }
    : seqBase;
  const step    = MOBILE ? 2 : 1;
  const indices = [];
  for (let i = seq.from; i <= seq.to; i += step) indices.push(i);

  const frames  = new Array(indices.length);
  let loaded    = 0;
  let failed    = false;
  const SLOTS   = MOBILE ? 4 : indices.length;
  let nextLoad  = 0;

  const promise = new Promise((resolve, reject) => {
    const loadNext = () => {
      if (nextLoad >= indices.length) return;
      const slot = nextLoad++;
      const num  = String(indices[slot]).padStart(seq.pad, '0');
      const img  = new Image();
      img.src = `${seq.folder}${seq.prefix}${num}.${seq.ext}`;

      img.onload = () => {
        // pré-decodifica: elimina stutter no primeiro drawImage
        const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
        ready.then(() => {
          frames[slot] = img;
          loadNext();
          if (++loaded === indices.length) resolve(frames);
        });
      };
      img.onerror = () => {
        if (!failed) { failed = true; cache.delete(seqId); reject(new Error(`Falha: ${img.src}`)); }
      };
    };
    for (let k = 0; k < Math.min(SLOTS, indices.length); k++) loadNext();
  });

  rememberSeq(seqId, promise);
  return promise;
}

// ─── Playback (throttle por tempo real, corrige ProMotion 120Hz) ──────────────

function playSequence(frames, reverse = false, gen, fps = 30) {
  return new Promise(resolve => {
    seqCanvas.classList.add('active');
    let index = reverse ? frames.length - 1 : 0;
    let last  = 0;
    const step = 1000 / fps;

    function loop(now) {
      if (gen !== navGen) return resolve();
      if (now - last >= step) {
        last = now;
        if (frames[index]) drawCover(frames[index]);
        index += reverse ? -1 : 1;
        if (reverse ? index < 0 : index >= frames.length) return resolve();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
}

function drawCover(img) {
  const cw    = innerWidth;
  const ch    = innerHeight;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw    = Math.round(img.naturalWidth  * scale);
  const dh    = Math.round(img.naturalHeight * scale);
  const dx    = Math.round((cw - dw) / 2);
  const dy    = Math.round((ch - dh) / 2);
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
  lastFrame = img;
}

// ─── POIs ────────────────────────────────────────────────────────────────────

function renderPOIs(pois = []) {
  poiLayer.innerHTML = '';
  pois.forEach((poi, i) => {
    const el = document.createElement('div');
    el.className = 'poi' + (poi.type === 'info' ? ' poi--info' : '');
    el.style.left = poi.x + '%';
    el.style.top  = poi.y + '%';
    el.style.animationDelay = (i * 80) + 'ms';
    el.innerHTML = `<div class="poi-btn"><span class="poi-pulse"></span></div>
                    <div class="poi-name">${poi.label}</div>`;

    const act = () => {
      if (poi.type === 'nav' && poi.target) {
        track('poi_nav', { from: currentScene, to: poi.target });
        navigateTo(poi.target);
      } else if (poi.type === 'info' && poi.info) {
        track('poi_info', { scene: currentScene, label: poi.label });
        openInfo(poi.info);
      } else if (poi.target) {
        navigateTo(poi.target);
      }
    };

    el.addEventListener('click', act);
    el.addEventListener('touchstart', e => { e.preventDefault(); act(); }, { passive: false });
    poiLayer.appendChild(el);
  });
}

function hidePOIs() {
  clearTimeout(poiTimer);
  poiLayer.classList.add('out');
  poiTimer = setTimeout(() => { poiLayer.innerHTML = ''; poiLayer.classList.remove('out'); }, 300);
}

function openInfo(info) {
  let panel = document.getElementById('info-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'info-panel';
    document.body.appendChild(panel);
    panel.addEventListener('click', e => {
      if (e.target === panel || e.target.dataset.close) panel.classList.remove('open');
    });
  }
  panel.innerHTML = `
    <div id="info-card">
      <button data-close aria-label="Fechar">&times;</button>
      ${info.imagem ? `<img src="${info.imagem}" alt="">` : ''}
      <h3>${info.titulo}</h3>
      ${info.area ? `<span class="info-area">${info.area}</span>` : ''}
      <ul>${(info.itens || []).map(t => `<li>${t}</li>`).join('')}</ul>
    </div>`;
  requestAnimationFrame(() => panel.classList.add('open'));
}

// ─── Track (dock simples, sem ExpandableTabs) ─────────────────────────────────

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
  const item = CONFIG.timeline.find(t => t.id === id);
  const tag  = document.getElementById('scene-tag');
  if (!item || !tag) return;
  tag.textContent = item.label;
  tag.classList.add('show');
}

// ─── Tour autoguiado ──────────────────────────────────────────────────────────

function startTour() {
  touring = true;
  document.body.classList.add('touring');
  track('tour_start', {});
  let i = TOUR_ROUTE.indexOf(currentScene);
  const next = () => {
    if (!touring) return;
    i = (i + 1) % TOUR_ROUTE.length;
    navigateTo(TOUR_ROUTE[i]);
    tourTimer = setTimeout(next, 6000);
  };
  tourTimer = setTimeout(next, 6000);
  const btn = document.getElementById('cta-tour');
  if (btn) { btn.innerHTML = '■ <span>Parar</span>'; btn.onclick = stopTour; }
}

function stopTour() {
  touring = false;
  clearTimeout(tourTimer);
  document.body.classList.remove('touring');
  const btn = document.getElementById('cta-tour');
  if (btn) { btn.innerHTML = '▶ <span>Tour</span>'; btn.onclick = startTour; }
}

['pointerdown', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => { if (touring) stopTour(); }, { passive: true })
);

// ─── CTA + Lead modal ─────────────────────────────────────────────────────────

function initCTA() {
  const wa = document.getElementById('cta-whats');
  if (wa) {
    wa.href = `https://wa.me/${LEAD.whatsapp}?text=` +
      encodeURIComponent(`Olá! Vi a maquete do ${LEAD.empreendimento} e quero saber mais.`);
    wa.addEventListener('click', () => track('cta_whatsapp', { scene: currentScene }));
  }

  const modal = document.getElementById('lead-modal');
  if (!modal) return;

  const open  = () => { modal.hidden = false; track('lead_open', { scene: currentScene }); };
  const close = () => { modal.hidden = true; };

  const visitBtn = document.getElementById('cta-visit');
  if (visitBtn) visitBtn.addEventListener('click', open);

  const closeBtn = document.getElementById('lead-close');
  if (closeBtn) closeBtn.addEventListener('click', close);

  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  const form = document.getElementById('lead-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      data.empreendimento = LEAD.empreendimento;
      data.cena = currentScene;
      try {
        await fetch(LEAD.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } catch (_) {}
      track('lead_submit', data);
      e.target.hidden = true;
      const ok = document.getElementById('lead-ok');
      if (ok) ok.hidden = false;
    });
  }
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
  const x   = (e.clientX / innerWidth  * 100).toFixed(1);
  const y   = (e.clientY / innerHeight * 100).toFixed(1);
  const txt = `x: ${x}, y: ${y}`;
  debugCoords.textContent = txt;
  console.log(txt);
  navigator.clipboard?.writeText(txt);
});
