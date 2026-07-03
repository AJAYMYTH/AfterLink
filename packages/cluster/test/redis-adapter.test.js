import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOn = vi.fn();
const mockPublish = vi.fn().mockResolvedValue(1);
const mockSubscribe = vi.fn().mockResolvedValue(null);
const mockPing = vi.fn().mockResolvedValue('PONG');
const mockQuit = vi.fn().mockResolvedValue(null);

class MockRedis {
  constructor() {
    this.status = 'ready';
    this.on = mockOn;
    this.publish = mockPublish;
    this.subscribe = mockSubscribe;
    this.ping = mockPing;
    this.quit = mockQuit;
  }
}
MockRedis.default = MockRedis;

// Hijack the Node require cache for ioredis
const ioredisPath = require.resolve('ioredis');
require.cache[ioredisPath] = {
  id: ioredisPath,
  filename: ioredisPath,
  loaded: true,
  exports: MockRedis
};

// Import after cache hijacking
const RedisAdapter = require('../src/redis-adapter');

describe('RedisAdapter', () => {
  let adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RedisAdapter({ host: 'mockhost', port: 6379 });
  });

  it('initializes redis connections', () => {
    expect(adapter.redisPub).toBeDefined();
    expect(adapter.redisSub).toBeDefined();
    expect(adapter.degraded).toBe(false);
  });

  it('triggers local broadcast on publish', async () => {
    const broadcastSpy = vi.fn();
    adapter.setLocalBroadcast(broadcastSpy);

    await adapter.publish('test-topic', { foo: 'bar' });

    expect(broadcastSpy).toHaveBeenCalledWith('test-topic', { foo: 'bar' });
    expect(mockPublish).toHaveBeenCalledWith(
      'afterlink:pubsub',
      expect.stringContaining('"topic":"test-topic"')
    );
  });

  it('ignores pubsub messages from same PID', () => {
    const broadcastSpy = vi.fn();
    adapter.setLocalBroadcast(broadcastSpy);

    const messageCall = mockOn.mock.calls.find(call => call[0] === 'message');
    expect(messageCall).toBeDefined();
    
    // Trigger message event handler
    messageCall[1]('afterlink:pubsub', JSON.stringify({
      topic: 'test-topic',
      data: { hello: 'world' },
      pid: process.pid
    }));

    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('triggers local broadcast for messages from other PID', () => {
    const broadcastSpy = vi.fn();
    adapter.setLocalBroadcast(broadcastSpy);

    const messageCall = mockOn.mock.calls.find(call => call[0] === 'message');
    const messageHandler = messageCall[1];

    messageHandler('afterlink:pubsub', JSON.stringify({
      topic: 'test-topic',
      data: { hello: 'world' },
      pid: 99999
    }));

    expect(broadcastSpy).toHaveBeenCalledWith('test-topic', { hello: 'world' });
  });

  it('marks adapter degraded on error', () => {
    const errorCall = mockOn.mock.calls.find(call => call[0] === 'error');
    expect(errorCall).toBeDefined();
    const errorHandler = errorCall[1];

    errorHandler(new Error('Connection lost'));
    expect(adapter.degraded).toBe(true);
  });
});
