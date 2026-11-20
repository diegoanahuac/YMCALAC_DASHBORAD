(function () {
  const M = (window.MEAL = window.MEAL || {});
  const H = 'Histórico', T = 'Todas';
  M.H = H; M.T = T;
  M.AGES = ['Primera infancia (3–5)', 'Niñez temprana (6–8)', 'Niñez media (9–11)', 'Adolescencia temprana (12–14)',
    'Adolescencia media (15–17)', 'Juventud temprana (18–20)', 'Juventudes (21–25)', 'Juventudes adultas (26–30)',
    'Personas adultas (31–35)', 'Personas adultas (36–59)', 'Personas adultas mayores (60+)'];
  M.AGES_TP = M.AGES.slice(4, 9);
  // brand palette (YMCA LAC / Eleva graphic standards)
  M.BRAND = { celeste: '#23b1e4', azul: '#07568e', morado: '#524793', rosa: '#e14892', lima: '#b3cb3d', verde: '#1ba451', amarillo: '#fac51c', frambuesa: '#de275f' };
  M.PROGC = { 'Todos': '#07568e', 'Eleva': '#23b1e4', 'After School': '#1ba451', 'Bluedrop': '#e14892', 'Tejiendo Paz': '#524793', 'Delta': '#de275f', 'YMCA': '#07568e' };
  M.G = ['#07568e', '#fac51c', '#1ba451', '#A3A9B1'];
  M.PAL = ['#23b1e4', '#e14892', '#1ba451', '#fac51c', '#524793', '#de275f', '#b3cb3d', '#07568e'];
  M.accent = '#07568e';
  // 4 regional age groups (consolidated view only)
  M.AGES4 = [['Infancias (menores de 12)', [0, 1, 2]], ['Adolescentes (12–17)', [3, 4]], ['Jóvenes (18–30)', [5, 6, 7]], ['Personas adultas (más de 30)', [8, 9, 10]]];
  M.toAges4 = (rows) => rows.map((r) => { const i = M.AGES.indexOf(r.rango_edad); const g = M.AGES4.find((a) => a[1].includes(i)); return g ? { ...r, rango_edad: g[0] } : r; });
  M.GEN = ['Hombre/niño', 'Mujer/niña', 'No binario', 'No especifica'];
  // Una cifra de personas no binarias menor a este mínimo se publica sumada a "No especifica" (evita identificar a alguien en grupos pequeños).
  M.MIN_CELDA = Math.max(0, +((window.MEL_CONFIG || {}).minCelda ?? 5));

  const es = d3.timeFormatLocale({
    dateTime: '%e de %B de %Y', date: '%d/%m/%Y', time: '%H:%M', periods: ['AM', 'PM'],
    days: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    shortDays: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    shortMonths: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  });
  M.fDate = es.utcFormat('%-d %b %Y');
  M.fMon = es.utcFormat('%b');
  M.fMonY = es.utcFormat('%b %Y');
  M.num = d3.format(',');
  M.usd = (v) => 'US$ ' + d3.format(',')(v);
  M.usdShort = (v) => 'US$ ' + (v >= 1e6 ? d3.format('.2~f')(v / 1e6) + ' M' : v >= 1e4 ? d3.format('.1~f')(v / 1e3) + ' mil' : d3.format(',')(v));
  M.pct = d3.format('.0%');
  M.signPct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + d3.format('.0%')(Math.abs(v));
  M.date = (s) => new Date(s + 'T00:00:00Z');

  const enc = (s) => String(s).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D');
  M.where = (o) => Object.entries(o).map(([k, v]) => k + '=' + enc(v)).join('&');
  M.mark = (el, source, field, where) => {
    el.setAttribute('data-source', source);
    if (field) el.setAttribute('data-field', field); else el.removeAttribute('data-field');
    if (where) el.setAttribute('data-where', where); else el.removeAttribute('data-where');
  };
  M.unmark = (el) => ['data-source', 'data-field', 'data-where'].forEach((a) => el.removeAttribute(a));

  M.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const SVGNS = 'http://www.w3.org/2000/svg';

  M.failLine = (el) => {
    el.replaceChildren();
    const f = M.el('div', 'm-fail');
    f.append(M.el('span', 'm-fail-dot'), M.el('span', null, 'No se pudo cargar'));
    el.append(f);
  };
  M.note = (el, text) => { el.append(M.el('p', 'm-empty', text)); };

  // state wrapper: returns arrays of data or null (and paints the state)
  M.box = (el, ids) => {
    const ds = ids.map((id) => dash.data(id));
    el.replaceChildren();
    if (ds.some((d) => ['error', 'connect', 'declined', 'missing'].includes(d.status))) {
      el.classList.remove('dash-skeleton');
      M.failLine(el);
      return null;
    }
    if (ds.some((d) => d.status !== 'ok')) { el.classList.add('dash-skeleton'); return null; }
    el.classList.remove('dash-skeleton');
    return ds.map((d) => d.data);
  };

  M.tip = (host) => {
    const t = M.el('div', 'm-tip');
    t.hidden = true;
    host.append(t);
    return {
      show(ev, lines) {
        t.replaceChildren();
        lines.forEach((l, i) => {
          const row = M.el('div', i === 0 ? 'm-tip-h' : 'm-tip-r');
          if (l.color) { const s = M.el('span', 'm-sw'); s.style.background = l.color; row.append(s); }
          row.append(M.el('span', null, l.text != null ? l.text : l));
          t.append(row);
        });
        t.hidden = false;
        const r = host.getBoundingClientRect();
        let x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 12;
        const tw = t.offsetWidth, th = t.offsetHeight;
        if (x + tw > r.width) x = Math.max(0, ev.clientX - r.left - tw - 12);
        if (y + th > r.height) y = Math.max(0, ev.clientY - r.top - th - 12);
        t.style.left = x + 'px'; t.style.top = y + 'px';
      },
      hide() { t.hidden = true; },
    };
  };

  const svg = (el, w, h) => d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).attr('class', 'm-svg');
  const textW = (sel, strings, cls) => {
    const t = sel.append('text').attr('class', cls || 'm-tick');
    let m = 0;
    strings.forEach((s) => { t.text(s); m = Math.max(m, t.node().getComputedTextLength()); });
    t.remove();
    return m;
  };

  // ---------- map (countries with implementation painted, zoomed to the points)
  M.drawMap = (el, shapes, pts, colorOf, opts) => {
    opts = opts || {};
    const big = !!el.closest('.is-big');
    const w = Math.max(240, el.clientWidth), h = Math.round(big ? Math.max(300, Math.min(560, w * 0.5)) : Math.max(170, Math.min(230, w * 0.55)));
    let lon = [-118, -34], lat = [-56, 32];
    if (pts.length) {
      const x0 = d3.min(pts, (d) => d.lon), x1 = d3.max(pts, (d) => d.lon), y0 = d3.min(pts, (d) => d.lat), y1 = d3.max(pts, (d) => d.lat);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = Math.max(x1 - x0, 12) * 1.3 + 5, dy = Math.max(y1 - y0, 9) * 1.3 + 5;
      lon = [cx - dx / 2, cx + dx / 2]; lat = [cy - dy / 2, cy + dy / 2];
    }
    const cyp = (lat[0] + lat[1]) / 2, cxp = (lon[0] + lon[1]) / 2, phi = Math.cos((cyp * Math.PI) / 180);
    const k = Math.min(w / ((lon[1] - lon[0]) * phi), h / (lat[1] - lat[0]));
    const X = (lo) => w / 2 + (lo - cxp) * phi * k, Y = (la) => h / 2 - (la - cyp) * k;
    const s = svg(el, w, h);
    const id = 'clip' + Math.random().toString(36).slice(2, 8);
    s.append('clipPath').attr('id', id).append('rect').attr('width', w).attr('height', h).attr('rx', 8);
    const g = s.append('g').attr('clip-path', `url(#${id})`);
    g.append('rect').attr('width', w).attr('height', h).attr('class', 'm-sea');
    const on = new Set(opts.countries || []);
    shapes.forEach((c) => {
      const d = c.forma.split('|').map((ring) => 'M' + ring.split(' ').map((p) => { const [a, b] = p.split(','); return X(+a).toFixed(1) + ',' + Y(+b).toFixed(1); }).join('L') + 'Z').join('');
      const path = g.append('path').attr('d', d).attr('class', 'm-land' + (on.has(c.pais_es) ? ' is-on' : ''));
      if (on.has(c.pais_es)) path.style('fill', opts.landColor || M.accent);
    });
    const tip = M.tip(el);
    const dots = g.selectAll('g.m-dot').data(pts).join('g').attr('class', 'm-dot').attr('transform', (d) => `translate(${X(d.lon)},${Y(d.lat)})`);
    dots.append('circle').attr('r', 10).attr('class', 'm-halo').style('fill', (d) => colorOf(d));
    dots.append('circle').attr('r', 5.5).attr('class', 'm-pin').style('fill', (d) => colorOf(d));
    const tipLines = (d) => [d.ciudad + ', ' + d.pais, d.ymca, ...d.lines.map((l) => ({ text: l.text, color: l.color }))];
    // el detalle de cada punto también se abre con teclado y al tocar
    dots.attr('tabindex', 0).attr('role', 'img').attr('aria-label', (d) => d.ymca + ', ' + d.ciudad + ', ' + d.pais + '. ' + d.lines.map((l) => l.text).join('. '))
      .on('mousemove', (ev, d) => tip.show(ev, tipLines(d)))
      .on('mouseleave', () => tip.hide())
      .on('click', (ev, d) => tip.show(ev, tipLines(d)))
      .on('focus', function (ev, d) { const r = this.getBoundingClientRect(); tip.show({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, tipLines(d)); })
      .on('blur', () => tip.hide());
    if (pts.length <= 6 && w > 380) {
      g.selectAll('text.m-city').data(pts).join('text').attr('class', 'm-city').attr('x', (d) => X(d.lon) + 9).attr('y', (d) => Y(d.lat) + 4).text((d) => d.ymca.replace('YMCA ', ''));
    }
  };

  // ---------- pyramid: labels left, men to the left of the axis, women to the right.
  // opts.groups = [{name, color, rows}] stacks groups on each side (e.g. Eleva youth / adults)
  M.drawPyramid = (el, rows, cats, opts) => {
    opts = opts || {};
    const groups = opts.groups || [{ name: null, rows, colors: [M.G[0], M.G[1]] }];
    const w = Math.max(260, el.clientWidth);
    const val = (rs, c, g) => d3.sum(rs.filter((r) => r.rango_edad === c && r.genero === g), (r) => r.n);
    const data = cats.map((c) => ({ c, h: groups.map((gr) => val(gr.rows, c, M.GEN[0])), m: groups.map((gr) => val(gr.rows, c, M.GEN[1])) }));
    data.forEach((d) => { d.H = d3.sum(d.h); d.M = d3.sum(d.m); });
    const rowH = cats.length > 6 ? 18 : 26, gap = 5, top = 24, h = top + cats.length * (rowH + gap) + 4;
    const s = svg(el, w, h);
    const lw = Math.min(textW(s, cats) + 10, w * 0.4);
    const vw = textW(s, data.flatMap((d) => [M.num(d.H), M.num(d.M)])) + 6;
    const mid = lw + (w - lw) / 2, half = (w - lw) / 2 - vw - 2;
    const max = d3.max(data, (d) => Math.max(d.H, d.M)) || 1;
    const x = d3.scaleLinear([0, max], [0, Math.max(10, half)]);
    s.append('text').attr('class', 'm-tick').attr('x', mid - 6).attr('y', 12).attr('text-anchor', 'end').text('Hombre/niño');
    s.append('text').attr('class', 'm-tick').attr('x', mid + 6).attr('y', 12).text('Mujer/niña');
    const tip = M.tip(el);
    const colorOf = (gi, side) => (groups[gi].colors ? groups[gi].colors[side] : groups[gi].color);
    const g = s.selectAll('g.m-prow').data(data).join('g').attr('class', 'm-prow').attr('transform', (d, i) => `translate(0,${top + i * (rowH + gap)})`);
    g.append('rect').attr('class', 'm-hit').attr('width', w).attr('height', rowH);
    g.append('text').attr('class', 'm-tick').attr('x', 0).attr('y', rowH / 2 + 4).text((d) => d.c);
    g.each(function (d) {
      const gg = d3.select(this);
      let l = 0, r = 0;
      groups.forEach((gr, gi) => {
        const a = x(d.h[gi]), b = x(d.m[gi]);
        if (a > 0) gg.append('rect').attr('x', mid - 1 - l - a).attr('width', a).attr('height', rowH).attr('rx', 3).style('fill', colorOf(gi, 0));
        if (b > 0) gg.append('rect').attr('x', mid + 1 + r).attr('width', b).attr('height', rowH).attr('rx', 3).style('fill', colorOf(gi, 1));
        l += a; r += b;
      });
      gg.append('text').attr('class', 'm-val').attr('x', mid - 5 - l).attr('y', rowH / 2 + 4).attr('text-anchor', 'end').text(d.H ? M.num(d.H) : '');
      gg.append('text').attr('class', 'm-val').attr('x', mid + 5 + r).attr('y', rowH / 2 + 4).text(d.M ? M.num(d.M) : '');
    });
    s.append('line').attr('class', 'm-axis').attr('x1', mid).attr('x2', mid).attr('y1', top - 4).attr('y2', h);
    g.on('mousemove', (ev, d) => tip.show(ev, [d.c,
      ...(opts.groups ? groups.flatMap((gr, gi) => [{ text: gr.name + ' · Hombre/niño: ' + M.num(d.h[gi]), color: colorOf(gi, 0) }, { text: gr.name + ' · Mujer/niña: ' + M.num(d.m[gi]), color: colorOf(gi, 1) }])
        : [{ text: 'Hombre/niño: ' + M.num(d.H), color: M.G[0] }, { text: 'Mujer/niña: ' + M.num(d.M), color: M.G[1] }])]))
      .on('mouseleave', () => tip.hide());
    if (opts.groups) {
      const lg = M.el('ul', 'm-legend m-legend-row');
      groups.forEach((gr) => { const li = M.el('li'); const sw = M.el('span', 'm-sw'); sw.style.background = gr.color; li.append(sw, M.el('span', 'm-lg-l', gr.name)); lg.append(li); });
      el.append(lg);
    }
    const all = groups.flatMap((gr) => gr.rows);
    const nb = d3.sum(all.filter((r) => r.genero === M.GEN[2] && cats.includes(r.rango_edad)), (r) => r.n);
    const ne = d3.sum(all.filter((r) => r.genero === M.GEN[3] && cats.includes(r.rango_edad)), (r) => r.n);
    const junto = nb > 0 && nb < M.MIN_CELDA; // cifra pequeña: no se publica por separado
    const partes = junto ? [M.num(nb + ne) + ' no binario o sin especificar'] : [nb ? M.num(nb) + ' no binario' : '', ne ? M.num(ne) + ' sin especificar' : ''].filter(Boolean);
    if (nb || ne) el.append(M.el('p', 'm-note-nb', 'Además: ' + partes.join(' · ') + ' (no se muestran en la pirámide).'));
  };

  // ---------- donut
  M.drawDonut = (el, rows) => {
    const data = M.GEN.map((g, i) => ({ g, n: d3.sum(rows.filter((r) => r.genero === g), (r) => r.n), c: M.G[i] }));
    if (data[2].n > 0 && data[2].n < M.MIN_CELDA) { // cifra pequeña: se publica junto con "No especifica"
      data[3] = { g: 'No binario o sin especificar', n: data[2].n + data[3].n, c: data[3].c };
      data.splice(2, 1);
    }
    const tot = d3.sum(data, (d) => d.n);
    const wrap = M.el('div', 'm-donut');
    el.append(wrap);
    const size = 180;
    const s = d3.select(wrap).append('svg').attr('width', size).attr('height', size).attr('viewBox', `0 0 ${size} ${size}`).attr('class', 'm-donut-svg');
    const arc = d3.arc().innerRadius(size * 0.31).outerRadius(size / 2 - 2).cornerRadius(3).padAngle(0.015);
    const tip = M.tip(el);
    s.append('g').attr('transform', `translate(${size / 2},${size / 2})`).selectAll('path').data(d3.pie().sort(null).value((d) => d.n)(data.filter((d) => d.n > 0))).join('path')
      .attr('d', arc).style('fill', (d) => d.data.c)
      .on('mousemove', (ev, d) => tip.show(ev, [d.data.g, { text: M.num(d.data.n) + ' · ' + M.pct(d.data.n / tot), color: d.data.c }]))
      .on('mouseleave', () => tip.hide());
    s.append('text').attr('class', 'm-donut-n').attr('x', size / 2).attr('y', size / 2 + 2).attr('text-anchor', 'middle').text(M.num(tot));
    s.append('text').attr('class', 'm-tick').attr('x', size / 2).attr('y', size / 2 + 20).attr('text-anchor', 'middle').text('personas');
    const lg = M.el('ul', 'm-legend');
    data.forEach((d) => {
      const li = M.el('li');
      const sw = M.el('span', 'm-sw'); sw.style.background = d.c;
      li.append(sw, M.el('span', 'm-lg-l', d.g), M.el('span', 'm-lg-v', M.num(d.n)), M.el('span', 'm-lg-p', tot ? M.pct(d.n / tot) : '—'));
      lg.append(li);
    });
    wrap.append(lg);
  };

  // ---------- vertical bars per cycle; series side by side, or stacked when opts.stacked
  M.drawCycleBars = (el, cycles, series, selected, fmt, opts) => {
    opts = opts || {};
    const w = Math.max(240, el.clientWidth), h = 200, top = 22, bottom = 26;
    const s = svg(el, w, h);
    const x0 = d3.scaleBand(cycles, [8, w - 8]).paddingInner(0.3).paddingOuter(0.1);
    const stacked = !!opts.stacked && series.length > 1;
    const x1 = d3.scaleBand(stacked ? ['s'] : series.map((d) => d.name), [0, x0.bandwidth()]).padding(0.12);
    const totals = cycles.map((c) => d3.sum(series, (sr) => (sr.values.find((v) => v.ciclo === c) || {}).v || 0));
    const max = (stacked ? d3.max(totals) : d3.max(series.flatMap((sr) => sr.values.map((v) => v.v || 0)))) || 1;
    const y = d3.scaleLinear([0, max], [h - bottom, top]);
    const tip = M.tip(el);
    s.append('line').attr('class', 'm-axis').attr('x1', 0).attr('x2', w).attr('y1', h - bottom).attr('y2', h - bottom);
    s.selectAll('text.m-xl').data(cycles).join('text').attr('class', 'm-tick m-xl').attr('x', (c) => x0(c) + x0.bandwidth() / 2).attr('y', h - 8).attr('text-anchor', 'middle').text((c) => c);
    const bw = Math.min(stacked ? 40 : 32, x1.bandwidth());
    cycles.forEach((c, ci) => {
      let base = 0;
      const dim = selected && selected !== M.H && c !== selected;
      series.forEach((sr) => {
        const v = (sr.values.find((q) => q.ciclo === c) || {}).v;
        const cx = x0(c) + (stacked ? (x0.bandwidth() - bw) / 2 : x1(sr.name) + (x1.bandwidth() - bw) / 2);
        if (v == null) {
          if (!stacked || base === 0) s.append('text').attr('class', 'm-tick').attr('x', cx + bw / 2).attr('y', h - bottom - 6).attr('text-anchor', 'middle').text('s/d');
          return;
        }
        const y0 = stacked ? y(base + v) : y(v), y1 = stacked ? y(base) : h - bottom;
        s.append('rect').attr('x', cx).attr('width', bw).attr('y', y0).attr('height', Math.max(1, y1 - y0)).attr('rx', stacked ? 2 : 4)
          .style('fill', sr.color).style('opacity', dim ? 0.4 : 1)
          .on('mousemove', (ev) => tip.show(ev, [c, ...series.map((q) => { const vv = (q.values.find((z) => z.ciclo === c) || {}).v; return { text: (series.length > 1 ? q.name + ': ' : '') + (vv == null ? 's/d' : fmt(vv)), color: q.color }; })]))
          .on('mouseleave', () => tip.hide());
        if (!stacked) s.append('text').attr('class', 'm-val').attr('x', cx + bw / 2).attr('y', y0 - 5).attr('text-anchor', 'middle').text(series.length > 1 && x1.bandwidth() < 40 ? '' : fmt(v));
        base += v;
      });
      if (stacked && totals[ci]) s.append('text').attr('class', 'm-val').attr('x', x0(c) + x0.bandwidth() / 2).attr('y', y(totals[ci]) - 5).attr('text-anchor', 'middle').text(fmt(totals[ci]));
    });
    if (series.length > 1) {
      const lg = M.el('ul', 'm-legend m-legend-row');
      series.forEach((sr) => { const li = M.el('li'); const sw = M.el('span', 'm-sw'); sw.style.background = sr.color; li.append(sw, M.el('span', 'm-lg-l', sr.name)); lg.append(li); });
      el.append(lg);
    }
  };

  // ---------- matrix: which YMCA reports which option (rows = options, columns = YMCA)
  // cols = [{name, items: array|null}]; null = the YMCA has not reported this information
  M.matrix = (el, options, cols, colors) => {
    const wrap = M.el('div', 'm-table-wrap');
    const t = M.el('table', 'm-matrix');
    const hr = M.el('tr'); hr.append(M.el('th', null, ''));
    cols.forEach((c) => { const th = M.el('th', 'm-mx-c', c.name.replace('YMCA ', '')); th.title = c.name; hr.append(th); });
    hr.append(M.el('th', 'm-mx-n', 'Total'));
    const thead = M.el('thead'); thead.append(hr); t.append(thead);
    const withData = cols.filter((c) => c.items).length;
    const body = M.el('tbody');
    options.forEach((o, i) => {
      const tr = M.el('tr');
      const lab = M.el('td', 'm-mx-l'); const sw = M.el('span', 'm-sw'); sw.style.background = colors[i % colors.length]; lab.append(sw, M.el('span', null, o)); tr.append(lab);
      let n = 0;
      cols.forEach((c) => {
        const td = M.el('td', 'm-mx-c');
        if (!c.items) td.append(M.el('span', 'm-mx-na', '·'));
        else if (c.items.includes(o)) { n++; const dot = M.el('span', 'm-mx-dot'); dot.style.background = colors[i % colors.length]; dot.title = c.name + ': ' + o; td.append(dot); }
        else td.append(M.el('span', 'm-mx-no'));
        tr.append(td);
      });
      tr.append(M.el('td', 'm-mx-n', withData ? n + ' de ' + withData : '—'));
      body.append(tr);
    });
    t.append(body); wrap.append(t); el.append(wrap);
    const missing = cols.filter((c) => !c.items).map((c) => c.name.replace('YMCA ', ''));
    void missing;
  };

  // ---------- HTML horizontal bars
  M.hbars = (el, items, fmt, opts) => {
    opts = opts || {};
    const max = opts.max || d3.max(items, (d) => d.value) || 1;
    const list = M.el('div', 'm-hbars');
    items.forEach((it, i) => {
      const row = M.el('div', 'm-hb');
      const head = M.el('div', 'm-hb-head');
      const v = M.el('span', 'm-hb-v', it.value == null ? 'Sin dato' : fmt(it.value));
      if (it.mark && it.value != null) M.mark(v, it.mark.source, it.mark.field, it.mark.where);
      head.append(M.el('span', 'm-hb-l', it.label), v);
      const tr = M.el('div', 'm-hb-track');
      const f = M.el('div', 'm-hb-fill');
      f.style.width = Math.max(it.value ? 1.5 : 0, ((it.value || 0) / max) * 100) + '%';
      f.style.background = it.color || (opts.color != null ? opts.color : M.accent);
      tr.append(f);
      row.append(head, tr);
      list.append(row);
    });
    el.append(list);
  };

  // ---------- timeline / gantt
  M.drawGantt = (el, rows, colorOf) => {
    if (!rows.length) { M.note(el, 'Sin información'); return; }
    const w = Math.max(300, el.clientWidth);
    const lanes = [...new Set(rows.map((r) => r.ymca))].sort();
    const rowH = 30, top = 26, h = top + lanes.length * rowH + 4;
    const s = svg(el, w, h);
    const lw = Math.min(textW(s, lanes) + 14, w * 0.35);
    const d0 = d3.min(rows, (r) => M.date(r.inicio)), d1 = d3.max(rows, (r) => M.date(r.fin));
    const x = d3.scaleUtc([d3.utcMonth.floor(d0), d3.utcMonth.ceil(new Date(+d1 + 864e5))], [lw, w - 10]);
    const span = (x.domain()[1] - x.domain()[0]) / 864e5;
    const n = Math.max(2, Math.floor((w - lw) / 70));
    const months = d3.utcMonth.range(x.domain()[0], x.domain()[1]);
    const step = Math.max(1, Math.ceil(months.length / Math.max(2, n)));
    const ticks = months.filter((m, i) => i % step === 0);
    const f = span > 400 ? M.fMonY : M.fMon;
    s.selectAll('line.m-gl').data(ticks).join('line').attr('class', 'm-grid').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top - 6).attr('y2', h);
    let lastX = -1e9;
    ticks.forEach((t) => {
      const tx = s.append('text').attr('class', 'm-tick').attr('x', x(t) + 3).attr('y', 12).text(f(t));
      const tw = tx.node().getComputedTextLength();
      if (x(t) < lastX + 6 || x(t) + 3 + tw > w) tx.remove(); else lastX = x(t) + 3 + tw;
    });
    const tip = M.tip(el);
    lanes.forEach((ln, i) => {
      const y = top + i * rowH;
      s.append('text').attr('class', 'm-tick m-lane').attr('x', 0).attr('y', y + rowH / 2 + 4).text(ln);
      s.append('line').attr('class', 'm-grid').attr('x1', lw).attr('x2', w - 10).attr('y1', y + rowH / 2).attr('y2', y + rowH / 2);
      rows.filter((r) => r.ymca === ln).sort((a, b) => (a.tipo === 'actividad') - (b.tipo === 'actividad')).forEach((r) => {
        const a = x(M.date(r.inicio)), b = x(new Date(+M.date(r.fin) + 864e5));
        const c = colorOf(r);
        const lines = [r.ymca + (r.sede ? ' · ' + r.sede : ''), { text: r.etiqueta + ' · ' + (r.inicio === r.fin ? M.fDate(M.date(r.inicio)) : M.fDate(M.date(r.inicio)) + ' – ' + M.fDate(M.date(r.fin))), color: c }];
        if (r.estado || r.modalidad) lines.push([r.estado, r.modalidad].filter(Boolean).join(' · '));
        let node;
        if (r.tipo === 'actividad') {
          node = s.append('circle').attr('cx', (a + b) / 2).attr('cy', y + rowH / 2).attr('r', 5).attr('class', 'm-gdot').style('fill', c);
        } else {
          const hh = r.tipo === 'evento' ? 14 : 12;
          node = s.append('rect').attr('x', a).attr('width', Math.max(6, b - a)).attr('y', y + rowH / 2 - hh / 2).attr('height', hh).attr('rx', 4).style('fill', c)
            .style('opacity', r.tipo === 'periodo' && rows.some((q) => q.tipo === 'actividad') ? 0.35 : 1);
        }
        node.on('mousemove', (ev) => tip.show(ev, lines)).on('mouseleave', () => tip.hide());
      });
    });
  };

  M.chips = (items, cls) => {
    const w = M.el('div', 'm-chips');
    items.forEach((t) => w.append(M.el('span', 'm-chip-s' + (cls ? ' ' + cls : ''), t)));
    return w;
  };
  M.days = (str) => {
    const on = new Set((str || '').split(','));
    const w = M.el('div', 'm-days');
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d) => w.append(M.el('span', 'm-day' + (on.has(d) ? ' is-on' : ''), d)));
    return w;
  };
})();
