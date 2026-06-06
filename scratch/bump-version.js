const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

const OLD_VERSION = '1.2.3';
const NEW_VERSION = '1.2.4';

console.log(`Bumping versions from ${OLD_VERSION} to ${NEW_VERSION}...`);

// 1. Bump version in all packages/*/package.json
const packages = fs.readdirSync(packagesDir);
for (const pkgName of packages) {
  const pkgJsonPath = path.join(packagesDir, pkgName, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    let content = fs.readFileSync(pkgJsonPath, 'utf8');
    const oldStr = `"version": "${OLD_VERSION}"`;
    const newStr = `"version": "${NEW_VERSION}"`;
    if (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr);
      fs.writeFileSync(pkgJsonPath, content, 'utf8');
      console.log(`✅ Bumped version in ${pkgName}/package.json`);
    } else {
      console.log(`⚠️ Version not found or already bumped in ${pkgName}/package.json`);
    }
  }
}

// 2. Bump version in publish.ps1
const publishScriptPath = path.join(rootDir, 'publish.ps1');
if (fs.existsSync(publishScriptPath)) {
  let content = fs.readFileSync(publishScriptPath, 'utf8');
  const oldRegex = new RegExp(OLD_VERSION.replace(/\./g, '\\.'), 'g');
  if (oldRegex.test(content)) {
    content = content.replace(oldRegex, NEW_VERSION);
    fs.writeFileSync(publishScriptPath, content, 'utf8');
    console.log(`✅ Bumped version in publish.ps1`);
  } else {
    console.log(`⚠️ Version not found in publish.ps1`);
  }
}

// 3. Update CHANGELOG.md
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  let content = fs.readFileSync(changelogPath, 'utf8');
  // Insert a new section for v1.2.2 at the top under ## [1.2.1]
  const targetStr = '## [1.2.1]';
  if (content.includes(targetStr) && !content.includes(`## [${NEW_VERSION}]`)) {
    const today = new Date().toISOString().split('T')[0];
    const newSection = `## [${NEW_VERSION}] — ${today}\n\n### Added\n- Added new \`afterlink upgrade\` CLI command to easily keep all packages up to date.\n- Configured umbrella \`afterlink\` package to use \`latest\` version resolution for all dependencies.\n\n`;
    content = content.replace(targetStr, newSection + targetStr);
    fs.writeFileSync(changelogPath, content, 'utf8');
    console.log(`✅ Updated CHANGELOG.md with v1.2.2 entry`);
  }
}

console.log('Done!');
