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
 *   4. (Formularios) Ejecuta `crearFormularios`: crea los cuatro formularios (indicadores, edad y género,
 *      alianzas y cronograma), los vincula a la hoja y activa su procesamiento.
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
  cronograma: ['programa', 'ciclo', 'ymca', 'etiqueta', 'tipo', 'inicio', 'fin', 'categoria', 'estado', 'modalidad', 'sede'],
  edad_genero: ['programa', 'segmento', 'ciclo', 'ymca', 'rango_edad', 'genero', 'n', 'metodo'],
  alianzas: ['programa', 'ciclo', 'ymca', 'institucion', 'objetivo', 'tipo_institucion', 'aporte', 'otros_aportes', 'detalle', 'personas',
    'formalizacion', 'estado', 'desde', 'alcance', 'direccion', 'sede'],
  perfil_after_school: ['ciclo', 'ymca', 'formato', 'hello_insight', 'tipo_ciclo', 'continuidad', 'inicio', 'fin', 'locaciones_texto', 'dias', 'areas', 'uso_fondos', 'otros_donantes', 'comunidad'],
  perfil_bluedrop: ['ciclo', 'ymca', 'modelo', 'programas_uso', 'habilidades', 'actividades'],
  perfil_tejiendo_paz: ['ciclo', 'ymca', 'tipo_violencia', 'grupos_prioritarios'],
  eventos_delta: ['id', 'ciclo', 'ymca', 'evento', 'tipo', 'inicio', 'fin', 'participantes', 'fondos_usd', 'voluntariado', 'narrativa'],
  registro_datos: ['id', 'programa', 'informacion', 'estado', 'fuente', 'nota'],
};
// Catálogos que alimentan las listas de los formularios. No se publican en el dashboard.
const CATALOGOS = {
  ymcas: ['ymca', 'pais', 'subregion', 'idioma', 'nombre_oficial', 'sitio', 'en_formulario', 'nota'],
  asociaciones: ['ymca', 'asociacion', 'ciudad', 'verificada'],
};
// Columnas que se guardan como texto para que "2023" y "2025-2026" convivan en la misma columna.
const TEXTO = ['programa', 'ciclo', 'ymca', 'indicador', 'id', 'segmento', 'rango_edad', 'genero', 'desde'];
// Segundos que se reutiliza la última lectura (reduce el consumo de cuota con varias personas viendo el dashboard).
const CACHE_SEG = 20;
// Origen de los datos actuales del dashboard y de los catálogos, para `importarDatosActuales` e `importarCatalogos`.
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/diegoanahuac/YMCALAC_DASHBORAD/main/data/';

/* ============================== Formularios ==============================
 * Cuatro formularios escriben en la hoja. Cada respuesta trae Programa, Ciclo y YMCA.
 * Los títulos de las preguntas son la llave: si cambias uno en el formulario, cámbialo también aquí.
 */
const PROGRAMAS = ['Eleva', 'After School', 'Bluedrop', 'Tejiendo Paz', 'Delta'];
const PREGUNTAS_CLAVE = { programa: 'Programa', ciclo: 'Ciclo', ymca: 'YMCA', sede: 'Asociación local o sede' };

// --- 1. Indicadores → pestaña `kpis` ---
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

// --- 2. Edad y género → pestaña `edad_genero` ---
// Mismos rangos y géneros que js/charts.js. Equivalen a las categorías Male / Female / Non-binary / Unknown del FDRS 2024 de la IFRC.
const RANGOS = [
  ['Infancias (11 años o menos)', ['Primera infancia (3–5)', 'Niñez temprana (6–8)', 'Niñez media (9–11)']],
  ['Adolescentes (12 a 17 años)', ['Adolescencia temprana (12–14)', 'Adolescencia media (15–17)']],
  ['Jóvenes (18 a 30 años)', ['Juventud temprana (18–20)', 'Juventudes (21–25)', 'Juventudes adultas (26–30)']],
  ['Personas adultas (31 años o más)', ['Personas adultas (31–35)', 'Personas adultas (36–59)', 'Personas adultas mayores (60+)']],
];
const SIN_EDAD = 'Edad no registrada';
const GEN = { m: 'Mujer/niña', h: 'Hombre/niño', nb: 'No binario', ne: 'No especifica' };
const ETIQUETA_GEN = { m: 'Mujeres y niñas', h: 'Hombres y niños' };
const P_EDAD = {
  grupo: 'Grupo que se reporta',
  total: 'Total de personas del grupo',
  metodo: '¿Cómo se obtuvieron las cifras?',
  nb: 'Personas no binarias o de otra identidad de género (total)',
  ne: 'Personas que prefieren no decir su género o sin dato (total)',
};
// Opción del formulario → valor de la columna `segmento`.
const GRUPOS = {
  'Participantes del programa': 'Participantes',
  'Eleva · grupo de jóvenes': 'Jóvenes',
  'Eleva · grupo de adultos': 'Adultos',
  'Eleva · equipo de pares': 'Pares',
  'Eleva · equipo de voluntariado': 'Voluntarios',
  'Eleva · equipo de profesionales': 'Profesionales',
  'Eleva · comunidad alcanzada': 'Comunidad alcanzada',
  'Tejiendo Paz · jóvenes líderes': 'Jóvenes líderes',
};
const METODOS = ['Conteo con listas de asistencia o registro', 'Conteo parcial completado con estimación', 'Estimación'];

