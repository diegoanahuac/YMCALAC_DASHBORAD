/*
 * Configuración del Sistema MEL YMCA LAC.
 * Es el único archivo que hay que tocar para conectar el dashboard a Google Sheets.
 *
 * source.type:
 *   'snapshot'   → lee los JSON de la carpeta /data del repositorio (sin conexión en vivo).
 *   'appsScript' → lee el JSON que publica apps-script/Code.gs (recomendado: la hoja queda privada).
 *   'gviz'       → lee la hoja directamente; exige compartirla como "Cualquier persona con el enlace: lector".
 */
window.MEL_CONFIG = {
  source: {
    type: 'appsScript',
    url: 'https://script.google.com/macros/s/AKfycbyJLNnN12sQMiSz8A4yALYKqpvZhnJJ0tqyJqmU88bunjwz6PxxThrPRA7amErDOLE2aw/exec',

    // type: 'snapshot',

    // type: 'gviz',
    // sheetId: 'ID_DE_LA_HOJA',
    // tabs: { kpis: 'kpis' },   // solo si una pestaña se llama distinto que el dataset
  },

  // Cada cuántos segundos se vuelve a consultar la hoja (mínimo 15).
  refreshSeconds: 60,
  // Tiempo máximo de espera por consulta.
  timeoutMs: 25000,

  // Filtros con los que abre el dashboard.
  defaults: { prog: 'Todos', ciclo: '2025', ymca: 'Todas', equipo: 'Pares', tp: 'Participantes' },
  // Año que abren las vistas anuales (Regional y Perfil por YMCA). Vacío = el año más reciente con datos.
  defaultYear: '2025',
  // YMCA que abre "Perfil por YMCA".
  defaultYmca: 'YMCA México',

  features: {
    // Tabla de avance del reporte por YMCA en la pestaña Regional.
    semaforo: true,
    // Calcula totales ("Todas", "Histórico", "Todos") y variaciones cuando la hoja no los trae.
    derivar: true,
  },
};
