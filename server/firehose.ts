import WebSocket from 'ws';
import { EventEmitter } from 'events';
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

    // Auto-start the firehose - it should always run
    // Small delay to ensure stats are loaded first
    setTimeout(() => {
      if (!this.running) {
        console.log('[Firehose] Auto-starting on initialization...');
        this.start();
      }
    }, 1000);
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
    console.warn('[Firehose] Stop method is deprecated - firehose should always run');
    console.warn('[Firehose] Ignoring stop request to maintain continuous data collection');
    // Firehose should always run - this is now a no-op
    return;
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

      // Server-side filtering removed - all posts are sent to all clients
      // Clients implement their own filtering based on user preferences

      // Analyze sentiment
      const sentimentResult = analyzeSentiment(text);
      
      // Extract features
      const features = extractFeatures(text, record);

      // Create post object
      const authorDid = message.did || '';
      const authorHandle = this.handleCache.get(authorDid) || authorDid; // Fallback to DID if handle not cached
      
      const post: FirehosePost = {
        text,
        uri: message.commit.uri || '',
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

      // Update statistics
      this.totalProcessed++;
      this.sentimentCounts[sentimentResult.classification]++;
      this.postsLastMinute.push(Date.now());
      
      // Keep only recent posts in memory
      this.recentPosts.unshift(post);
      if (this.recentPosts.length > 100) {
        this.recentPosts.pop();
      }

      // Emit post event
      this.emit('post', post);

      // Save to database (async, don't wait)
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
}

// Singleton instance
let firehoseInstance: FirehoseService | null = null;

export function getFirehoseService(): FirehoseService {
  if (!firehoseInstance) {
    firehoseInstance = new FirehoseService();
  }
  return firehoseInstance;
}
