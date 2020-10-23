#!/usr/bin/env node

const generateFunctions = require('./generateFunctions');
const cleanFunctions = require('./cleanFunctions');

(async () => {
  const argv = require('yargs/yargs')(process.argv.slice(2))
    .command('generate', 'generate Azure Functions assets', generateFunctions)
    .command('clean', 'clean Azure Functions assets', cleanFunctions)
    .help()
    .argv;
})();