import FileManager, {File} from "./utils/FileManager";
import CryptoManager from "./utils/CryptoManager";
import Logger from "./utils/Logger";
import {catchErrors} from "./utils/ErrorManager";
import {config} from "../config/config";
import {Command} from "commander";
import process from "process";
import {resolve} from "path";
import crypto from "crypto";
import fs from "fs";


type KeysArgs = { key?: string };
type AddArgs = { file: string };
type InitArgs = { key?: string };
type EncryptionArgs = { key?: string };


/**
 * GitEncrypt
 * @author Ingo Andelhofs
 */
class GitEncrypt {
  // Secret loader
  public static getPathsToEncrypt(): string[] {
    const path = config.encryption.fileSecrets;
    const paths: string[] = [];
    let addPath = false;

    const lines = FileManager.readLines(path);

    for (const unTrimmedLine of lines) {
      const line = unTrimmedLine.trim();

      if (line.startsWith("#end:enc") || line.startsWith("#stop:enc")) {
        addPath = false;
      }

      if (addPath) {
        if (FileManager.isDirectory(line)) {
          Logger.warn(`Ignoring '${line}'... (directories are not supported yet)`);
        } else {
          paths.push(line);
        }
      }

      if (line.startsWith("#start:enc") || line.startsWith("#begin:enc")) {
        addPath = true;
      }
    }

    return paths;
  }

  public static getExistingPathsToEncrypt(): string[] {
    const paths = GitEncrypt.getPathsToEncrypt();

    return paths.filter((path: string) => {
      return FileManager.fileExists(path);
    });
  }

