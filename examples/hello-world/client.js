const { Client } = require('@afterlink/client');

async function main() {
  const client = new Client('afterlink://localhost:4000');

  try {
    await client.connect();
    console.log('Connected to AfterLink server');

    const pingResult = await client.request('ping', {});
    console.log('Ping result:', pingResult);

    const helloResult = await client.request('hello', { name: 'AfterLink' });
    console.log('Hello result:', helloResult);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.disconnect();
    console.log('Disconnected');
  }
}

main();
