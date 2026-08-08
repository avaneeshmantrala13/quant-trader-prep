/**
 * Test helper: install a small in-memory `localStorage` on `globalThis`.
 *
 * This repo's jsdom test environment does NOT expose a global `localStorage`
 * (see the several `Object.defineProperty(globalThis, "localStorage", …)`
 * call-sites), yet app code (`storage.ts`, `devAccount.ts`, `DevPipelineContext`)
 * reads the bare global. Call this in a `beforeEach` to get a clean, isolated
 * store per test.
 */
export function installMemoryLocalStorage(): void {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => void mem.set(k, String(v)),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      get length() {
        return mem.size;
      },
    },
    configurable: true,
    writable: true,
  });
}
