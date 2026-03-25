import {
  SimpleEvent,
  SimpleKeyboardEvent,
  SimpleMouseEvent,
  SimpleNode,
  SimpleTextNode,
} from "./dom_core.ts";
import { SimpleDocumentImpl, SimpleElement } from "./dom_element.ts";

const document = new SimpleDocumentImpl();

Object.assign(globalThis, {
  document,
  window: globalThis,
  navigator: { userAgent: "bun-test", platform: "MacIntel" },
  Event: SimpleEvent,
  KeyboardEvent: SimpleKeyboardEvent,
  MouseEvent: SimpleMouseEvent,
  Node: SimpleNode,
  HTMLElement: SimpleElement,
  HTMLDivElement: SimpleElement,
  HTMLButtonElement: SimpleElement,
  HTMLSpanElement: SimpleElement,
  HTMLInputElement: SimpleElement,
  HTMLTextAreaElement: SimpleElement,
  Text: SimpleTextNode,
  requestAnimationFrame: (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: (handle: number) => clearTimeout(handle),
});
