/*
 * Capa de datos y de estado del dashboard.
 * Sustituye al runtime `dash` del artifact de Claude: mismas llamadas (dash.data, dash.params,
 * dash.setParams, dash.resetParams, dash.setLink, dash.onData) para que la interfaz no cambie,
 * más la conexión en vivo a Google Sheets con sondeo, respaldo local y filtros en la URL.
 */
(function () {
  'use strict';
  const CFG = window.MEL_CONFIG || {};
  const SRC = CFG.source || { type: 'snapshot' };
  const FEAT = Object.assign({ semaforo: true, derivar: true }, CFG.features);
  const LIVE = SRC.type === 'appsScript' || SRC.type === 'gviz';
  const POLL_MS = Math.max(15, CFG.refreshSeconds || 60) * 1000;

  // Columnas de cada dataset (= encabezados de cada pestaña de la hoja).
  // key: columnas que identifican la fila; una fila sin ellas se ignora (filas en blanco de la hoja).
  const SCHEMA = {
    kpis: { cols: ['programa', 'ciclo', 'ymca', 'indicador', 'valor', 'anterior', 'cambio_pct'], num: ['valor', 'anterior', 'cambio_pct'], key: ['programa', 'ciclo', 'ymca', 'indicador'], opt: ['anterior', 'cambio_pct'] },
    implementaciones: { cols: ['programa', 'ciclo', 'ymca', 'pais', 'ciudad', 'lat', 'lon', 'comunidad', 'donantes'], num: ['lat', 'lon'], key: ['programa', 'ciclo', 'ymca'] },
    cronograma: { cols: ['programa', 'ciclo', 'ymca', 'etiqueta', 'tipo', 'inicio', 'fin', 'categoria', 'estado', 'modalidad', 'sede'], date: ['inicio', 'fin'], key: ['programa', 'ciclo', 'ymca', 'inicio', 'fin'], opt: ['categoria', 'estado', 'modalidad', 'sede'] },
    edad_genero: { cols: ['programa', 'segmento', 'ciclo', 'ymca', 'rango_edad', 'genero', 'n', 'metodo'], num: ['n'], key: ['programa', 'ciclo', 'ymca', 'rango_edad', 'genero'], opt: ['metodo'] },
    alianzas: { cols: ['programa', 'ciclo', 'ymca', 'institucion', 'objetivo', 'tipo_institucion', 'aporte', 'otros_aportes', 'detalle', 'personas', 'formalizacion', 'estado', 'desde', 'alcance', 'direccion', 'sede'],
      num: ['personas'], key: ['programa', 'ciclo', 'ymca', 'institucion'], opt: ['objetivo', 'tipo_institucion', 'aporte', 'otros_aportes', 'detalle', 'personas', 'formalizacion', 'estado', 'desde', 'alcance', 'direccion', 'sede'] },
    perfil_after_school: { cols: ['ciclo', 'ymca', 'formato', 'hello_insight', 'tipo_ciclo', 'continuidad', 'inicio', 'fin', 'locaciones_texto', 'dias', 'areas', 'uso_fondos', 'otros_donantes', 'comunidad'], date: ['inicio', 'fin'], key: ['ciclo', 'ymca'] },
    perfil_bluedrop: { cols: ['ciclo', 'ymca', 'modelo', 'programas_uso', 'habilidades', 'actividades'], key: ['ciclo', 'ymca'] },
    perfil_tejiendo_paz: { cols: ['ciclo', 'ymca', 'tipo_violencia', 'grupos_prioritarios'], key: ['ciclo', 'ymca'] },
    eventos_delta: { cols: ['id', 'ciclo', 'ymca', 'evento', 'tipo', 'inicio', 'fin', 'participantes', 'fondos_usd', 'voluntariado', 'narrativa'], num: ['participantes', 'fondos_usd'], date: ['inicio', 'fin'], key: ['id', 'ciclo', 'ymca'] },
    registro_datos: { cols: ['id', 'programa', 'informacion', 'estado', 'fuente', 'nota'], key: ['id'] },
  };
  const IDS = Object.keys(SCHEMA);
  const FIXED = ['mapa_base']; // contornos del mapa: siempre del repositorio

  // ---------- normalización: la hoja entrega texto, números y fechas en formatos variados ----------
  const pad = (n) => String(n).padStart(2, '0');
  function toISO(v) {
    if (v instanceof Date) return v.getUTCFullYear() + '-' + pad(v.getUTCMonth() + 1) + '-' + pad(v.getUTCDate());
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    m = /^Date\((\d+),\s*(\d+),\s*(\d+)/.exec(s); // formato gviz: mes en base 0
    if (m) return m[1] + '-' + pad(+m[2] + 1) + '-' + pad(m[3]);
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); // día/mes/año
    if (m) return m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
    return null;
  }
  function toNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let s = String(v).replace(/[\s$]|US|USD/gi, '');
    const pct = /%$/.test(s); if (pct) s = s.slice(0, -1);
    s = s.replace(/,(?=\d{3}(\D|$))/g, '');
    const n = Number(s);
    return s !== '' && Number.isFinite(n) ? (pct ? n / 100 : n) : null;
  }
  function normalize(id, rows) {
    const sc = SCHEMA[id], num = sc.num || [], date = sc.date || [];
    const out = [];
    (rows || []).forEach((raw) => {
      const r = {};
      sc.cols.forEach((c) => {
        let v = raw[c];
        if (v === undefined || v === '') v = null;
        if (typeof v === 'string') { v = v.trim(); if (v === '') v = null; }
        if (v != null) v = num.includes(c) ? toNum(v) : date.includes(c) ? toISO(v) : String(v);
        r[c] = v;
      });
      if (sc.key.every((k) => r[k] != null)) out.push(r);
    });
    return out;
  }
  // columnas obligatorias que la pestaña no trae (una pestaña mal nombrada devuelve otra hoja)
  function missingCols(id, rows) {
    if (!rows || !rows.length) return [];
    const have = new Set(); rows.slice(0, 50).forEach((r) => Object.keys(r).forEach((k) => have.add(k)));
    const opt = SCHEMA[id].opt || [];
    return SCHEMA[id].cols.filter((c) => !have.has(c) && !opt.includes(c));
  }

  // ---------- almacén ----------
  const store = {}, raw = {}, sigs = {};
  IDS.concat(FIXED).forEach((id) => { store[id] = { status: 'loading' }; });
  const listeners = new Set();
  let frame = 0;
  function emit() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; listeners.forEach((fn) => { try { fn(); } catch (e) { console.error('[MEL] error al dibujar', e); } }); });
  }
  // guarda un dataset; devuelve true si su contenido cambió
  function put(id, rows, origin) {
    const sig = JSON.stringify(rows);
    if (sigs[id] === sig && store[id].status === 'ok') { store[id].origin = origin; return false; }
    sigs[id] = sig; raw[id] = rows;
    store[id] = { status: 'ok', data: rows, origin };
    return true;
  }
  function rederive() {
    if (!FEAT.derivar || !window.MEL_DERIVE) return;
    if (raw.kpis) store.kpis = { status: 'ok', data: window.MEL_DERIVE(raw.kpis, raw.implementaciones || []), origin: store.kpis.origin };
    if (raw.edad_genero && store.edad_genero) store.edad_genero = { status: 'ok', data: window.MEL_DERIVE.ages(raw.edad_genero), origin: store.edad_genero.origin };
  }

  // ---------- lectura ----------
  async function get(url, asText) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), CFG.timeoutMs || 15000);
    try {
      const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return asText ? await r.text() : await r.json();
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'tiempo de espera agotado' : e.message);
    } finally { clearTimeout(t); }
  }
  const snapshot = (id) => get('data/' + id + '.json');
  async function fromAppsScript() {
    const j = await get(SRC.url);
    if (j && j.error) throw new Error(j.error);
    return (j && j.datasets) || j || {};
  }
  async function fromGviz(id) {
    const tab = (SRC.tabs && SRC.tabs[id]) || id;
    const txt = await get('https://docs.google.com/spreadsheets/d/' + SRC.sheetId + '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(tab), true);
    const j = JSON.parse(txt.slice(txt.indexOf('(') + 1, txt.lastIndexOf(')')));
    if (j.status !== 'ok') throw new Error((j.errors && j.errors[0] && j.errors[0].detailed_message) || 'consulta rechazada');
    let cols = j.table.cols.map((c) => (c.label || '').trim().toLowerCase());
    let body = j.table.rows;
    if (cols.every((c) => !c) && body.length) { // pestaña con solo encabezados: gviz los entrega como primera fila
      cols = body[0].c.map((c) => (c && c.v != null ? String(c.v).trim().toLowerCase() : ''));
      body = body.slice(1);
    }
    return body.map((row) => { const o = {}; cols.forEach((c, i) => { if (c) { const cell = row.c[i]; o[c] = cell && cell.v != null ? cell.v : null; } }); return o; });
  }

  // ---------- estado de la conexión ----------
  const live = { mode: SRC.type || 'snapshot', state: 'cargando', lastOk: 0, error: null, warnings: [], nextAt: 0, generated: null };
  let timer = 0, busy = false, fails = 0;

  async function loadSnapshot() {
    let changed = false;
    await Promise.all(IDS.concat(FIXED).map(async (id) => {
      try {
        const rows = await snapshot(id);
        if (FIXED.includes(id)) { store[id] = { status: 'ok', data: rows, origin: 'snapshot' }; changed = true; }
        else if (store[id].origin !== 'live') changed = put(id, normalize(id, rows), 'snapshot') || changed;
      } catch (e) {
        if (store[id].status !== 'ok') { store[id] = { status: 'error', error: e.message }; changed = true; }
      }
    }));
    return changed;
  }

  async function loadLive() {
    const warnings = [];
    let got = {};
    if (SRC.type === 'appsScript') {
      const j = await fromAppsScript();
      IDS.forEach((id) => { if (Array.isArray(j[id])) got[id] = j[id]; else warnings.push('falta la pestaña «' + id + '»'); });
    } else {
      const res = await Promise.allSettled(IDS.map(fromGviz));
      res.forEach((r, i) => { if (r.status === 'fulfilled') got[IDS[i]] = r.value; else warnings.push('«' + IDS[i] + '»: ' + r.reason.message); });
      if (!Object.keys(got).length) throw new Error(warnings[0] || 'sin respuesta de Google Sheets');
    }
    let changed = false;
    Object.keys(got).forEach((id) => {
      const miss = missingCols(id, got[id]);
      if (miss.length) { warnings.push('«' + id + '» sin la columna ' + miss.join(', ')); return; } // se conserva el respaldo
      changed = put(id, normalize(id, got[id]), 'live') || changed;
    });
    live.warnings = warnings;
    return changed;
  }

  async function refresh() {
    if (busy) return;
    busy = true; clearTimeout(timer); live.state = live.lastOk ? live.state : 'cargando'; live.busy = true; paint();
    try {
      const changed = LIVE ? await loadLive() : await loadSnapshot();
      if (changed) { rederive(); emit(); }
      live.lastOk = Date.now(); live.error = null; fails = 0;
      live.state = LIVE ? (live.warnings.length ? 'avisos' : 'vivo') : 'respaldo';
    } catch (e) {
      fails++; live.error = e.message; live.state = 'error';
      console.warn('[MEL] no se pudo actualizar:', e.message);
    } finally {
      busy = false; live.busy = false; schedule(); paint();
    }
  }
  function schedule() {
    clearTimeout(timer); live.nextAt = 0;
    if (!LIVE || document.hidden) return;
    const wait = fails ? Math.min(POLL_MS * Math.pow(2, fails), 10 * 60 * 1000) : POLL_MS;
    live.nextAt = Date.now() + wait;
    timer = setTimeout(refresh, wait);
  }
  document.addEventListener('visibilitychange', () => {
    if (!LIVE) return;
    if (document.hidden) { clearTimeout(timer); return; }
    if (Date.now() - live.lastOk > POLL_MS / 2) refresh(); else schedule();
  });
  window.addEventListener('online', () => { if (LIVE) refresh(); });

  // ---------- barra de estado ----------
  const ago = (ms) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 5 ? 'ahora' : s < 90 ? 'hace ' + s + ' s' : s < 5400 ? 'hace ' + Math.round(s / 60) + ' min' : 'hace ' + Math.round(s / 3600) + ' h'; };
  function paint() {
    const box = document.getElementById('live'); if (!box) return;
    const txt = document.getElementById('live-text'), btn = document.getElementById('live-refresh');
    const origen = SRC.type === 'appsScript' ? 'Google Sheets' : SRC.type === 'gviz' ? 'Google Sheets (lectura directa)' : 'archivo del repositorio';
    let t, cls;
    if (live.state === 'cargando') { t = 'Cargando datos…'; cls = 'wait'; }
    else if (live.state === 'vivo') { t = 'En vivo · ' + origen + ' · actualizado ' + ago(live.lastOk); cls = 'ok'; }
    else if (live.state === 'avisos') { t = 'En vivo con avisos · ' + live.warnings.join('; ') + ' · actualizado ' + ago(live.lastOk); cls = 'warn'; }
    else if (live.state === 'respaldo') { t = 'Datos de respaldo · ' + origen + ' · sin conexión en vivo configurada'; cls = 'off'; }
    else { t = 'Sin conexión con ' + origen + (live.lastOk ? ' · se muestran los datos de ' + ago(live.lastOk) : ' · se muestran los datos de respaldo') + (live.nextAt ? ' · reintento en ' + Math.max(1, Math.round((live.nextAt - Date.now()) / 1000)) + ' s' : ''); cls = 'bad'; }
    box.dataset.state = cls;
    box.title = live.error ? 'Último error: ' + live.error : LIVE ? 'Se consulta cada ' + POLL_MS / 1000 + ' s mientras la pestaña está visible' : '';
    if (txt) txt.textContent = t;
    if (btn) { btn.disabled = !!live.busy; btn.textContent = live.busy ? 'Actualizando…' : 'Actualizar'; }
  }
  setInterval(paint, 5000);

  // ---------- filtros: viven en la URL para poder compartir la vista ----------
  const DEF = Object.assign({ prog: 'Todos', ciclo: '2025', ymca: 'Todas', equipo: 'Pares', tp: 'Participantes' }, CFG.defaults);
  const TABS = { regional: 'Todos', eleva: 'Eleva', 'after-school': 'After School', 'tejiendo-paz': 'Tejiendo Paz', delta: 'Delta', 'por-ymca': 'YMCA' };
  const KEYS = ['ciclo', 'ymca', 'equipo', 'tp'];
  function readURL() {
    const q = new URLSearchParams(location.search), p = {};
    KEYS.forEach((k) => { if (q.has(k)) p[k] = q.get(k); });
    const prog = TABS[location.hash.slice(1)]; if (prog) p.prog = prog;
    return p;
  }
  let params = Object.assign({}, DEF, readURL());
  function writeURL(push) {
    const q = new URLSearchParams();
    KEYS.forEach((k) => { if (params[k] != null && params[k] !== DEF[k]) q.set(k, params[k]); });
    const tab = Object.keys(TABS).find((t) => TABS[t] === params.prog) || 'regional';
    const url = location.pathname + (q.toString() ? '?' + q.toString() : '') + '#' + tab;
    if (url === location.pathname + location.search + location.hash) return;
    try { history[push ? 'pushState' : 'replaceState'](null, '', url); } catch (e) { /* file:// */ }
  }
  const onNav = () => { params = Object.assign({}, DEF, readURL()); emit(); };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);

  // volver a dibujar cuando cambia el ancho (las gráficas se calculan en píxeles)
  let lastW = window.innerWidth, rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; emit(); } }, 150); });
  window.addEventListener('beforeprint', () => listeners.forEach((fn) => fn()));

  window.dash = {
    data: (id) => store[id] || { status: 'missing' },
    params: () => Object.assign({}, params),
    setParams(p) {
      const push = p.prog != null && p.prog !== params.prog;
      Object.assign(params, p); writeURL(push); emit();
    },
    resetParams() { params = Object.assign({}, DEF, { prog: params.prog }); writeURL(false); emit(); },
    setLink() { writeURL(false); },
    onData(fn) { listeners.add(fn); emit(); },
    refresh,
    live,
    config: { defaultYear: CFG.defaultYear || '', defaultYmca: CFG.defaultYmca || '', features: FEAT },
  };

  // ---------- arranque: primero el respaldo local (pinta de inmediato), luego la hoja ----------
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('live-refresh'); if (btn) btn.addEventListener('click', refresh);
    const pr = document.getElementById('live-print'); if (pr) pr.addEventListener('click', () => window.print());
    paint();
  });
  loadSnapshot().then(() => {
    rederive(); emit();
    if (LIVE) return refresh();
    const failed = IDS.filter((id) => store[id].status !== 'ok');
    live.lastOk = failed.length ? 0 : Date.now();
    live.state = failed.length ? 'error' : 'respaldo';
    live.error = failed.length ? 'no se pudo leer /data (' + failed.join(', ') + ')' : null;
    paint();
  });
})();
