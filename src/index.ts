#!/usr/bin/env node
import GitEncrypt from "./GitEncrypt";


/**
 * git-encrypt cli
 * @author Ingo Andelhofs
 */
const program = GitEncrypt.program;

program
  .version("git-encrypt v0.0.2", "-v, --version", "output the current version number")
  .description("A tool that allows you to encrypt git files.");

program
  .command('install')
  .description('install git hooks')
  .action(GitEncrypt.cmdInstall);

program
  .command('init')
  .description('initialize a project by generating a key (default) or passing a generated key')
  .option("-g, --generate", 'generate a key to store for the current git repo')
  .option("-k, --key <value>", 'pass a key to use in the current git repo')
  .action(GitEncrypt.cmdInit);

program
  .command('key')
  .description('get the key if it is generated and stored locally, set a key if -k or --key is passed')
  .option("-k, --key <value>", 'the key you want to set for the project')
  .action(GitEncrypt.cmdKey);

program
  .command('generate')
  .description('generate a new key, generate and store the new key if -s or --stored is passed')
  .option("-s, --store", 'store the keys in the current project')
  .action(async (args: any) => {await GitEncrypt.cmdGenerate(args)});

program
  .command('encrypt')
  .description('encrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-g, --git", 'adds all encrypted files to git before commit')
  .option("-k, --key <value>", 'the encryption key')
  .action(GitEncrypt.cmdEncrypt);

program
  .command('decrypt')
  .description('decrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-g, --git", 'decrypts all files and handles git events')
  .option("-k, --key <value>", 'the encryption key')
  .action(GitEncrypt.cmdDecrypt);

program.parse(GitEncrypt.args);
