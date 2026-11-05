/* Shared top bar: Home, layout switch, Tune panel, Export menu.
   Shell.init({ slug, effect, effectFile }) where effect = { name, params, defaults, mount } */
(function () {
  const LAYOUTS = [['center', 'Centered'], ['left', 'Left'], ['big', 'One big header'], ['split', 'Left + image'], ['text', 'Headline + text']];
  const COPY = {
    eyebrow: 'Eyebrow label',
    h1: 'Headline goes here',
    lead: 'A short supporting paragraph sits under the headline and says what the page is about in a sentence or two.',
    more: ['A second paragraph with a little more detail, used by the headline and text layout.', 'A third paragraph, because text layouts usually carry more than one.'],
    btn1: 'Primary action', btn2: 'Secondary'
  };

  function heroHTML(layout) {
    return '<section class="hero" data-layout="' + layout + '"><div class="bg" id="bg"></div><div class="inner"><div class="copy">' +
      '<p class="eyebrow">' + COPY.eyebrow + '</p><h1>' + COPY.h1 + '</h1><p class="lead">' + COPY.lead + '</p>' +
      '<div class="more">' + COPY.more.map(p => '<p>' + p + '</p>').join('') + '</div>' +
      '<div class="btns"><a class="btn fill" href="#">' + COPY.btn1 + '</a><a class="btn" href="#">' + COPY.btn2 + '</a></div></div>' +
      '<div class="media" aria-hidden="true">Image</div></div></section>';
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  window.Shell = {
    init(o) {
      const { slug, effect } = o, file = o.effectFile || 'effect.js';
      const P = Object.assign({}, effect.defaults);
      let layout = 'center';
      try {
        const h = JSON.parse(decodeURIComponent(location.hash.slice(1)) || '{}');
        if (h.l) layout = h.l; if (h.c) Object.assign(P, h.c);
      } catch (e) {}

      document.body.insertAdjacentHTML('afterbegin',
        '<div class="bar"><a href="/" id="home">Home</a><span class="title">' + effect.name + '</span><span class="grow"></span>' +
        '<select id="layout" aria-label="Layout">' + LAYOUTS.map(l => '<option value="' + l[0] + '">' + l[1] + '</option>').join('') + '</select>' +
        '<button id="tune" aria-expanded="false">Tune</button>' +
        '<div class="menu"><button id="exp" aria-expanded="false">Export</button><div class="drop">' +
        '<button data-x="json">Copy settings (JSON)</button><button data-x="link">Copy share link</button>' +
        '<button data-x="snippet">Copy embed snippet</button><button data-x="js">Download effect JS</button>' +
        '<button data-x="html">Download standalone HTML</button></div></div></div>' +
        '<div class="panel" id="panel"></div><div id="stage"></div><div class="toast" id="toast"></div>');

      const stage = document.getElementById('stage'), $ = id => document.getElementById(id);
      let inst = null;
      function renderHero() {
        if (inst) inst.destroy();
        stage.innerHTML = heroHTML(layout);
        inst = effect.mount(document.getElementById('bg'), P);
      }
      function save() {
        const diff = {}; for (const k in P) if (P[k] !== effect.defaults[k]) diff[k] = P[k];
        history.replaceState(null, '', '#' + encodeURIComponent(JSON.stringify({ l: layout, c: diff })));
      }
      function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 1600); }

      const sel = $('layout'); sel.value = layout;
      sel.onchange = () => { layout = sel.value; renderHero(); save(); };

      // tune panel built from the effect's parameter list
      const panel = $('panel'), inputs = {};
      effect.params.forEach(p => {
        if (p.group) { const h = document.createElement('h3'); h.textContent = p.group; panel.appendChild(h); }
        const row = document.createElement('div'), id = 'p_' + p.key, type = p.type || 'range';
        if (type === 'range') {
          row.className = 'row';
          row.innerHTML = '<label for="' + id + '">' + p.label + '</label><input id="' + id + '" type="range" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + P[p.key] + '"><span class="v">' + P[p.key] + '</span>';
        } else if (type === 'select') {
          row.className = 'row c';
          row.innerHTML = '<label for="' + id + '">' + p.label + '</label><select id="' + id + '">' + p.options.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>';
        } else {
          row.className = 'row ' + (type === 'toggle' ? 't' : 'c');
          row.innerHTML = '<label for="' + id + '">' + p.label + '</label><input id="' + id + '" type="' + (type === 'toggle' ? 'checkbox' : 'color') + '">';
        }
        const inp = row.querySelector('input,select'), v = row.querySelector('.v');
        if (type === 'toggle') inp.checked = !!P[p.key]; else if (type === 'color' || type === 'select') inp.value = P[p.key];
        inp.oninput = () => {
          P[p.key] = type === 'toggle' ? inp.checked : (type === 'color' || type === 'select') ? inp.value : +inp.value;
          if (v) v.textContent = inp.value;
          inst.update({ [p.key]: P[p.key] }); save();
        };
        inputs[p.key] = [inp, v, type];
        panel.appendChild(row);
      });
      const rs = document.createElement('button'); rs.className = 'reset'; rs.textContent = 'Reset to defaults'; panel.appendChild(rs);
      rs.onclick = () => {
        Object.assign(P, effect.defaults);
        for (const k in inputs) { const [i, v, t] = inputs[k]; if (t === 'toggle') i.checked = P[k]; else i.value = P[k]; if (v) v.textContent = P[k]; }
        inst.update(P); save();
      };
      const tune = $('tune');
      tune.onclick = () => { const on = panel.classList.toggle('open'); tune.setAttribute('aria-expanded', on); };

      // export
      const menu = document.querySelector('.menu');
      $('exp').onclick = e => { e.stopPropagation(); const on = menu.classList.toggle('open'); $('exp').setAttribute('aria-expanded', on); };
      document.addEventListener('click', () => { menu.classList.remove('open'); $('exp').setAttribute('aria-expanded', false); });
      const text = url => fetch(url).then(r => r.text());
      const cfgJSON = () => JSON.stringify(P);
      const auto = () => "\n;(function(){document.querySelectorAll('[data-bg=\"" + slug + "\"]').forEach(function(el){var c={};try{c=JSON.parse(el.getAttribute('data-config')||'{}')}catch(e){}window.Effects." + slug + ".mount(el,c)})})();\n";
      const actions = {
        json: () => navigator.clipboard.writeText(JSON.stringify({ effect: slug, layout, config: P }, null, 2)).then(() => toast('Settings copied')),
        link: () => navigator.clipboard.writeText(location.href).then(() => toast('Link copied')),
        snippet: () => navigator.clipboard.writeText('<div data-bg="' + slug + '" data-config=\'' + cfgJSON() + '\' style="position:relative;min-height:60vh">\n  <!-- your content here -->\n</div>\n<script src="' + slug + '-bg.js"><\/script>').then(() => toast('Snippet copied. Also download the effect JS.')),
        js: () => text(file).then(s => { download(slug + '-bg.js', s + auto(), 'text/javascript'); }),
        html: () => Promise.all([text(file), text('/shared/hero-layouts.css')]).then(r => {
          const page = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + effect.name + '</title>\n<style>html,body{margin:0}\n' + r[1] + '</style></head>\n<body>\n' +
            heroHTML(layout).replace('<div class="bg" id="bg">', '<div class="bg" data-bg="' + slug + '" data-config=\'' + cfgJSON() + '\'>') +
            '\n<script>\n' + r[0] + auto() + '<\/script>\n</body></html>\n';
          download(slug + '-hero.html', page, 'text/html');
        })
      };
      document.querySelectorAll('.drop button').forEach(b => { b.onclick = () => actions[b.dataset.x]().catch(() => toast('Failed')); });

      renderHero();
    }
  };
})();
