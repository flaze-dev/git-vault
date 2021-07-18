#!/usr/bin/env node
import {config} from "./config/config";
import GitEncrypt from "./core/GitEncrypt";
import packageJson from "pjson";


/**
 * git-encrypt cli
 * @author Ingo Andelhofs
 */
GitEncrypt.program
  .version(`${config.bin} v${packageJson.version}`, "-v, --version", "output the current version number")
  .description("A tool that allows you to encrypt git files.");

GitEncrypt.program
  .command('init')
  .description('initialize git hooks, generate a key or pass a key, and store that key')
  .option("-k, --key <value>", 'pass a key to use in the current git repo')
  .action(async (args: any) => {
    const defaultArgs = {key: undefined};
    await GitEncrypt.cmdInit(args ?? defaultArgs);
  });

GitEncrypt.program
  .command('add')
  .description('add a file to encrypt')
  .requiredOption("-f, --file <value>", 'the file to encrypt')
  .action(async (args: any) => {
    await GitEncrypt.cmdAdd(args);
  });

GitEncrypt.program
  .command('key')
  .description('get the stored key, set a key if a key is passed')
  .option("-k, --key <value>", 'the key you want to set for the project')
  .action(async (args: any) => {
    const defaultArgs = {key: undefined};
    await GitEncrypt.cmdKey(args ?? defaultArgs);
  });

GitEncrypt.program
  .command('generate')
  .description('generate a new key and store it')
  .action(async () => {
    await GitEncrypt.cmdGenerate();
  });

GitEncrypt.program
  .command('encrypt')
  .description('encrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-g, --git", 'adds all encrypted files to git before commit')
  .option("-k, --key <value>", 'the encryption key')
  .action(async (args: any) => {
    const defaultArgs = {key: undefined, git: undefined};
    await GitEncrypt.cmdEncrypt(args ?? defaultArgs);
  });

GitEncrypt.program
  .command('decrypt')
  .description('decrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-g, --git", 'decrypts all files and handles git events')
  .option("-k, --key <value>", 'the encryption key')
  .action(async (args: any) => {
    const defaultArgs = {key: undefined, git: undefined};
    await GitEncrypt.cmdDecrypt(args ?? defaultArgs);
  });

GitEncrypt.start();
