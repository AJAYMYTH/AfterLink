const esbuild = require('esbuild');
const path = require('path');

const outdir = path.join(__dirname, '..', 'dist');

// ESM bundle
esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: path.join(outdir, 'index.esm.js'),
  platform: 'browser',
  target: ['chrome120', 'firefox120', 'safari17'],
  minify: false,
  sourcemap: true,
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: {
    js: '// @afterlink/browser v1.2.0 — ESM\nimport { Buffer } from "buffer/";\nglobalThis.Buffer = globalThis.Buffer || Buffer;\n',
  },
}).then(() => {
  console.log('✓ Built ESM bundle');
}).catch(() => process.exit(1));

// CJS bundle
esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'cjs',
  outfile: path.join(outdir, 'index.cjs.js'),
  platform: 'browser',
  target: ['chrome120', 'firefox120', 'safari17'],
  minify: false,
  sourcemap: true,
}).then(() => {
  console.log('✓ Built CJS bundle');
}).catch(() => process.exit(1));

// IIFE bundle (CDN / script tag)
esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'AfterLink',
  outfile: path.join(outdir, 'afterlink.browser.min.js'),
  platform: 'browser',
  target: ['chrome120', 'firefox120', 'safari17'],
  minify: true,
  sourcemap: true,
}).then(() => {
  console.log('✓ Built IIFE bundle (minified)');
}).catch(() => process.exit(1));
