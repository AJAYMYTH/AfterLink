const fs = require('fs');
const path = require('path');

// Domain-specific terms for spell correction
const DOMAIN_DICTIONARY = [
  'afterlink', 'install', 'setup', 'initialize', 'connect', 'connection', 'connections', 'server', 'client',
  'router', 'frame', 'serializer', 'tcp', 'websocket', 'middleware', 'validation',
  'zod', 'tls', 'certificate', 'heartbeat', 'ping', 'pong', 'stream', 'subscription',
  'channel', 'payload', 'latency', 'bandwidth', 'multiplexing', 'config', 'configure',
  'configuration', 'npm', 'pnpm', 'npx', 'cli', 'version', 'readme', 'overview',
  'error', 'handler', 'request', 'response', 'auth', 'jwt', 'token', 'broker', 'pubsub',
  'integration', 'integrate', 'benchmark', 'performance', 'latency', 'security', 'encryption',
  'browser', 'browsers', 'bridge', 'bridges', 'secure', 'certificates', 'spec', 'specs',
  'specification', 'specifications', 'close', 'closed', 'cleanly', 'clean', 'initialized',
  'initialization', 'speed', 'benchmarks', 'brokers', 'publish', 'subscribe', 'ws', 'credential',
  'credentials', 'verify', 'verification',
  // Reconnect family kept separate so 'reconnection' is never false-corrected to 'connection'
  'reconnect', 'reconnection', 'reconnecting', 'reconnected'
];

// Helper to calculate Levenshtein distance between two strings
function getLevenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + 1   // substitution
        );
      }
    }
  }
  return dp[m][n];
}

// Corrects typos for a single token using the domain dictionary
function correctToken(token) {
  const lower = token.toLowerCase();
  
  // If it's a known domain word or too short, keep it
  if (DOMAIN_DICTIONARY.includes(lower) || token.length <= 3) {
    return token;
  }

  let bestMatch = token;
  let minDistance = Infinity;

  for (const dictWord of DOMAIN_DICTIONARY) {
    // Only correct if length difference is small to save CPU
    if (Math.abs(dictWord.length - lower.length) > 2) continue;

    const distance = getLevenshteinDistance(lower, dictWord);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = dictWord;
    }
  }

  // Apply correction only when the edit distance is ≤ ~15% of word length.
  // This stricter ratio prevents proper nouns (e.g. "france" → "frame") from
  // being falsely corrected to domain terms while still catching real typos
  // like "conection" (distance 1) and "configuer" (distance 2).
  const maxAllowedDistance = lower.length <= 4 ? 1 : Math.ceil(lower.length * 0.15);
  if (minDistance <= maxAllowedDistance) {
    // Retain case if possible, otherwise lower
    return token === token.toUpperCase() ? bestMatch.toUpperCase() : bestMatch;
  }

  return token;
}

