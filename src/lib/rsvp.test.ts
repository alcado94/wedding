import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResponse, MAX_COMPANIONS, NAME_MAX_LENGTH, DIETARY_MAX_LENGTH } from './rsvp.ts';

function attendingData() {
  const data = new FormData();
  data.set('primary-name', '  María de los Ángeles  ');
  data.set('attendance', 'yes');
  data.set('primary-bus', 'no');
  data.set('accompanied', 'no');
  return data;
}

test('a decline excludes dietary, bus and all companions', () => {
  const data = attendingData();
  data.set('attendance', 'no');
  data.set('primary-dietary', 'Sin gluten');
  assert.deepEqual(buildResponse(data, ['hidden-companion']), { attending: false, fullName: 'María de los Ángeles' });
});

test('a solo attendee excludes inactive companions and normalizes text', () => {
  const data = attendingData();
  data.set('primary-dietary', '  Menú vegetariano  ');
  assert.deepEqual(buildResponse(data, ['hidden-companion']), {
    attending: true,
    guest: { fullName: 'María de los Ángeles', dietary: 'Menú vegetariano', needsBus: false },
    companions: [],
  });
});

test('ten companions are accepted, an eleventh is rejected', () => {
  const data = attendingData();
  data.set('accompanied', 'yes');
  const ids = Array.from({ length: MAX_COMPANIONS }, (_, index) => `guest-${index}`);
  ids.forEach((id) => {
    data.set(`${id}-name`, 'José Pérez');
    data.set(`${id}-bus`, 'yes');
  });
  const response = buildResponse(data, ids);
  assert.ok(response.attending);
  assert.equal(response.companions.length, 10);
  assert.equal(response.companions[0].needsBus, true);
  assert.throws(() => buildResponse(data, [...ids, 'extra']));
  assert.throws(() => buildResponse(data, [ids[0], ids[0]]));
});

test('removed companions are omitted without losing remaining guests', () => {
  const data = attendingData();
  data.set('accompanied', 'yes');
  for (const id of ['first', 'removed', 'last']) {
    data.set(`${id}-name`, id);
    data.set(`${id}-bus`, 'no');
  }
  const response = buildResponse(data, ['first', 'last']);
  assert.ok(response.attending);
  assert.deepEqual(response.companions.map((guest) => guest.fullName), ['first', 'last']);
});

test('required choices, companion details and non-blank names are validated', () => {
  for (const field of ['attendance', 'accompanied', 'primary-bus']) {
    const data = attendingData();
    data.delete(field);
    assert.throws(() => buildResponse(data, []));
  }
  const data = attendingData();
  data.set('primary-name', '   ');
  assert.throws(() => buildResponse(data, []));
  data.set('primary-name', 'A'.repeat(NAME_MAX_LENGTH + 1));
  assert.throws(() => buildResponse(data, []));
  data.set('primary-name', 'Ana');
  data.set('primary-dietary', 'A'.repeat(DIETARY_MAX_LENGTH + 1));
  assert.throws(() => buildResponse(data, []));
  data.delete('primary-dietary');
  data.set('accompanied', 'yes');
  assert.throws(() => buildResponse(data, []));
  assert.throws(() => buildResponse(data, ['incomplete']));
});
