import fs from "fs";
import {resolve} from "path";
import {spawn} from "child_process";
import crypto from "crypto";

const ENCODING = "utf8";
const SECRET_FILE = ".git-secrets";
const GIT_HOOKS_FOLDER = ".git/hooks/";


/**
 * Install Command
 * @author Ingo Andelhofs
 */
export const install = () => {
  const preCommitHookDestination = resolve(`${GIT_HOOKS_FOLDER}/pre-commit`);
  const preCommitHookFile = resolve(`${__dirname}/hooks/pre-commit`);

  console.log("installing...");
  fs.copyFileSync(preCommitHookFile, preCommitHookDestination);
  console.log("installed!");
}


/**
 * Secret Command
 * @author Ingo Andelhofs
 */
const readRecursively = (basePath: string): string[] => {
  const files = fs.readdirSync(basePath, {encoding: ENCODING});

  const results: string[] = [];

  files.forEach((path: string) => {
    const fullPath = `${basePath}/${path}`;
    const isDir = fs.lstatSync(fullPath).isDirectory();

    if (isDir) {
      const recursiveFiles = readRecursively(fullPath);
      results.push(...recursiveFiles);
    }
    else {
      results.push(fullPath);
    }
  });

  return results;
}

const readSecretFile = (encrypted: boolean = false): string[] => {
  // @todo: What if no .git-secrets
  const data = fs.readFileSync(SECRET_FILE, {encoding: ENCODING});
  const paths = data.split(/\r?\n/); // split newlines

  // @todo: Handle if no file: path
  const recursivePaths: string[] = [];
  paths.forEach((path: string) => {
    try {
      const isDir = fs.lstatSync(path).isDirectory();

      const encPath = encrypted ? `${path}.encrypted` : path;

      if (isDir) {
        let files = readRecursively(path)

        if (encrypted) {
          files = files
            .filter(path => path.endsWith('.encrypted'));
        }

        recursivePaths.push(...files);
      }
      else {
        recursivePaths.push(encPath);
      }
    }
    catch (e) {}
  });

  return recursivePaths
    .map(path => resolve(path))
    .filter((path: string) => encrypted ? true : !path.endsWith('.encrypted'))
    .filter((path: string, index: number, self: string[]) => self.indexOf(path) === index);
}


export const gitEncrypt = () => {

  // GET: MODIFIED, DELETED, NEW, ...
  // const gitStatus = spawn("git", ["status", "-s"]);
  // gitStatus.stdout.on("data", (data) => {
  //   const output = data
  //     .toString()
  //     .split(/\r?\n/)
  //     .map((item: string) => item.trim().split(" ", 2));
  //
  //   console.log(output);
  // });

  console.log("encrypting...");
  encrypt();

  console.log("adding...");
  const gitAdd = spawn('git', ['add', '.']);

  gitAdd.on("close", () => {
    decrypt();
  });
}

export const encrypt = () => {
  const paths = readSecretFile();
  console.log(paths);

  paths.forEach((path: string) => {
    try {
      const encryptedPath = `${path}.encrypted`;
      const data = fs.readFileSync(path);

      // Handle encryption
      const algorithm = 'aes-256-ecb';
      const password = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const iv = Buffer.from('');

      const cipher = crypto.createCipheriv(algorithm, Buffer.alloc(32, password), iv);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

      fs.writeFileSync(encryptedPath, encrypted, {encoding: ENCODING});
      fs.unlinkSync(path);
    }
    catch (e) {}
  });
}

export const decrypt = () => {
  const paths = readSecretFile(true);
  console.log(paths);

  paths.forEach((encryptedPath: string) => {
    try {
      const data = fs.readFileSync(encryptedPath);
      const path = encryptedPath.endsWith(".encrypted") ?
        encryptedPath.substring(0, encryptedPath.length - ".encrypted".length) :
        encryptedPath;

      // Handle encryption
      const algorithm = 'aes-256-ecb';
      const password = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const iv = Buffer.from('');

      const cipher = crypto.createDecipheriv(algorithm, Buffer.alloc(32, password), iv);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

      fs.writeFileSync(path, encrypted, {encoding: ENCODING});
      fs.unlinkSync(encryptedPath);
    }
    catch (e) {}
  });
}