import crypto, {KeyObject} from "crypto";
import {config} from "../../config/config";


/**
 * Crypto Manager
 * @author Ingo Andelhofs
 */
class CryptoManager {

  public static encrypt(data: string, password: string, iv: string): string {
    const cipher = crypto.createCipheriv(
      config.algo.aes,
      Buffer.from(password, 'base64'),
      Buffer.from(iv, 'base64'),
    );

    return Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]).toString('base64');
  }

  public static decrypt(encrypted: string, password: string, iv: string): string {
    const cipher = crypto.createDecipheriv(
      config.algo.aes,
      Buffer.from(password, 'base64'),
      Buffer.from(iv, 'base64'),
    );

    return Buffer.concat([
      cipher.update(encrypted, 'base64'),
      cipher.final()
    ]).toString();
  }

  public static async generateKey(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.generateKey('aes', {length: 256}, (err: Error | null, key: KeyObject) => {
        if (err !== null) {
          reject(err);
        }

        resolve(key.export().toString('base64'));
      });
    });
  }

  public static async generateIv(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err: Error | null, buf: Buffer) => {
        if (err !== null) {
          reject(err);
        }

        resolve(buf.toString('base64'));
      });
    });
  }

}

export default CryptoManager;