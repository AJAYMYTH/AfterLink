const fs = require('fs');

const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const unreleasedSection = changelog.match(/## \[Unreleased\]([\s\S]*?)## \[/)?.[1];

if (!unreleasedSection?.trim()) {
  console.error('CHANGELOG [Unreleased] section is empty. Document changes before releasing.');
  process.exit(1);
}

console.log('CHANGELOG [Unreleased] section has content. Ready to release.');
process.exit(0);
