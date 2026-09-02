const DEFAULT_APPVIEW = 'https://public.api.bsky.app';

export interface BskyLabel {
  val: string;
  src: string;
  neg?: boolean;
}

export interface BskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  followersCount?: number;
  labels?: BskyLabel[];
  fetchedAt: number;
  notFound?: boolean;
}

class TokenBucket {
  private tokens: number;
  private readonly refillPerMs: number;
  private lastRefill = Date.now();

  constructor(private readonly capacity: number) {
    this.tokens = capacity;
    this.refillPerMs = capacity / 60_000;
  }

  async take() {
    while (true) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + (now - this.lastRefill) * this.refillPerMs);
      this.lastRefill = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(50, Math.ceil((1 - this.tokens) / this.refillPerMs))));
    }
  }
}

function normalizeLabels(raw: unknown): BskyLabel[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const labels = raw.flatMap(label => {
    if (!label || typeof label !== 'object') return [];
    const candidate = label as Record<string, unknown>;
    if (typeof candidate.val !== 'string' || typeof candidate.src !== 'string') return [];
    return [{ val: candidate.val, src: candidate.src, neg: candidate.neg === true || undefined }];
  });
  return labels.length > 0 ? labels : undefined;
}

export class BskyAppViewClient {
  private readonly baseUrl: string;
  private readonly bucket: TokenBucket;

  constructor(options: { baseUrl?: string; ratePerMinute?: number } = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.BSKY_APPVIEW_URL ?? DEFAULT_APPVIEW).replace(/\/$/, '');
    this.bucket = new TokenBucket(Math.max(1, options.ratePerMinute ?? 60));
  }

  async getProfiles(dids: string[]): Promise<BskyProfile[]> {
    const batch = dids.slice(0, 25);
    if (batch.length === 0) return [];
    const url = new URL(`${this.baseUrl}/xrpc/app.bsky.actor.getProfiles`);
    batch.forEach(did => url.searchParams.append('actors', did));

    let delay = 500;
    for (let attempt = 1; attempt <= 4; attempt++) {
      await this.bucket.take();
      try {
        const response = await fetch(url, { headers: { accept: 'application/json' } });
        if (response.status === 429 || response.status >= 500) {
          if (attempt === 4) throw new Error(`AppView getProfiles ${response.status}`);
          const retryAfter = Number(response.headers.get('retry-after')) * 1000;
          await new Promise(resolve => setTimeout(resolve, Math.min(60_000, retryAfter > 0 ? retryAfter : delay)));
          delay = Math.min(60_000, delay * 2);
          continue;
        }
        if (!response.ok) throw new Error(`AppView getProfiles ${response.status}`);
        const body = await response.json() as { profiles?: Array<Record<string, any>> };
        const fetchedAt = Date.now();
        const found = new Map<string, BskyProfile>();
        for (const profile of body.profiles ?? []) {
          if (!profile.did || !profile.handle) continue;
          found.set(profile.did, {
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName,
            avatar: profile.avatar,
            followersCount: profile.followersCount,
            labels: normalizeLabels(profile.labels),
            fetchedAt,
          });
        }
        return batch.map(did => found.get(did) ?? { did, handle: did, fetchedAt, notFound: true });
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(60_000, delay * 2);
      }
    }
    return [];
  }
}
