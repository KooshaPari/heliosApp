import { type Component, createEffect, createMemo, For, Show } from "solid-js";
import type { Message } from "../../../../runtime/src/types/conversation";
import { MessageBubble } from "./MessageBubble";

type ChatPanelProps = {
  messages: Message[];
  isStreaming: boolean;
  isLoading: boolean;
};

export const ChatPanel: Component<ChatPanelProps> = props => {
  let containerRef: HTMLDivElement | undefined;

  const hasMessages = createMemo(() => props.messages.length > 0);
  const streamingMessage = createMemo(() => {
    if (!props.isStreaming) return null;
    return (
      props.messages.find(m => m.role === "assistant" && m.metadata?.status === "streaming") ?? null
    );
  });

  createEffect(() => {
    const _ = props.messages.length;
    if (containerRef) {
      requestAnimationFrame(() => {
        containerRef!.scrollTop = containerRef!.scrollHeight;
      });
    }
  });

  return (
    <div
      ref={(el: HTMLDivElement) => {
        containerRef = el;
      }}
      style={{
        flex: "1",
        "overflow-y": "auto",
        padding: "16px",
        display: "flex",
        "flex-direction": "column",
        gap: "12px",
      }}
    >
      <Show when={!hasMessages()}>
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            flex: "1",
            color: "#6c7086",
            "text-align": "center",
            padding: "48px",
          }}
        >
          <h2
            style={{
              "font-size": "24px",
              "margin-bottom": "8px",
              color: "#cdd6f4",
            }}
          >
            How can I help you today?
          </h2>
          <p style={{ "font-size": "14px" }}>
            Ask me to write code, debug issues, or explain concepts.
          </p>
        </div>
      </Show>
      <For each={props.messages}>{message => <MessageBubble message={message} />}</For>
      <Show when={props.isLoading && !streamingMessage()}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "12px 16px",
            color: "#6c7086",
            "font-size": "14px",
          }}
        >
          <div
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid #313244",
              "border-top-color": "#89b4fa",
              "border-radius": "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          Thinking...
        </div>
      </Show>
    </div>
  );
};