// --- 3. Alianzas → pestaña `alianzas` ---
const P_ALI = {
  institucion: 'Nombre de la institución aliada',
  tipo: 'Tipo de institución',
  objetivo: 'Objetivo de la alianza',
  estado: 'Estado de la alianza',
  formalizacion: 'Nivel de formalización',
  desde: 'Año en que inició la alianza',
  alcance: 'Alcance geográfico',
  direccion: '¿Quién aporta a quién?',
  aporte: 'Aporte principal de la alianza',
  otros: 'Otros aportes de esta alianza',
  monto: 'Monto recibido en el ciclo',
  moneda: 'Moneda',
  restringido: '¿Los fondos son exclusivos para este programa?',
  bien: 'Tipo de bien donado',
  valor: 'Valor estimado de la donación (USD)',
  tema: 'Tema de la capacitación',
  capacitadas: 'Personas capacitadas',
  quienes: '¿Quiénes se capacitaron?',
  certificacion: '¿Se entregó certificación?',
  sentido: 'Sentido de la derivación',
  derivadas: 'Personas derivadas',
  voluntarias: 'Personas voluntarias aportadas',
  horas: 'Horas de voluntariado (estimadas)',
  espacio: '¿De quién es el espacio?',
  frecuencia: 'Frecuencia de uso',
  proyecto: 'Nombre del programa o proyecto conjunto',
  alcanzadas: 'Personas alcanzadas por el proyecto conjunto',
  valoracion: 'Esta alianza nos permite lograr resultados que nuestra YMCA no podría lograr sola',
  logro: 'Principal logro u obstáculo',
};
// Equivalencias con el codelist OrganisationType de IATI entre paréntesis en el README.
const TIPOS_INSTITUCION = [
  'Gobierno nacional (ministerio, instituto u organismo público)',
  'Gobierno local (municipio, alcaldía, gobierno estatal o provincial)',
  'Organismo internacional o de cooperación (ONU, multilateral, embajada)',
  'Empresa privada',
  'Fundación (empresarial o filantrópica)',
  'ONG u organización de la sociedad civil (por ejemplo, Cruz Roja)',
  'Organización comunitaria o de base (iglesia, junta vecinal, colectivo)',
  'Institución educativa (escuela, colegio, universidad)',
  'Movimiento YMCA (otra YMCA, YMCA LAC, World YMCA)',
  'Otro',
];
// Aportes: los siete primeros abren una sección de detalle (clave → sección). Sin comas: Forms separa con comas las casillas.
const APORTES = [
  ['Financiamiento o donación en dinero', 'dinero'],
  ['Donación en especie', 'especie'],
  ['Capacitación o certificación', 'capacitacion'],
  ['Derivación de participantes', 'derivacion'],
  ['Voluntariado', 'voluntariado'],
  ['Uso de instalaciones o espacios', 'espacios'],
  ['Implementación conjunta de un programa', 'conjunta'],
  ['Incidencia y trabajo en red', ''],
  ['Investigación o evaluación', ''],
  ['Comunicación y visibilidad', ''],
];
// Catálogo construido con la oferta habitual de la Cruz Roja y los convenios publicados por YMCA.
const TEMAS_CAPACITACION = [
  'Primeros auxilios y RCP', 'Salvamento y seguridad acuática', 'Apoyo psicosocial y salud mental',
  'Gestión de riesgo de desastres y seguridad escolar', 'Protección de la niñez y salvaguarda',
  'Empleabilidad y habilidades para el trabajo', 'Liderazgo y voluntariado juvenil', 'Salud y nutrición',
  'Tecnología y habilidades digitales', 'Otro',
];
const FORMALIZACION = [
  'Acuerdo verbal o relación informal',
  'Carta de intención o intercambio de cartas',
  'Convenio o memorando firmado sin transferencia de fondos',
  'Convenio o contrato con transferencia de recursos',
  'Convenio marco regional o nacional al que esta YMCA se adhiere',
];
const ESTADOS_ALIANZA = ['En negociación', 'Activa', 'Concluida', 'Suspendida o inactiva'];
const ALCANCES = ['Local (una sede o municipio)', 'Subnacional (varias sedes, estado o provincia)', 'Nacional', 'Regional (varios países)', 'Global'];
const DIRECCIONES = ['El aliado aporta a la YMCA', 'La YMCA aporta al aliado', 'Ambos aportan'];
const MONEDAS = ['USD', 'ARS', 'AWG', 'BBD', 'BOB', 'BRL', 'BSD', 'BZD', 'CLP', 'COP', 'CRC', 'DOP', 'GTQ', 'HNL', 'HTG', 'JMD', 'KYD', 'MXN', 'NIO', 'PAB', 'PEN', 'PYG', 'TTD', 'UYU', 'VES', 'Otra'];

// --- 4. Cronograma → pestaña `cronograma` ---
const ENTRADAS = 3; // entradas por envío
const P_CRO = {
  tipo: '¿Qué registras?',
  nombre: 'Nombre',
  inicio: 'Fecha de inicio',
  fin: 'Fecha de fin',
  estado: 'Estado',
  modalidad: 'Modalidad',
  otra: '¿Registrar otra entrada?',
};
// Opción del formulario → [categoría, tipo]. El tipo es uno de los tres que dibuja el cronograma del dashboard:
// periodo = tramo del ciclo; actividad = trabajo de varios días o semanas; evento = hito fechado.
const TIPOS_CRONOGRAMA = {
  'Periodo o trimestre del programa · Term': ['periodo', 'periodo'],
  'Receso o vacaciones, sin sesiones · Break': ['receso', 'periodo'],
  'Sesiones regulares · Regular sessions': ['sesiones', 'actividad'],
  'Capacitación o taller · Training or workshop': ['capacitacion', 'actividad'],
  'Campamento o retiro · Camp or retreat': ['campamento', 'actividad'],
  'Aplicación de encuestas o evaluación · Survey or evaluation': ['evaluacion', 'actividad'],
  'Lanzamiento, cierre o graduación · Launch, closing or graduation': ['ceremonia', 'evento'],
  'Servicio comunitario o voluntariado · Community service': ['servicio', 'evento'],
  'Encuentro con familias o comunidad · Family or community event': ['familias', 'evento'],
  'Salida, visita o evento con patrocinador · Field trip or sponsor event': ['salida', 'evento'],
};
// "En curso" no se pregunta: se deduce de las fechas.
const ESTADOS_CRONOGRAMA = ['Programado', 'Realizado', 'Reprogramado', 'Cancelado'];
const MODALIDADES = ['Presencial', 'Virtual', 'Híbrida'];
const pregunta_ = function (titulo, n) { return n > 1 ? titulo + ' (entrada ' + n + ')' : titulo; };

