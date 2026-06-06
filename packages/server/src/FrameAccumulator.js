const { Frame, errors: { MalformedPayloadError } } = require('@ajaymyth/core');

class FrameAccumulator {
  constructor(onFrame, options = {}) {
    this.buffer = Buffer.alloc(0);
    this.onFrame = onFrame;
    this.maxBufferSize = options.maxBufferSize || 64 * 1024 * 1024; // 64MB
  }

  push(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = Buffer.alloc(0);
      throw new MalformedPayloadError(`Accumulator buffer exceeded maximum size of ${this.maxBufferSize} bytes`);
    }

    while (this.buffer.length > 0) {
      const frame = Frame.decode(this.buffer);
      if (!frame) break;
      this.buffer = this.buffer.slice(frame.totalSize);
      this.onFrame(frame);
    }
  }

  reset() {
    this.buffer = Buffer.alloc(0);
  }

  getBufferLength() {
    return this.buffer.length;
  }
}

module.exports = FrameAccumulator;
