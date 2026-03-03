/**
 * Test preload: provides DOM globals (document, window, etc.)
 * for desktop UI tests using happy-dom.
 */
let didRegisterDom = false;

if (typeof globalThis.document === "undefined") {
  try {
    const { GlobalRegistrator } = await import("@happy-dom/global-registrator");
    GlobalRegistrator.register();
    didRegisterDom = true;
  } catch (happyDomErr) {
    console.error(
      "Unable to load @happy-dom/global-registrator in preload. Falling back to happy-dom Window shim.",
      happyDomErr,
    );
  }
}

if (!didRegisterDom) {
  try {
    const { Window } = await import("happy-dom");
    const window = new Window();
    Object.defineProperties(globalThis, {
      window: { value: window, configurable: true },
      document: { value: window.document, configurable: true },
      HTMLElement: { value: window.HTMLElement, configurable: true },
      HTMLDivElement: { value: window.HTMLDivElement, configurable: true },
    });
    didRegisterDom = true;
  } catch (fallbackErr) {
    console.error("Fallback happy-dom shim initialization failed:", fallbackErr);
  }
}

// Polyfill requestAnimationFrame if not provided by happy-dom
if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}
