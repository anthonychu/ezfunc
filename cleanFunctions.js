const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

module.exports = async function () {
  const items = await fs.readdir('.');

  for (let item of items) {
    const functionJsonFile = path.join(item, 'function.json');
    if (fsSync.existsSync(functionJsonFile)) {
      const functionJson = JSON.parse(await fs.readFile(functionJsonFile));
      if (functionJson.generatedBy === 'ezfunc') {
        console.log(`Deleting folder ${item}`);
        await fs.rmdir(item, { recursive: true });
      }
    }
  }

  const hostJsonFile = 'host.json';
  if (fsSync.existsSync(hostJsonFile)) {
    console.log(`Deleting ${hostJsonFile}`);
    await fs.unlink(hostJsonFile);
  }

  return '';
}