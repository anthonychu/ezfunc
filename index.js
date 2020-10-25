#!/usr/bin/env node

const generateFunctions = require('./generateFunctions');
const cleanFunctions = require('./cleanFunctions');

(async () => {
  const argv = require('yargs/yargs')(process.argv.slice(2))
    .command('generate', 'generate Azure Functions assets (only in CI environments)', (yargs) => {
      yargs
        .positional('force', {
          describe: 'generate even if not in a CI environment'
        })
    }, generateFunctions)
    .command('clean', 'clean Azure Functions assets', cleanFunctions)
    .help()
    .argv;
})();