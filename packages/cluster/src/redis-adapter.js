const Redis = require('ioredis');

/**
 * RedisAdapter bridges cluster-wide Pub/Sub using ioredis.
 * If Redis is disconnected, it falls back to worker-local pub/sub cleanly.
 */
class RedisAdapter {
  constructor(config = {}) {
    const redisConfig = {
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      tls: config.tls ? {} : undefined,
      ...config
    };

    this.keyPrefix = config.keyPrefix || 'afterlink:';
    this.channelName = `${this.keyPrefix}pubsub`;
    this.localBroadcast = () => {};
    this.degraded = false;
    this.redisPub = null;
    this.redisSub = null;
    
    this.init(redisConfig);
  }

  /**
   * Initializes pub and sub connections to Redis.
   */
  init(redisConfig) {
    try {
      this.redisPub = new Redis(redisConfig);
      this.redisSub = new Redis(redisConfig);

      const handleError = (err) => {
        if (!this.degraded) {
          console.warn(`[AfterLink Cluster] Redis connection failed, falling back to local-only pub/sub: ${err.message}`);
          this.degraded = true;
        }
      };

      this.redisPub.on('error', handleError);
      this.redisSub.on('error', handleError);

      this.redisPub.on('connect', () => {
        this.degraded = false;
      });

      this.redisSub.on('connect', () => {
        this.redisSub.subscribe(this.channelName).catch(handleError);
      });

      this.redisSub.on('message', (channel, message) => {
        if (channel !== this.channelName) return;

        try {
          const parsed = JSON.parse(message);
          if (parsed && parsed.pid !== process.pid) {
            this.localBroadcast(parsed.topic, parsed.data);
          }
        } catch (err) {
          console.error('[AfterLink Cluster] Failed to parse Redis pubsub message:', err.message);
        }
      });
    } catch (err) {
      console.warn(`[AfterLink Cluster] Redis initialization failed, falling back to local-only pub/sub: ${err.message}`);
      this.degraded = true;
    }
  }

  /**
   * Registers local broadcaster callback.
   */
  setLocalBroadcast(fn) {
    if (typeof fn === 'function') {
      this.localBroadcast = fn;
    }
  }

  /**
   * Publishes message globally across cluster.
   */
  async publish(topic, data) {
    // Always trigger locally
    this.localBroadcast(topic, data);

    if (!this.degraded && this.redisPub && this.redisPub.status === 'ready') {
      try {
        const payload = JSON.stringify({
          topic,
          data,
          pid: process.pid
        });
        await this.redisPub.publish(this.channelName, payload);
      } catch (err) {
        console.warn('[AfterLink Cluster] Redis publish failed, falling back to local broadcast:', err.message);
      }
    }
  }

  /**
   * Returns current active state of the Redis connections.
   */
  isConnected() {
    return !this.degraded && 
           this.redisPub && this.redisPub.status === 'ready' &&
           this.redisSub && this.redisSub.status === 'ready';
  }

  /**
   * Pings redis and returns round-trip latency.
   */
  async getLatency() {
    if (!this.isConnected()) return -1;
    const start = Date.now();
    try {
      await this.redisPub.ping();
      return Date.now() - start;
    } catch (err) {
      return -1;
    }
  }

  /**
   * Closes Redis client connections.
   */
  async close() {
    const promises = [];
    if (this.redisPub) promises.push(this.redisPub.quit().catch(() => {}));
    if (this.redisSub) promises.push(this.redisSub.quit().catch(() => {}));
    await Promise.all(promises);
  }
}

module.exports = RedisAdapter;
