import { describe, it, expect } from 'vitest';
import {
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
  fromError,
  fromFramePayload,
  getErrorClassByCode,
  ERROR_CATEGORIES,
  isErrorCategory,
} from '../../src/errors/index.js';
import { Frame, FrameTypes } from '../../src/index.js';
import { pack } from 'msgpackr';

function encodePayload(data) {
  return Buffer.from(pack(data));
}

describe('AfterLinkError', () => {
  it('creates a basic error with all fields', () => {
    const err = new AfterLinkError({
      code: 'TEST_ERROR',
      message: 'Test message',
      category: 'server',
      httpStatus: 500,
      details: { foo: 'bar' },
      requestId: 'req_123',
    });

    expect(err.name).toBe('AfterLinkError');
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('Test message');
    expect(err.category).toBe('server');
    expect(err.httpStatus).toBe(500);
    expect(err.details).toEqual({ foo: 'bar' });
    expect(err.requestId).toBe('req_123');
    expect(err.timestamp).toBeInstanceOf(Date);
  });

  it('supports cause option', () => {
    const cause = new Error('Original error');
    const err = new AfterLinkError({
      code: 'WRAPPED',
      message: 'Wrapped error',
      category: 'server',
      httpStatus: 500,
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it('toJSON returns serializable object', () => {
    const err = new AfterLinkError({
      code: 'TEST',
      message: 'Test',
      category: 'protocol',
      httpStatus: 400,
      details: { x: 1 },
      requestId: 'r1',
    });

    const json = err.toJSON();
    expect(json).toEqual({
      code: 'TEST',
      message: 'Test',
      category: 'protocol',
      httpStatus: 400,
      details: { x: 1 },
      requestId: 'r1',
    });
    expect(JSON.stringify(json)).toBeDefined();
  });

  it('toJSON omits optional fields when undefined', () => {
    const err = new AfterLinkError({
      code: 'TEST',
      message: 'Test',
      category: 'server',
      httpStatus: 500,
    });
    const json = err.toJSON();
    expect(json.details).toBeUndefined();
    expect(json.requestId).toBeUndefined();
  });

  it('toFrame produces a valid Buffer', () => {
    const err = new AfterLinkError({
      code: 'TEST',
      message: 'Test',
      category: 'server',
      httpStatus: 500,
    });
    const frame = err.toFrame(42);
    expect(Buffer.isBuffer(frame)).toBe(true);
    expect(frame.length).toBeGreaterThan(10);
    // Verify it's an ERROR frame
    const decoded = Frame.decode(frame);
    expect(decoded.type).toBe(FrameTypes.ERROR);
    expect(decoded.messageId).toBe(42);
  });

  it('instanceof checks work', () => {
    const err = new AfterLinkError({
      code: 'TEST',
      message: 'Test',
      category: 'server',
      httpStatus: 500,
    });
    expect(err instanceof AfterLinkError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

describe('ProtocolError subclasses', () => {
  it('InvalidFrameError has correct defaults', () => {
    const err = new InvalidFrameError('Bad frame');
    expect(err.code).toBe('INVALID_FRAME');
    expect(err.category).toBe('protocol');
    expect(err.httpStatus).toBe(400);
    expect(err instanceof ProtocolError).toBe(true);
    expect(err instanceof AfterLinkError).toBe(true);
  });

  it('UnsupportedVersionError has correct httpStatus', () => {
    const err = new UnsupportedVersionError('v0 not supported');
    expect(err.code).toBe('UNSUPPORTED_VERSION');
    expect(err.httpStatus).toBe(426);
  });

  it('MalformedPayloadError works', () => {
    const err = new MalformedPayloadError('Cannot parse');
    expect(err.code).toBe('MALFORMED_PAYLOAD');
  });

  it('UnknownFrameTypeError works', () => {
    const err = new UnknownFrameTypeError('Type 0xFF unknown');
    expect(err.code).toBe('UNKNOWN_FRAME_TYPE');
  });
});

describe('AuthError subclasses', () => {
  it('AuthRequiredError defaults', () => {
    const err = new AuthRequiredError();
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.httpStatus).toBe(401);
    expect(err instanceof AuthError).toBe(true);
  });

  it('AuthFailedError defaults', () => {
    const err = new AuthFailedError('Invalid signature');
    expect(err.code).toBe('AUTH_FAILED');
  });

  it('AuthExpiredError defaults', () => {
    const err = new AuthExpiredError();
    expect(err.code).toBe('AUTH_EXPIRED');
  });

  it('AuthInsufficientPermissionsError has 403', () => {
    const err = new AuthInsufficientPermissionsError();
    expect(err.code).toBe('AUTH_INSUFFICIENT_PERMISSIONS');
    expect(err.httpStatus).toBe(403);
  });
});

describe('RouteError subclasses', () => {
  it('RouteNotFoundError includes route in details', () => {
    const err = new RouteNotFoundError('getUser');
    expect(err.code).toBe('ROUTE_NOT_FOUND');
    expect(err.details.route).toBe('getUser');
    expect(err.message).toContain('getUser');
  });

  it('RouteHandlerError has 500', () => {
    const err = new RouteHandlerError('Handler crashed');
    expect(err.code).toBe('ROUTE_HANDLER_ERROR');
    expect(err.httpStatus).toBe(500);
  });

  it('RouteTimeoutError includes timeout details', () => {
    const err = new RouteTimeoutError('slowRoute', 5000);
    expect(err.code).toBe('ROUTE_TIMEOUT');
    expect(err.httpStatus).toBe(408);
    expect(err.details.timeoutMs).toBe(5000);
  });
});

describe('ValidationError', () => {
  it('basic validation error', () => {
    const err = new ValidationError({
      message: 'Validation failed',
      details: { issues: [{ field: 'email', message: 'Invalid email' }] },
    });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.httpStatus).toBe(422);
    expect(err.details.issues).toHaveLength(1);
  });

  it('fromZodError maps Zod issues', () => {
    const zodError = {
      errors: [
        { path: ['email'], message: 'Invalid email', code: 'invalid_string' },
        { path: ['name'], message: 'Too short', code: 'too_small' },
      ],
    };
    const err = ValidationError.fromZodError(zodError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details.issues).toHaveLength(2);
    expect(err.details.issues[0].field).toBe('email');
    expect(err.details.issues[0].message).toBe('Invalid email');
    expect(err.details.issues[1].field).toBe('name');
  });
});

describe('RateLimitError', () => {
  it('basic rate limit error', () => {
    const err = new RateLimitError({ message: 'Too many requests' });
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.httpStatus).toBe(429);
  });

  it('create helper includes retryAfter', () => {
    const err = RateLimitError.create({
      retryAfter: 1500,
      limit: 100,
      remaining: 0,
      closeConnection: true,
    });
    expect(err.details.retryAfter).toBe(1500);
    expect(err.details.limit).toBe(100);
    expect(err.details.closeConnection).toBe(true);
  });
});

describe('ConnectionError subclasses', () => {
  it('ConnectionRefusedError defaults', () => {
    const err = new ConnectionRefusedError();
    expect(err.code).toBe('CONNECTION_REFUSED');
    expect(err instanceof ConnectionError).toBe(true);
  });

  it('ConnectionTimeoutError includes host/port', () => {
    const err = new ConnectionTimeoutError('localhost', 4000);
    expect(err.code).toBe('CONNECTION_TIMEOUT');
    expect(err.httpStatus).toBe(408);
    expect(err.details.host).toBe('localhost');
    expect(err.details.port).toBe(4000);
  });

  it('TLSHandshakeFailedError has 525', () => {
    const err = new TLSHandshakeFailedError();
    expect(err.code).toBe('TLS_HANDSHAKE_FAILED');
    expect(err.httpStatus).toBe(525);
  });

  it('TLSCertInvalidError has 526', () => {
    const err = new TLSCertInvalidError();
    expect(err.code).toBe('TLS_CERT_INVALID');
    expect(err.httpStatus).toBe(526);
  });
});

describe('ServerError subclasses', () => {
  it('InternalServerErrorError defaults', () => {
    const err = new InternalServerErrorError();
    expect(err.code).toBe('INTERNAL_SERVER_ERROR');
    expect(err instanceof ServerError).toBe(true);
  });

  it('ServerShuttingDownError has 503', () => {
    const err = new ServerShuttingDownError();
    expect(err.code).toBe('SERVER_SHUTTING_DOWN');
    expect(err.httpStatus).toBe(503);
  });
});

describe('CompressionError subclasses', () => {
  it('DecompressionFailedError defaults', () => {
    const err = new DecompressionFailedError();
    expect(err.code).toBe('DECOMPRESSION_FAILED');
    expect(err instanceof CompressionError).toBe(true);
  });

  it('CompressionAlgorithmUnsupportedError includes algorithm', () => {
    const err = new CompressionAlgorithmUnsupportedError('lz4');
    expect(err.code).toBe('COMPRESSION_ALGORITHM_UNSUPPORTED');
    expect(err.details.algorithm).toBe('lz4');
  });
});

describe('fromError', () => {
  it('returns AfterLinkError as-is', () => {
    const original = new ValidationError({ message: 'Bad' });
    const result = fromError(original);
    expect(result).toBe(original);
  });

  it('converts RATE_LIMITED plain error', () => {
    const plain = new Error('Rate limited');
    plain.code = 'RATE_LIMITED';
    plain.retryAfter = 2000;
    plain.limit = 50;
    plain.remaining = 0;

    const result = fromError(plain);
    expect(result).toBeInstanceOf(RateLimitError);
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.details.retryAfter).toBe(2000);
  });

  it('wraps unknown errors as InternalServerErrorError', () => {
    const plain = new Error('Something broke');
    const result = fromError(plain);
    expect(result).toBeInstanceOf(InternalServerErrorError);
    expect(result.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

describe('fromFramePayload', () => {
  it('parses structured error payload', () => {
    const payload = encodePayload({
      code: 'VALIDATION_ERROR',
      message: 'Bad email',
      category: 'validation',
      httpStatus: 422,
      details: { issues: [{ field: 'email' }] },
      requestId: 42,
    });

    const err = fromFramePayload(payload, 42);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details.issues).toHaveLength(1);
  });

  it('falls back for unknown error codes', () => {
    const payload = encodePayload({
      code: 'CUSTOM_APP_ERROR',
      message: 'Order not found',
      category: 'route',
      httpStatus: 404,
    });

    const err = fromFramePayload(payload, 1);
    expect(err.code).toBe('CUSTOM_APP_ERROR');
    expect(err.message).toBe('Order not found');
  });

  it('handles malformed payload gracefully', () => {
    const payload = Buffer.from('not valid msgpack at all!!!');
    const err = fromFramePayload(payload, 0);
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.requestId).toBe(0);
  });
});

describe('getErrorClassByCode', () => {
  it('maps all known codes to classes', () => {
    const codes = [
      'INVALID_FRAME', 'UNSUPPORTED_VERSION', 'MALFORMED_PAYLOAD', 'UNKNOWN_FRAME_TYPE',
      'AUTH_REQUIRED', 'AUTH_FAILED', 'AUTH_EXPIRED', 'AUTH_INSUFFICIENT_PERMISSIONS',
      'ROUTE_NOT_FOUND', 'ROUTE_HANDLER_ERROR', 'ROUTE_TIMEOUT',
      'VALIDATION_ERROR', 'RATE_LIMITED',
      'CONNECTION_REFUSED', 'CONNECTION_TIMEOUT', 'CONNECTION_RESET',
      'TLS_HANDSHAKE_FAILED', 'TLS_CERT_INVALID',
      'INTERNAL_SERVER_ERROR', 'SERVER_SHUTTING_DOWN',
      'DECOMPRESSION_FAILED', 'COMPRESSION_ALGORITHM_UNSUPPORTED',
    ];

    for (const code of codes) {
      const cls = getErrorClassByCode(code);
      expect(cls).toBeDefined();
      expect(typeof cls).toBe('function');
    }
  });

  it('returns null for unknown codes', () => {
    expect(getErrorClassByCode('FOO_BAR')).toBeNull();
  });
});

describe('ERROR_CATEGORIES', () => {
  it('contains all 8 categories', () => {
    expect(ERROR_CATEGORIES).toContain('protocol');
    expect(ERROR_CATEGORIES).toContain('auth');
    expect(ERROR_CATEGORIES).toContain('route');
    expect(ERROR_CATEGORIES).toContain('validation');
    expect(ERROR_CATEGORIES).toContain('rate_limit');
    expect(ERROR_CATEGORIES).toContain('connection');
    expect(ERROR_CATEGORIES).toContain('server');
    expect(ERROR_CATEGORIES).toContain('compression');
    expect(ERROR_CATEGORIES).toHaveLength(8);
  });

  it('isErrorCategory validates correctly', () => {
    expect(isErrorCategory('protocol')).toBe(true);
    expect(isErrorCategory('unknown')).toBe(false);
  });
});
