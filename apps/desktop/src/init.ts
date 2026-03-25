import { loadPersistedConversations } from "./stores/persistence.store";

export function initializeApp(): void {
  // Load persisted conversations on startup
<<<<<<< HEAD
  const _convs = loadPersistedConversations();
=======
  const convs = loadPersistedConversations();
  console.log(`[helios] Loaded ${convs.length} persisted conversations`);
>>>>>>> origin/main
}
