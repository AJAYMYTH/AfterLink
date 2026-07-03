const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function bumpFile(filePath, oldVer, newVer) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(oldVer)) {
      content = content.split(oldVer).join(newVer);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Bumped: ${path.relative(rootDir, filePath)}`);
    } else {
      console.log(`⚠️ Version string not found in: ${path.relative(rootDir, filePath)}`);
    }
  }
}

const files = [
  path.join(rootDir, 'package.json'),
  path.join(rootDir, 'packages/core/package.json'),
  path.join(rootDir, 'packages/server/package.json'),
  path.join(rootDir, 'packages/client/package.json'),
  path.join(rootDir, 'packages/cluster/package.json'),
  path.join(rootDir, 'packages/browser/package.json'),
  path.join(rootDir, 'packages/cli/package.json'),
  path.join(rootDir, 'packages/ai-assistant/package.json'),
  path.join(rootDir, 'packages/afterlink/package.json'),
  path.join(rootDir, 'python/pyproject.toml'),
  path.join(rootDir, 'dart/pubspec.yaml'),
  path.join(rootDir, 'publish.ps1')
];

for (const file of files) {
  bumpFile(file, '2.0.0', '2.0.1');
}
