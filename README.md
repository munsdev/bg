# bg.muns.dev

Animated hero backgrounds. Static site, no build step.

## Structure

- `index.html` lists the effects from `effects.json`.
- `shared/shell.js`, `shell.css`: top bar (Home, layout switch, Tune, Export).
- `shared/hero-layouts.css`: the standard hero layouts.
- `<effect>/index.html` and `<effect>/effect.js`: one folder per effect.
- `tools/`: dev-only scripts (not needed to deploy).

## Adding an effect

1. Copy `flag/` to a new folder.
2. In `effect.js`, define `window.Effects.<slug> = { name, params, defaults, mount }`. `mount(el, config)` returns `{ update(config), destroy() }`. `params` drives the Tune panel. A param is a slider (default), `type: 'toggle'`, `type: 'color'`, or `type: 'select'` with `options: [[value, label], ...]`.
3. In the folder's `index.html`, call `Shell.init({ slug, effect, effectFile })`.
4. Add an entry to `effects.json`.

## Effects

- `flag/`: waving flag, stars light up under the pointer.
- `nightmap/`: dark map of the US, Europe, or both. Borders and states light up under the pointer, with a cloud layer on top.
  - Region: United States (with Alaska and Hawaii insets), Europe, or US + Europe across the Atlantic.
  - Illuminate: a glow around the pointer that lights every border it touches, a whole state or country lit when hovered, or both.
  - Base outline width 0 hides borders until they are lit; raise it for a dark line on every border.
  - Clouds drift over the map, part around the pointer, and pick up the light color. With no pointer (or on touch screens) the light wanders from state to state on its own.
  - The map data is embedded in `nightmap/effect.js`, so the Export menu produces self-contained files.
  - To change the map data (detail level, countries), see the header of `tools/build-map-data.cjs`. It rewrites the data block in `effect.js`.

- `nightcamp/`: a blurred night yard in perspective. Barbed wire sways in front, a street lamp flickers, a dim American flag waves in the distance, and a candle lights in a window when you hover it (or on its own when idle / on touch screens).
  - Everything is drawn in code (no images). The background is drawn small and upscaled, which is the blur. "Background blur", "Exposure", "Fog" and "Vignette" set the mood; "Barbed wire" and "Wind" control the wire.
  - Colors are set in the Tune panel. Export gives a self-contained file.

## Deploy (Cloudflare Pages)

- Framework preset: none. Build command: empty. Output directory: `/`.
- Custom domain: `bg.muns.dev`.

## Local preview

`python3 -m http.server 8080` in this folder, then open http://localhost:8080/. Pages use root-relative paths, so serve from the repo root.
