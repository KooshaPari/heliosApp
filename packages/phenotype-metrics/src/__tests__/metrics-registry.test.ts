/**
 * MetricsRegistry Tests
 *
 * BDD approach: Describe behavior in terms of metric recording and retrieval.
 * Uses the Given-When-Then pattern for clarity.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  MetricsRegistry,
  registerMetric,
  recordMetric,
  getMetric,
} from "../index.js";

describe("MetricsRegistry", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    // Create a fresh registry for each test
    registry = new MetricsRegistry();
    MetricsRegistry.resetInstance();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("registration", () => {
    it("should register a new metric", () => {
      registry.register({
        name: "test.counter",
        type: "counter",
        unit: "count",
        description: "Test counter metric",
      });

      expect(registry.has("test.counter")).toBe(true);
    });

    it("should throw when registering duplicate metric", () => {
      registry.register({
        name: "test.counter",
        type: "counter",
        unit: "count",
        description: "Test",
      });

      expect(() =>
        registry.register({
          name: "test.counter",
          type: "counter",
          unit: "count",
          description: "Duplicate",
        })
      ).toThrow();
    });

    it("should use default buffer size when not specified", () => {
      registry.register({
        name: "test.gauge",
        type: "gauge",
        unit: "bytes",
        description: "Test gauge",
      });

      const stats = registry.get("test.gauge");
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(0);
    });

    it("should support custom buffer size", () => {
      registry.register({
        name: "test.histogram",
        type: "histogram",
        unit: "ms",
        description: "Test histogram",
        bufferSize: 5000,
      });

      expect(registry.has("test.histogram")).toBe(true);
    });
  });

  describe("recording values", () => {
    it("should record a single value", () => {
      registry.register({
        name: "response.size",
        type: "gauge",
        unit: "bytes",
        description: "Response size",
      });

      registry.record("response.size", 1024);

      const stats = registry.get("response.size");
      expect(stats!.count).toBe(1);
      expect(stats!.value).toBe(1024);
    });

    it("should record multiple values", () => {
      registry.register({
        name: "request.latency",
        type: "latency",
        unit: "ms",
        description: "Request latency",
        bufferSize: 100,
      });

      registry.record("request.latency", 10);
      registry.record("request.latency", 20);
      registry.record("request.latency", 30);

      const stats = registry.get("request.latency");
      expect(stats!.count).toBe(3);
      expect(stats!.mean).toBe(20);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
    });

    it("should respect min/max bounds", () => {
      registry.register({
        name: "bounded.value",
        type: "gauge",
        unit: "percent",
        description: "Bounded value",
        min: 0,
        max: 100,
      });

      registry.record("bounded.value", 150);
      const stats = registry.get("bounded.value");
      expect(stats!.value).toBe(100); // Capped at max
    });

    it("should auto-register on first record if not exists", () => {
      // Auto-registration feature
      registry.record("auto.registered", 42);

      expect(registry.has("auto.registered")).toBe(true);
      const stats = registry.get("auto.registered");
      expect(stats!.value).toBe(42);
    });
  });

  describe("counters", () => {
    it("should increment counter", () => {
      registry.register({
        name: "requests.total",
        type: "counter",
        unit: "count",
        description: "Total requests",
      });

      registry.increment("requests.total");
      registry.increment("requests.total", 5);

      const stats = registry.get("requests.total");
      expect(stats!.value).toBe(6); // Sum of increments
    });

    it("should decrement counter", () => {
      registry.register({
        name: "connections.active",
        type: "counter",
        unit: "count",
        description: "Active connections",
      });

      registry.record("connections.active", 10);
      registry.decrement("connections.active", 3);

      const stats = registry.get("connections.active");
      expect(stats!.value).toBe(7);
    });
  });

  describe("gauges", () => {
    it("should set gauge value directly", () => {
      registry.register({
        name: "memory.used",
        type: "gauge",
        unit: "bytes",
        description: "Used memory",
      });

      registry.setGauge("memory.used", 1024 * 1024);
      registry.setGauge("memory.used", 2 * 1024 * 1024);

      const stats = registry.get("memory.used");
      // Gauge value is the last reading
      expect(stats!.value).toBe(2 * 1024 * 1024);
    });
  });

  describe("latency recording", () => {
    it("should record latency from start time", () => {
      registry.register({
        name: "operation.duration",
        type: "latency",
        unit: "ms",
        description: "Operation duration",
      });

      const start = performance.now();
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }
      registry.recordLatency("operation.duration", start);

      const stats = registry.get("operation.duration");
      expect(stats!.count).toBe(1);
      expect(stats!.value).toBeGreaterThan(0);
    });
  });

  describe("percentile calculations", () => {
    it("should calculate percentiles correctly", () => {
      registry.register({
        name: "latency.histogram",
        type: "latency",
        unit: "ms",
        description: "Latency histogram",
        bufferSize: 100,
      });

      // Record values 1-100
      for (let i = 1; i <= 100; i++) {
        registry.record("latency.histogram", i);
      }

      const stats = registry.get("latency.histogram");
      expect(stats!.p50).toBeCloseTo(50.5, 0);
      expect(stats!.p90).toBeCloseTo(90.5, 0);
      expect(stats!.p99).toBeGreaterThan(99);
    });
  });

  describe("export formats", () => {
    beforeEach(() => {
      registry.register({
        name: "test.metric",
        type: "gauge",
        unit: "count",
        description: "Test metric",
      });
      registry.record("test.metric", 42);
    });

    it("should export to JSON", () => {
      const json = registry.toJSON();
      const data = JSON.parse(json);

      expect(data.timestamp).toBeDefined();
      expect(data.metrics).toBeInstanceOf(Array);
      expect(data.metrics.length).toBeGreaterThan(0);
      expect(data.metrics[0].name).toBe("test.metric");
    });

    it("should export to Prometheus format", () => {
      const prometheus = registry.toPrometheus();

      expect(prometheus).toContain("# HELP");
      expect(prometheus).toContain("# TYPE");
      expect(prometheus).toContain("test_metric");
    });

    it("should create snapshot", () => {
      const snapshot = registry.snapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.metrics).toBeDefined();
      expect(snapshot.system).toBeDefined();
    });
  });

  describe("listing", () => {
    it("should list all metric names", () => {
      registry.register({
        name: "metric.a",
        type: "gauge",
        unit: "count",
        description: "Metric A",
      });
      registry.register({
        name: "metric.b",
        type: "counter",
        unit: "count",
        description: "Metric B",
      });

      const names = registry.listNames();
      expect(names).toContain("metric.a");
      expect(names).toContain("metric.b");
    });
  });

  describe("unregistration", () => {
    it("should unregister a metric", () => {
      registry.register({
        name: "temp.metric",
        type: "gauge",
        unit: "count",
        description: "Temporary metric",
      });

      expect(registry.unregister("temp.metric")).toBe(true);
      expect(registry.has("temp.metric")).toBe(false);
    });

    it("should return false when unregistering non-existent metric", () => {
      expect(registry.unregister("nonexistent")).toBe(false);
    });
  });

  describe("memory usage", () => {
    it("should report memory usage", () => {
      registry.register({
        name: "mem.test",
        type: "gauge",
        unit: "count",
        description: "Test",
        bufferSize: 1000,
      });

      for (let i = 0; i < 100; i++) {
        registry.record("mem.test", i);
      }

      const usage = registry.getMemoryUsage();
      expect(usage.metricCount).toBe(1);
      expect(usage.totalBufferSlots).toBe(1000);
      expect(usage.estimatedBytes).toBeGreaterThan(0);
    });
  });
});
