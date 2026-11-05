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
    { group: 'Wave', key: 'idleAmp', label: 'Idle wave', min: 0, max: 40, step: .5, def: 16 },
    { key: 'idleSpeed', label: 'Idle speed', min: 0, max: 2, step: .01, def: .55 },
    { key: 'gust', label: 'Gusts', min: 0, max: 1, step: .05, def: .6 },
    { key: 'wave', label: 'Wavelength', min: .5, max: 2, step: .05, def: 1 },
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
    { key: 'fade', label: 'Fade back (s)', min: .2, max: 8, step: .1, def: 1.8 },
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
    const texG = document.createElement('canvas'), texC = document.createElement('canvas');

    let W = 1, H = 1, dpr = 1, k = 1, fw = 1, fh = 1, asp = 1.9, vert = false, ms = .25, raf = 0, last = 0, visible = true, texKey = '';
    const m = { x: 0, y: 0 }, sm = { x: 0, y: 0 };
    let active = false, lastMove = -1e9, raw = 0, energy = 0, t = 0, gT = 0, gustAmp = 1, wx = 0, gi = 0, rings = [], lastRing = null;
    let mb = null, lastPaint = -1e9;                        // screen-space box around everything the mask currently shows

    function applyBg() { el.style.background = P.bg; }
    function layout() {
      const a = P.tilt * RAD, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
      const bw = W * ca + H * sa, bh = W * sa + H * ca, mgn = P.idleAmp * k * 1.8 + 24, tall = H > W * 1.05;
      vert = tall && P.portrait === 'hang'; asp = vert ? 1 / 1.9 : 1.9;
      if (P.fit === 'contain') fh = Math.min(H, W / asp) * .86 * P.zoom;
      else if (tall && P.portrait === 'width') fh = (bw + 2 * mgn) / asp * P.zoom;          // the whole flag across the screen
      else fh = Math.max(bh + 2 * mgn, (bw + 2 * mgn) / asp) * P.zoom;
      fw = fh * asp;
    }
    function buildTex() {
      const A = Math.round(Math.min(1400, Math.max(390, Math.min(fw, fh) * dpr)) / 13) * 13, key = [A, vert, P.baseSat, P.baseContrast, P.baseBright, P.boostSat, P.boostContrast, P.boostBright].join('|');
      if (key === texKey) return; texKey = key;
      for (const [tc, s, c2, b] of [[texG, P.baseSat, P.baseContrast, P.baseBright], [texC, P.boostSat, P.boostContrast, P.boostBright]]) {
        tc.width = Math.round(vert ? A : A * 1.9); tc.height = Math.round(vert ? A * 1.9 : A);
        paintFlag(tc.getContext('2d'), A, tone(RED, s, c2, b), tone(WHITE, s, c2, b), tone(BLUE, s, c2, b), vert);
      }
    }
    function resize() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      while (W * H * dpr * dpr > 9e6 && dpr > 1) dpr -= .25;
      cv.width = cl.width = Math.round(W * dpr); cv.height = cl.height = Math.round(H * dpr);
      mk.width = Math.max(2, Math.round(W * ms)); mk.height = Math.max(2, Math.round(H * ms));
      k = Math.min(1.5, Math.max(.6, Math.min(W, H * 1.6) / 1200));
      if (!m.x && !m.y) { m.x = sm.x = W * .6; m.y = sm.y = H * .45; }
      layout(); buildTex();
      if (!raf) drawOnce();
    }

    /* the flag is attached on the left (hoist) and the wave grows toward the fly end */
    function wave(x) {
      const u = Math.max(0, Math.min(1, x / fw)), env = .2 + .8 * Math.pow(u, 1.1), kx = 2 * Math.PI / (fw * .32 * P.wave);
      const a = Math.sin(x * kx - t), b = .5 * Math.sin(x * kx * 2.1 - t * 1.7 + 1.3), c = .22 * Math.sin(x * kx * 4.3 - t * 2.9 + 2.1);
      const idle = P.idleAmp * k * env * gustAmp * (a + b + c + .5 * Math.sin(x * kx * .4 - t * .35 + .5));
      const g = Math.exp(-((x - wx) * (x - wx)) / (2 * Math.pow(260 * k, 2)));
      return idle + P.boost * energy * g * 20 * k * Math.sin(x * .012 - t * 3);
    }
    // flag-local coordinates -> screen
    // The screen centre (plus shift) shows flag point p: the middle of the flag, or with focus on the stars, the top-left part.
    function flagMatrix() {
      const a = P.tilt * RAD, cs = Math.cos(a), sn = Math.sin(a), ox = W / 2 + P.offX * W, oy = H / 2 + P.offY * H;
      let px = fw / 2, py = fh / 2;
      if (P.focus === 'canton' && P.fit === 'cover') { const mg = P.idleAmp * k * 1.8 + 24; px = Math.min(fw / 2, W / 2 + mg + W * .04); py = Math.min(fh / 2, H / 2 + mg + H * .04); }
      return [cs, sn, -sn, cs, ox - (cs * px - sn * py), oy - (sn * px + cs * py)];
    }
    function toFlag(x, y) { const M = flagMatrix(), dx = x - M[4], dy = y - M[5]; return [dx * M[0] + dy * M[1], -dx * M[1] + dy * M[0]]; }

    // Each slice is sheared so its edges meet the neighbouring slices exactly (a piecewise-linear warp, no stair steps).
    // Slices outside `box` (screen space) are skipped.
    function drawFlag(c, tex, M, cols, box) {
      const sx = tex.width / fw, n = cols.length - 1, cw = fw / n;
      for (let i = 0; i < n; i++) {
        const x0 = i * cw, x1 = x0 + cw, y0 = Math.min(cols[i], cols[i + 1]), y1 = Math.max(cols[i], cols[i + 1]) + fh;
        const X = [M[0] * x0 + M[2] * y0, M[0] * x1 + M[2] * y0, M[0] * x0 + M[2] * y1, M[0] * x1 + M[2] * y1];
        const Y = [M[1] * x0 + M[3] * y0, M[1] * x1 + M[3] * y0, M[1] * x0 + M[3] * y1, M[1] * x1 + M[3] * y1];
        if (Math.max(...X) + M[4] < box[0] || Math.min(...X) + M[4] > box[2] || Math.max(...Y) + M[5] < box[1] || Math.min(...Y) + M[5] > box[3]) continue;
        const sl = (cols[i + 1] - cols[i]) / cw, tt = cols[i] - sl * x0;
        c.setTransform(dpr * (M[0] + M[2] * sl), dpr * (M[1] + M[3] * sl), dpr * M[2], dpr * M[3], dpr * (M[2] * tt + M[4]), dpr * (M[3] * tt + M[5]));
        c.drawImage(tex, x0 * sx, 0, Math.max(1, cw * sx), tex.height, x0, 0, cw + .6, fh);
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
      const M = flagMatrix(), n = Math.min(600, Math.max(60, Math.ceil(fw / 8))), cw = fw / n, cols = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) cols[i] = wave(i * cw);
      drawFlag(c, texG, M, cols, [-4, -4, W + 4, H + 4]);
      if (P.mode !== 'none' && mb) {                          // vivid flag, masked to where the pointer has been; only inside the mask's box
        const bx = Math.max(0, Math.floor(mb[0])), by = Math.max(0, Math.floor(mb[1])), bx1 = Math.min(W, Math.ceil(mb[2])), by1 = Math.min(H, Math.ceil(mb[3]));
        if (bx1 > bx && by1 > by) {
          const px = Math.floor(bx * dpr), py = Math.floor(by * dpr), pw = Math.ceil((bx1 - bx) * dpr) + 1, ph = Math.ceil((by1 - by) * dpr) + 1;
          cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'source-over'; cx.clearRect(px, py, pw, ph);
          cx.save(); cx.beginPath(); cx.rect(px, py, pw, ph); cx.clip();
          drawFlag(cx, texC, M, cols, [bx, by, bx1, by1]);
          cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.globalCompositeOperation = 'destination-in'; cx.drawImage(mk, 0, 0, W, H);
          cx.restore(); cx.globalCompositeOperation = 'source-over';
          c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cl, px, py, pw, ph, px, py, pw, ph); c.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
      if (P.shade > 0) {                                     // folds: one smooth gradient across the flag, clipped to its outline
        c.setTransform(dpr * M[0], dpr * M[1], dpr * M[2], dpr * M[3], dpr * M[4], dpr * M[5]);
        c.save(); c.beginPath();
        for (let i = 0; i <= n; i++) i ? c.lineTo(i * cw, cols[i]) : c.moveTo(0, cols[0]);
        for (let i = n; i >= 0; i--) c.lineTo(i * cw, cols[i] + fh);
        c.closePath(); c.clip();
        const gl = c.createLinearGradient(0, 0, fw, 0), gd = c.createLinearGradient(0, 0, fw, 0), step = Math.max(1, Math.floor(n / 160));
        for (let i = 0; i < n; i += step) {
          const j = Math.min(n, i + step), sl = (cols[j] - cols[i]) / (cw * (j - i)) * P.shade * .9, a = Math.min(.16, Math.abs(sl)), pos = i / n;
          gl.addColorStop(pos, 'rgba(255,255,255,' + (sl > 0 ? a : 0).toFixed(3) + ')');
          gd.addColorStop(pos, 'rgba(0,0,0,' + (sl < 0 ? Math.min(.3, a * 1.6) : 0).toFixed(3) + ')');
        }
        const y0 = Math.min(...cols) - 2, y1 = Math.max(...cols) + fh + 2;
        c.fillStyle = gl; c.fillRect(0, y0, fw, y1 - y0); c.fillStyle = gd; c.fillRect(0, y0, fw, y1 - y0);
        c.restore(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
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
        const geo = ['fit', 'zoom', 'tilt', 'idleAmp', 'portrait'].some(q => next[q] !== undefined && next[q] !== P[q]);
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
