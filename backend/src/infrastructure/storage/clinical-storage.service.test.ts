import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanStudyName, hasExpectedMagic, isSupportedStudy, MAX_STUDY_BYTES } from './clinical-storage.service.js';

test('admite sólo estudios permitidos dentro del límite', () => {
  assert.equal(isSupportedStudy('application/pdf', MAX_STUDY_BYTES), true);
  assert.equal(isSupportedStudy('image/png', MAX_STUDY_BYTES + 1), false);
  assert.equal(isSupportedStudy('text/html', 100), false);
  assert.equal(isSupportedStudy('image/jpeg', 0), false);
});

test('limpia nombres y detecta firmas de archivo incorrectas', () => {
  assert.equal(cleanStudyName('../informe\u0000.pdf'), '..informe.pdf');
  assert.equal(hasExpectedMagic(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(hasExpectedMagic(Buffer.from('<html>'), 'application/pdf'), false);
  assert.equal(hasExpectedMagic(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'), true);
  assert.equal(hasExpectedMagic(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'), true);
});
