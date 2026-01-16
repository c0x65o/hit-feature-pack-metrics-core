// Minimal Node.js type shims for this package.
//
// We intentionally avoid depending on `@types/node` in feature pack repos to keep
// installs lighter and to reduce TS config coupling. These shims are "good enough"
// for our CLI entrypoints to type-check under `strict` without pulling in full Node types.

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  stdout: { write: (chunk: any) => void };
  stderr: { write: (chunk: any) => void };
  exit: (code?: number) => never;
  cwd: () => string;
};

declare namespace NodeJS {
  // Used by metrics-runner CLI
  interface ProcessEnv extends Record<string, string | undefined> {}
}

declare module 'node:child_process' {
  export type StdioOptions = any;

  export interface SpawnOptions {
    env?: Record<string, string | undefined>;
    stdio?: StdioOptions;
  }

  export interface SpawnSyncOptions {
    env?: Record<string, string | undefined>;
    stdio?: StdioOptions;
    encoding?: BufferEncoding | 'buffer' | null;
    maxBuffer?: number;
    cwd?: string;
  }

  export interface SpawnSyncReturns<T = Buffer | string> {
    status: number | null;
    stdout: T;
    stderr: T;
    error?: Error;
  }

  export interface ChildProcess {
    stdout?: { on: (event: string, cb: (d: any) => void) => void };
    stderr?: { on: (event: string, cb: (d: any) => void) => void };
    on: (event: string, cb: (...args: any[]) => void) => void;
  }

  export function spawn(command: string, args: string[], options?: SpawnOptions): ChildProcess;
  export function spawnSync(
    command: string,
    args: string[],
    options?: SpawnSyncOptions
  ): SpawnSyncReturns<string>;
}

