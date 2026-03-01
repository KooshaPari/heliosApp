export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "streaming" | "complete" | "error" | "cancelled";

export type MessageMetadata = {
  status?: MessageStatus;
  [key: string]: unknown;
};

export type Message = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  messages: Message[];
};
