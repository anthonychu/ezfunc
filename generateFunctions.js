const fs = require('fs').promises;
const path = require('path');
const ci = require('ci-info');

module.exports = async function generateFunctions(argv) {
  if (!ci.isCI && !argv.force) {
    console.log('Not running in CI environment. Skipping function app generation.');
    return 0;
  }
  const files = await fs.readdir('.');

  if (argv.realtime && !files.includes('negotiate.js') && !files.includes('negotiate')) {
    await fs.writeFile('negotiate.js', `
    const swa = require('./lib/swa');

    module.exports = async function (context, req) {
        context.res.json(swa.realtime.generateNegotiatePayload());
    };
    `);
    files.push('negotiate.js');
  }

  for (let file of files.filter(f => f.endsWith('.js'))) {
    const fileStats = await fs.lstat(file);
    if (fileStats.isFile) {
      console.log(`Generating folder for function: ${file}`);
      const functionName = path.parse(file).name;
      await fs.mkdir(functionName);
      await fs.writeFile(path.join(functionName, 'function.json'), JSON.stringify({
        "generatedBy": "ezfunc",
        "scriptFile": path.join('..', file),
        "disabled": false,
        "bindings": [
          {
            "authLevel": "anonymous",
            "type": "httpTrigger",
            "direction": "in",
            "name": "req"
          },
          {
            "type": "http",
            "direction": "out",
            "name": "res"
          }
        ]
      }, null, 2));
    }
  }

  const hostJsonFile = 'host.json';
  console.log(`Generating ${hostJsonFile}`);
  await fs.writeFile(hostJsonFile, JSON.stringify({
    "version": "2.0",
    "logging": {
      "applicationInsights": {
        "samplingExcludedTypes": "Request",
        "samplingSettings": {
          "isEnabled": true
        }
      }
    }
  }, null, 2));

  return '';
}