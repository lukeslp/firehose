import WebSocket from 'ws';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { analyzeSentiment, extractFeatures, isEnglishLanguage } from './sentiment';
import {
  insertPost,
  updateGlobalStats,
  updateLanguageStats,
  updateHashtagStats,
  getGlobalStats,
  getMinuteTimeline,
  upsertMinuteBucket,
  upsertMinuteBucketsByLanguage,
  upsertMinuteBucketsByContentType,
  upsertMinuteBucketsByLabel,
  purgeOldMinuteBuckets,
  type MinuteContentType,
  type MinuteSentimentCounts,
} from './db';
import { InsertPost } from '../drizzle/schema';
import { buildMediaBundle, type MediaBundle } from './media';
import { getProfileEnricher } from './profileEnricher';
import { completedObservedMinuteRate, medianRate } from './rate';

const FIREHOSE_URI = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
const MAX_TEXT_LENGTH = 10000;
const RECONNECT_DELAY = 5000;
const MAX_HANDLE_CACHE = 20_000;
const COLLECTION_STATE_FILE = path.join(process.cwd(), 'collection-state.json');

interface CollectionState {
  enabled: boolean;
  window: string | null;
  enabledAt: string | null;
}

export interface FirehosePost {
  text: string;
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
  };
  createdAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  sentimentAnalyzed: boolean;
  language?: string;
  hasImages?: boolean;
  hasVideo?: boolean;
  hasLink?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
  media?: MediaBundle;
}

export interface FirehoseStats {
  totalPosts: number;
  postsPerMinute: number;
  sentimentCounts: {
    positive: number;
    negative: number;
    neutral: number;
  };
  duration: number;
  running: boolean;
  connected: boolean;
  lastEventAt: string | null;
}

export class FirehoseService extends EventEmitter {
  private ws: WebSocket | null = null;
  private running = false;
  private connected = false;
  private handleCache: Map<string, string> = new Map(); // DID → handle mapping
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Collection window tracking
  private collectionEnabled = false;
  private currentWindow: string | null = null; // e.g., "02:00", "08:00", "13:00", "19:00"
  private filteredCounts = {
    notCollecting: 0,
    nonEnglish: 0,
    quotesReplies: 0,
    wordCount: 0,
    tooManyLinks: 0,
    saved: 0,
  };
  private lastFilterLog = Date.now();

  // Statistics
  private totalProcessed = 0;
  private sentimentCounts = {
    positive: 0,
    negative: 0,
    neutral: 0,
  };
  private startTime: Date | null = null;
  private recentPosts: FirehosePost[] = [];
  private postsLastMinute: number[] = [];
  private lastMinuteCheck = Date.now();
  private lastPostAt: Date | null = null;
  private fallbackPostsPerMinute = 0;

  private currentMinuteTs = Math.floor(Date.now() / 60_000) * 60_000;
  private currentMinuteObservedAt = Date.now();
  private minuteCounts: MinuteSentimentCounts = { total: 0, positive: 0, neutral: 0, negative: 0 };
  private minuteByLanguage = new Map<string, MinuteSentimentCounts>();
  private minuteByContentType = new Map<MinuteContentType, number>();
  private minuteByLabel = new Map<string, number>();
  private minuteFlushTimer: NodeJS.Timeout | null = null;
  private globalFlushTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private readonly startedAtMs = Date.now();

  private static readonly MINUTE_FLUSH_INTERVAL_MS = 10_000;
  private static readonly GLOBAL_FLUSH_INTERVAL_MS = 30_000;
  private static readonly WATCHDOG_INTERVAL_MS = 30_000;
  private static readonly MINUTE_RETENTION_HOURS = 48;

  constructor() {
    super();
    this.loadGlobalStats();
    this.loadRecentRate();
    this.loadCollectionState(); // Restore collection state from disk
    this.startMinuteFlushLoop();
    this.startGlobalFlushLoop();
    this.startWatchdog();

    // Auto-start the firehose - it should always run
    // Small delay to ensure stats are loaded first
    setTimeout(() => {
      if (!this.running) {
        console.log('[Firehose] Auto-starting on initialization...');
        this.start();
      }
    }, 1000);
  }

  private async loadRecentRate() {
    const rows = await getMinuteTimeline(10);
    const currentMinute = Math.floor(Date.now() / 60_000) * 60_000;
    const recentCounts = rows
      .filter(row => row.minuteTimestamp.getTime() < currentMinute && row.postsCount > 0)
      .slice(-5)
      .map(row => row.postsCount)
      .sort((a, b) => a - b);
    this.fallbackPostsPerMinute = medianRate(recentCounts);
  }

