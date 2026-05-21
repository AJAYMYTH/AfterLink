# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

We take the security of AfterLink seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please email us at contact.javaliajayakumar@gmail.com

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

* Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
* Full paths of source file(s) related to the manifestation of the issue
* The location of the affected source code (tag/branch/commit or direct URL)
* Any special configuration required to reproduce the issue
* Step-by-step instructions to reproduce the issue
* Proof-of-concept or exploit code (if possible)
* Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Security Architecture

AfterLink is designed with security as a core principle. Here is how we protect your data:

### 1. Supply Chain Security
* **Minimal Dependencies:** We use only 3 production dependencies (`msgpackr`, `zod`, `jose`), all of which are widely audited and maintained.
* **Locked Versions:** Every dependency version is pinned in `pnpm-lock.yaml`.
* **No Postinstall Scripts:** AfterLink does not run any scripts during installation.
* **Dev Dependency Isolation:** Test tools (`vitest`, etc.) are strictly isolated and never included in production builds.

### 2. Protocol Security
* **Binary Validation:** Frames are strictly validated against size limits (10-byte header, 16MB max payload).
* **Buffer Protection:** Accumulator buffers have hard limits (64MB) to prevent memory exhaustion attacks.
* **Type Safety:** All payloads are deserialized using MessagePack, which does not execute code.
* **Schema Validation:** Optional Zod integration ensures payloads match expected shapes before processing.

### 3. Network Security
* **TLS Support:** Native TLS encryption for all TCP connections.
* **JWT Authentication:** Built-in token validation during the handshake phase.
* **Rate Limiting:** Token-bucket algorithm prevents abuse and DoS attacks.
* **Connection Limits:** Hard limits on concurrent connections prevent resource exhaustion.

### 4. Runtime Security
* **Non-Root Execution:** AfterLink should never be run as root.
* **Process Isolation:** Designed to run in containers with restricted permissions.
* **Memory Safety:** Automatic garbage collection and connection cleanup prevent leaks.

## AI Agent Skill

The [AfterLink Agent Skill](https://github.com/AJAYMYTH/afterlink-skill) is a read-only documentation package. It contains no executable code, no dependencies, and no network calls. It only provides context files that AI agents load into their working memory.

- **No runtime impact:** The skill does not modify your codebase or add dependencies.
- **No secrets exposure:** The skill has no access to your environment variables, API keys, or credentials.
- **Install command:** `npx skills add AJAYMYTH/afterlink-skill`

## Best Practices for Users

1. **Always use `pnpm install`** to ensure lockfile integrity.
2. **Enable TLS** in production: `new Server({ tls: { cert, key } })`.
3. **Set `AFTERLINK_JWT_SECRET`** with a strong 32+ character secret.
4. **Run behind a reverse proxy** (Nginx/HAProxy) for additional security layers.
5. **Keep Node.js updated** to the latest LTS version.
6. **Monitor logs** for unusual connection patterns or error spikes.

## Dependency Audit

We run `pnpm audit` on every commit. You can verify the security of your installation by running:

```bash
pnpm audit --prod
```

This checks only production dependencies. Dev dependencies (used for testing) may show warnings but do not affect your production security.
