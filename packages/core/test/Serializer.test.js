import { describe, it, expect } from 'vitest';
import Serializer from '../src/Serializer.js';

describe('Serializer', () => {
  it('encodes and decodes a simple object', () => {
    const data = { name: 'AfterLink', version: 1 };
    const encoded = Serializer.encode(data);
    const decoded = Serializer.decode(encoded);

    expect(decoded).toEqual(data);
  });

  it('handles nested objects', () => {
    const data = {
      route: 'getUser',
      body: { id: 42, nested: { key: 'value' } },
    };
    const encoded = Serializer.encode(data);
    const decoded = Serializer.decode(encoded);

    expect(decoded).toEqual(data);
  });

  it('handles arrays', () => {
    const data = { items: [1, 2, 3, 'four'] };
    const encoded = Serializer.encode(data);
    const decoded = Serializer.decode(encoded);

    expect(decoded.items).toEqual([1, 2, 3, 'four']);
  });

  it('handles null and undefined', () => {
    const data = { a: null, b: undefined };
    const encoded = Serializer.encode(data);
    const decoded = Serializer.decode(encoded);

    expect(decoded.a).toBeNull();
  });

  it('handles boolean values', () => {
    const data = { active: true, deleted: false };
    const encoded = Serializer.encode(data);
    const decoded = Serializer.decode(encoded);

    expect(decoded.active).toBe(true);
    expect(decoded.deleted).toBe(false);
  });

  it('handles buffers', () => {
    const data = { binary: Buffer.from('hello') };
    const encoded = Serializer.encode(data);
    const decoded = Serializer.decode(encoded);

    expect(decoded.binary).toEqual(Buffer.from('hello'));
  });
});
