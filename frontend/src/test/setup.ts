import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/**
 * Node 25 defines its own experimental `localStorage` global, and without
 * `--localstorage-file` it is a plain empty object. It shadows the jsdom
 * Storage that the app actually talks to, so anything reading it sees
 * `getItem is not a function`. Replace it with a real in-memory Storage.
 */
class MemoryStorage implements Storage {
  #entries = new Map<string, string>();

  get length() {
    return this.#entries.size;
  }
  clear() {
    this.#entries.clear();
  }
  getItem(key: string) {
    return this.#entries.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#entries.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#entries.delete(key);
  }
  setItem(key: string, value: string) {
    this.#entries.set(key, String(value));
  }
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (typeof window[name]?.getItem !== "function") {
    const storage = new MemoryStorage();
    Object.defineProperty(window, name, { value: storage, configurable: true });
    Object.defineProperty(globalThis, name, { value: storage, configurable: true });
  }
}

// jsdom implements neither of these, and several components call them.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:mock";
  URL.revokeObjectURL = () => {};
}
