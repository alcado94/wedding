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

## Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` compila y publica la web con cada
push a `main`. También se puede ejecutar manualmente desde la pestaña **Actions**.

En GitHub, configura **Settings → Pages → Build and deployment → Source** como
**GitHub Actions** y conserva `loquepasaesquetequiero.com` como dominio personalizado.

## Estructura

- `src/pages/index.astro`: página principal.
- `public/`: archivos estáticos, incluido el `CNAME` del dominio personalizado.
- `astro.config.mjs`: configuración de Astro y URL del sitio.
