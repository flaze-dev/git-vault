#!/usr/bin/env node
import packageJson from "pjson";
import { config } from "./config/config";
import Cli from "./core/cli";
import PathHelper from "./core/path";



/**
 * git-vault cli
 * @author Ingo Andelhofs
 */
Cli.program
  .version(`${config.bin} v${packageJson.version}`, "-v, --version", "output the current version number")
  .description("A tool that allows you to encrypt git files.");

// Cli.program
//   .command('dev')
//   .description('dev command')
//   .action(async () => {
//     const paths2 = PathHelper.getPathsToDecrypt();
//     console.log(paths2);

//     const paths = await PathHelper.getPathsToEncrypt();
//     console.log(paths);
//   });

Cli.program
  .command('init')
  .description('initialize git hooks, generate a key or pass a key, and store that key')
  .option("-k, --key <value>", 'pass a key to use in the current git repo')
  .action(async (args: object) => {
    await Cli.cmdInit({
      key: undefined,
      ...args,
    });
  });

Cli.program
  .command('add')
  .description('add a file to encrypt')
  .requiredOption("-f, --file <value>", 'the file to encrypt')
  .action(async (args: any) => {
    await Cli.cmdAdd({
      ...args
    });
  });

Cli.program
  .command('key')
  .description('get the stored key, set a key if a key is passed')
  .option("-k, --key <value>", 'the key you want to set for the project')
  .action(async (args: object) => {
    await Cli.cmdKey({
      key: undefined,
      ...args,
    });
  });

Cli.program
  .command('generate')
  .description('generate a new key and store it')
  .action(async () => {
    await Cli.cmdGenerate();
  });

Cli.program
  .command('encrypt')
  .description('encrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-k, --key <value>", 'the encryption key')
  .action(async (args: object) => {
    await Cli.cmdEncrypt({
      key: undefined,
      ...args,
    });
  });

Cli.program
  .command('decrypt')
  .description('decrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-k, --key <value>", 'the encryption key')
  .action(async (args: object) => {
    await Cli.cmdDecrypt({
      key: undefined,
      ...args,
    });
  });

Cli.start();
