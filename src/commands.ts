import FileManager, {File} from "./core/utils/FileManager";
import {catchErrors} from "./core/utils/ErrorManager";
import {spawn} from "child_process";
import {resolve} from "path";
import crypto, {KeyObject} from "crypto";
import fs from "fs";


type InstallArgs = {};
type KeysArgs = {key?: string, iv?: string};
type GenerateArgs = {store?: boolean};

type InitArgs = {generate?: boolean, key?: string, iv?: string};
type EncryptionArgs = {git?: boolean, default?: boolean, key?: string, iv?: string};
type GitEncryptionArgs = {default?: boolean, key?: string, iv?: string};


/**
 * GitEncrypt
 * @author Ingo Andelhofs
 */
class GitEncrypt {
  private static readonly NAME = "git-encrypt";
  private static readonly BIN = "git-encrypt";

  private static readonly SECRET_FILE = '.gitignore';
  private static readonly PASS = Buffer.from("a".repeat(32)).toString('base64');
  private static readonly IV = Buffer.from('a2xhcgAAAAAAAAAA').toString('base64');
  private static readonly ALGO = 'aes-256-cbc';


  // Secret loader
  public static getPathsToEncrypt(path: string = this.SECRET_FILE): string[] {
    const paths: string[] = [];
    let addPath = false;

    const lines = FileManager.readLines(path);

    for (const line of lines) {
      if (line.trim().startsWith("#end:encrypt")) {
        addPath = false;
      }

      if (addPath) {
        if (FileManager.isDirectory(line)) {
          console.warn(`ignoring '${line}'... (directories are not supported yet)`);
        } else {
          paths.push(line);
        }
      }

      if (line.trim().startsWith("#start:encrypt")) {
        addPath = true;
      }
    }

    return paths;
  }

