import type { Component } from "solid-js";

export const App: Component = () => {
  return (
    <div class="app-root" style={{
      "min-height": "100vh",
      "background-color": "#1e1e2e",
      "color": "#cdd6f4",
      "font-family": "'JetBrains Mono', 'Fira Code', monospace",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
    }}>
      <h1>Helios IDE</h1>
    </div>
  );
};
