export const EVIDENCE_CACHE_TTL = 10 * 60 * 1000

/** In-memory LRU with absolute expiry and approximate byte budgets. */
export class EvidenceSessionCache<K, V> {
  private entries = new Map<K, { value: V; size: number; expires: number; dispose?: () => void }>()
  private size = 0
  constructor(private maxEntries: number, private maxBytes: number, private ttl = EVIDENCE_CACHE_TTL, private now = () => Date.now()) {}
  private expire() {
    for (const [key, entry] of this.entries) if (entry.expires <= this.now()) this.delete(key)
  }
  get(key: K): V | undefined {
    this.expire()
    const entry = this.entries.get(key)
    if (!entry) return undefined
    this.entries.delete(key); this.entries.set(key, entry)
    return entry.value
  }
  set(key: K, value: V, size: number, dispose?: () => void) {
    this.expire(); this.delete(key)
    if (!Number.isFinite(size) || size < 0 || size > this.maxBytes) return false
    while (this.entries.size && (this.entries.size >= this.maxEntries || this.size + size > this.maxBytes)) this.delete(this.entries.keys().next().value!)
    this.entries.set(key, { value, size, expires: this.now() + this.ttl, dispose }); this.size += size
    return true
  }
  delete(key: K) {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key); this.size -= entry.size
    entry.dispose?.()
  }
  clear() { for (const key of this.entries.keys()) this.delete(key) }
}

// Bytes identify a particular downloaded version, not just a filename. Refresh
// returns new bytes, so it cannot reuse preparation from an older download.
const prepared = new EvidenceSessionCache<Uint8Array, { kind: string; value: unknown }>(6, 96 * 1024 * 1024)
export function getPreparedEvidence<T>(bytes: Uint8Array, kind: string): T | undefined {
  const entry = prepared.get(bytes)
  return entry?.kind === kind ? entry.value as T : undefined
}
export function setPreparedEvidence<T>(bytes: Uint8Array, kind: string, value: T, size: number, dispose?: () => void) {
  return prepared.set(bytes, { kind, value }, bytes.byteLength + size, dispose)
}
export function clearPreparedEvidence(bytes: Uint8Array) { prepared.delete(bytes) }
