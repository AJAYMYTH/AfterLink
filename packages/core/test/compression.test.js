import { describe, it, expect } from 'vitest';
import { compression } from '../src/index.js';

describe('compression', () => {
  const largePayload = Buffer.from('A'.repeat(10000));
  const smallPayload = Buffer.from('Hello');

  describe('compress', () => {
    it('should compress with zlib', () => {
      const { data, compressed } = compression.compress(largePayload, 'zlib', 6, 1024);
      expect(compressed).toBe(true);
      expect(data.length).toBeLessThan(largePayload.length);
    });

    it('should compress with brotli', () => {
      const { data, compressed } = compression.compress(largePayload, 'brotli', 6, 1024);
      expect(compressed).toBe(true);
      expect(data.length).toBeLessThan(largePayload.length);
    });

    it('should not compress below threshold', () => {
      const { data, compressed } = compression.compress(smallPayload, 'zlib', 6, 1024);
      expect(compressed).toBe(false);
      expect(data).toEqual(smallPayload);
    });

    it('should not compress when algorithm is none', () => {
      const { data, compressed } = compression.compress(largePayload, 'none', 6, 0);
      expect(compressed).toBe(false);
      expect(data).toEqual(largePayload);
    });

    it('should fall back to uncompressed if compression increases size', () => {
      const randomData = Buffer.from(Array.from({ length: 1000 }, () => Math.floor(Math.random() * 256)));
      const { data, compressed } = compression.compress(randomData, 'zlib', 1, 0);
      expect(!compressed || data.length < randomData.length).toBe(true);
    });
  });

  describe('decompress', () => {
    it('should decompress zlib data', () => {
      const { data } = compression.compress(largePayload, 'zlib', 6, 0);
      const decompressed = compression.decompress(data, true, 'zlib');
      expect(decompressed).toEqual(largePayload);
    });

    it('should decompress brotli data', () => {
      const { data } = compression.compress(largePayload, 'brotli', 6, 0);
      const decompressed = compression.decompress(data, true, 'brotli');
      expect(decompressed).toEqual(largePayload);
    });

    it('should return unchanged if not compressed', () => {
      const result = compression.decompress(smallPayload, false, 'zlib');
      expect(result).toEqual(smallPayload);
    });
  });

  describe('flags', () => {
    it('should set compressed flag', () => {
      const flags = compression.setCompressedFlag(0, true);
      expect(compression.isCompressed(flags)).toBe(true);
    });

    it('should clear compressed flag', () => {
      let flags = compression.setCompressedFlag(0, true);
      flags = compression.setCompressedFlag(flags, false);
      expect(compression.isCompressed(flags)).toBe(false);
    });
  });
});
