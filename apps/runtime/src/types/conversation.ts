export type MessageRole = "user" | "assistant" | "tool_call" | "tool_result";

export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export type MessageMetadata = {
  status?: MessageStatus;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: string;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  createdAt?: string;
};
