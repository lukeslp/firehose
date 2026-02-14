/**
 * Shared TypeScript types for Firehose UX variants
 */

export interface FirehosePost {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  createdAt: string;
  language?: string;
  uri?: string;
  hasImages?: boolean;
  hasVideo?: boolean;
  hasLink?: boolean;
  hashtags?: string[];
  mentions?: string[];
  author?: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  isReply?: boolean;
  isQuote?: boolean;
  isRepost?: boolean;
  images?: MediaItem[];
  videos?: MediaItem[];
  sensitive?: boolean;
  likes?: number;
}

export interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
  comparative: number;
}

export interface LanguageStats {
  language: string;
  count: number;
  percentage: number;
}

export interface HashtagTrend {
  hashtag: string;
  count: number;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export interface NetworkHealth {
  connected: boolean;
  postsPerMinute: number;
  totalPosts: number;
  uptime: number;
  lastUpdate: string;
}

export interface FirehoseStats {
  totalPosts: number;
  postsPerMinute: number;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  languageDistribution: LanguageStats[];
  topHashtags: HashtagTrend[];
  running: boolean;
}

export interface VariantProps {
  className?: string;
  onNavigateBack?: () => void;
}

export interface ThemeConfig {
  name: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    positive: string;
    negative: string;
    neutral: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
}
