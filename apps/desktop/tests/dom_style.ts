function normalizeColor(value: string): string {
  const hex = value.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    return value;
  }

  const expanded =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = Number.parseInt(expanded.slice(1, 3), 16);
  const g = Number.parseInt(expanded.slice(3, 5), 16);
  const b = Number.parseInt(expanded.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

class SimpleStyleDeclaration {
  private values = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  getPropertyValue(name: string): string {
    return this.values.get(name) ?? "";
  }
}

export function createStyleDeclaration(): CSSStyleDeclaration {
  const style = new SimpleStyleDeclaration() as unknown as CSSStyleDeclaration;
  return new Proxy(style, {
    get(target, prop) {
      if (typeof prop !== "string") {
        return Reflect.get(target, prop);
      }

      if (prop === "setProperty" || prop === "getPropertyValue") {
        return Reflect.get(target, prop);
      }

      return target.getPropertyValue(prop);
    },
    set(target, prop, value) {
      if (typeof prop !== "string") {
        return Reflect.set(target, prop, value);
      }

      const stringValue = String(value);
      target.setProperty(
        prop,
        prop === "backgroundColor" ? normalizeColor(stringValue) : stringValue
      );
      return true;
    },
  }) as CSSStyleDeclaration;
}