// Los cuatro formularios: propiedad del script donde se guarda su ID, título y función que arma sus preguntas.
const FORMULARIOS = [
  { clave: 'FORM_ID', nombre: 'Indicadores', titulo: 'Reporte de indicadores · Sistema MEL YMCA LAC', armar: armarIndicadores_ },
  { clave: 'FORM_EDAD', nombre: 'Edad y género', titulo: 'Reporte de edad y género · Sistema MEL YMCA LAC', armar: armarEdadGenero_ },
  { clave: 'FORM_ALIANZAS', nombre: 'Alianzas', titulo: 'Reporte de alianzas · Sistema MEL YMCA LAC', armar: armarAlianzas_ },
  { clave: 'FORM_CRONOGRAMA', nombre: 'Cronograma', titulo: 'Reporte de cronograma · Sistema MEL YMCA LAC', armar: armarCronograma_ },
];

/* ============================== Aplicación web ============================== */

/** Entrega todas las pestañas del dashboard como JSON. */
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

/* ============================== Preparación de la hoja ============================== */

/** Crea las pestañas y columnas que falten, con encabezados y formato. No borra nada existente. */
function configurar() {
  const ss = hoja_();
  const todas = Object.assign({}, TABS, CATALOGOS);
  Object.keys(todas).forEach(function (name) {
    const cols = todas[name];
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const ancho = sh.getLastColumn();
    const cab = ancho ? sh.getRange(1, 1, 1, ancho).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); }) : [];
    const faltan = cols.filter(function (c) { return cab.indexOf(c) < 0; });
    if (faltan.length) sh.getRange(1, cab.length + 1, 1, faltan.length).setValues([faltan]);
    const final = cab.concat(faltan);
    sh.getRange(1, 1, 1, final.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    final.forEach(function (c, i) {
      if (TEXTO.indexOf(c) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });
  // conteo de filas por pestaña en la portada, si existe
  const portada = ss.getSheetByName('LEEME');
  if (portada) Object.keys(TABS).forEach(function (name, i) { portada.getRange(5 + i, 3).setFormula("=COUNTA('" + name + "'!A2:A)"); });
}

/** Carga en las pestañas vacías los datos que hoy muestra el dashboard (los JSON del repositorio). */
function importarDatosActuales() {
  configurar();
  importar_(TABS);
  CacheService.getScriptCache().remove('mel');
}

/** Carga los catálogos `ymcas` y `asociaciones` desde el repositorio si sus pestañas están vacías. */
function importarCatalogos() {
  configurar();
  importar_(CATALOGOS);
}

function importar_(tablas) {
  const ss = hoja_();
  Object.keys(tablas).forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (sh.getLastRow() > 1) return; // ya tiene datos: no se toca
    const res = UrlFetchApp.fetch(SNAPSHOT_URL + name + '.json', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return;
    const rows = JSON.parse(res.getContentText());
    if (!rows.length) return;
    const cols = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
    const values = rows.map(function (r) { return cols.map(function (c) { return r[c] == null ? '' : r[c]; }); });
    sh.getRange(2, 1, values.length, cols.length).setValues(values);
  });
}

/* ============================== Creación de formularios ============================== */

/**
 * Crea los formularios que falten, los vincula a la hoja, anota sus enlaces en la portada y activa su procesamiento.
 * Se puede ejecutar varias veces: un formulario que ya existe no se toca.
 */
function crearFormularios() {
  importarCatalogos();
  const props = PropertiesService.getScriptProperties();
  const ss = hoja_();
  const listas = listas_();
  const enlaces = [];
  FORMULARIOS.forEach(function (f) {
    let form = null;
    try { if (props.getProperty(f.clave)) form = FormApp.openById(props.getProperty(f.clave)); } catch (err) { form = null; }
    if (!form) {
      form = FormApp.create(f.titulo);
      f.armar(form, listas);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
      props.setProperty(f.clave, form.getId());
    }
    enlaces.push(['Formulario ' + f.nombre + ': responder', form.getPublishedUrl()]);
    enlaces.push(['Formulario ' + f.nombre + ': editar preguntas', form.getEditUrl()]);
    Logger.log(f.nombre + ' · responder: ' + form.getPublishedUrl());
    Logger.log(f.nombre + ' · editar: ' + form.getEditUrl());
  });
  activarFormularios();
  actualizarListas(); // los formularios que ya existían reciben la lista completa de YMCA
  const portada = ss.getSheetByName('LEEME');
  if (portada) portada.getRange(16, 1, enlaces.length, 2).setValues(enlaces);
}
/** Nombre anterior de `crearFormularios`. */
function crearFormulario() { crearFormularios(); }

