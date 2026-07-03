import { EventEmitter } from 'events';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  tls?: boolean;
  keyPrefix?: string;
  [key: string]: any;
}

export interface ClusterConfig {
  workers?: number;
  restartOnCrash?: boolean;
  restartDelay?: number;
  gracefulTimeout?: number;
  redis?: RedisConfig;
}

export class ClusterManager extends EventEmitter {
  constructor(config: ClusterConfig);
  start(): void;
  forkWorker(): any;
  getAggregatedStats(): Record<string, any>;
  shutdown(): void;
}

export function createCluster(
  config: ClusterConfig | undefined,
  workerFn: () => void
): ClusterManager | null;
