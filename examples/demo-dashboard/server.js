/**
 * AfterLink Demo: Real-time Stock Price Dashboard
 * 
 * This demonstrates:
 * - Server-side data generation and periodic publishing
 * - Pub/Sub for real-time price updates
 * - Multiple topics (stocks, alerts)
 * - Request/Response for current price snapshot
 * 
 * Run: node server.js
 */

const { Server } = require('@ajaymyth/server');

const server = new Server({ port: 4001 });

// Simulated stock prices
const stocks = {
  AAPL: { price: 178.50, change: 0 },
  GOOGL: { price: 141.20, change: 0 },
  MSFT: { price: 378.90, change: 0 },
  TSLA: { price: 245.30, change: 0 },
  AMZN: { price: 185.60, change: 0 },
};

// Route: Get current prices snapshot
server.on('getPrices', async (req, res) => {
  res.send({ stocks: { ...stocks } });
});

// Route: Subscribe to a specific stock
server.on('watchStock', async (req, res) => {
  const { symbol } = req.body;
  if (stocks[symbol]) {
    res.send({ symbol, currentPrice: stocks[symbol].price });
  } else {
    res.send({ error: 'Unknown symbol' });
  }
});

// Simulate price changes every second
setInterval(() => {
  for (const [symbol, stock] of Object.entries(stocks)) {
    const change = (Math.random() - 0.5) * 2;
    stock.price = Math.round((stock.price + change) * 100) / 100;
    stock.change = Math.round(change * 100) / 100;

    // Publish individual stock update
    server.publish(`stocks.${symbol}`, { symbol, price: stock.price, change: stock.change });

    // Check for significant moves (>1% change)
    const pctChange = Math.abs(stock.change / stock.price) * 100;
    if (pctChange > 0.5) {
      server.publish('alerts', {
        symbol,
        price: stock.price,
        change: stock.change,
        alert: pctChange > 1 ? 'HIGH_VOLATILITY' : 'NOTICE',
      });
    }
  }
}, 1000);

server.listen().then(() => {
  console.log('Stock Dashboard server running on port 4001');
  console.log('Concepts demonstrated:');
  console.log('  - Periodic data publishing (setInterval + server.publish)');
  console.log('  - Multiple topics (stocks.AAPL, stocks.GOOGL, alerts)');
  console.log('  - Conditional broadcasting (alert thresholds)');
  console.log('  - Request/Response for snapshot data');
});
