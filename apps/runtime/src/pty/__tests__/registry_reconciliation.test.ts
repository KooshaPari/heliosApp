import { describe, expect, it } from "bun:test";
import { collectOrphanPidsFromPsOutput } from "../registry_reconciliation.js";

describe("collectOrphanPidsFromPsOutput", () => {
  it("returns shell children that are not already tracked", () => {
    const output = [
      "PID PPID COMM",
      "100 1 bash",
      "101 1 zsh",
      "102 1 node",
      "103 50 bash",
      "104 1 -sh",
      "105 1 fish",
    ].join("\n");

    const orphanPids = collectOrphanPidsFromPsOutput(
      output,
      50,
      ["bash", "zsh", "sh", "fish"],
      new Set([101]),
    );

    expect(orphanPids).toEqual([100, 103, 104, 105]);
  });

  it("ignores malformed rows and unrelated processes", () => {
    const output = [
      "PID PPID COMM",
      "bad row",
      "200 1 python",
      "201 77 bash",
      "202 1 /bin/sh",
    ].join("\n");

    const orphanPids = collectOrphanPidsFromPsOutput(output, 1, ["bash", "sh"]);

    expect(orphanPids).toEqual([202]);
  });
});
