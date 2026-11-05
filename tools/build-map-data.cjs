/* Regenerates the map data block inside nightmap/effect.js.
   Not part of the site and not needed to deploy. Only run it to change the map data.

     cd tools && npm i us-atlas@3 world-atlas@2 topojson-client@3 topojson-simplify@3
     node build-map-data.cjs

   Data: us-atlas (US Census) and world-atlas (Natural Earth). Both public domain.
   Output: three layers (US states, European countries, surrounding land), simplified and
   packed as lon/lat in 0.01 degree steps, delta + zigzag + base64-style varints. */
const fs = require('fs'), path = require('path');
const tc = require('topojson-client'), ts = require('topojson-simplify');
const US = require('us-atlas/states-10m.json'), WORLD = require('world-atlas/countries-50m.json');

const EUROPE = ['Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macedonia', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'Norway', 'Poland',
  'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'Ukraine',
  'United Kingdom', 'Vatican'];
const RENAME = { 'Bosnia and Herz.': 'Bosnia & Herzegovina', 'Macedonia': 'North Macedonia' };
const W = { states: +process.env.W_STATES || 8e-7, eu: +process.env.W_EU || 1e-6, ctx: +process.env.W_CTX || 1e-5 };
const MINRING = { states: 4e-7, eu: 3e-7, ctx: 4e-6 };      // steradians; smaller rings (tiny islands) are dropped

const clone = o => JSON.parse(JSON.stringify(o));
function simp(topo, w) { const t = ts.presimplify(clone(topo), ts.sphericalTriangleArea); return ts.simplify(t, w); }
function ringArea(r) {          // approx. spherical area in sr of a lon/lat ring (planar * cos(lat)), absolute
  let a = 0, lat = 0; for (let i = 0; i < r.length - 1; i++) { a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; lat += r[i][1]; }
  const k = Math.PI / 180; return Math.abs(a / 2) * k * k * Math.cos(lat / (r.length - 1) * k);
}
function ringsOf(geom) {
  if (!geom) return [];
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  const out = []; polys.forEach(p => p.forEach((r, i) => out.push({ r, hole: i > 0 })));
  return out;
}
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function varint(n, out) { n = n < 0 ? (-n << 1) - 1 : n << 1; do { let d = n & 31; n >>>= 5; if (n) d |= 32; out.push(AL[d]); } while (n); }
function packRing(r) {
  const out = []; let px = 0, py = 0, prev = null, n = 0;
  for (const p of r) {
    const x = Math.round(p[0] * 100), y = Math.round(p[1] * 100);
    if (prev && x === prev[0] && y === prev[1]) continue;       // drop duplicate after rounding
    varint(x - px, out); varint(y - py, out); px = x; py = y; prev = [x, y]; n++;
  }
  return { s: out.join(''), n };
}
let stats = {};
function packFeatures(name, feats, minRing) {
  let pts = 0, rings = 0;
  const parts = feats.map(f => {
    const rs = ringsOf(f.geometry).filter(o => o.hole || ringArea(o.r) >= minRing || ringsOf(f.geometry).length === 1);
    // keep the largest ring always so no feature vanishes
    const packed = rs.map(o => packRing(o.r)).filter(p => p.n >= 3);
    packed.forEach(p => { pts += p.n; rings++; });
    return f.name + '~' + packed.map(p => p.s).join(',');
  });
  stats[name] = { features: feats.length, rings, points: pts };
  return parts.join(';');
}

// US states (50 + DC)
const usT = simp(US, W.states);
const usFeats = tc.feature(usT, usT.objects.states).features
  .filter(f => +f.id <= 56 && f.id !== '60' && f.id !== '66' && f.id !== '69')
  .map(f => ({ name: f.properties.name, geometry: f.geometry }));

// Europe (hoverable countries) and surrounding land (not hoverable)
const euT = simp(WORLD, W.eu), euObj = euT.objects.countries.geometries;
const isEu = g => EUROPE.includes(g.properties.name);
const euFeats = euObj.filter(isEu).map(g => ({ name: RENAME[g.properties.name] || g.properties.name,
  geometry: tc.feature(euT, g).geometry }));
const ctxT = simp(WORLD, W.ctx), cg = ctxT.objects.countries.geometries;
const rest = cg.filter(g => !isEu(g) && g.properties.name !== 'United States of America' && g.properties.name !== 'Antarctica');
const ctxGeom = tc.merge(ctxT, rest);
const ctxFeats = [{ name: 'land', geometry: ctxGeom }];
// keep only land that can appear in the views (the western hemisphere and the Atlantic side of the old world)
ctxFeats[0].geometry = { type: 'MultiPolygon', coordinates: ringsOf(ctxGeom).filter(o => !o.hole).map(o => [o.r])
  .filter(p => { const xs = p[0].map(q => q[0]), ys = p[0].map(q => q[1]); return Math.max(...ys) > -40 && Math.min(...xs) < 80 && Math.max(...xs) > -175; }) };

const missing = EUROPE.filter(n => !euObj.some(g => g.properties.name === n));
const data = {
  states: packFeatures('states', usFeats, MINRING.states),
  eu: packFeatures('eu', euFeats, MINRING.eu),
  ctx: packFeatures('ctx', ctxFeats, MINRING.ctx)
};
const file = path.join(__dirname, '..', 'nightmap', 'effect.js');
let src = fs.readFileSync(file, 'utf8');
const block = '/*DATA:BEGIN*/\n  const DATA = ' + JSON.stringify(data) + ';\n  /*DATA:END*/';
src = src.replace(/\/\*DATA:BEGIN\*\/[\s\S]*?\/\*DATA:END\*\//, () => block);
fs.writeFileSync(file, src);
console.log(JSON.stringify(stats), 'missing:', missing.join(',') || 'none', 'bytes:', Buffer.byteLength(JSON.stringify(data)));
