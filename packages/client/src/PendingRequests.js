class PendingRequests {
  constructor(timeoutMs = 30000) {
    this.map = new Map();
    this.timeoutMs = timeoutMs;
  }

  add(id, resolve, reject) {
    const timeout = setTimeout(() => {
      this.map.delete(id);
      reject(new Error(`Request ${id} timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);
    this.map.set(id, { resolve, reject, timeout });
  }

  resolve(id, payload) {
    const pending = this.map.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.map.delete(id);
    pending.resolve(payload);
  }

  reject(id, error) {
    const pending = this.map.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.map.delete(id);
    pending.reject(error);
  }

  clear() {
    for (const { timeout } of this.map.values()) {
      clearTimeout(timeout);
    }
    this.map.clear();
  }

  size() {
    return this.map.size;
  }
}

module.exports = PendingRequests;
