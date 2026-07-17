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
  } catch (_happyDomErr) {}
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
  } catch (_fallbackErr) {}
}

// Polyfill requestAnimationFrame if not provided by happy-dom
if (typeof globalThis.requestAnimationFrame === "undefined") {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 0) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}
