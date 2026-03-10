import type { LocalBus } from "../protocol/bus.js";
import { RecoveryStage } from "./state-machine.js";
import type { RestorationResult } from "./restoration.js";
import type { CleanupResult } from "./orphan-reconciler.js";

export interface BannerConfig {
  containerId?: string;
  position?: "top" | "bottom";
  autoHide?: boolean;
  hideDelayMs?: number;
}

export class RecoveryBanner {
  private bus?: LocalBus;
  private isVisible = false;
  private currentStage: RecoveryStage | null = null;
  private isActive = false;
  private config: BannerConfig;

  constructor(bus?: LocalBus, config: BannerConfig = {}) {
    this.bus = bus;
    this.config = {
      position: config.position || "top",
      autoHide: config.autoHide !== false,
      hideDelayMs: config.hideDelayMs || 5000,
      ...config,
    };

    if (bus) {
      this.subscribeToStageChanges();
    }
  }

  show(stage: RecoveryStage): void {
    this.isVisible = true;
    this.currentStage = stage;
    this.isActive = stage !== RecoveryStage.Live && stage !== RecoveryStage.Crashed;
    this.renderBanner();
  }

  updateProgress(stage: RecoveryStage, detail: string): void {
    this.currentStage = stage;
    this.isActive = stage !== RecoveryStage.Live && stage !== RecoveryStage.Crashed;
    this.renderBanner(detail);
  }

  showSummary(
    result: RestorationResult,
    orphanResult: CleanupResult
  ): void {
    this.isActive = false;
    this.renderSummary(result, orphanResult);

    if (this.config.autoHide) {
      setTimeout(() => {
        this.dismiss();
      }, this.config.hideDelayMs);
    }
  }

  dismiss(): void {
    this.isVisible = false;
    this.currentStage = null;
    this.clearBanner();
  }

  isActiveBanner(): boolean {
    return this.isActive && this.isVisible;
  }

  private getStageMessage(stage: RecoveryStage): string {
    const messages: Record<RecoveryStage, string> = {
      [RecoveryStage.Crashed]: "Detecting crash...",
      [RecoveryStage.Detecting]: "Detecting crash... checking processes.",
      [RecoveryStage.Inventorying]: "Inventorying recoverable state...",
      [RecoveryStage.Restoring]: "Restoring sessions...",
      [RecoveryStage.Reconciling]: "Cleaning up orphaned processes...",
      [RecoveryStage.Live]: "Recovery complete!",
      [RecoveryStage.DetectionFailed]: "Crash detection failed. Manual recovery may be needed.",
      [RecoveryStage.InventoryFailed]: "Failed to inventory state. Some sessions may be lost.",
      [RecoveryStage.RestorationFailed]: "Session restoration encountered errors.",
      [RecoveryStage.ReconciliationFailed]: "Orphan reconciliation encountered errors.",
    };
    return messages[stage] || "Recovering...";
  }

  private renderBanner(detail?: string): void {
    if (!this.isVisible || !this.currentStage) return;

    const message = this.getStageMessage(this.currentStage);
    const fullMessage = detail ? `${message} ${detail}` : message;

    // In a real implementation, this would render to the UI
    // For now, log to console
    console.log(`[Recovery Banner] ${fullMessage}`);
  }

  private renderSummary(
    result: RestorationResult,
    orphanResult: CleanupResult
  ): void {
    const hasIssues = result.failed.length > 0;
    const header = hasIssues
      ? "Recovery complete with issues"
      : "Recovery complete";

    const summary = {
      header,
      restored: result.restored.map((s) => s.zellijSessionName || s.sessionId),
      failed: result.failed.map((f) => ({
        sessionId: f.sessionId,
        reason: f.reason,
        suggestion: f.suggestion,
      })),
      duration: `${(result.duration / 1000).toFixed(1)}s`,
      orphansCleaned: orphanResult.terminated + orphanResult.removed,
      orphansPending: orphanResult.reviewPending,
    };

    // In a real implementation, this would render to the UI
    console.log("[Recovery Summary]", JSON.stringify(summary, null, 2));
  }

  private clearBanner(): void {
    // In a real implementation, this would remove the banner from the DOM
    console.log("[Recovery Banner] Dismissed");
  }

  private subscribeToStageChanges(): void {
    if (!this.bus) return;

    // In a real implementation, this would subscribe to bus events
    // For now, this is a no-op
    // The banner would be shown reactively when stage change events are published
  }
}