/** Listas de YMCA y de asociaciones locales, según los catálogos de la hoja. */
function listas_() {
  const ss = hoja_();
  const leer = function (nombre) {
    const sh = ss.getSheetByName(nombre);
    if (!sh || sh.getLastRow() < 2) return [];
    const v = sh.getDataRange().getValues();
    const cab = v.shift().map(function (h) { return String(h).trim().toLowerCase(); });
    return v.map(function (row) { const o = {}; cab.forEach(function (c, i) { o[c] = String(row[i]).trim(); }); return o; });
  };
  const unicos = function (a) { return a.filter(function (v, i) { return v && a.indexOf(v) === i; }); };
  const cat = leer('ymcas');
  const pais = {};
  cat.forEach(function (r) { pais[r.ymca] = r.pais; });
  const ymcas = unicos(cat.filter(function (r) { return !/^no$/i.test(r.en_formulario); }).map(function (r) { return r.ymca; })
    .concat(leer('implementaciones').map(function (r) { return r.ymca; }))).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  const sedes = unicos(leer('asociaciones').map(function (r) { return r.asociacion ? r.asociacion + ' (' + (pais[r.ymca] || r.ymca) + ')' : ''; }));
  return { ymcas: ymcas, sedes: sedes };
}

/**
 * Vuelve a llenar las listas "YMCA" y "Asociación local o sede" de todos los formularios con lo que haya en
 * las pestañas `ymcas` y `asociaciones`. Corre sola una vez al día; ejecútala a mano para verlo de inmediato.
 */
function actualizarListas() {
  const props = PropertiesService.getScriptProperties();
  const listas = listas_();
  if (!listas.ymcas.length) return;
  FORMULARIOS.forEach(function (f) {
    let form;
    try { form = FormApp.openById(props.getProperty(f.clave)); } catch (err) { return; }
    form.getItems(FormApp.ItemType.LIST).forEach(function (it) {
      if (it.getTitle() === PREGUNTAS_CLAVE.ymca) it.asListItem().setChoiceValues(listas.ymcas);
      if (it.getTitle() === PREGUNTAS_CLAVE.sede && listas.sedes.length) it.asListItem().setChoiceValues(listas.sedes);
    });
  });
}

/** Instala (una sola vez) el procesamiento de respuestas y la actualización diaria de las listas. */
function activarFormularios() {
  const hay = function (fn) { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === fn; }); };
  if (!hay('alEnviarFormulario')) ScriptApp.newTrigger('alEnviarFormulario').forSpreadsheet(hoja_()).onFormSubmit().create();
  if (!hay('actualizarListas')) ScriptApp.newTrigger('actualizarListas').timeBased().everyDays(1).atHour(5).create();
}

// ----- piezas comunes de los formularios -----
const entero_ = function () { return FormApp.createTextValidation().requireWholeNumber().setHelpText('Escribe un número entero, sin puntos ni comas.').build(); };
const numero_ = function () { return FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).setHelpText('Escribe un número.').build(); };

function clave_(form, listas, conSede) {
  form.addListItem().setTitle(PREGUNTAS_CLAVE.programa).setRequired(true).setChoiceValues(PROGRAMAS);
  form.addTextItem().setTitle(PREGUNTAS_CLAVE.ciclo).setRequired(true)
    .setHelpText('Año calendario (2026) o ciclo escolar (2026-2027). · Calendar year or school cycle.')
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^\\d{4}(-\\d{4})?$')
      .setHelpText('Escribe un año, como 2026, o un ciclo, como 2026-2027.').build());
  form.addListItem().setTitle(PREGUNTAS_CLAVE.ymca).setRequired(true)
    .setHelpText('Movimiento nacional. · National movement.').setChoiceValues(listas.ymcas);
  if (conSede && listas.sedes.length) {
    form.addListItem().setTitle(PREGUNTAS_CLAVE.sede)
      .setHelpText('Opcional. Elige la asociación local si el dato es de una sola. · Optional: local association.').setChoiceValues(listas.sedes);
  }
}

function armarIndicadores_(form, listas) {
  form.setDescription('Un envío por programa, ciclo y YMCA. Llena solo los indicadores que apliquen. ' +
    'Si corriges un dato, vuelve a enviar el formulario: el valor nuevo reemplaza al anterior.');
  clave_(form, listas, false);
  form.addSectionHeaderItem().setTitle('Indicadores').setHelpText('Solo números, sin símbolos ni separadores.');
  Object.keys(PREGUNTA_A_INDICADOR).forEach(function (titulo) { form.addTextItem().setTitle(titulo).setValidation(numero_()); });
}

function armarEdadGenero_(form, listas) {
  form.setDescription('Cifras agregadas de un grupo, por rango de edad y género. No se piden nombres ni datos de personas.\n' +
    'Un envío por programa, ciclo, YMCA y grupo. Deja en blanco las casillas que no apliquen (cuentan como cero). ' +
    'Para corregir, vuelve a enviar: el envío nuevo reemplaza al anterior del mismo grupo.\n\n' +
    'English: aggregated head counts by age range and gender. No names or personal data. Leave blank what does not apply.');
  clave_(form, listas, false);
  form.addListItem().setTitle(P_EDAD.grupo).setRequired(true).setChoiceValues(Object.keys(GRUPOS))
    .setHelpText('Cada persona se cuenta una sola vez por ciclo, en el grupo en el que participa. · Count each person once per cycle.');
  form.addTextItem().setTitle(P_EDAD.total).setRequired(true).setValidation(entero_())
    .setHelpText('Personas distintas del grupo en el ciclo. Debe ser igual a la suma de las casillas siguientes. · Total distinct people.');
  form.addMultipleChoiceItem().setTitle(P_EDAD.metodo).setRequired(true).setChoiceValues(METODOS);
  RANGOS.forEach(function (bloque) {
    form.addPageBreakItem().setTitle(bloque[0]).setHelpText('Si no hubo personas de estas edades, pasa a la siguiente sección. · Skip if not applicable.');
    bloque[1].forEach(function (rango) {
      ['m', 'h'].forEach(function (g) { form.addTextItem().setTitle(ETIQUETA_GEN[g] + ' · ' + rango).setValidation(entero_()); });
    });
  });
  form.addPageBreakItem().setTitle('Sin edad registrada y otras identidades')
    .setHelpText('Las cifras de personas no binarias se piden sin edad para no exponer a nadie en grupos pequeños.');
  ['m', 'h'].forEach(function (g) { form.addTextItem().setTitle(ETIQUETA_GEN[g] + ' · ' + SIN_EDAD).setValidation(entero_()); });
  form.addTextItem().setTitle(P_EDAD.nb).setValidation(entero_());
  form.addTextItem().setTitle(P_EDAD.ne).setValidation(entero_());
}

