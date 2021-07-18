import FileManager, {File} from "./utils/FileManager";
import {catchErrors} from "./utils/ErrorManager";
import crypto, {KeyObject} from "crypto";
import {config} from "../config/config";
import {spawn} from "child_process";
import {Command} from "commander";
import process from "process";
import {resolve} from "path";
import fs from "fs";


type KeysArgs = { key?: string };
type GenerateArgs = { store?: boolean };
type InitArgs = { key?: string };
type EncryptionArgs = { git?: boolean, key?: string };


/**
 * GitEncrypt
 * @author Ingo Andelhofs
 */
class GitEncrypt {
  // Secret loader
  public static getPathsToEncrypt(path: string = config.encryption.fileSecrets): string[] {
    const paths: string[] = [];
    let addPath = false;

    const lines = FileManager.readLines(path);

    for (const line of lines) {
      if (line.trim().startsWith("#end:enc") || line.trim().startsWith("#stop:enc")) {
        addPath = false;
      }

      if (addPath) {
        if (FileManager.isDirectory(line)) {
          console.warn(`ignoring '${line}'... (directories are not supported yet)`);
        } else {
          paths.push(line);
        }
      }

      if (line.trim().startsWith("#start:enc") || line.trim().startsWith("#begin:enc")) {
        addPath = true;
      }
    }

    return paths;
  }

  // Encryption
  private static encrypt(data: string, password: string, iv: string): string {
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

  private static decrypt(encrypted: string, password: string, iv: string): string {
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

  // Key Storage
  private static storeKey(key: string): void {
    FileManager.createDirectory('./.git/secrets/');
    FileManager.createFile("./.git/secrets/key", key);
  }

  private static isKeyStored(): boolean {
    const keyPath = './.git/secrets/key';
    return FileManager.fileExists(keyPath);
  }

  private static getStoredKey(): string {
    const keyPath = './.git/secrets/key';
    return FileManager.read(keyPath);
  }

  // Encrypted files
  private static getEncryptedPath(path: string): string {
    const extension = config.encryption.fileExtension;

    if (extension.startsWith('.')) {
      return `${path}${extension}`;
    }

    return `${path}.${extension}`;
  }

  private static encCombine(enc: string, iv: string): string {
    const encAndIv = enc + "#" + iv;
    const hash = crypto.createHmac('sha256', encAndIv).digest('base64');

    return encAndIv + "#" + hash;
  }

  private static encParse(data: string): { enc: string, iv: string, valid: boolean } {
    const [enc, iv, hash] = data.split('#');
    const genHash = crypto.createHmac('sha256', `${enc}#${iv}`).digest('base64');

    return {enc, iv, valid: hash === genHash};
  }

  private static getEncryptedFileIv(path: string): string {
    const encryptedData = FileManager.read(path);
    const {iv} = GitEncrypt.encParse(encryptedData);
    return iv;
  }


  // Program
  private static _program?: Command;

  public static get program(): Command {
    if (!GitEncrypt._program) {
      GitEncrypt._program = new Command();
    }

    return GitEncrypt._program;
  }

  public static get args(): string[] {
    return process.argv;
  }

  // Logger
  private static logKey(key: string): void {
    const str = `Key: '${key}'`;
    console.log(str);
  }

  // Git
  public static setupGitHooks(): void {
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



  // Commands
  public static async cmdInit(args?: InitArgs): Promise<void> {
    // @todo: Does .git exist or not
    GitEncrypt.setupGitHooks();

    const {key} = args || {key: undefined};
    key ?
      GitEncrypt.storeKey(key) :
      await GitEncrypt.cmdGenerate({store: true});
  }

  public static cmdKey(args?: KeysArgs): void {
    const {key} = args || {key: undefined};

    // Store keys
    if (key) {
      // @todo: Overwrite old key or not
      GitEncrypt.storeKey(key);
      return;
    }

    // Show stored keys
    if (GitEncrypt.isKeyStored()) {
      const storedKey = GitEncrypt.getStoredKey();
      GitEncrypt.logKey(storedKey);
    }
    else {
      GitEncrypt.logKey('not found');
    }
  }

  public static async cmdGenerate(args?: GenerateArgs): Promise<string> {
    const {store} = args || {store: undefined};

    const key = await GitEncrypt.generateKey();
    GitEncrypt.logKey(key);

    // @todo: Store automatically or not
    // @todo: Overwrite or not

    if (store) {
      GitEncrypt.storeKey(key);
    }

    return key;
  }

  public static cmdEncrypt(args?: EncryptionArgs): void {
    const {git: gitFlag, key: keyFlag} = args || {key: undefined, git: undefined};
    const keyStored = GitEncrypt.isKeyStored();

    if (!keyFlag && !keyStored) {
      console.log(`Please generate a key or provide a key with -k or --key`);
      return;
    }

    const pathsToEncrypt = GitEncrypt.getPathsToEncrypt();

    // @todo: No files to encrypt

    pathsToEncrypt.forEach((path: string) => {
      catchErrors(async () => {
        const plainData = FileManager.read(path);
        const encryptedPath = GitEncrypt.getEncryptedPath(path);

        // Should generate new iv
        const encryptedFileExists = FileManager.fileExists(encryptedPath);
        const genIv = encryptedFileExists ?
          GitEncrypt.getEncryptedFileIv(encryptedPath) :
          await GitEncrypt.generateIv();

        // Setup encryption
        const key = keyFlag ? keyFlag : GitEncrypt.getStoredKey();
        const encryptedData = GitEncrypt.encrypt(plainData, key, genIv);

        FileManager.createFile(encryptedPath, GitEncrypt.encCombine(encryptedData, genIv));
        console.log(`encrypting '${path}' to '${encryptedPath}'...`);
      });
    });

    if (gitFlag) {
      spawn('git', ['add', '.']);
    }
  }

  public static cmdDecrypt(args?: EncryptionArgs): void {
    const {key: keyFlag} = args || {key: undefined, git: undefined};
    const keyStored = GitEncrypt.isKeyStored();

    if (!keyFlag && !keyStored) {
      console.log(`Please generate a key or provide a key with -k or --key`);
      return;
    }

    const pathsToEncrypt = GitEncrypt.getPathsToEncrypt();

    // @todo: No files to decrypt

    pathsToEncrypt.forEach((path: string) => {
      catchErrors(() => {
        const encryptedPath = GitEncrypt.getEncryptedPath(path);
        const encryptedData = FileManager.read(encryptedPath);

        // @todo Handle parse errors
        const {enc, iv, valid} = GitEncrypt.encParse(encryptedData);

        if (!valid) {
          console.log(`WARNING: '${encryptedPath}' has been tempered with`);
          return;
        }

        const key = keyFlag ? keyFlag : GitEncrypt.getStoredKey();
        const decrypted = GitEncrypt.decrypt(enc, key, iv);

        FileManager.createFile(path, decrypted);
        console.log(`decrypting '${encryptedPath}' to '${path}'...`);
      });
    });
  }

}

export default GitEncrypt;
