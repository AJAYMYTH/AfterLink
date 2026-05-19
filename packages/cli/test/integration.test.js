import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'child_process';
import path from 'path';
import { Server } from '@afterlink/server';

const CLI_PATH = path.join(__dirname, '..', 'bin', 'afterlink.js');

let server;
let serverPort = 4099;

beforeAll(async () => {
  server = new Server({
    port: serverPort,
    health: { enabled: true },
  });

  server.on('ping', async (req, res) => {
    res.send({ pong: true, timestamp: Date.now() });
  });

  server.on('echo', async (req, res) => {
    res.send({ echoed: req.body });
  });

  server.on('error_route', async (req, res) => {
    throw new Error('Handler crashed');
  });

  await server.listen();
});

afterAll(async () => {
  if (server) {
    await server.close({ force: true });
  }
});

function runCli(args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = execFile('node', [CLI_PATH, ...args], {
      timeout: 10000,
      ...options,
    }, (err, stdout, stderr) => {
      resolve({ exitCode: err ? err.code : 0, stdout, stderr: stderr || '' });
    });
  });
}

describe('CLI Integration Tests', () => {
  describe('ping command', () => {
    it('pings a running server and returns success', async () => {
      const { exitCode, stdout } = await runCli(['ping', `localhost:${serverPort}`, '-n', '2', '-i', '100']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('AfterLink PING');
      expect(stdout).toContain('PONG');
      expect(stdout).toContain('packets transmitted');
    });

    it('outputs JSON with --json flag', async () => {
      const { exitCode, stdout } = await runCli(['ping', `localhost:${serverPort}`, '-n', '1', '--json']);
      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data.sent).toBe(1);
      expect(data.received).toBe(1);
      expect(data.protocol).toBe('AF/1.1');
      expect(data.results).toHaveLength(1);
      expect(data.results[0].status).toBe('ok');
    });

    it('returns exit code 2 for unreachable server', async () => {
      const { exitCode } = await runCli(['ping', 'localhost:59999', '-n', '1', '-t', '500']);
      expect(exitCode).toBe(2);
    });
  });

  describe('call command', () => {
    it('calls a route and gets response', async () => {
      const { exitCode, stdout } = await runCli(['call', `localhost:${serverPort}`, 'ping', '{}']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Response');
      expect(stdout).toContain('pong');
    });

    it('sends payload and receives echoed data', async () => {
      const { exitCode, stdout } = await runCli(['call', `localhost:${serverPort}`, 'echo', '{"hello":"world"}']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('echoed');
      expect(stdout).toContain('world');
    });

    it('outputs JSON with --json flag', async () => {
      const { exitCode, stdout } = await runCli(['call', `localhost:${serverPort}`, 'ping', '{}', '--json']);
      expect(exitCode).toBe(0);
      const data = JSON.parse(stdout);
      expect(data.status).toBe('ok');
      expect(data.data.pong).toBe(true);
    });

    it('handles route not found', async () => {
      const { exitCode, stdout } = await runCli(['call', `localhost:${serverPort}`, 'nonexistent']);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Error Response');
      expect(stdout).toContain('ROUTE_NOT_FOUND');
    });

    it('handles handler errors', async () => {
      const { exitCode, stdout } = await runCli(['call', `localhost:${serverPort}`, 'error_route']);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Error Response');
    });
  });
});
