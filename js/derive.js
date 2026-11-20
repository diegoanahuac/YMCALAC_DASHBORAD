/*
 * Totales derivados de la tabla `kpis`.
 *
 * Los formularios entregan una fila por YMCA, ciclo e indicador. El dashboard también necesita
 * los agregados: "Todas" (todas las YMCA), "Histórico" (todos los ciclos), "Todos" (todos los
 * programas por año calendario) y la variación contra el ciclo anterior.
 * Esta función los calcula SOLO cuando la hoja no trae la fila: una fila escrita a mano siempre gana.
 */
(function (root) {
  'use strict';
  const H = 'Histórico', T = 'Todas', ALL = 'Todos';
  const PROGS5 = ['Eleva', 'After School', 'Bluedrop', 'Tejiendo Paz', 'Delta'];
  // Bluedrop ocurre dentro de After School: sus participantes no se suman otra vez al total regional.
  const ALL_IND = { participantes: PROGS5.filter((p) => p !== 'Bluedrop'), fondos_usd: PROGS5 };
  const COUNT = ['ymcas', 'paises', 'ciudades'];
  const additive = (i) => !COUNT.includes(i) && !/^tasa_/.test(i);
  const year = (c) => String(c).slice(0, 4);
  const round4 = (v) => Math.round(v * 1e4) / 1e4;

  function derive(kpis, impl) {
    const out = kpis.map((r) => Object.assign({}, r));
    const ix = new Map(out.map((r) => [r.programa + '|' + r.ciclo + '|' + r.ymca + '|' + r.indicador, r]));
    const add = (p, c, y, i, v) => {
      const k = p + '|' + c + '|' + y + '|' + i;
      if (v == null || ix.has(k)) return;
      const r = { programa: p, ciclo: c, ymca: y, indicador: i, valor: v, anterior: null, cambio_pct: null, derivado: true };
      ix.set(k, r); out.push(r);
    };
    // suma por grupo de las filas que cumplen `pick`
    const sumBy = (pick, keyOf) => {
      const m = new Map();
      out.forEach((r) => { if (r.valor == null || !additive(r.indicador) || !pick(r)) return; const k = keyOf(r); m.set(k, (m.get(k) || 0) + r.valor); });
      return m;
    };
    const counts = (rows) => ({ ymcas: new Set(rows.map((r) => r.ymca)).size, paises: new Set(rows.map((r) => r.pais)).size, ciudades: new Set(rows.map((r) => r.ciudad)).size });
    const addCounts = (p, c, rows) => {
      if (!rows.length) return;
      const all = counts(rows); COUNT.forEach((i) => add(p, c, T, i, all[i]));
      new Set(rows.map((r) => r.ymca)).forEach((y) => { const one = counts(rows.filter((r) => r.ymca === y)); COUNT.forEach((i) => add(p, c, y, i, one[i])); });
    };
    const groupImpl = (keyOf) => { const m = new Map(); (impl || []).forEach((r) => { const k = keyOf(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };

    // A. "Todas" por programa y ciclo = suma de sus YMCA
    sumBy((r) => r.programa !== ALL && r.ciclo !== H && r.ymca !== T, (r) => r.programa + '|' + r.ciclo + '|' + r.indicador)
      .forEach((v, k) => { const [p, c, i] = k.split('|'); add(p, c, T, i, v); });
    // B. YMCA, países y ciudades por programa y ciclo, según la tabla de implementaciones
    groupImpl((r) => r.programa + '|' + r.ciclo).forEach((rows, k) => { const [p, c] = k.split('|'); addCounts(p, c, rows); });
    // C. "Histórico" por programa = suma de sus ciclos
    sumBy((r) => r.programa !== ALL && r.ciclo !== H, (r) => r.programa + '|' + r.ymca + '|' + r.indicador)
      .forEach((v, k) => { const [p, y, i] = k.split('|'); add(p, H, y, i, v); });
    groupImpl((r) => r.programa).forEach((rows, p) => addCounts(p, H, rows));
    // D. "Todos" (consolidado regional) por año calendario: After School 2025-2026 cuenta en 2025
    Object.keys(ALL_IND).forEach((ind) => {
      const m = new Map();
      out.forEach((r) => { if (r.valor == null || r.indicador !== ind || r.ciclo === H || !ALL_IND[ind].includes(r.programa)) return; const k = year(r.ciclo) + '|' + r.ymca; m.set(k, (m.get(k) || 0) + r.valor); });
      m.forEach((v, k) => { const [c, y] = k.split('|'); add(ALL, c, y, ind, v); });
    });
    groupImpl((r) => year(r.ciclo)).forEach((rows, c) => addCounts(ALL, c, rows));
    sumBy((r) => r.programa === ALL && r.ciclo !== H, (r) => r.ymca + '|' + r.indicador)
      .forEach((v, k) => { const [y, i] = k.split('|'); add(ALL, H, y, i, v); });
    addCounts(ALL, H, impl || []);
    // E. Variación contra el ciclo anterior del mismo programa
    const cycles = new Map();
    out.forEach((r) => { if (r.ciclo === H) return; if (!cycles.has(r.programa)) cycles.set(r.programa, new Set()); cycles.get(r.programa).add(r.ciclo); });
    cycles.forEach((set, p) => cycles.set(p, [...set].sort()));
    out.forEach((r) => {
      if (r.ciclo === H || r.valor == null || r.anterior != null) return;
      const cyc = cycles.get(r.programa); const prev = cyc[cyc.indexOf(r.ciclo) - 1];
      const q = prev && ix.get(r.programa + '|' + prev + '|' + r.ymca + '|' + r.indicador);
      if (!q || q.valor == null) return;
      r.anterior = q.valor;
      if (r.cambio_pct == null && q.valor !== 0) r.cambio_pct = round4((r.valor - q.valor) / q.valor);
    });
    return out;
  }

  /*
   * Totales derivados de la tabla `edad_genero`.
   * Los formularios entregan filas por YMCA, ciclo, grupo, rango de edad y género. Aquí se completan,
   * solo para los grupos que la hoja no trae:
   *   rango_edad "Todas" (total por género), ymca "Todas", ciclo "Histórico" y programa "Todos".
   */
  const ALL_SEG = { 'Eleva': ['Jóvenes', 'Adultos'], 'After School': ['Participantes'], 'Tejiendo Paz': ['Participantes'], 'Delta': ['Participantes'] };
  function deriveAges(ages) {
    const out = ages.map((r) => Object.assign({}, r));
    const grp = (r) => r.programa + '|' + r.segmento + '|' + r.ciclo + '|' + r.ymca;
    // agrega los grupos que no existan; `rows` son las filas de origen y `to` cambia sus claves
    const roll = (rows, to) => {
      const have = new Set(out.map(grp));
      const m = new Map();
      rows.forEach((r) => {
        if (r.n == null) return;
        const t = Object.assign({}, r, to(r));
        if (have.has(grp(t))) return;
        const k = grp(t) + '|' + t.rango_edad + '|' + t.genero;
        if (m.has(k)) m.get(k).n += r.n; else m.set(k, Object.assign(t, { n: r.n, derivado: true }));
      });
      m.forEach((r) => out.push(r));
    };
    // 1. total por género de cada grupo que solo trae rangos
    const conTotal = new Set(out.filter((r) => r.rango_edad === T).map(grp));
    const m = new Map();
    out.forEach((r) => {
      if (r.rango_edad === T || r.n == null || conTotal.has(grp(r))) return;
      const k = grp(r) + '|' + r.genero;
      if (m.has(k)) m.get(k).n += r.n; else m.set(k, Object.assign({}, r, { rango_edad: T, derivado: true }));
    });
    m.forEach((r) => out.push(r));
    // 2. "Todas" las YMCA  3. "Histórico"  4. "Todos" los programas por año calendario
    roll(out.filter((r) => r.programa !== ALL && r.ciclo !== H && r.ymca !== T), () => ({ ymca: T }));
    roll(out.filter((r) => r.programa !== ALL && r.ciclo !== H), () => ({ ciclo: H }));
    roll(out.filter((r) => r.ciclo !== H && (ALL_SEG[r.programa] || []).includes(r.segmento)), (r) => ({ programa: ALL, segmento: 'Participantes', ciclo: year(r.ciclo) }));
    roll(out.filter((r) => r.programa === ALL && r.ciclo !== H), () => ({ ciclo: H }));
    return out;
  }

  derive.ages = deriveAges;
  root.MEL_DERIVE = derive;
  if (typeof module !== 'undefined' && module.exports) module.exports = derive;
})(typeof window !== 'undefined' ? window : globalThis);
