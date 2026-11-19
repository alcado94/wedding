# Receptor del RSVP

`Code.gs` es la copia versionada del receptor de Google Apps Script, compatible
con el script facilitado para la primera implementación. No se publica en GitHub
Pages ni se despliega automáticamente desde este repositorio.

1. Abre **Extensiones → Apps Script** desde el documento de Google Sheets.
2. Copia `Code.gs` y establece `SPREADSHEET_ID` con el ID de tu documento.
3. Ejecuta `prepararHoja` una vez y autoriza el acceso. Crea la pestaña
   `Respuestas`; conserva sus encabezados y orden. Puedes ocultar la columna I.
4. Implementa como aplicación web, ejecutándose como propietario y con acceso
   para cualquier persona, sin iniciar sesión. Mantén privado el documento.
5. Para actualizar una implementación existente: **Implementar → Gestionar
   implementaciones → Editar → Nueva versión → Implementar**, conservando su URL.

El endpoint se configura en `src/lib/rsvp-submit.ts`. La web envía JSON con
`Content-Type: text/plain;charset=UTF-8`, sin credenciales y siguiendo las
redirecciones del servicio. Solo acepta una confirmación JSON con `ok: true` y
el mismo `submissionId`. No usa `no-cors` ni considera una respuesta opaca como éxito.

Se registra una fila por persona y se agrupa por UUID. Los reintentos con el mismo
UUID y datos no añaden filas; cambios con el mismo UUID se rechazan. Un bloqueo
del script serializa la comprobación y la escritura. No hay operaciones públicas
de lectura o edición. Esto no identifica a quien rellene otra vez el formulario.

Tras iniciar un envío la web conserva una instantánea en memoria y bloquea los
campos: si se pierde la confirmación, el reintento usa los mismos datos y UUID.
No recargar durante un reintento: la instantánea no persiste al cerrar o recargar.

Las pruebas de navegador interceptan el endpoint y no insertan datos reales.
`npm test` también ejecuta `Code.test.js` sobre el código real del receptor con
servicios de Google simulados: comprueba registros, validación, deduplicación,
rechazo de modificaciones y fallos de escritura sin confirmar el guardado.
Para verificar el despliegue completo, realizar una respuesta controlada desde
la web publicada y comprobar sus filas en Sheets. Una petición inválida permite
comprobar acceso anónimo y CORS sin registrar invitados, pero no verifica permisos
de escritura ni la configuración del documento.
