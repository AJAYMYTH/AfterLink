import { describe, it, expect, vi } from 'vitest';
import { GracefulShutdown, SERVER_CLOSING } from '../src/shutdown/graceful.js';

describe('GracefulShutdown', () => {
  it('SERVER_CLOSING frame type is 0x11', () => {
    expect(SERVER_CLOSING).toBe(0x11);
  });

  it('initiates shutdown and emits events', async () => {
    const mockServer = {
      connections: new Set(),
      _emit: vi.fn(),
    };

    const shutdown = new GracefulShutdown(mockServer, {
      drainTimeout: 100,
      reason: 'test',
      notifyClients: false,
    });

    await shutdown.initiate();

    expect(mockServer._emit).toHaveBeenCalledWith('closing', {
      activeConnections: 0,
      activeRequests: 0,
    });
    // With no active requests, drain completes immediately (timedOut: false)
    expect(mockServer._emit).toHaveBeenCalledWith('drained', { timedOut: false });
    // 'closed' is emitted by Server.close(), not GracefulShutdown
    expect(mockServer._emit).toHaveBeenCalledTimes(2);
  });

  it('broadcasts SERVER_CLOSING to connections', async () => {
    const mockConn = {
      send: vi.fn(),
      destroy: vi.fn(),
    };

    const mockServer = {
      connections: new Set([mockConn]),
      _emit: vi.fn(),
    };

    const shutdown = new GracefulShutdown(mockServer, {
      drainTimeout: 100,
      reason: 'test',
      notifyClients: true,
    });

    await shutdown.initiate();

    expect(mockConn.send).toHaveBeenCalledWith(0x11, 0, 0, expect.any(Buffer));
  });
});
