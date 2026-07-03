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
  readonly ROUTE_REQUEST:  0x12;
  readonly PRIORITY_ACK:   0x13;
};

export const FLAGS: {
  readonly COMPRESSED:      0x01;
  readonly ENCRYPTED:       0x02;
  readonly PRIORITY_SET:    0x04;
  readonly HAS_ROUTING_KEY: 0x08;
  readonly FRAGMENTED:      0x10;
};

export const PRIORITY: {
  readonly LOWEST:        0;
  readonly LOW:           1;
  readonly BELOW_NORMAL:  2;
  readonly NORMAL:        3;
  readonly ABOVE_NORMAL:  4;
  readonly HIGH:          5;
  readonly CRITICAL:      6;
  readonly REAL_TIME:     7;
};

export const PROTOCOL_VERSION: {
  readonly V1: 0x01;
  readonly V2: 0x02;
};

// ─── Frame ─────────────────────────────────────────────────────────────────

export interface RawFrame {
  type:      number;
  flags:     number;
  messageId: number;
  payload:   Buffer;
  totalSize: number;
}

export interface RawFrameV2 extends RawFrame {
  version:       number;
  priority:      number;
  routingKeyLen: number;
  routingKey:    string;
}

export interface FrameEncodeOptions {
  version?:    number;
  priority?:   number;
  routingKey?: string;
}

export class FrameV1 {
  static encode(type: number, flags: number, messageId: number, payload: Buffer): Buffer;
  static decode(buffer: Buffer): RawFrame | null;
  static headerSize(): number;
  static maxPayloadSize(): number;
}

export class FrameV2 {
  static encode(type: number, flags: number, messageId: number, payload: Buffer, options?: FrameEncodeOptions): Buffer;
  static decode(buffer: Buffer): RawFrameV2 | null;
  static headerSize(): number;
  static maxPayloadSize(): number;
}

export class Frame {
  static encode(type: number, flags: number, messageId: number, payload: Buffer, options?: FrameEncodeOptions): Buffer;
  static decode(buffer: Buffer, version?: number): RawFrame | RawFrameV2 | null;
  static decodeAuto(buffer: Buffer): RawFrame | RawFrameV2 | null;
  static headerSize(version?: number): number;
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
