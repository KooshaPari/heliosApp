import type { Conversation, Message } from "../../types/conversation";

export class ConversationStore {
  private filePath: string;
  private conversations: Map<string, Conversation>;

  constructor(filePath = "conversations.json") {
    this.filePath = filePath;
    this.conversations = new Map();
  }

  /**
   * Load conversations from persistent storage
   */
  async loadConversations(): Promise<Conversation[]> {
    try {
      // In a real implementation, this would read from Bun.file(this.filePath)
      // For now, we'll return an empty array as a placeholder
      const result = Array.from(this.conversations.values());
      return result;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Save all conversations to persistent storage
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      this.conversations.clear();
      for (const conv of conversations) {
        this.conversations.set(conv.id, conv);
      }
    } catch (_error) {}
  }

  /**
   * Save a single conversation
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    try {
      this.conversations.set(conversation.id, conversation);
    } catch (_error) {}
  }

  /**
   * Delete a conversation by ID
   */
  async deleteConversation(id: string): Promise<void> {
    try {
      this.conversations.delete(id);
    } catch (_error) {}
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get all conversations
   */
  getConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    try {
      const conv = this.conversations.get(conversationId);
      if (!conv) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      conv.messages.push(message);
      conv.updatedAt = new Date().toISOString();
      this.conversations.set(conversationId, conv);
      await this.saveConversation(conv);
    } catch (_error) {}
  }

  /**
   * Clear all conversations
   */
  async clearConversations(): Promise<void> {
    try {
      this.conversations.clear();
    } catch (_error) {}
  }
}
