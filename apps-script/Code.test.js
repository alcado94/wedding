import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const code = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const submissionId = '8c119461-98d2-48af-9dda-5f63950eb614';
const guest = { fullName: 'Ana García', dietary: '=1+1', needsBus: true };

// Run the real receiver with in-memory Google service doubles; no network calls.
function receiver() {
  const rows = [];
  let locked = false;
  let failWrite = false;
  const lock = {
    tryLock() { locked = true; return true; },
    hasLock() { return locked; },
    releaseLock() { locked = false; },
  };
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    setFrozenRows() {},
    getRange(row, column) {
      return {
        setValues(values) {
          if (failWrite && row > 1) throw new Error('Write failed');
          values.forEach((value, index) => { rows[row - 1 + index] = [...value]; });
        },
        getValues: () => [rows[row - 1]],
        getValue: () => rows[row - 1][column - 1],
        createTextFinder(id) {
          return {
            matchEntireCell() { return this; },
            useRegularExpression() { return this; },
            findNext() {
              const index = rows.findIndex((value, index) => index > 0 && value[0] === id);
              return index < 0 ? null : { getRow: () => index + 1 };
            },
          };
        },
      };
    },
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      flush() {},
    },
    LockService: { getScriptLock: () => lock },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_, text) => createHash('sha256').update(text).digest(),
      base64EncodeWebSafe: (value) => Buffer.from(value).toString('base64url'),
    },
  });
  vm.runInContext(code, context);
  return {
    rows,
    locked: () => locked,
    failWrite: () => { failWrite = true; },
    post: (body) => context.doPost({ postData: { contents: JSON.stringify(body) } }),
  };
}

test('Apps Script writes all people together, escapes text and deduplicates retries', () => {
  const service = receiver();
  const body = { submissionId, response: { attending: true, guest, companions: [guest] } };
  assert.equal(service.post(body).ok, true);
  assert.equal(service.rows.length, 3);
  assert.equal(service.rows[1][6], "'=1+1");
  assert.equal(service.rows[2][3], 'Acompañante');
  assert.equal(service.post(body).ok, true);
  assert.equal(service.rows.length, 3);
  body.response.guest = { ...guest, fullName: 'Changed' };
  assert.equal(service.post(body).ok, false);
  assert.equal(service.rows.length, 3);
  assert.equal(service.locked(), false);
});

test('Apps Script omits inactive details for a decline', () => {
  const service = receiver();
  assert.equal(service.post({ submissionId, response: {
    attending: false, fullName: 'Ana', guest, companions: [guest],
  } }).ok, true);
  assert.equal(service.rows.length, 2);
  assert.equal(service.rows[1][5], 'No');
  assert.equal(service.rows[1][6], '');
  assert.equal(service.rows[1][7], '');
});

test('Apps Script rejects invalid and oversized groups before writing', () => {
  const service = receiver();
  for (const body of [
    {},
    { submissionId, response: { attending: true, guest, companions: Array(11).fill(guest) } },
    { submissionId, response: { attending: true, guest: { ...guest, needsBus: 'yes' }, companions: [] } },
  ]) assert.equal(service.post(body).ok, false);
  assert.equal(service.rows.length, 0);
});

test('Apps Script never confirms a failed write and releases its lock', () => {
  const service = receiver();
  service.failWrite();
  assert.equal(service.post({ submissionId, response: { attending: false, fullName: 'Ana' } }).ok, false);
  assert.equal(service.locked(), false);
  assert.equal(service.rows.length, 1);
});
