import { CompressionOptions, AfterLinkError } from '@ajaymyth/core/types/errors';

export interface ClientOptions {
  autoReconnect?:         boolean;
  maxReconnectAttempts?:  number;
  reconnectDelay?:        number;
  reconnectMaxDelay?:     number;
  timeout?:               number;
  pingInterval?:          number;
  connectTimeout?:        number;
  /** Requested protocol version. 2 (default) negotiates v2 frames (16-byte header); 1 forces v1. */
  protocolVersion?:       1 | 2;
  autoThrottle?:          boolean;
  auth?:                  string;
  tls?: {
    ca?:                  Buffer | string;
    rejectUnauthorized?:  boolean;
    minVersion?:          string;
  };
  compression?: CompressionOptions;
}

export interface RequestOptions {
  timeout?:  number;
  headers?:  Record<string, string>;
}

export interface ReconnectInfo {
  attempt:  number;
  delay:    number;
}

export interface DisconnectInfo {
  graceful: boolean;
  reason?:  string;
  code?:    number;
}

export interface ClosingInfo {
  drainTimeout:  number;
  reason:        string;
}

export class Client {
  constructor(url: string, options?: ClientOptions);

  connect():    Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  request(route: string, payload?: unknown, options?: RequestOptions): Promise<unknown>;

  subscribe(topic: string, handler: (data: unknown) => void):   Promise<void>;
  unsubscribe(topic: string):                                    void;
  publish(topic: string, data: unknown):                         void;

  on(event: 'connected',       handler: () => void): this;
  on(event: 'disconnected',    handler: (info: DisconnectInfo) => void): this;
  on(event: 'reconnecting',    handler: (info: ReconnectInfo) => void): this;
  on(event: 'reconnected',     handler: () => void): this;
  on(event: 'server-closing',  handler: (info: ClosingInfo) => void): this;
  on(event: 'error',           handler: (err: AfterLinkError) => void): this;
  on(event: 'message',         handler: (data: { topic: string; data: unknown }) => void): this;

  off(event: string, listener: (...args: unknown[]) => void): this;

  getSessionId(): string | null;
  isTLS(): boolean;
  /** The protocol version negotiated with the server (2 = v2 frames, 1 = v1). */
  getProtocolVersion(): 1 | 2;
}

// ─── Error Re-exports ──────────────────────────────────────────────────────

export {
  AfterLinkError,
  ProtocolError,
  InvalidFrameError,
  UnsupportedVersionError,
  MalformedPayloadError,
  UnknownFrameTypeError,
  AuthError,
  AuthRequiredError,
  AuthFailedError,
  AuthExpiredError,
  AuthInsufficientPermissionsError,
  RouteError,
  RouteNotFoundError,
  RouteHandlerError,
  RouteTimeoutError,
  ValidationError,
  RateLimitError,
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimeoutError,
  ConnectionResetError,
  TLSHandshakeFailedError,
  TLSCertInvalidError,
  ServerError,
  InternalServerErrorError,
  ServerShuttingDownError,
  CompressionError,
  DecompressionFailedError,
  CompressionAlgorithmUnsupportedError,
} from '@ajaymyth/core/types/errors';
