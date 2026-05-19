const os = require('os');

const isTTY = process.stdout.isTTY;

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

function color(str, name) {
  if (!isTTY) return str;
  return `${COLORS[name]}${str}${COLORS.reset}`;
}

function green(str) { return color(str, 'green'); }
function red(str) { return color(str, 'red'); }
function yellow(str) { return color(str, 'yellow'); }
function cyan(str) { return color(str, 'cyan'); }
function gray(str) { return color(str, 'gray'); }
function bold(str) { return color(str, 'bold'); }

function formatPingHeader(host, port, protocol) {
  return bold(cyan(`AfterLink PING ${host}:${port} (${protocol})`));
}

function formatPingResult(seq, latencyMs, ok) {
  const status = ok ? green('✓') : red('✗');
  const timeStr = latencyMs !== null ? `${latencyMs.toFixed(2)}ms` : 'timeout';
  return `  PONG  seq=${seq}  time=${timeStr}   ${status}`;
}

function formatPingStats(sent, received, latencies) {
  const loss = ((sent - received) / sent * 100).toFixed(0);
  const lines = [];
  lines.push('');
  lines.push(gray('─'.repeat(50)));
  lines.push(`  ${sent} packets transmitted, ${received} received, ${loss}% packet loss`);
  if (latencies.length > 0) {
    const min = Math.min(...latencies);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);
    lines.push(`  rtt min/avg/max = ${min.toFixed(2)} / ${avg.toFixed(2)} / ${max.toFixed(2)} ms`);
  }
  return lines.join('\n');
}

function formatCallHeader(route, host, payload) {
  const lines = [];
  lines.push('');
  lines.push(`  ${bold(cyan('→'))}  afterlink call ${host}:${route}`);
  lines.push('');
  lines.push(`   ${gray('Route')}    ${route}`);
  if (payload) {
    lines.push(`   ${gray('Payload')}  ${JSON.stringify(payload)}`);
  }
  return lines.join('\n');
}

function formatCallSuccess(data, latencyMs) {
  const lines = [];
  lines.push('');
  lines.push(`${green('✓')}  ${green('Response')}  (${latencyMs.toFixed(1)}ms)`);
  lines.push('');
  lines.push(prettyJson(data));
  return lines.join('\n');
}

function formatCallError(err, latencyMs) {
  const lines = [];
  lines.push('');
  lines.push(`${red('✗')}  ${red('Error Response')}  (${latencyMs.toFixed(1)}ms)`);
  lines.push('');
  if (err.code) {
    lines.push(`   ${gray('Code')}     ${err.code}`);
  }
  lines.push(`   ${gray('Message')}  ${err.message}`);
  if (err.details) {
    if (err.details.issues) {
      for (const issue of err.details.issues) {
        lines.push(`   ${gray('Field')}    ${issue.field} — ${issue.message}`);
      }
    } else {
      lines.push(`   ${gray('Details')}  ${JSON.stringify(err.details)}`);
    }
  }
  return lines.join('\n');
}

function formatTraceFrame(direction, type, seq, info) {
  const arrow = direction === 'sent' ? bold(cyan('→')) : bold(green('←'));
  return `  ${arrow}  ${bold(type.padEnd(16))} seq=${seq}  ${info}`;
}

function prettyJson(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function formatHealthStatus(data) {
  const lines = [];
  const statusColor = data.status === 'healthy' ? green : data.status === 'degraded' ? yellow : red;
  lines.push(bold(cyan('AfterLink Server Health')));
  lines.push('');
  lines.push(`  ${gray('Status')}       ${statusColor(data.status.toUpperCase())}`);
  lines.push(`  ${gray('Version')}     ${data.version}`);
  lines.push(`  ${gray('Protocol')}    ${data.protocol}`);
  lines.push(`  ${gray('Uptime')}      ${formatUptime(data.uptime)}`);
  lines.push('');
  lines.push(`  ${gray('Connections')}  ${data.connections?.active || 0} / ${data.connections?.max || '?'}`);
  lines.push(`  ${gray('Req/sec')}     ${data.requests?.perSecond || 0}`);
  lines.push(`  ${gray('Avg Latency')} ${data.requests?.avgLatencyMs || 0}ms`);
  lines.push(`  ${gray('Error Rate')}  ${data.requests?.errorRatePct || 0}%`);
  if (data.routes && data.routes.length > 0) {
    lines.push('');
    lines.push(gray('  Top Routes:'));
    for (const r of data.routes.slice(0, 5)) {
      lines.push(`    ${r.name.padEnd(20)} ${r.totalCalls} calls  avg ${r.avgLatencyMs}ms`);
    }
  }
  return lines.join('\n');
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

module.exports = {
  isTTY,
  COLORS,
  color,
  green,
  red,
  yellow,
  cyan,
  gray,
  bold,
  formatPingHeader,
  formatPingResult,
  formatPingStats,
  formatCallHeader,
  formatCallSuccess,
  formatCallError,
  formatTraceFrame,
  prettyJson,
  formatHealthStatus,
  formatUptime,
};
