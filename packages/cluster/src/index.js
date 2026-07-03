const cluster = require('cluster');
const os = require('os');
const ClusterManager = require('./manager');

/**
 * Creates and starts a multi-process cluster for AfterLink servers.
 * If the process is primary, it initializes the ClusterManager to coordinate workers.
 * If the process is a worker, it runs the user-supplied workerFn.
 *
 * @param {Object} [config] Cluster configuration options
 * @param {Function} workerFn Function to run in worker processes (typically starting a Server)
 * @returns {ClusterManager|null} The ClusterManager instance if primary, otherwise null
 */
function createCluster(config = {}, workerFn) {
  if (typeof workerFn !== 'function') {
    throw new TypeError('workerFn must be a function');
  }

  const defaultConfig = {
    workers: os.cpus().length,
    restartOnCrash: true,
    restartDelay: 1000,
    gracefulTimeout: 10000,
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      tls: false,
      keyPrefix: 'afterlink:',
    }
  };

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    redis: {
      ...defaultConfig.redis,
      ...(config.redis || {})
    }
  };

  if (cluster.isPrimary || cluster.isMaster) {
    const manager = new ClusterManager(mergedConfig);
    manager.start();
    return manager;
  } else {
    workerFn();
    return null;
  }
}

module.exports = {
  createCluster,
  ClusterManager
};
