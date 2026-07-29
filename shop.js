/* ══════════════════════════════════════════════════════
   SHOP — IKEA Italia furniture shop
   Tabs (Kitchen / Living) → product cards → 3D viewer
   → cart + order summary → AI "place in my scene".
   Depends on: script-fp.js (aiKey, captureSceneFrame)
   and shop3d.js (window.Shop3D — Three.js modal viewer).
   ══════════════════════════════════════════════════════ */

const SHOP_PRODUCTS = [
  {
    id: "vadholma",
    cat: "kitchen",
    name: "VADHOLMA",
    variant: "Kitchen island with rack, black/oak",
    size: "126×79×193 cm",
    price: 729,
    img: "https://www.ikea.com/it/it/images/products/vadholma-isola-cucina-con-rastrelliera-nero-rovere__0605057_pe681596_s5.jpg",
    url: "https://www.ikea.com/it/it/p/vadholma-isola-cucina-con-rastrelliera-nero-rovere-s59276228/",
    model: "assets/models/vadholma.glb",
    desc: "Spacious kitchen island with a butcher's-block style oak top and a steel utensil rack with 10 hooks."
  },
  {
    id: "sunnersta",
    cat: "kitchen",
    name: "SUNNERSTA",
    variant: "Mini-kitchen, white",
    size: "112×56×139 cm",
    price: 139,
    img: "https://www.ikea.com/it/it/images/products/sunnersta-minicucina__0460744_pe607032_s5.jpg",
    url: "https://www.ikea.com/it/it/p/sunnersta-minicucina-s69139684/",
    model: "assets/models/sunnersta.glb",
    desc: "Functional white metal mini-kitchen with a stainless steel sink and tap — easy to assemble and move."
  },
  {
    id: "raskog",
    cat: "kitchen",
    name: "RÅSKOG",
    variant: "Trolley, black",
    size: "35×45×77 cm",
    price: 39.95,
    img: "https://www.ikea.com/it/it/images/products/raskog-carrello-nero__1365460_pe956339_s5.jpg",
    url: "https://www.ikea.com/it/it/p/raskog-carrello-nero-40582181/",
    model: "assets/models/raskog.glb",
    desc: "Three-tier black steel kitchen trolley on lockable castors, perfect for small spaces."
  },
  {
    id: "kivik",
    cat: "living",
    name: "KIVIK",
    variant: "3-seat sofa, Tresund light beige",
    size: "228×95×83 cm",
    price: 599,
    img: "https://www.ikea.com/it/it/images/products/kivik-divano-a-3-posti-tresund-beige-chiaro__1577609_pe1033360_s5.jpg",
    url: "https://www.ikea.com/it/it/p/kivik-divano-a-3-posti-tresund-beige-chiaro-s89482830/",
    model: "assets/models/kivik.glb",
    desc: "Wide and soft 3-seat sofa with low armrests, pocket springs and a light beige washable cover."
  },
  {
    id: "ektorp",
    cat: "living",
    name: "EKTORP",
    variant: "3-seat sofa, Hakebo dark grey",
    size: "218×88×88 cm",
    price: 399,
    img: "https://www.ikea.com/it/it/images/products/ektorp-divano-a-3-posti-hakebo-grigio-scuro__1194847_pe902097_s5.jpg",
    url: "https://www.ikea.com/it/it/p/ektorp-divano-a-3-posti-hakebo-grigio-scuro-s39508998/",
    model: "assets/models/ektorp.glb",
    desc: "Timeless 3-seat sofa with thick cushions, rolled armrests and a dark grey removable cover."
  },
  {
    id: "klippan",
    cat: "living",
    name: "KLIPPAN",
    variant: "2-seat sofa, Vissle grey",
    size: "180×88×66 cm",
    price: 299,
    img: "https://www.ikea.com/it/it/images/products/klippan-divano-a-2-posti-vissle-grigio__0239990_pe379591_s5.jpg",
    url: "https://www.ikea.com/it/it/p/klippan-divano-a-2-posti-vissle-grigio-s79010614/",
    model: "assets/models/klippan.glb",
    desc: "Compact 2-seat sofa with clean squared lines, metal legs and a grey washable cover."
  }
];

/* Public sample models used until real GLB/FBX files are dropped
   into assets/models/ — first URL that loads wins. */
