import FileManager, {File} from "./core/utils/FileManager";
import {catchErrors} from "./core/utils/ErrorManager";
import crypto, {KeyObject} from "crypto";
import {spawn} from "child_process";
import {Command} from "commander";
import process from "process";
import {resolve} from "path";
import fs from "fs";


type InstallArgs = {};
type KeysArgs = { key?: string };
type GenerateArgs = { store?: boolean };
type InitArgs = { generate?: boolean, key?: string };
type EncryptionArgs = { git?: boolean, key?: string };


/**
 * GitEncrypt
 * @author Ingo Andelhofs
 */
class GitEncrypt {
  public static readonly ENCRYPTED_FILE_EXTENSION = ".enc";
  public static readonly SECRET_FILE = '.gitignore';
  public static readonly BIN = "git-encrypt";

  private static readonly ALGO = 'aes-256-cbc';


  // Secret loader
  public static getPathsToEncrypt(path: string = this.SECRET_FILE): string[] {
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
      GitEncrypt.ALGO,
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
    const extension = GitEncrypt.ENCRYPTED_FILE_EXTENSION;

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

  // Commands
  public static cmdKey(args?: KeysArgs): void {
    const {key: keyFlag} = args || {key: undefined};

    // Store keys
    if (keyFlag) {
      GitEncrypt.storeKey(keyFlag);
      return;
    }

    // Show stored keys
    if (GitEncrypt.isKeyStored()) {
      const key = GitEncrypt.getStoredKey();
      GitEncrypt.logKey(key);
    } else {
      GitEncrypt.logKey('not found');
    }
  }

  public static async cmdGenerate(args?: GenerateArgs): Promise<string> {
    const {store} = args || {store: undefined};

    const key = await GitEncrypt.generateKey();
    GitEncrypt.logKey(key);

    if (store) {
      GitEncrypt.storeKey(key);
    }

    return key;
  }

  public static async cmdInit(args?: InitArgs): Promise<void> {
    const {generate, key} = args || {key: undefined, generate: undefined};

    if (key && !generate) {
      GitEncrypt.storeKey(key);
    }

    if ((generate || true) && !key) {
      await GitEncrypt.cmdGenerate({store: true});
    }
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
    const {git: gitFlag, key: keyFlag} = args || {key: undefined, git: undefined};
    const keyStored = GitEncrypt.isKeyStored();

    if (!keyFlag && !keyStored) {
      console.log(`Please generate a key or provide a key with -k or --key`);
      return;
    }

    const pathsToEncrypt = GitEncrypt.getPathsToEncrypt();

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
