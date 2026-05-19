const { Command } = require('commander');
const http = require('http');
const { mergeWithProfile } = require('../config/rc');
const { formatHealthStatus, formatUptime } = require('../output/formatter');

const monitorCommand = new Command('monitor')
  .description('Live real-time terminal dashboard showing server statistics')
  .argument('<host:port>', 'Server address (e.g. localhost:4000)')
  .option('--tls', 'Use TLS')
  .option('--auth <token>', 'Auth token')
  .option('--refresh <ms>', 'Dashboard refresh rate (ms)', '1000')
  .option('--no-requests', 'Hide live request stream')
  .option('--filter <route>', 'Only show specific route')
  .option('-j, --json', 'Stream stats as NDJSON')
  .option('--profile <name>', 'Connection profile from ~/.afterlinkrc')
  .action(async (hostPort, options) => {
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr, 10) || 4000;
    const profile = mergeWithProfile({ host, port, tls: options.tls, auth: options.auth }, options.profile);
    const refreshMs = parseInt(options.refresh, 10);
    const asJson = options.json;

    const healthPort = port;
    const healthPath = '/__health';
    const protocol = profile.tls ? 'https:' : 'http:';

    if (asJson) {
      // NDJSON streaming mode
      setInterval(() => {
        fetchHealth(protocol, profile.host, healthPort, healthPath, profile.auth)
          .then((data) => {
            process.stdout.write(JSON.stringify(data) + '\n');
          })
          .catch((err) => {
            process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
          });
      }, refreshMs);
      return;
    }

    // Terminal dashboard mode
    process.stdout.write('\x1b[?25l'); // Hide cursor
    process.on('exit', () => process.stdout.write('\x1b[?25h')); // Show cursor on exit

    let lastStats = null;
    let requestLog = [];

    setInterval(async () => {
      try {
        const data = await fetchHealth(protocol, profile.host, healthPort, healthPath, profile.auth);
        lastStats = data;

        if (options.filter && data.routes) {
          data.routes = data.routes.filter((r) => r.name.includes(options.filter));
        }

        renderDashboard(data, profile, requestLog, options.requests !== false);
      } catch (err) {
        renderError(err.message, profile);
      }
    }, refreshMs);

    // Handle quit
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
      if (key.toString() === 'q' || key.toString() === '\u0003') {
        process.stdout.write('\x1b[?25h');
        process.exit(0);
      }
    });
  });

function fetchHealth(protocol, host, port, path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      protocol,
      hostname: host,
      port,
      path,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 3000,
    };
    if (token) {
      opts.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = (protocol === 'https:' ? require('https') : http).get(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid health response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Health check timed out')); });
  });
}

function renderDashboard(data, profile, requestLog, showRequests) {
  const lines = [];
  const width = Math.min(process.stdout.columns || 80, 100);
  const separator = '═'.repeat(width);
  const thinSep = '─'.repeat(width);

  lines.push(`\x1b[H\x1b[J`); // Clear screen and move cursor to top
  lines.push(`╔${separator}╗`);
  lines.push(`║  AfterLink Monitor  ·  ${profile.host}:${profile.port}  ·  AF/1.1  ·  ↻ ${data._lastRefresh || '—'}     ║`);
  lines.push(`╠${'═'.repeat(20)}╦${'═'.repeat(20)}╦${'═'.repeat(20)}╦${'═'.repeat(Math.max(18, width - 62))}╣`);

  const conn = data.connections?.active || 0;
  const rps = data.requests?.perSecond || 0;
  const latency = data.requests?.avgLatencyMs || 0;
  const errRate = data.requests?.errorRatePct || 0;

  lines.push(`║  Connections       ║  Requests/sec      ║  Avg Latency       ║  Errors            ║`);
  lines.push(`║  ${String(conn).padEnd(18)}║  ${String(rps).padEnd(18)}║  ${String(latency).padEnd(16)}ms║  ${String(errRate).padEnd(16)}%   ║`);
  lines.push(`╠${separator}╣`);

  const uptime = data.uptime ? formatUptime(data.uptime) : '—';
  const totalReqs = data.requests?.total || 0;
  lines.push(`║  Uptime: ${uptime.padEnd(width - 18)}║`);
  lines.push(`║  Total Requests: ${String(totalReqs).padEnd(width - 24)}║`);

  if (showRequests && data.routes && data.routes.length > 0) {
    lines.push(`╠${separator}╣`);
    lines.push(`║  Live Request Stream`);
    lines.push(`║`);

    for (const r of data.routes.slice(0, 8)) {
      const status = r.errorRate > 0.05 ? 'ERR' : 'OK';
      const statusColor = status === 'OK' ? '✓' : '✗';
      lines.push(`║  ${new Date().toLocaleTimeString()}  ${r.name.padEnd(18)} ${status}  ${r.avgLatencyMs}ms`);
    }
  }

  if (data.routes && data.routes.length > 0) {
    lines.push(`╠${separator}╣`);
    lines.push(`║  Top Routes (last 60s)`);
    const maxCalls = Math.max(...data.routes.map((r) => r.totalCalls), 1);
    const barWidth = Math.max(10, width - 50);

    for (const r of data.routes.slice(0, 5)) {
      const barLen = Math.round((r.totalCalls / maxCalls) * barWidth);
      const bar = '█'.repeat(barLen);
      lines.push(`║  ${r.name.padEnd(18)} ${String(r.totalCalls).padStart(8)}  ${bar}  avg ${r.avgLatencyMs}ms`);
    }
  }

  lines.push(`╚${separator}╝`);
  lines.push(`  [q] quit  [Ctrl+C] exit`);
  lines.push('');

  process.stdout.write(lines.join('\n'));
}

function renderError(message, profile) {
  process.stdout.write(`\x1b[H\x1b[J`);
  process.stdout.write(`\n  Error connecting to ${profile.host}:${profile.port}\n`);
  process.stdout.write(`  ${message}\n\n`);
  process.stdout.write(`  Retrying...\n`);
}

module.exports = { monitorCommand };