const SHOP_FALLBACK_MODELS = [
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb",
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb"
];

const shopState = {
  open: false,
  tab: "kitchen",
  cart: new Set(JSON.parse(localStorage.getItem("archviz-shop-cart") || "[]")),
  preloaded: false,
  captureB64: null,
  resultB64: null,
  confirmed: false,
  placeId: null,
  videoUrl: null
};

function shopProduct(id) { return SHOP_PRODUCTS.find(p => p.id === id); }
function shopCartItems() { return SHOP_PRODUCTS.filter(p => shopState.cart.has(p.id)); }
function shopTotal() { return shopCartItems().reduce((s, p) => s + p.price, 0); }
function shopFmt(n) {
  const dec = n % 1 === 0 ? 0 : 2;
  return "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: 2 });
}
function shopSaveCart() {
  localStorage.setItem("archviz-shop-cart", JSON.stringify([...shopState.cart]));
}

/* ── Panel open / close ── */
function shopToggle() {
  shopState.open = !shopState.open;
  document.getElementById("shop-panel").classList.toggle("open", shopState.open);
  document.getElementById("shop-btn").classList.toggle("active", shopState.open);
  if (shopState.open) {
    shopRenderGrid();
    shopPreloadModels();
  }
}

function shopSwitchTab(cat) {
  shopState.tab = cat;
  document.querySelectorAll(".shop-tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === cat));
  shopRenderGrid();
}

/* ── Cards ── */
function shopRenderGrid() {
  const grid = document.getElementById("shop-grid");
  const items = SHOP_PRODUCTS.filter(p => p.cat === shopState.tab);
  grid.innerHTML = items.map(p => {
    const inCart = shopState.cart.has(p.id);
    return `
    <div class="shop-card${inCart ? " selected" : ""}" data-id="${p.id}" onclick="shopToggleItem('${p.id}')">
      <div class="shop-card-imgwrap">
        <img src="${p.img}" alt="${p.name} — ${p.variant}" loading="lazy" />
        <button class="shop-ai-btn" title="Place in your scene with AI" onclick="event.stopPropagation();shopPlaceOpen('${p.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7L12 4z"/>
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>
          </svg>
          <span>AI</span>
        </button>
        <button class="shop-3d-btn" title="View in 3D" onclick="event.stopPropagation();shop3dOpen('${p.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z"/>
            <path d="M12 22V12M12 12L3.5 7M12 12l8.5-5"/>
          </svg>
          <span>3D</span>
        </button>
        ${inCart ? '<div class="shop-card-check">✓</div>' : ""}
      </div>
      <div class="shop-card-body">
        <div class="shop-card-name">${p.name}</div>
        <div class="shop-card-variant">${p.variant}</div>
        <div class="shop-card-size">${p.size}</div>
        <div class="shop-card-footer">
          <div class="shop-card-price">${shopFmt(p.price)}</div>
          <div class="shop-card-actions">
            <a class="shop-buy-link" href="${p.url}" target="_blank" rel="noopener" title="Buy at IKEA Italia" onclick="event.stopPropagation()">
              IKEA <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </a>
            <button class="shop-add-btn${inCart ? " added" : ""}" onclick="event.stopPropagation();shopToggleItem('${p.id}')">
              ${inCart ? "Added ✓" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("");
}

function shopToggleItem(id) {
  if (shopState.cart.has(id)) shopState.cart.delete(id);
  else shopState.cart.add(id);
  shopState.confirmed = false;
  shopSaveCart();
  shopRenderGrid();
  shopUpdateTotals();
  const orderOpen = document.getElementById("shop-order-modal").classList.contains("open");
  if (orderOpen) shopRenderOrder();
}

/* ── Always-visible total pill + badge ── */
function shopUpdateTotals() {
  const total = shopTotal();
  const count = shopState.cart.size;
  const pill = document.getElementById("shop-total-pill");
  pill.classList.toggle("show", count > 0);
  pill.innerHTML = `<span class="shop-pill-lbl">Total</span><span class="shop-pill-val">${shopFmt(total)}</span>`;
  pill.onclick = shopOpenOrder;
  const badge = document.getElementById("shop-btn-badge");
  badge.textContent = count;
  badge.classList.toggle("show", count > 0);
  const foot = document.getElementById("shop-panel-total");
  if (foot) foot.textContent = shopFmt(total);
  const orderBtn = document.getElementById("shop-order-btn");
  if (orderBtn) orderBtn.disabled = count === 0;
}

/* ── 3D viewer ── */
function shop3dOpen(id) {
  const p = shopProduct(id);
  if (!p || !window.Shop3D) return;
  window.Shop3D.open(p, SHOP_FALLBACK_MODELS);
}
function shopPreloadModels() {
  if (shopState.preloaded || !window.Shop3D) return;
  shopState.preloaded = true;
  const run = () => SHOP_PRODUCTS.forEach(p => window.Shop3D.preload(p, SHOP_FALLBACK_MODELS));
  window.requestIdleCallback ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 800);
}

/* ── Order summary modal ── */
function shopOpenOrder() {
  shopRenderOrder();
  document.getElementById("shop-order-modal").classList.add("open");
}
function shopCloseOrder() {
  document.getElementById("shop-order-modal").classList.remove("open");
}

function shopRenderOrder() {
  const listEl = document.getElementById("shop-order-list");
  const cats = [["kitchen", "Kitchen"], ["living", "Living"]];
  let html = "";
  cats.forEach(([cat, label]) => {
    const items = shopCartItems().filter(p => p.cat === cat);
    if (!items.length) return;
    const sub = items.reduce((s, p) => s + p.price, 0);
    html += `<div class="shop-order-cat"><span>${label}</span><span>${shopFmt(sub)}</span></div>`;
    items.forEach(p => {
      html += `
      <div class="shop-order-line">
        <img src="${p.img}" alt="" />
        <div class="shop-order-line-info">
          <div class="shop-order-line-name">${p.name}</div>
          <div class="shop-order-line-variant">${p.variant} · ${p.size}</div>
        </div>
        <div class="shop-order-line-price">${shopFmt(p.price)}</div>
        <button class="shop-order-remove" title="Remove" onclick="shopToggleItem('${p.id}')">
          <svg viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
        </button>
      </div>`;
    });
  });
  if (!html) html = `<div class="shop-order-empty">No furniture selected yet — add items from the shop.</div>`;
  listEl.innerHTML = html;
  document.getElementById("shop-order-total").textContent = shopFmt(shopTotal());

  const confirmBtn = document.getElementById("shop-confirm-btn");
  confirmBtn.textContent = shopState.confirmed ? "✓ Order confirmed" : "Confirm order";
  confirmBtn.classList.toggle("confirmed", shopState.confirmed);
  confirmBtn.disabled = shopState.cart.size === 0;
}

function shopConfirmOrder() {
  if (!shopState.cart.size) return;
  shopState.confirmed = true;
  shopRenderOrder();
}

/* ── AI: place a product in the current scene (per-item modal) ── */
function shopAiStatus(msg) { document.getElementById("shop-ai-status").textContent = msg; }

function shopPlaceOpen(id) {
  const p = shopProduct(id);
  if (!p) return;
  if (shopState.placeId !== id) {
    /* New product — clear the previous results */
    shopState.resultB64 = null;
    document.getElementById("shop-ai-result").classList.remove("visible");
    document.getElementById("shop-ai-dl-btn").classList.remove("visible");
    shopAiStatus("");
    shopAiCloseVideo();
    shopAiVideoStatus("");
    const prompt = document.getElementById("shop-ai-prompt");
    prompt.placeholder = p.cat === "living"
      ? `e.g. replace the existing sofa with this ${p.name}, keep everything else the same...`
      : `e.g. add this ${p.name} to the kitchen, replacing the existing counter...`;
  }
  shopState.placeId = id;
  document.getElementById("shop-place-img").src = p.img;
  document.getElementById("shop-place-name").textContent = p.name;
  document.getElementById("shop-place-variant").textContent = p.variant;
  document.getElementById("shop-place-price").textContent = shopFmt(p.price);
  document.getElementById("shop-place-modal").classList.add("open");
}
function shopPlaceClose() {
  document.getElementById("shop-place-modal").classList.remove("open");
}

async function shopOrderCapture() {
  const btn = document.getElementById("shop-ai-capture-btn");
  const thumb = document.getElementById("shop-ai-capture-thumb");
  btn.disabled = true;
  btn.textContent = "⏳ Capturing...";
  /* captureSceneFrame reads the video/canvas directly — UI overlays are never captured */
  const b64 = await captureSceneFrame();
  btn.disabled = false;
  if (!b64) {
    btn.textContent = "📷 Capture scene";
    thumb.innerHTML = '<span style="color:rgba(255,80,80,0.7)">Failed — try again</span>';
    return;
  }
  shopState.captureB64 = b64;
  btn.textContent = "✓ Recapture";
  thumb.innerHTML = `<img src="data:image/jpeg;base64,${b64}" alt="scene capture" />`;
}

const shopImgB64Cache = new Map();
async function shopProductImageB64(p) {
  if (shopImgB64Cache.has(p.id)) return shopImgB64Cache.get(p.id);
  try {
    const resp = await fetch(p.img);
    if (!resp.ok) throw new Error(String(resp.status));
    const blob = await resp.blob();
    const b64 = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1]);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
    const out = { b64, mime: blob.type || "image/jpeg" };
    shopImgB64Cache.set(p.id, out);
    return out;
  } catch (e) {
    shopImgB64Cache.set(p.id, null);
    return null;
  }
}

async function shopAiGenerate() {
  const key = aiKey();
  if (!key) return shopAiStatus("No API key — open the AI panel and paste your key first.");
  const p = shopProduct(shopState.placeId);
  if (!p) return shopAiStatus("Open the AI simulation from a product card first.");

  let scene = shopState.captureB64;
  if (!scene || scene.length < 500) {
    await shopOrderCapture();
    scene = shopState.captureB64;
  }
  if (!scene || scene.length < 500) return shopAiStatus("Could not capture the scene.");

  const btn = document.getElementById("shop-ai-generate-btn");
  btn.disabled = true;
  shopAiStatus("Placing furniture in your scene...");

  try {
    const prodImg = await shopProductImageB64(p);
    const userPrompt = document.getElementById("shop-ai-prompt").value.trim();
    const ref = prodImg
      ? "Insert the furniture product shown in the SECOND image"
      : "Insert the following furniture product";
    const instruction =
      `Edit the FIRST image, a photorealistic architectural interior scene. ${ref} — ` +
      `${p.name} (${p.variant}), approx. size ${p.size}. ${p.desc} ` +
      (userPrompt ? `User instruction: ${userPrompt}. ` : "") +
      `Place it naturally in the scene with correct perspective, scale, lighting, shadows and reflections. ` +
      `Keep the exact same camera angle, framing and photorealistic style of the original scene. ` +
      `Return ONLY the edited image.`;

    const parts = [{ text: instruction }, { inlineData: { mimeType: "image/jpeg", data: scene } }];
    if (prodImg) parts.push({ inlineData: { mimeType: prodImg.mime, data: prodImg.b64 } });

    const models = ["gemini-3.1-flash-image", "gemini-3-pro-image"];
    const errs = [];
    let imgB64 = null;
    for (const model of models) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "16:9" } }
            })
          });
        const d = await resp.json();
        if (!resp.ok) { errs.push(`[${model}] ${d?.error?.message || resp.status}`); continue; }
        const found = (d?.candidates?.[0]?.content?.parts || []).find(pt => pt.inlineData?.data);
        if (found) { imgB64 = found.inlineData.data; break; }
        errs.push(`[${model}] response had no image`);
      } catch (err) { errs.push(`[${model}] ${err.message}`); }
    }
    if (!imgB64) throw new Error(errs.join("\n") || "No image returned.");

    shopState.resultB64 = imgB64;
    document.getElementById("shop-ai-result-img").src = "data:image/png;base64," + imgB64;
    document.getElementById("shop-ai-result").classList.add("visible");
    document.getElementById("shop-ai-dl-btn").classList.add("visible");
    shopAiStatus("Done! " + p.name + " placed in your scene.");
  } catch (e) {
    console.error(e);
    shopAiStatus("Error: " + e.message);
  }
  btn.disabled = false;
}

function shopAiDownload() {
  if (!shopState.resultB64) return;
  const a = document.createElement("a");
  a.href = "data:image/png;base64," + shopState.resultB64;
  a.download = "scene-with-furniture.png";
  a.click();
}

function shopAiOpenResult() {
  const src = document.getElementById("shop-ai-result-img").src;
  if (!src) return;
  document.getElementById("ai-lightbox-img").src = src;
  document.getElementById("ai-lightbox").classList.add("open");
}

/* ── AI video: animate the scene with the placed furniture (Veo) ── */
function shopAiVideoStatus(msg) { document.getElementById("shop-ai-video-status").textContent = msg; }

function shopAiCloseVideo() {
  const vid = document.getElementById("shop-ai-video");
  vid.pause();
  vid.removeAttribute("src");
  vid.load();
  if (shopState.videoUrl) { URL.revokeObjectURL(shopState.videoUrl); shopState.videoUrl = null; }
  document.getElementById("shop-ai-video-result").classList.remove("visible");
  document.getElementById("shop-ai-video-dl-btn").classList.remove("visible");
}

async function shopAiGenerateVideo() {
  const key = aiKey();
  if (!key) return shopAiVideoStatus("No API key — open the AI panel and paste your key first.");
  const p = shopProduct(shopState.placeId);
  if (!p) return shopAiVideoStatus("Open the AI simulation from a product card first.");

  /* Best source: the generated image with the furniture placed.
     Fallback: the raw scene capture. */
  let frameB64 = shopState.resultB64, frameMime = "image/png";
  if (!frameB64) {
    if (!shopState.captureB64 || shopState.captureB64.length < 500) await shopOrderCapture();
    frameB64 = shopState.captureB64;
    frameMime = "image/jpeg";
  }
  if (!frameB64) return shopAiVideoStatus("Generate the image or capture the scene first.");

  const userPrompt = document.getElementById("shop-ai-prompt").value.trim();
  const prompt =
    `Cinematic slow camera push-in through this photorealistic architectural interior scene ` +
    `featuring the ${p.name} (${p.variant}). ` +
    (userPrompt ? userPrompt + ". " : "") +
    `Subtle ambient motion, soft natural light shifting, no people, keep the furniture and ` +
    `the scene exactly as shown, high-end real estate film style.`;

  const btn = document.getElementById("shop-ai-video-btn");
  btn.disabled = true;
  shopAiCloseVideo();
  shopAiVideoStatus("Starting video generation...");

  try {
    const instance = { prompt, image: { bytesBase64Encoded: frameB64, mimeType: frameMime } };
    const veoModels = ["veo-3.1-generate-preview", "veo-3.0-generate-preview", "veo-3.0-fast-generate-preview", "veo-2.0-generate-001"];
    const errs = [];
    let op = null;
    outer:
    for (const model of veoModels)
      for (const ver of ["v1beta", "v1"]) {
        try { op = await aiStartVeoOperation(key, ver, model, instance, "16:9"); break outer; }
        catch (err) { errs.push(`[${ver}/${model}] ${err.message}`); }
      }
    if (!op) throw new Error("No Veo model available for this key.\n" + errs.join("\n"));

    shopAiVideoStatus("Creating video (this can take 1 to 3 minutes)...");
    const result = await aiPollVeoOperation(key, op.ver, op.name);
    const d = extractVideoResult(result);
    if (!d) {
      const reason = result?.response?.raiMediaFilteredReasons?.[0] ||
        result?.response?.generateVideoResponse?.raiMediaFilteredReasons?.[0];
      throw new Error(reason ? "Blocked by safety filter: " + reason : "Response had no video.");
    }

    let blob;
    if (d.uri) {
      const resp = await fetch(d.uri, { headers: { "x-goog-api-key": key } });
      if (!resp.ok) throw new Error("Failed to download the generated video.");
      blob = await resp.blob();
    } else {
      const bin = atob(d.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: d.mime || "video/mp4" });
    }

    shopState.videoUrl = URL.createObjectURL(blob);
    document.getElementById("shop-ai-video").src = shopState.videoUrl;
    document.getElementById("shop-ai-video-result").classList.add("visible");
    document.getElementById("shop-ai-video-dl-btn").classList.add("visible");
    shopAiVideoStatus("Done! Video with " + p.name + " ready.");
  } catch (e) {
    console.error(e);
    shopAiVideoStatus("Error: " + e.message);
  }
  btn.disabled = false;
}

function shopAiDownloadVideo() {
  if (!shopState.videoUrl) return;
  const a = document.createElement("a");
  a.href = shopState.videoUrl;
  a.download = "scene-with-furniture.mp4";
  a.click();
}

/* ── Init ── */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (window.Shop3D) window.Shop3D.close();
  shopPlaceClose();
  shopCloseOrder();
});
shopUpdateTotals();