function armarAlianzas_(form, listas) {
  form.setDescription('Un envío por cada alianza del programa en el ciclo. Toma de 3 a 4 minutos.\n' +
    'Registra instituciones, no personas. Si tu YMCA paga el servicio a precio de mercado, es un proveedor y no una alianza.\n' +
    'Para actualizar una alianza, vuelve a enviar con el mismo nombre de institución y el mismo aporte principal.\n\n' +
    'English: one submission per partner organisation. Organisations only, no personal data.');
  clave_(form, listas, true);

  form.addPageBreakItem().setTitle('La institución aliada');
  form.addTextItem().setTitle(P_ALI.institucion).setRequired(true)
    .setHelpText('Nombre completo, como aparece en el convenio. Ejemplos: Cruz Roja Mexicana, CIBC Caribbean, Universidad de las Indias Occidentales, Alcaldía de Medellín.');
  form.addListItem().setTitle(P_ALI.tipo).setRequired(true).setChoiceValues(TIPOS_INSTITUCION);
  form.addTextItem().setTitle(P_ALI.objetivo).setRequired(true)
    .setHelpText('Una frase: para qué trabajan juntos. Ejemplo: certificar en primeros auxilios al personal del programa.');
  form.addMultipleChoiceItem().setTitle(P_ALI.estado).setRequired(true).setChoiceValues(ESTADOS_ALIANZA);
  form.addMultipleChoiceItem().setTitle(P_ALI.formalizacion).setRequired(true).setChoiceValues(FORMALIZACION)
    .setHelpText('Elige la última opción si el convenio lo firmó YMCA LAC o tu federación nacional y tu YMCA lo ejecuta.');
  form.addTextItem().setTitle(P_ALI.desde).setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^(19|20)\\d{2}$').setHelpText('Escribe el año con cuatro dígitos, como 2024.').build());
  form.addMultipleChoiceItem().setTitle(P_ALI.alcance).setRequired(true).setChoiceValues(ALCANCES);
  form.addMultipleChoiceItem().setTitle(P_ALI.direccion).setRequired(true).setChoiceValues(DIRECCIONES)
    .setHelpText('Ejemplo con la Cruz Roja: ella aporta instructores y certificación, la YMCA aporta la sede y la convocatoria: ambos aportan.');
  form.addCheckboxItem().setTitle(P_ALI.otros).setChoiceValues(APORTES.map(function (a) { return a[0]; }))
    .setHelpText('Opcional. Marca todo lo que el aliado aportó o hizo en el ciclo, además del aporte principal.');
  const principal = form.addMultipleChoiceItem().setTitle(P_ALI.aporte).setRequired(true)
    .setHelpText('Según tu respuesta, la siguiente sección pide uno o dos datos de detalle.');

  // secciones de detalle: una por tipo de aporte
  const sec = {};
  sec.dinero = form.addPageBreakItem().setTitle('Detalle: financiamiento');
  form.addTextItem().setTitle(P_ALI.monto).setValidation(numero_()).setHelpText('Opcional. Queda en la hoja de respuestas; no se publica en el dashboard.');
  form.addListItem().setTitle(P_ALI.moneda).setChoiceValues(MONEDAS);
  form.addMultipleChoiceItem().setTitle(P_ALI.restringido).setChoiceValues(['Sí', 'No']);
  sec.especie = form.addPageBreakItem().setTitle('Detalle: donación en especie');
  form.addListItem().setTitle(P_ALI.bien).setRequired(true)
    .setChoiceValues(['Equipo o mobiliario', 'Materiales educativos o deportivos', 'Alimentos', 'Tecnología o licencias', 'Transporte o boletos', 'Otro']);
  form.addTextItem().setTitle(P_ALI.valor).setValidation(numero_()).setHelpText('Opcional. No se publica en el dashboard.');
  sec.capacitacion = form.addPageBreakItem().setTitle('Detalle: capacitación o certificación')
    .setHelpText('Ejemplo: curso de primeros auxilios y RCP impartido por la Cruz Roja al personal del programa.');
  form.addListItem().setTitle(P_ALI.tema).setRequired(true).setChoiceValues(TEMAS_CAPACITACION);
  form.addTextItem().setTitle(P_ALI.capacitadas).setRequired(true).setValidation(entero_()).setHelpText('Solo el total. Si no lo sabes, escribe 0.');
  form.addCheckboxItem().setTitle(P_ALI.quienes).setChoiceValues(['Personal de la YMCA', 'Voluntariado', 'Participantes del programa', 'Familias o comunidad']);
  form.addMultipleChoiceItem().setTitle(P_ALI.certificacion).setChoiceValues(['Sí', 'No']);
  sec.derivacion = form.addPageBreakItem().setTitle('Detalle: derivación de participantes');
  form.addMultipleChoiceItem().setTitle(P_ALI.sentido).setRequired(true)
    .setChoiceValues(['Del aliado hacia la YMCA', 'De la YMCA hacia el aliado', 'En ambos sentidos']);
  form.addTextItem().setTitle(P_ALI.derivadas).setValidation(entero_()).setHelpText('Opcional; puede ser una estimación.');
  sec.voluntariado = form.addPageBreakItem().setTitle('Detalle: voluntariado');
  form.addTextItem().setTitle(P_ALI.voluntarias).setRequired(true).setValidation(entero_());
  form.addTextItem().setTitle(P_ALI.horas).setValidation(numero_());
  sec.espacios = form.addPageBreakItem().setTitle('Detalle: instalaciones o espacios');
  form.addMultipleChoiceItem().setTitle(P_ALI.espacio).setChoiceValues(['Del aliado', 'De la YMCA']);
  form.addMultipleChoiceItem().setTitle(P_ALI.frecuencia).setChoiceValues(['Puntual', 'Periódica', 'Permanente']);
  sec.conjunta = form.addPageBreakItem().setTitle('Detalle: implementación conjunta');
  form.addTextItem().setTitle(P_ALI.proyecto).setRequired(true);
  form.addTextItem().setTitle(P_ALI.alcanzadas).setValidation(entero_());

  const cierre = form.addPageBreakItem().setTitle('Valoración de la YMCA')
    .setHelpText('Es la percepción de tu YMCA. Queda en la hoja de respuestas; no se publica en el dashboard.');
  form.addScaleItem().setTitle(P_ALI.valoracion).setBounds(1, 5).setLabels('Muy en desacuerdo', 'Muy de acuerdo');
  form.addParagraphTextItem().setTitle(P_ALI.logro).setHelpText('Opcional, en una o dos frases.');

  // navegación: cada sección de detalle salta a la valoración; los aportes sin detalle van directo
  const orden = ['dinero', 'especie', 'capacitacion', 'derivacion', 'voluntariado', 'espacios', 'conjunta'];
  orden.slice(1).forEach(function (k) { sec[k].setGoToPage(cierre); }); // al terminar la sección anterior
  principal.setChoices(APORTES.map(function (a) { return principal.createChoice(a[0], a[1] ? sec[a[1]] : cierre); }));
}

