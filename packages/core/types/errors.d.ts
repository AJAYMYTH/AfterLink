// ─── Error Categories ──────────────────────────────────────────────────────

export type ErrorCategory =
  | 'protocol'
  | 'auth'
  | 'route'
  | 'validation'
  | 'rate_limit'
  | 'connection'
  | 'server'
  | 'compression';

// ─── Base Error ────────────────────────────────────────────────────────────

export interface SerializedError {
  code:       string;
  message:    string;
  category:   ErrorCategory;
  httpStatus: number;
  details?:   Record<string, unknown>;
  requestId?: string | number;
}

export interface AfterLinkErrorOptions {
  code:       string;
  message:    string;
  category:   ErrorCategory;
  httpStatus: number;
  details?:   Record<string, unknown>;
  requestId?: string | number;
  cause?:     Error;
}

export class AfterLinkError extends Error {
  readonly code:       string;
  readonly category:   ErrorCategory;
  readonly httpStatus: number;
  readonly details?:   Record<string, unknown>;
  readonly requestId?: string | number;
  readonly timestamp:  Date;

  constructor(options: AfterLinkErrorOptions);
  toJSON(): SerializedError;
  toFrame(messageId?: number): Buffer;
}

// ─── Protocol Errors ───────────────────────────────────────────────────────

export class ProtocolError extends AfterLinkError {
  constructor(options: Omit<AfterLinkErrorOptions, 'category' | 'httpStatus'> & { httpStatus?: number });
}
export class InvalidFrameError extends ProtocolError {
  constructor(message: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class UnsupportedVersionError extends ProtocolError {
  constructor(message: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class MalformedPayloadError extends ProtocolError {
  constructor(message: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class UnknownFrameTypeError extends ProtocolError {
  constructor(message: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}

// ─── Auth Errors ───────────────────────────────────────────────────────────

export class AuthError extends AfterLinkError {
  constructor(options: Omit<AfterLinkErrorOptions, 'category' | 'httpStatus'> & { httpStatus?: number });
}
export class AuthRequiredError extends AuthError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class AuthFailedError extends AuthError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class AuthExpiredError extends AuthError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class AuthInsufficientPermissionsError extends AuthError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}

// ─── Route Errors ──────────────────────────────────────────────────────────

export class RouteError extends AfterLinkError {
  constructor(options: Omit<AfterLinkErrorOptions, 'category' | 'httpStatus'> & { httpStatus?: number });
}
export class RouteNotFoundError extends RouteError {
  constructor(route: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category' | 'details'>);
}
export class RouteHandlerError extends RouteError {
  constructor(message: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class RouteTimeoutError extends RouteError {
  constructor(route: string, timeoutMs: number, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category' | 'details'>);
}

// ─── Validation Error ──────────────────────────────────────────────────────

export interface ValidationIssue {
  field:   string;
  message: string;
  code:    string;
  path:    (string | number)[];
}

export interface ValidationDetails {
  issues: ValidationIssue[];
}

export class ValidationError extends AfterLinkError {
  readonly details: ValidationDetails;
  constructor(options: Omit<AfterLinkErrorOptions, 'code' | 'category' | 'httpStatus'> & { details: ValidationDetails });
  static fromZodError(zodError: { errors: Array<{ path: (string | number)[]; message: string; code: string }> }, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category' | 'httpStatus' | 'details'>): ValidationError;
}

// ─── Rate Limit Error ──────────────────────────────────────────────────────

export interface RateLimitDetails {
  retryAfter:      number;
  limit:           number;
  remaining:       number;
  closeConnection: boolean;
}

export class RateLimitError extends AfterLinkError {
  readonly details: RateLimitDetails;
  constructor(options: Omit<AfterLinkErrorOptions, 'code' | 'category' | 'httpStatus'> & { details?: RateLimitDetails });
  static create(options: { retryAfter: number; limit: number; remaining: number; closeConnection?: boolean; message?: string; requestId?: string | number }): RateLimitError;
}

// ─── Connection Errors ─────────────────────────────────────────────────────

export class ConnectionError extends AfterLinkError {
  constructor(options: Omit<AfterLinkErrorOptions, 'category' | 'httpStatus'> & { httpStatus?: number });
}
export class ConnectionRefusedError extends ConnectionError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class ConnectionTimeoutError extends ConnectionError {
  constructor(host: string, port: number, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category' | 'details'>);
}
export class ConnectionResetError extends ConnectionError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class TLSHandshakeFailedError extends ConnectionError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class TLSCertInvalidError extends ConnectionError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}

// ─── Server Errors ─────────────────────────────────────────────────────────

export class ServerError extends AfterLinkError {
  constructor(options: Omit<AfterLinkErrorOptions, 'category' | 'httpStatus'> & { httpStatus?: number });
}
export class InternalServerErrorError extends ServerError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class ServerShuttingDownError extends ServerError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}

// ─── Compression Errors ────────────────────────────────────────────────────

export class CompressionError extends AfterLinkError {
  constructor(options: Omit<AfterLinkErrorOptions, 'category' | 'httpStatus'> & { httpStatus?: number });
}
export class DecompressionFailedError extends CompressionError {
  constructor(message?: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category'>);
}
export class CompressionAlgorithmUnsupportedError extends CompressionError {
  constructor(algorithm: string, options?: Omit<AfterLinkErrorOptions, 'code' | 'message' | 'category' | 'details'>);
}

// ─── Utility Functions ─────────────────────────────────────────────────────

export function fromError(err: Error, fallback?: { requestId?: string | number }): AfterLinkError;
export function fromFramePayload(payload: Buffer, messageId: number): AfterLinkError;
export function getErrorClassByCode(code: string): typeof AfterLinkError | null;
export function isErrorCategory(value: string): boolean;
export const ERROR_CATEGORIES: ErrorCategory[];
