export type ReadableSpawn = {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  exited: Promise<number>;
};

type BunReadableRuntime = {
  spawn(cmd: readonly string[], options: { stdout: "pipe"; stderr: "pipe" }): ReadableSpawn;
};

export function spawnReadableProcess(
  command: readonly string[],
  runtimeErrorMessage: string
): ReadableSpawn {
  const bunRuntime = (globalThis as Record<string, unknown>).Bun as BunReadableRuntime | undefined;
  if (!bunRuntime) {
    throw new Error(runtimeErrorMessage);
  }
  return bunRuntime.spawn(command, { stdout: "pipe", stderr: "pipe" });
}

export async function readStdoutText(proc: ReadableSpawn): Promise<string> {
  if (proc.stdout === null) {
    return "";
  }
  return await new Response(proc.stdout).text();
}
