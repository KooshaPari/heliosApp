export interface QueuedTerminalCreation {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  params: unknown;
  createdAt: number;
  queueTimeoutMs?: number;
}

export class SwitchTerminalCreationQueue {
  private readonly items: QueuedTerminalCreation[] = [];

  enqueue(params: unknown, timeoutMs: number): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const queued: QueuedTerminalCreation = {
        resolve,
        reject,
        params,
        createdAt: Date.now(),
        queueTimeoutMs: timeoutMs,
      };

      this.items.push(queued);

      const timeoutId = setTimeout(() => {
        const index = this.items.indexOf(queued);
        if (index >= 0) {
          this.items.splice(index, 1);
          reject(
            new Error(
              `Terminal creation request timed out after ${timeoutMs}ms ` +
                "while switch is active",
            ),
          );
        }
      }, timeoutMs);

      (queued as QueuedTerminalCreation & { timeoutId: ReturnType<typeof setTimeout> }).timeoutId =
        timeoutId;
    });
  }

  drain(): void {
    const queue = [...this.items];
    this.items.length = 0;

    for (const queued of queue) {
      const timeoutId = (queued as QueuedTerminalCreation & {
        timeoutId?: ReturnType<typeof setTimeout>;
      }).timeoutId;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      queued.resolve(queued.params);
    }
  }
}