  private startGlobalFlushLoop() {
    this.globalFlushTimer = setInterval(() => void this.flushGlobalStats(), FirehoseService.GLOBAL_FLUSH_INTERVAL_MS);
  }

  private async flushGlobalStats() {
    if (this.totalProcessed === 0) return;
    await updateGlobalStats({
      totalPosts: this.totalProcessed,
      totalPositive: this.sentimentCounts.positive,
      totalNegative: this.sentimentCounts.negative,
      totalNeutral: this.sentimentCounts.neutral,
      lastPostTimestamp: this.lastPostAt ?? undefined,
    });
  }

  private startMinuteFlushLoop() {
    void purgeOldMinuteBuckets(FirehoseService.MINUTE_RETENTION_HOURS);
    this.minuteFlushTimer = setInterval(
      () => void this.flushMinuteBucket(),
      FirehoseService.MINUTE_FLUSH_INTERVAL_MS,
    );
  }

  private async flushMinuteBucket() {
    if (this.minuteCounts.total === 0) return;
    const timestamp = new Date(this.currentMinuteTs);
    await Promise.all([
      upsertMinuteBucket(timestamp, { ...this.minuteCounts }),
      upsertMinuteBucketsByLanguage(timestamp, new Map(this.minuteByLanguage)),
      upsertMinuteBucketsByContentType(timestamp, new Map(this.minuteByContentType)),
      upsertMinuteBucketsByLabel(timestamp, new Map(this.minuteByLabel)),
    ]);
  }

  private recordMinuteBucketPost(
    sentiment: FirehosePost['sentiment'],
    sentimentAnalyzed: boolean,
    language: string | undefined,
    contentTypes: MinuteContentType[],
    labels: string[],
  ) {
    const minuteTs = Math.floor(Date.now() / 60_000) * 60_000;
    if (minuteTs !== this.currentMinuteTs) {
      void this.flushMinuteBucket();
      const observedSeconds = (Date.now() - this.currentMinuteObservedAt) / 1000;
      this.fallbackPostsPerMinute = completedObservedMinuteRate(
        this.minuteCounts.total,
        observedSeconds,
        this.fallbackPostsPerMinute,
      );
      this.currentMinuteTs = minuteTs;
      this.currentMinuteObservedAt = Date.now();
      this.minuteCounts = { total: 0, positive: 0, neutral: 0, negative: 0 };
      this.minuteByLanguage = new Map();
      this.minuteByContentType = new Map();
      this.minuteByLabel = new Map();
      void purgeOldMinuteBuckets(FirehoseService.MINUTE_RETENTION_HOURS);
    }

    this.minuteCounts.total += 1;
    if (sentimentAnalyzed) this.minuteCounts[sentiment] += 1;
    if (language) {
      const key = language.toLowerCase();
      const counts = this.minuteByLanguage.get(key) ?? { total: 0, positive: 0, neutral: 0, negative: 0 };
      counts.total += 1;
      if (sentimentAnalyzed) counts[sentiment] += 1;
      this.minuteByLanguage.set(key, counts);
    }
    contentTypes.forEach(type => this.minuteByContentType.set(type, (this.minuteByContentType.get(type) ?? 0) + 1));
    labels.forEach(label => this.minuteByLabel.set(label, (this.minuteByLabel.get(label) ?? 0) + 1));
  }

  private startWatchdog() {
    this.watchdogTimer = setInterval(() => {
      const socketOpen = this.ws?.readyState === WebSocket.OPEN;
      if ((this.running && socketOpen) || this.reconnectTimer) return;
      console.warn('[Firehose] Watchdog restarting an unhealthy stream');
      this.running = false;
      this.connected = false;
      this.ws?.close();
      this.ws = null;
      this.start();
    }, FirehoseService.WATCHDOG_INTERVAL_MS);
  }

  private loadCollectionState() {
    try {
      if (fs.existsSync(COLLECTION_STATE_FILE)) {
        const data = fs.readFileSync(COLLECTION_STATE_FILE, 'utf-8');
        const state: CollectionState = JSON.parse(data);
        if (state.enabled && state.window) {
          this.collectionEnabled = true;
          this.currentWindow = state.window;
          console.log(`[Firehose] Restored collection state: window=${state.window}, enabledAt=${state.enabledAt}`);
        }
      }
    } catch (error) {
      console.error('[Firehose] Error loading collection state:', error);
    }
  }

