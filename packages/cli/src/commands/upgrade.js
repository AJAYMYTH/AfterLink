const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ALL_AFTERLINK_PACKAGES = [
  'afterlink',
  '@afterlink/core',
  '@afterlink/server',
  '@afterlink/client',
  '@afterlink/browser',
  '@afterlink/cli',
  '@afterlink/ai-assistant'
];

const upgradeCommand = new Command('upgrade')
  .description('Upgrade all installed AfterLink packages in the current project to their latest versions')
  .option('-g, --global', 'Upgrade AfterLink packages globally')
  .action((options) => {
    const cwd = process.cwd();
    let packageManager = 'npm';

    // Detect package manager
    if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
      packageManager = 'npm';
    }

    if (options.global) {
      console.log(`Upgrading AfterLink packages globally using ${packageManager}...`);
      let command = '';
      if (packageManager === 'pnpm') {
        command = `pnpm add -g ${ALL_AFTERLINK_PACKAGES.map(p => `${p}@latest`).join(' ')}`;
      } else if (packageManager === 'yarn') {
        command = `yarn global add ${ALL_AFTERLINK_PACKAGES.map(p => `${p}@latest`).join(' ')}`;
      } else {
        command = `npm install -g ${ALL_AFTERLINK_PACKAGES.map(p => `${p}@latest`).join(' ')}`;
      }

      console.log(`Running: ${command}`);
      try {
        execSync(command, { stdio: 'inherit' });
        console.log('\n✅ Successfully upgraded AfterLink packages globally!');
      } catch (error) {
        console.error(`\n❌ Failed to upgrade packages globally: ${error.message}`);
        process.exit(1);
      }
      return;
    }

    // Local upgrade
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      console.log('No package.json found in the current directory.');
      console.log('To install/upgrade the latest AfterLink umbrella package, running npm install afterlink@latest...');
      const command = `${packageManager} install afterlink@latest`;
      console.log(`Running: ${command}`);
      try {
        execSync(command, { stdio: 'inherit' });
        console.log('\n✅ Successfully installed afterlink@latest!');
      } catch (error) {
        console.error(`\n❌ Failed: ${error.message}`);
        process.exit(1);
      }
      return;
    }

    // Read package.json
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (error) {
      console.error(`Error parsing package.json: ${error.message}`);
      process.exit(1);
    }

    const dependenciesToUpgrade = [];
    const devDependenciesToUpgrade = [];

    const isAfterlinkPkg = (name) => name === 'afterlink' || name.startsWith('@afterlink/');

    if (pkg.dependencies) {
      Object.keys(pkg.dependencies).forEach((dep) => {
        if (isAfterlinkPkg(dep)) {
          dependenciesToUpgrade.push(`${dep}@latest`);
        }
      });
    }

    if (pkg.devDependencies) {
      Object.keys(pkg.devDependencies).forEach((dep) => {
        if (isAfterlinkPkg(dep)) {
          devDependenciesToUpgrade.push(`${dep}@latest`);
        }
      });
    }

    if (dependenciesToUpgrade.length === 0 && devDependenciesToUpgrade.length === 0) {
      console.log('No AfterLink packages found in package.json dependencies.');
      console.log('Installing the umbrella package (afterlink@latest) as dependency...');
      dependenciesToUpgrade.push('afterlink@latest');
    }

    console.log(`Upgrading AfterLink packages in the current project using ${packageManager}...`);

    if (dependenciesToUpgrade.length > 0) {
      let depCommand = '';
      if (packageManager === 'pnpm') {
        depCommand = `pnpm add ${dependenciesToUpgrade.join(' ')}`;
      } else if (packageManager === 'yarn') {
        depCommand = `yarn add ${dependenciesToUpgrade.join(' ')}`;
      } else {
        depCommand = `npm install ${dependenciesToUpgrade.join(' ')}`;
      }
      console.log(`Running: ${depCommand}`);
      try {
        execSync(depCommand, { stdio: 'inherit' });
      } catch (error) {
        console.error(`\n❌ Failed to upgrade dependencies: ${error.message}`);
        process.exit(1);
      }
    }

    if (devDependenciesToUpgrade.length > 0) {
      let devDepCommand = '';
      if (packageManager === 'pnpm') {
        devDepCommand = `pnpm add -D ${devDependenciesToUpgrade.join(' ')}`;
      } else if (packageManager === 'yarn') {
        devDepCommand = `yarn add -D ${devDependenciesToUpgrade.join(' ')}`;
      } else {
        devDepCommand = `npm install --save-dev ${devDependenciesToUpgrade.join(' ')}`;
      }
      console.log(`Running: ${devDepCommand}`);
      try {
        execSync(devDepCommand, { stdio: 'inherit' });
      } catch (error) {
        console.error(`\n❌ Failed to upgrade devDependencies: ${error.message}`);
        process.exit(1);
      }
    }

    console.log('\n✅ Successfully upgraded AfterLink packages to their latest versions!');
  });

module.exports = { upgradeCommand };
