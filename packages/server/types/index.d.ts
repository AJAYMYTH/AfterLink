import { ZodSchema } from 'zod';
import { CompressionOptions, CompressionAlgorithm } from '@afterlink/core';
import { AfterLinkError } from '@afterlink/core/types/errors';

// ─── Server Config ─────────────────────────────────────────────────────────

export interface TLSOptions {
  enabled:              boolean;
  key:                  Buffer | string;
  cert:                 Buffer | string;
  ca?:                  Buffer | string;
  rejectUnauthorized?:  boolean;
  minVersion?:          'TLSv1.2' | 'TLSv1.3';
}

export interface RateLimitOptions {
  enabled:                boolean;
  requestsPerSecond:      number;
  burstSize?:             number;
  closeAfterViolations?:  number;
  errorMessage?:          string;
  onLimited?:             (connection: ConnectionInfo) => void;
  perIP?: {
    enabled:            boolean;
    requestsPerSecond:  number;
    burstSize?:         number;
  };
}

export interface ShutdownOptions {
  drainTimeout?:    number;
  reason?:          string;
  notifyClients?:   boolean;
}

export interface BrowserBridgeOptions {
  enabled:   boolean;
  port:      number;
  path?:     string;
  cors?: {
    origins: string[] | '*';
  };
}

export interface HealthOptions {
  enabled?:    boolean;
  port?:       number;
  path?:       string;
  token?:      string;
  include?: {
    connections?:  boolean;
    memory?:       boolean;
    uptime?:       boolean;
    routes?:       boolean;
    rateLimit?:    boolean;
  };
}

export interface ServerOptions {
  port:           number;
  host?:          string;
  maxConnections?: number;
  tls?:           TLSOptions;
  compression?:   CompressionOptions;
  rateLimit?:     RateLimitOptions;
  shutdown?:      ShutdownOptions;
  browser?:       BrowserBridgeOptions;
  health?:        HealthOptions;
  auth?: {
    type:    'jwt';
    secret:  string;
  };
}

// ─── Request / Response ────────────────────────────────────────────────────

export interface SessionInfo {
  id:           string;
  userId?:      string;
  connectedAt:  string;
  compression:  CompressionAlgorithm;
  capabilities: string[];
}

export interface ConnectionInfo {
  remoteAddress: string;
  remotePort:    number;
  transport:     'tcp' | 'tls' | 'websocket';
  sessionId:     string;
}

export interface AfterLinkRequest<TBody = unknown> {
  route:      string;
  body:       TBody;
  messageId:  number;
  session:    SessionInfo;
  connection: ConnectionInfo;
  headers:    Record<string, string>;
}

export interface AfterLinkStream {
  write(chunk: unknown): void;
  end(): void;
}

export interface AfterLinkResponse {
  send(data: unknown): void;
  error(code: string, message: string, details?: unknown): void;
  stream(): AfterLinkStream;
}

// ─── Route Options ─────────────────────────────────────────────────────────

export interface RouteOptions {
  compression?:  CompressionAlgorithm | false;
  rateLimit?:    Partial<RateLimitOptions> | false;
}

// ─── Middleware ─────────────────────────────────────────────────────────────

export type MiddlewareFunction<TBody = unknown> = (
  req:  AfterLinkRequest<TBody>,
  next: () => Promise<void>
) => Promise<void>;

// ─── Route Handler ─────────────────────────────────────────────────────────

export type RouteHandler<TBody = unknown> = (
  req:  AfterLinkRequest<TBody>,
  res:  AfterLinkResponse
) => void | Promise<void>;

// ─── Stats ─────────────────────────────────────────────────────────────────

export interface RouteStats {
  name:          string;
  totalCalls:    number;
  avgLatencyMs:  number;
  errorRate:     number;
}

export interface ServerStats {
  uptime:           number;
  connections:      number;
  totalRequests:    number;
  requestsPerSec:   number;
  avgLatencyMs:     number;
  errorRate:        number;
  memory: {
    heapUsed:  number;
    heapTotal: number;
    rss:       number;
  };
  routes: RouteStats[];
}

export interface ClosingInfo {
  activeConnections: number;
  activeRequests:    number;
  reason:            string;
}

// ─── Server Class ──────────────────────────────────────────────────────────

export class Server {
  constructor(options: ServerOptions);

  on<TBody = unknown>(
    route:    string,
    handler:  RouteHandler<TBody>,
    schema?:  ZodSchema<TBody> | null,
    options?: RouteOptions
  ): this;

  use(middleware: MiddlewareFunction): this;

  publish(topic: string, data: unknown): void;

  listen(port?: number): Promise<this>;
  close(options?: { force?: boolean }): Promise<void>;

  handleProcessSignals(): this;

  getConnectionCount(): number;
  getRouteCount():      number;
  getStats():           ServerStats;
  isListening():        boolean;
  isTLS():              boolean;

  on(event: 'listening',  handler: () => void): this;
  on(event: 'connection', handler: (info: ConnectionInfo) => void): this;
  on(event: 'closing',    handler: (info: ClosingInfo) => void): this;
  on(event: 'drained',    handler: (info: { timedOut: boolean }) => void): this;
  on(event: 'closed',     handler: () => void): this;
  on(event: 'error',      handler: (err: AfterLinkError) => void): this;

  off(event: string, listener: (...args: unknown[]) => void): this;
}

// ─── TLS Utilities ─────────────────────────────────────────────────────────

export function generateDevCerts(options?: {
  commonName?: string;
}): Promise<{ key: Buffer; cert: Buffer }>;

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
} from '@afterlink/core/types/errors';
