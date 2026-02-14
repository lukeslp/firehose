# Firehose Variant Types - Usage Guide

This guide shows how to use the shared TypeScript types for creating firehose dashboard variants.

## Overview

All firehose variants share the same Socket.IO data structure but display it with different visual aesthetics. The types in `types.ts` ensure type safety across all variants.

## Import Types

```typescript
import type {
  FirehosePost,
  FirehoseStats,
  VariantProps,
  ThemeConfig,
  SocketEventHandlers,
  SentimentData,
  LanguageStats,
  HashtagTrend,
  NetworkHealth,
} from './types';
```

## Using Socket.IO Events

### Basic Socket Hook

```typescript
import { useSocket } from '@/hooks/useSocket';

export function MyVariant({ className, maxPosts = 50 }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);

  // Handle incoming posts
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));
    }
  }, [latestPost, maxPosts]);

  return (
    <div className={className}>
      <h1>Posts: {stats?.totalPosts || 0}</h1>
      {/* Render posts */}
    </div>
  );
}
```

### Type-Safe Event Handlers

```typescript
import { io } from 'socket.io-client';
import type { FirehosePost, FirehoseStats } from './types';

const socket = io({ path: '/socket.io' });

// Type-safe event handlers
socket.on('post', (post: FirehosePost) => {
  console.log(`New post from ${post.author.handle}:`, post.text);
  console.log(`Sentiment: ${post.sentiment} (${post.sentimentScore})`);
});

socket.on('stats', (stats: FirehoseStats) => {
  console.log(`Total: ${stats.totalPosts}, Rate: ${stats.postsPerMinute}/min`);
});

socket.on('connect', () => {
  console.log('Connected to firehose');
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

## Working with Posts

### Accessing Post Properties

```typescript
function PostCard({ post }: { post: FirehosePost }) {
  return (
    <div>
      {/* Author info */}
      <div>
        <strong>@{post.author.handle}</strong>
        <span>{post.author.did}</span>
      </div>

      {/* Post content */}
      <p>{post.text}</p>

      {/* Metadata */}
      <div>
        <span>Sentiment: {post.sentiment}</span>
        <span>Score: {post.sentimentScore.toFixed(2)}</span>
        {post.language && <span>Language: {post.language}</span>}
      </div>

      {/* Media indicators */}
      <div>
        {post.hasImages && <span>📷 Image</span>}
        {post.hasVideo && <span>🎥 Video</span>}
        {post.hasLink && <span>🔗 Link</span>}
        {post.isReply && <span>↩️ Reply</span>}
        {post.isQuote && <span>💬 Quote</span>}
      </div>

      {/* Bluesky link */}
      {post.uri && (
        <a
          href={`https://bsky.app/profile/${post.uri.split('/')[2]}/post/${post.uri.split('/')[4]}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Bluesky
        </a>
      )}
    </div>
  );
}
```

### Sentiment-based Styling

```typescript
function getSentimentColor(sentiment: FirehosePost['sentiment']): string {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-500';
    case 'negative':
      return 'bg-red-500';
    case 'neutral':
    default:
      return 'bg-gray-500';
  }
}

function PostWithSentiment({ post }: { post: FirehosePost }) {
  const colorClass = getSentimentColor(post.sentiment);

  return (
    <div className={`p-4 ${colorClass}`}>
      <p>{post.text}</p>
    </div>
  );
}
```

## Working with Stats

### Display Stats

```typescript
function StatsPanel({ stats }: { stats: FirehoseStats | null }) {
  if (!stats) return <div>Loading...</div>;

  const total = stats.sentimentCounts.positive +
                stats.sentimentCounts.neutral +
                stats.sentimentCounts.negative;

  const posPercent = total > 0 ? (stats.sentimentCounts.positive / total) * 100 : 0;
  const neuPercent = total > 0 ? (stats.sentimentCounts.neutral / total) * 100 : 0;
  const negPercent = total > 0 ? (stats.sentimentCounts.negative / total) * 100 : 0;

  return (
    <div>
      <h2>Firehose Statistics</h2>

      <div>
        <strong>Total Posts:</strong> {stats.totalPosts.toLocaleString()}
      </div>

      <div>
        <strong>Posts/Minute:</strong> {stats.postsPerMinute}
      </div>

      <div>
        <strong>Duration:</strong> {Math.floor(stats.duration / 60)}m {stats.duration % 60}s
      </div>

      <div>
        <strong>Status:</strong> {stats.running ? '🟢 Running' : '🔴 Stopped'}
      </div>

      <div>
        <h3>Sentiment Distribution</h3>
        <div>Positive: {stats.sentimentCounts.positive} ({posPercent.toFixed(1)}%)</div>
        <div>Neutral: {stats.sentimentCounts.neutral} ({neuPercent.toFixed(1)}%)</div>
        <div>Negative: {stats.sentimentCounts.negative} ({negPercent.toFixed(1)}%)</div>
      </div>

      {stats.inDatabase !== undefined && (
        <div>
          <strong>In Database:</strong> {stats.inDatabase.toLocaleString()}
        </div>
      )}
    </div>
  );
}
```

## Theme Configuration

### Define Variant Theme

```typescript
const swissTheme: ThemeConfig = {
  id: 'swiss',
  name: 'Swiss Design',
  colors: {
    primary: '#000000',
    background: '#FFFFFF',
    foreground: '#000000',
    border: '#000000',
    accent: '#FF0000',
    sentiment: {
      positive: 'oklch(0.75 0.22 145)',
      neutral: 'oklch(0.65 0.06 90)',
      negative: 'oklch(0.6 0.23 25)',
    },
  },
  typography: {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    baseFontSize: 16,
    lineHeight: 1.5,
    headingWeight: 700,
  },
  grid: {
    size: 8,
    showOverlay: false,
  },
  animation: {
    duration: 300,
    easing: 'ease-in-out',
    reduceMotion: false,
  },
};

function SwissVariant({ className }: VariantProps) {
  return (
    <div
      className={className}
      style={{
        fontFamily: swissTheme.typography.fontFamily,
        backgroundColor: swissTheme.colors.background,
        color: swissTheme.colors.foreground,
      }}
    >
      {/* Variant content */}
    </div>
  );
}
```

## Language Statistics

```typescript
function LanguageChart({ languages }: { languages: LanguageStats[] }) {
  return (
    <div>
      <h3>Top Languages</h3>
      {languages.map(lang => (
        <div key={lang.language}>
          <span>{lang.displayName || lang.language}</span>
          <span>{lang.postsCount.toLocaleString()}</span>
          {lang.percentage && <span>({lang.percentage.toFixed(1)}%)</span>}
        </div>
      ))}
    </div>
  );
}
```

## Hashtag Trends

```typescript
function TrendingHashtags({ hashtags }: { hashtags: HashtagTrend[] }) {
  return (
    <div>
      <h3>Trending Hashtags</h3>
      {hashtags.map(tag => (
        <div key={tag.tag}>
          <span>{tag.tag}</span>
          <span>{tag.count} posts</span>
          {tag.velocity && <span>🔥 {tag.velocity}/min</span>}
          {tag.sentiment && (
            <div>
              ✅ {tag.sentiment.positive} |
              ➖ {tag.sentiment.neutral} |
              ❌ {tag.sentiment.negative}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Network Health Monitoring

```typescript
function ConnectionStatus({ health }: { health: NetworkHealth }) {
  return (
    <div>
      <div className={health.connected ? 'text-green-500' : 'text-red-500'}>
        {health.connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {health.transport && (
        <div>Transport: {health.transport}</div>
      )}

      {health.latency !== undefined && (
        <div>Latency: {health.latency}ms</div>
      )}

      {health.reconnectAttempts !== undefined && health.reconnectAttempts > 0 && (
        <div>Reconnect attempts: {health.reconnectAttempts}</div>
      )}

      {health.error && (
        <div className="text-red-500">Error: {health.error}</div>
      )}

      {health.lastConnected && (
        <div>Last connected: {health.lastConnected.toLocaleTimeString()}</div>
      )}
    </div>
  );
}
```

## Timeline Data

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

function SentimentTimeline({ data }: { data: TimelineDataPoint[] }) {
  // Format data for recharts
  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    positive: point.positivePercent || 0,
    neutral: point.neutralPercent || 0,
    negative: point.negativePercent || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Line type="monotone" dataKey="positive" stroke="#10b981" />
        <Line type="monotone" dataKey="neutral" stroke="#6b7280" />
        <Line type="monotone" dataKey="negative" stroke="#ef4444" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## Accessibility

### Reduced Motion

```typescript
import { useMemo } from 'react';

export function MyVariant({ reduceMotion = false }: VariantProps) {
  const prefersReducedMotion = useMemo(
    () => reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [reduceMotion]
  );

  return (
    <motion.div
      animate={!prefersReducedMotion ? { scale: 1.05 } : {}}
      transition={{ duration: 0.3 }}
    >
      {/* Content */}
    </motion.div>
  );
}
```

## Complete Example: Minimal Variant

```typescript
import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, FirehoseStats, VariantProps } from './types';

export function MinimalVariant({ className, maxPosts = 50 }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);

  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));
    }
  }, [latestPost, maxPosts]);

  return (
    <div className={`min-h-screen p-8 ${className || ''}`}>
      <header className="mb-8">
        <h1 className="text-4xl font-bold">Bluesky Firehose</h1>
        <div className="text-sm">
          Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 border rounded">
          <div className="text-sm opacity-60">Total Posts</div>
          <div className="text-2xl font-bold">
            {(stats?.totalPosts || 0).toLocaleString()}
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm opacity-60">Posts/Minute</div>
          <div className="text-2xl font-bold">
            {stats?.postsPerMinute || 0}
          </div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm opacity-60">Positive</div>
          <div className="text-2xl font-bold text-green-500">
            {(stats?.sentimentCounts?.positive || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {posts.map((post, idx) => (
          <div
            key={post.uri || idx}
            className="p-4 border rounded hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2 text-sm opacity-60">
              <span>@{post.author?.handle || 'unknown'}</span>
              <span>•</span>
              <span>{post.sentiment}</span>
              {post.language && (
                <>
                  <span>•</span>
                  <span>{post.language}</span>
                </>
              )}
            </div>
            <p className="mb-2">{post.text}</p>
            <div className="flex gap-2 text-xs">
              {post.hasImages && <span>📷</span>}
              {post.hasVideo && <span>🎥</span>}
              {post.hasLink && <span>🔗</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Type Guards

```typescript
// Check if stats are valid
function hasValidStats(stats: FirehoseStats | null): stats is FirehoseStats {
  return stats !== null && typeof stats.totalPosts === 'number';
}

// Check if post has media
function hasMedia(post: FirehosePost): boolean {
  return !!(post.hasImages || post.hasVideo || post.hasLink);
}

// Check sentiment category
function isPositive(post: FirehosePost): boolean {
  return post.sentiment === 'positive';
}

function isNegative(post: FirehosePost): boolean {
  return post.sentiment === 'negative';
}
```

## Best Practices

1. **Always use shared types** - Import from `./types` instead of defining local interfaces
2. **Handle null states** - Stats and posts can be `null` during initial load
3. **Respect reduced motion** - Check `prefers-reduced-motion` for animations
4. **Limit post arrays** - Use `.slice(0, maxPosts)` to prevent memory leaks
5. **Format numbers** - Use `.toLocaleString()` for large numbers
6. **Show connection status** - Always display the `connected` state
7. **Calculate percentages** - Divide by total, multiply by 100, use `.toFixed(1)`
8. **Provide fallbacks** - Use `|| 0` or `|| 'unknown'` for optional fields

## See Also

- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