  private saveCollectionState() {
    try {
      const state: CollectionState = {
        enabled: this.collectionEnabled,
        window: this.currentWindow,
        enabledAt: this.collectionEnabled ? new Date().toISOString() : null,
      };
      fs.writeFileSync(COLLECTION_STATE_FILE, JSON.stringify(state, null, 2));
      console.log(`[Firehose] Saved collection state: enabled=${state.enabled}, window=${state.window}`);
    } catch (error) {
      console.error('[Firehose] Error saving collection state:', error);
    }
  }

  private async loadGlobalStats() {
    const stats = await getGlobalStats();
    if (stats) {
      this.totalProcessed = stats.totalPosts;
      this.sentimentCounts.positive = stats.totalPositive;
      this.sentimentCounts.negative = stats.totalNegative;
      this.sentimentCounts.neutral = stats.totalNeutral;
    }
  }

  public start(filters: string[] = []) {
    if (this.running) {
      console.log('[Firehose] Already running');
      return;
    }

    // Filters parameter ignored - filtering is now client-side only
    if (filters && filters.length > 0) {
      console.warn('[Firehose] Warning: Server-side filters are deprecated. Use client-side filtering instead.');
    }

    this.running = true;
    this.startTime = new Date();
    this.connect();

    console.log('[Firehose] Started - all posts will be broadcast to all clients');
    this.emit('started');
  }

  public stop() {
    console.log('[Firehose] Stopping firehose connection...');
    this.running = false;
    this.connected = false;
    this.collectionEnabled = false;
    this.currentWindow = null;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    console.log('[Firehose] Stopped');
    this.emit('stopped');
  }

  public enableCollection(window: string) {
    console.log(`[Firehose] Enabling collection for window: ${window}`);
    this.collectionEnabled = true;
    this.currentWindow = window;
    this.saveCollectionState(); // Persist to disk
    this.emit('collection_started', { window });
  }

  public disableCollection() {
    console.log('[Firehose] Disabling collection');
    const window = this.currentWindow;
    this.collectionEnabled = false;
    this.currentWindow = null;
    this.saveCollectionState(); // Persist to disk
    this.emit('collection_stopped', { window });
  }

  public isCollecting(): boolean {
    return this.collectionEnabled;
  }

  public getCurrentWindow(): string | null {
    return this.currentWindow;
  }

  public reset() {
    console.warn('[Firehose] Reset method is deprecated - stats should be persistent');
    console.warn('[Firehose] Ignoring reset request to maintain accurate historical data');
    // Stats should be persistent - this is now a no-op
    return;
  }

  public getStats(): FirehoseStats {
    const now = Date.now();

    // Calculate posts per minute - filter timestamps within last 60 seconds
    this.postsLastMinute = this.postsLastMinute.filter(timestamp => now - timestamp < 60000);

    // Report an actual rolling count. During the first minute after a restart,
    // blend the last completed persisted bucket with the live partial minute so
    // a page load never presents a misleading zero-to-the-moon ramp.
    const liveSeconds = Math.min(60, Math.max(0, (now - this.startedAtMs) / 1000));
    const priorWeight = Math.max(0, 1 - liveSeconds / 60);
    const postsPerMinute = Math.round(this.postsLastMinute.length + this.fallbackPostsPerMinute * priorWeight);

    const duration = this.startTime
      ? Math.floor((now - this.startTime.getTime()) / 1000)
      : 0;

    return {
      totalPosts: this.totalProcessed,
      postsPerMinute,
      sentimentCounts: { ...this.sentimentCounts },
      duration,
      running: this.running,
      connected: this.connected,
      lastEventAt: this.lastPostAt?.toISOString() ?? null,
    };
  }

  public getRecentPosts(limit: number = 50): FirehosePost[] {
    return this.recentPosts.slice(0, limit);
  }

  // setFilters method removed - filtering is now client-side only
  // Each client implements their own filters without affecting other users

