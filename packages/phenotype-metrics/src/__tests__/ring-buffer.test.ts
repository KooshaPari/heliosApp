/**
 * RingBuffer Tests
 *
 * TDD approach: Write failing tests first, then implement.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { RingBuffer } from "../ring-buffer.js";

describe("RingBuffer", () => {
  describe("constructor", () => {
    it("should create a buffer with the specified capacity", () => {
      const buffer = new RingBuffer<number>(5);
      expect(buffer.capacity).toBe(5);
    });

    it("should throw if capacity is zero or negative", () => {
      expect(() => new RingBuffer<number>(0)).toThrow();
      expect(() => new RingBuffer<number>(-1)).toThrow();
    });

    it("should have zero length on creation", () => {
      const buffer = new RingBuffer<number>(10);
      expect(buffer.length).toBe(0);
    });
  });

  describe("push", () => {
    it("should add elements to the buffer", () => {
      const buffer = new RingBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      expect(buffer.length).toBe(2);
    });

    it("should overwrite oldest elements when full (FIFO behavior)", () => {
      const buffer = new RingBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Should overwrite 1

      expect(buffer.length).toBe(3);
      expect(buffer.toArray()).toEqual([2, 3, 4]);
    });

    it("should maintain correct order", () => {
      const buffer = new RingBuffer<string>(5);
      buffer.push("a");
      buffer.push("b");
      buffer.push("c");
      expect(buffer.toArray()).toEqual(["a", "b", "c"]);
    });
  });

  describe("toArray", () => {
    it("should return empty array for empty buffer", () => {
      const buffer = new RingBuffer<number>(5);
      expect(buffer.toArray()).toEqual([]);
    });

    it("should return all elements in correct order", () => {
      const buffer = new RingBuffer<number>(5);
      buffer.push(10);
      buffer.push(20);
      buffer.push(30);
      expect(buffer.toArray()).toEqual([10, 20, 30]);
    });
  });

  describe("clear", () => {
    it("should remove all elements", () => {
      const buffer = new RingBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.clear();
      expect(buffer.length).toBe(0);
      expect(buffer.toArray()).toEqual([]);
    });

    it("should not change capacity after clear", () => {
      const buffer = new RingBuffer<number>(5);
      buffer.push(1);
      buffer.clear();
      expect(buffer.capacity).toBe(5);
    });
  });

  describe("get", () => {
    it("should return element at index", () => {
      const buffer = new RingBuffer<number>(5);
      buffer.push(10);
      buffer.push(20);
      buffer.push(30);
      expect(buffer.get(0)).toBe(10);
      expect(buffer.get(1)).toBe(20);
      expect(buffer.get(2)).toBe(30);
    });

    it("should return undefined for invalid index", () => {
      const buffer = new RingBuffer<number>(5);
      buffer.push(1);
      expect(buffer.get(-1)).toBeUndefined();
      expect(buffer.get(1)).toBeUndefined();
    });

    it("should return undefined for empty buffer", () => {
      const buffer = new RingBuffer<number>(5);
      expect(buffer.get(0)).toBeUndefined();
    });
  });

  describe("fill", () => {
    it("should fill buffer with a single value", () => {
      const buffer = new RingBuffer<number>(3);
      buffer.fill(5);
      expect(buffer.toArray()).toEqual([5, 5, 5]);
    });
  });

  describe("fill with callback", () => {
    it("should fill buffer using index callback", () => {
      const buffer = new RingBuffer<number>(3);
      buffer.fill((i) => i * 10);
      expect(buffer.toArray()).toEqual([0, 10, 20]);
    });
  });

  describe("iterator", () => {
    it("should iterate over all elements", () => {
      const buffer = new RingBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      const result: number[] = [];
      for (const item of buffer) {
        result.push(item);
      }
      expect(result).toEqual([1, 2, 3]);
    });

    it("should work with Array.from", () => {
      const buffer = new RingBuffer<string>(5);
      buffer.push("a");
      buffer.push("b");
      expect(Array.from(buffer)).toEqual(["a", "b"]);
    });
  });
});
