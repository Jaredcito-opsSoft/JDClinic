import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clinicDateKey, clinicDayRange, isValidDateKey } from './clinic-time.service.js';

test('la jornada de la clínica usa Ciudad de México aunque el servidor esté en UTC', () => {
  assert.equal(clinicDateKey(new Date('2026-11-08T04:00:00.000Z'), 'America/Mexico_City'), '2026-11-07');
  const range = clinicDayRange('2026-11-08', 'America/Mexico_City');
  assert.equal(range.start.toISOString(), '2026-11-08T06:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-11-09T06:00:00.000Z');
});

test('el rango respeta cambios de horario y rechaza fechas inexistentes', () => {
  const range = clinicDayRange('2026-03-08', 'America/New_York');
  assert.equal(range.start.toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(isValidDateKey('2026-02-29'), false);
  assert.equal(isValidDateKey('2028-02-29'), true);
});
