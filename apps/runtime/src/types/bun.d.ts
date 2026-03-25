/**
 * Bun Type Augmentations
 *
 * These augmentations extend the Bun types to include APIs not covered by bun-types
 * or that have changed between Bun versions.
 *
 * @see https://bun.sh/docs/runtime/typescript
 */

declare const Bun: {
  /**
   * Force garbage collection.
   * @param fullGC If true, performs a full garbage collection.
   */
  gc(fullGC?: boolean): void;

  /**
   * Read a file as a File object.
   */
  file(path: string): {
    exists(): Promise<boolean>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    bytes(): Promise<Uint8Array>;
    size: number;
    type: string;
  };

  /**
   * Glob pattern matcher for finding files.
   */
  Glob: new (
    pattern: string
  ) => {
    scan(options?: { cwd?: string; onlyFiles?: boolean }): Generator<string>;
  };

  /**
   * Spawn a subprocess synchronously.
   */
  spawnSync(
    cmd: readonly string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      stdin?: "inherit" | "pipe" | "ignore";
      stdout?: "inherit" | "pipe" | "ignore";
      stderr?: "inherit" | "pipe" | "ignore";
    }
  ): {
    stdout: Buffer | string | null;
    stderr: Buffer | string | null;
    exitCode: number | null;
  };

  /**
   * Spawn a subprocess.
   */
  spawn(
    cmd: readonly string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      stdin?: "pipe" | "inherit" | "ignore";
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
      detached?: boolean;
    }
  ): {
    readonly pid: number;
    readonly stdin: WritableStream<Uint8Array> | null;
    readonly stdout: ReadableStream<Uint8Array> | null;
    readonly stderr: ReadableStream<Uint8Array> | null;
    exited: Promise<number>;
    exitCode: Promise<number>;
    kill(signal?: number): void;
  };

  /**
   * Write data to a file.
   */
  write(path: string, data: string | ArrayBuffer | Uint8Array): number;
};

interface GlobalThis {
  Bun: typeof Bun;
}
