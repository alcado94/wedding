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

## RSVP en preproducción

El formulario permite indicar asistencia, menú especial y uso del bus, además de
añadir hasta 10 acompañantes (11 personas contando a la persona principal).
Si no se asiste, únicamente se incluye el nombre y la respuesta de asistencia.

El botón **Revisar respuesta** genera un resumen editable en el navegador.
Cada persona dispone de un acceso **Editar datos** que devuelve el foco a su
nombre. **Volver a editar** lleva al inicio del formulario, conservando los datos.
Esta primera versión es una demostración: no envía ni guarda respuestas.
Los valores se conservan mientras se edita, pero se pierden al recargar la página.
La interactividad requiere JavaScript.

```sh
npm test
```

Las pruebas de las reglas del RSVP utilizan el ejecutor nativo de Node.js;
utiliza Node.js 24 o superior. El modelo y los límites se definen en
`src/lib/rsvp.ts`, preparados para conectar un servicio de envío posteriormente.

Para comprobar el formulario en Chromium, tanto en escritorio como en una
pantalla móvil de 320 px:

```sh
npx playwright install chromium
npm run test:e2e
```

Estas pruebas compilan la web y comprueban la versión de producción con un
servidor de vista previa temporal. Cubren los campos condicionales, los límites y
la eliminación de acompañantes, la edición por persona, el uso del teclado y
los nombres largos sin desbordamiento horizontal.

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
- `src/styles/`: estilos base y campos compartidos, acotados a la sección RSVP.
- `tests/`: recorridos del formulario en navegador.
- `public/`: archivos estáticos, incluido el `CNAME` del dominio personalizado.
- `astro.config.mjs`: configuración de Astro y URL del sitio.
