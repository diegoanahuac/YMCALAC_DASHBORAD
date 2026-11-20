# Sistema MEL · YMCA LAC

Dashboard de Monitoreo, Evaluación y Aprendizaje de los programas y proyectos regionales de YMCA LAC
(Eleva, After School Programme y Bluedrop, Tejiendo Paz, Patrocinios Delta Air Lines y perfil por YMCA).

Es un sitio estático: HTML, CSS y JavaScript sin paso de compilación ni servidor propio.
Los datos llegan por esta ruta:

```
Google Forms  →  Google Sheets  →  Apps Script (JSON)  →  Dashboard
 respuesta        pestañas          aplicación web         consulta cada 60 s
```

## Verlo en local

```bash
python3 -m http.server 8787
```

Abre <http://localhost:8787>. Abrir `index.html` con doble clic no funciona: el navegador bloquea la lectura de `/data`.

## Publicarlo

En GitHub: **Settings → Pages → Deploy from a branch → `main` / root**. El sitio queda en
`https://diegoanahuac.github.io/YMCALAC_DASHBORAD/`.

## Conectar Google Sheets

Hoy el dashboard abre con los datos de respaldo de `/data`. Para que lea la hoja en vivo:

1. Crea una hoja de cálculo y abre **Extensiones → Apps Script**. Pega el contenido de [`apps-script/Code.gs`](apps-script/Code.gs).
2. Ejecuta `configurar`: crea una pestaña por dataset con sus encabezados.
3. Ejecuta `importarDatosActuales` si quieres partir de los datos que ya muestra el dashboard.
4. **Implementar → Nueva implementación → Aplicación web**, con *Ejecutar como: yo* y *Acceso: cualquier persona*. Copia la URL que termina en `/exec`.
5. En [`js/config.js`](js/config.js) cambia la fuente:

   ```js
   source: { type: 'appsScript', url: 'https://script.google.com/macros/s/…/exec' },
   ```

La hoja sigue privada: la aplicación web solo entrega las pestañas del dashboard.

Alternativa sin Apps Script: `type: 'gviz'` con el `sheetId`. Exige compartir la hoja como
"cualquier persona con el enlace" y dar formato de texto a la columna `ciclo`
(si mezcla `2023` con `2025-2026`, Google descarta los valores del tipo minoritario).

## Conectar Google Forms

1. Vincula el formulario a la misma hoja (**Respuestas → Vincular con Hojas de cálculo**).
2. El formulario necesita las preguntas `Programa`, `Ciclo` y `YMCA`, más una pregunta numérica por indicador.
3. En `Code.gs`, ajusta `PREGUNTA_A_INDICADOR` con los títulos exactos de tus preguntas.
4. En Apps Script ejecuta `activarFormularios` una vez.

Cada respuesta se convierte en filas de la pestaña `kpis` y reemplaza el valor anterior de esa YMCA, ciclo e indicador.

### Tiempo de reacción

| Tramo | Demora |
| --- | --- |
| Formulario → hoja → pestaña `kpis` | 2 a 10 s |
| Caché de la aplicación web | hasta 20 s; se vacía sola con cada respuesta |
| Consulta del dashboard | cada 60 s (`refreshSeconds`, mínimo 15) |

Un dato nuevo aparece en pantalla en menos de 70 s sin recargar, o de inmediato con **Actualizar**.
El dashboard deja de consultar cuando la pestaña del navegador está oculta y retoma al volver.
Si la hoja no responde, conserva los últimos datos, lo indica en la barra de estado y reintenta con esperas crecientes.

## Datos

Una pestaña de la hoja (o un archivo de `/data`) por dataset. Los encabezados deben coincidir tal cual.

| Dataset | Columnas |
| --- | --- |
| `kpis` | programa, ciclo, ymca, indicador, valor, anterior\*, cambio_pct\* |
| `implementaciones` | programa, ciclo, ymca, pais, ciudad, lat, lon, comunidad, donantes |
| `cronograma` | programa, ciclo, ymca, etiqueta, tipo (`periodo`, `evento`, `actividad`), inicio, fin |
| `edad_genero` | programa, segmento, ciclo, ymca, rango_edad, genero, n |
| `alianzas` | programa, ciclo, ymca, institucion, objetivo |
| `perfil_after_school` | ciclo, ymca, formato, hello_insight, tipo_ciclo, continuidad, inicio, fin, locaciones_texto, dias, areas, uso_fondos, otros_donantes, comunidad |
| `perfil_bluedrop` | ciclo, ymca, modelo, programas_uso, habilidades, actividades |
| `perfil_tejiendo_paz` | ciclo, ymca, tipo_violencia, grupos_prioritarios |
| `eventos_delta` | id, ciclo, ymca, evento, tipo, inicio, fin, participantes, fondos_usd, voluntariado, narrativa |
| `registro_datos` | id, programa, informacion, estado, fuente, nota |

\* Opcionales. `mapa_base` (contornos de países) siempre se lee del repositorio.

Valores de `programa`: `Eleva`, `After School`, `Bluedrop`, `Tejiendo Paz`, `Delta`.
Las listas dentro de una celda se separan con `|`. Las fechas van como fecha de Sheets o `AAAA-MM-DD`.

### Totales automáticos

En `kpis` basta una fila por YMCA, ciclo e indicador. [`js/derive.js`](js/derive.js) calcula lo demás cuando la hoja no lo trae:

- `ymca = Todas`: suma de las YMCA del programa en ese ciclo.
- `ciclo = Histórico`: suma de todos los ciclos.
- `programa = Todos`: consolidado por año calendario. After School 2025-2026 cuenta en 2025. Los participantes de Bluedrop no se suman otra vez porque ocurren dentro de After School; sus fondos sí.
- `ymcas`, `paises`, `ciudades`: se cuentan desde `implementaciones`.
- `anterior` y `cambio_pct`: contra el ciclo previo del mismo programa.

Una fila escrita a mano siempre gana. Sirve para totales que no son una suma, como un total regional sin desglose por YMCA.
Las tasas (`tasa_…`) no se agregan.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `index.html`, `css/` | Página y estilos |
| `js/config.js` | Fuente de datos, frecuencia de consulta y valores por defecto |
| `js/dash.js` | Lectura de datos, sondeo, respaldo, validación de columnas y filtros en la URL |
| `js/derive.js` | Totales automáticos |
| `js/charts.js`, `js/app.js` | Gráficas y lógica de cada pestaña |
| `data/` | Datos de respaldo |
| `apps-script/Code.gs` | Conector para la hoja de cálculo |

Los filtros viajan en la dirección, así que una vista se comparte copiando el enlace:
`…/?ciclo=2026-2027&ymca=YMCA+Barbados#after-school`.

## Privacidad

El repositorio es público: todo lo que esté en `/data` y lo que entregue la aplicación web puede leerlo cualquiera que tenga la dirección.
Publica solo cifras agregadas, nunca datos personales de participantes.
