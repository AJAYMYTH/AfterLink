const { Command } = require('commander');
const net = require('net');
const { Frame, FrameTypes, Serializer } = require('@afterlink/core');
const { mergeWithProfile } = require('../config/rc');
const { formatPingHeader, formatPingResult, formatPingStats, prettyJson } = require('../output/formatter');

const pingCommand = new Command('ping')
  .description('Test server connectivity and measure round-trip latency')
  .argument('<host:port>', 'Server address (e.g. localhost:4000)')
  .option('-n, --count <n>', 'Number of pings to send', '4')
  .option('-i, --interval <ms>', 'Interval between pings (ms)', '1000')
  .option('-t, --timeout <ms>', 'Timeout per ping (ms)', '5000')
  .option('--tls', 'Use TLS (afterlinks://)')
  .option('--no-color', 'Disable colored output')
  .option('-j, --json', 'Output as JSON (for scripting)')
  .option('--profile <name>', 'Connection profile from ~/.afterlinkrc')
  .action(async (hostPort, options) => {
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr, 10) || 4000;
    const count = parseInt(options.count, 10);
    const interval = parseInt(options.interval, 10);
    const timeout = parseInt(options.timeout, 10);
    const useTls = options.tls;
    const asJson = options.json;

    const profile = mergeWithProfile({ host, port, tls: useTls }, options.profile);
    const targetHost = profile.host;
    const targetPort = profile.port;
    const useTLS = profile.tls;

    const results = [];
    const latencies = [];
    let received = 0;

    if (!asJson) {
      process.stdout.write(formatPingHeader(targetHost, targetPort, 'AF/1.1') + '\n\n');
    }

    for (let seq = 1; seq <= count; seq++) {
      const result = await doPing(targetHost, targetPort, useTLS, seq, timeout);
      results.push({ seq, status: result.ok ? 'ok' : 'timeout', latencyMs: result.latencyMs });
      if (result.ok) {
        received++;
        latencies.push(result.latencyMs);
      }

      if (!asJson) {
        process.stdout.write(formatPingResult(seq, result.latencyMs, result.ok) + '\n');
      }

      if (seq < count) {
        await sleep(interval);
      }
    }

    if (!asJson) {
      process.stdout.write(formatPingStats(count, received, latencies) + '\n');
    } else {
      const loss = ((count - received) / count * 100).toFixed(0);
      const output = {
        host: targetHost,
        port: targetPort,
        protocol: 'AF/1.1',
        sent: count,
        received,
        packetLoss: parseInt(loss, 10),
        latency: latencies.length > 0
          ? {
              min: parseFloat(Math.min(...latencies).toFixed(2)),
              avg: parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
              max: parseFloat(Math.max(...latencies).toFixed(2)),
              unit: 'ms',
            }
          : null,
        results,
      };
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    }

    // Exit codes
    if (received === 0) process.exit(2);
    if (received < count) process.exit(1);
    process.exit(0);
  });

async function doPing(host, port, useTLS, seq, timeout) {
  return new Promise((resolve) => {
    const socket = useTLS
      ? require('tls').connect({ host, port, rejectUnauthorized: false })
      : net.connect({ host, port });

    const startTime = Date.now();
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ok: false, latencyMs: null });
      }
    }, timeout);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 10) {
        const frame = Frame.decode(buffer);
        if (!frame) break;
        buffer = buffer.slice(frame.totalSize);

        if (frame.type === FrameTypes.HELLO_ACK) {
          // Send PING frame
          const pingFrame = Frame.encode(FrameTypes.PING, 0, seq, Buffer.alloc(0));
          socket.write(pingFrame);
        } else if (frame.type === FrameTypes.PONG) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            const latencyMs = Date.now() - startTime;
            socket.destroy();
            resolve({ ok: true, latencyMs });
          }
        }
      }
    });

    socket.on('connect', () => {
      // Send HELLO frame
      const helloPayload = Serializer.encode({
        version: 'AL/1.1',
        capabilities: ['streaming', 'pubsub'],
      });
      const helloFrame = Frame.encode(FrameTypes.HELLO, 0, 0, helloPayload);
      socket.write(helloFrame);
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ ok: false, latencyMs: null });
      }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { pingCommand };
