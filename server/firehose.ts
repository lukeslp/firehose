import WebSocket from 'ws';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { analyzeSentiment, extractFeatures } from './sentiment';
import {
  insertPost,
  updateGlobalStats,
  updateLanguageStats,
  updateHashtagStats,
  getGlobalStats
} from './db';
import { InsertPost } from '../drizzle/schema';

const FIREHOSE_URI = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&wantedEvents=identity';
const MAX_TEXT_LENGTH = 10000;
const RECONNECT_DELAY = 5000;
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
  language?: string;
  hasImages?: boolean;
  hasVideo?: boolean;
  hasLink?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
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
}

export class FirehoseService extends EventEmitter {
  private ws: WebSocket | null = null;
  private running = false;
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

  constructor() {
    super();
    this.loadGlobalStats();
    this.loadCollectionState(); // Restore collection state from disk

    // Auto-start the firehose - it should always run
    // Small delay to ensure stats are loaded first
    setTimeout(() => {
      if (!this.running) {
        console.log('[Firehose] Auto-starting on initialization...');
        this.start();
      }
    }, 1000);
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

    // Calculate rolling window estimate based on available data
    let postsPerMinute = 0;
    if (this.postsLastMinute.length > 0) {
      const oldestTimestamp = Math.min(...this.postsLastMinute);
      const timeWindowSeconds = (now - oldestTimestamp) / 1000;

      if (timeWindowSeconds > 0) {
        // Normalize to per-minute rate: (posts / seconds) * 60
        postsPerMinute = Math.round((this.postsLastMinute.length / timeWindowSeconds) * 60);
      }
    }

    const duration = this.startTime
      ? Math.floor((now - this.startTime.getTime()) / 1000)
      : 0;

    return {
      totalPosts: this.totalProcessed,
      postsPerMinute,
      sentimentCounts: { ...this.sentimentCounts },
      duration,
      running: this.running,
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
        this.handleCache.set(message.identity.did, message.identity.handle);
        console.log(`[Firehose] Cached handle: ${message.identity.handle} for DID: ${message.identity.did}`);
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

      // Analyze sentiment and features for all posts
      const sentimentResult = analyzeSentiment(text);
      const features = extractFeatures(text, record);

      // Create post object for UI (always emit to Socket.IO for real-time display)
      const authorDid = message.did || '';
      const authorHandle = this.handleCache.get(authorDid) || authorDid;

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
        language: features.language,
        hasImages: features.hasImages,
        hasVideo: features.hasVideo,
        hasLink: features.hasLink,
        isReply: !!record.reply,
        isQuote: features.isQuote,
      };

      // ALWAYS update statistics and emit for UI (even if not saving to database)
      this.totalProcessed++;
      this.sentimentCounts[sentimentResult.classification]++;
      this.postsLastMinute.push(Date.now());

      // Keep recent posts in memory for UI
      this.recentPosts.unshift(post);
      if (this.recentPosts.length > 100) {
        this.recentPosts.pop();
      }

      // ALWAYS emit post event for real-time UI updates
      this.emit('post', post);

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
