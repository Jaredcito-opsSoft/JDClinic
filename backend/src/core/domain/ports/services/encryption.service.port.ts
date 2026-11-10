export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Hex (12 bytes = 24 chars)
  tag: string;        // Hex (16 bytes = 32 chars)
}

export interface IEncryptionService {
  encrypt(plainText: string): EncryptedPayload;
  decrypt(payload: EncryptedPayload): string;
  hashAuditChain(previousHash: string, eventData: string): string;
}
