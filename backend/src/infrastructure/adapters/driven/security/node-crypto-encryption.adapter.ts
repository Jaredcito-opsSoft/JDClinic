import crypto from 'node:crypto';
import { EncryptedPayload, IEncryptionService } from '../../../../core/domain/ports/services/encryption.service.port.js';

export class NodeCryptoEncryptionAdapter implements IEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(encryptionKeyHex?: string) {
    const rawKey = encryptionKeyHex || process.env.CLINICAL_FLE_MASTER_KEY;
    if (!rawKey) {
      throw new Error('FATAL: CLINICAL_FLE_MASTER_KEY no está configurada en las variables de entorno.');
    }

    this.key = Buffer.from(rawKey, 'hex');
    if (this.key.length !== 32) {
      throw new Error('FATAL: CLINICAL_FLE_MASTER_KEY debe ser de 32 bytes (64 caracteres hexadecimales).');
    }
  }

  /**
   * Cifra un texto clínico con AES-256-GCM y genera un IV único de 12 bytes.
   */
  public encrypt(plainText: string): EncryptedPayload {
    if (!plainText) {
      return { ciphertext: '', iv: '', tag: '' };
    }

    const iv = crypto.randomBytes(12); // NIST SP 800-38D estándar
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let ciphertext = cipher.update(plainText, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const tag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  /**
   * Descifra el texto asegurando la autenticidad con el Tag GCM.
   */
  public decrypt(payload: EncryptedPayload): string {
    const { ciphertext, iv, tag } = payload;
    if (!ciphertext || !iv || !tag) {
      return '';
    }

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    try {
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      throw new Error('Violación de integridad: El dato clínico fue alterado o la llave no coincide.');
    }
  }

  /**
   * Genera el hash encadenado SHA-256 para el log inmutable de auditoría.
   */
  public hashAuditChain(previousHash: string, eventData: string): string {
    return crypto
      .createHash('sha256')
      .update((previousHash || 'GENESIS_HEALTH_HASH') + eventData)
      .digest('hex');
  }
}
