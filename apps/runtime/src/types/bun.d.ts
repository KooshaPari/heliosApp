declare module "bun" {
  export type StdioMode = "pipe" | "ignore" | "inherit";

  export interface BunFile {
    text(): Promise<string>;
  }

  export interface BunWritable {
    write(data: string | Uint8Array): number;
  }

  export interface Subprocess<TStdin = any, TStdout = any, TStderr = any> {
    stdin: TStdin;
    stdout: TStdout;
    stderr: TStderr;
    readable: TStdout;
    pid: number;
    exited: Promise<number>;
    exitCode: number | null;
    kill(signal?: string): void;
  }
}

declare global {
  var Bun: {
    file(path: string): import("bun").BunFile;
    write(file: import("bun").BunFile | string, data: string | Uint8Array): Promise<number>;
    Glob: new (pattern: string) => {
      scan(options: { cwd: string; absolute?: boolean }): AsyncIterable<string>;
    };
    gc(force?: boolean): void;
    spawn(
      cmd: readonly string[],
      options?: {
        cwd?: string;
        env?: Record<string, string | undefined>;
        stdin?: import("bun").StdioMode;
        stdout?: import("bun").StdioMode;
        stderr?: import("bun").StdioMode;
      }
    ): import("bun").Subprocess;
    spawnSync(
      cmd: readonly string[],
      options?: {
        env?: Record<string, string | undefined>;
        cwd?: string;
        stdin?: import("bun").StdioMode;
        stdout?: import("bun").StdioMode;
        stderr?: import("bun").StdioMode;
      }
    ): {
      exitCode: number;
      stdout: Uint8Array;
      stderr: Uint8Array;
    };
  };

  interface GlobalThis {
    Bun: typeof Bun;
  }
}

export {};
