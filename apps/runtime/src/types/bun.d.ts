declare const Bun: {
  spawn(
    cmd: readonly string[],
    options: {
      stdout: "pipe";
      stderr: "pipe";
    }
  ): {
    stdout: ReadableStream<Uint8Array> | null;
    stderr: ReadableStream<Uint8Array> | null;
    exited: Promise<number>;
  };
};
