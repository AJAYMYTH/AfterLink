import { describe, it, expect } from 'vitest';
import Frame from '../src/Frame.js';
import FrameV1 from '../src/protocol/frame-v1.js';
import FrameV2 from '../src/protocol/frame-v2.js';
import { REQUEST, FLAGS } from '../src/FrameTypes.js';
import fs from 'fs';
import path from 'path';

describe('FrameV2 and Wrapper', () => {
  it('encodes and decodes a simple V2 frame', () => {
    const payload = Buffer.from('hello');
    const encoded = FrameV2.encode(REQUEST, 0, 1, payload);
    const decoded = FrameV2.decode(encoded);

    expect(decoded.type).toBe(REQUEST);
    expect(decoded.flags).toBe(0);
    expect(decoded.version).toBe(2);
    expect(decoded.priority).toBe(3);
    expect(decoded.messageId).toBe(1);
    expect(decoded.routingKey).toBe('');
    expect(decoded.payload.toString()).toBe('hello');
  });

  it('sets routing key and priority correctly', () => {
    const payload = Buffer.from('hello');
    const encoded = FrameV2.encode(REQUEST, 0, 42, payload, {
      priority: 5,
      routingKey: 'my-route'
    });
    const decoded = FrameV2.decode(encoded);

    expect(decoded.type).toBe(REQUEST);
    expect(decoded.flags).toBe(FLAGS.PRIORITY_SET | FLAGS.HAS_ROUTING_KEY); // 0x0c
    expect(decoded.version).toBe(2);
    expect(decoded.priority).toBe(5);
    expect(decoded.messageId).toBe(42);
    expect(decoded.routingKey).toBe('my-route');
    expect(decoded.payload.toString()).toBe('hello');
  });

  it('rejects invalid priorities', () => {
    const payload = Buffer.from('hello');
    expect(() => FrameV2.encode(REQUEST, 0, 1, payload, { priority: -1 })).toThrow(RangeError);
    expect(() => FrameV2.encode(REQUEST, 0, 1, payload, { priority: 8 })).toThrow(RangeError);
  });

  it('rejects routing key > 255 bytes', () => {
    const payload = Buffer.from('hello');
    const longKey = 'a'.repeat(256);
    expect(() => FrameV2.encode(REQUEST, 0, 1, payload, { routingKey: longKey })).toThrow(RangeError);
  });

  it('handles maximum length routing key of 255 bytes', () => {
    const payload = Buffer.from('hello');
    const maxKey = 'a'.repeat(255);
    const encoded = FrameV2.encode(REQUEST, 0, 1, payload, { routingKey: maxKey });
    const decoded = FrameV2.decode(encoded);
    expect(decoded.routingKey).toBe(maxKey);
    expect(decoded.flags).toBe(FLAGS.HAS_ROUTING_KEY); // priority 3 is default, so not priority_set
  });

  it('auto-selects version in Frame wrapper', () => {
    const payload = Buffer.from('hello');
    
    // Default version is V1
    const enc1 = Frame.encode(REQUEST, 0, 1, payload);
    expect(enc1.length).toBe(10 + 5);
    
    // Explicit V2 version options
    const enc2 = Frame.encode(REQUEST, 0, 1, payload, { version: 2 });
    expect(enc2.length).toBe(16 + 5);
    
    // Implicit V2 via routingKey
    const enc3 = Frame.encode(REQUEST, 0, 1, payload, { routingKey: 'route' });
    expect(enc3.length).toBe(16 + 5 + 5); // 16 header + 5 routing key + 5 payload
    
    // Implicit V2 via priority
    const enc4 = Frame.encode(REQUEST, 0, 1, payload, { priority: 4 });
    expect(enc4.length).toBe(16 + 5);
  });

  it('auto-decodes V1 and V2 frames', () => {
    const payload = Buffer.from('hello');
    const encV1 = FrameV1.encode(REQUEST, 0, 1, payload);
    const encV2 = FrameV2.encode(REQUEST, 0, 1, payload);

    const dec1 = Frame.decodeAuto(encV1);
    expect(dec1.version).toBeUndefined(); // V1 decoded frame has no version
    expect(dec1.messageId).toBe(1);

    const dec2 = Frame.decodeAuto(encV2);
    expect(dec2.version).toBe(2);
    expect(dec2.messageId).toBe(1);
  });

  it('validates test vectors from protocol-vectors.json', () => {
    const vectorsPath = path.join(__dirname, '../../../test/protocol-vectors.json');
    const content = fs.readFileSync(vectorsPath, 'utf8');
    const { vectors } = JSON.parse(content);

    for (const vec of vectors) {
      const payload = Buffer.from(vec.payloadHex, 'hex');
      const expected = Buffer.from(vec.expectedHex, 'hex');
      
      let encoded;
      if (vec.version === 1) {
        encoded = Frame.encode(vec.type, vec.flags, vec.messageId, payload, { version: 1 });
      } else {
        encoded = Frame.encode(vec.type, vec.flags, vec.messageId, payload, {
          version: 2,
          priority: vec.priority,
          routingKey: vec.routingKey
        });
      }

      expect(encoded.toString('hex')).toBe(vec.expectedHex);

      const decoded = Frame.decodeAuto(expected);
      expect(decoded.type).toBe(vec.type);
      expect(decoded.flags).toBe(vec.flags);
      expect(decoded.messageId).toBe(vec.messageId);
      
      if (vec.version === 2) {
        expect(decoded.version).toBe(2);
        expect(decoded.priority).toBe(vec.priority ?? 3);
        expect(decoded.routingKey).toBe(vec.routingKey ?? '');
      }
    }
  });
});
