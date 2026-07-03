/**
 * rolling-restart.js handles zero-downtime restarts.
 * Sequentially terminates workers and spins up replacements when SIGUSR2 is received.
 */
function setupRollingRestart(cluster, config) {
  process.on('SIGUSR2', async () => {
    console.log('[AfterLink Cluster] Rolling restart (SIGUSR2) initiated...');
    
    const workers = Object.values(cluster.workers);
    const gracefulTimeout = config.gracefulTimeout || 10000;
    
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i];
      if (!worker) continue;
      
      console.log(`[AfterLink Cluster] Stopping worker ${worker.process.pid}...`);
      
      try {
        worker.send({ type: 'shutdown', timeout: gracefulTimeout });
        worker.disconnect();
      } catch (err) {
        // Channel may be dead
      }

      const exitPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try {
            worker.kill('SIGKILL');
          } catch (err) {}
          resolve();
        }, gracefulTimeout + 1000);
        
        worker.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      await exitPromise;
      
      const newWorker = cluster.fork();
      console.log(`[AfterLink Cluster] Spawned replacement worker ${newWorker.process.pid}`);
      
      await new Promise((resolve) => {
        newWorker.on('online', resolve);
        setTimeout(resolve, 1000); // Fallback
      });

      // 500ms stabilization gap
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    console.log('[AfterLink Cluster] Rolling restart complete.');
  });
}

module.exports = {
  setupRollingRestart
};
