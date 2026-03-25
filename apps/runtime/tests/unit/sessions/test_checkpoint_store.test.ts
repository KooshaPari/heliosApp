import { describe, expect, test } from "bun:test";
import { Slice1CheckpointStorePlaceholder } from '../../../src/sessions/checkpoint_store';

describe("checkpoint store placeholder", () => {
  test("stays non-operational in slice-1", async () => {
    const store = new Slice1CheckpointStorePlaceholder();
    await expect(store.save()).rejects.toThrow("slice_2_durability_not_implemented");
    await expect(store.latest()).resolves.toBeNull();
    await expect(store.list()).resolves.toEqual([]);
  });
});
