export type Listener = (event: SimpleEvent) => void;

export class SimpleEvent {
  defaultPrevented = false;
  bubbles = false;
  cancelable: boolean;

  constructor(
    public readonly type: string,
    options: { cancelable?: boolean; bubbles?: boolean } | boolean = {}
  ) {
    if (typeof options === "boolean") {
      this.cancelable = options;
      return;
    }
    this.cancelable = options.cancelable ?? false;
    this.bubbles = options.bubbles ?? false;
  }

  preventDefault(): void {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

export class SimpleKeyboardEvent extends SimpleEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;

  constructor(
    type: string,
    init: {
      key?: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      bubbles?: boolean;
    } = {}
  ) {
    super(type, { cancelable: true, bubbles: init.bubbles });
    this.key = init.key ?? "";
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = init.metaKey ?? false;
    this.altKey = init.altKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
  }
}

export class SimpleMouseEvent extends SimpleEvent {
  readonly button: number;
  constructor(
    type: string,
    init: { button?: number; bubbles?: boolean; cancelable?: boolean } = {}
  ) {
    super(type, init);
    this.button = init.button ?? 0;
  }
}

export class SimpleNode {
  parentNode: SimpleNode | null = null;
  ownerDocument: SimpleDocument | null = null;
  childNodes: SimpleNode[] = [];

  appendChild<T extends SimpleNode>(node: T): T {
    node.parentNode = this;
    node.ownerDocument = this.ownerDocument;
    this.childNodes.push(node);
    return node;
  }

  removeChild<T extends SimpleNode>(node: T): T {
    const index = this.childNodes.indexOf(node);
    if (index === -1) {
      throw new Error("Node is not a child");
    }
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }

  get firstChild(): SimpleNode | null {
    return this.childNodes[0] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map(child => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes = value === "" ? [] : [new SimpleTextNode(value)];
  }
}

export class SimpleTextNode extends SimpleNode {
  constructor(private value: string) {
    super();
  }
  override get textContent(): string {
    return this.value;
  }
  override set textContent(value: string) {
    this.value = value;
  }
}

export interface SimpleDocument extends SimpleNode {
  body: any;
  activeElement: HTMLElement | null;
  createElement(tagName: string): HTMLElement;
  createTextNode(text: string): Text;
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): NodeListOf<HTMLElement>;
}
