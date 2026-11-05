/* Night camp background. Self-contained: no dependencies, no network requests.
   Effects.nightcamp.mount(element, config) -> { update(config), destroy() }
   A blurred night yard in one-point perspective: barracks, windows that show a candle when hovered,
   a flickering street lamp, a dim American flag in the distance, and barbed wire swaying up front. */
(function () {
  const params = [
    { group: 'Scene', key: 'horizon', label: 'Horizon height', min: .25, max: .65, step: .01, def: .42 },
    { key: 'depth', label: 'Depth (zoom)', min: .6, max: 1.6, step: .02, def: 1 },
    { key: 'blur', label: 'Background blur', min: 0, max: 1, step: .02, def: .55 },
    { key: 'exposure', label: 'Exposure', min: .4, max: 2, step: .05, def: 1.35 },
    { group: 'Colors', key: 'sky', label: 'Sky / haze', type: 'color', def: '#454d58' },
    { key: 'building', label: 'Buildings', type: 'color', def: '#1c2129' },
    { key: 'candle', label: 'Candle', type: 'color', def: '#ffb04f' },
    { key: 'lamp', label: 'Street lamp', type: 'color', def: '#ffc27a' },
    { key: 'wire', label: 'Barbed wire', type: 'color', def: '#060708' },
    { group: 'Windows', key: 'candleLevel', label: 'Candle brightness', min: 0, max: 1.5, step: .05, def: 1 },
    { key: 'candleFade', label: 'Candle lingers (s)', min: .3, max: 8, step: .1, def: 2.6 },
    { key: 'autopilot', label: 'Light candles when idle', type: 'toggle', def: true },
    { group: 'Street lamp', key: 'lampOn', label: 'Lamp on', type: 'toggle', def: true },
    { key: 'lampLevel', label: 'Lamp brightness', min: 0, max: 1.5, step: .05, def: .6 },
    { key: 'flicker', label: 'Flicker', min: 0, max: 1, step: .05, def: .6 },
    { group: 'Flag', key: 'flag', label: 'Flag on', type: 'toggle', def: true },
    { key: 'flagSize', label: 'Flag size', min: .3, max: 2, step: .05, def: .7 },
    { key: 'flagX', label: 'Flag position', min: -.35, max: .35, step: .01, def: -.035 },
    { key: 'flagLight', label: 'Flag light', min: 0, max: 1, step: .05, def: 0 },
    { group: 'Barbed wire', key: 'wireOn', label: 'Wire on', type: 'toggle', def: true },
    { key: 'strands', label: 'Strands', min: 1, max: 5, step: 1, def: 3 },
    { key: 'wireY', label: 'Position', min: .25, max: .95, step: .01, def: .55 },
    { key: 'wireGap', label: 'Strand spacing', min: .06, max: .3, step: .01, def: .22 },
    { key: 'wireWidth', label: 'Thickness', min: 1, max: 12, step: .25, def: 6 },
    { key: 'barbSize', label: 'Barb length', min: .4, max: 2, step: .05, def: 1 },
    { key: 'barbSpacing', label: 'Barb spacing', min: 30, max: 300, step: 5, def: 95 },
    { key: 'barbVariety', label: 'Barb variety', min: 0, max: 1, step: .05, def: .8 },
    { key: 'wireSoft', label: 'Out of focus', min: 0, max: 1, step: .05, def: .5 },
    { key: 'wireSag', label: 'Sag', min: 0, max: 80, step: 1, def: 2 },
    { key: 'wireTilt', label: 'Tilt (deg)', min: -8, max: 8, step: .5, def: -1.5 },
    { group: 'Wind', key: 'wind', label: 'Wind', min: 0, max: 2, step: .05, def: .6 },
    { key: 'gustPointer', label: 'Pointer stirs wire', min: 0, max: 1, step: .05, def: .5 },
    { group: 'Atmosphere', key: 'fog', label: 'Fog', min: 0, max: 1, step: .05, def: .65 },
    { key: 'clouds', label: 'Sky clouds', min: 0, max: 1, step: .05, def: .4 },
    { key: 'grain', label: 'Film grain', min: 0, max: 1, step: .05, def: .5 },
    { key: 'vignette', label: 'Vignette', min: 0, max: 1, step: .05, def: .65 }
  ];
  const defaults = {};
  params.forEach(p => { defaults[p.key] = p.def; });

  const RAD = Math.PI / 180;
  const hexv = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const c = hexv(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  const mixc = (a, b, t) => { const A = hexv(a), B = hexv(b); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')'; };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = x => { const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f); return hash(i) + (hash(i + 1) - hash(i)) * t; };
  const inQuad = (x, y, q) => {
    let pos = 0, neg = 0;
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c > 0) pos++; else if (c < 0) neg++; }
    return !(pos && neg);
  };

  /* Barbed wire, drawn as SVG (own drawing, free to use).
     ropeSVG: the twisted pair on its own, a seamless tile along x, with rust and pitting from a tile-safe noise filter.
     barbSVG: one barb (coil + four spikes) seen at a given rotation around the wire, split into the spikes behind the
     wire ('back') and the coil + spikes in front ('front'), so the rope can be drawn in between.
     stripSVG: rope + a few barbs combined into one seamless tile, for use outside the effect. */
  const hex2 = (a, b, t) => { const A = hexv(a), B = hexv(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const fx = n => (+n).toFixed(2);
  const ROPE_T = 288, ROPE_H = 24;
  function wireColors(col) { return { dark: hex2(col, '#000000', .2), mid: hex2(col, '#4a4f56', .28), hi: hex2(col, '#8f969f', .45) }; }
  function ropeBody(col, id, x0) {
    const C = wireColors(col), cy = ROPE_H / 2, T = ROPE_T; let o = '';
    o += '<rect x="' + (x0 - 2) + '" y="' + fx(cy - 4.6) + '" width="' + (T + 4) + '" height="9.2" fill="' + C.dark + '"/>';
    for (let x = -24, i = 0; x <= T + 24; x += 12, i++) {
      const xm = ((x % T) + T) % T, shade = .08 + .22 * hash(xm * .37 + 1), yo = i % 2 ? .6 : -.6;
      o += '<g transform="translate(' + (x0 + x + 6) + ' ' + fx(cy + yo) + ') rotate(-34)"><rect x="-11.5" y="-3.7" width="23" height="7.4" rx="3.7" fill="url(#' + id + 'g)" stroke="' + C.dark + '" stroke-width=".8"/>' +
        '<rect x="-11.5" y="-3.7" width="23" height="7.4" rx="3.7" fill="#000" opacity="' + fx(shade) + '"/></g>';
    }
    return o;
  }
  function ropeDefs(col, id, soft, w, h) {
    const C = wireColors(col);
    return '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.hi + '"/><stop offset=".42" stop-color="' + C.mid + '"/><stop offset="1" stop-color="' + C.dark + '"/></linearGradient>' +
      // rust blotches + bright pitting, from noise that stitches at the tile edges; then the focus blur
      '<filter id="' + id + 't" filterUnits="userSpaceOnUse" x="0" y="0" width="' + w + '" height="' + h + '" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".18 .6" numOctaves="3" seed="7" stitchTiles="stitch" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 .19  0 0 0 0 .12  0 0 0 0 .07  0 0 0 -4.5 2.05" result="ru"/>' +
      '<feComposite in="ru" in2="SourceGraphic" operator="atop" result="r1"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" stitchTiles="stitch" result="n2"/>' +
      '<feColorMatrix in="n2" type="matrix" values="0 0 0 0 .42  0 0 0 0 .44  0 0 0 0 .46  0 0 0 10 -7.6" result="sp"/>' +
      '<feComposite in="sp" in2="SourceGraphic" operator="in" result="sp2"/>' +
      '<feMerge result="tx"><feMergeNode in="r1"/><feMergeNode in="sp2"/></feMerge>' +
      (soft > 0 ? '<feGaussianBlur in="tx" stdDeviation="' + fx(soft * 1.1) + '"/>' : '') + '</filter>';
  }
  function ropeSVG(col, soft) {
    const id = 'r';
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + ROPE_T + '" height="' + ROPE_H + '" viewBox="0 0 ' + ROPE_T + ' ' + ROPE_H + '"><defs>' + ropeDefs(col, id, soft, ROPE_T, ROPE_H) + '</defs><g filter="url(#' + id + 't)">' + ropeBody(col, id, 0) + '</g></svg>', w: ROPE_T, h: ROPE_H };
  }
  function barbGeom(len, seed, variety) {
    let st = (seed * 2654435761) >>> 0 || 1; const rnd = () => { st = (Math.imul(st ^ (st >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return st / 4294967296; };
    const phi = rnd() * Math.PI * 2 * variety + (1 - variety) * .35, sp = [];
    for (let i = 0; i < 4; i++) {
      const th = phi + i * Math.PI / 2 + (rnd() - .5) * .7 * variety, sgn = i % 2 ? -1 : 1;
      const al = (57 + (rnd() - .5) * 22 * variety) * Math.PI / 180, L = len * (1 + (rnd() - .5) * .35 * variety);
      sp.push({ d: [sgn * Math.cos(al), Math.sin(al) * Math.cos(th), Math.sin(al) * Math.sin(th)], th, sgn, L, bend: (rnd() - .5) * .14 * (.3 + variety) });
    }
    return { sp, wraps: 3 + Math.floor(rnd() * 2.99), tiltC: -12 + rnd() * 10 * variety };
  }
  function barbBody(col, id, g, cx, cy, layer) {
    const C = wireColors(col); let o = '';
    for (const p of g.sp) {
      const front = p.d[2] >= 0; if ((layer === 'front') !== front) continue;
      const bx = cx + p.sgn * 2, by = cy + 3.2 * Math.cos(p.th), tx = bx + p.d[0] * p.L, ty = by + p.d[1] * p.L;
      const sl = Math.hypot(tx - bx, ty - by);
      if (sl < 2.5) { o += '<circle cx="' + fx(bx) + '" cy="' + fx(by) + '" r="2.2" fill="' + C.mid + '" stroke="' + C.dark + '" stroke-width=".6"/>'; continue; }
      const ux = (tx - bx) / sl, uy = (ty - by) / sl, nx = -uy * 2, ny = ux * 2, mx = bx + (tx - bx) * .55 - uy * p.bend * sl, my = by + (ty - by) * .55 + ux * p.bend * sl;
      const cut = Math.min(3, sl * .25);
      o += '<path d="M' + fx(bx + nx) + ' ' + fx(by + ny) + ' Q' + fx(mx + nx * .6) + ' ' + fx(my + ny * .6) + ' ' + fx(tx) + ' ' + fx(ty) +
        ' L' + fx(tx - ux * cut - nx * .5) + ' ' + fx(ty - uy * cut - ny * .5) + ' Q' + fx(mx - nx * .6) + ' ' + fx(my - ny * .6) + ' ' + fx(bx - nx) + ' ' + fx(by - ny) +
        'Z" fill="' + (front ? 'url(#' + id + 's)' : C.dark) + '" stroke="' + C.dark + '" stroke-width=".7" stroke-linejoin="round"/>';
    }
    if (layer === 'front') for (let j = 0; j < g.wraps; j++) {
      const x = cx - (g.wraps - 1) * 2 + j * 4;
      o += '<ellipse cx="' + fx(x) + '" cy="' + fx(cy) + '" rx="2.4" ry="6.8" transform="rotate(' + fx(g.tiltC) + ' ' + fx(x) + ' ' + fx(cy) + ')" fill="url(#' + id + 'c)" stroke="' + C.dark + '" stroke-width=".7"/>';
    }
    return o;
  }
  function barbDefs(col, id, soft) {
    const C = wireColors(col);
    return '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + C.dark + '"/><stop offset=".45" stop-color="' + C.hi + '"/><stop offset="1" stop-color="' + C.dark + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + C.dark + '"/><stop offset=".5" stop-color="' + C.mid + '"/><stop offset="1" stop-color="' + C.dark + '"/></linearGradient>' +
      (soft > 0 ? '<filter id="' + id + 'b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="' + fx(soft * 1.1) + '"/></filter>' : '');
  }
  function barbSVG(col, len, soft, seed, variety, layer) {
    const S = Math.ceil(2 * (len * 1.25 + 10)), c = S / 2, id = 'b', g = barbGeom(len, seed, variety);
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '"><defs>' + barbDefs(col, id, soft) + '</defs><g' + (soft > 0 ? ' filter="url(#' + id + 'b)"' : '') + '>' + barbBody(col, id, g, c, c, layer) + '</g></svg>', w: S, h: S };
  }
  function stripSVG(col, len, variety) {                   // standalone: rope + barbs in one seamless tile
    const T = ROPE_T, pad = Math.ceil(len * 1.25 + 10), Hh = Math.max(ROPE_H, 2 * pad), cy = Hh / 2, xs = [40, 135, 225];
    let o = '<svg xmlns="http://www.w3.org/2000/svg" width="' + T + '" height="' + Hh + '" viewBox="0 0 ' + T + ' ' + Hh + '" role="img" aria-label="Barbed wire"><defs>' +
      ropeDefs(col, 'r', 0, T, Hh) + barbDefs(col, 'b', 0) + '</defs>';
    const geoms = xs.map((x, i) => barbGeom(len, 11 + i * 7, variety));
    xs.forEach((x, i) => { o += barbBody(col, 'b', geoms[i], x, cy, 'back'); });
    o += '<g filter="url(#rt)" transform="translate(0 ' + (cy - ROPE_H / 2) + ')">' + ropeBody(col, 'r', 0) + '</g>';
    xs.forEach((x, i) => { o += barbBody(col, 'b', geoms[i], x, cy, 'front'); });
    return o + '</svg>';
  }

  /* tileable fractal noise, used for drifting sky clouds */
  let skyTex = null;
  function makeSky() {
    const size = 256; let s = 4242; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const f = new Float32Array(size * size); let amp = .5, tot = 0;
    for (const g of [3, 6, 12, 24]) {
      const lat = new Float32Array(g * g); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      const cell = size / g;
      for (let y = 0; y < size; y++) {
        const gy = y / cell, y0 = Math.floor(gy), ty = gy - y0, fy = ty * ty * (3 - 2 * ty), ra = (y0 % g) * g, rb = ((y0 + 1) % g) * g;
        for (let x = 0; x < size; x++) {
          const gx = x / cell, x0 = Math.floor(gx), tx = gx - x0, fx = tx * tx * (3 - 2 * tx), a = x0 % g, b = (a + 1) % g;
          const top = lat[ra + a] + (lat[ra + b] - lat[ra + a]) * fx, bot = lat[rb + a] + (lat[rb + b] - lat[rb + a]) * fx;
          f[y * size + x] += (top + (bot - top) * fy) * amp;
        }
      }
      tot += amp; amp *= .5;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'), img = c.createImageData(size, size), d = img.data;
    for (let i = 0; i < f.length; i++) {
      let t = (f[i] / tot - .4) / .35; t = t < 0 ? 0 : t > 1 ? 1 : t; t = t * t * (3 - 2 * t);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = Math.round(t * 255);
    }
    c.putImageData(img, 0, 0); return cv;
  }

  /* world: x across, y up, z into the scene. Camera at height HE, looking down +z. */
  const XW = 5.4, HE = 1.7, HB = 6.4, FLOORS = [[.9, 2.3], [3.5, 4.9]];

  function mount(el, cfg) {
    const P = Object.assign({}, defaults, cfg || {});
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.insertBefore(cv, el.firstChild);
    const ctx = cv.getContext('2d'), lo = document.createElement('canvas'), q = lo.getContext('2d');
    const grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = 128;
    { const g = grainCv.getContext('2d'), im = g.createImageData(128, 128); for (let i = 0; i < 128 * 128; i++) { const v = Math.random() * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }
    const grainPat = ctx.createPattern(grainCv, 'repeat');

    let W = 1, H = 1, dpr = 1, s = .3, u = 1, sc = 1, f = 1, vx = 0, vy = 0, raf = 0, last = 0, visible = true;
    let blocks = [], wins = [], posts = [], lamps = [], trees = [];
    const m = { x: -1e4, y: -1e4 }; let active = false, lastMove = -1e9, energy = 0, raw = 0, lx = 0, ly = 0;
    let t = 0, tw = 0, clock = 0, idleNext = 0, lampEv = { until: 0, next: 800, seed: 0 };
    let wireTex = null, wireInfo = null, barbSpr = null, wireKey = '', wireLoading = '';
    const NV = 8;
    const pr = (x, y, z) => [vx + f * x / z, vy + f * (HE - y) / z];
    const fogAt = z => 1 - Math.exp(-z / 38 * (.4 + P.fog * 1.2));

    function applyBg() { el.style.background = '#050608'; }

    function build() {
      vx = W / 2; vy = H * P.horizon; u = Math.min(W, H * 1.25); sc = Math.min(1.5, Math.max(.6, u / 1000));
      f = (H / W > 1.2 ? H * .78 : Math.min(Math.max(W * .85, H * .55), H * 1.4)) * P.depth;
      blocks = []; wins = []; posts = [];
      for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
        const z0 = 5 + k * 17 + (side > 0 ? 6 : 0), z1 = z0 + 12, x = side * XW, X2 = side * (XW + 9);
        blocks.push({ z: z0, side, fog: fogAt((z0 + z1) / 2),
          wall: [pr(x, 0, z0), pr(x, 0, z1), pr(x, HB, z1), pr(x, HB, z0)],
          gable: [pr(x, 0, z0), pr(X2, 0, z0), pr(X2, HB, z0), pr(side * (XW + 4.5), HB + 2.4, z0), pr(x, HB, z0)],
          eave: [pr(x, HB - .6, z0), pr(x, HB - .6, z1), pr(x, HB, z1), pr(x, HB, z0)] });
        for (const fl of FLOORS) for (let j = 0; j < 4; j++) {
          const za = z0 + 1.2 + j * 2.9, zb = za + 1.3, quad = [pr(x, fl[0], za), pr(x, fl[0], zb), pr(x, fl[1], zb), pr(x, fl[1], za)];
          const xs = quad.map(p => p[0]), ys = quad.map(p => p[1]);
          const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          wins.push({ z: (za + zb) / 2, side, quad, bb, cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2, w: bb[2] - bb[0], h: bb[3] - bb[1],
            lit: 0, hold: 0, ph: Math.random() * 100 });
        }
      }
      blocks.sort((a, b) => b.z - a.z); wins.sort((a, b) => b.z - a.z);
      for (const side of [-1, 1]) for (let z = 6; z < 92; z += 4) posts.push({ side, z, base: pr(side * 3.6, 0, z), top: pr(side * 3.6, 2.3, z), strands: [.7, 1.3, 1.9].map(y => pr(side * 3.6, y, z)) });
      posts.sort((a, b) => b.z - a.z);
      lamps = [{ head: pr(-2, 4.6, 22), top: pr(-3.2, 4.6, 22), base: pr(-3.2, 0, 22), z: 22, k: 1, ph: 0 }, { head: pr(2, 4.6, 54), top: pr(3.2, 4.6, 54), base: pr(3.2, 0, 54), z: 54, k: .45, ph: 3 }];
      if (!trees.length) for (let i = 0; i < 12; i++) trees.push({ dx: (hash(i * 3.1) - .5) * 1.1, h: .06 + hash(i * 7.7) * .1, w: .012 + hash(i * 5.3) * .012, ph: hash(i * 9.1) * 6 });
    }

    function resize() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      while (W * H * dpr * dpr > 9e6 && dpr > 1) dpr -= .25;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      sizeLo(); build();
      if (!raf) drawOnce();
    }
    function sizeLo() { s = P.blur <= 0 ? 1 : Math.max(.1, 1 / (1 + P.blur * 6)); lo.width = Math.max(2, Math.round(W * s)); lo.height = Math.max(2, Math.round(H * s)); }

    /* ---------- scene (drawn small, then upscaled = blur) ---------- */
    function drawFlag(lampI) {
      const size = u * .2 * P.flagSize, fh = size / 1.9, sh = fh / 13, h = u * .2 * P.flagSize, px = vx + W * P.flagX, by = vy + 3, topY = by - h;
      const dim = Math.min(1, .3 + .4 * P.flagLight + .05 * lampI), dk = 1 - dim;
      q.strokeStyle = mixc('#5a5f68', '#000000', dk); q.lineWidth = Math.max(1.2, u * .003);
      q.beginPath(); q.moveTo(px, by); q.lineTo(px, topY - 3); q.stroke();
      if (P.flagLight > 0) { const g = q.createRadialGradient(px + size / 2, topY + fh / 2, 0, px + size / 2, topY + fh / 2, size * 1.3); g.addColorStop(0, rgba('#cfd8ff', .14 * P.flagLight)); g.addColorStop(1, rgba('#cfd8ff', 0)); q.globalCompositeOperation = 'lighter'; q.fillStyle = g; q.fillRect(px - size, topY - size, size * 3.4, size * 3); q.globalCompositeOperation = 'source-over'; }
      const n = 24, A = fh * .08 * (.4 + P.wind * .8), pts = [];
      for (let i = 0; i <= n; i++) { const k = i / n, ph = k * 4.6 - tw * 2.4; pts.push([px + size * k * (1 - .06 * k) + Math.sin(ph) * A * .2 * k, topY + A * k * Math.sin(ph) + k * k * fh * .16, Math.cos(ph)]); }
      // each stripe is torn to its own length, with a ragged end, and its loose end flutters on its own
      const edge = (k, i, extra) => pts[i][1] + k * sh + extra;
      const flutter = (k, i) => { const t = i / n; return t * t * Math.sin(tw * 2.7 + k * 1.9 + i * .35) * sh * (.5 + P.wind * .6); };
      const gray = c => mixc(mixc(c, '#585858', .4), '#000000', dk);
      const red = gray('#b22234'), wh = gray('#e8eaf0'), bl = gray('#3c3b6e');
      for (let k = 0; k < 13; k++) {
        const tear = k < 7 ? .08 * hash(k + 2) : .12 + .5 * hash(k * 3.7), ne = Math.max(Math.floor(n * .3), Math.floor(n * (1 - tear))), nb = Math.max(Math.floor(n * .25), ne - 1 - Math.floor(hash(k * 5.3) * 4));
        q.beginPath();
        for (let i = 0; i <= ne; i++) { const y = edge(k, i, flutter(k, i)); i ? q.lineTo(pts[i][0], y) : q.moveTo(pts[i][0], y); }
        for (let i = nb; i >= 0; i--) q.lineTo(pts[i][0], edge(k + 1, i, flutter(k, i)) - (i > nb - 3 ? sh * .25 * hash(i + k) : 0));
        q.closePath(); q.fillStyle = k % 2 ? wh : red; q.fill();
      }
      const nc = Math.floor(n * .4); q.beginPath(); for (let i = 0; i <= nc; i++) i ? q.lineTo(pts[i][0], pts[i][1]) : q.moveTo(pts[i][0], pts[i][1]);
      for (let i = nc - 2; i >= 0; i--) q.lineTo(pts[i][0], pts[i][1] + 7 * sh); q.closePath(); q.fillStyle = bl; q.fill();
      q.fillStyle = mixc('#cfd2da', '#000000', dk);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { if (hash(r * 7 + c * 3) < .2) continue; const i = Math.round((.03 + c * .07) * n), y = pts[i][1] + (.9 + r * 1.6) * sh; q.fillRect(pts[i][0], y, Math.max(1, sh * .45), Math.max(1, sh * .45)); }
      for (let i = 0; i < n; i++) { const sl = pts[i][2]; q.fillStyle = sl > 0 ? 'rgba(255,255,255,' + (.04 * sl) + ')' : 'rgba(0,0,0,' + (-.3 * sl) + ')'; q.beginPath(); q.moveTo(pts[i][0], pts[i][1]); q.lineTo(pts[i + 1][0], pts[i + 1][1]); q.lineTo(pts[i + 1][0], pts[i + 1][1] + 9 * sh); q.lineTo(pts[i][0], pts[i][1] + 9 * sh); q.closePath(); q.fill(); }
    }

    function drawScene(now) {
      q.setTransform(s, 0, 0, s, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
      const fogc = mixc(P.sky, '#ffffff', .2);
      let g = q.createLinearGradient(0, 0, 0, vy); g.addColorStop(0, mixc(P.sky, '#000000', .88)); g.addColorStop(1, mixc(P.sky, '#000000', .1));
      q.fillStyle = g; q.fillRect(0, 0, W, vy + 2);
      if (P.clouds > 0) {
        if (!skyTex) skyTex = makeSky();
        const pat = q.createPattern(skyTex, 'repeat'), tile = Math.max(W, 600) * 1.1;
        pat.setTransform(new DOMMatrix().translate(clock * 6, 0).scale(tile / 256, tile / 256 * .55));
        q.save(); q.beginPath(); q.rect(0, 0, W, vy + 2); q.clip(); q.globalAlpha = .3 * P.clouds; q.fillStyle = pat; q.fillRect(0, 0, W, vy + 2); q.restore(); q.globalAlpha = 1;
      }
      g = q.createRadialGradient(vx, vy, 0, vx, vy, u * .8); g.addColorStop(0, rgba(fogc, .5 * P.fog + .1)); g.addColorStop(1, rgba(fogc, 0)); q.fillStyle = g; q.fillRect(0, 0, W, H);
      g = q.createLinearGradient(0, vy, 0, H); g.addColorStop(0, mixc(P.sky, '#000000', .3)); g.addColorStop(.3, mixc(P.sky, '#000000', .5)); g.addColorStop(1, mixc(P.sky, '#000000', .56)); q.fillStyle = g; q.fillRect(0, vy, W, H - vy);
      // far line of trees, tower
      const treeC = mixc(P.sky, '#000000', .72);
      q.fillStyle = treeC; q.fillRect(0, vy - 2, W, 4);
      for (const tr of trees) {
        const x = vx + tr.dx * W, hh = tr.h * u, ww = tr.w * u * 3, sw = Math.sin(tw * .9 + tr.ph) * 2.2 * P.wind * sc;
        q.beginPath(); q.moveTo(x - ww, vy + 2); q.quadraticCurveTo(x - ww * .9 + sw * .5, vy - hh * .5, x + sw, vy - hh); q.quadraticCurveTo(x + ww * .9 + sw * .5, vy - hh * .5, x + ww, vy + 2); q.closePath(); q.fill();
      }
      const tx = vx - u * .17, th = u * .11; q.fillStyle = mixc(P.sky, '#000000', .8); q.lineWidth = Math.max(1, u * .003); q.strokeStyle = q.fillStyle;
      q.beginPath(); q.moveTo(tx - th * .22, vy + 2); q.lineTo(tx - th * .1, vy - th); q.moveTo(tx + th * .22, vy + 2); q.lineTo(tx + th * .1, vy - th); q.stroke();
      q.fillRect(tx - th * .17, vy - th * 1.22, th * .34, th * .22); q.beginPath(); q.moveTo(tx - th * .22, vy - th * 1.22); q.lineTo(tx, vy - th * 1.4); q.lineTo(tx + th * .22, vy - th * 1.22); q.fill();
      const tl = .55 + .2 * noise(clock * 1.3); q.fillStyle = rgba(P.lamp, .22 * tl); q.fillRect(tx - th * .1, vy - th * 1.17, th * .2, th * .1);
      // lamp state
      const lampI = P.lampOn ? lampLevel(now) : 0;
      if (P.flag) drawFlag(lampI);
      // buildings
      const bld = P.building;
      for (const b of blocks) {
        const fg = Math.min(.85, b.fog);
        const poly = pp => { q.beginPath(); pp.forEach((p, i) => i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])); q.closePath(); };
        poly(b.gable); q.fillStyle = mixc(mixc(bld, '#000000', .35), fogc, fg); q.fill();
        poly(b.wall); q.fillStyle = mixc(bld, fogc, fg); q.fill();
        poly(b.eave); q.fillStyle = mixc(mixc(bld, '#000000', .5), fogc, fg * .9); q.fill();
      }
      // fence in front of the walls
      q.lineWidth = Math.max(.6, sc * .8);
      for (const p of posts) {
        const fg = Math.min(.8, fogAt(p.z));
        q.strokeStyle = mixc('#0d0f13', fogc, fg * .7); q.lineWidth = Math.max(.7, 1.2 * f / p.z / 20);
        q.beginPath(); q.moveTo(p.base[0], p.base[1]); q.lineTo(p.top[0], p.top[1]); q.stroke();
      }
      q.lineWidth = Math.max(.5, sc * .6);
      for (let i = 0; i < posts.length; i++) {
        const a = posts[i]; let nb = null; for (let j = i + 1; j < posts.length; j++) if (posts[j].side === a.side) { nb = posts[j]; break; }
        if (!nb) continue; // posts are far-first, so the neighbour is the next nearer one
        q.strokeStyle = mixc('#14171b', fogc, Math.min(.8, fogAt(a.z))); q.beginPath();
        for (let k = 0; k < 3; k++) { q.moveTo(a.strands[k][0], a.strands[k][1]); q.lineTo(nb.strands[k][0], nb.strands[k][1]); }
        q.stroke();
      }
      // windows
      for (const w of wins) {
        const fg = Math.min(.8, fogAt(w.z));
        q.beginPath(); w.quad.forEach((p, i) => i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1])); q.closePath();
        q.fillStyle = mixc('#0a0d12', fogc, fg * .8); q.fill();
        if (w.w > 7) { q.strokeStyle = 'rgba(0,0,0,.45)'; q.lineWidth = Math.max(.6, w.w * .06); q.stroke(); }
        if (w.lit > .01) {
          const fl = Math.max(.25, Math.min(1.2, .72 + .2 * Math.sin(clock * 9.1 + w.ph) + .1 * Math.sin(clock * 17.3 + w.ph * 1.7) + .35 * (noise(clock * 11 + w.ph) - .5))), a = w.lit * fl * P.candleLevel * .36;
          q.save(); q.clip(); const r = Math.max(w.w, w.h) * .75;
          g = q.createRadialGradient(w.cx, w.cy + w.h * .15, 0, w.cx, w.cy + w.h * .15, r); g.addColorStop(0, rgba('#ffe0a8', Math.min(1, a * .9))); g.addColorStop(.35, rgba(P.candle, Math.min(1, a * .5))); g.addColorStop(1, rgba('#7a2a05', Math.min(1, a * .15)));
          q.fillStyle = g; q.fillRect(w.bb[0], w.bb[1], w.w, w.h); q.restore();
          q.globalCompositeOperation = 'lighter'; const R = Math.max(w.w, w.h) * 1.8; g = q.createRadialGradient(w.cx, w.cy, 0, w.cx, w.cy, R); g.addColorStop(0, rgba(P.candle, Math.min(.2, a * .2))); g.addColorStop(1, rgba(P.candle, 0)); q.fillStyle = g; q.fillRect(w.cx - R, w.cy - R, R * 2, R * 2); q.globalCompositeOperation = 'source-over';
        }
      }
      // street lamps
      for (const L of lamps) {
        const I = L === lamps[0] ? lampI : lampI * .55 * (.8 + .2 * noise(clock * 2 + L.ph));
        const wpx = Math.max(1, 5 * f / L.z / 14);
        q.strokeStyle = mixc('#15181d', fogc, Math.min(.8, fogAt(L.z))); q.lineWidth = wpx;
        q.beginPath(); q.moveTo(L.base[0], L.base[1]); q.lineTo(L.top[0], L.top[1]); q.lineTo(L.head[0], L.head[1]); q.stroke();
        if (I <= .005) continue;
        q.globalCompositeOperation = 'lighter';
        const R = f * 4.2 / L.z * P.lampLevel * (L === lamps[0] ? 1 : .6);
        g = q.createRadialGradient(L.head[0], L.head[1], 0, L.head[0], L.head[1], R); g.addColorStop(0, rgba(P.lamp, .5 * I)); g.addColorStop(.3, rgba(P.lamp, .16 * I)); g.addColorStop(1, rgba(P.lamp, 0)); q.fillStyle = g; q.fillRect(L.head[0] - R, L.head[1] - R, R * 2, R * 2);
        q.save(); q.translate(L.base[0] - (L.base[0] - L.head[0]) * .2, L.base[1]); q.scale(1, .2); const R2 = f * 4.4 / L.z * P.lampLevel;
        g = q.createRadialGradient(0, 0, 0, 0, 0, R2); g.addColorStop(0, rgba(P.lamp, .32 * I)); g.addColorStop(1, rgba(P.lamp, 0)); q.fillStyle = g; q.fillRect(-R2, -R2, R2 * 2, R2 * 2); q.restore();
        q.fillStyle = rgba('#fff3d6', Math.min(1, .7 * I)); q.beginPath(); q.arc(L.head[0], L.head[1], Math.max(1.2, 4 * f / L.z / 16), 0, 6.3); q.fill();
        q.globalCompositeOperation = 'source-over';
      }
      if (P.exposure > 1) { q.globalCompositeOperation = 'lighter'; q.fillStyle = rgba(P.sky, (P.exposure - 1) * .3); q.fillRect(0, 0, W, H); q.globalCompositeOperation = 'source-over'; }
      else if (P.exposure < 1) { q.fillStyle = 'rgba(0,0,0,' + ((1 - P.exposure) * .8) + ')'; q.fillRect(0, 0, W, H); }
      // low fog drifting over the ground
      g = q.createLinearGradient(0, vy - 6, 0, vy + (H - vy) * .45); g.addColorStop(0, rgba(fogc, .2 * P.fog)); g.addColorStop(1, rgba(fogc, 0)); q.fillStyle = g; q.fillRect(0, vy - 6, W, (H - vy) * .5);
    }
    function lampLevel(now) {
      const nowS = now / 1000;
      if (nowS > lampEv.next) { lampEv.until = nowS + .15 + Math.random() * .55; lampEv.next = lampEv.until + 1.2 + Math.random() * 4.5; lampEv.seed = Math.random() * 100; }
      let I = .9 + .1 * noise(nowS * 3);
      if (nowS < lampEv.until) I *= noise(nowS * 38 + lampEv.seed) > .5 ? .95 : .12;
      return 1 - P.flicker * (1 - I);
    }

    /* ---------- foreground barbed wire (sharp) ---------- */
    function sway(x, s, ph) {
      const A = 4 * sc * P.wind, gust = 1 + .5 * Math.sin(tw * .37 + ph);
      let y = A * gust * (Math.sin(x * .0036 + tw * 1.15 + ph) * .6 + Math.sin(x * .0095 - tw * 1.9 + ph * 1.7) * .4);
      const dx = (x - lx) / (W * .2); y += P.gustPointer * energy * Math.exp(-dx * dx) * Math.sin(tw * 6.5 - x * .02 + ph) * 14 * sc;
      return y;
    }
    // Rasterise the rope tile and the barb variants once per wire color / barb length / focus / variety.
    const raster = (info, R) => new Promise(res => {
      const img = new Image();
      img.onload = () => { const c2 = document.createElement('canvas'); c2.width = Math.ceil(info.w * R); c2.height = Math.ceil(info.h * R); c2.getContext('2d').drawImage(img, 0, 0, c2.width, c2.height); res(c2); };
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(info.svg);
    });
    function ensureWireTex() {
      const key = [P.wire, P.barbSize, P.wireSoft, P.barbVariety].join('|');
      if (key === wireKey || key === wireLoading) return;
      wireLoading = key;
      const len = 30 * P.barbSize, rope = ropeSVG(P.wire, P.wireSoft), jobs = [raster(rope, 3)];
      for (let v = 0; v < NV; v++) for (const layer of ['back', 'front']) jobs.push(raster(barbSVG(P.wire, len, P.wireSoft, v + 1, P.barbVariety, layer), 3));
      Promise.all(jobs).then(r => {
        if (wireLoading !== key) return;
        wireTex = r[0]; wireInfo = rope;
        barbSpr = []; for (let v = 0; v < NV; v++) barbSpr.push({ back: r[1 + v * 2], front: r[2 + v * 2], S: barbSVG(P.wire, len, 0, v + 1, P.barbVariety, 'front').w });
        wireKey = key; wireLoading = '';
        if (!raf) drawOnce();
      });
    }
    function barbsAlong(c, list, ts, layer) {
      for (const b of list) {
        const spr = barbSpr[b.v], img = spr[layer]; if (!img) continue;
        const size = spr.S * ts, cs = Math.cos(b.a), sn = Math.sin(b.a);
        c.setTransform(dpr * cs * b.f, dpr * sn * b.f, -dpr * sn, dpr * cs, dpr * b.x, dpr * b.y);
        c.drawImage(img, -size / 2, -size / 2, size, size);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Lay the tile along a polyline: one thin slice per segment, rotated to the segment, so the strand bends as it sways.
    function laneAlong(c, pts, ts, phase) {
      const src = wireTex, R = src.width / wireInfo.w, T = wireInfo.w, h = wireInfo.h * ts;
      let s0 = phase;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        if (d < .01) continue;
        const cs = dx / d, sn = dy / d; let du = d / ts, off = 0;
        while (du > 1e-6) {
          const u0 = ((s0 % T) + T) % T, take = Math.min(du, T - u0), sw = take * ts;
          c.setTransform(dpr * cs, dpr * sn, -dpr * sn, dpr * cs, dpr * (a[0] + cs * off), dpr * (a[1] + sn * off));
          c.drawImage(src, u0 * R, 0, Math.max(.5, take * R), src.height, 0, -h / 2, sw + .6, h);
          s0 += take; du -= take; off += sw;
        }
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function drawWire(c, lampI) {
      ensureWireTex();
      const S = P.strands | 0, gapPx = H * P.wireGap, wsc = Math.max(.95, u / 1000), wpx = P.wireWidth * wsc, x0 = -12;
      const tilt = Math.tan(P.wireTilt * RAD), ts = wpx * .13, spacing = Math.max(10, P.barbSpacing * wsc);
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let k = 0; k < S; k++) {
        const by = H * P.wireY + (k - (S - 1) / 2) * gapPx, ph = k * 1.7 + .6, sag = P.wireSag * sc, pts = [];
        for (let x = x0; x <= W + 12; x += 5) {
          const xn = 2 * x / W - 1;
          pts.push([x, by + tilt * (x - W / 2) * (1 + k * .15) + sag * (1 - xn * xn) + (noise(x * .0032 + k * 9.1) - .5) * 22 * sc + sway(x, k, ph)]);
        }
        if (P.wireSoft > 0) {                                   // soft shadow of the strand, sells the shallow focus
          c.strokeStyle = rgba(P.wire, .28 * P.wireSoft); c.lineWidth = wpx * 2.6;
          c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
        }
        if (!wireTex || !barbSpr) continue;
        // barb positions along the strand: set spacing with a little irregularity, each a random variant, some mirrored
        const list = []; let s0 = hash(k * 3.3) * spacing, seg = 0, acc = 0, j = 0;
        while (true) {
          while (seg < pts.length - 1) { const d = Math.hypot(pts[seg + 1][0] - pts[seg][0], pts[seg + 1][1] - pts[seg][1]); if (acc + d >= s0) break; acc += d; seg++; }
          if (seg >= pts.length - 1) break;
          const A = pts[seg], B = pts[seg + 1], d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, t = (s0 - acc) / d;
          list.push({ x: A[0] + (B[0] - A[0]) * t, y: A[1] + (B[1] - A[1]) * t, a: Math.atan2(B[1] - A[1], B[0] - A[0]) + Math.sin(tw * 1.4 + j + k) * .05,
            v: Math.floor(hash(k * 29 + j * 7.3) * NV) % NV, f: hash(k * 13 + j * 3.1) < .5 ? -1 : 1 });
          j++; s0 += spacing * (1 + (hash(k * 17 + j * 1.9) - .5) * .5 * P.barbVariety);
        }
        barbsAlong(c, list, ts, 'back');
        laneAlong(c, pts, ts, hash(k * 5.1) * wireInfo.w);
        barbsAlong(c, list, ts, 'front');
      }
    }

    /* ---------- frame ---------- */
    function draw(now) {
      const lampI = P.lampOn ? lampLevel(now) : 0;
      drawScene(now);
      const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(lo, 0, 0, W, H);
      if (s < .95) { const d = .55 / s; c.globalAlpha = .5; c.drawImage(lo, d, d * .6, W, H); c.globalAlpha = .34; c.drawImage(lo, -d, -d * .6, W, H); c.globalAlpha = 1; }
      if (P.wireOn) drawWire(c, lampI);
      if (P.vignette > 0) { const g = c.createRadialGradient(W / 2, H * .46, Math.min(W, H) * .2, W / 2, H * .46, Math.hypot(W, H) * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (.85 * P.vignette) + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
      if (P.grain > 0) { c.save(); c.globalAlpha = .1 * P.grain; c.globalCompositeOperation = 'overlay'; const ox = Math.floor(Math.random() * 128), oy = Math.floor(Math.random() * 128); c.translate(-ox, -oy); c.fillStyle = grainPat; c.fillRect(0, 0, W + 128, H + 128); c.restore(); }
    }

    function step(now, dt) {
      clock += reduce ? 0 : dt; tw += reduce ? 0 : dt * (.25 + P.wind * .9);
      raw *= Math.exp(-dt / .45); energy += (raw - energy) * (1 - Math.exp(-dt / .5)); lx += (m.x - lx) * (1 - Math.exp(-dt / .25));
      const idle = (P.autopilot || coarse) && !reduce && now - lastMove > 2500;
      if (idle && now > idleNext) {
        const near = wins.filter(w => w.z < 45 && w.cx > 0 && w.cx < W && w.cy > 0 && w.cy < H);
        if (near.length) { const w = near[Math.floor(Math.random() * near.length)]; w.hold = now + 2200 + Math.random() * 3000; }
        idleNext = now + 900 + Math.random() * 1400;
      }
      const up = 1 - Math.exp(-dt / .3), dn = 1 - Math.exp(-dt / Math.max(.05, P.candleFade));
      let hov = null;
      if (active && !idle) for (let i = wins.length - 1; i >= 0; i--) {
        const w = wins[i], pad = w.w < 14 ? 6 : 2;
        if (m.x < w.bb[0] - pad || m.x > w.bb[2] + pad || m.y < w.bb[1] - pad || m.y > w.bb[3] + pad) continue;
        if (w.w * w.h < 700 || inQuad(m.x, m.y, w.quad)) { hov = w; break; }
      }
      for (const w of wins) { const tgt = (w === hov || now < w.hold) ? 1 : 0; w.lit += (tgt - w.lit) * (tgt > w.lit ? up : dn); if (w.lit < .003 && !tgt) w.lit = 0; }
    }
    function drawOnce() { const n = performance.now(); step(n, .016); draw(n); }
    function loop(now) {
      raf = 0; if (!visible || document.hidden) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now; step(now, dt); draw(now); raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    function onMove(e) { const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; raw = Math.min(1, raw + Math.hypot(x - m.x, y - m.y) / 160); m.x = x; m.y = y; lastMove = performance.now(); active = true; }
    function onOut(e) { if (!e.relatedTarget) { active = false; } }
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseout', onOut);
    document.addEventListener('visibilitychange', start);
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }); io.observe(el);
    applyBg(); resize(); start();

    return {
      update(next) {
        const geo = ['horizon', 'depth'].some(k => next[k] !== undefined && next[k] !== P[k]), bl = next.blur !== undefined && next.blur !== P.blur;
        Object.assign(P, next);
        if (bl) sizeLo();
        if (geo) build();
        if (!raf) drawOnce();
      },
      destroy() {
        cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect();
        removeEventListener('pointermove', onMove); document.removeEventListener('mouseout', onOut); document.removeEventListener('visibilitychange', start);
        cv.remove();
      }
    };
  }

  window.Effects = window.Effects || {};
  window.Effects.nightcamp = { name: 'Night camp', params, defaults, mount, ropeSVG, barbSVG, stripSVG };
})();
