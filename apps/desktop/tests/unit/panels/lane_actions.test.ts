<<<<<<< HEAD
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
const vi = { fn: mock, spyOn: spyOn };
import { LaneActions, type RuntimeApi } from "../../../src/panels/lane_actions";

describe("LaneActions", () => {
  let actions: LaneActions;
  let mockApi: RuntimeApi;

  const createMockApi = (): RuntimeApi => ({
=======
import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { LaneActions } from "../../../src/panels/lane_actions";
import type { RuntimeAPI } from "../../../src/panels/lane_actions";

describe("LaneActions", () => {
  let actions: LaneActions;
  let mockAPI: RuntimeAPI;

  const createMockAPI = (): RuntimeAPI => ({
>>>>>>> origin/main
    createLane: vi.fn().mockResolvedValue({ id: "lane-new", name: "New Lane" }),
    attachLane: vi.fn().mockResolvedValue(undefined),
    detachLane: vi.fn().mockResolvedValue(undefined),
    cleanupLane: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
<<<<<<< HEAD
    mockApi = createMockApi();
=======
    mockAPI = createMockAPI();
>>>>>>> origin/main
  });

  afterEach(() => {
    if (actions) {
      actions.destroy();
    }
  });

  it("should create lane successfully", async () => {
    const onLaneCreated = vi.fn();
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onLaneCreated,
    });

    await actions.createLane("ws-1");

<<<<<<< HEAD
    expect(mockApi.createLane).toHaveBeenCalledWith("ws-1");
=======
    expect(mockAPI.createLane).toHaveBeenCalledWith("ws-1");
>>>>>>> origin/main
    expect(onLaneCreated).toHaveBeenCalledWith("lane-new");
  });

  it("should call optimistic callback on create", async () => {
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
    });

    const optimisticCallback = vi.fn();

    await actions.createLane("ws-1", optimisticCallback);

    expect(optimisticCallback).toHaveBeenCalled();
  });

  it("should handle create lane error", async () => {
    const error = new Error("API error");
<<<<<<< HEAD
    mockApi.createLane = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeApi: mockApi,
=======
    mockAPI.createLane = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
    });

    await actions.createLane("ws-1");

    expect(onError).toHaveBeenCalled();
    const errorArg = (onError as any).mock.calls[0][0];
    expect(errorArg.code).toBe("CREATE_FAILED");
  });

  it("should attach lane successfully", async () => {
    const onLaneAttached = vi.fn();
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onLaneAttached,
    });

    await actions.attachLane("lane-1");

<<<<<<< HEAD
    expect(mockApi.attachLane).toHaveBeenCalledWith("lane-1");
=======
    expect(mockAPI.attachLane).toHaveBeenCalledWith("lane-1");
>>>>>>> origin/main
    expect(onLaneAttached).toHaveBeenCalledWith("lane-1");
  });

  it("should handle attach lane error", async () => {
<<<<<<< HEAD
    mockApi.attachLane = vi.fn().mockRejectedValue(new Error("Attach failed"));
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeApi: mockApi,
=======
    mockAPI.attachLane = vi.fn().mockRejectedValue(new Error("Attach failed"));
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
    });

    await actions.attachLane("lane-1");

    expect(onError).toHaveBeenCalled();
    const errorArg = (onError as any).mock.calls[0][0];
    expect(errorArg.code).toBe("ATTACH_FAILED");
  });

  it("should detach lane successfully", async () => {
    const onLaneDetached = vi.fn();
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onLaneDetached,
    });

    await actions.detachLane("lane-1");

<<<<<<< HEAD
    expect(mockApi.detachLane).toHaveBeenCalledWith("lane-1");
=======
    expect(mockAPI.detachLane).toHaveBeenCalledWith("lane-1");
>>>>>>> origin/main
    expect(onLaneDetached).toHaveBeenCalledWith("lane-1");
  });

  it("should handle detach lane error", async () => {
<<<<<<< HEAD
    mockApi.detachLane = vi.fn().mockRejectedValue(new Error("Detach failed"));
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeApi: mockApi,
=======
    mockAPI.detachLane = vi.fn().mockRejectedValue(new Error("Detach failed"));
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
    });

    await actions.detachLane("lane-1");

    expect(onError).toHaveBeenCalled();
  });

  it("should cleanup lane successfully", async () => {
    const onLaneCleaned = vi.fn();
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onLaneCleaned,
    });

    const result = await actions.cleanupLane("lane-1", false);

<<<<<<< HEAD
    expect(mockApi.cleanupLane).toHaveBeenCalledWith("lane-1");
=======
    expect(mockAPI.cleanupLane).toHaveBeenCalledWith("lane-1");
>>>>>>> origin/main
    expect(onLaneCleaned).toHaveBeenCalledWith("lane-1");
    expect(result).toBe(true);
  });

  it("should handle cleanup lane error", async () => {
<<<<<<< HEAD
    mockApi.cleanupLane = vi.fn().mockRejectedValue(new Error("Cleanup failed"));
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeApi: mockApi,
=======
    mockAPI.cleanupLane = vi.fn().mockRejectedValue(new Error("Cleanup failed"));
    const onError = vi.fn();

    actions = new LaneActions({
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
    });

    const result = await actions.cleanupLane("lane-1", false);

    expect(onError).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it("should dismiss error by code", async () => {
    const onError = vi.fn();
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
      errorDismissTimeout: 10000,
    });

<<<<<<< HEAD
    mockApi.createLane = vi.fn().mockRejectedValue(new Error("Create failed"));
=======
    mockAPI.createLane = vi.fn().mockRejectedValue(new Error("Create failed"));
>>>>>>> origin/main
    await actions.createLane("ws-1");

    expect(onError).toHaveBeenCalled();

    actions.dismissError("CREATE_FAILED");
    // Error should be dismissed (test passes if no exception thrown)
  });

  it("should clear all errors", async () => {
    const onError = vi.fn();
    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
      errorDismissTimeout: 10000,
    });

<<<<<<< HEAD
    mockApi.createLane = vi.fn().mockRejectedValue(new Error("Create failed"));
    await actions.createLane("ws-1");

    mockApi.attachLane = vi.fn().mockRejectedValue(new Error("Attach failed"));
=======
    mockAPI.createLane = vi.fn().mockRejectedValue(new Error("Create failed"));
    await actions.createLane("ws-1");

    mockAPI.attachLane = vi.fn().mockRejectedValue(new Error("Attach failed"));
>>>>>>> origin/main
    await actions.attachLane("lane-1");

    expect(onError).toHaveBeenCalledTimes(2);

    actions.clearAllErrors();
    // All errors should be cleared
  });

  it("should revert optimistic update on error", async () => {
<<<<<<< HEAD
    mockApi.attachLane = vi.fn().mockRejectedValue(new Error("Attach failed"));
=======
    mockAPI.attachLane = vi.fn().mockRejectedValue(new Error("Attach failed"));
>>>>>>> origin/main
    const onError = vi.fn();
    const revertCallback = vi.fn();

    actions = new LaneActions({
<<<<<<< HEAD
      runtimeApi: mockApi,
=======
      runtimeAPI: mockAPI,
>>>>>>> origin/main
      onError,
    });

    await actions.attachLane("lane-1", revertCallback);

    expect(revertCallback).toHaveBeenCalled();
  });
});
