import FileManager, {FileInfo} from "./utils/FileManager";
import CryptoManager from "./utils/CryptoManager";
import Logger from "./utils/Logger";
import {catchErrors} from "./utils/ErrorManager";
import {config} from "../config/config";
import {Command} from "commander";
import process from "process";
import {resolve, join} from "path";
import crypto from "crypto";
import fs from "fs";
import PathHelper from "./path";


type KeysArgs = { key?: string };
type AddArgs = { file: string };
type InitArgs = { key?: string };
type EncryptionArgs = { key?: string };


/**
 * GitEncrypt
 * @author Ingo Andelhofs
 */
class Cli {

  // Secret loader
  public static getPathsToEncrypt(): string[] {
    const getIgnoreFiles = FileManager.getAllFilesOfName(".", config.encryption.fileSecrets); 

    const prefixedLines = getIgnoreFiles.flatMap(({dir, path}: FileInfo) => {
      const lines = FileManager.readLines(path).map((line: string) => line.trim());
      return lines.map((line: string) => line.startsWith("#") ? line : `${dir}/${line}`);
    });

    let addPath = false;
    const pathsToEncrypt = prefixedLines.flatMap((line: string) => {
      if (line.startsWith("#end:enc") || line.startsWith("#stop:enc")) {
        addPath = false;
      }

      if (addPath) {
        return [line];
      }

      if (line.startsWith("#start:enc") || line.startsWith("#begin:enc")) {
        addPath = true;
      }

      return [];
    });

    return pathsToEncrypt;
  }

  public static getExistingPathsToEncrypt(): string[] {
    const paths = Cli.getPathsToEncrypt();

    return paths.filter((path: string) => {
      return FileManager.fileExists(path);
    });
  }

  public static getExistingPathsToDecrypt(): string[] {
    const paths = Cli.getPathsToEncrypt();

    return paths.filter((path: string) => {
      const encryptedPath = Cli.getEncryptedPath(path);
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

  private static encCombine(enc: string, iv: string, key: string): string {
    const encAndIv = enc + "#" + iv;
    const hash = crypto
      .createHmac('sha256', encAndIv)
      .update(key ?? "")
      .digest('base64');

    return encAndIv + "#" + hash;
  }

  private static encParse(data: string, key: string): { enc: string, iv: string, valid: boolean } {
    const [enc, iv, hash] = data.split('#');
    const genHash = crypto
      .createHmac('sha256', `${enc}#${iv}`)
      .update(key ?? "")
      .digest('base64');

    return {enc, iv, valid: hash === genHash};
  }

  private static getEncryptedFileIv(path: string, key: string): string {
    const encryptedData = FileManager.read(path);
    const {iv} = Cli.encParse(encryptedData, key);
    return iv;
  }


  // Program
  private static _program?: Command;

  private static get args(): string[] {
    return process.argv;
  }

  public static get program(): Command {
    if (!Cli._program) {
      Cli._program = new Command();
    }

    return Cli._program;
  }

  public static start(): void {
    Cli
    .program
    .parse(Cli.args);
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

    hooks.forEach(({path, filename}: FileInfo) => {
      Logger.log(`Installing ${filename} hook`, 2);
      fs.copyFileSync(path, `${destDirectory}/${filename}`);
    });

    Logger.log("Installation successful");
    return true;
  }

  // Helpers
  private static async safeStoreKey(key: string) {
    if (Cli.isKeyStored()) {
      const replace = await Logger.confirm({
        message: "Found existing key, replace?"
      });

      const oldKey = Cli.getStoredKey();

      if (!replace) {
        Logger.log(`Existing key: '${oldKey}'.`);
      }

      if (replace) {
        Logger.log(`Replacing '${oldKey}' with '${key}'.`);
        Cli.storeKey(key);
      }

      return;
    }

    Cli.storeKey(key);
  }

  // Commands
  public static async cmdInit({key}: InitArgs): Promise<void> {
    // Install git hooks
    const success = Cli.setupGitHooks();
    if (!success) return;

    // Store or Generate key
    if (key) {
      await Cli.safeStoreKey(key);
    } else {
      await Cli.cmdGenerate();
    }

    // Decrypt files
    await Cli.cmdDecrypt({});
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
      await Cli.safeStoreKey(key);
      return;
    }

    // Show stored keys
    if (Cli.isKeyStored()) {
      const storedKey = Cli.getStoredKey();
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

    await Cli.safeStoreKey(key);
    return key;
  }

  public static async cmdEncrypt({key: keyFlag}: EncryptionArgs): Promise<void> {
    const keyStored = Cli.isKeyStored();
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

      await Cli.cmdGenerate();
    }

    // No files to encrypt
    const pathsToEncrypt = await PathHelper.getPathsToEncrypt();
    if (pathsToEncrypt.length <= 0) {
      Logger.log("No files to encrypt");
      return;
    }

    // Encrypt files
    Logger.log("Detected files to encrypt");
    pathsToEncrypt.forEach(({paths, dir}: any) => {
      paths.forEach((pathInDir: string) => {

        const path = join(dir, pathInDir);

        catchErrors(async () => {
          const plainData = FileManager.read(path);
          const encryptedPath = Cli.getEncryptedPath(join(dir, ".encrypted/", pathInDir));
  
          // Should generate new iv
          const encryptedFileExists = FileManager.fileExists(encryptedPath);

          const key = keyFlag ? keyFlag : Cli.getStoredKey();

          const genIv = encryptedFileExists ?
            Cli.getEncryptedFileIv(encryptedPath, key) :
            await CryptoManager.generateIv();
  
          // Setup encryption
          const encryptedData = CryptoManager.encrypt(plainData, key, genIv);
  
          FileManager.createFile(encryptedPath, Cli.encCombine(encryptedData, genIv, key));
          Logger.log(`Encrypting '${path}' to '${encryptedPath}'...`, 2);
        }, `Failed to encrypt '${path}'`);

      });
    });
  }

  public static async cmdDecrypt({key: keyFlag}: EncryptionArgs): Promise<void> {
    const keyStored = Cli.isKeyStored();
    const noKey = !keyFlag && !keyStored;

    // No existing key found
    if (noKey) {
      Logger.log(`No existing key found, please provide a key with --key`);
      return;
    }

    // No files to decrypt
    const pathsToDecrypt = PathHelper.getPathsToDecrypt();
    if (pathsToDecrypt.length <= 0) {
      Logger.log("No files to decrypt");
      return;
    }

    // Decrypting files
    Logger.log("Detected files to decrypt");
    pathsToDecrypt.forEach((path: string) => {
      const withoutEnc = path.replace('.encrypted/', '');
      const rawPath = withoutEnc.slice(0, - ".enc".length);

      catchErrors(() => {
        const encryptedData = FileManager.read(path);

        // @todo Handle parse errors
        const key = keyFlag ? keyFlag : Cli.getStoredKey();
        const {enc, iv, valid} = Cli.encParse(encryptedData, key);

        if (!valid) {
          Logger.log(`WARNING: '${path}' has been tempered with`);
          return;
        }

        const decrypted = CryptoManager.decrypt(enc, key, iv);

        FileManager.createFile(rawPath, decrypted);
        Logger.log(`Decrypting '${path}' to '${rawPath}'...`);
      }, `Failed to decrypt '${path}'`);
    });
  }
}

export default Cli;