  private connect() {
    if (!this.running) {
      return;
    }

    try {
      this.ws = new WebSocket(FIREHOSE_URI);

      this.ws.on('open', () => {
        console.log('[Firehose] Connected to Bluesky firehose');
        this.connected = true;
        this.emit('connected');
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        console.error('[Firehose] WebSocket error:', error.message);
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.log('[Firehose] Connection closed');
        this.connected = false;
        this.ws = null;
        
        if (this.running) {
          console.log(`[Firehose] Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, RECONNECT_DELAY);
        }
      });
    } catch (error) {
      console.error('[Firehose] Connection error:', error);
      if (this.running) {
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, RECONNECT_DELAY);
      }
    }
  }

  private handleMessage(data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle identity events to build handle cache
      if (message.kind === 'identity' && message.identity?.handle) {
        if (this.handleCache.size >= MAX_HANDLE_CACHE) {
          const oldest = this.handleCache.keys().next().value;
          if (oldest) this.handleCache.delete(oldest);
        }
        this.handleCache.set(message.identity.did, message.identity.handle);
        return;
      }
      
      // Only process post commits
      if (message.kind !== 'commit' || message.commit?.operation !== 'create') {
        return;
      }

      const record = message.commit?.record;
      if (!record || !record.text) {
        return;
      }

      // Truncate long text
      let text = record.text;
      if (text.length > MAX_TEXT_LENGTH) {
        text = text.substring(0, MAX_TEXT_LENGTH);
      }

      const features = extractFeatures(text, record);
      // The bundled AFINN lexicon is English. Do not manufacture sentiment
      // labels for other languages; they still pass through the full stream.
      const sentimentAnalyzed = isEnglishLanguage(features.language);
      const sentimentResult = sentimentAnalyzed
        ? analyzeSentiment(text)
        : { score: 0, comparative: 0, classification: 'neutral' as const, positive: [], negative: [] };

      // Create post object for UI (always emit to Socket.IO for real-time display)
      const authorDid = message.did || '';
      const authorHandle = this.handleCache.get(authorDid) || authorDid;
      const media = process.env.ENRICH_MEDIA === '0' ? undefined : buildMediaBundle(record.embed, authorDid);

      // Construct AT URI from message components if not provided
      // Format: at://did/collection/rkey
      const uri = message.commit?.uri ||
        `at://${message.did}/app.bsky.feed.post/${message.commit?.rkey || ''}`;

      const post: FirehosePost = {
        text,
        uri: uri,
        cid: message.commit.cid || '',
        author: {
          did: authorDid,
          handle: authorHandle,
        },
        createdAt: record.createdAt || new Date().toISOString(),
        sentiment: sentimentResult.classification,
        sentimentScore: sentimentResult.comparative,
        sentimentAnalyzed,
        language: features.language,
        hasImages: !!media?.images?.length || features.hasImages,
        hasVideo: !!media?.video || features.hasVideo,
        hasLink: !!media?.linkCard || features.hasLink,
        isReply: !!record.reply,
        isQuote: features.isQuote,
        media,
      };

      // ALWAYS update statistics and emit for UI (even if not saving to database)
      this.totalProcessed++;
      if (sentimentAnalyzed) this.sentimentCounts[sentimentResult.classification]++;
      this.postsLastMinute.push(Date.now());
      this.lastPostAt = new Date();

      const contentTypes: MinuteContentType[] = [];
      if (post.hasImages) contentTypes.push('image');
      if (post.hasVideo) contentTypes.push('video');
      if (post.hasLink) contentTypes.push('link');
      if (contentTypes.length === 0) contentTypes.push('text');
      const cachedProfile = getProfileEnricher().peek(authorDid);
      const labels = (cachedProfile?.labels ?? [])
        .filter(label => !label.neg)
        .map(label => label.val);
      this.recordMinuteBucketPost(post.sentiment, post.sentimentAnalyzed, post.language, contentTypes, labels);

      // Keep recent posts in memory for UI
      this.recentPosts.unshift(post);
      if (this.recentPosts.length > 100) {
        this.recentPosts.pop();
      }

      // ALWAYS emit post event for real-time UI updates
      this.emit('post', post);
      getProfileEnricher().seen(authorDid);

      // DATABASE FILTERING: Only save posts during collection windows
      // This creates stratified hourly samples for corpus research
      if (!this.collectionEnabled) {
        this.filteredCounts.notCollecting++;
        this.logFilterStats();
        return; // Don't save to DB, but stats and UI already updated above
      }

      // FILTER 1: English only for corpus research
      // Accept if: (a) language explicitly English, or (b) language unknown but text is ASCII-heavy (heuristic)
      const langLower = (features.language || '').toLowerCase();
      const isExplicitEnglish = langLower.startsWith('en');
      const isUnknownLanguage = !features.language || features.language === 'unknown';

      // ASCII heuristic: if >85% of characters are ASCII, likely English
      const asciiCount = text.replace(/[^\x00-\x7F]/g, '').length;
      const asciiRatio = text.length > 0 ? asciiCount / text.length : 0;
      const isLikelyEnglish = isUnknownLanguage && asciiRatio > 0.85;

      if (!isExplicitEnglish && !isLikelyEnglish) {
        this.filteredCounts.nonEnglish++;
        this.logFilterStats();
        return;
      }

      // FILTER 2: Original posts only (no quotes, no replies)
      if (record.reply || features.isQuote || record.embed?.record) {
        this.filteredCounts.quotesReplies++;
        this.logFilterStats();
        return;
      }

      // FILTER 3: Word count between 10-500 words for quality corpus data
      const wordCount = features.wordCount || 0;
      if (wordCount < 10 || wordCount > 500) {
        this.filteredCounts.wordCount++;
        this.logFilterStats();
        return;
      }

      // FILTER 4: Skip posts that are mostly URLs/mentions
      const linkCount = features.links ? JSON.parse(features.links).length : 0;
      const mentionCount = features.mentions ? JSON.parse(features.mentions).length : 0;
      if (linkCount > 3 || mentionCount > 5) {
        this.filteredCounts.tooManyLinks++;
        this.logFilterStats();
        return;
      }

      // Post passed all filters - save to database
      this.filteredCounts.saved++;
      this.savePost(post, record, features, sentimentResult).catch(err => {
        console.error('[Firehose] Error saving post:', err.message);
      });

    } catch (error) {
      console.error('[Firehose] Error processing message:', error);
    }
  }

  private async savePost(
    post: FirehosePost, 
    record: any, 
    features: any, 
    sentimentResult: any
  ) {
    try {
      const dbPost: InsertPost = {
        text: post.text,
        authorDid: post.author.did,
        authorHandle: post.author.handle,
        sentiment: post.sentiment,
        sentimentScore: post.sentimentScore,
        timestamp: new Date(),
        createdAt: new Date(post.createdAt),
        uri: post.uri,
        cid: post.cid,
        replyParent: record.reply?.parent?.uri || null,
        replyRoot: record.reply?.root?.uri || null,
        embedType: record.embed?.$type || null,
        hasImages: features.hasImages,
        hasVideo: features.hasVideo,
        hasLink: features.hasLink,
        isQuote: features.isQuote,
        quoteUri: features.quoteUri,
        language: features.language,
        charCount: features.charCount,
        wordCount: features.wordCount,
        hashtags: features.hashtags,
        mentions: features.mentions,
        links: features.links,
        facets: record.facets ? JSON.stringify(record.facets) : null,
        collectionWindow: this.currentWindow, // Track which hourly window this post came from
      };

      // Try to insert post, but continue with stats updates even if it fails
      let postInserted = false;
      try {
        await insertPost(dbPost);
        postInserted = true;
      } catch (error) {
        // Silently ignore duplicate key errors
        if (error instanceof Error && !error.message.includes('Duplicate entry')) {
          throw error;
        }
      }

      // Update global stats periodically (every 100 posts)
      if (this.totalProcessed % 100 === 0) {
        await updateGlobalStats({
          totalPosts: this.totalProcessed,
          totalPositive: this.sentimentCounts.positive,
          totalNegative: this.sentimentCounts.negative,
          totalNeutral: this.sentimentCounts.neutral,
          lastPostTimestamp: new Date(),
        });
      }

      // Update language stats (always, even if post was duplicate)
      if (features.language && features.language !== 'unknown') {
        await updateLanguageStats(features.language, post.sentiment);
      }

      // Update hashtag stats (always, even if post was duplicate)
      if (features.hashtags) {
        const hashtags = JSON.parse(features.hashtags);
        for (const hashtag of hashtags) {
          await updateHashtagStats(hashtag, post.sentiment);
        }
      }

    } catch (error) {
      console.error('[Firehose] Error in savePost:', error);
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  private logFilterStats() {
    // Log filter stats every 60 seconds
    const now = Date.now();
    if (now - this.lastFilterLog > 60000) {
      const total = Object.values(this.filteredCounts).reduce((a, b) => a + b, 0);
      console.log('[Filtering] Stats (last minute):', {
        total,
        saved: this.filteredCounts.saved,
        notCollecting: this.filteredCounts.notCollecting,
        nonEnglish: this.filteredCounts.nonEnglish,
        quotesReplies: this.filteredCounts.quotesReplies,
        wordCount: this.filteredCounts.wordCount,
        tooManyLinks: this.filteredCounts.tooManyLinks,
        saveRate: total > 0 ? `${(100 * this.filteredCounts.saved / total).toFixed(1)}%` : '0%'
      });
      
      // Reset counters
      this.filteredCounts = {
        notCollecting: 0,
        nonEnglish: 0,
        quotesReplies: 0,
        wordCount: 0,
        tooManyLinks: 0,
        saved: 0,
      };
      this.lastFilterLog = now;
    }
  }
}

// Singleton instance
let firehoseInstance: FirehoseService | null = null;

export function getFirehoseService(): FirehoseService {
  if (!firehoseInstance) {
    firehoseInstance = new FirehoseService();
  }
  return firehoseInstance;
}
