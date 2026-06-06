// ─── Frame Types ───────────────────────────────────────────────────────────

export const FrameType: {
  readonly REQUEST:        0x01;
  readonly RESPONSE:       0x02;
  readonly STREAM_START:   0x03;
  readonly STREAM_DATA:    0x04;
  readonly STREAM_END:     0x05;
  readonly ERROR:          0x06;
  readonly PING:           0x07;
  readonly PONG:           0x08;
  readonly BROADCAST:      0x09;
  readonly SUBSCRIBE:      0x0A;
  readonly UNSUBSCRIBE:    0x0B;
  readonly PUBLISH:        0x0C;
  readonly CLOSE:          0x0D;
  readonly CLOSE_ACK:      0x0E;
  readonly HELLO:          0x0F;
  readonly HELLO_ACK:      0x10;
  readonly SERVER_CLOSING: 0x11;
};

export const FLAGS: {
  readonly COMPRESSED:      0b10000000;
  readonly ENCRYPTED:       0b01000000;
  readonly FINAL:           0b00100000;
  readonly PRIORITY:        0b00010000;
  readonly ACK_REQUIRED:    0b00001000;
};

// ─── Frame ─────────────────────────────────────────────────────────────────

export interface RawFrame {
  type:      number;
  flags:     number;
  messageId: number;
  payload:   Buffer;
  totalSize: number;
}

// ─── Compression ───────────────────────────────────────────────────────────

export type CompressionAlgorithm = 'zlib' | 'brotli' | 'none';

export interface CompressionOptions {
  enabled?:   boolean;
  algorithm?: CompressionAlgorithm;
  threshold?: number;
  level?:     1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

// ─── Serialization ─────────────────────────────────────────────────────────

export interface Serializer {
  encode(data: unknown): Buffer;
  decode(buffer: Buffer): unknown;
}

// ─── Frame Class ───────────────────────────────────────────────────────────

export class Frame {
  static encode(type: number, flags: number, messageId: number, payload: Buffer): Buffer;
  static decode(buffer: Buffer): RawFrame | null;
  static headerSize(): number;
  static maxPayloadSize(): number;
}

// ─── Compression Module ────────────────────────────────────────────────────

export interface CompressionResult {
  data: Buffer;
  compressed: boolean;
}

export const compression: {
  compress(payload: Buffer, algorithm?: CompressionAlgorithm, level?: number, threshold?: number): CompressionResult;
  decompress(payload: Buffer, compressed: boolean, algorithm?: CompressionAlgorithm): Buffer;
  isCompressed(flags: number): boolean;
  setCompressedFlag(flags: number, compressed: boolean): number;
  FLAGS_COMPRESSED: number;
  ALGORITHMS: Record<CompressionAlgorithm, { compress: (buf: Buffer, level?: number) => Buffer; decompress: (buf: Buffer) => Buffer }>;
};

// ─── TcpClient ─────────────────────────────────────────────────────────────

export interface TcpClientOptions {
  /** Server hostname or IP. Default: 'localhost' */
  host?: string;
  /** Server TCP port. Default: 4000 */
  port?: number;
  /** Milliseconds to wait for HELLO_ACK before rejecting. Default: 5000 */
  connectTimeout?: number;
  /** Milliseconds to wait for a RESPONSE before rejecting. Default: 10000 */
  requestTimeout?: number;
}

export interface HelloData {
  /** JWT token string for authenticated servers */
  auth?: string;
  /** Protocol version string. Default: 'AL/1' */
  version?: string;
  /** Capability strings to advertise */
  capabilities?: string[];
  [key: string]: unknown;
}

/**
 * Lightweight TCP client for the AfterLink protocol.
 *
 * @example
 * const { TcpClient } = require('@ajaymyth/core');
 * const client = new TcpClient({ host: 'localhost', port: 4000 });
 * await client.connect({ auth: myJwtToken });
 * const response = await client.request('messages/send', { text: 'hello' });
 * client.disconnect();
 */
export class TcpClient {
  constructor(options?: TcpClientOptions);

  /** Whether the client has an active, authenticated session. */
  readonly connected: boolean;

  /**
   * Open the TCP connection and perform the AfterLink HELLO handshake.
   * Resolves with the HELLO_ACK payload on success.
   * Rejects if the server returns AUTH_FAILED or the timeout is reached.
   */
  connect(helloData?: HelloData): Promise<Record<string, unknown>>;

  /**
   * Send a REQUEST frame to the given route and await the RESPONSE.
   * Rejects with an error object if the server sends an ERROR frame
   * or the requestTimeout is exceeded.
   */
  request(route: string, body?: Record<string, unknown>): Promise<Record<string, unknown>>;

  /** Destroy the underlying socket and close the connection. */
  disconnect(): void;

  // EventEmitter interface
  on(event: 'disconnect', listener: () => void): this;
  on(event: 'error', listener: (err: Error | Record<string, unknown>) => void): this;
  on(event: 'closing', listener: (data: Record<string, unknown>) => void): this;
  on(event: 'frame', listener: (frame: RawFrame) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
}

// ─── Exports ───────────────────────────────────────────────────────────────

export { Frame as default };
