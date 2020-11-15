const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const promisify = require('util').promisify;
const find = require('find');
const readline = require('readline');

const catchAllFunctionName = 'catchAllFunction';

module.exports = async function generateFunctions(argv) {
  const items = await fs.readdir('.');

  const hasHostJson = !!items.find(f => f === 'host.json');
  const hasFunctionFolder = !!items.find(f => f === catchAllFunctionName);
  if (hasHostJson || hasFunctionFolder) {
    console.log('Folder already contains functions assets. Skipping.');
    return 1;
  }

  const hasPackageJson = !!items.find(f => f === 'package.json');
  let startCommand;
  if (hasPackageJson) {
    const packageJson = JSON.parse(await fs.readFile('package.json'));
    startCommand = packageJson.scripts && packageJson.scripts.start;
  }

  if (!startCommand) {
    if (items.find(f => 'server.js')) {
      startCommand = 'node server.js';
    } else if (items.find(f => 'app.js')) {
      startCommand = 'node app.js';
    } if (items.find(f => 'server.js')) {
      startCommand = 'node server.js';
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question[promisify.custom] = (question) => {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  };
  const userStartCommand = await promisify(rl.question)(`App startup command: (${startCommand}) `) || startCommand;
  rl.close();

  if (!userStartCommand) {
    console.error('Start command cannot be empty.');
    return 1;
  }

  const startCommandParts = userStartCommand.split(/\s+/);

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
    },
    "customHandler": {
      "description": {
        "defaultExecutablePath": startCommandParts[0],
        "arguments": startCommandParts.slice(1)
      },
      "enableForwardingHttpRequest": true
    },
    "extensions": {
      "http": {
        "routePrefix": ""
      }
    }
  }, null, 2));

  const localSettingsJsonFile = 'local.settings.json';
  console.log(`Generating ${localSettingsJsonFile}`);
  await fs.writeFile(localSettingsJsonFile, JSON.stringify({
    "IsEncrypted": false,
    "Values": {
      "FUNCTIONS_WORKER_RUNTIME": "node"
    }
  }, null, 2));

  console.log(`Generating ${path.join(catchAllFunctionName, 'function.json')}`);
  await fs.mkdir(catchAllFunctionName);
  await fs.writeFile(path.join(catchAllFunctionName, 'function.json'), JSON.stringify({
    "generatedBy": "ezfunc",
    "bindings": [
      {
        "type": "httpTrigger",
        "authLevel": "anonymous",
        "direction": "in",
        "name": "req",
        "route": "{*restOfPath}"
      },
      {
        "type": "http",
        "direction": "out",
        "name": "res"
      }
    ]
  }, null, 2));

  console.log(`Generating VS Code settings`);
  const vscodeFolder = '.vscode'
  await fs.mkdir(vscodeFolder);
  await fs.writeFile(path.join(vscodeFolder, 'launch.json'), JSON.stringify({
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Attach to Node Functions",
            "type": "node",
            "request": "attach",
            "port": 9229,
            "preLaunchTask": "func: host start"
        }
    ]
  }, null, 2));

  const argsPrefix = 'AzureFunctionsJobHost__customHandler__description__arguments__';
  const tasksEnv = {};
  if (startCommandParts[0] === 'node') {
    tasksEnv[`${argsPrefix}0`] = '--inspect';
    for (let i = 1; i < startCommandParts.length; i++) {
      tasksEnv[`${argsPrefix}${i}`] = startCommandParts[i];
    }
  }
  await fs.writeFile(path.join(vscodeFolder, 'tasks.json'), JSON.stringify({
    "version": "2.0.0",
    "tasks": [
      {
        "type": "func",
        "command": "host start",
        "problemMatcher": "$func-node-watch",
        "isBackground": true,
        "options": {
          "env": tasksEnv
        }
      }
    ]
  }, null, 2));

  let sourceFiles = find.fileSync(/\.ts$/, process.cwd()).filter(f => !/[/\\]node_modules[/\\]/.test(f));
  if (sourceFiles.length === 0) {
    sourceFiles = find.fileSync(/\b(\.js|www)$/, process.cwd()).filter(f => !/[/\\]node_modules[/\\]/.test(f));
  }

  const sourceChangeSuggestions = await findPortInstruction(sourceFiles);

  console.log(`Make sure your app is listening to the port supplied in the "FUNCTIONS_CUSTOMHANDLER_PORT" variable.`);
  if (sourceChangeSuggestions.customHandlerPortLine) {
    console.log(`Looks like you've already configured your app properly:
    ${sourceChangeSuggestions.customHandlerPortLine.file}:${sourceChangeSuggestions.customHandlerPortLine.lineNumber}:1 :
    ${sourceChangeSuggestions.customHandlerPortLine.original}`);
  } else if (sourceChangeSuggestions.processPortLine || sourceChangeSuggestions.portAssignmentLine) {
    const line = sourceChangeSuggestions.processPortLine || sourceChangeSuggestions.portAssignmentLine;
    console.log(`${line.file}:${line.lineNumber}:1 :
    ${line.original}\nSuggested change:
    ${line.suggestion}`);
  }

  return '';
}

async function findPortInstruction(files) {
  let customHandlerPortLine;
  let processPortLine;
  let portAssignmentLine;

  for (let file of files) {
    const fileStream = fsSync.createReadStream(file);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    let lineNumber = 1;
    for await (const line of rl) {
      if (/\bFUNCTIONS_CUSTOMHANDLER_PORT\b/.test(line)) {
        customHandlerPortLine = {
          file,
          lineNumber,
          original: line
        };
      } else if (/\bprocess\.env\.PORT\b/.test(line)) {
        processPortLine = {
          file,
          lineNumber,
          original: line,
          suggestion: line.replace(/\b(process\.env\.PORT)\b/, 'process.env.FUNCTIONS_CUSTOMHANDLER_PORT || $1')
        };
      } else if (/^(.*\bport\s*=)\s*(['"]?\d+['"]?.*)$/.test(line)) {
        portAssignmentLine = {
          file,
          lineNumber,
          original: line,
          suggestion: line.replace(/^(.*\bport\s*=)\s*(['"]?\d+['"]?.*)$/, '$1 process.env.FUNCTIONS_CUSTOMHANDLER_PORT || $2')
        };
      }
      lineNumber++;
    }
    rl.close();

  }
  return {
    customHandlerPortLine,
    processPortLine,
    portAssignmentLine
  }
}