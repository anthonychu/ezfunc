#!/usr/bin/env node

const generateFunctions = require('./generateFunctions');
const cleanFunctions = require('./cleanFunctions');
const convertToCustomHandler = require('./convertToCustomHandler');

(async () => {
  const argv = require('yargs/yargs')(process.argv.slice(2))
    .command('generate', 'generate Azure Functions assets (only in CI environments)', (yargs) => {
      yargs
        .positional('force', {
          describe: 'generate even if not in a CI environment'
        })
        .positional('realtime', {
          describe: 'generate SignalR negotiate function',
          default: './lib/swa',
          type: 'string'
        })
    }, generateFunctions)
    .command('clean', 'clean Azure Functions assets', cleanFunctions)
    .command('convert', 'convert a Node.js web app to an Azure Functions app', convertToCustomHandler)
    .help()
    .argv;
})();