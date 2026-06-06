/**
 * AfterLink Demo: Stock Dashboard Client
 * 
 * Connects to the stock server and displays real-time price updates
 * in a terminal dashboard format.
 * 
 * Run: node client.js
 */

const { Client } = require('@ajaymyth/client');

const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
const prices = {};

function renderDashboard() {
  const lines = [
    '\n' + '='.repeat(60),
    '  AfterLink Real-Time Stock Dashboard',
    '='.repeat(60),
    `  ${'Symbol'.padEnd(8)} ${'Price'.padStart(10)} ${'Change'.padStart(10)} ${'Status'.padStart(12)}`,
    '  ' + '-'.repeat(52),
  ];

  for (const sym of symbols) {
    const data = prices[sym] || { price: '---', change: 0 };
    const changeStr = data.change >= 0 ? `+${data.change.toFixed(2)}` : data.change.toFixed(2);
    const status = Math.abs(data.change) > 0.5 ? (data.change > 0 ? '  UP  ' : ' DOWN ') : '  --  ';
    lines.push(`  ${sym.padEnd(8)} $${data.price.toFixed(2).padStart(9)} ${changeStr.padStart(10)} ${status}`);
  }

  lines.push('='.repeat(60));
  lines.push('  [Live updates via AfterLink Pub/Sub]');
  lines.push('  Press Ctrl+C to exit\n');

  // Clear screen and render
  process.stdout.write('\x1Bc');
  console.log(lines.join('\n'));
}

async function main() {
  const client = new Client('afterlink://localhost:4001');

  await client.connect();
  console.log('Connecting to stock server...');

  // Get initial prices
  const { stocks } = await client.request('getPrices', {});
  for (const [sym, data] of Object.entries(stocks)) {
    prices[sym] = data;
  }
  renderDashboard();

  // Subscribe to all stock topics
  for (const sym of symbols) {
    await client.subscribe(`stocks.${sym}`, (data) => {
      prices[data.symbol] = data;
      renderDashboard();
    });
  }

  // Subscribe to alerts
  await client.subscribe('alerts', (alert) => {
    const emoji = alert.alert === 'HIGH_VOLATILITY' ? '!!' : '! ';
    console.log(`\n  [ALERT ${emoji}] ${alert.symbol}: $${alert.price.toFixed(2)} (${alert.change > 0 ? '+' : ''}${alert.change.toFixed(2)}) - ${alert.alert}`);
    console.log('  Press any key to continue...');
  });

  // Keep alive
  const durationArg = process.argv.find((a) => a.startsWith('--duration='));
  if (durationArg) {
    const durationMs = parseInt(durationArg.split('=')[1], 10);
    setTimeout(async () => {
      await client.disconnect();
      console.log('\nDemo duration complete.');
      process.exit(0);
    }, durationMs);
  }

  process.on('SIGINT', async () => {
    await client.disconnect();
    console.log('\nDisconnected.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
