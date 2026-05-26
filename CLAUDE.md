# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

No build step or package manager. Open `index.html` directly in a browser:

```
start index.html        # Windows
open index.html         # macOS
```

Three.js r128 is loaded at runtime from the Cloudflare CDN — an internet connection is required. There are no tests or lint commands.

## Architecture

The entire application lives in a single file: `index.html`. It is structured as:

1. **CSS** (inline `<style>`) — all UI styles, including loader, top bar, left/right panels, hotspots, minimap, and walk-mode overlay.
2. **HTML** — static shell: `<canvas id="canvas">`, loader overlay, UI overlay (`#ui`), and hotspot layer (`#hs-layer`). Room list items are injected dynamically.
3. **JavaScript** (inline `<script>`) — bootstraps by dynamically loading Three.js, then calls `initScene()`.

### `initScene()` internals

Everything runs inside `initScene()`, which is one large function:

- **Renderer / Scene / Camera** — Three.js WebGL renderer with ACES filmic tone mapping and PCFSoft shadows; `PerspectiveCamera` (60°).
- **Procedural textures** — Wood, concrete, marble, and a lightmap are all generated with `mkTex()` (a `DataTexture` helper), not loaded from files.
- **Geometry** — All furniture and architecture are Three.js primitives assembled with `box()`, `cyl()`, and `sph()` helpers that call `addMesh()`. No external 3D models are used.
- **Lighting** — DirectionalLight (sun), HemisphereLight (sky/ground), and several PointLights (lamps, fireplace glow, TV glow). Intensities flicker in the animation loop via `Math.sin(t)`.
- **Rooms data** — The `rooms` array drives the left-panel list, right-panel info card, hotspot markers, and minimap POI dots.
- **Camera modes** — `mode` is either `'orbit'` or `'walk'`, toggled by `setMode()`. Orbit uses a custom spherical-coordinate controller with momentum damping. Walk uses WASD + mouse-drag with `Pointer Lock API`.
- **Fly-to animation** — `flyTo()` sets `flyAnim = 0`; the render loop lerps camera position and `ctrl.target` using a quartic ease-out.
- **Minimap** — Drawn every frame onto `<canvas id="mm">` using Canvas 2D API; shows camera position, look direction, and room POI dots.
- **Lighting sliders** — `window.sl(type, el)` maps slider value to light intensities.

### Key globals exposed on `window`

| Name | Purpose |
|---|---|
| `setMode(m)` | Switch between `'orbit'` and `'walk'` |
| `togglePanel()` | Show/hide left panel |
| `sl(type, el)` | Lighting slider callback |
| `closeRp()` | Close right info panel |

## Language

UI strings and comments are in Brazilian Portuguese (pt-BR). Keep new UI text consistent with that.
