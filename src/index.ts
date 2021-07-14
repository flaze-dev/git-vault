#!/usr/bin/env node
import {Command} from "commander";
import {decrypt, encrypt, gitEncrypt, install} from "./actions";
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
  .action(install);

program
  .command('encrypt')
  .option("-g, --git", 'adds all encrypted files to git before commit')
  .description('encrypt all the files listed in .git-secrets')
  .action((args) => {
    args['git'] ? gitEncrypt() : encrypt();
  });

program
  .command('decrypt')
  .description('decrypt all the files listed in .git-secrets')
  .action(decrypt);

program.parse(args);