/**
 * Minimal `localStorage` implementation for Node-based unit tests.
 *
 * Zustand's persist middleware expects a synchronous Storage object. Node does
 * not expose one by default, so tests would otherwise run without persistence.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  })
}