function armarCronograma_(form, listas) {
  form.setDescription('Registra los periodos, eventos y actividades del programa en el ciclo: hasta ' + ENTRADAS + ' por envío.\n' +
    'Para cambiar una fecha, vuelve a enviar con el mismo nombre. Para quitar una entrada, envíala con estado "Cancelado".\n\n' +
    'English: report programme terms, events and activities, up to ' + ENTRADAS + ' per submission. Resubmit with the same name to change dates.');
  clave_(form, listas, true);
  const saltos = [];
  for (let n = 1; n <= ENTRADAS; n++) {
    saltos.push(form.addPageBreakItem().setTitle('Entrada ' + n));
    form.addListItem().setTitle(pregunta_(P_CRO.tipo, n)).setRequired(true).setChoiceValues(Object.keys(TIPOS_CRONOGRAMA));
    form.addTextItem().setTitle(pregunta_(P_CRO.nombre, n)).setRequired(true)
      .setHelpText('Corto y sin el nombre de la YMCA. Ejemplos: Periodo 1, Term 2, Christmas Term, Semestre 1, Lanzamiento, Campamento de liderazgo.');
    form.addDateItem().setTitle(pregunta_(P_CRO.inicio, n)).setRequired(true).setHelpText('Start date.');
    form.addDateItem().setTitle(pregunta_(P_CRO.fin, n)).setHelpText('Déjala en blanco si dura un solo día. No puede ser anterior al inicio. · End date; leave blank for a single day.');
    form.addMultipleChoiceItem().setTitle(pregunta_(P_CRO.estado, n)).setRequired(true).setChoiceValues(ESTADOS_CRONOGRAMA)
      .setHelpText('"Cancelado" quita la entrada del cronograma. · "Cancelado" removes the entry.');
    form.addMultipleChoiceItem().setTitle(pregunta_(P_CRO.modalidad, n)).setChoiceValues(MODALIDADES);
    if (n < ENTRADAS) form.addMultipleChoiceItem().setTitle(pregunta_(P_CRO.otra, n)).setRequired(true);
  }
  form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).forEach(function (it) {
    for (let n = 1; n < ENTRADAS; n++) {
      if (it.getTitle() !== pregunta_(P_CRO.otra, n)) continue;
      const mc = it.asMultipleChoiceItem();
      mc.setChoices([mc.createChoice('Sí', saltos[n]), mc.createChoice('No, enviar', FormApp.PageNavigationType.SUBMIT)]);
    }
  });
}

/* ============================== Procesamiento de respuestas ============================== */

/**
 * Se ejecuta con cada respuesta de cualquiera de los formularios (ver `activarFormularios`).
 * Reconoce el formulario por sus preguntas, escribe en la pestaña que corresponde y anota el resultado
 * en la columna "Procesamiento" de la pestaña de respuestas.
 */
function alEnviarFormulario(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const ancho = sh.getLastColumn();
  const cab = sh.getRange(1, 1, 1, ancho).getValues()[0].map(function (h) { return String(h).trim(); });
  const fila = sh.getRange(e.range.getRow(), 1, 1, ancho).getValues()[0];
  const r = {};
  cab.forEach(function (t, i) { if (t && !(t in r)) r[t] = fila[i]; });

  let nota;
  const lock = LockService.getScriptLock();
  lock.waitLock(25000); // dos respuestas simultáneas no se pisan
  try {
    if (!txt_(r, PREGUNTAS_CLAVE.programa) || !txt_(r, PREGUNTAS_CLAVE.ciclo) || !txt_(r, PREGUNTAS_CLAVE.ymca)) nota = 'Sin procesar: falta programa, ciclo o YMCA.';
    else if (P_ALI.institucion in r) nota = procesarAlianza_(r);
    else if (P_CRO.nombre in r) nota = procesarCronograma_(r);
    else if (P_EDAD.grupo in r) nota = procesarEdadGenero_(r);
    else nota = procesarIndicadores_(r);
  } catch (err) {
    nota = 'Error: ' + (err && err.message || err);
  } finally {
    lock.releaseLock();
  }
  let col = cab.indexOf('Procesamiento') + 1;
  if (!col) { col = ancho + 1; sh.getRange(1, col).setValue('Procesamiento').setFontWeight('bold'); }
  sh.getRange(e.range.getRow(), col).setValue(nota);
  CacheService.getScriptCache().remove('mel'); // el dashboard ve el cambio en su siguiente consulta
}

