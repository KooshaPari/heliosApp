import type { Component } from "solid-js";

export type ConversationItemProps = {
  id: string;
  title: string;
  updatedAt: Date;
  isActive: boolean;
  onClick: (id: string) => void;
};

function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export const ConversationItem: Component<ConversationItemProps> = (props) => {
  return (
    <div
      onClick={() => props.onClick(props.id)}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        "border-left": props.isActive ? "3px solid #89b4fa" : "3px solid transparent",
        "background-color": props.isActive ? "#313244" : "transparent",
        "border-radius": "0 6px 6px 0",
        transition: "background-color 0.15s ease",
        "margin-bottom": "2px",
      }}
    >
      <div
        style={{
          "font-size": "13px",
          color: props.isActive ? "#cdd6f4" : "#a6adc8",
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
          "font-weight": props.isActive ? "500" : "400",
          "margin-bottom": "3px",
        }}
      >
        {props.title}
      </div>
      <div
        style={{
          "font-size": "11px",
          color: "#6c7086",
        }}
      >
        {relativeTime(props.updatedAt)}
      </div>
    </div>
  );
};
