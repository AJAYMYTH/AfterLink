import { CompressionOptions, AfterLinkError } from '@ajaymyth/core/types/errors';

export interface BrowserClientOptions {
  autoReconnect?:         boolean;
  maxReconnectAttempts?:  number;
  reconnectDelay?:        number;
  timeout?:               number;
  pingInterval?:          number;
  protocols?:             string[];
  auth?:                  string;
  compression?:           CompressionOptions;
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
  constructor(url: string, options?: BrowserClientOptions);

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
