/**
 * Shared TypeScript interfaces for Firehose dashboard variants
 *
 * All variants consume the same Socket.IO data structure but present it
 * with different visual aesthetics (Swiss, Retro Terminal, Neon Cyberpunk, Data Artist).
 *
 * These types ensure type safety for:
 * - Socket.IO event handlers
 * - Real-time data updates
 * - Component props
 * - Theme configuration
 */

/**
 * Real-time post data from Socket.IO 'post' event
 *
 * Emitted by server on every new Bluesky post received via Jetstream WebSocket.
 * Contains full post metadata, sentiment analysis, and author information.
 */
export interface FirehosePost {
  /** Post text content (max 10,000 chars, truncated if longer) */
  text: string;

  /** AT Protocol URI (format: at://did/app.bsky.feed.post/rkey) */
  uri: string;

  /** Content Identifier (IPFS-style hash) */
  cid: string;

  /** Author information */
  author: {
    /** Decentralized Identifier */
    did: string;
    /** Bluesky handle (e.g., user.bsky.social) */
    handle: string;
  };

  /** ISO 8601 timestamp when post was created */
  createdAt: string;

  /** Sentiment classification from VADER analysis */
  sentiment: 'positive' | 'negative' | 'neutral';

  /** Sentiment score (-1 to +1, where -1 is most negative, +1 is most positive) */
  sentimentScore: number;

  /** ISO 639-1 language code (e.g., 'en', 'ja', 'es') */
  language?: string;

  /** True if post contains image embeds */
  hasImages?: boolean;

  /** True if post contains video embeds */
  hasVideo?: boolean;

  /** True if post contains URL links */
  hasLink?: boolean;

  /** True if post is a reply to another post */
  isReply?: boolean;

  /** True if post quotes another post */
  isQuote?: boolean;
}

/**
 * Aggregated statistics from Socket.IO 'stats' event
 *
 * Emitted by server every 1 second with current firehose metrics.
 * Includes lifetime totals and real-time rate calculations.
 */
export interface FirehoseStats {
  /** Lifetime total posts processed since server start */
  totalPosts: number;

  /** Current posts per minute rate (rolling 60-second window) */
  postsPerMinute: number;

  /** Lifetime sentiment distribution counts */
  sentimentCounts: {
    positive: number;
    negative: number;
    neutral: number;
  };

  /** Seconds since firehose started */
  duration: number;

  /** True if firehose WebSocket is connected and receiving posts */
  running: boolean;

  /** Optional: number of posts in database (if collection window active) */
  inDatabase?: number;
}

/**
 * Sentiment analysis result
 *
 * Used for individual post analysis and aggregated sentiment tracking.
 */
export interface SentimentData {
  /** Sentiment classification */
  classification: 'positive' | 'negative' | 'neutral';

  /** Normalized sentiment score (-1 to +1) */
  comparative: number;

  /** Raw VADER sentiment score */
  score: number;

  /** Optional: individual token contributions */
  tokens?: Array<{
    word: string;
    score: number;
  }>;
}

/**
 * Language distribution statistics
 *
 * Tracks post counts by language code for real-time language charts.
 */
export interface LanguageStats {
  /** ISO 639-1 language code */
  language: string;

  /** Number of posts in this language */
  postsCount: number;

  /** Percentage of total posts */
  percentage?: number;

  /** Display name (e.g., "Japanese" for "ja") */
  displayName?: string;

  /** Optional: color for visualization */
  color?: string;
}

/**
 * Hashtag trending data
 *
 * Tracks hashtag frequency for trending topics visualization.
 */
export interface HashtagTrend {
  /** Hashtag text (including '#' prefix) */
  tag: string;

  /** Number of occurrences */
  count: number;

  /** Posts per minute velocity (for "trending" calculation) */
  velocity?: number;

  /** Sentiment distribution for this hashtag */
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
  };

  /** Optional: rank by count (1 = most popular) */
  rank?: number;
}

/**
 * Network health and connection status
 *
 * Tracks Socket.IO connection state and latency metrics.
 */
export interface NetworkHealth {
  /** True if Socket.IO is connected */
  connected: boolean;

