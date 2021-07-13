#!/usr/bin/env node
import {Command} from "commander";
import * as process from "process";
import {install} from "./actions/install";

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

program.parse(args);