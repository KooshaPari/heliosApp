import type { Conversation, Message } from "../../types/conversation";

/**
 * In-memory conversation store with JSON file backing.
 * Uses Bun.file/Bun.write for persistence.
 */
export class ConversationStore {
  private conversations: Map<string, Conversation> = new Map();
  private dataPath: string;

  constructor(dataDir: string) {
    this.dataPath = `${dataDir}/conversations.json`;
  }

  async load(): Promise<void> {
    try {
      const file = Bun.file(this.dataPath);
      if (await file.exists()) {
        const data = await file.json() as Conversation[];
        for (const conv of data) {
          this.conversations.set(conv.id, conv);
        }
      }
    } catch {
      // File doesn't exist or is corrupt — start fresh
      this.conversations.clear();
    }
  }

  async flush(): Promise<void> {
    const data = Array.from(this.conversations.values());
    await Bun.write(this.dataPath, JSON.stringify(data, null, 2));
  }

  async saveConversation(conv: Conversation): Promise<void> {
    this.conversations.set(conv.id, { ...conv, updatedAt: Date.now() });
    await this.flush();
  }

  loadConversation(id: string): Conversation | null {
    return this.conversations.get(id) ?? null;
  }

  listConversations(): Array<{ id: string; title: string; updatedAt: number }> {
    return Array.from(this.conversations.values())
      .map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteConversation(id: string): Promise<void> {
    this.conversations.delete(id);
    await this.flush();
  }

  async appendMessage(conversationId: string, message: Message): Promise<void> {
    const conv = this.conversations.get(conversationId);
    if (!conv) {
      throw new Error(`Conversation "${conversationId}" not found`);
    }
    conv.messages.push(message);
    conv.updatedAt = Date.now();
    await this.flush();
  }

  loadMessages(conversationId: string): Message[] {
    const conv = this.conversations.get(conversationId);
    return conv?.messages ?? [];
  }
}
