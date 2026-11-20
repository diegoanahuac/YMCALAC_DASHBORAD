(function () {
  const M = window.MEAL;
  const { H, T } = M;
  const $ = (s) => document.querySelector(s);

  // ---------- programs ----------
  const PROGS = {
    'Todos': { tab: 'regional', kicker: 'Programas, proyectos e iniciativas regionales', name: 'Resumen Regional', sub: 'Información consolidada' },
    'Eleva': { tab: 'eleva', kicker: 'Programa regional', name: 'Eleva', sub: 'Programa Regional de Salud Mental que fortalece comunidades desde las juventudes, con un grupo de jóvenes y otro de personas adultas.', icon: 'cerebro' },
    'After School': { tab: 'after-school', kicker: 'Programa regional', name: 'After School Programme', sub: 'Programa extraescolar que implementan YMCA del Caribe con el patrocinio de CIBC FirstCaribbean. Incluye la iniciativa Bluedrop.' },
    'Tejiendo Paz': { tab: 'tejiendo-paz', kicker: 'Proyecto regional', name: 'Tejiendo Paz', sub: 'Jóvenes que diseñan y lideran proyectos comunitarios para prevenir la violencia.' },
    'Delta': { tab: 'delta', kicker: 'Patrocinio', name: 'Patrocinios Delta Air Lines', sub: 'Eventos y programas comunitarios patrocinados por Delta Air Lines.' },
    'YMCA': { tab: 'por-ymca', kicker: 'Vista por movimiento', name: 'Perfil por YMCA', sub: 'Todos los programas, proyectos e iniciativas de un movimiento en un solo lugar.' },
  };
  const FULL = { 'Eleva': 'Eleva', 'After School': 'After School Programme', 'Bluedrop': 'Bluedrop', 'Tejiendo Paz': 'Tejiendo Paz', 'Delta': 'Patrocinios Delta Air Lines', 'Todos': 'la región' };
  const CARD = {
    'Eleva': 'Salud mental: grupos de jóvenes y de personas adultas, pares, formación y acompañamiento.',
    'After School': 'Programa extraescolar en YMCA del Caribe, de septiembre a julio. Incluye Bluedrop.',
    'Tejiendo Paz': 'Jóvenes que lideran proyectos comunitarios de prevención de violencia.',
    'Delta': 'Eventos y programas patrocinados por Delta Air Lines.',
  };
  const MAIN = ['Eleva', 'After School', 'Tejiendo Paz', 'Delta'];
  const PROGS5 = ['Eleva', 'After School', 'Bluedrop', 'Tejiendo Paz', 'Delta'];
  const pc = (p) => M.PROGC[p] || M.PAL[0];
  const YEARLY = (p) => p === 'Todos' || p === 'YMCA';
  const CONF = dash.config || {}, FEAT = CONF.features || {};
  // ciclo con que abre un programa: el año configurado en las vistas anuales, o el más reciente con datos
  const defCycle = (prog, cyc) => (YEARLY(prog) && CONF.defaultYear && cyc.includes(CONF.defaultYear) ? CONF.defaultYear : cyc[cyc.length - 1]);

  // option lists defined by the regional team
  const AREAS = ['21st Century Skills (e.g. coding, problem solving)', 'Arts (music, drama, painting, photography)', 'Academic Enrichment (homework help, tutoring)', 'College & Career Readiness (job skills, mentoring)', 'Family & Parent Engagement', 'Global Learning & Inclusion', 'Health & Wellness (sports, nutrition, hygiene)', 'Leadership Development', 'Service Learning (volunteering, civic projects)'];
  const FONDOS = ['Staff salaries or stipends', 'Transportation for youth', 'Healthy meals or snacks', 'Educational materials or supplies', 'Facilities or space rental', 'New equipment (e.g. sports, art, tech)', 'Training or capacity building', 'Scholarships for children from low-income families', 'Other'];
  const HAB = ['Digital literacy', 'Research and critical thinking', 'Creativity and multimedia (e.g., photo/video editing, presentations)', 'Typing or computer navigation', 'Coding or other 21st-century skills', 'Language learning', 'Confidence with technology', 'Financial literacy', 'Media literacy', 'Reading comprehension', 'Math skills', 'Problem solving & logic', 'None', 'Other'];
  const ACT = ['Homework/assignments', 'Online research', 'Educational apps/interactive learning', 'Career readiness workshops (resume, job applications)', 'Digital literacy training · Internet safety training', 'AI literacy', 'Productivity tools (Word, Excel, etc.)', 'Other'];

  // ---------- data helpers ----------
  const ok = (id) => dash.data(id).status === 'ok';
  const rows = (id) => (ok(id) ? dash.data(id).data : []);
  const inSel = (r, c, y) => (c === H || r.ciclo === c) && (y === T || r.ymca === y);
  let K = new Map(), kSrc = null;
  const kIndex = () => { const d = rows('kpis'); if (d !== kSrc) { kSrc = d; K = new Map(d.map((r) => [r.programa + '|' + r.ciclo + '|' + r.ymca + '|' + r.indicador, r])); } return K; };
  const kget = (p, c, y, i) => kIndex().get(p + '|' + c + '|' + y + '|' + i);
  const kwhere = (p, c, y, i) => M.where({ programa: p, ciclo: c, ymca: y, indicador: i });
  const dataProg = (p) => (p === 'YMCA' ? 'Todos' : p);
  const cyclesOf = (p) => [...new Set(rows('kpis').filter((r) => r.programa === dataProg(p) && r.ciclo !== H).map((r) => r.ciclo))].sort();
  const ymcasOf = (p) => [...new Set(rows('implementaciones').filter((r) => YEARLY(p) || r.programa === p || (p === 'After School' && r.programa === 'Bluedrop')).map((r) => r.ymca))].sort();
  // a cycle chosen on one page, expressed in another program's cycles (After School runs Sept–July: "2025-2026" counts in year 2025)
  const conv = (c, p) => {
    if (!c || c === H) return c;
    if ((p === 'After School' || p === 'Bluedrop') && /^\d{4}$/.test(c)) return c + '-' + (+c + 1);
    if (p !== 'After School' && p !== 'Bluedrop' && /^\d{4}-\d{4}$/.test(c)) return c.slice(0, 4);
    return c;
  };
  const latestPer = (rs) => { const m = new Map(); rs.forEach((r) => { const c = m.get(r.ymca); if (!c || r.ciclo > c.ciclo) m.set(r.ymca, r); }); return [...m.values()].sort((a, b) => a.ymca.localeCompare(b.ymca)); };

  function state() {
    const p = dash.params();
    const prog = PROGS[p.prog] ? p.prog : 'Todos';
    const cyc = cyclesOf(prog), ys = ymcasOf(prog);
    const def = defCycle(prog, cyc);
    const want = conv(p.ciclo, prog);
    const ciclo = want === H || cyc.includes(want) ? want : def || H;
    const ymca = ys.includes(p.ymca) ? p.ymca : prog === 'YMCA' ? (ys.includes(CONF.defaultYmca) ? CONF.defaultYmca : ys[0] || T) : T;
    return { prog, dp: dataProg(prog), ciclo, ymca, cyc, ys, equipo: p.equipo || 'Pares', tp: p.tp || 'Participantes' };
  }
  const cycWord = (s) => (YEARLY(s.prog) ? 'año' : 'ciclo');
  const periodText = (s) => (s.ciclo === H ? 'Histórico' : (YEARLY(s.prog) ? 'Año ' : 'Ciclo ') + s.ciclo) + ' · ' + (s.ymca === T ? 'todas las YMCA' : s.ymca);

  // ---------- KPI helpers ----------
  function setKpi(el, p, c, y, ind, fmt, empty) {
    if (!el) return null;
    el.classList.remove('is-na');
    if (dash.data('kpis').status !== 'ok') { M.unmark(el); el.textContent = '—'; el.classList.add('dash-skeleton'); return null; }
    el.classList.remove('dash-skeleton');
    const r = kget(p, c, y, ind);
    if (!r || r.valor == null) { M.unmark(el); el.textContent = empty || 'Sin dato'; el.classList.add('is-na'); return null; }
    M.mark(el, 'kpis', 'valor', kwhere(p, c, y, ind));
    el.textContent = fmt(r.valor);
    return r;
  }
  function setDelta(el, r, p, c, y, ind, mode, word) {
    if (!el) return;
    el.replaceChildren();
    if (c === H) { el.textContent = 'Acumulado de todos los ciclos'; return; }
    if (!r) return;
    const cyc = cyclesOf(p); const prev = cyc[cyc.indexOf(c) - 1];
    const w = word || 'ciclo';
    if (mode === 'rate') {
      if (r.anterior == null) return;
      const s = M.el('span', null, M.pct(r.anterior)); M.mark(s, 'kpis', 'anterior', kwhere(p, c, y, ind));
      el.append(w[0].toUpperCase() + w.slice(1) + ' ' + prev + ': ', s); return;
    }
    if (r.cambio_pct == null) return;
    const s = M.el('span', r.cambio_pct >= 0 ? 'up' : 'down', M.signPct(r.cambio_pct)); M.mark(s, 'kpis', 'cambio_pct', kwhere(p, c, y, ind));
    el.append(s, ' vs. ' + w + ' ' + prev);
  }
  const kpiPair = (id, p, s, ind, fmt, mode, c) => {
    const cc = c || s.ciclo;
    const r = setKpi($('#' + id), p, cc, s.ymca, ind, fmt || M.num);
    setDelta($('#' + id + '-d'), r, p, cc, s.ymca, ind, mode, YEARLY(s.prog) ? 'año' : 'ciclo');
    return r;
  };

  // ---------- controls ----------
  const selC = $('#f-ciclo'), selY = $('#f-ymca');
  selC.addEventListener('change', () => dash.setParams({ ciclo: selC.value }));
  // Perfil por YMCA: si el movimiento elegido no tiene datos en el año en pantalla, abre su año más reciente con datos
  const ownCycle = (y, c) => {
    if (c === H || y === T) return null;
    const own = cyclesOf('YMCA').filter((cc) => kget('Todos', cc, y, 'participantes') || kget('Todos', cc, y, 'fondos_usd'));
    return own.length && !own.includes(c) ? own[own.length - 1] : null;
  };
  selY.addEventListener('change', () => {
    const up = { ymca: selY.value };
    if (dash.params().prog === 'YMCA') { const c = ownCycle(selY.value, state().ciclo); if (c) up.ciclo = c; }
    dash.setParams(up);
  });
  $('#f-reset').addEventListener('click', () => dash.resetParams());
  document.querySelectorAll('#f-equipo button').forEach((b) => b.addEventListener('click', () => dash.setParams({ equipo: b.dataset.v })));
  document.querySelectorAll('#f-tp button').forEach((b) => b.addEventListener('click', () => dash.setParams({ tp: b.dataset.v })));
  const goProg = (prog, ymca) => {
    const p = dash.params(); const cyc = cyclesOf(prog); const ys = ymcasOf(prog);
    const c = conv(p.ciclo, prog); const y = ymca || p.ymca;
    dash.setParams({ prog, ciclo: c === H || cyc.includes(c) ? c : defCycle(prog, cyc) || c, ymca: ys.includes(y) ? y : T });
    dash.setLink(PROGS[prog].tab);
  };
  // a tab opens its program in its own most recent cycle (or keeps the historical view)
  document.querySelectorAll('#tabs .m-tab').forEach((b) => b.addEventListener('click', () => {
    const prog = b.dataset.prog, cyc = cyclesOf(prog), p = dash.params(), ys = ymcasOf(prog);
    let c = p.ciclo === H ? H : defCycle(prog, cyc);
    if (prog === 'YMCA') c = ownCycle(ys.includes(p.ymca) ? p.ymca : ys.includes(CONF.defaultYmca) ? CONF.defaultYmca : ys[0] || T, c) || c;
    dash.setParams({ prog, ciclo: c, ymca: ys.includes(p.ymca) ? p.ymca : T });
    dash.setLink(PROGS[prog].tab);
  }));
  // teclado: flechas, Inicio y Fin recorren las pestañas
  $('#tabs').addEventListener('keydown', (ev) => {
    const tabs = [...document.querySelectorAll('#tabs .m-tab')], i = tabs.indexOf(document.activeElement);
    const j = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : null;
    if (i < 0 || j == null) return;
    ev.preventDefault(); const t = tabs[(j + tabs.length) % tabs.length]; t.focus(); t.click();
  });
  const fromHash = Object.keys(PROGS).find((k) => PROGS[k].tab === location.hash.slice(1));
  if (fromHash) dash.setParams({ prog: fromHash });
  const ICONS = window.MEAL_ICONS || {};
  document.querySelectorAll('img[data-icon]').forEach((im) => { if (ICONS[im.dataset.icon]) im.src = ICONS[im.dataset.icon]; else im.remove(); });

  function drawControls(s) {
    $('#f-ciclo-l').textContent = YEARLY(s.prog) ? 'Año' : 'Ciclo';
    selC.replaceChildren(new Option('Histórico (todos los ciclos)', H), ...s.cyc.slice().reverse().map((c) => new Option((YEARLY(s.prog) ? 'Año ' : 'Ciclo ') + c, c)));
    selC.value = s.ciclo;
    selY.replaceChildren(...(s.prog === 'YMCA' ? [] : [new Option('Todas las YMCA', T)]), ...s.ys.map((y) => new Option(y, y)));
    selY.value = s.ymca;
    document.querySelectorAll('#tabs .m-tab').forEach((b) => { const on = b.dataset.prog === s.prog; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.setAttribute('aria-controls', 'programa'); b.style.setProperty('--tc', M.PROGC[b.dataset.prog]); });
    $('#programa').setAttribute('aria-labelledby', PROGS[s.prog].tab);
    document.title = PROGS[s.prog].name + ' · Sistema MEL YMCA LAC';
    document.querySelectorAll('#f-equipo button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.equipo)));
    document.querySelectorAll('#f-tp button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.tp)));
    $('#lens').textContent = s.ymca !== T ? `Vista por YMCA: ${s.ymca} · ${s.ciclo === H ? 'histórico' : cycWord(s) + ' ' + s.ciclo}`
      : s.ciclo === H ? 'Vista histórica: todo lo acumulado desde la primera edición, todas las YMCA' : `Vista global: ${cycWord(s)} ${s.ciclo}, todas las YMCA`;
    Object.entries(PROGS).forEach(([k, v]) => { $('#sec-' + v.tab).hidden = k !== s.prog; });
    $('#bloque-comun').hidden = s.prog === 'YMCA';
    $('#sec-historico').hidden = !(s.ciclo === H && s.prog !== 'YMCA');
    $('#sec-registro').hidden = s.prog !== 'Todos';
    if ($('#blk-semaforo')) $('#blk-semaforo').hidden = !(FEAT.semaforo && s.prog === 'Todos');
    M.accent = M.PROGC[s.prog];
    $('#m').style.setProperty('--accent', M.accent);
    $('#h-comun').textContent = s.prog === 'Todos' ? 'Resumen regional consolidado' : 'Resumen de ' + FULL[s.prog];
    $('#h-historico').textContent = 'Resumen histórico de la implementación' + (s.prog === 'Todos' ? '' : ' · ' + FULL[s.prog]);
    // section index
    const jump = $('#jump'); jump.replaceChildren();
    document.querySelectorAll('#m > section.m-sec:not([hidden]) .m-sec-h').forEach((hd) => {
      const h3 = hd.querySelector('h3'); if (!h3 || hd.closest('[hidden]')) return;
      const b = M.el('button', null, h3.textContent.trim()); b.type = 'button';
      b.addEventListener('click', () => hd.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      jump.append(b);
    });
  }
  function drawPeriods(s) {
    const lab = periodText(s), hist = 'Todos los ciclos · ' + (s.ymca === T ? 'todas las YMCA' : s.ymca);
    document.querySelectorAll('#m section.m-sec:not([hidden]) .m-card').forEach((card) => {
      let p = card.querySelector(':scope > .m-period');
      if (!p) { p = M.el('span', 'm-period'); card.insertBefore(p, card.firstChild); }
      p.textContent = card.closest('#sec-historico') ? hist : lab;
      p.hidden = card.dataset.period === 'none';
    });
    document.querySelectorAll('#bloque-comun .m-mini').forEach((m, i) => { m.textContent = (i === 0 ? 'Alcance' : 'Cobertura y población') + ' · ' + lab; });
  }

  // ---------- header ----------
  function drawHeader(s) {
    const P = PROGS[s.prog];
    $('#prog-kicker').textContent = P.kicker;
    $('#prog-name').textContent = P.name;
    $('#prog-sub').textContent = P.sub;
    const box = $('#donantes'); box.replaceChildren();
    if (!ok('implementaciones')) return;
    const ir = rows('implementaciones').filter((r) => (YEARLY(s.prog) || r.programa === s.prog || (s.prog === 'After School' && r.programa === 'Bluedrop')) && inSel(r, YEARLY(s.prog) ? H : s.ciclo, s.ymca)
      && (s.ciclo === H || !YEARLY(s.prog) || r.ciclo === conv(s.ciclo, r.programa)));
    const don = [...new Set(ir.flatMap((r) => r.donantes.split(' · ')))].sort();
    box.append(M.el('span', 'm-tag-l', don.length > 1 ? 'Donantes' : 'Donante'));
    if (!don.length) box.append(M.el('span', 'm-tag-l', 'sin registro en esta selección'));
    don.forEach((d) => box.append(M.el('span', 'm-tag', d)));
  }
  function drawTakeaway(s) {
    const el = $('#takeaway'); el.replaceChildren();
    if (!ok('kpis')) { el.append(M.el('span', 'dash-skeleton', '—')); return; }
    const p = s.dp;
    const b = (pp, c, ind, fmt) => { const r = kget(pp, c, s.ymca, ind); const x = M.el('b', null, r && r.valor != null ? (fmt || M.num)(r.valor) : 's/d'); if (r && r.valor != null) M.mark(x, 'kpis', 'valor', kwhere(pp, c, s.ymca, ind)); return x; };
    const when = s.ciclo === H ? 'Desde la primera edición' : (YEARLY(s.prog) ? 'En ' : 'En el ciclo ') + s.ciclo;
    const part = kget(p, s.ciclo, s.ymca, 'participantes'), fon = kget(p, s.ciclo, s.ymca, 'fondos_usd');
    if (!part && !fon) { el.textContent = 'Sin información para esta selección.'; return; }
    const who = s.ymca !== T ? s.ymca : p === 'Todos' ? 'los programas, proyectos e iniciativas regionales' : FULL[p];
    const pl = s.ymca === T && p === 'Todos';
    const where = () => (s.ymca === T && kget(p, s.ciclo, T, 'ymcas') ? [' en ', b(p, s.ciclo, 'ymcas'), ' YMCA de ', b(p, s.ciclo, 'paises'), ' países'] : []);
    el.append(when + ', ' + who + ' ');
    if (part) {
      el.append(pl ? 'llegaron a ' : 'llegó a ', b(p, s.ciclo, 'participantes'), ' participantes', ...where());
      if (fon) el.append(', con ', b(p, s.ciclo, 'fondos_usd', M.usd), ' asignados');
      el.append('.');
    } else {
      el.append(pl ? 'tuvieron ' : 'tuvo ', b(p, s.ciclo, 'fondos_usd', M.usd), ' asignados', ...where(), '.');
    }
    if (YEARLY(s.prog) && s.ymca !== T) {
      const parts = PROGS5.map((pp) => { const c = conv(s.ciclo, pp); const r = kget(pp, c, s.ymca, 'fondos_usd'); return r ? [pp, c, r] : null; }).filter(Boolean);
      if (parts.length) {
        el.append(' Fondos por programa: ');
        parts.forEach(([pp, c, r], i) => { const x = M.el('b', null, M.usd(r.valor)); M.mark(x, 'kpis', 'valor', kwhere(pp, c, s.ymca, 'fondos_usd')); el.append((i ? ' · ' : '') + FULL[pp] + ' ', x); });
        el.append('.');
      }
    }
  }

  // ---------- age & gender ----------
  const ageRows = (p, seg, c, y) => rows('edad_genero').filter((r) => r.programa === p && r.segmento === seg && r.ciclo === c && r.ymca === y);
  const missingAge = (p, seg) => cyclesOf(p).filter((c) => !rows('edad_genero').some((r) => r.programa === p && r.segmento === seg && r.ciclo === c));
  function ageGender(pyrEl, donEl, p, seg, s, cats, c) {
    const cc = c || s.ciclo;
    const a = M.box(pyrEl, ['edad_genero']); const d = donEl ? M.box(donEl, ['edad_genero']) : true;
    if (!a || !d) return;
    let rs = ageRows(p, seg, cc, s.ymca);
    if (!rs.length) { M.note(pyrEl, 'Sin información'); if (donEl) M.note(donEl, 'Sin información'); return; }
    const body = rs.filter((r) => r.rango_edad !== 'Todas');
    M.drawPyramid(pyrEl, p === 'Todos' ? M.toAges4(body) : body, cats);
    if (donEl) M.drawDonut(donEl, rs.filter((r) => r.rango_edad === 'Todas'));
  }

  // ---------- common block ----------
  function drawCommon(s) {
    const p = s.dp;
    $('#k-part-l').textContent = 'Participantes';
    kpiPair('k-part', p, s, 'participantes');
    const sub = $('#k-part-s'); sub.replaceChildren();
    if (p === 'Eleva' && ok('kpis')) {
      const j = M.el('span'), a = M.el('span'); setKpi(j, p, s.ciclo, s.ymca, 'participantes_jovenes', M.num); setKpi(a, p, s.ciclo, s.ymca, 'participantes_adultos', M.num);
      sub.append('Grupo de jóvenes ', j, ' · Grupo de adultos ', a);
    }
    $('#k-fondos-l').textContent = p === 'After School' ? 'Fondos asignados a las YMCA (subvenciones)' : 'Fondos asignados';
    kpiPair('k-fondos', p, s, 'fondos_usd', M.usd);
    const fs = $('#k-fondos-s'); fs.replaceChildren();
    if (p === 'After School') { const t = M.el('span'); setKpi(t, p, s.ciclo, T, 'patrocinio_usd', M.usd); fs.append('Patrocinio CIBC del ' + (s.ciclo === H ? 'periodo' : 'ciclo') + ': ', t); }
    setKpi($('#k-ymcas'), p, s.ciclo, s.ymca, 'ymcas', M.num);
    setKpi($('#k-paises'), p, s.ciclo, s.ymca, 'paises', M.num);
    setKpi($('#k-ciudades'), p, s.ciclo, s.ymca, 'ciudades', M.num);

    // map: small; when one YMCA is selected only its location is listed
    const mapEl = $('#ch-mapa'), list = $('#map-list'); list.replaceChildren();
    const md = M.box(mapEl, ['implementaciones', 'mapa_base']);
    $('#s-mapa').textContent = s.ymca === T ? 'Países pintados donde hay implementación. Pasa el cursor por un punto para ver ciclos y comunidad.' : 'Ubicación del movimiento.';
    mapEl.hidden = s.ymca !== T;
    if (md) {
      const [impl, shapes] = md;
      const ir = impl.filter((r) => (YEARLY(s.prog) || r.programa === p || (p === 'After School' && r.programa === 'Bluedrop')) && (s.ymca === T || r.ymca === s.ymca)
        && (s.ciclo === H || r.ciclo === (YEARLY(s.prog) ? conv(s.ciclo, r.programa) : s.ciclo)));
      const g = d3.groups(ir, (r) => r.ymca + '|' + r.ciudad).map(([, rs]) => {
        const f = rs[0]; const byP = d3.groups(rs, (r) => r.programa);
        const lines = byP.map(([pp, prs]) => ({ text: FULL[pp] + ' · ciclos ' + [...new Set(prs.map((r) => r.ciclo))].sort().join(', '), color: pc(pp) }));
        const com = rs.slice().sort((a, b) => b.ciclo.localeCompare(a.ciclo))[0].comunidad;
        if (p !== 'Todos') lines.push({ text: com || 'Comunidad: sin información' });
        return { ymca: f.ymca, ciudad: f.ciudad, pais: f.pais, lat: f.lat, lon: f.lon, prog: byP[0][0], lines };
      });
      if (s.ymca === T) M.drawMap(mapEl, shapes, g, (d) => (p === 'Todos' ? pc(d.prog) : M.accent), { countries: [...new Set(g.map((d) => d.pais))], landColor: M.BRAND.celeste });
      if (p === 'Todos' && s.ymca === T) {
        const lg = M.el('ul', 'm-legend m-legend-row');
        [...new Set(ir.map((r) => r.programa))].sort((a, b) => PROGS5.indexOf(a) - PROGS5.indexOf(b)).forEach((pp) => { const li = M.el('li'); const sw = M.el('span', 'm-sw'); sw.style.background = pc(pp); li.append(sw, M.el('span', null, FULL[pp])); lg.append(li); });
        list.append(lg);
      }
      const places = $('#map-places'); places.replaceChildren();
      const groups = d3.groups(g, (d) => d.pais).sort((a, b) => a[0].localeCompare(b[0]));
      if (groups.length) places.append(M.el('b', 'm-places-l', 'Países y ciudades: '));
      groups.forEach(([pais, cs], i) => { const sp = M.el('span'); sp.append(M.el('b', null, pais), ' ' + [...new Set(cs.map((c) => c.ciudad))].join(', ') + (i < groups.length - 1 ? ' · ' : '')); places.append(sp); });
    }

    // age & gender
    const cats = p === 'Todos' ? M.AGES4.map((a) => a[0]) : M.AGES;
    const miss = missingAge(p, p === 'Eleva' ? 'Jóvenes' : 'Participantes');
    $('#s-piramide').textContent = (p === 'Todos' ? 'Rangos de edad agrupados para el consolidado regional. ' : '') + (miss.length && miss.length < cyclesOf(p).length ? 'Sin datos de edad y género para ' + miss.join(', ') + '; el histórico solo incluye los ciclos con dato.' : '');
    ['#l-gen1', '#l-gen2', '#ch-genero2'].forEach((q) => { $(q).hidden = p !== 'Eleva'; });
    document.querySelector('.m-grid-cob').classList.toggle('is-eleva', p === 'Eleva');
    $('#h-genero').textContent = p === 'Eleva' ? 'Género por grupo' : 'Género';
    $('#s-genero').textContent = '';
    if (p === 'Eleva') {
      const pe = $('#ch-piramide');
      if (M.box(pe, ['edad_genero'])) {
        const j = ageRows(p, 'Jóvenes', s.ciclo, s.ymca), a = ageRows(p, 'Adultos', s.ciclo, s.ymca);
        if (!j.length && !a.length) M.note(pe, 'Sin información');
        else M.drawPyramid(pe, [], M.AGES, { groups: [{ name: 'Grupo de jóvenes', color: M.BRAND.celeste, rows: j.filter((r) => r.rango_edad !== 'Todas') }, { name: 'Grupo de adultos', color: M.BRAND.morado, rows: a.filter((r) => r.rango_edad !== 'Todas') }] });
        $('#s-piramide').textContent = 'Cada barra separa al grupo de jóvenes y al de adultos: una persona se cuenta en el grupo en que participa, aunque su edad sea la del otro.';
      }
      const g1 = $('#ch-genero'), g2 = $('#ch-genero2');
      if (M.box(g1, ['edad_genero'])) { const r = ageRows(p, 'Jóvenes', s.ciclo, s.ymca).filter((x) => x.rango_edad === 'Todas'); r.length ? M.drawDonut(g1, r) : M.note(g1, 'Sin información'); }
      if (M.box(g2, ['edad_genero'])) { const r = ageRows(p, 'Adultos', s.ciclo, s.ymca).filter((x) => x.rango_edad === 'Todas'); r.length ? M.drawDonut(g2, r) : M.note(g2, 'Sin información'); }
    } else ageGender($('#ch-piramide'), $('#ch-genero'), p, 'Participantes', s, cats);
  }

  function drawHistory(s) {
    const p = s.dp, cyc = cyclesOf(p);
    const ys = s.ymca === T ? 'Todas las YMCA.' : s.ymca + '.';
    $('#s-part-ciclo').textContent = ys + (p === 'Eleva' ? ' Separado por grupo.' : '');
    $('#s-fondos-ciclo').textContent = ys;
    const e1 = $('#ch-part-ciclo'), e2 = $('#ch-fondos-ciclo');
    const v = (pp, ind) => cyc.map((c) => ({ ciclo: c, v: (kget(pp, c, s.ymca, ind) || {}).valor }));
    if (M.box(e1, ['kpis'])) {
      if (p === 'Eleva') M.drawCycleBars(e1, cyc, [{ name: 'Grupo de jóvenes', color: M.BRAND.celeste, values: v(p, 'participantes_jovenes') }, { name: 'Grupo de adultos', color: M.BRAND.morado, values: v(p, 'participantes_adultos') }], null, M.num, { stacked: true });
      else M.drawCycleBars(e1, cyc, [{ name: 'Participantes', color: M.accent, values: v(p, 'participantes') }], null, M.num);
    }
    if (M.box(e2, ['kpis'])) M.drawCycleBars(e2, cyc, [{ name: 'Fondos', color: M.accent, values: v(p, 'fondos_usd') }], null, M.usdShort);
  }

  // ---------- shared section pieces ----------
  function listCommunity(el, prog, s) {
    if (!M.box(el, ['implementaciones'])) return;
    const ir = latestPer(rows('implementaciones').filter((r) => r.programa === prog && inSel(r, s.ciclo, s.ymca)));
    if (!ir.length) { M.note(el, 'Sin información'); return; }
    const w = M.el('div', 'm-hbars');
    ir.forEach((r) => { const f = M.el('div', 'm-hb'); f.append(M.el('strong', null, r.ymca + ' · ' + r.ciudad), M.el('span', 'm-foot', r.comunidad || 'Sin información')); w.append(f); });
    el.append(w);
  }
  function listAlliances(el, prog, s, withObj) {
    if (!M.box(el, ['alianzas'])) return;
    const ar = rows('alianzas').filter((r) => r.programa === prog && inSel(r, s.ciclo, s.ymca));
    if (!ar.length) { M.note(el, 'Sin información'); return; }
    const w = M.el('div', 'm-hbars');
    d3.groups(ar, (r) => r.ymca).sort((a, b) => a[0].localeCompare(b[0])).forEach(([y, rs]) => {
      const f = M.el('div', 'm-hb'); f.append(M.el('strong', null, y));
      if (withObj) {
        const ul = M.el('ul', 'm-legend');
        d3.groups(rs, (r) => r.institucion).forEach(([inst, irs]) => { const li = M.el('li'); li.style.gridTemplateColumns = '1fr'; li.append(M.el('span', null, inst + ' — ' + [...new Set(irs.map((r) => r.objetivo))].join('; ') + (s.ciclo === H ? ' (' + [...new Set(irs.map((r) => r.ciclo))].join(', ') + ')' : ''))); ul.append(li); });
        f.append(ul);
      } else f.append(M.chips([...new Set(rs.map((r) => r.institucion))]));
      w.append(f);
    });
    el.append(w);
  }
  function gantt(el, prog, s, colorOf) {
    el.closest('.m-card').hidden = s.ciclo === H;
    if (s.ciclo === H || !M.box(el, ['cronograma'])) return;
    const rs = rows('cronograma').filter((r) => r.programa === prog && inSel(r, s.ciclo, s.ymca));
    if (!rs.length) { M.note(el, 'Sin información'); return; }
    const idx = new Map(); d3.groups(rs, (r) => r.ymca).forEach(([, g]) => g.filter((r) => r.tipo === 'periodo').sort((a, b) => a.inicio.localeCompare(b.inicio)).forEach((r, i) => idx.set(r, i)));
    M.drawGantt(el, rs, (r) => colorOf(r, idx.get(r) || 0));
  }
  const SV = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.5 6 4.4 0 1.3-1.3 2.4-3 2.4-1.4 0-2.6-.6-3.2-1.6M12 6v2M12 16v2"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.9.4 5 2.8 5 5.8"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/></svg>',
  };
  const ICOLORS = [M.BRAND.celeste, M.BRAND.verde, M.BRAND.rosa, M.BRAND.morado, M.BRAND.amarillo, M.BRAND.frambuesa, M.BRAND.azul];
  function frow(icon, label, content, i) {
    const r = M.el('div', 'm-frow');
    const ic = M.el('span'); ic.innerHTML = SV[icon]; ic.style.color = ICOLORS[i % ICOLORS.length];
    const box = M.el('div'); box.append(M.el('span', 'm-k', label));
    if (content == null || content === '') box.append(M.el('span', 'm-na-txt', 'Sin información'));
    else if (typeof content === 'string') box.append(M.el('span', null, content));
    else box.append(content);
    r.append(ic, box); return r;
  }
  const splitOr = (v) => (v ? v.split('|') : null);
  const Ylist = (prog, s) => {
    const ir = rows('implementaciones').filter((r) => r.programa === prog && inSel(r, s.ciclo, s.ymca));
    return s.ciclo === H ? latestPer(ir) : ir.sort((a, b) => a.ymca.localeCompare(b.ymca));
  };

  // ---------- regional ----------
  function drawRegional(s) {
    const lp = $('#l-programas');
    if (M.box(lp, ['kpis'])) {
      MAIN.forEach((pp) => {
        const c = conv(s.ciclo, pp);
        const card = M.el('div', 'm-pcard'); card.style.setProperty('--tc', M.PROGC[pp]);
        const hd = M.el('div', 'm-pcard-h'); hd.append(M.el('span', 'm-dot'), M.el('span', null, FULL[pp]));
        const st = M.el('div', 'm-pstats');
        [['participantes', 'participantes', M.num], ['ymcas', 'YMCA', M.num], ['fondos_usd', 'fondos', M.usdShort]].forEach(([ind, lab, f]) => {
          const x = M.el('div', 'm-pstat'); const v = M.el('b'); setKpi(v, pp, c, s.ymca, ind, f); if (v.classList.contains('is-na')) { v.textContent = '—'; v.classList.remove('is-na'); }
          x.append(v, M.el('span', null, lab)); st.append(x);
        });
        const b = M.el('button', 'm-pbtn', 'Ver ' + FULL[pp] + ' →'); b.type = 'button';
        b.addEventListener('click', () => { goProg(pp); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        card.append(hd, M.el('p', null, CARD[pp]), M.el('p', 'm-foot', s.ciclo === H ? 'Todos los ciclos' : 'Ciclo ' + c), st);
        card.append(b); lp.append(card);
      });
    }
    const item = (pp, ind) => { const c = conv(s.ciclo, pp); const r = kget(pp, c, s.ymca, ind); return { label: FULL[pp] + (s.ciclo !== H && c !== s.ciclo ? ' (' + c + ')' : ''), value: r ? r.valor : null, color: pc(pp), mark: r ? { source: 'kpis', field: 'valor', where: kwhere(pp, c, s.ymca, ind) } : null }; };
    const e1 = $('#ch-prog-part'), e2 = $('#ch-prog-fondos');
    if (M.box(e1, ['kpis'])) M.hbars(e1, MAIN.map((pp) => item(pp, 'participantes')), M.num);
    if (M.box(e2, ['kpis'])) M.hbars(e2, [...MAIN, 'Bluedrop'].map((pp) => item(pp, 'fondos_usd')), M.usd);
    // data register
    const tb = $('#t-registro tbody'); tb.replaceChildren();
    rows('registro_datos').forEach((r) => {
      const tr = M.el('tr'); tr.dataset.key = r.id;
      const est = M.el('td'); est.append(M.el('span', { 'Real': 'm-tag-real', 'Ejemplo': 'm-tag-ej', 'Sin información': 'm-tag-si', 'Mixto': 'm-tag-mx' }[r.estado] || 'm-tag-si', r.estado));
      tr.append(M.el('td', null, r.programa), M.el('td', null, r.informacion), est, M.el('td', null, r.fuente), M.el('td', null, r.nota || ''));
      tb.append(tr);
    });
  }

  // reporting status ("semáforo")
  let IX = null, ixKey = null;
  const RIDS = ['kpis', 'edad_genero', 'implementaciones', 'cronograma', 'alianzas', 'perfil_after_school', 'perfil_bluedrop', 'perfil_tejiendo_paz', 'eventos_delta'];
  function reportIndex() {
    const key = RIDS.map((id) => dash.data(id).data);
    if (ixKey && key.every((d, i) => d === ixKey[i])) return IX;
    ixKey = key;
    const set = (rs, f) => new Set(rs.map(f));
    IX = {
      eg: set(rows('edad_genero').filter((r) => r.rango_edad === 'Todas'), (r) => r.programa + '|' + r.segmento + '|' + r.ciclo + '|' + r.ymca),
      impl: set(rows('implementaciones'), (r) => r.programa + '|' + r.ciclo + '|' + r.ymca),
      com: set(rows('implementaciones').filter((r) => r.comunidad), (r) => r.programa + '|' + r.ciclo + '|' + r.ymca),
      cron: set(rows('cronograma'), (r) => r.programa + '|' + r.ciclo + '|' + r.ymca),
      ali: set(rows('alianzas'), (r) => r.programa + '|' + r.ciclo + '|' + r.ymca),
      asHi: set(rows('perfil_after_school').filter((r) => r.hello_insight), (r) => r.ciclo + '|' + r.ymca),
      asAr: set(rows('perfil_after_school').filter((r) => r.areas), (r) => r.ciclo + '|' + r.ymca),
      bd: set(rows('perfil_bluedrop').filter((r) => r.habilidades), (r) => r.ciclo + '|' + r.ymca),
      tp: set(rows('perfil_tejiendo_paz'), (r) => r.ciclo + '|' + r.ymca),
      ev: set(rows('eventos_delta'), (r) => r.ciclo + '|' + r.ymca),
    };
    return IX;
  }
  const kHas = (p, i) => (c, y) => { const r = kget(p, c, y, i); return !!(r && r.valor != null); };
  const REQ = (() => {
    const base = (p) => [['Participantes', kHas(p, 'participantes')], ['Edad y género', (c, y) => IX.eg.has(p + '|' + (p === 'Eleva' ? 'Jóvenes' : 'Participantes') + '|' + c + '|' + y)], ['Fondos', kHas(p, 'fondos_usd')]];
    const com = (p) => ['Comunidad', (c, y) => IX.com.has(p + '|' + c + '|' + y)];
    const cron = (p) => ['Cronograma', (c, y) => IX.cron.has(p + '|' + c + '|' + y)];
    const ali = (p) => ['Alianzas', (c, y) => IX.ali.has(p + '|' + c + '|' + y)];
    return {
      'Eleva': [...base('Eleva'), com('Eleva'), cron('Eleva'), ['Equipo', kHas('Eleva', 'pares')], ['Talleres', kHas('Eleva', 'talleres_jovenes')], ['Tasa de finalización', kHas('Eleva', 'tasa_fin_jovenes')], ['Acompañamiento', kHas('Eleva', 'acomp_total')], ['Sensibilización comunitaria', kHas('Eleva', 'personas_alcanzadas')], ali('Eleva')],
      'After School': [...base('After School'), com('After School'), cron('After School'), ['Grupos y locaciones', kHas('After School', 'grupos')], ['Hello Insight', (c, y) => IX.asHi.has(c + '|' + y)], ['Días, áreas y uso de fondos', (c, y) => IX.asAr.has(c + '|' + y)]],
      'Bluedrop': [...base('Bluedrop'), ['Dispositivos', kHas('Bluedrop', 'dispositivos')], ['Habilidades y actividades', (c, y) => IX.bd.has(c + '|' + y)]],
      'Tejiendo Paz': [...base('Tejiendo Paz'), com('Tejiendo Paz'), cron('Tejiendo Paz'), ['Jóvenes líderes', kHas('Tejiendo Paz', 'lideres')], ['Tipo de violencia y grupos prioritarios', (c, y) => IX.tp.has(c + '|' + y)], ali('Tejiendo Paz')],
      'Delta': [...base('Delta'), cron('Delta'), ['Eventos y narrativa', (c, y) => IX.ev.has(c + '|' + y)]],
    };
  })();
  function report(p, c, y) {
    reportIndex();
    const cs = c === H ? cyclesOf(p) : [conv(c, p)];
    const part = cs.filter((cc) => IX.impl.has(p + '|' + cc + '|' + y));
    if (!part.length) return null;
    let okN = 0, tot = 0; const missing = [];
    part.forEach((cc) => REQ[p].forEach(([name, f]) => { tot++; if (f(cc, y)) okN++; else missing.push(c === H || cc !== c ? name + ' (' + cc + ')' : name); }));
    return { pct: okN / tot, okN, tot, missing };
  }
  const pillCls = (pct) => (pct >= 0.999 ? 'ok' : pct >= 0.7 ? 'warn' : 'bad');
  function drawSemaforo(s) {
    const et = $('#t-semaforo'), det = $('#semaforo-det'); det.textContent = '';
    if (!M.box(et, RIDS)) return;
    const ys = ymcasOf('Todos').filter((y) => s.ymca === T || y === s.ymca);
    const tb = M.el('table', 'm-sema'); const thead = M.el('thead'); const hr = M.el('tr');
    hr.append(M.el('th', null, 'YMCA')); PROGS5.forEach((p) => hr.append(M.el('th', null, FULL[p]))); thead.append(hr); tb.append(thead);
    const body = M.el('tbody'); let full = 0, all = 0;
    ys.forEach((y) => {
      const r0 = PROGS5.map((p) => report(p, s.ciclo, y));
      if (r0.every((r) => !r)) return;
      const tr = M.el('tr'); tr.append(M.el('td', null, y));
      PROGS5.forEach((p, i) => {
        const td = M.el('td'); const r = r0[i];
        if (!r) td.append(M.el('span', 'm-na', '—'));
        else {
          all++; if (r.pct >= 0.999) full++;
          const b = M.el('button', 'm-pill ' + pillCls(r.pct), M.pct(r.pct)); b.type = 'button';
          b.setAttribute('aria-label', `${y}, ${FULL[p]}: ${M.pct(r.pct)} reportado`);
          b.addEventListener('click', () => { det.textContent = `${y} · ${FULL[p]} · ${s.ciclo === H ? 'histórico' : 'ciclo ' + conv(s.ciclo, p)}: ` + (r.missing.length ? 'falta ' + r.missing.join(', ') + '.' : 'reporte completo.'); });
          td.append(b);
        }
        tr.append(td);
      });
      body.append(tr);
    });
    tb.append(body); et.append(tb);
    const lg = M.el('div', 'm-legend-sema');
    [['ok', '100%: completo'], ['warn', '70–99%: le falta algo'], ['bad', 'menos de 70%: requiere seguimiento']].forEach(([c, t]) => { const x = M.el('span'); x.append(M.el('span', 'm-pill ' + c, ' '), ' ' + t); lg.append(x); });
    lg.append(M.el('span', null, '— : no participa'));
    et.append(lg);
    $('#s-semaforo').textContent = `${full} de ${all} reportes completos.`;
  }

  // ---------- Eleva ----------
  function drawEleva(s) {
    const p = 'Eleva';
    kpiPair('k-pares', p, s, 'pares'); kpiPair('k-vol', p, s, 'voluntarios'); kpiPair('k-prof', p, s, 'profesionales');
    const eq = $('#ch-equipo');
    if (M.box(eq, ['edad_genero'])) { const rs = ageRows(p, s.equipo, s.ciclo, s.ymca).filter((r) => r.rango_edad !== 'Todas'); rs.length ? M.drawPyramid(eq, rs, M.AGES.slice(5, 10).filter((c) => rs.some((r) => r.rango_edad === c))) : M.note(eq, 'Sin información'); }
    gantt($('#ch-crono-eleva'), p, s, (r, i) => M.PAL[i % 8]);
    listCommunity($('#l-com-eleva'), p, s);
    listAlliances($('#l-ali-eleva'), p, s, false);
    kpiPair('k-tal-j', p, s, 'talleres_jovenes'); kpiPair('k-tal-a', p, s, 'talleres_adultos');
    kpiPair('k-tasa-j', p, s, 'tasa_fin_jovenes', M.pct, 'rate'); kpiPair('k-tasa-a', p, s, 'tasa_fin_adultos', M.pct, 'rate');
    const ra = kpiPair('k-acomp', p, s, 'acomp_total');
        const ea = $('#ch-acomp');
    if (M.box(ea, ['kpis'])) {
      const it = [['acomp_no_profesional', 'No profesional (mentorías, tutorías)'], ['acomp_psicologico', 'Psicológico en la YMCA'], ['acomp_canalizacion', 'Canalización a instituciones psicológicas']]
        .map(([i, l], n) => { const r = kget(p, s.ciclo, s.ymca, i); return { label: l, value: r ? r.valor : null, color: [M.BRAND.celeste, M.BRAND.morado, M.BRAND.rosa][n], mark: r ? { source: 'kpis', field: 'valor', where: kwhere(p, s.ciclo, s.ymca, i) } : null }; });
      it.every((d) => d.value == null) ? M.note(ea, 'Sin información') : M.hbars(ea, it, M.num);
    }
    kpiPair('k-actcom', p, s, 'act_comunitarias'); kpiPair('k-alc', p, s, 'personas_alcanzadas');
    const el = $('#ch-alc-edad');
    if (M.box(el, ['edad_genero'])) {
      const rs = M.toAges4(ageRows(p, 'Comunidad alcanzada', s.ciclo, s.ymca).filter((r) => r.rango_edad !== 'Todas'));
      if (!rs.length) M.note(el, 'Sin información');
      else M.hbars(el, M.AGES4.map(([a], i) => ({ label: a, value: d3.sum(rs.filter((r) => r.rango_edad === a), (r) => r.n), color: [M.BRAND.celeste, M.BRAND.verde, M.BRAND.amarillo, M.BRAND.morado][i] })), M.num);
    }
  }

  // ---------- After School Programme ----------
  function drawAS(s) {
    const p = 'After School';
    const ys = Ylist(p, s);
    const prof = rows('perfil_after_school'); const cron = rows('cronograma').filter((r) => r.programa === p);
    const fl = $('#l-fichas-as');
    $('#s-fichas-as').textContent = 'Estructura del reporte al donante.' + (s.ciclo === H ? ' Histórico: se muestra el ciclo más reciente de cada YMCA.' : '');
    if (M.box(fl, ['perfil_after_school', 'implementaciones', 'kpis', 'cronograma'])) {
      if (!ys.length) M.note(fl, 'Sin información');
      ys.forEach((im) => {
        const r = prof.find((q) => q.ymca === im.ymca && q.ciclo === im.ciclo) || {};
        const f = M.el('div', 'm-ficha'); f.style.borderTopColor = ICOLORS[ys.indexOf(im) % ICOLORS.length];
        f.append(M.el('h5', null, im.ymca + ' · ciclo ' + im.ciclo));
        const fv = M.el('b'); setKpi(fv, p, im.ciclo, im.ymca, 'fondos_usd', M.usd, 'Sin información');
        f.append(frow('money', 'Fondos asignados', fv, 0));
        const per = cron.filter((q) => q.ymca === im.ymca && q.ciclo === im.ciclo).sort((a, b) => a.inicio.localeCompare(b.inicio));
        f.append(frow('cal', 'Periodos', per.length ? per.map((q) => q.etiqueta + ': ' + M.fDate(M.date(q.inicio)) + ' – ' + M.fDate(M.date(q.fin))).join(' · ') : null, 1));
        f.append(frow('book', 'Formato y Hello Insight', r.formato ? M.chips([r.formato, 'Hello Insight: ' + r.hello_insight]) : null, 2));
        f.append(frow('people', 'Tipo de ciclo y continuidad', r.tipo_ciclo ? r.tipo_ciclo + '. ' + r.continuidad + '.' : null, 3));
        const g = kget(p, im.ciclo, im.ymca, 'grupos'), l = kget(p, im.ciclo, im.ymca, 'locaciones');
        f.append(frow('pin', 'Grupos y locaciones', g && l ? g.valor + ' grupos en ' + l.valor + ' locaciones' + (r.locaciones_texto ? ': ' + r.locaciones_texto : '') : null, 4));
        f.append(frow('cal', 'Días', r.dias ? M.days(r.dias) : null, 5));
        f.append(frow('home', 'Comunidad', r.comunidad || im.comunidad, 6));
        f.append(frow('book', 'Áreas', r.areas ? M.chips(r.areas.split('|')) : null, 0));
        f.append(frow('money', 'Uso de fondos', r.uso_fondos ? M.chips(r.uso_fondos.split('|')) : null, 1));
        f.append(frow('hand', 'Contrapartida', r.otros_donantes || 'No se tiene información', 2));
        fl.append(f);
      });
    }
    gantt($('#ch-crono-as'), p, s, (r, i) => [M.BRAND.verde, M.BRAND.celeste, M.BRAND.amarillo][i % 3]);
    setKpi($('#k-grupos'), p, s.ciclo, s.ymca, 'grupos', M.num, 'Sin información');
    setKpi($('#k-locs'), p, s.ciclo, s.ymca, 'locaciones', M.num, 'Sin información');
    const rc = setKpi($('#k-contra'), p, s.ciclo, s.ymca, 'contrapartida_usd', M.usd, 'Sin información');
    $('#k-contra-s').textContent = '';
    // sponsorship split (program level)
    const ep = $('#ch-patrocinio');
    if (M.box(ep, ['kpis'])) {
      const it = [['fondos_usd', 'Subvenciones a las YMCA', M.BRAND.verde], ['hello_insight_usd', 'Hello Insight', M.BRAND.celeste], ['admin_usd', 'Gastos administrativos', M.BRAND.amarillo]]
        .map(([i, l, c]) => { const r = kget(p, s.ciclo, T, i); return { label: l, value: r ? r.valor : null, color: c, mark: r ? { source: 'kpis', field: 'valor', where: kwhere(p, s.ciclo, T, i) } : null }; });
      it.every((d) => d.value == null) ? M.note(ep, 'Sin información') : M.hbars(ep, it, M.usd);
    }
    // Hello Insight
    const hiRows = prof.filter((r) => r.hello_insight && (s.ymca === T || r.ymca === s.ymca) && (s.ciclo === H || r.ciclo === s.ciclo));
    const kh = $('#k-hello'); kh.classList.remove('dash-skeleton');
    if (s.ciclo === H) {
      const allY = [...new Set(hiRows.map((r) => r.ymca))], used = [...new Set(hiRows.filter((r) => r.hello_insight === 'Sí').map((r) => r.ymca))];
      kh.textContent = allY.length ? used.length + ' de ' + allY.length : 'Sin información';
    } else kh.textContent = hiRows.length ? hiRows.filter((r) => r.hello_insight === 'Sí').length + ' de ' + hiRows.length : 'Sin información';
    setKpi($('#k-hello-usd'), p, s.ciclo, T, 'hello_insight_usd', M.usd, 'Sin dato');
    const users = [...new Set(hiRows.filter((r) => r.hello_insight === 'Sí').map((r) => r.ymca.replace('YMCA ', '')))];
    $('#k-hello-s').textContent = users.length ? 'La implementan: ' + users.join(', ') + '.' : '';
    // areas and funds use: which YMCA reports what
    const cols = (field) => ys.map((im) => { const r = prof.find((q) => q.ymca === im.ymca && q.ciclo === im.ciclo); return { name: im.ymca, items: splitOr(r && r[field]) }; });
    const ea = $('#ch-areas'), ef = $('#ch-usofondos');
    if (M.box(ea, ['perfil_after_school'])) ys.length ? M.matrix(ea, AREAS, cols('areas'), M.PAL) : M.note(ea, 'Sin información');
    if (M.box(ef, ['perfil_after_school'])) ys.length ? M.matrix(ef, FONDOS, cols('uso_fondos'), M.PAL) : M.note(ef, 'Sin información');

    // ----- Bluedrop
    const b = 'Bluedrop', bc = cyclesOf(b);
    const off = s.ciclo !== H && !bc.includes(s.ciclo);
    const bn = $('#bd-nota'); bn.hidden = true; void off;
    kpiPair('k-bd-part', b, s, 'participantes');
    setKpi($('#k-bd-disp'), b, s.ciclo, s.ymca, 'dispositivos', M.num, 'Sin información');
    setKpi($('#k-bd-tab'), b, s.ciclo, s.ymca, 'tablets', M.num, 's/i');
    setKpi($('#k-bd-com'), b, s.ciclo, s.ymca, 'computadoras', M.num, 's/i');
    setKpi($('#k-bd-fondos'), b, s.ciclo, s.ymca, 'fondos_usd', M.usd, 'Sin información');
    const bys = Ylist(b, s);
    $('#k-bd-fondos-s').textContent = bys.length ? 'YMCA: ' + bys.map((r) => r.ymca.replace('YMCA ', '')).join(', ') : '';
    const bprof = rows('perfil_bluedrop');
    const bf = $('#l-bd-fichas');
    if (M.box(bf, ['perfil_bluedrop', 'kpis'])) {
      if (!bys.length) M.note(bf, 'Sin información');
      bys.forEach((im, i) => {
        const r = bprof.find((q) => q.ymca === im.ymca && q.ciclo === im.ciclo) || {};
        const f = M.el('div', 'm-ficha'); f.style.borderTopColor = M.PROGC.Bluedrop;
        f.append(M.el('h5', null, im.ymca + ' · ciclo ' + im.ciclo));
        const fv = M.el('b'); setKpi(fv, b, im.ciclo, im.ymca, 'fondos_usd', M.usd, 'Sin información');
        f.append(frow('money', 'Fondos asignados', fv, 0));
        const t = kget(b, im.ciclo, im.ymca, 'tablets'), c = kget(b, im.ciclo, im.ymca, 'computadoras');
        f.append(frow('book', 'Dispositivos', t || c ? (t ? t.valor : 0) + ' tablets · ' + (c ? c.valor : 0) + ' computadoras' : null, 1));
        f.append(frow('pin', 'Modelo', r.modelo, 2));
        f.append(frow('people', 'Programas en que se usan', r.programas_uso, 3));
        bf.append(f);
      });
    }
    ageGender($('#ch-bd-piramide'), $('#ch-bd-genero'), b, 'Participantes', s, M.AGES.slice(0, 7));
    const bcols = (field) => bys.map((im) => { const r = bprof.find((q) => q.ymca === im.ymca && q.ciclo === im.ciclo); return { name: im.ymca, items: splitOr(r && r[field]) }; });
    const eh = $('#ch-bd-hab'), eac = $('#ch-bd-act');
    if (M.box(eh, ['perfil_bluedrop'])) bys.length ? M.matrix(eh, HAB, bcols('habilidades'), M.PAL) : M.note(eh, 'Sin información');
    if (M.box(eac, ['perfil_bluedrop'])) bys.length ? M.matrix(eac, ACT, bcols('actividades'), M.PAL) : M.note(eac, 'Sin información');
  }

  // ---------- Tejiendo Paz ----------
  function drawTP(s) {
    const p = 'Tejiendo Paz';
    kpiPair('k-tp-part', p, s, 'participantes'); kpiPair('k-tp-lid', p, s, 'lideres'); kpiPair('k-tp-act', p, s, 'actividades');
    ageGender($('#ch-tp-piramide'), $('#ch-tp-genero'), p, s.tp, s, s.tp === 'Jóvenes líderes' ? M.AGES_TP : M.AGES.slice(2, 9));
    gantt($('#ch-crono-tp'), p, s, () => M.accent);
    const pr = (() => { const f = rows('perfil_tejiendo_paz').filter((r) => s.ymca === T || r.ymca === s.ymca); return s.ciclo === H ? latestPer(f) : f.filter((r) => r.ciclo === s.ciclo); })();
    $('#s-fichas-tp').textContent = s.ciclo === H ? 'Histórico: se muestra el ciclo más reciente de cada YMCA.' : '';
    const fl = $('#l-fichas-tp');
    if (M.box(fl, ['perfil_tejiendo_paz', 'implementaciones'])) {
      if (!pr.length) M.note(fl, 'Sin información');
      pr.forEach((r, i) => {
        const f = M.el('div', 'm-ficha'); f.style.borderTopColor = ICOLORS[i % ICOLORS.length];
        f.append(M.el('h5', null, r.ymca + (s.ciclo === H ? ' · ciclo ' + r.ciclo : '')));
        f.append(frow('hand', 'Tipo de violencia que decidieron trabajar', M.chips([r.tipo_violencia]), 0));
        const im = rows('implementaciones').find((q) => q.programa === p && q.ymca === r.ymca && q.ciclo === r.ciclo);
        if (im) f.append(frow('home', 'Comunidad · ' + im.ciudad, im.comunidad, 1));
        fl.append(f);
      });
    }
    listAlliances($('#l-ali-tp'), p, s, true);
    const eg = $('#ch-grupos');
    $('#s-grupos').textContent = s.ymca === T ? `Número de YMCA que trabajan con cada grupo (${pr.length} en esta selección).` : 'Grupos con los que trabaja esta YMCA.';
    if (M.box(eg, ['perfil_tejiendo_paz'])) {
      const all = pr.flatMap((r) => r.grupos_prioritarios.split('|').map((x) => { const [cat, g] = x.split('::'); return { cat, g, ymca: r.ymca }; }));
      if (!all.length) { M.note(eg, 'Sin información'); return; }
      d3.groups(all, (d) => d.cat).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cat, gs], i) => {
        eg.append(M.el('div', 'm-hb-cat', cat));
        if (s.ymca !== T) eg.append(M.chips([...new Set(gs.map((d) => d.g))]));
        else M.hbars(eg, d3.rollups(gs, (v) => new Set(v.map((d) => d.ymca)).size, (d) => d.g).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v })), (v) => v + ' de ' + pr.length, { max: pr.length, color: M.PAL[i % 8] });
      });
    }
  }

  // ---------- Delta ----------
  function drawDelta(s) {
    const p = 'Delta';
    kpiPair('k-dl-ev', p, s, 'eventos');
    const ev = rows('eventos_delta').filter((r) => inSel(r, s.ciclo, s.ymca)).sort((a, b) => (a.inicio || '9').localeCompare(b.inicio || '9'));
    const fd = (d) => (d ? M.fDate(M.date(d)) : 'Sin información');
    const kv = $('#k-dl-vol'), ks = $('#k-dl-vol-s');
    if (ok('eventos_delta')) {
      kv.classList.remove('dash-skeleton');
      const ys = [...new Set(ev.map((r) => r.ymca))], yv = [...new Set(ev.filter((r) => r.voluntariado === 'Sí').map((r) => r.ymca))].sort();
      const known = ev.some((r) => r.voluntariado);
      kv.textContent = ys.length && known ? yv.length + ' de ' + ys.length : 'Sin información';
      ks.textContent = yv.length ? yv.join(', ') : '';
    }
    const tb = $('#t-dl tbody'); tb.replaceChildren();
    ev.forEach((r) => {
      const tr = M.el('tr'); tr.dataset.key = r.id;
      [[r.ymca], [r.evento], [r.tipo], [fd(r.inicio)], [fd(r.fin)], [r.participantes == null ? 'Sin información' : M.num(r.participantes), 'n'], [r.fondos_usd == null ? 'Sin información' : M.num(r.fondos_usd), 'n'], [r.voluntariado || 'Sin información']].forEach(([t, c]) => tr.append(M.el('td', c, t)));
      tb.append(tr);
    });
    const lab = (r) => r.evento + ' · ' + r.ymca.replace('YMCA ', '') + (s.ciclo === H ? ' ' + r.ciclo : '');
    const evF = ev.filter((r) => r.fondos_usd != null);
    const e1 = $('#ch-dl-part'), e2 = $('#ch-dl-fondos');
    if (M.box(e1, ['eventos_delta'])) ev.length ? M.hbars(e1, ev.map((r, i) => ({ label: lab(r), value: r.participantes, color: M.PAL[i % 8], mark: { source: 'eventos_delta', field: 'participantes', where: M.where({ id: r.id }) } })), M.num) : M.note(e1, 'Sin información');
    if (M.box(e2, ['eventos_delta'])) evF.length ? M.hbars(e2, evF.map((r, i) => ({ label: lab(r), value: r.fondos_usd, color: M.PAL[i % 8], mark: { source: 'eventos_delta', field: 'fondos_usd', where: M.where({ id: r.id }) } })), M.usd) : M.note(e2, 'Sin información');
    gantt($('#ch-crono-dl'), p, s, () => M.accent);
    const nl = $('#l-dl-narr');
    if (M.box(nl, ['eventos_delta'])) {
      if (!ev.length) M.note(nl, 'Sin información');
      ev.forEach((r, i) => { const f = M.el('div', 'm-ficha'); f.style.borderTopColor = M.PAL[i % 8]; f.append(M.el('h5', null, r.evento), M.el('span', 'm-k', r.ymca + (r.inicio ? ' · ' + fd(r.inicio) : '')), M.el('p', null, r.narrativa)); nl.append(f); });
    }
  }

  // ---------- Perfil por YMCA ----------
  function drawYMCA(s) {
    const y = s.ymca;
    kpiPair('k-y-part', 'Todos', s, 'participantes');
    kpiPair('k-y-fondos', 'Todos', s, 'fondos_usd', M.usd);
    const active = PROGS5.filter((p) => (s.ciclo === H ? cyclesOf(p) : [conv(s.ciclo, p)]).some((c) => rows('implementaciones').some((r) => r.programa === p && r.ciclo === c && r.ymca === y)));
    const kp = $('#k-y-progs'); kp.classList.remove('dash-skeleton');
    kp.textContent = ok('implementaciones') ? String(active.length) : '—';
    $('#k-y-progs-s').textContent = active.map((p) => FULL[p]).join(' · ');
    const lp = $('#l-y-progs');
    if (M.box(lp, ['kpis', 'implementaciones'])) {
      if (!active.length) M.note(lp, 'Sin información');
      active.forEach((p) => {
        const c = conv(s.ciclo, p);
        const card = M.el('div', 'm-pcard'); card.style.setProperty('--tc', M.PROGC[p]);
        const hd = M.el('div', 'm-pcard-h'); hd.append(M.el('span', 'm-dot'), M.el('span', null, FULL[p] + (p === 'Bluedrop' ? ' (dentro de After School Programme)' : '')));
        const st = M.el('div', 'm-pstats');
        [['participantes', 'participantes', M.num], ['fondos_usd', 'fondos', M.usdShort]].forEach(([ind, lab, fm]) => { const x = M.el('div', 'm-pstat'); const v = M.el('b'); setKpi(v, p, c, y, ind, fm); if (v.classList.contains('is-na')) { v.textContent = '—'; v.classList.remove('is-na'); } x.append(v, M.el('span', null, lab)); st.append(x); });
        const cyc = [...new Set(rows('implementaciones').filter((r) => r.programa === p && r.ymca === y).map((r) => r.ciclo))].sort();
        const b = M.el('button', 'm-pbtn', 'Ver en la página del programa →'); b.type = 'button';
        b.addEventListener('click', () => { goProg(p === 'Bluedrop' ? 'After School' : p, y); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        card.append(hd, st, M.el('p', null, 'Ciclos: ' + cyc.join(', ')), b); lp.append(card);
      });
    }
  }

  // «Ampliar»: the chart takes the full width, ready to capture for slides
  function drawExpand() {
    document.querySelectorAll('#m section.m-sec:not([hidden]) .m-card').forEach((card) => {
      if (!card.querySelector('.m-chart, .m-fichas')) return;
      let b = card.querySelector(':scope > .m-exp');
      if (!b) {
        b = M.el('button', 'm-exp'); b.type = 'button';
        b.addEventListener('click', () => { card.classList.toggle('is-big'); renderAll(); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        card.append(b);
      }
      const big = card.classList.contains('is-big');
      b.textContent = big ? 'Reducir' : 'Ampliar';
      b.setAttribute('aria-label', (big ? 'Reducir ' : 'Ampliar ') + ((card.querySelector('h4') || {}).textContent || 'gráfica'));
      b.title = big ? 'Volver al tamaño normal' : 'Ver en grande para presentación';
    });
  }
  const renderAll = () => {
    const s = state();
    drawControls(s);
    drawHeader(s);
    drawTakeaway(s);
    if (s.prog !== 'YMCA') drawCommon(s);
    if (s.ciclo === H && s.prog !== 'YMCA') drawHistory(s);
    if (s.prog === 'Todos') drawRegional(s);
    const sem = $('#blk-semaforo');
    if (sem) { sem.hidden = !(FEAT.semaforo && s.prog === 'Todos'); if (!sem.hidden) drawSemaforo(s); }
    if (s.prog === 'Eleva') drawEleva(s);
    if (s.prog === 'After School') drawAS(s);
    if (s.prog === 'Tejiendo Paz') drawTP(s);
    if (s.prog === 'Delta') drawDelta(s);
    if (s.prog === 'YMCA') drawYMCA(s);
    drawPeriods(s);
    drawExpand();
    ['#s-mapa', '#s-piramide', '#s-genero', '#s-fichas-as', '#s-fichas-tp', '#s-grupos', '#s-part-ciclo', '#s-fondos-ciclo'].forEach((q) => { const e = $(q); if (e) e.textContent = ''; });
  };
  dash.onData(renderAll);
})();
