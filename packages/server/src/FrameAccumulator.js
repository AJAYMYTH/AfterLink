const { Frame } = require('@afterlink/core');

class FrameAccumulator {
  constructor(onFrame) {
    this.buffer = Buffer.alloc(0);
    this.onFrame = onFrame;
  }

  push(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (true) {
      const frame = Frame.decode(this.buffer);
      if (!frame) break;
      this.buffer = this.buffer.slice(frame.totalSize);
      this.onFrame(frame);
    }
  }

  getBufferLength() {
    return this.buffer.length;
  }
}

module.exports = FrameAccumulator;
