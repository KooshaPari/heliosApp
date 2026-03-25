import { cpus, totalmem } from "node:os";

export interface HardwareCapabilities {
  platform: string;
  arch: string;
  hasAppleSilicon: boolean;
  hasNvidiaGpu: boolean;
<<<<<<< HEAD
  gpuName?: string | undefined;
  gpuMemoryMB?: number | undefined;
=======
  gpuName?: string;
  gpuMemoryMB?: number;
>>>>>>> origin/main
  cpuCores: number;
  ramMB: number;
}

let cached: HardwareCapabilities | null = null;

export async function detectHardware(): Promise<HardwareCapabilities> {
<<<<<<< HEAD
  if (cached) {
    return cached;
  }
=======
  if (cached) return cached;
>>>>>>> origin/main

  const platform = process.platform;
  const arch = process.arch;
  const hasAppleSilicon = platform === "darwin" && arch === "arm64";

  let hasNvidiaGpu = false;
  let gpuName: string | undefined;
<<<<<<< HEAD
  let gpuMemoryMb: number | undefined;
=======
  let gpuMemoryMB: number | undefined;
>>>>>>> origin/main

  try {
    const proc = Bun.spawn(
      ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0 && output.trim()) {
      const [name, memStr] = output.trim().split(", ");
      hasNvidiaGpu = true;
      gpuName = name;
<<<<<<< HEAD
      gpuMemoryMb = Number.parseInt(memStr, 10);
=======
      gpuMemoryMB = Number.parseInt(memStr, 10);
>>>>>>> origin/main
    }
  } catch {
    // nvidia-smi not available
  }

<<<<<<< HEAD
  const result: HardwareCapabilities = {
=======
  cached = {
>>>>>>> origin/main
    platform,
    arch,
    hasAppleSilicon,
    hasNvidiaGpu,
<<<<<<< HEAD
    ...(gpuName !== undefined && { gpuName }),
    ...(gpuMemoryMb !== undefined && { gpuMemoryMB: gpuMemoryMb }),
    cpuCores: cpus().length,
    ramMB: Math.round(totalmem() / (1024 * 1024)),
  };
  cached = result;
  return result;
=======
    gpuName,
    gpuMemoryMB,
    cpuCores: cpus().length,
    ramMB: Math.round(totalmem() / (1024 * 1024)),
  };
  return cached;
>>>>>>> origin/main
}
