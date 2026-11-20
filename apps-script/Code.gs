/**
 * Sistema MEL YMCA LAC — conector Google Sheets → Dashboard.
 *
 * Se pega en la hoja de cálculo (Extensiones → Apps Script) o en un proyecto independiente de
 * script.google.com; en ese caso escribe el ID de la hoja en SHEET_ID. No requiere servidor propio.
 *
 *   1. Ejecuta `configurar` una vez: crea las pestañas con sus encabezados.
 *   2. (Opcional) Ejecuta `importarDatosActuales`: carga los datos que hoy muestra el dashboard.
 *   3. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: yo · Quién tiene acceso: cualquier persona
 *      Copia la URL que termina en /exec y pégala en js/config.js del repositorio.
 *   4. (Formularios) Ejecuta `activarFormularios` una vez.
 *
 * La hoja sigue siendo privada: la aplicación web solo entrega las pestañas listadas en TABS.
 */

// ID de la hoja (lo que va entre /d/ y /edit en su dirección). Vacío = la hoja donde está pegado el script.
const SHEET_ID = '';
function hoja_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

// Pestañas que lee el dashboard y sus columnas (los encabezados deben coincidir tal cual).
const TABS = {
  kpis: ['programa', 'ciclo', 'ymca', 'indicador', 'valor', 'anterior', 'cambio_pct'],
  implementaciones: ['programa', 'ciclo', 'ymca', 'pais', 'ciudad', 'lat', 'lon', 'comunidad', 'donantes'],
  cronograma: ['programa', 'ciclo', 'ymca', 'etiqueta', 'tipo', 'inicio', 'fin'],
  edad_genero: ['programa', 'segmento', 'ciclo', 'ymca', 'rango_edad', 'genero', 'n'],
  alianzas: ['programa', 'ciclo', 'ymca', 'institucion', 'objetivo'],
  perfil_after_school: ['ciclo', 'ymca', 'formato', 'hello_insight', 'tipo_ciclo', 'continuidad', 'inicio', 'fin', 'locaciones_texto', 'dias', 'areas', 'uso_fondos', 'otros_donantes', 'comunidad'],
  perfil_bluedrop: ['ciclo', 'ymca', 'modelo', 'programas_uso', 'habilidades', 'actividades'],
  perfil_tejiendo_paz: ['ciclo', 'ymca', 'tipo_violencia', 'grupos_prioritarios'],
  eventos_delta: ['id', 'ciclo', 'ymca', 'evento', 'tipo', 'inicio', 'fin', 'participantes', 'fondos_usd', 'voluntariado', 'narrativa'],
  registro_datos: ['id', 'programa', 'informacion', 'estado', 'fuente', 'nota'],
};
// Columnas que se guardan como texto para que "2023" y "2025-2026" convivan en la misma columna.
const TEXTO = ['programa', 'ciclo', 'ymca', 'indicador', 'id', 'segmento', 'rango_edad', 'genero'];
// Segundos que se reutiliza la última lectura (reduce el consumo de cuota con varias personas viendo el dashboard).
const CACHE_SEG = 20;
// Origen de los datos actuales del dashboard, para `importarDatosActuales`.
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/diegoanahuac/YMCALAC_DASHBORAD/main/data/';

/**
 * Formularios → kpis.
 * Cada respuesta debe traer las preguntas Programa, Ciclo y YMCA; las demás preguntas numéricas
 * se guardan como un indicador. Ajusta los títulos de la izquierda a los de tu formulario.
 */
const PREGUNTAS_CLAVE = { programa: 'Programa', ciclo: 'Ciclo', ymca: 'YMCA' };
const PREGUNTA_A_INDICADOR = {
  'Participantes': 'participantes',
  'Fondos asignados (USD)': 'fondos_usd',
  'Grupos': 'grupos',
  'Locaciones': 'locaciones',
  'Fondos de otros donantes (USD)': 'contrapartida_usd',
  'Jóvenes líderes': 'lideres',
  'Actividades realizadas': 'actividades',
  'Eventos o programas financiados': 'eventos',
  'Dispositivos comprados': 'dispositivos',
  'Tablets': 'tablets',
  'Computadoras': 'computadoras',
};

