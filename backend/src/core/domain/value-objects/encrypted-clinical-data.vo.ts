export class EncryptedClinicalData {
  constructor(
    public readonly ciphertext: string,
    public readonly iv: string,
    public readonly tag: string
  ) {
    if (!ciphertext || !iv || !tag) {
      throw new Error('EncryptedClinicalData inválido: ciphertext, iv y tag son obligatorios.');
    }
  }

  public toJSON() {
    return {
      ciphertext: this.ciphertext,
      iv: this.iv,
      tag: this.tag,
    };
  }
}
