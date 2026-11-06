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

- `nightcamp/`: a blurred night yard in perspective. Barbed wire runs across the front, a street lamp flickers, a dim American flag waves in the distance, and a candle lights in a window when you hover it (or on its own when idle / on touch screens).
  - Everything is drawn in code (no images). The background is drawn small and upscaled, which is the blur. "Background blur", "Exposure", "Fog" and "Vignette" set the mood; "Barbed wire" sets the (still) wire; "Wind" moves the flag, trees and fog.
  - Colors are set in the Tune panel. Export gives a self-contained file.
  - Candles: besides hover, a few light on their own ("Candles at a time"), each fading in slowly, burning 8-25 s, sometimes guttering.
  - Weather: Clear (default), Rain (drizzle that catches the lamp, wet-ground reflection), Snow (light snow and drifting motes, colder tint), or Fog (drifting fog banks over a denser haze). Wind drifts and gusts by itself and rain / snow / fog come and go ("Weather changes over time").
  - The wire is two round strands twisted loosely ("Twist length" sets how loose). `nightcamp/barbed-wire.svg` is the barbed wire on its own: wire plus three barbs in one tile that repeats seamlessly along x. In the effect the rope and the barbs are separate (`Effects.nightcamp.ropeSVG`, `barbSVG`, `stripSVG`): eight barb variants, each turned to a different angle around the wire, placed at the "Barb spacing" with some irregularity, with spikes behind the wire drawn behind it.

- `oldglory/`: an accurate 50-star flag (Executive Order 10834 proportions and the standard Old Glory red, white and blue), waving, in grayscale by default.
  - "Color around pointer" picks how color comes back: Color trail (paints in and fades), Spotlight, or Ripples (on move and tap). Saturation, contrast and brightness are set separately for the base and for the colored area.
  - "Focus: Stars" keeps the union in view on any screen shape; "Center" centers the flag.
  - The cloth is attached at the hoist (or along the top when hung): waves travel to the free end and grow, the free end droops and narrows slightly ("Droop"), folds run diagonally and foreshorten the cloth ("Fold depth").
  - "On tall screens" (phones): Hang vertically (default; stripes vertical, union upper left, as the Flag Code describes for vertical display, which fits a phone almost exactly), Full width (horizontal flag as a band), or Fill (crop).

## Deploy (Cloudflare Pages)

- Framework preset: none. Build command: empty. Output directory: `/`.
- Custom domain: `bg.muns.dev`.

## Local preview

`python3 -m http.server 8080` in this folder, then open http://localhost:8080/. Pages use root-relative paths, so serve from the repo root.
