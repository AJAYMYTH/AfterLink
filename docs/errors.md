# AfterLink Error Handling

AfterLink v1.2.0 introduces a structured error taxonomy with typed error classes, error codes, and cross-environment error serialization.

## Error Classes

All errors extend from `AfterLinkError` and include `code`, `message`, `requestId`, and `timestamp` properties.

### Protocol Errors

| Class | Code | Description |
|-------|------|-------------|
| `AfterLinkError` | `AFTERLINK_ERROR` | Base error class |
| `UnknownFrameTypeError` | `UNKNOWN_FRAME_TYPE` | Unrecognized frame type received |
| `MalformedPayloadError` | `MALFORMED_PAYLOAD` | Invalid or unparseable payload |
| `InvalidFrameSizeError` | `INVALID_FRAME_SIZE` | Frame size exceeds maximum |

### Connection Errors

| Class | Code | Description |
|-------|------|-------------|
| `ConnectionTimeoutError` | `CONNECTION_TIMEOUT` | Connection attempt timed out |
| `ConnectionRefusedError` | `CONNECTION_REFUSED` | Server refused connection |
| `ConnectionClosedError` | `CONNECTION_CLOSED` | Connection unexpectedly closed |
| `TLSCertUntrustedError` | `TLS_CERT_UNTRUSTED` | Untrusted TLS certificate |
| `TLSCertError` | `TLS_CERT_ERROR` | TLS certificate error |
| `TLSConfigError` | `TLS_CONFIG_ERROR` | Invalid TLS configuration |

### Authentication Errors

| Class | Code | Description |
|-------|------|-------------|
| `AuthRequiredError` | `AUTH_REQUIRED` | Authentication required but not provided |
| `AuthFailedError` | `AUTH_FAILED` | Authentication failed |

### Route Errors

| Class | Code | Description |
|-------|------|-------------|
| `RouteNotFoundError` | `ROUTE_NOT_FOUND` | Requested route does not exist |

### Validation Errors

| Class | Code | Description |
|-------|------|-------------|
| `ValidationError` | `VALIDATION_ERROR` | Request payload failed schema validation |

### Server Errors

| Class | Code | Description |
|-------|------|-------------|
| `InternalServerErrorError` | `INTERNAL_SERVER_ERROR` | Unhandled server error |

### Rate Limiting Errors

| Class | Code | Description |
|-------|------|-------------|
| `RateLimitError` | `RATE_LIMITED` | Rate limit exceeded (includes `retryAfter`, `limit`, `remaining`) |

### Compression Errors

| Class | Code | Description |
|-------|------|-------------|
| `CompressionError` | `COMPRESSION_FAILED` | Compression operation failed |
| `DecompressionFailedError` | `DECOMPRESSION_FAILED` | Decompression operation failed |

## Usage

### Server-side: throwing typed errors

```javascript
import { Server } from '@ajaymyth/server';
import { errors } from '@ajaymyth/core';

const server = new Server({ port: 4000 });

server.on('getUser', async (req, res) => {
  if (!req.body.id) {
    throw new errors.ValidationError('Missing required field: id', {
      field: 'id',
    });
  }

  if (!req.session) {
    throw new errors.AuthRequiredError('Authentication required');
  }

  const user = await db.users.find(req.body.id);
  if (!user) {
    throw new errors.RouteNotFoundError(`User ${req.body.id} not found`);
  }

  res.send(user);
});
```

### Client-side: catching typed errors

```javascript
import { Client } from '@ajaymyth/client';
import { errors } from '@ajaymyth/core';

const client = new Client('afterlink://localhost:4000');
await client.connect();

try {
  const result = await client.request('getUser', { id: 42 });
} catch (err) {
  if (err instanceof errors.RouteNotFoundError) {
    console.log('User not found:', err.message);
  } else if (err instanceof errors.ValidationError) {
    console.log('Validation failed:', err.details);
  } else if (err instanceof errors.RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}ms`);
  } else {
    console.error('Unknown error:', err.code, err.message);
  }
}
```

### `fromError()` — Convert any Error to AfterLinkError

```javascript
import { errors } from '@ajaymyth/core';

try {
  // Some operation that might throw anything
  await doSomething();
} catch (err) {
  const alError = errors.fromError(err);
  console.log(alError.code);    // e.g., "INTERNAL_SERVER_ERROR"
  console.log(alError.message); // Original error message
}
```

### `fromFramePayload()` — Deserialize error from frame

```javascript
import { errors } from '@ajaymyth/core';

// When receiving an ERROR frame
const err = errors.fromFramePayload(frame.payload, frame.messageId);
// err is now a typed AfterLinkError subclass instance
```

### `getErrorClassByCode()` — Look up error class by code

```javascript
import { errors } from '@ajaymyth/core';

const ErrorClass = errors.getErrorClassByCode('RATE_LIMITED');
// Returns RateLimitError class
```

## Error Response Format

Errors are serialized in ERROR frames with the following payload structure:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Missing required field: id",
  "requestId": 42,
  "timestamp": "2026-05-19T12:00:00.000Z",
  "details": {
    "field": "id"
  }
}
```

## Error Codes Reference

| Code | HTTP Equivalent | Retry? |
|------|----------------|--------|
| `AFTERLINK_ERROR` | 500 | Yes |
| `UNKNOWN_FRAME_TYPE` | 400 | No |
| `MALFORMED_PAYLOAD` | 400 | No |
| `INVALID_FRAME_SIZE` | 413 | No |
| `CONNECTION_TIMEOUT` | 504 | Yes |
| `CONNECTION_REFUSED` | 502 | Yes |
| `CONNECTION_CLOSED` | 503 | Yes |
| `TLS_CERT_UNTRUSTED` | 495 | No |
| `TLS_CERT_ERROR` | 495 | No |
| `TLS_CONFIG_ERROR` | 500 | No |
| `AUTH_REQUIRED` | 401 | No |
| `AUTH_FAILED` | 403 | No |
| `ROUTE_NOT_FOUND` | 404 | No |
| `VALIDATION_ERROR` | 422 | No |
| `INTERNAL_SERVER_ERROR` | 500 | Yes |
| `RATE_LIMITED` | 429 | Yes (after `retryAfter`) |
| `COMPRESSION_FAILED` | 500 | No |
| `DECOMPRESSION_FAILED` | 400 | No |
