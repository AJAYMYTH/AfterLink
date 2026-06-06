# Contributing to AfterLink

Thank you for your interest in contributing to AfterLink! This document provides guidelines and instructions for contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Branch Naming](#branch-naming)
- [Release Process](#release-process)
- [Documentation Guidelines](#documentation-guidelines)
- [Security Vulnerabilities](#security-vulnerabilities)

---

## Code of Conduct

This project and everyone participating in it is governed by the [AfterLink Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [contact.javaliajayakumar@gmail.com](mailto:contact.javaliajayakumar@gmail.com).

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check [existing issues](https://github.com/AJAYMYTH/AfterLink/issues) to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Environment details**: Node.js version, OS, AfterLink version
- **Code samples** or error messages
- **Screenshots** if applicable

**Example:**

```markdown
**Describe the bug**
Client fails to reconnect after network drop on Windows.

**To Reproduce**
1. Start server on port 4000
2. Connect client with autoReconnect: true
3. Disconnect network cable
4. Reconnect network

**Expected behavior**
Client should reconnect within 1000ms.

**Actual behavior**
Client throws ECONNRESET and does not retry.

**Environment:**
- OS: Windows 11
- Node.js: 20.10.0
- AfterLink: 1.0.0
```

### Suggesting Features

Feature suggestions are welcome! Before suggesting, check [existing issues](https://github.com/AJAYMYTH/AfterLink/issues) and the [Roadmap](README.md#roadmap) to see if it's already planned.

When suggesting a feature, include:
- **Use case**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you've thought about
- **Additional context**: Links, references, or examples

### Your First Code Contribution

1. Look for issues labeled [`good first issue`](https://github.com/AJAYMYTH/AfterLink/labels/good%20first%20issue) or [`help wanted`](https://github.com/AJAYMYTH/AfterLink/labels/help%20wanted)
2. Comment on the issue to let others know you're working on it
3. Fork the repository and create a feature branch
4. Make your changes following the [Coding Standards](#coding-standards)
5. Write or update tests
6. Submit a [Pull Request](#pull-requests)

### Pull Requests

- Fill in the required PR template
- Reference related issues (e.g., `Closes #123`)
- Ensure all tests pass
- Update documentation if needed
- Keep PRs focused — one feature/fix per PR
- Request review from maintainers

---

## Development Setup

### Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org/))
- **pnpm** 8+ (`npm install -g pnpm`)
- **Git** ([download](https://git-scm.com/))

### Local Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/AfterLink.git
cd AfterLink

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run the demo showcase
cd examples/demo-runner && node index.js
```

### Package Scripts

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm test:core
pnpm test:server
pnpm test:client

# Run demos
cd examples/demo-runner && node index.js
```

---

## Project Structure

```
AfterLink/
├── packages/
│   ├── core/               # Protocol core (Frame, Serializer, FrameTypes)
│   ├── server/             # Server SDK (TCP, Router, Pub/Sub, Middleware)
│   └── client/             # Client SDK (TCP, Auto-Reconnect, Subscriptions)
├── examples/
│   ├── demo-runner/        # Interactive showcase (7 demos)
│   ├── demo-chat/          # Real-time pub/sub chat app
│   ├── demo-dashboard/     # Live stock price feed
│   ├── demo-microservice/  # CRUD with Zod schema validation
│   └── hello-world/        # Simple ping/pong starter
├── docs/                   # Documentation website (HTML/CSS/JS)
├── DEPLOYMENT.md           # Deployment guide
├── SECURITY.md             # Security policy
├── CHANGELOG.md            # Version history
└── README.md               # Project overview
```

### Package Dependencies

| Package | Dependencies | Purpose |
|---|---|---|
| `@ajaymyth/core` | `msgpackr` | Frame encoding/decoding, serialization |
| `@ajaymyth/server` | `@ajaymyth/core` | TCP server, routing, pub/sub broker |
| `@ajaymyth/client` | `@ajaymyth/core` | TCP client, auto-reconnect, subscriptions |

---

## Coding Standards

### JavaScript Style

- Use **ES6+** syntax (arrow functions, destructuring, async/await)
- Use `const` by default, `let` when reassignment is needed
- No `var`
- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Add **semicolons** at the end of statements
- Maximum line length: **100 characters**

### Naming Conventions

- **Classes**: PascalCase (`Server`, `Client`, `Frame`)
- **Functions/Variables**: camelCase (`handleRequest`, `maxRetries`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_PAYLOAD_SIZE`)
- **Files**: PascalCase for classes (`Frame.js`), camelCase otherwise (`serializer.js`)
- **Private methods**: prefix with `_` (`_handleClose()`)

### Error Handling

- Use `try/catch` for async operations
- Throw descriptive errors with context
- Never swallow errors silently
- Use structured error responses for protocol errors

```js
// Good
if (!route) {
  throw new Error(`Route not found: ${routeName}`);
}

// Bad
if (!route) throw new Error('Not found');
```

### Comments

- Use JSDoc for public APIs
- Explain **why**, not **what**
- Remove commented-out code before committing

```js
/**
 * Encodes a frame into a binary buffer.
 * @param {number} type - Frame type code (0x01-0x10)
 * @param {number} messageId - Unique message identifier
 * @param {Buffer} payload - MessagePack-encoded payload
 * @returns {Buffer} Encoded binary frame
 */
function encode(type, messageId, payload) {
  // Implementation
}
```

---

## Testing Guidelines

### Writing Tests

- Place tests in `packages/<name>/tests/`
- Name test files: `<ModuleName>.test.js`
- Use descriptive test names: `it('should reject invalid frame types', ...)`
- Test both success and failure cases
- Mock external dependencies

### Running Tests

```bash
# All packages
pnpm test

# Specific package
cd packages/core && npx vitest run
```

### Coverage Targets

- **Core**: > 90% coverage
- **Server**: > 85% coverage
- **Client**: > 85% coverage

---

## Commit Message Conventions

AfterLink follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactoring (no feature/bug change) |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, config) |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |

### Examples

```
feat(server): add TLS encryption support
fix(client): resolve auto-reconnect race condition on Windows
docs: update API reference with new middleware options
test(core): add frame encoding edge case tests
chore: update msgpackr to v1.11.0
```

### Scopes

- `core` — `@ajaymyth/core` package
- `server` — `@ajaymyth/server` package
- `client` — `@ajaymyth/client` package
- `docs` — Documentation website
- `examples` — Demo projects
- `deps` — Dependency updates

---

## Branch Naming

| Type | Format | Example |
|---|---|---|
| Feature | `feat/<description>` | `feat/tls-encryption` |
| Bug Fix | `fix/<description>` | `fix/reconnect-windows` |
| Documentation | `docs/<description>` | `docs/api-reference-update` |
| Chore | `chore/<description>` | `chore/update-deps` |

---

## Release Process

1. **Bump version** in all `package.json` files
2. **Update CHANGELOG.md** with new version entries
3. **Create a git tag**: `git tag v1.1.0`
4. **Push**: `git push origin main --tags`
5. **Publish to npm**:
   ```bash
   cd packages/core && npm publish
   cd ../server && npm publish
   cd ../client && npm publish
   cd ../afterlink && npm publish
   ```

### Versioning

AfterLink follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

---

## Documentation Guidelines

### README Updates

- Update the README when adding/changing public APIs
- Keep code examples up-to-date and tested
- Use consistent formatting (markdown tables, code blocks)

### API Documentation

- Document all public methods with JSDoc
- Include parameter types, return types, and examples
- Update the website docs (`docs/index.html`) for major changes

### Website Docs

The documentation website is built with pure HTML/CSS/JS:

```
docs/
├── index.html
├── css/style.css
├── js/main.js
└── assets/
```

To test locally:
```bash
# Using Python
cd docs && python -m http.server 8000

# Using Node.js
npx serve docs
```

---

## Security Vulnerabilities

If you discover a security vulnerability, **do not open a public issue**. Instead:

1. Email [contact.javaliajayakumar@gmail.com](mailto:contact.javaliajayakumar@gmail.com)
2. Include a description of the vulnerability
3. Include steps to reproduce
4. Allow time for a fix before public disclosure

See [SECURITY.md](./SECURITY.md) for more details.

---

## Questions?

- **GitHub Discussions**: [Start a discussion](https://github.com/AJAYMYTH/AfterLink/discussions)
- **Email**: [contact.javaliajayakumar@gmail.com](mailto:contact.javaliajayakumar@gmail.com)
- **Issues**: [Open an issue](https://github.com/AJAYMYTH/AfterLink/issues/new)

---

Thank you for contributing to AfterLink! 🚀
