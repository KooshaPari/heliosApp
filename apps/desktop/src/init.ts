import { loadPersistedConversations } from "./stores/persistence.store";

export function initializeApp(): void {
  // Load persisted conversations on startup
  const _convs = loadPersistedConversations();
}
