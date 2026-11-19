# wedding

Web de A&A creada con Astro.

## Desarrollo

```sh
npm install
npm run dev
```

El servidor de desarrollo está disponible en `http://localhost:4321`.

## Compilación

```sh
npm run build
npm run preview
```

La web estática se genera en `dist/`.

## RSVP con Google Sheets

El formulario permite indicar asistencia, menú especial y uso del bus, además de
añadir hasta 10 acompañantes (11 personas contando a la persona principal).
Si no se asiste, únicamente se incluye el nombre y la respuesta de asistencia.

El botón **Enviar respuesta** registra directamente los datos en Google Sheets
mediante Google Apps Script. El resumen aparece únicamente después de recibir
la confirmación del servicio y no permite editar los datos enviados.

Durante el envío los campos se bloquean. Si no se puede confirmar el guardado,
**Reintentar envío** utiliza exactamente los mismos datos y referencia para no
duplicar filas. No recargar la página durante un reintento: los datos pendientes
solo se mantienen en memoria. La interactividad requiere JavaScript.

El receptor versionado, sus instrucciones de instalación y actualización y el
contrato de envío están en [`apps-script/`](apps-script/README.md). El endpoint
se configura en `src/lib/rsvp-submit.ts`. El documento de Sheets sigue siendo
privado y se guarda una fila por persona, agrupada por referencia de respuesta.

```sh
npm test
```

Las pruebas de las reglas del RSVP y del receptor de Apps Script utilizan el ejecutor nativo de Node.js;
utiliza Node.js 24 o superior. El modelo y los límites se definen en
`src/lib/rsvp.ts`.

Para comprobar el formulario en Chromium, tanto en escritorio como en una
pantalla móvil de 320 px:

```sh
npx playwright install chromium
npm run test:e2e
```

Estas pruebas compilan la web y comprueban la versión de producción con un
servidor de vista previa temporal. Cubren los campos condicionales, los límites y
la eliminación de acompañantes, el uso del teclado, los nombres largos,
el contenido enviado, la confirmación del guardado y los reintentos. Interceptan
el servicio de Google, por lo que no insertan datos en la hoja real.

El workflow `checks.yml` ejecuta las pruebas unitarias y de navegador en los
push a `dev` y en las pull requests. El despliegue también exige que pasen.

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila y publica la web con cada
push a `main`. También se puede ejecutar manualmente desde la pestaña **Actions**.

En GitHub, configura **Settings → Pages → Build and deployment → Source** como
**GitHub Actions** y conserva `loquepasaesquetequiero.com` como dominio personalizado.

## Estructura

- `src/pages/index.astro`: página principal.
- `src/components/`: portada, formulario y campos reutilizables.
- `src/scripts/rsvp.ts`: acompañantes, validación accesible y resumen.
- `src/lib/rsvp.ts`: modelo de respuesta y reglas del RSVP.
- `src/lib/rsvp-submit.ts`: conexión con el receptor de Google Apps Script.
- `apps-script/`: copia del receptor e instrucciones de despliegue manual.
- `src/styles/`: estilos base y campos compartidos, acotados a la sección RSVP.
- `tests/`: recorridos del formulario en navegador.
- `public/`: archivos estáticos, incluido el `CNAME` del dominio personalizado.
- `astro.config.mjs`: configuración de Astro y URL del sitio.
