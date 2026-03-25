import {
  type Listener,
  type SimpleDocument,
  type SimpleEvent,
  SimpleNode,
  SimpleTextNode,
} from "./dom_core.ts";
import { createStyleDeclaration } from "./dom_style.ts";

class SimpleClassList {
  constructor(private readonly element: SimpleElement) {}
  add(...tokens: string[]): void {
    for (const token of tokens) {
      this.element._classSet.add(token);
    }
    this.element.syncClassName();
  }
  remove(...tokens: string[]): void {
    for (const token of tokens) {
      this.element._classSet.delete(token);
    }
    this.element.syncClassName();
  }
  contains(token: string): boolean {
    return this.element._classSet.has(token);
  }
  toggle(token: string, force?: boolean): boolean {
    const shouldHave = force ?? !this.contains(token);
    shouldHave ? this.add(token) : this.remove(token);
    return shouldHave;
  }
  toString(): string {
    return [...this.element._classSet].join(" ");
  }
}

function parseSelector(
  selector: string
): Array<{ kind: "tag" | "class" | "attr"; name: string; value?: string }> {
  const tokens: Array<{ kind: "tag" | "class" | "attr"; name: string; value?: string }> = [];
  let remainder = selector.trim();
  const tagMatch = remainder.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  if (tagMatch) {
    tokens.push({ kind: "tag", name: tagMatch[0].toLowerCase() });
    remainder = remainder.slice(tagMatch[0].length);
  }
  while (remainder.length > 0) {
    if (remainder.startsWith(".")) {
      const classMatch = remainder.slice(1).match(/^[a-zA-Z0-9_-]+/);
      if (!classMatch) {
        break;
      }
      tokens.push({ kind: "class", name: classMatch[0] });
      remainder = remainder.slice(classMatch[0].length + 1);
      continue;
    }
    if (remainder.startsWith("[")) {
      const attrMatch = remainder.match(/^\[([^=\]]+)(?:=(["']?)([^\]"']*)\2)?\]/);
      if (!attrMatch) {
        break;
      }
      tokens.push({ kind: "attr", name: attrMatch[1], value: attrMatch[3] });
      remainder = remainder.slice(attrMatch[0].length);
      continue;
    }
    if (/^\s+$/.test(remainder)) {
      remainder = "";
      break;
    }
    break;
  }
  return tokens;
}

export class SimpleElement extends SimpleNode {
  readonly style = createStyleDeclaration();
  readonly classList = new SimpleClassList(this);
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<Listener>>();
  readonly _classSet = new Set<string>();
  private _type = "";
  private _disabled = false;
  private _checked = false;
  private _value = "";
  private _placeholder = "";
  private _role = "";
  private _tabIndex = 0;
  private _title = "";
  private _name = "";
  private _id = "";
  draggable = false;

  constructor(public readonly tagName: string) {
    super();
  }

  get className(): string {
    return this.classList.toString();
  }
  set className(value: string) {
    this._classSet.clear();
    for (const token of value.split(/\s+/).filter(Boolean)) {
      this._classSet.add(token);
    }
    this.syncClassName();
  }

  syncClassName(): void {
    this._classSet.size > 0
      ? this.attributes.set("class", this.classList.toString())
      : this.attributes.delete("class");
  }
  get innerHTML(): string {
    return this.childNodes.map(child => child.textContent).join("");
  }
  set innerHTML(_value: string) {
    this.childNodes = [];
  }

  setAttribute(name: string, value: string): void {
    if (name === "class") {
      return void (this.className = value);
    }
    if (name === "type") {
      return void (this.type = value);
    }
    if (name === "role") {
      return void (this.role = value);
    }
    if (name === "tabindex") {
      return void (this.tabIndex = Number(value));
    }
    if (name === "title") {
      return void (this.title = value);
    }
    if (name === "name") {
      return void (this.name = value);
    }
    if (name === "id") {
      return void (this.id = value);
    }
    if (name === "disabled") {
      return void (this.disabled = true);
    }
    if (name === "checked") {
      return void (this.checked = true);
    }
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    if (name === "type") {
      return this._type || null;
    }
    if (name === "role") {
      return this._role || null;
    }
    if (name === "tabindex") {
      return String(this._tabIndex);
    }
    if (name === "title") {
      return this._title || null;
    }
    if (name === "name") {
      return this._name || null;
    }
    if (name === "id") {
      return this._id || null;
    }
    if (name === "disabled") {
      return this._disabled ? "" : null;
    }
    if (name === "checked") {
      return this._checked ? "" : null;
    }
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    if (name === "type") {
      return this._type !== "";
    }
    if (name === "role") {
      return this._role !== "";
    }
    if (name === "tabindex") {
      return true;
    }
    if (name === "title") {
      return this._title !== "";
    }
    if (name === "name") {
      return this._name !== "";
    }
    if (name === "id") {
      return this._id !== "";
    }
    if (name === "disabled") {
      return this._disabled;
    }
    if (name === "checked") {
      return this._checked;
    }
    return this.attributes.has(name);
  }

  removeAttribute(name: string): void {
    if (name === "class") {
      return void (this.className = "");
    }
    if (name === "type") {
      return void (this._type = "");
    }
    if (name === "role") {
      return void (this._role = "");
    }
    if (name === "tabindex") {
      return void (this._tabIndex = 0);
    }
    if (name === "title") {
      return void (this._title = "");
    }
    if (name === "name") {
      return void (this._name = "");
    }
    if (name === "id") {
      return void (this._id = "");
    }
    if (name === "disabled") {
      return void (this._disabled = false);
    }
    if (name === "checked") {
      return void (this._checked = false);
    }
    this.attributes.delete(name);
  }

  get parentElement(): SimpleElement | null {
    return this.parentNode instanceof SimpleElement ? this.parentNode : null;
  }
  set type(value: string) {
    this._type = value;
    this.attributes.set("type", value);
  }
  get type(): string {
    return this._type;
  }
  set disabled(value: boolean) {
    this._disabled = value;
    value ? this.attributes.set("disabled", "") : this.attributes.delete("disabled");
  }
  get disabled(): boolean {
    return this._disabled;
  }
  set checked(value: boolean) {
    this._checked = value;
    value ? this.attributes.set("checked", "") : this.attributes.delete("checked");
  }
  get checked(): boolean {
    return this._checked;
  }
  set value(value: string) {
    this._value = value;
  }
  get value(): string {
    return this._value;
  }
  set placeholder(value: string) {
    this._placeholder = value;
  }
  get placeholder(): string {
    return this._placeholder;
  }
  set role(value: string) {
    this._role = value;
    this.attributes.set("role", value);
  }
  get role(): string {
    return this._role;
  }
  set tabIndex(value: number) {
    this._tabIndex = value;
    this.attributes.set("tabindex", String(value));
  }
  get tabIndex(): number {
    return this._tabIndex;
  }
  set title(value: string) {
    this._title = value;
    this.attributes.set("title", value);
  }
  get title(): string {
    return this._title;
  }
  set name(value: string) {
    this._name = value;
    this.attributes.set("name", value);
  }
  get name(): string {
    return this._name;
  }
  set id(value: string) {
    this._id = value;
    this.attributes.set("id", value);
  }
  get id(): string {
    return this._id;
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event: SimpleEvent): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return !event.defaultPrevented;
  }
  click(): void {
    this.dispatchEvent(new (globalThis as any).Event("click", true));
  }
  focus(): void {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this as unknown as HTMLElement;
    }
  }

  matches(selector: string): boolean {
    for (const token of parseSelector(selector)) {
      if (token.kind === "tag" && this.tagName.toLowerCase() !== token.name) {
        return false;
      }
      if (token.kind === "class" && !this._classSet.has(token.name)) {
        return false;
      }
      if (token.kind === "attr") {
        const attr = this.getAttribute(token.name);
        if (attr === null) {
          return false;
        }
        if (token.value !== undefined && attr !== token.value) {
          return false;
        }
      }
    }
    return true;
  }

  querySelectorAll(selector: string): SimpleElement[] {
    if (selector.includes(",")) {
      const results = new Map<SimpleElement, true>();
      for (const part of selector
        .split(",")
        .map(token => token.trim())
        .filter(Boolean)) {
        for (const element of this.querySelectorAll(part)) {
          results.set(element, true);
        }
      }
      return [...results.keys()];
    }

    const parts = selector.trim().split(/\s+/).filter(Boolean);
    const results: SimpleElement[] = [];
    const visit = (node: SimpleNode, partIndex: number): void => {
      for (const child of node.childNodes) {
        if (!(child instanceof SimpleElement)) {
          continue;
        }
        if (child.matches(parts[partIndex] ?? "")) {
          if (partIndex === parts.length - 1) {
            results.push(child);
          } else {
            visit(child, partIndex + 1);
          }
        }
        visit(child, partIndex);
      }
    };
    visit(this, 0);
    return results;
  }

  querySelector(selector: string): SimpleElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export class SimpleDocumentImpl extends SimpleNode implements SimpleDocument {
  readonly body: SimpleElement;
  activeElement: HTMLElement | null = null;
  constructor() {
    super();
    this.ownerDocument = this as unknown as SimpleDocument;
    this.body = new SimpleElement("body");
    this.body.ownerDocument = this as unknown as SimpleDocument;
    this.childNodes = [this.body];
  }
  createElement(tagName: string): HTMLElement {
    const element = new SimpleElement(tagName);
    element.ownerDocument = this as unknown as SimpleDocument;
    return element as unknown as HTMLElement;
  }
  createTextNode(text: string): Text {
    const node = new SimpleTextNode(text);
    node.ownerDocument = this as unknown as SimpleDocument;
    return node as unknown as Text;
  }
  querySelector(selector: string): HTMLElement | null {
    return this.body.querySelector(selector) as HTMLElement | null;
  }
  querySelectorAll(selector: string): NodeListOf<HTMLElement> {
    return this.body.querySelectorAll(selector) as unknown as NodeListOf<HTMLElement>;
  }
}
