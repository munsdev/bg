# bg.muns.dev

Animated hero backgrounds. Static site, no build step.

## Structure

- `index.html` lists the effects from `effects.json`.
- `shared/shell.js`, `shell.css`: top bar (Home, layout switch, Tune, Export).
- `shared/hero-layouts.css`: the standard hero layouts.
- `<effect>/index.html` and `<effect>/effect.js`: one folder per effect.

## Adding an effect

1. Copy `flag/` to a new folder.
2. In `effect.js`, define `window.Effects.<slug> = { name, params, defaults, mount }`. `mount(el, config)` returns `{ update(config), destroy() }`. `params` drives the Tune panel.
3. In the folder's `index.html`, call `Shell.init({ slug, effect, effectFile })`.
4. Add an entry to `effects.json`.

## Deploy (Cloudflare Pages)

- Framework preset: none. Build command: empty. Output directory: `/`.
- Custom domain: `bg.muns.dev`.

## Local preview

`python3 -m http.server 8080` in this folder, then open http://localhost:8080/. Pages use root-relative paths, so serve from the repo root.
