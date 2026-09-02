import { EventEmitter } from 'events';
import { BskyAppViewClient, type BskyProfile } from './bskyClient';
import { LRUWithTTL } from './lru';

const BATCH_SIZE = 25;
const DRAIN_INTERVAL_MS = 2500;
const QUEUE_HARD_CAP = 10_000;

export class ProfileEnricher extends EventEmitter {
  private readonly client: BskyAppViewClient;
  private readonly cache: LRUWithTTL<string, BskyProfile>;
  private readonly queue = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private inflight = false;
  private readonly enabled: boolean;

  constructor(options: { enabled?: boolean; client?: BskyAppViewClient; max?: number; ttlMs?: number } = {}) {
    super();
    this.enabled = options.enabled ?? process.env.ENRICH_PROFILES !== '0';
    this.client = options.client ?? new BskyAppViewClient();
    this.cache = new LRUWithTTL({
      max: options.max ?? Number(process.env.PROFILE_CACHE_MAX ?? 20_000),
      ttlMs: options.ttlMs ?? Number(process.env.PROFILE_CACHE_TTL_MS ?? 3_600_000),
      negativeTtlMs: 300_000,
    });
  }

  seen(did: string) {
    if (!this.enabled || !did || this.cache.has(did) || this.queue.size >= QUEUE_HARD_CAP) return;
    this.queue.add(did);
  }

  snapshot() {
    return this.cache.snapshot();
  }

  peek(did: string) {
    return this.cache.get(did);
  }

  start() {
    if (!this.enabled || this.timer) return;
    this.timer = setInterval(() => void this.drain(), DRAIN_INTERVAL_MS);
    console.log('[ProfileEnricher] started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async drain() {
    if (this.inflight || this.queue.size === 0) return;
    const batch = Array.from(this.queue).slice(0, BATCH_SIZE);
    batch.forEach(did => this.queue.delete(did));
    this.inflight = true;
    try {
      const profiles = await this.client.getProfiles(batch);
      profiles.forEach(profile => this.cache.set(profile.did, profile, { negative: profile.notFound }));
      if (profiles.length > 0) this.emit('profile', profiles);
    } catch (error) {
      batch.forEach(did => this.queue.add(did));
      console.error('[ProfileEnricher] fetch failed:', error instanceof Error ? error.message : error);
    } finally {
      this.inflight = false;
    }
  }
}

let singleton: ProfileEnricher | null = null;

export function getProfileEnricher() {
  singleton ??= new ProfileEnricher();
  return singleton;
}
