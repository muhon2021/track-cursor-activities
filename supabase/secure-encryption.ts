/**
 * Secure encryption utility using Web Crypto API (AES-GCM)
 * Format: {version}:{iv}:{encrypted}
 */
export class SecureEncryption {
  private static readonly VERSION = 'v1';
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  static async encrypt(plaintext: string, keyString: string): Promise<string> {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const key = await this.deriveKey(keyString);
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      const encrypted = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv, tagLength: this.TAG_LENGTH * 8 } as AesGcmParams,
        key,
        data
      );

      const encryptedBytes = new Uint8Array(encrypted);
      const ivBase64 = this.arrayBufferToBase64(iv);
      const encryptedBase64 = this.arrayBufferToBase64(encryptedBytes);

      return `${this.VERSION}:${ivBase64}:${encryptedBase64}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  static async decrypt(ciphertext: string, keyString: string): Promise<string> {
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 3) throw new Error('Invalid ciphertext format');

      const [version, ivBase64, encryptedBase64] = parts;
      if (version !== this.VERSION) throw new Error(`Unsupported version: ${version}`);

      const iv = this.base64ToArrayBuffer(ivBase64);
      const encrypted = this.base64ToArrayBuffer(encryptedBase64);
      const key = await this.deriveKey(keyString);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv, tagLength: this.TAG_LENGTH * 8 } as AesGcmParams,
        key,
        encrypted as BufferSource
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  private static async deriveKey(keyString: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyString);

    const baseKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('zoom-integration-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      { name: this.ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// Legacy decryption for migration support
export class LegacyEncryption {
  static xorDecrypt(encrypted: string, key: string): string {
    try {
      const decoded = atob(encrypted);
      return decoded.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      ).join('');
    } catch (error) {
      throw new Error('Failed to decrypt with XOR method');
    }
  }

  static base64Decrypt(encrypted: string, key: string): string {
    try {
      const combined = atob(encrypted);
      return combined.replace(`${key}:`, '');
    } catch (error) {
      throw new Error('Failed to decrypt with base64 method');
    }
  }

  static autoDecrypt(encrypted: string, key: string): string {
    try {
      return this.xorDecrypt(encrypted, key);
    } catch (e1) {
      try {
        return this.base64Decrypt(encrypted, key);
      } catch (e2) {
        throw new Error('Failed to decrypt with any legacy method');
      }
    }
  }
}
