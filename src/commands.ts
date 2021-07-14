import FileManager, {File} from "./core/utils/FileManager";
import {catchErrors} from "./core/utils/ErrorManager";
import {spawn} from "child_process";
import {resolve} from "path";
import crypto from "crypto";
import fs from "fs";


class GitEncrypted {
  private static readonly SECRET_FILE = '.gitignore';
  private static readonly PASS = Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  private static readonly IV = 'a2xhcgAAAAAAAAAA'
  private static readonly ALGO = 'aes-256-cbc';


  // Helpers
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

  private static encrypt(data: string, password: Buffer = GitEncrypted.PASS): string {
    const cipher = crypto.createCipheriv(GitEncrypted.ALGO, password, GitEncrypted.IV);

    return Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]).toString('base64');
  }

  private static decrypt(encrypted: string, password: Buffer = GitEncrypted.PASS): string {
    const cipher = crypto.createDecipheriv(GitEncrypted.ALGO, password, GitEncrypted.IV);

    return Buffer.concat([
      cipher.update(encrypted, 'base64'),
      cipher.final()
    ]).toString();
  }


  // Commands
  public static cmdInstall() {
    const srcDirectory = resolve(`${__dirname}/hooks/`);
    const destDirectory = resolve(".git/hooks");
    const hooks = FileManager.getDirectoryFiles(srcDirectory);

    hooks.forEach(({path, filename}: File) => {
      console.log(`Installing ${filename} hook...`);
      fs.copyFileSync(path, `${destDirectory}/${filename}`);
    });

    GitEncrypted.cmdDecrypt();

    console.log("Installation successful!");
  }

  public static cmdEncrypt() {
    const pathsToEncrypt = GitEncrypted.getPathsToEncrypt();

    pathsToEncrypt.forEach((path: string) => {
      catchErrors(() => {
        const encryptedPath = `${path}.encrypted`;
        const data = fs.readFileSync(path, "utf-8");
        const encrypted = GitEncrypted.encrypt(data);

        console.log(`encrypting '${path}' to '${encryptedPath}'...`);
        FileManager.createFile(encryptedPath, encrypted);
      });
    });
  }

  public static cmdDecrypt() {
    const pathsToEncrypt = GitEncrypted.getPathsToEncrypt();

    pathsToEncrypt.forEach((path: string) => {
      catchErrors(() => {
        const encryptedPath = `${path}.encrypted`;
        const encryptedData = fs.readFileSync(encryptedPath, "utf-8");
        const decrypted = GitEncrypted.decrypt(encryptedData);

        console.log(`decrypting '${encryptedPath}' to '${path}'...`);
        FileManager.createFile(path, decrypted);
      });
    });
  }

  public static cmdEncryptGit() {
    GitEncrypted.cmdEncrypt();
    spawn('git', ['add', '.']);
  }

}

export default GitEncrypted;
