/**
 * Aggregator Tests
 *
 * BDD approach: Define behavior in terms of statistical results.
 */

import { describe, expect, it } from "vitest";
import { Aggregator, aggregate, getPercentiles } from "../aggregator.js";

describe("Aggregator", () => {
  describe("basic statistics", () => {
    it("should calculate count correctly", () => {
      const agg = new Aggregator([1, 2, 3, 4, 5]);
      expect(agg.getCount()).toBe(5);
    });

    it("should calculate sum correctly", () => {
      const agg = new Aggregator([1, 2, 3, 4, 5]);
      expect(agg.getSum()).toBe(15);
    });

    it("should calculate mean correctly", () => {
      const agg = new Aggregator([1, 2, 3, 4, 5]);
      expect(agg.getMean()).toBe(3);
    });

    it("should calculate min correctly", () => {
      const agg = new Aggregator([5, 3, 1, 4, 2]);
      expect(agg.getMin()).toBe(1);
    });

    it("should calculate max correctly", () => {
      const agg = new Aggregator([2, 5, 3, 1, 4]);
      expect(agg.getMax()).toBe(5);
    });

    it("should handle empty array", () => {
      const agg = new Aggregator([]);
      expect(agg.getCount()).toBe(0);
      expect(agg.getSum()).toBe(0);
      expect(agg.getMean()).toBe(0);
      expect(agg.getMin()).toBe(0);
      expect(agg.getMax()).toBe(0);
    });
  });

  describe("percentiles", () => {
    it("should calculate median (p50)", () => {
      const pResults = new Aggregator([1, 2, 3, 4, 5]).getPercentiles([50]);
      expect(pResults.get(50)).toBe(3);
    });

    it("should calculate p90", () => {
      const pResults = new Aggregator([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).getPercentiles([90]);
      expect(pResults.get(90)).toBeGreaterThan(9);
    });

    it("should calculate multiple percentiles", () => {
      const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const pResults = new Aggregator(samples).getPercentiles([50, 90, 95, 99]);

      expect(pResults.get(50)).toBe(5.5);
      expect(pResults.get(90)).toBeGreaterThan(9);
      expect(pResults.get(95)).toBeGreaterThan(9);
      expect(pResults.get(99)).toBe(10);
    });

    it("should handle edge cases for percentiles", () => {
      const agg = new Aggregator([5]);
      const pResults = agg.getPercentiles([0, 100]);
      expect(pResults.get(0)).toBe(5);
      expect(pResults.get(100)).toBe(5);
    });
  });

  describe("standard deviation", () => {
    it("should calculate stdDev for varied data", () => {
      // [1, 1, 1, 1, 1] has stdDev of 0
      const agg1 = new Aggregator([1, 1, 1, 1, 1]);
      expect(agg1.getStdDev()).toBe(0);

      // [0, 2] has stdDev of 1
      const agg2 = new Aggregator([0, 2]);
      expect(agg2.getStdDev()).toBe(1);
    });

    it("should return 0 for empty array", () => {
      const agg = new Aggregator([]);
      expect(agg.getStdDev()).toBe(0);
    });
  });

  describe("aggregate", () => {
    it("should return complete statistics", () => {
      const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = new Aggregator(samples).aggregate();

      expect(result.count).toBe(10);
      expect(result.sum).toBe(55);
      expect(result.mean).toBe(5.5);
      expect(result.min).toBe(1);
      expect(result.max).toBe(10);
      expect(result.p50).toBe(5.5);
      expect(result.p90).toBeGreaterThan(9);
      expect(result.p95).toBeGreaterThan(9);
      expect(result.p99).toBe(10);
      expect(result.stdDev).toBeGreaterThan(2.8);
    });

    it("should accept custom percentile options", () => {
      const samples = [1, 2, 3, 4, 5];
      const result = new Aggregator(samples).aggregate({
        percentiles: [25, 75],
        interpolate: false,
      });

      expect(result.p25).toBeDefined();
      expect(result.p75).toBeDefined();
    });

    it("should handle empty array", () => {
      const result = new Aggregator([]).aggregate();
      expect(result.count).toBe(0);
      expect(result.sum).toBe(0);
      expect(result.mean).toBe(0);
    });
  });

  describe("helper functions", () => {
    it("aggregate() should work as a shortcut", () => {
      const result = aggregate([1, 2, 3, 4, 5]);
      expect(result.count).toBe(5);
      expect(result.mean).toBe(3);
    });

    it("getPercentiles() should return Map", () => {
      const pMap = getPercentiles([1, 2, 3, 4, 5]);
      expect(pMap).toBeInstanceOf(Map);
      expect(pMap.get(50)).toBe(3);
    });
  });
});
