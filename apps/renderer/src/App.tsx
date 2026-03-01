import type { Component } from "solid-js";
import { AppShell } from "./components/AppShell";
import { useKeyboardShortcuts } from "./shortcuts";

export const App: Component = () => {
  useKeyboardShortcuts();

  return <AppShell />;
};
