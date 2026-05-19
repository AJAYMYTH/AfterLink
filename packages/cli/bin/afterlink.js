#!/usr/bin/env node
const { program } = require('commander');
const { pingCommand } = require('../src/commands/ping');
const { callCommand } = require('../src/commands/call');
const { monitorCommand } = require('../src/commands/monitor');
const { inspectCommand } = require('../src/commands/inspect');

program
  .name('afterlink')
  .description('AfterLink CLI — test, debug, and monitor AfterLink servers')
  .version(require('../package.json').version);

program.addCommand(pingCommand);
program.addCommand(callCommand);
program.addCommand(monitorCommand);
program.addCommand(inspectCommand);

program.parse();
