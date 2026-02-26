import { expect, test } from "@playwright/test";
import { createRuntime } from "../../../runtime/src";
import { bootDesktop, renderControlPlaneSnapshot } from "../../src";

test("lane/session context remains cohesive across all tabs", async ({ page }) => {
  const runtime = createRuntime();
  const controlPlane = bootDesktop({ bus: runtime.bus });

  const lane = await controlPlane.createLane({
    workspaceId: "workspace_e2e",
    simulateDegrade: true
  });
  expect(lane.ok).toBe(true);
  expect(lane.laneId).not.toBeNull();
  const session = await controlPlane.ensureSession({
    workspaceId: "workspace_e2e",
    laneId: lane.laneId as string
  });
  expect(session.ok).toBe(true);
  expect(session.sessionId).not.toBeNull();
  await controlPlane.spawnTerminal({
    workspaceId: "workspace_e2e",
    laneId: lane.laneId as string,
    sessionId: session.sessionId as string
  });

  controlPlane.setActiveTab("terminal");
  controlPlane.setActiveTab("agent");
  controlPlane.setActiveTab("session");
  controlPlane.setActiveTab("chat");
  controlPlane.setActiveTab("project");

  await page.setContent(renderControlPlaneSnapshot(controlPlane));

  for (const tab of ["terminal", "agent", "session", "chat", "project"]) {
    await expect(page.getByTestId(`tab-${tab}-workspace`)).toHaveText("workspace_e2e");
    await expect(page.getByTestId(`tab-${tab}-lane`)).toHaveText(lane.laneId as string);
    await expect(page.getByTestId(`tab-${tab}-session`)).toHaveText(session.sessionId as string);
  }

  const diagnostics = controlPlane.store.getState().diagnostics;
  await expect(page.getByTestId("tab-chat-transport")).toHaveText(diagnostics.resolvedTransport);
  await expect(page.getByTestId("tab-chat-degrade")).toHaveText(
    diagnostics.degradedReason ?? "none"
  );
});

test("renderer switch failure rolls back and reports safe status", async ({ page }) => {
  const runtime = createRuntime();
  const controlPlane = bootDesktop({ bus: runtime.bus });
  controlPlane.setWorkspace("workspace_renderer");

  await controlPlane.createLane({ workspaceId: "workspace_renderer" });
  const outcome = await controlPlane.switchRenderer("rio", { forceError: true });
  await page.setContent(renderControlPlaneSnapshot(controlPlane));

  expect(outcome.committed).toBe(false);
  expect(outcome.rolledBack).toBe(true);
  await expect(page.getByTestId("renderer-engine")).toHaveText("ghostty");
  await expect(page.getByTestId("renderer-switch-status")).toHaveText("rolled_back");
});
