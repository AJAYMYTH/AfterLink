// Browser bundle entry for the AfterLink interactive web demo.
//
// Bundled by `examples/web-demo/server.js` (esbuild) into public/sdk.js.
// It wraps the REAL workspace sources — the same code that ships on npm:
//   - @ajaymyth/browser  → the browser client (negotiates AL/2, WS bridge)
//   - @ajaymyth/core     → frame codecs + serializer (used by the frame explorer)
//
// `buffer/` (trailing slash) forces the npm polyfill package instead of the
// Node.js builtin, because the Frame codec expects a Buffer in browsers too.
const { Buffer } = require('buffer/');

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

const { Client } = require('@ajaymyth/browser');
const Core = require('@ajaymyth/core');

module.exports = { Client, Core, Buffer };
