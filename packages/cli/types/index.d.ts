export interface PingOptions {
  count?: number;
  interval?: number;
  timeout?: number;
  tls?: boolean;
  json?: boolean;
  profile?: string;
}

export interface PingResult {
  seq: number;
  status: 'ok' | 'timeout';
  latencyMs: number | null;
}

export interface PingStats {
  host: string;
  port: number;
  protocol: string;
  sent: number;
  received: number;
  packetLoss: number;
  latency: { min: number; avg: number; max: number; unit: string } | null;
  results: PingResult[];
}

export interface CallOptions {
  tls?: boolean;
  header?: string[];
  auth?: string;
  timeout?: number;
  pretty?: boolean;
  json?: boolean;
  raw?: boolean;
  trace?: boolean;
  profile?: string;
}

export interface MonitorOptions {
  tls?: boolean;
  auth?: string;
  refresh?: number;
  requests?: boolean;
  filter?: string;
  json?: boolean;
  profile?: string;
}

export interface InspectOptions {
  tls?: boolean;
  auth?: string;
  annotate?: boolean;
  profile?: string;
}

export interface AfterLinkRc {
  default?: {
    host?: string;
    port?: number;
    tls?: boolean;
    auth?: string;
  };
  [profile: string]: {
    host?: string;
    port?: number;
    tls?: boolean;
    auth?: string;
  } | undefined;
}