/** Aplicación web: entrega todas las pestañas como JSON. */
function doGet() {
  const cache = CacheService.getScriptCache();
  let body = cache.get('mel');
  if (!body) {
    try {
      body = JSON.stringify({ generated: new Date().toISOString(), datasets: leerTodo_() });
    } catch (err) {
      body = JSON.stringify({ error: String(err && err.message || err) });
    }
    if (body.length < 95000) cache.put('mel', body, CACHE_SEG); // el caché admite hasta 100 KB por entrada
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function leerTodo_() {
  const ss = hoja_();
  const tz = ss.getSpreadsheetTimeZone();
  const out = {};
  Object.keys(TABS).forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return; // el dashboard avisa "falta la pestaña" y conserva su respaldo
    const values = sh.getDataRange().getValues();
    const head = (values.shift() || []).map(function (h) { return String(h).trim().toLowerCase(); });
    out[name] = values
      .filter(function (row) { return row.some(function (c) { return c !== ''; }); })
      .map(function (row) {
        const o = {};
        head.forEach(function (h, i) {
          if (!h) return;
          const v = row[i];
          o[h] = v === '' ? null : v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
        });
        return o;
      });
  });
  return out;
}

/** Crea las pestañas que falten, con encabezados y formato. No borra nada existente. */
function configurar() {
  const ss = hoja_();
  Object.keys(TABS).forEach(function (name) {
    const cols = TABS[name];
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      if (TEXTO.indexOf(c) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  // conteo de filas por pestaña en la portada, si existe
  const portada = ss.getSheetByName('LEEME');
  if (portada) Object.keys(TABS).forEach(function (name, i) { portada.getRange(5 + i, 3).setFormula("=COUNTA('" + name + "'!A2:A)"); });
}

/** Instala (una sola vez) el activador que procesa cada respuesta de formulario. */
function activarFormularios() {
  const ya = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'alEnviarFormulario'; });
  if (!ya) ScriptApp.newTrigger('alEnviarFormulario').forSpreadsheet(hoja_()).onFormSubmit().create();
}

/** Carga en las pestañas vacías los datos que hoy muestra el dashboard (los JSON del repositorio). */
function importarDatosActuales() {
  configurar();
  const ss = hoja_();
  Object.keys(TABS).forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (sh.getLastRow() > 1) return; // ya tiene datos: no se toca
    const rows = JSON.parse(UrlFetchApp.fetch(SNAPSHOT_URL + name + '.json').getContentText());
    if (!rows.length) return;
    const cols = TABS[name];
    const values = rows.map(function (r) { return cols.map(function (c) { return r[c] == null ? '' : r[c]; }); });
    sh.getRange(2, 1, values.length, cols.length).setValues(values);
  });
  CacheService.getScriptCache().remove('mel');
}

/**
 * Se ejecuta con cada respuesta de formulario (ver `activarFormularios`): convierte la respuesta en filas de `kpis`
 * (una por indicador) y reemplaza la fila anterior de la misma YMCA, ciclo e indicador.
 */
function alEnviarFormulario(e) {
  const r = e && e.namedValues;
  if (!r) return;
  const uno = function (titulo) { return r[titulo] ? String(r[titulo][0]).trim() : ''; };
  const programa = uno(PREGUNTAS_CLAVE.programa), ciclo = uno(PREGUNTAS_CLAVE.ciclo), ymca = uno(PREGUNTAS_CLAVE.ymca);
  if (!programa || !ciclo || !ymca) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // dos respuestas simultáneas no se pisan
  try {
    const sh = hoja_().getSheetByName('kpis');
    const data = sh.getDataRange().getValues();
    const fila = {}; // clave → número de fila
    for (let i = 1; i < data.length; i++) fila[data[i].slice(0, 4).join('|')] = i + 1;
    Object.keys(PREGUNTA_A_INDICADOR).forEach(function (titulo) {
      const txt = uno(titulo);
      if (txt === '') return;
      const valor = Number(txt.replace(/[^0-9.\-]/g, ''));
      if (isNaN(valor)) return;
      const indicador = PREGUNTA_A_INDICADOR[titulo];
      const clave = [programa, ciclo, ymca, indicador].join('|');
      if (fila[clave]) sh.getRange(fila[clave], 5).setValue(valor);
      else { sh.appendRow([programa, ciclo, ymca, indicador, valor]); fila[clave] = sh.getLastRow(); }
    });
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove('mel'); // el dashboard ve el cambio en su siguiente consulta
}

/** Activador opcional "Al editar": una corrección manual también se publica de inmediato. */
function alEditar() {
  CacheService.getScriptCache().remove('mel');
}
