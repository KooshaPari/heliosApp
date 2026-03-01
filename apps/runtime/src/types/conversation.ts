export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  messages: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool_call" | "tool_result";
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokenUsage?: { input: number; output: number };
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  status?: "pending" | "streaming" | "complete" | "error" | "cancelled";
}
