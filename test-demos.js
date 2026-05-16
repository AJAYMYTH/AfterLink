const { spawn } = require('child_process');
const path = require('path');

const NODE = process.execPath;

function runDemo(demoDir, options = {}) {
  const { clientDelay = 2000, clientArgs = [], clientTimeout = 15000 } = options;
  return new Promise((resolve, reject) => {
    const demoPath = path.join(__dirname, 'examples', demoDir);

    console.log(`\n${'='.repeat(50)}`);
    console.log(` Testing: ${demoDir}`);
    console.log(`${'='.repeat(50)}\n`);

    const server = spawn(NODE, ['server.js'], {
      cwd: demoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let serverReady = false;

    server.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      if (text.includes('listening') || text.includes('running')) {
        serverReady = true;
      }
    });

    server.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    server.on('error', (err) => {
      reject(new Error(`Server spawn error: ${err.message}`));
    });

    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error(`Server did not start for ${demoDir}`));
        return;
      }

      const client = spawn(NODE, ['client.js', ...clientArgs], {
        cwd: demoPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      client.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      client.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      client.on('close', (code) => {
        server.kill();
        if (code === 0 || code === null) {
          resolve(true);
        } else {
          reject(new Error(`Client exited with code ${code}`));
        }
      });

      setTimeout(() => {
        client.kill();
        server.kill();
        reject(new Error(`Client timed out for ${demoDir}`));
      }, clientTimeout);
    }, clientDelay);
  });
}

async function main() {
  const demos = [
    { dir: 'demo-microservice', delay: 1500 },
    { dir: 'demo-dashboard', delay: 2000, clientArgs: ['--duration=8000'], timeout: 20000 },
  ];

  let passed = 0;
  let failed = 0;

  for (const demo of demos) {
    try {
      await runDemo(demo.dir, { clientDelay: demo.delay, clientArgs: demo.clientArgs || [], clientTimeout: demo.timeout || 15000 });
      console.log(`\n[OK] ${demo.dir} passed`);
      passed++;
    } catch (err) {
      console.error(`\n[FAIL] ${demo.dir}: ${err.message}`);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
