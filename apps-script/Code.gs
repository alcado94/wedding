// ID del documento, entre /d/ y /edit en su URL. No es el ID de implementación.
const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_HOJA';
const SHEET_NAME = 'Respuestas';
const HEADERS = [
  'Referencia', 'Fecha de recepción', 'Persona principal', 'Tipo', 'Nombre',
  'Asistencia', 'Menú especial / intolerancias', 'Autobús', 'Huella del envío'
];

function prepararHoja() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    obtenerHoja_();
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  let lock;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 50000) {
      return json_({ ok: false, message: 'Envío vacío o demasiado grande.' });
    }
    let submission;
    try {
      submission = validarEnvio_(JSON.parse(raw));
    } catch (_) {
      return json_({ ok: false, message: 'Revisa los datos del formulario antes de enviarlo.' });
    }
    const fingerprint = huella_(submission.response);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      return json_({ ok: false, message: 'El servicio está ocupado. Inténtalo de nuevo.' });
    }
    const sheet = obtenerHoja_();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const existing = sheet.getRange(2, 1, lastRow - 1, 1)
        .createTextFinder(submission.submissionId)
        .matchEntireCell(true).useRegularExpression(false).findNext();
      if (existing) {
        const stored = sheet.getRange(existing.getRow(), HEADERS.length).getValue();
        if (stored !== fingerprint) {
          return json_({ ok: false, message: 'La referencia ya corresponde a otro envío.' });
        }
        return json_({ ok: true, submissionId: submission.submissionId });
      }
    }
    const response = submission.response;
    const date = new Date();
    const primaryName = response.attending ? response.guest.fullName : response.fullName;
    const people = response.attending
      ? [response.guest, ...response.companions]
      : [{ fullName: response.fullName, dietary: '', needsBus: false }];
    const rows = people.map((person, index) => [
      submission.submissionId, date, texto_(primaryName),
      index === 0 ? 'Principal' : 'Acompañante', texto_(person.fullName),
      response.attending ? 'Sí' : 'No',
      response.attending ? texto_(person.dietary) : '',
      response.attending ? (person.needsBus ? 'Sí' : 'No') : '', fingerprint
    ]);
    const firstRow = sheet.getLastRow() + 1;
    const requiredLastRow = firstRow + rows.length - 1;
    if (requiredLastRow > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), requiredLastRow - sheet.getMaxRows());
    }
    sheet.getRange(firstRow, 1, rows.length, HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
    return json_({ ok: true, submissionId: submission.submissionId });
  } catch (_) {
    return json_({ ok: false, message: 'No se ha podido confirmar el guardado. Reintenta el envío.' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function obtenerHoja_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  const actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (actual.some((value, index) => value !== HEADERS[index])) {
    throw new Error('Las columnas de la hoja no coinciden.');
  }
  return sheet;
}

function validarEnvio_(body) {
  if (!body || typeof body !== 'object' || typeof body.submissionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.submissionId)) {
    throw new Error('Referencia inválida.');
  }
  const response = body.response;
  if (!response || typeof response.attending !== 'boolean') throw new Error('Asistencia inválida.');
  if (!response.attending) {
    return {
      submissionId: body.submissionId.toLowerCase(),
      response: { attending: false, fullName: nombre_(response.fullName) }
    };
  }
  if (!Array.isArray(response.companions) || response.companions.length > 10) {
    throw new Error('Acompañantes inválidos.');
  }
  return {
    submissionId: body.submissionId.toLowerCase(),
    response: {
      attending: true, guest: persona_(response.guest),
      companions: response.companions.map(persona_)
    }
  };
}

function persona_(value) {
  if (!value || typeof value !== 'object' || typeof value.dietary !== 'string' ||
      value.dietary.length > 1000 || typeof value.needsBus !== 'boolean') {
    throw new Error('Persona inválida.');
  }
  return { fullName: nombre_(value.fullName), dietary: value.dietary.trim(), needsBus: value.needsBus };
}

function nombre_(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
    throw new Error('Nombre inválido.');
  }
  return value.trim();
}

// Fuerza texto literal, incluso cuando empieza por un signo de fórmula.
function texto_(value) {
  return value ? "'" + value : '';
}

function huella_(response) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, JSON.stringify(response), Utilities.Charset.UTF_8
  ));
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
