/**
 * Settings Lock
 * Prevents settings changes during active switch transactions
 */

export interface SettingsLockOptions {
  onAutoUnlocked?: () => void;
  autoUnlockTimeoutMs?: number;
}

export class SettingsLock {
  private isLocked = false;
  private options: SettingsLockOptions;
  private lockTimeoutId?: NodeJS.Timeout;
  private lockedElements: Set<HTMLElement> = new Set();

  constructor(options: SettingsLockOptions = {}) {
    this.options = {
      autoUnlockTimeoutMs: 30000,
      ...options,
    };
  }

  lock(settingsContainer: HTMLElement): void {
    if (this.isLocked) {
      return;
    }

    this.isLocked = true;
    this.applyLock(settingsContainer);
    this.startAutoUnlockTimer();
  }

  unlock(settingsContainer: HTMLElement): void {
    if (!this.isLocked) {
      return;
    }

    this.isLocked = false;
    this.removeLock(settingsContainer);
    this.stopAutoUnlockTimer();
  }

  isSettingsLocked(): boolean {
    return this.isLocked;
  }

  private applyLock(container: HTMLElement): void {
    // Disable all interactive elements
    const interactiveSelectors = 'input, button, [role="button"], [role="switch"]';
    const elements = container.querySelectorAll(interactiveSelectors) as NodeListOf<HTMLElement>;

    elements.forEach(element => {
      element.setAttribute("aria-disabled", "true");
      if (this.isFormControl(element)) {
        element.disabled = true;
      } else {
        element.style.opacity = "0.6";
        element.style.pointerEvents = "none";
        element.style.cursor = "not-allowed";
        element.setAttribute("title", "Settings locked during renderer switch.");
      }

      this.lockedElements.add(element);
    });

    // Add visual overlay/grayed-out effect
    container.style.opacity = "0.7";
    container.style.pointerEvents = "none";
  }

  private removeLock(container: HTMLElement): void {
    this.lockedElements.forEach(element => {
      element.removeAttribute("aria-disabled");
      if (this.isFormControl(element)) {
        element.disabled = false;
      } else {
        element.style.opacity = "";
        element.style.pointerEvents = "";
        element.style.cursor = "";
        element.removeAttribute("title");
      }
    });

    this.lockedElements.clear();
    container.style.opacity = "";
    container.style.pointerEvents = "";
  }

  private startAutoUnlockTimer(): void {
    this.lockTimeoutId = setTimeout(() => {
      this.isLocked = false;
      if (this.options.onAutoUnlocked) {
        this.options.onAutoUnlocked();
      }
    }, this.options.autoUnlockTimeoutMs);
  }

  private stopAutoUnlockTimer(): void {
    if (this.lockTimeoutId) {
      clearTimeout(this.lockTimeoutId);
      this.lockTimeoutId = undefined;
    }
  }

  destroy(): void {
    this.stopAutoUnlockTimer();
    this.lockedElements.clear();
  }

  private isFormControl(
    element: HTMLElement
  ): element is HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement {
    return (
      element instanceof HTMLInputElement ||
      element instanceof HTMLButtonElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    );
  }
}

export function createSettingsLock(options?: SettingsLockOptions): SettingsLock {
  return new SettingsLock(options);
}