  /** WebSocket transport type ('websocket' or 'polling') */
  transport?: 'websocket' | 'polling';

  /** Round-trip latency in milliseconds */
  latency?: number;

  /** Number of reconnection attempts */
  reconnectAttempts?: number;

  /** Last connection timestamp */
  lastConnected?: Date;

  /** Last disconnection timestamp */
  lastDisconnected?: Date;

  /** Connection error message (if disconnected) */
  error?: string;
}

/**
 * Common props for all variant components
 *
 * Base interface that all firehose variant components should extend.
 */
export interface VariantProps {
  /** Optional CSS class name for custom styling */
  className?: string;

  /** Maximum number of posts to display in feed (default: 50) */
  maxPosts?: number;

  /** Enable reduced motion for accessibility */
  reduceMotion?: boolean;

  /** Initial language filter ('all', 'en', 'ja', etc.) */
  defaultLanguageFilter?: string;

  /** Enable fullscreen mode toggle */
  enableFullscreen?: boolean;

  /** Custom Socket.IO path (for non-standard deployments) */
  socketPath?: string;
}

/**
 * Theme configuration for each variant
 *
 * Defines color palette, typography, and visual style for a firehose variant.
 * Each variant (Swiss, Retro, Neon, Data Artist) has its own theme config.
 */
export interface ThemeConfig {
  /** Theme identifier (e.g., 'swiss', 'retro', 'neon', 'data-artist') */
  id: string;

  /** Display name */
  name: string;

  /** Color palette */
  colors: {
    /** Primary brand color */
    primary: string;
    /** Background color */
    background: string;
    /** Foreground/text color */
    foreground: string;
    /** Border color */
    border: string;
    /** Accent color for highlights */
    accent?: string;

    /** Sentiment colors */
    sentiment: {
      positive: string;
      neutral: string;
      negative: string;
    };
  };

  /** Typography configuration */
  typography: {
    /** Font family stack */
    fontFamily: string;
    /** Base font size in pixels */
    baseFontSize: number;
    /** Line height multiplier */
    lineHeight: number;
    /** Heading font weight */
    headingWeight?: number;
  };

  /** Layout grid settings */
  grid?: {
    /** Grid size in pixels (for Swiss design: 8px) */
    size: number;
    /** Show grid overlay (development mode) */
    showOverlay?: boolean;
  };

  /** Animation settings */
  animation?: {
    /** Animation duration in milliseconds */
    duration: number;
    /** Easing function */
    easing: string;
    /** Disable animations for reduced motion */
    reduceMotion: boolean;
  };

  /** Variant-specific custom properties */
  custom?: Record<string, any>;
}

/**
 * Timeline data point for sentiment/rate charts
 *
 * Represents a single sample in time-series visualizations.
 */
export interface TimelineDataPoint {
  /** Timestamp (milliseconds since epoch) */
  timestamp: number;

  /** Formatted time string for x-axis labels */
  time?: string;

  /** Posts per minute rate at this timestamp */
  rate?: number;

  /** Sentiment percentages at this timestamp */
  positivePercent?: number;
  neutralPercent?: number;
  negativePercent?: number;
}

/**
 * Content type distribution
 *
 * Tracks post types (text-only, with images, with video, with links).
 */
export interface ContentTypeStats {
  textOnly: number;
  withImages: number;
  withVideo: number;
  withLinks: number;
}

/**
 * Socket.IO event handlers type map
 *
 * Type-safe event handler signatures for Socket.IO events.
 */
export interface SocketEventHandlers {
  /** Connection established */
  connect: () => void;

  /** Connection lost */
  disconnect: () => void;

  /** New post received */
  post: (post: FirehosePost) => void;

  /** Stats update (every 1 second) */
  stats: (stats: FirehoseStats) => void;

  /** Connection error */
  error: (error: Error) => void;

  /** Reconnection attempt */
  reconnect_attempt: (attempt: number) => void;
}

// Legacy alias for backward compatibility
export type Post = FirehosePost;

// Legacy alias for animation config
export interface AnimationConfig {
  reduceMotion: boolean;
}
