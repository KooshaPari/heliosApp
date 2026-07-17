/**
 * Switch Status Indicator
 * Shows real-time progress during renderer switch transactions
 */

export type SwitchPhase =
  | "started"
  | "initializing"
  | "swapping"
  | "committing"
  | "committed"
  | "rolled_back"
  | "failed";

export interface SwitchStatusProps {
  phase?: SwitchPhase;
  isActive: boolean;
  failureReason?: string;
  elapsedMs?: number;
}

export class SwitchStatus {
  private container: HTMLElement | null = null;
  private props: SwitchStatusProps = { isActive: false };
  private startTime = 0;
  private updateInterval?: NodeJS.Timeout | undefined;

  mount(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  unmount(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.container = null;
  }

  update(props: Partial<SwitchStatusProps>): void {
    Object.assign(this.props, props);

    if (props.isActive && !this.updateInterval) {
      this.startTime = Date.now();
      this.startUpdateCycle();
    } else if (!props.isActive && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.render();
  }

  private startUpdateCycle(): void {
    this.updateInterval = setInterval(() => {
      this.render();
    }, 100);
  }

  private render(): void {
    if (!this.container) {
      return;
    }

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    if (!this.props.isActive) {
      return;
    }

    const status = this.createStatusElement();
    this.container.appendChild(status);
  }

  private isProgressPhase(): boolean {
    return (
      this.props.phase === "started" ||
      this.props.phase === "initializing" ||
      this.props.phase === "swapping" ||
      this.props.phase === "committing"
    );
  }

  private getStatusConfig(): {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    icon: string;
    message: string;
  } {
    const currentPhase = this.props.phase;

    switch (currentPhase) {
      case "started":
      case "initializing":
      case "swapping":
      case "committing":
        return {
          backgroundColor: "#dbeafe",
          borderColor: "#93c5fd",
          textColor: "#0c4a6e",
          icon: "⟳",
          message: `Switching renderer... ${this.getElapsedTime()}`,
        };
      case "rolled_back":
        return {
          backgroundColor: "#fed7aa",
          borderColor: "#fb923c",
          textColor: "#92400e",
          icon: "⚠",
          message: `Switch rolled back${this.props.failureReason ? `: ${this.props.failureReason}` : ""}`,
        };
      case "failed":
        return {
          backgroundColor: "#fee2e2",
          borderColor: "#fca5a5",
          textColor: "#7f1d1d",
          icon: "✕",
          message: `Switch failed${this.props.failureReason ? `: ${this.props.failureReason}` : ""}`,
        };
      default:
        return {
          backgroundColor: "#f0fdf4",
          borderColor: "#86efac",
          textColor: "#166534",
          icon: "✓",
          message: "Switch successful",
        };
    }
  }

  private createStatusElement(): HTMLElement {
    const container = document.createElement("div");
    const statusConfig = this.getStatusConfig();
    container.className = "switch-status";
    container.style.padding = "12px";
    container.style.marginTop = "12px";
    container.style.borderRadius = "6px";
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.gap = "12px";

    container.style.backgroundColor = statusConfig.backgroundColor;
    container.style.border = `1px solid ${statusConfig.borderColor}`;
    container.style.color = statusConfig.textColor;

    // Icon
    const statusIcon = document.createElement("span");
    statusIcon.className = "switch-status-icon";
    statusIcon.textContent = statusConfig.icon;
    statusIcon.style.fontSize = "18px";
    statusIcon.style.fontWeight = "bold";
    statusIcon.style.minWidth = "24px";

    if (this.isProgressPhase()) {
      statusIcon.style.animation = "spin 1s linear infinite";
    }

    container.appendChild(statusIcon);

    // Message
    const messageSpan = document.createElement("span");
    messageSpan.className = "switch-status-message";
    messageSpan.textContent = statusConfig.message;
    messageSpan.style.fontSize = "13px";
    messageSpan.style.fontWeight = "500";
    messageSpan.style.flex = "1";

    container.appendChild(messageSpan);

    // Progress bar
    if (this.isProgressPhase()) {
      const progressContainer = document.createElement("div");
      progressContainer.style.width = "100%";
      progressContainer.style.marginTop = "8px";
      progressContainer.style.height = "4px";
      progressContainer.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
      progressContainer.style.borderRadius = "2px";
      progressContainer.style.overflow = "hidden";

      const progress = document.createElement("div");
      const elapsed = this.props.elapsedMs || Date.now() - this.startTime;
      const maxDuration = this.props.phase === "initializing" ? 3000 : 8000;
      const percentage = Math.min((elapsed / maxDuration) * 100, 100);

      progress.style.width = `${percentage}%`;
      progress.style.height = "100%";
      progress.style.backgroundColor = statusConfig.textColor;
      progress.style.transition = "width 100ms linear";

      progressContainer.appendChild(progress);
      container.appendChild(progressContainer);
    }

    return container;
  }

  private getElapsedTime(): string {
    const elapsed = (this.props.elapsedMs || Date.now() - this.startTime) / 1000;
    return `(${elapsed.toFixed(1)}s)`;
  }
}

export function createSwitchStatus(): SwitchStatus {
  return new SwitchStatus();
}
