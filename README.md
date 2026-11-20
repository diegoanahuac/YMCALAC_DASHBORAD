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

El dashboard ya lee una hoja de Google a través de la aplicación web indicada en [`js/config.js`](js/config.js). Si esa hoja no responde, muestra los datos de respaldo de `/data`. Para conectarlo a otra hoja:

1. Crea una hoja de cálculo y abre **Extensiones → Apps Script**. Pega el contenido de [`apps-script/Code.gs`](apps-script/Code.gs). También sirve un proyecto nuevo en <https://script.google.com> con el ID de la hoja escrito en `SHEET_ID`.
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

En Apps Script ejecuta `crearFormularios`. La función crea los cuatro formularios, los vincula a la hoja (una pestaña de respuestas por formulario), activa el procesamiento de cada envío y anota en la pestaña `LEEME` los enlaces para responder y para editar.

| Formulario | Escribe en | Un envío es | Para corregir |
| --- | --- | --- | --- |
| [Indicadores](https://docs.google.com/forms/d/e/1FAIpQLSdhY3tlFAl620PfzpNbVeuOV7D9NHlJ2_UrTzUNtLxLZombWQ/viewform) | `kpis` | Los indicadores de un programa, ciclo y YMCA | Reenviar: reemplaza el valor de cada indicador |
| [Edad y género](https://docs.google.com/forms/d/e/1FAIpQLSecB_priOKYOyyu8cB2poJHcvrsDfHL-Bdbj00xe0MZaJlWJQ/viewform) | `edad_genero` | Las cifras de un grupo (participantes, equipo, jóvenes líderes…) | Reenviar: reemplaza todas las filas del grupo |
| [Alianzas](https://docs.google.com/forms/d/e/1FAIpQLScOXtGVGo3p9UZO89W0-_6WmUAYW5Nq9xiYIvWiyZciBOXFfQ/viewform) | `alianzas` | Una alianza con una institución | Reenviar con el mismo nombre de institución y aporte principal |
| [Cronograma](https://docs.google.com/forms/d/e/1FAIpQLSfIGLWSO4CgwbCUSvOe_S-mFr-BDpe5A_kiS_BsSj1RUcECQw/viewform) | `cronograma` | Hasta tres periodos, eventos o actividades | Reenviar con el mismo nombre; el estado "Cancelado" quita la entrada |

Cada envío deja su resultado en la columna `Procesamiento` de la pestaña de respuestas: qué se guardó y qué hay que revisar (por ejemplo, que las casillas de edad no suman el total declarado, o que la fecha de fin es anterior al inicio).

**Edad y género.** Cifras agregadas, nunca datos de personas. Pide el total del grupo, cómo se obtuvo (conteo, conteo parcial o estimación) y una casilla por rango de edad para mujeres y niñas y otra para hombres y niños. Las personas no binarias y las que prefieren no decir su género se piden como total, sin edad. Los cuatro géneros equivalen a Male / Female / Non-binary / Unknown del FDRS 2024 de la IFRC. El dashboard suma por género, por YMCA, por ciclo y por año; una cifra de personas no binarias menor a `minCelda` (5) se publica sumada a "No especifica".

**Alianzas.** Clasifica la institución (10 tipos, compatibles con el codelist OrganisationType de IATI), su estado, formalización, año de inicio, alcance y quién aporta a quién. El aporte principal abre una sección de detalle: capacitación (tema, personas capacitadas, certificación), derivación, voluntariado, donación en especie, espacios, implementación conjunta o financiamiento. Los montos y la valoración de la alianza se quedan en la pestaña de respuestas; no llegan al dashboard.

**Cronograma.** Diez tipos de entrada que el dashboard dibuja como periodo, evento o actividad. "En curso" no se pregunta: se deduce de las fechas.

**Listas de YMCA.** Salen de las pestañas `ymcas` (27 movimientos nacionales de América Latina y el Caribe, por subregión) y `asociaciones` (asociaciones locales). Para agregar una YMCA, añade una fila; las listas de los cuatro formularios se actualizan solas una vez al día, o al momento con `actualizarListas`. Una fila con `en_formulario = No` no aparece.

Los títulos de las preguntas y los textos de las opciones son la llave con la que el script lee cada respuesta. Si cambias uno en el formulario, cámbialo también en las constantes del inicio de `Code.gs`. Para agregar un indicador: añade la pregunta al formulario de indicadores y su título exacto a `PREGUNTA_A_INDICADOR`.

**Código de reporte.** Los formularios son públicos, así que cada envío pide un código. Ejecuta `protegerFormularios` una vez: escribe un código por YMCA en la columna `codigo` de la pestaña `ymcas`, uno maestro en la fila `*` (sirve para cualquier YMCA) y agrega la pregunta a los cuatro formularios. Un envío sin el código de su YMCA no se procesa y queda anotado en `Procesamiento`. Para cambiar un código, edita su celda; para quitar la protección, vacía la columna. Los códigos viven solo en la hoja: no están en este repositorio ni los entrega la aplicación web, y la pestaña de respuestas los guarda como `•••`.
Un ciclo aparece en el dashboard cuando tiene al menos un indicador en `kpis`.

### Tiempo de reacción

| Tramo | Demora |
| --- | --- |
| Formulario → hoja → pestaña `kpis` | 2 a 10 s |
| Caché de la aplicación web | hasta 20 s; se vacía sola con cada respuesta de formulario |
| Respuesta de la aplicación web | 1.5 s con caché, unos 5 s sin caché |
| Consulta del dashboard | cada 60 s (`refreshSeconds`, mínimo 15) |

Un dato nuevo aparece en pantalla en menos de 90 s sin recargar (64 s medidos al editar una celda a mano), o en pocos segundos con **Actualizar**.
El dashboard deja de consultar cuando la pestaña del navegador está oculta y retoma al volver.
Si la hoja no responde, conserva los últimos datos, lo indica en la barra de estado y reintenta con esperas crecientes.

## Datos

Una pestaña de la hoja (o un archivo de `/data`) por dataset. Los encabezados deben coincidir tal cual.

| Dataset | Columnas |
| --- | --- |
| `kpis` | programa, ciclo, ymca, indicador, valor, anterior\*, cambio_pct\* |
| `implementaciones` | programa, ciclo, ymca, pais, ciudad, lat, lon, comunidad, donantes |
| `cronograma` | programa, ciclo, ymca, etiqueta, tipo (`periodo`, `evento`, `actividad`), inicio, fin, categoria\*, estado\*, modalidad\*, sede\* |
| `edad_genero` | programa, segmento, ciclo, ymca, rango_edad, genero, n, metodo\* |
| `alianzas` | programa, ciclo, ymca, institucion, objetivo\*, tipo_institucion\*, aporte\*, otros_aportes\*, detalle\*, personas\*, formalizacion\*, estado\*, desde\*, alcance\*, direccion\*, sede\* |
| `perfil_after_school` | ciclo, ymca, formato, hello_insight, tipo_ciclo, continuidad, inicio, fin, locaciones_texto, dias, areas, uso_fondos, otros_donantes, comunidad |
| `perfil_bluedrop` | ciclo, ymca, modelo, programas_uso, habilidades, actividades |
| `perfil_tejiendo_paz` | ciclo, ymca, tipo_violencia, grupos_prioritarios |
| `eventos_delta` | id, ciclo, ymca, evento, tipo, inicio, fin, participantes, fondos_usd, voluntariado, narrativa |
| `registro_datos` | id, programa, informacion, estado, fuente, nota |

\* Opcionales. `mapa_base` (contornos de países) siempre se lee del repositorio.
Las pestañas `ymcas` y `asociaciones` son catálogos para los formularios; la aplicación web no las entrega.

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
En `edad_genero` pasa lo mismo: a partir de las filas por rango se calculan el total por género (`rango_edad = Todas`), `Todas` las YMCA, `Histórico` y `Todos` los programas.
Las tasas (`tasa_…`) no se agregan.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `index.html`, `css/` | Página y estilos |
| `js/config.js` | Fuente de datos, frecuencia de consulta y valores por defecto |
| `js/dash.js` | Lectura de datos, sondeo, respaldo, validación de columnas y filtros en la URL |
| `js/derive.js` | Totales automáticos |
| `js/charts.js`, `js/app.js` | Gráficas y lógica de cada pestaña |
| `data/` | Datos de respaldo y catálogos de YMCA (`ymcas.json`, `asociaciones.json`) |
| `apps-script/Code.gs` | Conector para la hoja de cálculo: aplicación web, creación de formularios y procesamiento de respuestas |

Los filtros viajan en la dirección, así que una vista se comparte copiando el enlace:
`…/?ciclo=2026-2027&ymca=YMCA+Barbados#after-school`.

## Privacidad

El repositorio es público: todo lo que esté en `/data` y lo que entregue la aplicación web puede leerlo cualquiera que tenga la dirección.
Publica solo cifras agregadas, nunca datos personales de participantes.
