const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { Client } = require('@afterlink/client');
const { mergeWithProfile } = require('../config/rc');
const { formatCallHeader, formatCallSuccess, formatCallError, formatTraceFrame, prettyJson } = require('../output/formatter');

const callCommand = new Command('call')
  .description('Send a request to a named route and print the response')
  .argument('<host:port>', 'Server address (e.g. localhost:4000)')
  .argument('<route>', 'Route name (e.g. createUser, getStats)')
  .argument('[payload]', 'JSON payload as a string or @file.json', '{}')
  .option('--tls', 'Use TLS (afterlinks://)')
  .option('-H, --header <k=v>', 'Add session header (repeatable)', (v, prev) => [...(prev || []), v], [])
  .option('--auth <token>', 'JWT auth token for HELLO handshake')
  .option('-t, --timeout <ms>', 'Request timeout (ms)', '10000')
  .option('--pretty', 'Pretty-print JSON response', true)
  .option('--no-pretty', 'Compact JSON output')
  .option('-j, --json', 'Machine-readable JSON wrapper')
  .option('--raw', 'Print raw response bytes (hex)')
  .option('--trace', 'Show full frame exchange')
  .option('--profile <name>', 'Connection profile from ~/.afterlinkrc')
  .action(async (hostPort, route, payloadArg, options) => {
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr, 10) || 4000;
    const useTls = options.tls;
    const timeout = parseInt(options.timeout, 10);

    const profile = mergeWithProfile({ host, port, tls: useTls, auth: options.auth }, options.profile);

    // Parse payload
    let body;
    if (payloadArg.startsWith('@')) {
      const filePath = path.resolve(payloadArg.slice(1));
      try {
        body = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        console.error(`Error reading file ${filePath}: ${err.message}`);
        process.exit(1);
      }
    } else {
      try {
        body = JSON.parse(payloadArg);
      } catch {
        body = {};
      }
    }

    const url = profile.tls
      ? `afterlinks://${profile.host}:${profile.port}`
      : `afterlink://${profile.host}:${profile.port}`;

    const client = new Client(url, {
      auth: profile.auth,
      timeout,
      connectTimeout: timeout,
    });

    const trace = [];
    if (options.trace) {
      // Patch socket to capture frames
      const origConnect = client.connect.bind(client);
      client.connect = async () => {
        await origConnect();
        if (client.socket) {
          const origWrite = client.socket.write.bind(client.socket);
          client.socket.write = (data) => {
            if (Buffer.isBuffer(data) && data.length >= 10) {
              const frame = require('@afterlink/core').Frame.decode(data);
              if (frame) {
                const typeName = getFrameTypeName(frame.type);
                const info = `payload=${frame.payload.length}B  flags=0x${frame.flags.toString(16).padStart(2, '0')}`;
                trace.push({ direction: 'sent', type: typeName, seq: frame.messageId, info });
              }
            }
            return origWrite(data);
          };

          const origHandleData = client._handleData.bind(client);
          client._handleData = (data) => {
            let buf = data;
            while (buf.length >= 10) {
              const frame = require('@afterlink/core').Frame.decode(buf);
              if (!frame) break;
              buf = buf.slice(frame.totalSize);
              const typeName = getFrameTypeName(frame.type);
              const info = `payload=${frame.payload.length}B  flags=0x${frame.flags.toString(16).padStart(2, '0')}`;
              trace.push({ direction: 'recv', type: typeName, seq: frame.messageId, info });
            }
            return origHandleData(data);
          };
        }
      };
    }

    const startTime = Date.now();
    try {
      if (!options.json) {
        process.stdout.write(formatCallHeader(route, `${profile.host}:${profile.port}`, body) + '\n');
      }

      await client.connect();
      const result = await client.request(route, body);
      const latencyMs = Date.now() - startTime;

      if (options.trace) {
        process.stdout.write('\n');
        for (const t of trace) {
          process.stdout.write(formatTraceFrame(t.direction, t.type, t.seq, t.info) + '\n');
        }
        process.stdout.write('\n');
      }

      if (options.json) {
        process.stdout.write(JSON.stringify({ status: 'ok', data: result, latencyMs }, null, 2) + '\n');
      } else if (options.raw) {
        process.stdout.write(Buffer.from(JSON.stringify(result)).toString('hex') + '\n');
      } else {
        process.stdout.write(formatCallSuccess(result, latencyMs) + '\n');
      }

      await client.disconnect();
      process.exit(0);
    } catch (err) {
      const latencyMs = Date.now() - startTime;

      if (options.trace) {
        process.stdout.write('\n');
        for (const t of trace) {
          process.stdout.write(formatTraceFrame(t.direction, t.type, t.seq, t.info) + '\n');
        }
        process.stdout.write('\n');
      }

      if (options.json) {
        process.stdout.write(JSON.stringify({ status: 'error', code: err.code || 'UNKNOWN', message: err.message, latencyMs }, null, 2) + '\n');
      } else {
        process.stdout.write(formatCallError(err, latencyMs) + '\n');
      }

      try { await client.disconnect(); } catch {}
      process.exit(1);
    }
  });

function getFrameTypeName(type) {
  const names = {
    0x01: 'REQUEST', 0x02: 'RESPONSE', 0x03: 'STREAM_START', 0x04: 'STREAM_DATA',
    0x05: 'STREAM_END', 0x06: 'ERROR', 0x07: 'PING', 0x08: 'PONG',
    0x09: 'BROADCAST', 0x0A: 'SUBSCRIBE', 0x0B: 'UNSUBSCRIBE', 0x0C: 'PUBLISH',
    0x0D: 'CLOSE', 0x0E: 'CLOSE_ACK', 0x0F: 'HELLO', 0x10: 'HELLO_ACK',
    0x11: 'SERVER_CLOSING',
  };
  return names[type] || `UNKNOWN(0x${type.toString(16)})`;
}

module.exports = { callCommand };
