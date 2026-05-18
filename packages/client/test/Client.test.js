import { describe, it, expect } from 'vitest';
import { Client } from '../src/index.js';

describe('Client', () => {
  it('exports Client class', () => {
    expect(Client).toBeDefined();
    expect(typeof Client).toBe('function');
  });

  it('creates client instance with tcp URL', () => {
    const client = new Client('tcp://localhost:4000');
    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
    expect(client.isTLS()).toBe(false);
  });

  it('creates client instance with afterlinks URL (TLS)', () => {
    const client = new Client('afterlinks://localhost:4443');
    expect(client).toBeDefined();
    expect(client.isTLS()).toBe(true);
  });

  it('creates client instance with compression options', () => {
    const client = new Client('tcp://localhost:4000', {
      compression: {
        enabled: true,
        algorithm: 'zlib',
        level: 6,
        threshold: 1024,
      },
    });
    expect(client).toBeDefined();
    expect(client._compression.enabled).toBe(false); // Not enabled until handshake
  });

  it('throws error when connecting to invalid host', async () => {
    const client = new Client('tcp://localhost:9999', {
      connectTimeout: 1000,
    });
    await expect(client.connect()).rejects.toThrow();
  });

  it('throws error when already connected', async () => {
    const client = new Client('tcp://localhost:9999');
    // Simulate connected state
    client._connected = true;
    await expect(client.connect()).rejects.toThrow('Already connected');
  });
});
