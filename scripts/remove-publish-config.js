const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const subPackages = ['core', 'server', 'client', 'browser', 'cli', 'ai-assistant'];

subPackages.forEach((pkgName) => {
  const pkgJsonPath = path.join(rootDir, 'packages', pkgName, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    if (pkgJson.publishConfig && pkgJson.publishConfig.registry) {
      delete pkgJson.publishConfig.registry;
      fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
      console.log(`Removed publishConfig.registry from: packages/${pkgName}`);
    }
  }
});

console.log('Finished removing publishConfig registry fields for npm publishing.');