  // Encryption
  private static encrypt(data: string, password: string = GitEncrypt.PASS, iv: string = GitEncrypt.IV): string {
    const cipher = crypto.createCipheriv(
      GitEncrypt.ALGO,
      Buffer.from(password, 'base64'),
      Buffer.from(iv, 'base64'),
    );

    return Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]).toString('base64');
  }

  private static decrypt(encrypted: string, password: string = GitEncrypt.PASS, iv: string = GitEncrypt.IV): string {
    const cipher = crypto.createDecipheriv(
      GitEncrypt.ALGO,
      Buffer.from(password, 'base64'),
      Buffer.from(iv, 'base64'),
    );

    return Buffer.concat([
      cipher.update(encrypted, 'base64'),
      cipher.final()
    ]).toString();
  }

  // Generators
  private static async generateKey(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.generateKey('aes', {length: 256}, (err: Error | null, key: KeyObject) => {
        if (err !== null) {
          reject(err);
        }

        resolve(key.export().toString('base64'));
      });
    });
  }

  private static async generateIv(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err: Error | null, buf: Buffer) => {
        if (err !== null) {
          reject(err);
        }

        resolve(buf.toString('base64'));
      });
    });
  }

  private static async generateKeys(): Promise<{key: string, iv: string}> {
    return {
      key: await GitEncrypt.generateKey(),
      iv: await GitEncrypt.generateIv(),
    };
  }

  private static storeKeys(key: string, iv: string): void {
    FileManager.createDirectory('./.git/secrets/');
    FileManager.createFile("./.git/secrets/key", key);
    FileManager.createFile("./.git/secrets/iv", iv);
  }

  // Key Storage
  private static hasKeysStored(): boolean {
    return GitEncrypt.hasStoredKey() && GitEncrypt.hasStoredIv();
  }

  private static hasStoredKey(): boolean {
    const keyPath = './.git/secrets/key';
    return FileManager.fileExists(keyPath);
  }

  private static hasStoredIv(): boolean {
    const ivPath = './.git/secrets/iv';
    return FileManager.fileExists(ivPath);
  }

  private static getStoredKey(): string {
    const keyPath = './.git/secrets/key';
    return FileManager.read(keyPath);
  }

  private static getStoredIv(): string {
    const ivPath = './.git/secrets/iv';
    return FileManager.read(ivPath);
  }


  // Commands
  public static cmdKeys(args?: KeysArgs): void {

    // Store keys
    if (args!.key || args!.iv) {
      if (args!.key && args!.iv) {
        GitEncrypt.storeKeys(args!.key!, args!.iv!);
        return;
      }

      console.log(`Usage: ${GitEncrypt.BIN} keys -k <key> -i <iv>`)
      return;
    }

    // Show stored keys
    if (GitEncrypt.hasStoredKey()) {
      const key = GitEncrypt.getStoredKey();
      console.log(`Key: ${key}`);
    }
    else {
      console.log("Key: NOT FOUND");
    }

    if (GitEncrypt.hasStoredIv()) {
      const iv = GitEncrypt.getStoredIv();
      console.log(`Iv: ${iv}`);
    }
    else {
      console.log("Iv: NOT FOUND");
    }
  }

  public static async cmdGenerate(args?: GenerateArgs): Promise<{key: string, iv: string}> {
    const store = args!.store;

    const {key, iv} = await GitEncrypt.generateKeys();
    console.log(`Key: '${key}'`);
    console.log(`Iv: '${iv}'`);

    if (store) {
      GitEncrypt.storeKeys(key, iv);
    }

    return {key, iv};
  }

  public static async cmdInit(args?: InitArgs): Promise<void> {
    const {generate, key, iv} = args!;

    if (key && iv && !generate) {
      GitEncrypt.storeKeys(key, iv);
    }

    if ((generate || true) && (!key && !iv)) {
      await GitEncrypt.cmdGenerate({store: true});
    }

    if (!generate && !(key && iv) && (key || iv)) {
      console.log("Usage: git-encrypt init --key <value> --iv <value>");
    }

    // GitEncrypted.cmdInstall();
  }

  public static cmdInstall(args?: InstallArgs): void {
    const srcDirectory = resolve(`${__dirname}/hooks/`);
    const destDirectory = resolve(".git/hooks");
    const hooks = FileManager.getDirectoryFiles(srcDirectory);

    hooks.forEach(({path, filename}: File) => {
      console.log(`Installing ${filename} hook...`);
      fs.copyFileSync(path, `${destDirectory}/${filename}`);
    });

    GitEncrypt.cmdDecrypt();

    console.log("Installation successful!");
  }

  public static cmdEncrypt(args?: EncryptionArgs): void {
    const hasGitFlag = args?.git;
    const hasKeys = args?.key && args?.iv;
    const hasKeysStored = GitEncrypt.hasKeysStored();

    if (hasGitFlag) {
      this.cmdEncryptGit();
      return;
    }

    const pathsToEncrypt = GitEncrypt.getPathsToEncrypt();

    pathsToEncrypt.forEach((path: string) => {
      catchErrors(() => {
        const encryptedPath = `${path}.encrypted`;
        const data = fs.readFileSync(path, "utf-8");
        const encrypted = (() => {
          if (hasKeys) {
            return GitEncrypt.encrypt(data, args!.key, args!.iv);
          }

          if (hasKeysStored) {
            return GitEncrypt.encrypt(data, GitEncrypt.getStoredKey(), GitEncrypt.getStoredIv());
          }

          return GitEncrypt.encrypt(data);
        })();

        console.log(`encrypting '${path}' to '${encryptedPath}'...`);
        FileManager.createFile(encryptedPath, encrypted);
      });
    });
  }

  public static cmdDecrypt(args?: EncryptionArgs): void {
    const hasKeys = args?.key && args?.iv;
    const hasKeysStored = GitEncrypt.hasKeysStored();

    const pathsToEncrypt = GitEncrypt.getPathsToEncrypt();

    pathsToEncrypt.forEach((path: string) => {
      catchErrors(() => {
        const encryptedPath = `${path}.encrypted`;
        const encryptedData = fs.readFileSync(encryptedPath, "utf-8");

        const decrypted = (() => {
          if (hasKeys) {
            return GitEncrypt.decrypt(encryptedData, args!.key, args!.iv);
          }

          if (hasKeysStored) {
            return GitEncrypt.decrypt(encryptedData, GitEncrypt.getStoredKey(), GitEncrypt.getStoredIv());
          }

          return GitEncrypt.decrypt(encryptedData);
        })();

        console.log(`decrypting '${encryptedPath}' to '${path}'...`);
        FileManager.createFile(path, decrypted);
      });
    });
  }

  private static cmdEncryptGit(args?: GitEncryptionArgs): void {
    GitEncrypt.cmdEncrypt();
    spawn('git', ['add', '.']);
  }

}

export default GitEncrypt;
