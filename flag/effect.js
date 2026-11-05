/* Waving flag background. Self-contained: no dependencies.
   Effects.flag.mount(element, config) -> { update(config), destroy() } */
(function () {
  const params = [
    { group: 'Colors', key: 'bg', label: 'Background', type: 'color', def: '#0e1420' },
    { key: 'stripeColor', label: 'Stripe color', type: 'color', def: '#ffffff' },
    { key: 'starColor', label: 'Star color', type: 'color', def: '#ffffff' },
    { group: 'Flag', key: 'idleAmp', label: 'Idle wave', min: 0, max: 30, step: .5, def: 22 },
    { key: 'idleSpeed', label: 'Idle speed', min: 0, max: 2, step: .01, def: .5 },
    { key: 'gust', label: 'Gusts', min: 0, max: 1, step: .05, def: .8 },
    { key: 'wave', label: 'Wavelength', min: .5, max: 2, step: .05, def: 1 },
    { key: 'stripeSize', label: 'Stripe size', min: 30, max: 200, step: 1, def: 137 },
    { key: 'tilt', label: 'Tilt (deg)', min: -25, max: 25, step: .5, def: -8 },
    { key: 'contrast', label: 'Stripe contrast', min: 0, max: .2, step: .005, def: .045 },
    { key: 'shading', label: 'Shading on', type: 'toggle', def: true },
    { key: 'shade', label: 'Fold shading', min: 0, max: 2, step: .05, def: .6 },
    { group: 'Mouse', key: 'boost', label: 'Wave boost', min: 0, max: 3, step: .05, def: .5 },
    { key: 'response', label: 'Response time (s)', min: .2, max: 5, step: .1, def: 1 },
    { key: 'radius', label: 'Reveal radius', min: 80, max: 500, step: 5, def: 115 },
    { key: 'ease', label: 'Trail (low = longer)', min: .01, max: .3, step: .005, def: .06 },
    { key: 'push', label: 'Star push', min: 0, max: 40, step: 1, def: 0 },
    { key: 'autopilot', label: 'Wander when idle', type: 'toggle', def: false },
    { group: 'Stars', key: 'stars', label: 'Stars on', type: 'toggle', def: true },
    { key: 'density', label: 'Density', min: 1, max: 14, step: .5, def: 6 },
    { key: 'starSize', label: 'Star size', min: 6, max: 40, step: 1, def: 22 },
    { key: 'starAlpha', label: 'Brightness', min: .1, max: 1, step: .05, def: .4 },
    { key: 'spin', label: 'Spin', min: 0, max: 2, step: .05, def: 0 }
  ];
  const defaults = {};
  params.forEach(p => { defaults[p.key] = p.def; });

  const rgb = h => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); };
  const star = new Path2D();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? .4 : 1, a = -Math.PI / 2 + i * Math.PI / 5;
    i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();

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

    let W = 1, H = 1, dpr = 1, diag = 1, k = 1, stars = [], raf = 0, last = 0, visible = true;
    const m = { x: 0, y: 0 }, sm = { x: 0, y: 0 };
    let lastMove = -1e9, energy = 0, raw = 0, wx = 0, gT = 0, gustAmp = 1, t = 0, t2 = 0, lx = 0, ly = 0;
    const edges = [];

    function applyBg() { el.style.background = P.bg; }
    function buildStars() {
      stars = [];
      const cell = Math.sqrt(1e5 / P.density) * k, n = Math.ceil(diag / cell), half = diag / 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) stars.push({
        x: -half + (i + Math.random()) * cell, y: -half + (j + Math.random()) * cell,
        s: .6 + Math.random() * .8, r: Math.random() * 6.28, sp: (Math.random() - .5) * 2, o: 0
      });
    }
    function resize() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      while (W * H * dpr * dpr > 9e6 && dpr > 1) dpr -= .25;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      diag = Math.hypot(W, H) + 40;
      k = Math.min(1.5, Math.max(.6, W / 1440));
      if (!m.x && !m.y) { m.x = sm.x = W * .6; m.y = sm.y = H * .4; }
      buildStars();
      if (!raf) drawOnce();
    }

    function offAt(x, y) {
      const u = (x + diag / 2) / diag;
      const env = .25 + .75 * Math.pow(u, 1.2);
      const kx = .004 / P.wave, f = 1 + .6 * u;
      const a = Math.sin(x * kx * f - t + y * .0035);
      const b = .5 * Math.sin(x * kx * 2.1 * f - t * 1.7 + y * .006 + 1.3);
      const c = .22 * Math.sin(x * kx * 4.3 * f - t * 2.9 - y * .004 + 2.1);
      const lift = .6 * Math.sin(x * .0011 - t * .35 + .5);
      const idle = P.idleAmp * k * env * gustAmp * (a + b + c + lift);
      const g = Math.exp(-((x - wx) * (x - wx)) / (2 * 260 * 260 * k * k));
      const mo = P.boost * energy * g * 22 * k * Math.sin(x * .012 - t2 * 3 + y * .003);
      return idle + mo;
    }

    function step(now, dt) {
      gT += dt;
      const gv = (Math.sin(gT * .21) + .6 * Math.sin(gT * .53 + 2) + .3 * Math.sin(gT * 1.1 + 4)) / 1.9;
      gustAmp = 1 + P.gust * .6 * gv;
      t += dt * P.idleSpeed * (1 + P.gust * .5 * gv) * (reduce ? 0 : 1);
      raw *= Math.exp(-dt / .4);
      const tau = P.response * (raw > energy ? 1 : 1.8);
      energy += (raw - energy) * (1 - Math.exp(-dt / tau));
      t2 += dt * (.3 + energy * 1.2);
      if ((P.autopilot || coarse) && now - lastMove > 3000) {
        const a = now / 1000;
        m.x = W * (.5 + .35 * Math.sin(a * .31)); m.y = H * (.5 + .3 * Math.sin(a * .47 + 1));
        raw = Math.max(raw, .25);
      }
      sm.x += (m.x - sm.x) * P.ease; sm.y += (m.y - sm.y) * P.ease;
      const ang = P.tilt * Math.PI / 180, c = Math.cos(ang), s = Math.sin(ang);
      const dx = sm.x - W / 2, dy = sm.y - H / 2;
      lx = dx * c + dy * s; ly = -dx * s + dy * c;
      wx += (lx - wx) * (1 - Math.exp(-dt / tau));
      return ang;
    }

    function draw(ang, dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2); ctx.rotate(ang);
      const half = diag / 2, sw = Math.max(4, Math.round(diag / 320)), n = Math.ceil(diag / sw), sh = P.stripeSize * k;
      const k0 = Math.floor(-half / sh) - 1, k1 = Math.ceil(half / sh) + 1, rows = k1 - k0 + 2;
      while (edges.length < rows) edges.push(new Float32Array(0));
      for (let r = 0; r < rows; r++) {
        if (edges[r].length !== n + 1) edges[r] = new Float32Array(n + 1);
        const e = edges[r], y = (k0 + r) * sh;
        for (let i = 0; i <= n; i++) e[i] = offAt(-half + i * sw, y);
      }
      ctx.fillStyle = 'rgba(' + rgb(P.stripeColor) + ',' + P.contrast + ')';
      for (let q = k0; q <= k1; q++) {
        if (q & 1) continue;
        const e1 = edges[q - k0], e2 = edges[q - k0 + 1];
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const x = -half + i * sw, y = q * sh + e1[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        for (let i = n; i >= 0; i--) ctx.lineTo(-half + i * sw, (q + 1) * sh + e2[i]);
        ctx.closePath(); ctx.fill();
      }
      if (P.shading && P.shade > 0) {
        for (let q = k0; q <= k1; q++) {
          const e1 = edges[q - k0], e2 = edges[q - k0 + 1];
          // one gradient per band: continuous, so no seams between slices
          const gw = ctx.createLinearGradient(-half, 0, half, 0), gb = ctx.createLinearGradient(-half, 0, half, 0);
          for (let i = 0; i < n; i += 2) {
            const sl = (e1[i + 1] - e1[i]) / sw * P.shade * .6, a = Math.min(.12, Math.abs(sl)), pos = i / n;
            gw.addColorStop(pos, 'rgba(255,255,255,' + (sl > 0 ? a : 0) + ')');
            gb.addColorStop(pos, 'rgba(0,0,0,' + (sl < 0 ? a * 1.4 : 0) + ')');
          }
          ctx.beginPath();
          for (let i = 0; i <= n; i++) { const x = -half + i * sw, y = q * sh + e1[i]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          for (let i = n; i >= 0; i--) ctx.lineTo(-half + i * sw, (q + 1) * sh + e2[i]);
          ctx.closePath();
          ctx.fillStyle = gw; ctx.fill(); ctx.fillStyle = gb; ctx.fill();
        }
      }
      if (P.stars) {
        const R = P.radius * k, col = rgb(P.starColor), size = P.starSize * k;
        for (const st of stars) {
          const wy = st.y + offAt(st.x, st.y), ddx = st.x - lx, ddy = wy - ly, d = Math.hypot(ddx, ddy);
          const f = d < R ? Math.pow(1 - d / R, 1.5) : 0;
          st.o += (f * P.starAlpha - st.o) * Math.min(1, P.ease * 1.2 + .02);
          if (st.o < .01) continue;
          st.r += dt * st.sp * P.spin * (.3 + f * 2);
          const push = d > 1 ? P.push * k * f / d : 0, sc = size * st.s * (.7 + f * .5);
          ctx.save();
          ctx.translate(st.x + ddx * push, wy + ddy * push);
          ctx.rotate(st.r); ctx.scale(sc, sc);
          ctx.fillStyle = 'rgba(' + col + ',' + st.o + ')'; ctx.fill(star);
          ctx.restore();
        }
      }
    }
    function drawOnce() { draw(step(performance.now(), 0.016), 0.016); }

    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      draw(step(now, dt), dt);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } }

    function onMove(e) {
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      raw = Math.min(1, raw + Math.hypot(x - m.x, y - m.y) / 120);
      m.x = x; m.y = y; lastMove = performance.now();
    }
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', start);
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }); io.observe(el);

    applyBg(); resize(); start();

    return {
      update(next) {
        const dens = next.density !== undefined && next.density !== P.density;
        Object.assign(P, next); applyBg();
        if (dens) buildStars();
        if (!raf) drawOnce();
      },
      destroy() {
        cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect();
        removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', start);
        cv.remove();
      }
    };
  }

  window.Effects = window.Effects || {};
  window.Effects.flag = { name: 'Waving flag', params, defaults, mount };
})();
