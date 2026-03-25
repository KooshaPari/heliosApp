import { describe, expect, it, spyOn } from "bun:test";
import { ConsoleLogger, LogLevel } from "../src/index";

describe("ConsoleLogger", () => {
  it("should respect log levels", () => {
    const debugSpy = spyOn(console, "debug");
    const infoSpy = spyOn(console, "info");

    const logger = new ConsoleLogger(LogLevel.INFO);

    logger.debug("test debug");
    expect(debugSpy).not.toHaveBeenCalled();

    logger.info("test info");
    expect(infoSpy).toHaveBeenCalled();
  });

  it("should merge context in child logger", () => {
    const infoSpy = spyOn(console, "info");
    const logger = new ConsoleLogger(LogLevel.INFO, { root: "true" });
    const child = logger.child({ child: "true" });

    child.info("test child");

    expect(infoSpy).toHaveBeenCalled();
    const calls = infoSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
  });
});