  public static getExistingPathsToDecrypt(): string[] {
    const paths = GitEncrypt.getPathsToEncrypt();

    return paths.filter((path: string) => {
      const encryptedPath = GitEncrypt.getEncryptedPath(path);
      return FileManager.fileExists(encryptedPath);
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

  // Encryption helpers
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

  private static get args(): string[] {
    return process.argv;
  }

  public static get program(): Command {
    if (!GitEncrypt._program) {
      GitEncrypt._program = new Command();
    }

    return GitEncrypt._program;
  }

  public static start(): void {
    GitEncrypt
    .program
    .parse(GitEncrypt.args);
  }


  // Helpers: Git
  public static setupGitHooks(): boolean {
    if (!FileManager.fileExists('.git')) {
      Logger.log("No .git folder found, please initialize git first");
      return false;
    }

    Logger.log("Installing git hooks");

    const srcDirectory = resolve(`${__dirname}/../hooks/`);
    const destDirectory = resolve(".git/hooks");
    const hooks = FileManager.getDirectoryFiles(srcDirectory);

    hooks.forEach(({path, filename}: File) => {
      Logger.log(`Installing ${filename} hook`, 2);
      fs.copyFileSync(path, `${destDirectory}/${filename}`);
    });

    Logger.log("Installation successful");
    return true;
  }

  // Helpers
  private static async safeStoreKey(key: string) {
    if (GitEncrypt.isKeyStored()) {
      const replace = await Logger.confirm({
        message: "Found existing key, replace?"
      });

      const oldKey = GitEncrypt.getStoredKey();

      if (!replace) {
        Logger.log(`Existing key: '${oldKey}'.`);
      }

      if (replace) {
        Logger.log(`Replacing '${oldKey}' with '${key}'.`);
        GitEncrypt.storeKey(key);
      }

      return;
    }

    GitEncrypt.storeKey(key);
  }

  // Commands
  public static async cmdInit({key}: InitArgs): Promise<void> {
    // Install git hooks
    const success = GitEncrypt.setupGitHooks();
    if (!success) return;

    // Store or Generate key
    if (key) {
      await GitEncrypt.safeStoreKey(key);
    } else {
      await GitEncrypt.cmdGenerate();
    }

    // Decrypt files
    await GitEncrypt.cmdDecrypt({});
  }

  public static async cmdAdd({file}: AddArgs): Promise<void> {
    const lines: string[] = FileManager.readLines(config.encryption.fileSecrets);
    let start: boolean = false;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();

      if (line.startsWith("#start:enc") || line.startsWith("#begin:enc")) {
        start = true;
      }

      if (start && (line.startsWith("#stop:enc") || line.startsWith("#end:enc"))) {
        const updatedLines = [...lines.slice(0, i), file, ...lines.slice(i)];
        FileManager.writeLines(config.encryption.fileSecrets, updatedLines);
        return;
      }
    }

    const prependLines = ["#start:enc", file, "#end:enc", ""];
    const updatedLines = [...prependLines, ...lines];
    FileManager.writeLines(config.encryption.fileSecrets, updatedLines);
  }

  public static async cmdKey({key}: KeysArgs): Promise<void> {
    // Store keys
    if (key) {
      await GitEncrypt.safeStoreKey(key);
      return;
    }

    // Show stored keys
    if (GitEncrypt.isKeyStored()) {
      const storedKey = GitEncrypt.getStoredKey();
      Logger.log(`Existing key: '${storedKey}'.`);
    } else {
      Logger.log("No existing key found.")
    }
  }

  public static async cmdGenerate(): Promise<string> {
    const key = await CryptoManager.generateKey();
    Logger.log(`Generated key: '${key}'`);

    if (!FileManager.fileExists('.git')) {
      Logger.log("No .git folder found, cannot store key");
      return key;
    }

    await GitEncrypt.safeStoreKey(key);
    return key;
  }

  public static async cmdEncrypt({key: keyFlag}: EncryptionArgs): Promise<void> {
    const keyStored = GitEncrypt.isKeyStored();
    const noKey = !keyFlag && !keyStored;

    // No keys found
    if (noKey) {
      const generateKey = await Logger.confirm({
        message: "No existing key, want to generate one?",
        initial: true,
      });

      if (!generateKey) {
        return;
      }

      await GitEncrypt.cmdGenerate();
    }

    // No files to encrypt
    const pathsToEncrypt = GitEncrypt.getExistingPathsToEncrypt();
    if (pathsToEncrypt.length <= 0) {
      Logger.log("No files to encrypt");
      return;
    }

    // Encrypt files
    Logger.log("Detected files to encrypt");
    pathsToEncrypt.forEach((path: string) => {
      catchErrors(async () => {
        const plainData = FileManager.read(path);
        const encryptedPath = GitEncrypt.getEncryptedPath(path);

        // Should generate new iv
        const encryptedFileExists = FileManager.fileExists(encryptedPath);
        const genIv = encryptedFileExists ?
          GitEncrypt.getEncryptedFileIv(encryptedPath) :
          await CryptoManager.generateIv();

        // Setup encryption
        const key = keyFlag ? keyFlag : GitEncrypt.getStoredKey();
        const encryptedData = CryptoManager.encrypt(plainData, key, genIv);

        FileManager.createFile(encryptedPath, GitEncrypt.encCombine(encryptedData, genIv));
        Logger.log(`Encrypting '${path}' to '${encryptedPath}'...`, 2);
      }, `Failed to encrypt '${path}'`);
    });
  }

  public static async cmdDecrypt({key: keyFlag}: EncryptionArgs): Promise<void> {
    const keyStored = GitEncrypt.isKeyStored();
    const noKey = !keyFlag && !keyStored;

    // No existing key found
    if (noKey) {
      Logger.log(`No existing key found, please provide a key with --key`);
      return;
    }

    // No files to decrypt
    const pathsToDecrypt = GitEncrypt.getExistingPathsToDecrypt();
    if (pathsToDecrypt.length <= 0) {
      Logger.log("No files to decrypt");
      return;
    }

    // Decrypting files
    Logger.log("Detected files to decrypt");
    pathsToDecrypt.forEach((path: string) => {
      const encryptedPath = GitEncrypt.getEncryptedPath(path);

      catchErrors(() => {
        const encryptedData = FileManager.read(encryptedPath);

        // @todo Handle parse errors
        const {enc, iv, valid} = GitEncrypt.encParse(encryptedData);

        if (!valid) {
          Logger.log(`WARNING: '${encryptedPath}' has been tempered with`);
          return;
        }

        const key = keyFlag ? keyFlag : GitEncrypt.getStoredKey();
        const decrypted = CryptoManager.decrypt(enc, key, iv);

        FileManager.createFile(path, decrypted);
        Logger.log(`Decrypting '${encryptedPath}' to '${path}'...`);
      }, `Failed to decrypt '${encryptedPath}'`);
    });
  }
}

export default GitEncrypt;
