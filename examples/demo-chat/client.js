/**
 * AfterLink Demo: Chat Client
 * 
 * Connects to the chat server, subscribes to messages,
 * and can send messages interactively.
 * 
 * Run: node client.js [--name YourName]
 */

const { Client } = require('@ajaymyth/client');
const readline = require('readline');

const name = process.argv.includes('--name')
  ? process.argv[process.argv.indexOf('--name') + 1]
  : 'User1';

async function main() {
  const client = new Client('afterlink://localhost:4000');

  await client.connect();
  console.log(`\n=== AfterLink Chat ===`);
  console.log(`Connected as: ${name}`);
  console.log(`Type a message and press Enter to send.`);
  console.log(`Type /history to see recent messages.`);
  console.log(`Type /stats to see server stats.`);
  console.log(`Type /quit to exit.\n`);

  // Subscribe to the chat topic for real-time messages
  await client.subscribe('chat', (msg) => {
    if (msg.from !== name) {
      console.log(`\n[${msg.from}] ${msg.text}  (${msg.timestamp.slice(11, 19)})`);
      process.stdout.write(`${name}> `);
    }
  });

  // Get and display chat history
  const { messages } = await client.request('getHistory', { limit: 10 });
  if (messages.length > 0) {
    console.log('--- Recent Messages ---');
    for (const msg of messages) {
      console.log(`[${msg.from}] ${msg.text}  (${msg.timestamp.slice(11, 19)})`);
    }
    console.log('--- End History ---\n');
  }

  // Interactive input
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write(`${name}> `);

  rl.on('line', async (line) => {
    const input = line.trim();

    if (input === '/quit') {
      rl.close();
      await client.disconnect();
      console.log('Disconnected.');
      process.exit(0);
    }

    if (input === '/history') {
      const { messages } = await client.request('getHistory', { limit: 10 });
      console.log('\n--- Recent Messages ---');
      for (const msg of messages) {
        console.log(`[${msg.from}] ${msg.text}  (${msg.timestamp.slice(11, 19)})`);
      }
      console.log('--- End History ---\n');
      process.stdout.write(`${name}> `);
      return;
    }

    if (input === '/stats') {
      const stats = await client.request('getStats', {});
      console.log(`\n  Total messages: ${stats.totalMessages}`);
      console.log(`  Active connections: ${stats.connections}\n`);
      process.stdout.write(`${name}> `);
      return;
    }

    if (input.length > 0) {
      await client.request('sendMessage', { text: input, from: name });
    }
    process.stdout.write(`${name}> `);
  });
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
