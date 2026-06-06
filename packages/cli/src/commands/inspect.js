const { Command } = require('commander');
const net = require('net');
const { Frame, FrameTypes, Serializer } = require('@ajaymyth/core');
const { mergeWithProfile } = require('../config/rc');

const FRAME_TYPE_NAMES = {
  0x01: 'REQUEST', 0x02: 'RESPONSE', 0x03: 'STREAM_START', 0x04: 'STREAM_DATA',
  0x05: 'STREAM_END', 0x06: 'ERROR', 0x07: 'PING', 0x08: 'PONG',
  0x09: 'BROADCAST', 0x0A: 'SUBSCRIBE', 0x0B: 'UNSUBSCRIBE', 0x0C: 'PUBLISH',
  0x0D: 'CLOSE', 0x0E: 'CLOSE_ACK', 0x0F: 'HELLO', 0x10: 'HELLO_ACK',
  0x11: 'SERVER_CLOSING',
};

const inspectCommand = new Command('inspect')
  .description('Raw frame inspector — shows hex dump and decoded frame breakdown')
  .argument('<host:port>', 'Server address (e.g. localhost:4000)')
  .argument('<route>', 'Route name')
  .argument('[payload]', 'JSON payload or @file.json', '{}')
  .option('--tls', 'Use TLS')
  .option('--auth <token>', 'Auth token')
  .option('--annotate', 'Annotate each byte with field name', true)
  .option('--profile <name>', 'Connection profile from ~/.afterlinkrc')
  .action(async (hostPort, route, payloadArg, options) => {
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr, 10) || 4000;
    const profile = mergeWithProfile({ host, port, tls: options.tls, auth: options.auth }, options.profile);

    let body;
    if (payloadArg.startsWith('@')) {
      body = JSON.parse(require('fs').readFileSync(payloadArg.slice(1), 'utf8'));
    } else {
      try { body = JSON.parse(payloadArg); } catch { body = {}; }
    }

    process.stdout.write(`\nAfterLink Frame Inspector  ·  ${profile.host}:${profile.port}\n\n`);

    const socket = profile.tls
      ? require('tls').connect({ host: profile.host, port: profile.port, rejectUnauthorized: false })
      : net.connect({ host: profile.host, port: profile.port });

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 10) {
        const frame = Frame.decode(buffer);
        if (!frame) break;
        buffer = buffer.slice(frame.totalSize);

        const typeName = FRAME_TYPE_NAMES[frame.type] || `UNKNOWN(0x${frame.type.toString(16)})`;
        const direction = frame.type === FrameTypes.HELLO_ACK || frame.type === FrameTypes.RESPONSE || frame.type === FrameTypes.ERROR
          ? 'RECEIVED' : 'SENT';

        process.stdout.write(`────── ${direction}: ${typeName} frame ──────────────────────────────────────────────\n`);

        // Full frame bytes (header + payload)
        const fullFrame = Frame.encode(frame.type, frame.flags, frame.messageId, frame.payload);
        printHexDump(fullFrame, frame);

        // Decode payload if possible
        try {
          const decoded = Serializer.decode(frame.payload);
          process.stdout.write(`  Payload (decoded):\n    ${JSON.stringify(decoded, null, 2)}\n`);
        } catch {
          process.stdout.write(`  Payload (raw hex): ${frame.payload.toString('hex')}\n`);
        }
        process.stdout.write('\n');

        // Exit after response or error
        if (frame.type === FrameTypes.RESPONSE || frame.type === FrameTypes.ERROR) {
          socket.destroy();
          process.exit(0);
        }
      }
    });

    socket.on('connect', () => {
      // Send HELLO
      const helloPayload = Serializer.encode({
        version: 'AL/1.1',
        auth: profile.auth || null,
        capabilities: ['streaming', 'pubsub'],
      });
      const helloFrame = Frame.encode(FrameTypes.HELLO, 0, 0, helloPayload);
      printHexDump(helloFrame, { type: FrameTypes.HELLO, flags: 0, messageId: 0, payload: helloPayload }, 'SENT', 'HELLO');

      socket.write(helloFrame);

      // After HELLO_ACK, send REQUEST
      const origOn = socket.on.bind(socket);
      let requestSent = false;
      socket.on('data', function requestData(data) {
        if (requestSent) return;
        let buf = data;
        while (buf.length >= 10) {
          const f = Frame.decode(buf);
          if (!f) break;
          buf = buf.slice(f.totalSize);
          if (f.type === FrameTypes.HELLO_ACK) {
            requestSent = true;
            const reqPayload = Serializer.encode({ route, body });
            const reqFrame = Frame.encode(FrameTypes.REQUEST, 0, 1, reqPayload);
            printHexDump(reqFrame, { type: FrameTypes.REQUEST, flags: 0, messageId: 1, payload: reqPayload }, 'SENT', 'REQUEST');
            socket.write(reqFrame);
          }
        }
      });
    });

    socket.on('error', (err) => {
      console.error(`Connection error: ${err.message}`);
      process.exit(2);
    });
  });

function printHexDump(fullFrame, frame, direction = null, typeName = null) {
  const name = typeName || FRAME_TYPE_NAMES[frame.type] || `UNKNOWN(0x${frame.type.toString(16)})`;
  const dir = direction || 'DATA';

  // Header bytes
  process.stdout.write(`Hex:  `);
  for (let i = 0; i < Math.min(fullFrame.length, 32); i++) {
    const byte = fullFrame[i].toString(16).padStart(2, '0');
    if (i === 10) process.stdout.write('  ');
    process.stdout.write(`${byte} `);
  }
  if (fullFrame.length > 32) process.stdout.write('...');
  process.stdout.write(`  [header: 10 bytes, payload: ${frame.payload.length} bytes]\n`);

  // Decoded header
  process.stdout.write(`\nDecoded:\n`);
  process.stdout.write(`  [00] Frame Type  : 0x${frame.type.toString(16).padStart(2, '0')}  ${name}\n`);
  process.stdout.write(`  [01] Flags       : 0x${frame.flags.toString(16).padStart(2, '0')}\n`);
  process.stdout.write(`  [02-05] Msg ID   : 0x${frame.messageId.toString(16).padStart(8, '0')}  (${frame.messageId})\n`);
  process.stdout.write(`  [06-09] Payload  : 0x${frame.payload.length.toString(16).padStart(8, '0')}  (${frame.payload.length} bytes)\n`);
  process.stdout.write('\n');
}

module.exports = { inspectCommand };
