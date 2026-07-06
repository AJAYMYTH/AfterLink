const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.agents' && file !== 'scripts') {
        walkDir(fullPath, callback);
      }
    } else {
      callback(fullPath);
    }
  }
}

// Walk through the project and restore the @afterlink/ scope in package.json, source files, and docs
walkDir(rootDir, (filePath) => {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);

  if (base === 'package.json') {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    if (content.includes('@ajaymyth/')) {
      content = content.split('@ajaymyth/').join('@afterlink/');
      modified = true;
    }

    const pkgJson = JSON.parse(content);
    if (pkgJson.publishConfig && pkgJson.publishConfig.registry) {
      delete pkgJson.publishConfig.registry;
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(pkgJson, null, 2) + '\n', 'utf8');
      console.log(`Restored scope and stripped registry in: ${filePath}`);
    }
  } else if (ext === '.js' || ext === '.ts' || base.endsWith('.d.ts') || ext === '.md') {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('@ajaymyth/')) {
      content = content.split('@ajaymyth/').join('@afterlink/');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Restored scope in source/doc: ${filePath}`);
    }
  }
});

console.log('Restored package scopes to @afterlink/ for npm release.');
