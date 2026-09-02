export class LRUWithTTL<K, V> {
  private store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private options: { max: number; ttlMs: number; negativeTtlMs?: number }) {}

  get size() {
    return this.store.size;
  }

  get(key: K) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  has(key: K) {
    return this.get(key) !== undefined;
  }

  set(key: K, value: V, options?: { negative?: boolean; ttlMs?: number }) {
    const ttlMs = options?.ttlMs ?? (
      options?.negative ? this.options.negativeTtlMs ?? this.options.ttlMs : this.options.ttlMs
    );
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= Math.max(1, this.options.max)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
  }

  snapshot() {
    const now = Date.now();
    return Array.from(this.store.values()).filter(entry => entry.expiresAt > now).map(entry => entry.value);
  }
}
