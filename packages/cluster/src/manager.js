const cluster = require('cluster');
const EventEmitter = require('events');
const { setupRollingRestart } = require('./rolling-restart');

/**
 * ClusterManager class responsible for primary process operations,
 * worker lifecycle monitoring, and IPC metrics aggregation.
 */
class ClusterManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.workers = new Map();
    this.workerStats = new Map();
    this.isShuttingDown = false;
  }

  /**
   * Starts monitoring exit events and spawns worker processes.
   */
  start() {
    console.log(`[AfterLink Cluster] Starting primary process ${process.pid}`);
    console.log(`[AfterLink Cluster] Spawning ${this.config.workers} worker processes...`);

    for (let i = 0; i < this.config.workers; i++) {
      this.forkWorker();
    }

    cluster.on('exit', (worker, code, signal) => {
      const pid = worker.process.pid;
      this.workers.delete(pid);
      this.workerStats.delete(pid);

      if (this.isShuttingDown) return;

      console.warn(`[AfterLink Cluster] Worker ${pid} exited with code ${code} (signal: ${signal})`);

      if (this.config.restartOnCrash) {
        console.log(`[AfterLink Cluster] Restarting crashed worker in ${this.config.restartDelay}ms...`);
        setTimeout(() => {
          if (this.isShuttingDown) return;
          this.forkWorker();
        }, this.config.restartDelay);
      }
    });

    setupRollingRestart(cluster, this.config);
  }

  /**
   * Forks a new worker and hooks up message handler for stats gathering.
   */
  forkWorker() {
    const worker = cluster.fork();
    const pid = worker.process.pid;
    this.workers.set(pid, worker);
    console.log(`[AfterLink Cluster] Worker ${pid} online`);

    worker.on('message', (msg) => {
      if (msg && msg.type === 'stats') {
        this.workerStats.set(pid, msg.data);
      }
    });

    return worker;
  }

  /**
   * Combines/aggregates metrics reported by individual worker processes.
   *
   * @returns {Object} Aggregated cluster statistics
   */
  getAggregatedStats() {
    let connections = 0;
    let totalRequests = 0;
    let requestsPerSec = 0;
    let avgLatencyMsSum = 0;
    let errorRateSum = 0;
    const routeStatsMap = new Map();

    const statsArray = Array.from(this.workerStats.values());
    const count = statsArray.length;

    for (const stats of statsArray) {
      connections += stats.connections || 0;
      totalRequests += stats.totalRequests || 0;
      requestsPerSec += stats.requestsPerSec || 0;
      avgLatencyMsSum += stats.avgLatencyMs || 0;
      errorRateSum += stats.errorRate || 0;

      if (stats.routes) {
        for (const route of stats.routes) {
          if (!routeStatsMap.has(route.name)) {
            routeStatsMap.set(route.name, { totalCalls: 0, latencySum: 0, errorCount: 0 });
          }
          const current = routeStatsMap.get(route.name);
          current.totalCalls += route.totalCalls || 0;
          current.latencySum += (route.avgLatencyMs || 0) * (route.totalCalls || 0);
          current.errorCount += (route.errorRate || 0) * (route.totalCalls || 0);
        }
      }
    }

    const routes = [];
    for (const [name, data] of routeStatsMap.entries()) {
      routes.push({
        name,
        totalCalls: data.totalCalls,
        avgLatencyMs: data.totalCalls > 0 ? parseFloat((data.latencySum / data.totalCalls).toFixed(2)) : 0,
        errorRate: data.totalCalls > 0 ? parseFloat((data.errorCount / data.totalCalls).toFixed(4)) : 0,
      });
    }

    return {
      workers: count,
      connections,
      totalRequests,
      requestsPerSec: parseFloat(requestsPerSec.toFixed(2)),
      avgLatencyMs: count > 0 ? parseFloat((avgLatencyMsSum / count).toFixed(2)) : 0,
      errorRate: count > 0 ? parseFloat((errorRateSum / count).toFixed(4)) : 0,
      routes
    };
  }

  /**
   * Shuts down the cluster by notifying all workers.
   */
  shutdown() {
    this.isShuttingDown = true;
    console.log('[AfterLink Cluster] Shutting down cluster...');
    for (const worker of this.workers.values()) {
      try {
        worker.send({ type: 'shutdown', timeout: this.config.gracefulTimeout });
      } catch (err) {
        // Channel may already be closed
      }
    }
  }
}

module.exports = ClusterManager;
