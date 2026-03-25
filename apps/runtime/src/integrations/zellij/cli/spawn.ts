export interface SpawnProcessLike {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
  kill?: (signal?: number) => void;
}

export function spawnProcess(command: string[]): SpawnProcessLike {
  const bunRuntime = (globalThis as Record<string, unknown>).Bun as
    | {
        spawn(
          cmd: string[],
          options: { stdout: "pipe"; stderr: "pipe" },
        ): SpawnProcessLike;
      }
    | undefined;
  if (!bunRuntime) {
    throw new Error("ZellijCli requires Bun runtime");
  }
  return bunRuntime.spawn(command, { stdout: "pipe", stderr: "pipe" });
}
