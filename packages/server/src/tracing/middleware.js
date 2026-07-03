/**
 * Middleware factory for injecting OpenTelemetry tracing spans around route requests.
 *
 * @param {TracingManager} tracingManager The active TracingManager instance
 * @returns {Function} AfterLink middleware function
 */
function createTracingMiddleware(tracingManager) {
  return function tracingMiddleware(req, next) {
    if (!tracingManager || !tracingManager.config.enabled) {
      return next();
    }

    const route = req.route || 'unknown';
    const connection = req.connection;
    
    // Attempt to extract session details
    const sessionId = connection && connection.session ? connection.session.id : undefined;
    const isTLS = connection && connection.tlsInfo;

    const rootSpan = tracingManager.startSpan(`afterlink.request ${route}`, {
      route,
      session_id: sessionId,
      transport: isTLS ? 'tls' : 'tcp'
    }, 'SERVER');

    return tracingManager.runWithSpan(rootSpan, async () => {
      const handlerSpan = tracingManager.startSpan(`afterlink.handler ${route}`, {}, 'INTERNAL');
      
      try {
        await tracingManager.runWithSpan(handlerSpan, async () => {
          await next();
        });
        handlerSpan.setStatus('OK');
        rootSpan.setStatus('OK');
      } catch (err) {
        handlerSpan.setStatus('ERROR');
        handlerSpan.setAttribute('error.message', err.message);
        handlerSpan.setAttribute('error.code', err.code || 'INTERNAL_ERROR');
        
        rootSpan.setStatus('ERROR');
        rootSpan.setAttribute('error.message', err.message);
        rootSpan.setAttribute('error.code', err.code || 'INTERNAL_ERROR');
        throw err;
      } finally {
        handlerSpan.end();
        rootSpan.end();
      }
    });
  };
}

module.exports = { createTracingMiddleware };
