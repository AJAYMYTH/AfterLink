import { describe, it, expect } from 'vitest';
import Frame from '../src/Frame.js';
import { REQUEST, RESPONSE, HELLO, HELLO_ACK, ERROR, PING, PONG } from '../src/FrameTypes.js';

describe('Frame', () => {
  it('encodes and decodes a REQUEST frame', () => {
    const payload = Buffer.from('{"route":"hello"}');
    const encoded = Frame.encode(REQUEST, 0, 1, payload);
    const decoded = Frame.decode(encoded);

    expect(decoded.type).toBe(REQUEST);
    expect(decoded.messageId).toBe(1);
    expect(decoded.payload.toString()).toBe('{"route":"hello"}');
  });

  it('encodes and decodes a RESPONSE frame', () => {
    const payload = Buffer.from('{"status":"ok","body":{"result":42}}');
    const encoded = Frame.encode(RESPONSE, 0, 42, payload);
    const decoded = Frame.decode(encoded);

    expect(decoded.type).toBe(RESPONSE);
    expect(decoded.messageId).toBe(42);
    expect(decoded.payload.toString()).toBe('{"status":"ok","body":{"result":42}}');
  });

  it('handles zero-length payload', () => {
    const payload = Buffer.alloc(0);
    const encoded = Frame.encode(PING, 0, 1, payload);
    const decoded = Frame.decode(encoded);

    expect(decoded.type).toBe(PING);
    expect(decoded.payload.length).toBe(0);
  });

  it('returns null for incomplete buffer', () => {
    const incomplete = Buffer.from([0x01, 0x00]);
    expect(Frame.decode(incomplete)).toBeNull();
  });

  it('returns null when payload is incomplete', () => {
    const payload = Buffer.from('partial data');
    const encoded = Frame.encode(REQUEST, 0, 1, payload);
    const truncated = encoded.slice(0, encoded.length - 5);
    expect(Frame.decode(truncated)).toBeNull();
  });

  it('handles large message IDs', () => {
    const payload = Buffer.from('test');
    const largeId = 4294967295;
    const encoded = Frame.encode(REQUEST, 0, largeId, payload);
    const decoded = Frame.decode(encoded);

    expect(decoded.messageId).toBe(largeId);
  });

  it('handles flags correctly', () => {
    const payload = Buffer.from('compressed data');
    const flags = 0b10000000;
    const encoded = Frame.encode(REQUEST, flags, 1, payload);
    const decoded = Frame.decode(encoded);

    expect(decoded.flags).toBe(flags);
  });

  it('header size is 10 bytes', () => {
    expect(Frame.headerSize()).toBe(10);
  });

  it('encodes all frame types correctly', () => {
    const types = [REQUEST, RESPONSE, HELLO, HELLO_ACK, ERROR, PING, PONG];
    for (const type of types) {
      const payload = Buffer.from('test');
      const encoded = Frame.encode(type, 0, 1, payload);
      const decoded = Frame.decode(encoded);
      expect(decoded.type).toBe(type);
    }
  });
});
