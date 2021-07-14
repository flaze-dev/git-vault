#!/usr/bin/env node
import {Command} from "commander";
import GitEncrypted from "./commands";
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
  .action(GitEncrypted.cmdInstall);

program
  .command('encrypt')
  .description('encrypt all the files listed in .git-secrets')
  .option("-g, --git", 'adds all encrypted files to git before commit')
  .action((args) => {
    args['git'] ? GitEncrypted.cmdEncryptGit() : GitEncrypted.cmdEncrypt();
  });

program
  .command('decrypt')
  .description('decrypt all the files listed in .git-secrets')
  .option("-g, --git", 'decrypts all files and handles git events')
  .action(GitEncrypted.cmdDecrypt);

// program
//   .command('dev')
//   .description('run development script')
//   .action(() => {
//     const lines = GitEncrypted.getPathsToEncrypt(".gitignore");
//     console.log(lines);
//   });

program.parse(args);