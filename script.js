const vid       = document.getElementById('main-video');
const seqCanvas = document.getElementById('seq-canvas');
const ctx       = seqCanvas.getContext('2d');
const poiLayer  = document.getElementById('poi-layer');
const tlEl      = document.getElementById('timeline');

let currentScene = 'aereo';
let busy         = false;
const cache      = new Map(); // sequenceId → Image[]

const ICON_SOFA = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 8h-1V6c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v6h2v2h2v-2h8v2h2v-2h2v-6c0-1.1-.9-2-2-2zM7 6h10v2H7V6zm13 8H4v-4c0-.55.45-1 1-1s1 .45 1 1v2h12v-2c0-.55.45-1 1-1s1 .45 1 1v4z"/>
</svg>`;

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  resizeCanvas();
  vid.src = CONFIG.video;
  vid.play().catch(() => {});
  buildTimeline();
  setActive('aereo');
  renderPOI();

  // Pré-carrega todas as sequências em background
  Object.keys(CONFIG.sequences).forEach(id => preload(id));
});

window.addEventListener('resize', resizeCanvas);

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  seqCanvas.width  = window.innerWidth  * dpr;
  seqCanvas.height = window.innerHeight * dpr;
  seqCanvas.style.width  = window.innerWidth  + 'px';
  seqCanvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ─── Navegação ────────────────────────────────────────────────────────────────

async function navigateTo(targetId) {
  if (busy || targetId === currentScene) return;

  const seqId = CONFIG.transitions[currentScene]?.[targetId];
  if (!seqId) return; // sem sequência definida, não faz nada

  busy = true;
  hidePOI();

  try {
    const frames = await preload(seqId);
    await playSequence(frames, CONFIG.sequences[seqId].fps);
    currentScene = targetId;
    setActive(targetId);
  } finally {
    busy = false;
  }
}

// ─── Sequência de imagens ─────────────────────────────────────────────────────

function preload(seqId) {
  if (cache.has(seqId)) return cache.get(seqId);

  const seq     = CONFIG.sequences[seqId];
  const total   = seq.to - seq.from + 1;
  const frames  = new Array(total);

  const promise = new Promise((resolve, reject) => {
    let loaded = 0;
    for (let i = seq.from; i <= seq.to; i++) {
      const idx = i - seq.from;
      const num = String(i).padStart(seq.pad, '0');
      const img = new Image();
      img.src   = `${seq.folder}${seq.prefix}${num}.${seq.ext}`;
      img.onload  = () => { frames[idx] = img; if (++loaded === total) resolve(frames); };
      img.onerror = () => reject(new Error(`Falha: ${img.src}`));
    }
  });

  cache.set(seqId, promise);
  return promise;
}

function playSequence(frames, fps) {
  return new Promise(resolve => {
    seqCanvas.classList.add('active');
    const interval = 1000 / fps;
    let index    = 0;
    let lastTime = performance.now();

    function loop(now) {
      if (now - lastTime >= interval) {
        drawCover(frames[index]);
        lastTime = now;
        if (++index >= frames.length) { resolve(); return; }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
}

function drawCover(img) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = cw / ch;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = ch; dw = dh * ir; dx = (cw - dw) / 2; dy = 0; }
  else         { dw = cw; dh = dw / ir; dx = 0; dy = (ch - dh) / 2; }
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ─── POI ──────────────────────────────────────────────────────────────────────

function renderPOI() {
  poiLayer.innerHTML = '';
  const btn = document.createElement('button');
  btn.className  = 'poi';
  btn.style.left = CONFIG.poi.x + '%';
  btn.style.top  = CONFIG.poi.y + '%';
  btn.setAttribute('aria-label', CONFIG.poi.label);
  btn.innerHTML = `
    <span class="poi-dot">${ICON_SOFA}</span>
    <span class="poi-label">${CONFIG.poi.label}</span>
  `;
  btn.addEventListener('click', () => navigateTo(CONFIG.poi.target));
  poiLayer.appendChild(btn);
}

function hidePOI() {
  poiLayer.classList.add('out');
  setTimeout(() => { poiLayer.innerHTML = ''; poiLayer.classList.remove('out'); }, 300);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function buildTimeline() {
  CONFIG.timeline.forEach(item => {
    const btn = document.createElement('button');
    btn.className  = 'tl-dot';
    btn.dataset.id = item.id;
    btn.setAttribute('aria-label', item.label);
    btn.innerHTML  = `<span class="tl-pip"></span><span class="tl-label">${item.label}</span>`;
    btn.addEventListener('click', () => navigateTo(item.id));
    tlEl.appendChild(btn);
  });
}

function setActive(id) {
  tlEl.querySelectorAll('.tl-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });
}