// ----- lectura de una respuesta -----
function txt_(r, titulo) { const v = r[titulo]; return v == null || v instanceof Date ? '' : String(v).trim(); }
function num_(r, titulo) {
  const v = r[titulo];
  if (typeof v === 'number') return v;
  const s = txt_(r, titulo).replace(/[^0-9.\-]/g, '');
  return s === '' || isNaN(Number(s)) ? null : Number(s);
}
function claves_(r) {
  return { programa: txt_(r, PREGUNTAS_CLAVE.programa), ciclo: txt_(r, PREGUNTAS_CLAVE.ciclo), ymca: txt_(r, PREGUNTAS_CLAVE.ymca),
    sede: txt_(r, PREGUNTAS_CLAVE.sede).replace(/\s*\([^)]*\)$/, '') };
}
// compara textos sin distinguir mayúsculas, acentos ni espacios repetidos
function igual_(a, b) {
  const n = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  return n(a) === n(b);
}

// ----- escritura en las pestañas del dashboard -----
/** Quita de la pestaña las filas que cumplen `coincide` y agrega `nuevas` (objetos columna → valor). */
function reemplazar_(nombre, coincide, nuevas) {
  const sh = hoja_().getSheetByName(nombre);
  const v = sh.getDataRange().getValues();
  const cab = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  for (let i = v.length - 1; i >= 1; i--) {
    const o = {};
    cab.forEach(function (c, j) { o[c] = v[i][j]; });
    if (coincide(o)) sh.deleteRow(i + 1);
  }
  if (!nuevas.length) return;
  const filas = nuevas.map(function (o) { return cab.map(function (c) { return o[c] == null ? '' : o[c]; }); });
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, cab.length).setValues(filas);
}
const mismo_ = function (k) {
  return function (o) { return String(o.programa) === k.programa && String(o.ciclo) === k.ciclo && String(o.ymca) === k.ymca; };
};

/** Indicadores: una fila de `kpis` por indicador; reemplaza la fila anterior de la misma YMCA, ciclo e indicador. */
function procesarIndicadores_(r) {
  const k = claves_(r);
  const sh = hoja_().getSheetByName('kpis');
  const data = sh.getDataRange().getValues();
  const fila = {}; // clave → número de fila
  for (let i = 1; i < data.length; i++) fila[data[i].slice(0, 4).join('|')] = i + 1;
  let n = 0;
  Object.keys(PREGUNTA_A_INDICADOR).forEach(function (titulo) {
    const valor = num_(r, titulo);
    if (valor == null) return;
    const indicador = PREGUNTA_A_INDICADOR[titulo];
    const clave = [k.programa, k.ciclo, k.ymca, indicador].join('|');
    if (fila[clave]) sh.getRange(fila[clave], 5).setValue(valor);
    else { sh.appendRow([k.programa, k.ciclo, k.ymca, indicador, valor]); fila[clave] = sh.getLastRow(); }
    n++;
  });
  return 'Procesado: ' + n + ' indicadores en kpis.';
}

/** Edad y género: reemplaza todas las filas del mismo programa, ciclo, YMCA y grupo. */
function procesarEdadGenero_(r) {
  const k = claves_(r);
  const segmento = GRUPOS[txt_(r, P_EDAD.grupo)];
  if (!segmento) return 'Sin procesar: grupo no reconocido.';
  const metodo = txt_(r, P_EDAD.metodo);
  const filas = [];
  let suma = 0;
  const agregar = function (rango, genero, n) {
    if (n == null || n <= 0) return;
    n = Math.round(n);
    suma += n;
    filas.push({ programa: k.programa, segmento: segmento, ciclo: k.ciclo, ymca: k.ymca, rango_edad: rango, genero: genero, n: n, metodo: metodo });
  };
  RANGOS.forEach(function (bloque) {
    bloque[1].concat([]).forEach(function (rango) {
      ['m', 'h'].forEach(function (g) { agregar(rango, GEN[g], num_(r, ETIQUETA_GEN[g] + ' · ' + rango)); });
    });
  });
  ['m', 'h'].forEach(function (g) { agregar(SIN_EDAD, GEN[g], num_(r, ETIQUETA_GEN[g] + ' · ' + SIN_EDAD)); });
  agregar(SIN_EDAD, GEN.nb, num_(r, P_EDAD.nb));
  agregar(SIN_EDAD, GEN.ne, num_(r, P_EDAD.ne));
  if (!filas.length) return 'Sin procesar: todas las casillas están vacías.';
  reemplazar_('edad_genero', function (o) { return mismo_(k)(o) && String(o.segmento) === segmento; }, filas);
  const total = num_(r, P_EDAD.total);
  return 'Procesado: ' + filas.length + ' filas en edad_genero, ' + suma + ' personas.' +
    (total != null && total !== suma ? ' Revisar: el total declarado es ' + total + ' y las casillas suman ' + suma + '.' : '');
}

