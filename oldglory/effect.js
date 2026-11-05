/* Old Glory background: an accurate, waving US flag in grayscale; color comes back around the pointer.
   Self-contained: no dependencies, no network requests.
   Effects.oldglory.mount(element, config) -> { update(config), destroy() }
   Flag geometry follows Executive Order 10834: hoist A = 1, fly B = 1.9, union C = 7/13 A by D = 0.76 A,
   star rows E = F = 0.054 A, star columns G = H = 0.063 A, star diameter K = 0.0616 A, stripe L = A / 13. */
(function () {
  const params = [
    { group: 'Flag', key: 'fit', label: 'Fit', type: 'select', options: [['cover', 'Fill'], ['contain', 'Fit inside']], def: 'cover' },
    { key: 'portrait', label: 'On tall screens', type: 'select', options: [['hang', 'Hang vertically'], ['width', 'Full width'], ['crop', 'Fill (crop)']], def: 'hang' },
    { key: 'focus', label: 'Focus', type: 'select', options: [['canton', 'Stars (top left)'], ['center', 'Center']], def: 'canton' },
    { key: 'zoom', label: 'Zoom', min: .6, max: 3, step: .05, def: 1.1 },
    { key: 'offX', label: 'Shift X', min: -.5, max: .5, step: .01, def: 0 },
    { key: 'offY', label: 'Shift Y', min: -.5, max: .5, step: .01, def: 0 },
    { key: 'tilt', label: 'Tilt (deg)', min: -25, max: 25, step: .5, def: -6 },
    { key: 'bg', label: 'Background', type: 'color', def: '#0e1420' },
    { group: 'Wave', key: 'idleAmp', label: 'Wind strength', min: 0, max: 40, step: .5, def: 16 },
    { key: 'idleSpeed', label: 'Idle speed', min: 0, max: 2, step: .01, def: .55 },
    { key: 'gust', label: 'Gusts', min: 0, max: 1, step: .05, def: .6 },
    { key: 'wave', label: 'Wavelength', min: .5, max: 2, step: .05, def: 1 },
    { key: 'droop', label: 'Droop (free end)', min: 0, max: 1, step: .05, def: .35 },
    { key: 'fold', label: 'Fold depth', min: 0, max: 2, step: .05, def: 1 },
    { key: 'shade', label: 'Fold shading', min: 0, max: 2, step: .05, def: .8 },
    { key: 'boost', label: 'Wave boost near pointer', min: 0, max: 3, step: .05, def: .6 },
    { group: 'Base (away from pointer)', key: 'baseSat', label: 'Saturation', min: 0, max: 1, step: .02, def: 0 },
    { key: 'baseContrast', label: 'Contrast', min: .4, max: 1.6, step: .02, def: .95 },
    { key: 'baseBright', label: 'Brightness', min: .3, max: 1.3, step: .02, def: .82 },
    { group: 'Color around pointer', key: 'mode', label: 'Effect', type: 'select', options: [['trail', 'Color trail'], ['spot', 'Spotlight'], ['ripple', 'Ripples'], ['none', 'Off (grayscale only)']], def: 'trail' },
    { key: 'radius', label: 'Radius', min: 60, max: 600, step: 5, def: 220 },
    { key: 'soft', label: 'Edge softness', min: 0, max: 1, step: .05, def: .7 },
    { key: 'boostSat', label: 'Saturation boost', min: 0, max: 2, step: .05, def: 1.15 },
    { key: 'boostContrast', label: 'Contrast boost', min: .6, max: 1.8, step: .02, def: 1.12 },
    { key: 'boostBright', label: 'Brightness', min: .6, max: 1.5, step: .02, def: 1.02 },
    { key: 'glow', label: 'Glow', min: 0, max: 1, step: .05, def: .15 },
    { key: 'fade', label: 'Fade back (s)', min: .2, max: 8, step: .1, def: .2 },
    { key: 'lag', label: 'Follow lag', min: 1, max: 30, step: .5, def: 10 },
    { key: 'autopilot', label: 'Wander when idle', type: 'toggle', def: false }
  ];
  const defaults = {};
  params.forEach(p => { defaults[p.key] = p.def; });

  const RED = '#B22234', WHITE = '#FFFFFF', BLUE = '#3C3B6E', RAD = Math.PI / 180;
  const hexv = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const c = hexv(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  // saturation, contrast and brightness applied to one flag color (no per-pixel work needed: the flag has three colors)
  function tone(hex, sat, con, bri) {
    const c = hexv(hex), lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
    return 'rgb(' + c.map(v => { let x = lum + (v - lum) * sat; x = ((x / 255 - .5) * con + .5) * bri; return Math.round(Math.max(0, Math.min(1, x)) * 255); }).join(',') + ')';
  }
  function starPath(c, x, y, R) {
    const r = R * .381966; c.moveTo(x, y - R);
    for (let i = 1; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  // A = hoist in px. Horizontal: 1.9 A wide, A tall. Vertical (hung against a wall, per the Flag Code): A wide, 1.9 A tall,
  // stripes run vertically, the union is in the upper left, stars stay upright.
  function paintFlag(c, A, red, white, blue, vertical) {
    const B = A * 1.9, L = A / 13, v = !!vertical, rect = (x, y, w, h) => v ? c.fillRect(y, x, h, w) : c.fillRect(x, y, w, h);
    c.fillStyle = white; rect(0, 0, B, A);
    c.fillStyle = red; for (let k = 0; k < 13; k += 2) rect(0, k * L, B, L);
    c.fillStyle = blue; rect(0, 0, A * .76, L * 7);
    c.fillStyle = white; c.beginPath();
    for (let r = 0; r < 9; r++) for (let col = 0; col < 11; col++) {
      if (col % 2 !== r % 2) continue;                       // rows of 6 (even) and 5 (odd), offset
      const x = (col + 1) * .063 * A, y = (r + 1) * .054 * A;
      v ? starPath(c, y, x, .0308 * A) : starPath(c, x, y, .0308 * A);
    }
    c.fill();
  }

  function mount(el, cfg) {
    const P = Object.assign({}, defaults, cfg || {});
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.insertBefore(cv, el.firstChild);
    const ctx = cv.getContext('2d');
    const cl = document.createElement('canvas'), cx = cl.getContext('2d');      // vivid layer, masked
    const mk = document.createElement('canvas'), mx = mk.getContext('2d');      // soft mask (low-res)
    const texG = document.createElement('canvas'), texC = document.createElement('canvas'), shTex = document.createElement('canvas'); let shImg = null;
    const shCv = document.createElement('canvas'), shCx = shCv.getContext('2d');

    let W = 1, H = 1, dpr = 1, k = 1, fw = 1, fh = 1, Lf = 1, Wf = 1, asp = 1.9, vert = false, ms = .25, raf = 0, last = 0, visible = true, texKey = '';
    const m = { x: 0, y: 0 }, sm = { x: 0, y: 0 };
    let active = false, lastMove = -1e9, raw = 0, energy = 0, t = 0, gT = 0, gustAmp = 1, wx = 0, gi = 0, rings = [], lastRing = null;
    let mb = null, lastPaint = -1e9;                        // screen-space box around everything the mask currently shows

    function applyBg() { el.style.background = P.bg; }
    function layout() {
      const a = P.tilt * RAD, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
      const bw = W * ca + H * sa, bh = W * sa + H * ca, mgn = P.idleAmp * k * 1.8 + 24, tall = H > W * 1.05;
      vert = tall && P.portrait === 'hang'; asp = vert ? 1 / 1.9 : 1.9;
      const over = vert ? 1.06 : 1.06 + .14 * P.droop;                                    // room for droop and foreshortening
      if (P.fit === 'contain') fh = Math.min(H, W / asp) * .86 * P.zoom;
      else if (tall && P.portrait === 'width') fh = (bw + 2 * mgn) / asp * P.zoom;          // the whole flag across the screen
      else fh = Math.max(bh + 2 * mgn, (bw + 2 * mgn) / asp) * P.zoom * over;
      fw = fh * asp;
      Lf = vert ? fh : fw; Wf = vert ? fw : fh;          // the cloth as a strip: Lf along the wind from the attached edge, Wf across
    }
    function buildTex() {
      const A = Math.round(Math.min(1400, Math.max(390, Math.min(fw, fh) * dpr)) / 13) * 13, key = [A, vert, P.baseSat, P.baseContrast, P.baseBright, P.boostSat, P.boostContrast, P.boostBright].join('|');
      if (key === texKey) return; texKey = key;
      for (const [tc, s, c2, b] of [[texG, P.baseSat, P.baseContrast, P.baseBright], [texC, P.boostSat, P.boostContrast, P.boostBright]]) {
        tc.width = Math.round(A * 1.9); tc.height = A;
        const g2 = tc.getContext('2d');
        if (!vert) paintFlag(g2, A, tone(RED, s, c2, b), tone(WHITE, s, c2, b), tone(BLUE, s, c2, b), false);
        else {                                               // paint upright, then store turned so the top edge runs along the left
          const tmp = document.createElement('canvas'); tmp.width = A; tmp.height = Math.round(A * 1.9);
          paintFlag(tmp.getContext('2d'), A, tone(RED, s, c2, b), tone(WHITE, s, c2, b), tone(BLUE, s, c2, b), true);
          g2.setTransform(0, -1, 1, 0, 0, A); g2.drawImage(tmp, 0, 0); g2.setTransform(1, 0, 0, 1, 0, 0);
        }
      }
    }
    function resize() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      while (W * H * dpr * dpr > 9e6 && dpr > 1) dpr -= .25;
      cv.width = cl.width = Math.round(W * dpr); cv.height = cl.height = Math.round(H * dpr);
      mk.width = Math.max(2, Math.round(W * ms)); mk.height = Math.max(2, Math.round(H * ms));
      shCv.width = Math.max(2, Math.round(W * dpr * .5)); shCv.height = Math.max(2, Math.round(H * dpr * .5));
      k = Math.min(1.5, Math.max(.6, Math.min(W, H * 1.6) / 1200));
      if (!m.x && !m.y) { m.x = sm.x = W * .6; m.y = sm.y = H * .45; }
      layout(); buildTex();
      if (!raf) drawOnce();
    }

    /* Cloth model, on the strip: x runs from the attached edge (the hoist, or the top of a hung flag) to the free end.
       z(x) is how far the cloth bulges toward the viewer. Waves travel toward the free end and grow along the way;
       the top and bottom edges see the wave slightly out of phase, which makes the folds run diagonally.
       Seen from slightly below, bulges show as vertical movement; cloth turned away from the viewer foreshortens. */
    function zAt(x) {
      const u = Math.max(0, Math.min(1, x / Lf)), kx = 2 * Math.PI / (Lf * .3 * P.wave), w = t * 2.2;
      const A = P.idleAmp * k * 2.1 * Math.pow(u, 1.25) * gustAmp * (vert ? .6 : 1);
      let z = A * (Math.sin(kx * x - w) + .45 * Math.sin(2.3 * kx * x - 1.7 * w + 1.1) + .18 * Math.sin(4.1 * kx * x - 2.9 * w + 2));
      z += A * .3 * Math.pow(u, 4) * Math.sin(kx * x * 3.7 - w * 2.6);                 // flutter at the free end
      const g = Math.exp(-((x - wx) * (x - wx)) / (2 * Math.pow(260 * k, 2)));
      return z + P.boost * energy * g * 28 * k * u * Math.sin(x * .012 - t * 3);
    }
    function cloth(n) {
      const cw = Lf / n, phi = Lf * .035, X = new Float32Array(n + 1), T = new Float32Array(n + 1), B = new Float32Array(n + 1), ST = new Float32Array(n + 1), SB = new Float32Array(n + 1);
      const zt = new Float32Array(n + 1), zb = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) { zt[i] = zAt(i * cw - phi); zb[i] = zAt(i * cw + phi); }
      const view = .42 * P.fold, dro = vert ? 0 : P.droop * Wf * .13;
      for (let i = 0; i <= n; i++) {
        const u = i / n, j0 = Math.max(0, i - 1), j1 = Math.min(n, i + 1), d = (j1 - j0) * cw;
        const st = (zt[j1] - zt[j0]) / d, sb = (zb[j1] - zb[j0]) / d;
        if (i) { const s2 = ((zt[i] - zt[i - 1]) + (zb[i] - zb[i - 1])) / (2 * cw) * P.fold; X[i] = X[i - 1] + cw / Math.sqrt(1 + s2 * s2 * .8); }
        const sag = dro * Math.pow(u, 2.2), zc = (zt[i] + zb[i]) / 2;
        // geometry follows the mean bulge (so slices meet exactly); the top/bottom phase difference only drives the shading
        T[i] = zc * view + sag; B[i] = Wf + zc * view + sag * .72;                           // the free end sags, and narrows a little
        ST[i] = -st * P.shade; SB[i] = -sb * P.shade;
      }
      return { n, cw, X, T, B, ST, SB };
    }
    const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
    // Visual flag (fw x fh, upright) -> screen. The screen centre (plus shift) shows flag point p.
    function visualMatrix() {
      const a = P.tilt * RAD, cs = Math.cos(a), sn = Math.sin(a), ox = W / 2 + P.offX * W, oy = H / 2 + P.offY * H;
      let px = fw / 2, py = fh / 2;
      if (P.focus === 'canton' && P.fit === 'cover') { const mg = P.idleAmp * k * 1.8 + 24; px = Math.min(fw / 2, W / 2 + mg + W * .04); py = Math.min(fh / 2, H / 2 + mg + H * .04); }
      return [cs, sn, -sn, cs, ox - (cs * px - sn * py), oy - (sn * px + cs * py)];
    }
    // Strip -> screen. For a hung flag the strip runs down from the top edge: x_visual = fw - y_strip, y_visual = x_strip.
    function flagMatrix() { const M = visualMatrix(); return vert ? mul(M, [0, 1, -1, 0, fw, 0]) : M; }
    function toFlag(x, y) { const M = visualMatrix(), dx = x - M[4], dy = y - M[5], vx = dx * M[0] + dy * M[1], vy = -dx * M[1] + dy * M[0]; return vert ? [vy, fw - vx] : [vx, vy]; }

    // One slice per node pair: scaled along x (foreshortening), sheared to follow the top edge, scaled to the local height.
    function drawFlag(c, tex, M, G, box, edges, scale) {
      const S2 = scale || dpr, sx = (edges ? tex.width - 1 : tex.width) / Lf, so = edges ? .5 : 0;
      for (let i = 0; i < G.n; i++) {
        const x0 = G.X[i], x1 = G.X[i + 1], ys = [G.T[i], G.T[i + 1], G.B[i], G.B[i + 1]], xs = [x0, x1, x0, x1];
        let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
        for (let q = 0; q < 4; q++) { const X = M[0] * xs[q] + M[2] * ys[q] + M[4], Y = M[1] * xs[q] + M[3] * ys[q] + M[5]; if (X < mnx) mnx = X; if (X > mxx) mxx = X; if (Y < mny) mny = Y; if (Y > mxy) mxy = Y; }
        if (mxx < box[0] || mnx > box[2] || mxy < box[1] || mny > box[3]) continue;
        const a = (x1 - x0) / G.cw, b = (G.T[i + 1] - G.T[i]) / G.cw, d = ((G.B[i] - G.T[i]) + (G.B[i + 1] - G.T[i + 1])) / 2 / Wf;
        const L = mul(M, [a, b, 0, d, x0, G.T[i]]);
        c.setTransform(S2 * L[0], S2 * L[1], S2 * L[2], S2 * L[3], S2 * L[4], S2 * L[5]);
        c.drawImage(tex, i * G.cw * sx + so, 0, Math.max(edges ? .01 : 1, G.cw * sx), tex.height, 0, 0, G.cw + .7 / Math.max(.2, a), Wf);
      }
    }

    function updateMask(dt, now) {
      const R = P.radius * k, inner = Math.max(0, .9 - P.soft * .9);
      mx.setTransform(ms, 0, 0, ms, 0, 0);
      const grow = (x, y, r) => { mb = mb ? [Math.min(mb[0], x - r), Math.min(mb[1], y - r), Math.max(mb[2], x + r), Math.max(mb[3], y + r)] : [x - r, y - r, x + r, y + r]; };
      const spot = (x, y, r, a) => { const g = mx.createRadialGradient(x, y, r * inner, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); mx.fillStyle = g; mx.fillRect(x - r, y - r, r * 2, r * 2); grow(x, y, r); };
      if (P.mode !== 'trail') mb = null;
      mx.globalCompositeOperation = 'source-over';
      if (P.mode === 'spot') { mx.clearRect(0, 0, W, H); if (gi > .01) spot(sm.x, sm.y, R, gi); }
      else if (P.mode === 'trail') {
        mx.globalCompositeOperation = 'destination-out'; mx.fillStyle = 'rgba(0,0,0,' + (1 - Math.exp(-dt / P.fade)) + ')'; mx.fillRect(0, 0, W, H);
        mx.globalCompositeOperation = 'source-over'; if (active) { spot(sm.x, sm.y, R, Math.min(1, dt * 7)); lastPaint = now; }
        else if (mb && now - lastPaint > P.fade * 6000) { mb = null; mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, mk.width, mk.height); }
      } else if (P.mode === 'ripple') {
        mx.clearRect(0, 0, W, H);
        if (active && (!lastRing || Math.hypot(m.x - lastRing[0], m.y - lastRing[1]) > R * .45 || now - lastRing[2] > 900)) { rings.push({ x: m.x, y: m.y, t0: now }); lastRing = [m.x, m.y, now]; }
        const life = P.fade * 1000;
        rings = rings.filter(r => now - r.t0 < life);
        for (const r of rings) {
          const age = (now - r.t0) / life, rr = R * (.3 + age * 2.2), w = R * (.25 + .25 * P.soft), a = (1 - age) * (1 - age);
          const g = mx.createRadialGradient(r.x, r.y, Math.max(0, rr - w), r.x, r.y, rr + w);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mx.fillStyle = g; mx.fillRect(r.x - rr - w, r.y - rr - w, (rr + w) * 2, (rr + w) * 2); grow(r.x, r.y, rr + w);
        }
        if (gi > .01) spot(sm.x, sm.y, R * .55, .7 * gi);
      } else mx.clearRect(0, 0, W, H);
    }

    function step(now, dt) {
      gT += dt;
      const gv = (Math.sin(gT * .21) + .6 * Math.sin(gT * .53 + 2) + .3 * Math.sin(gT * 1.1 + 4)) / 1.9;
      gustAmp = 1 + P.gust * .6 * gv;
      t += dt * P.idleSpeed * (1 + P.gust * .5 * gv) * (reduce ? 0 : 1);
      raw *= Math.exp(-dt / .4); energy += (raw - energy) * (1 - Math.exp(-dt / (raw > energy ? .8 : 1.6)));
      if ((P.autopilot || coarse) && !reduce && now - lastMove > 3000) {
        const a = now / 1000; active = true;
        m.x = W * (.5 + .36 * Math.sin(a * .31)); m.y = H * (.5 + .3 * Math.sin(a * .47 + 1)); raw = Math.max(raw, .25);
      }
      const e = 1 - Math.exp(-dt * P.lag); sm.x += (m.x - sm.x) * e; sm.y += (m.y - sm.y) * e;
      gi += ((active ? 1 : 0) - gi) * (1 - Math.exp(-dt / .35));
      wx += (toFlag(sm.x, sm.y)[0] - wx) * (1 - Math.exp(-dt / .8));
      updateMask(dt, now);
    }

    function draw() {
      const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      const M = flagMatrix(), G = cloth(Math.min(600, Math.max(60, Math.ceil(Lf / 8))));
      drawFlag(c, texG, M, G, [-4, -4, W + 4, H + 4]);
      if (P.mode !== 'none' && mb) {                          // vivid flag, masked to where the pointer has been; only inside the mask's box
        const bx = Math.max(0, Math.floor(mb[0])), by = Math.max(0, Math.floor(mb[1])), bx1 = Math.min(W, Math.ceil(mb[2])), by1 = Math.min(H, Math.ceil(mb[3]));
        if (bx1 > bx && by1 > by) {
          const px = Math.floor(bx * dpr), py = Math.floor(by * dpr), pw = Math.ceil((bx1 - bx) * dpr) + 1, ph = Math.ceil((by1 - by) * dpr) + 1;
          cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'source-over'; cx.clearRect(px, py, pw, ph);
          cx.save(); cx.beginPath(); cx.rect(px, py, pw, ph); cx.clip();
          drawFlag(cx, texC, M, G, [bx, by, bx1, by1]);
          cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.globalCompositeOperation = 'destination-in'; cx.drawImage(mk, 0, 0, W, H);
          cx.restore(); cx.globalCompositeOperation = 'source-over';
          c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cl, px, py, pw, ph, px, py, pw, ph); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
      if (P.shade > 0) {                                     // folds: an opaque gray shade map (50% gray = no change), overlay-blended
        const R = 16, nw = G.n + 1;                          // one pixel per slice edge; each slice samples between its two edges
        if (shTex.width !== nw || shTex.height !== R) { shTex.width = nw; shTex.height = R; shImg = shTex.getContext('2d').createImageData(nw, R); }
        const d = shImg.data;
        for (let i = 0; i < nw; i++) for (let j = 0; j < R; j++) {
          const v = G.ST[i] + (G.SB[i] - G.ST[i]) * (j + .5) / R, o = (j * nw + i) * 4;
          d[o] = d[o + 1] = d[o + 2] = 128 + Math.max(-60, Math.min(34, v * 190)); d[o + 3] = 255;
        }
        shTex.getContext('2d').putImageData(shImg, 0, 0);
        const ss = dpr * .5;
        shCx.setTransform(1, 0, 0, 1, 0, 0); shCx.fillStyle = '#808080'; shCx.fillRect(0, 0, shCv.width, shCv.height);
        drawFlag(shCx, shTex, M, G, [-4, -4, W + 4, H + 4], true, ss);
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'overlay'; c.drawImage(shCv, 0, 0, cv.width, cv.height);
        c.globalCompositeOperation = 'source-over'; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (P.glow > 0 && gi > .01 && P.mode !== 'none') {
        const R = P.radius * k * 1.3, g = c.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, R);
        g.addColorStop(0, 'rgba(255,255,255,' + (.18 * P.glow * gi) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
      }
    }
    function drawOnce() { step(performance.now(), .016); draw(); }
    function loop(now) {
      raf = 0; if (!visible || document.hidden) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now; step(now, dt); draw(); raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    function onMove(e) {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      raw = Math.min(1, raw + Math.hypot(x - m.x, y - m.y) / 120); m.x = x; m.y = y; lastMove = performance.now(); active = true;
    }
    function onDown(e) { onMove(e); if (P.mode === 'ripple') { rings.push({ x: m.x, y: m.y, t0: performance.now() }); lastRing = [m.x, m.y, performance.now()]; } }
    function onOut(e) { if (!e.relatedTarget) active = false; }
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('mouseout', onOut);
    document.addEventListener('visibilitychange', start);
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }); io.observe(el);
    applyBg(); resize(); start();

    return {
      update(next) {
        const geo = ['fit', 'zoom', 'tilt', 'idleAmp', 'portrait', 'droop'].some(q => next[q] !== undefined && next[q] !== P[q]);
        Object.assign(P, next); applyBg();
        if (geo) layout(); buildTex();
        if (geo) { mb = null; }
        if (next.mode !== undefined) { rings = []; mb = null; mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, mk.width, mk.height); }
        if (!raf) drawOnce();
      },
      destroy() {
        cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect();
        removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown);
        document.removeEventListener('mouseout', onOut); document.removeEventListener('visibilitychange', start);
        cv.remove();
      }
    };
  }

  window.Effects = window.Effects || {};
  window.Effects.oldglory = { name: 'Old Glory', params, defaults, mount, paintFlag };
})();
