#!/usr/bin/env node
import {Command} from "commander";
import GitEncrypt from "./commands";
import process from "process";

const args = process.argv;
const program = new Command();


// Setup CLI
program
  .version("0.0.0", "-v, --version", "output the current version number")
  .description("A tool that allows you to encrypt git files.");

program
  .command('install')
  .description('install git hooks')
  .action(GitEncrypt.cmdInstall);

program
  .command('init')
  .description('calls install and allows you to setup your key')
  .option("-g, --generate", 'the encryption iv')
  .option("-k, --key <value>", 'the encryption key')
  .option("-i, --iv <value>", 'the encryption iv')
  .action(GitEncrypt.cmdInit);

program
  .command('keys')
  .description('get the keys if they are generated')
  .option("-k, --key <value>", 'the encryption key')
  .option("-i, --iv <value>", 'the encryption iv')
  .action(GitEncrypt.cmdKeys);

program
  .command('generate')
  .description('generate keys')
  .option("-s, --store", 'store the keys in the current project')
  .action(async (args: any) => {await GitEncrypt.cmdGenerate(args)});

program
  .command('encrypt')
  .description('encrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-g, --git", 'adds all encrypted files to git before commit')
  .option("-d, --default", 'use default authentication')
  .option("-k, --key <value>", 'the encryption key')
  .option("-i, --iv <value>", 'the encryption iv')
  .action(GitEncrypt.cmdEncrypt);

program
  .command('decrypt')
  .description('decrypt all the files listed between .gitignore #start:encrypt and #end:encrypt')
  .option("-g, --git", 'decrypts all files and handles git events')
  .option("-d, --default", 'use default authentication')
  .option("-k, --key <value>", 'the encryption key')
  .option("-i, --iv <value>", 'the encryption iv')
  .action(GitEncrypt.cmdDecrypt);

program.parse(args);