// Expands domain specific acronyms and synonyms
function expandAcronyms(query) {
  const acronyms = {
    // Acronyms
    tls: 'TLS transport layer security encryption certificates ssl',
    api: 'API application programming interface specs specifications documentation',
    zod: 'Zod schema validation rules payload',
    repl: 'REPL read eval print loop cli',
    ping: 'ping heartbeat connection check latency',
    svr: 'server listen initialize setup',
    conn: 'connection TCP client connect',
    conns: 'connection TCP client connect',
    config: 'configuration setup options',
    auth: 'authentication JWT token credentials verify security',
    doc: 'documentation overview guide README',
    docs: 'documentation overview guide README',
    err: 'error exceptions validationerror protocolerror',
    cli: 'CLI command line interface tool ping call inspect',
    ws: 'websocket browser bridge ws-bridge',
    pg: 'postgresql database pg client pool',
    tcp: 'TCP connection client transport',
    jwt: 'JWT JSON Web Token auth authentication secret token verify credentials',

    // Synonyms - Singular & Plural
    initialize: 'initialize setup server listen start new server',
    initialized: 'initialize setup server listen start new server',
    initialization: 'initialize setup server listen start new server',
    certificates: 'certificates TLS SSL encryption key certificate secure',
    certificate: 'certificates TLS SSL encryption key certificate secure',
    cleanly: 'cleanly graceful shutdown close connection exit',
    clean: 'cleanly graceful shutdown close connection exit',
    close: 'close graceful shutdown connection exit',
    closed: 'close graceful shutdown connection exit',
    latency: 'latency speed benchmark ping round-trip milliseconds performance',
    speed: 'latency speed benchmark ping round-trip milliseconds performance',
    verify: 'verify JWT auth token secret credentials',
    verification: 'verify JWT auth token secret credentials',
    credentials: 'credentials JWT auth token secret verify',
    credential: 'credentials JWT auth token secret verify',
    broker: 'pub/sub broker publish subscribe pubsub real-time messaging channel topic',
    brokers: 'pub/sub broker publish subscribe pubsub real-time messaging channel topic',
    pubsub: 'pub/sub broker publish subscribe pubsub real-time messaging channel topic',
    bridge: 'bridge browser WebSocket websocket ws-bridge',
    bridges: 'bridge browser WebSocket websocket ws-bridge',
    specs: 'specifications documentation overview README API docs afterlink reference protocol',
    spec: 'specifications documentation overview README API docs afterlink reference protocol',
    specification: 'specifications documentation overview README API docs afterlink reference protocol',
    specifications: 'specifications documentation overview README API docs afterlink reference protocol',
    secure: 'secure TLS SSL encryption certificates key certificate',
    security: 'secure TLS SSL encryption certificates key certificate',
    browser: 'browser bridge WebSocket websocket ws-bridge',
    browsers: 'browser bridge WebSocket websocket ws-bridge',
    router: 'router Frame Router dispatch routes middleware handler server connection',
    frame: 'frame binary protocol header packet 10-byte payload serializer'
  };

  let words = query.split(/\s+/);
  words = words.map(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (acronyms[cleanWord]) {
      return acronyms[cleanWord];
    }
    return word;
  });

  return words.join(' ');
}

const STOPWORDS = new Set([
  'how', 'to', 'does', 'the', 'a', 'an', 'my', 'with', 'is', 'on', 'for', 
  'what', 'about', 'and', 'or', 'do', 'i', 'your', 'of', 'in', 'at', 'by', 
  'can', 'you', 'we', 'they', 'them', 'this', 'that', 'there', 'here', 
  'from', 'as', 'but', 'not', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had'
]);

/**
 * Preprocesses user query
 * - Lowercases (optional, but standard for matching while preserving tech terms)
 * - Strips common stopwords to prevent semantic dilution
 * - Spell checks tokens using a domain dictionary
 * - Expands AfterLink acronyms
 * - Cleans excessive punctuation
 */
function preprocessQuery(query) {
  if (!query) return '';

  // Transform phrase 'set up' to 'setup' so that it doesn't get stripped as stopwords
  let normalizedQuery = query.replace(/\bset\s+up\b/gi, 'setup');
  
  // Strip excessive punctuation but preserve technical signs like /, _, -, .
  let cleanQuery = normalizedQuery.replace(/[^\w\s\/\_\-\.]/g, ' ').replace(/\s+/g, ' ').trim();

  // Split into tokens
  let tokens = cleanQuery.split(/\s+/);

  // Filter out common stopwords
  tokens = tokens.filter(token => !STOPWORDS.has(token.toLowerCase()));

  // Spell correction on word-by-word basis
  tokens = tokens.map(token => {
    // Preserve dots/slashes in paths and technical terms
    if (token.includes('.') || token.includes('/') || token.includes('_')) {
      return token;
    }
    return correctToken(token);
  });

  cleanQuery = tokens.join(' ');

  // Acronym and synonym expansion
  cleanQuery = expandAcronyms(cleanQuery);

  // Deduplicate words in the final query to prevent bloated query penalty, preserving order
  const finalWords = [];
  const seenWords = new Set();
  for (const word of cleanQuery.split(/\s+/)) {
    const lowerWord = word.toLowerCase();
    if (!seenWords.has(lowerWord)) {
      seenWords.add(lowerWord);
      finalWords.push(word);
    }
  }

  return finalWords.join(' ');
}

module.exports = {
  preprocessQuery,
  correctToken,
  expandAcronyms
};