/** Alianzas: reemplaza la fila de la misma institución y aporte principal. Montos y valoración se quedan en las respuestas. */
function procesarAlianza_(r) {
  const k = claves_(r);
  const institucion = txt_(r, P_ALI.institucion).replace(/\s+/g, ' ');
  const aporte = txt_(r, P_ALI.aporte);
  if (!institucion) return 'Sin procesar: falta el nombre de la institución.';
  const tipo = (APORTES.filter(function (a) { return a[0] === aporte; })[0] || [])[1];
  const persona = function (n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); };
  let detalle = '', personas = null;
  if (tipo === 'dinero') {
    detalle = txt_(r, P_ALI.restringido) === 'Sí' ? 'Fondos exclusivos para el programa' : '';
  } else if (tipo === 'especie') {
    detalle = txt_(r, P_ALI.bien);
  } else if (tipo === 'capacitacion') {
    personas = num_(r, P_ALI.capacitadas);
    detalle = (personas ? persona(personas, 'persona capacitada', 'personas capacitadas') + ' en ' : '') + txt_(r, P_ALI.tema) +
      (txt_(r, P_ALI.certificacion) === 'Sí' ? ' (con certificación)' : '');
  } else if (tipo === 'derivacion') {
    personas = num_(r, P_ALI.derivadas);
    detalle = (personas ? persona(personas, 'persona derivada', 'personas derivadas') + ' · ' : '') + txt_(r, P_ALI.sentido).toLowerCase();
  } else if (tipo === 'voluntariado') {
    personas = num_(r, P_ALI.voluntarias);
    const horas = num_(r, P_ALI.horas);
    detalle = (personas ? persona(personas, 'persona voluntaria', 'personas voluntarias') : '') + (horas ? ' · ' + horas + ' horas' : '');
  } else if (tipo === 'espacios') {
    detalle = [txt_(r, P_ALI.espacio) ? 'Espacio ' + txt_(r, P_ALI.espacio).toLowerCase() : '', txt_(r, P_ALI.frecuencia) ? 'uso ' + txt_(r, P_ALI.frecuencia).toLowerCase() : '']
      .filter(String).join(' · ');
  } else if (tipo === 'conjunta') {
    personas = num_(r, P_ALI.alcanzadas);
    detalle = txt_(r, P_ALI.proyecto) + (personas ? ' · ' + persona(personas, 'persona alcanzada', 'personas alcanzadas') : '');
  }
  const otros = txt_(r, P_ALI.otros).split(/\s*,\s*/).filter(function (a) { return a && a !== aporte; }).join(' | ');
  const corto = function (s) { return s.replace(/\s*\(.*$/, ''); }; // opción sin los ejemplos entre paréntesis
  reemplazar_('alianzas', function (o) { return mismo_(k)(o) && igual_(o.institucion, institucion) && String(o.aporte || '') === aporte; }, [{
    programa: k.programa, ciclo: k.ciclo, ymca: k.ymca, institucion: institucion, objetivo: txt_(r, P_ALI.objetivo),
    tipo_institucion: corto(txt_(r, P_ALI.tipo)), aporte: aporte, otros_aportes: otros, detalle: detalle, personas: personas,
    formalizacion: txt_(r, P_ALI.formalizacion), estado: txt_(r, P_ALI.estado), desde: txt_(r, P_ALI.desde),
    alcance: corto(txt_(r, P_ALI.alcance)), direccion: txt_(r, P_ALI.direccion), sede: k.sede,
  }]);
  return 'Procesado: alianza con ' + institucion + ' en alianzas.';
}

/** Cronograma: hasta ENTRADAS filas por envío; reemplaza la del mismo nombre y borra la que llega como "Cancelado". */
function procesarCronograma_(r) {
  const k = claves_(r);
  const notas = [];
  for (let n = 1; n <= ENTRADAS; n++) {
    const nombre = txt_(r, pregunta_(P_CRO.nombre, n)).replace(/\s+/g, ' ');
    const inicio = r[pregunta_(P_CRO.inicio, n)];
    let fin = r[pregunta_(P_CRO.fin, n)];
    if (!nombre) continue;
    if (!(inicio instanceof Date)) { notas.push(nombre + ': sin fecha de inicio'); continue; }
    if (!(fin instanceof Date)) fin = inicio;
    if (fin < inicio) { notas.push(nombre + ': la fecha de fin es anterior al inicio, no se guardó'); continue; }
    const estado = txt_(r, pregunta_(P_CRO.estado, n));
    const esta = function (o) { return mismo_(k)(o) && igual_(o.etiqueta, nombre); };
    if (estado === 'Cancelado') { reemplazar_('cronograma', esta, []); notas.push(nombre + ': quitado'); continue; }
    const tipo = TIPOS_CRONOGRAMA[txt_(r, pregunta_(P_CRO.tipo, n))] || ['', 'actividad'];
    reemplazar_('cronograma', esta, [{
      programa: k.programa, ciclo: k.ciclo, ymca: k.ymca, etiqueta: nombre, tipo: tipo[1], inicio: inicio, fin: fin,
      categoria: tipo[0], estado: estado, modalidad: txt_(r, pregunta_(P_CRO.modalidad, n)), sede: k.sede,
    }]);
    // aviso si las fechas quedan fuera del ciclo declarado (2026 → 2026; 2026-2027 → de 2026 a 2027)
    const a1 = Number(k.ciclo.slice(0, 4)), a2 = Number(k.ciclo.slice(-4));
    const fuera = inicio.getFullYear() < a1 || fin.getFullYear() > a2;
    notas.push(nombre + ': guardado' + (fuera ? ' (revisar: las fechas no caen en el ciclo ' + k.ciclo + ')' : ''));
  }
  return notas.length ? 'Procesado en cronograma. ' + notas.join('; ') + '.' : 'Sin procesar: no hay entradas.';
}

/** Activador opcional "Al editar": una corrección manual también se publica de inmediato. */
function alEditar() {
  CacheService.getScriptCache().remove('mel');
}
