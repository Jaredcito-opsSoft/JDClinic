import { test, describe } from 'node:test';
import assert from 'node:assert';
import { NodeCryptoEncryptionAdapter } from './node-crypto-encryption.adapter.js';

describe('NodeCryptoEncryptionAdapter (AES-256-GCM FLE)', () => {
  const testKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const adapter = new NodeCryptoEncryptionAdapter(testKeyHex);

  test('debe cifrar y descifrar texto clínico correctamente', () => {
    const rawNote = 'Paciente refiere dolor torácico opresivo de 2 horas de evolución.';
    const encrypted = adapter.encrypt(rawNote);

    assert.ok(encrypted.ciphertext.length > 0);
    assert.strictEqual(encrypted.iv.length, 24); // 12 bytes = 24 hex
    assert.strictEqual(encrypted.tag.length, 32); // 16 bytes = 32 hex

    const decrypted = adapter.decrypt(encrypted);
    assert.strictEqual(decrypted, rawNote);
  });

  test('debe fallar si el texto cifrado ha sido manipulado (Integridad GCM)', () => {
    const rawNote = 'Alergia severa a Penicilina G y Cefalosporinas';
    const encrypted = adapter.encrypt(rawNote);

    // Manipulamos el ciphertext
    const tamperedPayload = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.substring(0, encrypted.ciphertext.length - 4) + 'AAAA',
    };

    assert.throws(() => {
      adapter.decrypt(tamperedPayload);
    }, /Violación de integridad/);
  });

  test('debe generar hash encadenado SHA-256 determinista', () => {
    const prevHash = 'abc001';
    const event = '{"action":"RECORD_READ","user_id":"u1"}';
    const hash1 = adapter.hashAuditChain(prevHash, event);
    const hash2 = adapter.hashAuditChain(prevHash, event);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });
});
