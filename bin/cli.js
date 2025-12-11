#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from '../src/commands/init.js';
import { deployCommand } from '../src/commands/deploy.js';
import { statusCommand } from '../src/commands/status.js';
import { rollbackCommand } from '../src/commands/rollback.js';
import { domainCommand } from '../src/commands/domain.js';
import { logsCommand } from '../src/commands/logs.js';

const program = new Command();

program
  .name('autodeploy')
  .description('CLI tool for automatic deployment with git push')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize deployment configuration (one-time setup)')
  .action(initCommand);

program
  .command('deploy')
  .description('Deploy current branch to server')
  .option('-b, --branch <branch>', 'Branch to deploy', 'main')
  .action(deployCommand);

program
  .command('status')
  .description('Check server and deployment status')
  .action(statusCommand);

program
  .command('rollback')
  .description('Rollback to previous deployment')
  .option('-v, --version <version>', 'Specific version to rollback to')
  .action(rollbackCommand);

program
  .command('domain')
  .description('Manage domain and SSL configuration')
  .option('-a, --add <domain>', 'Add new domain')
  .option('-r, --remove <domain>', 'Remove domain')
  .option('-l, --list', 'List all domains')
  .action(domainCommand);

program
  .command('logs')
  .description('View deployment logs')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(logsCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
