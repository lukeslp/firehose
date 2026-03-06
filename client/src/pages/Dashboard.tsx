import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useSocket } from "@/hooks/useSocket";

interface Post {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  createdAt: string;
  language?: string;
  uri?: string;
  hasImages?: boolean;
  hasVideo?: boolean;
  hasLink?: boolean;
  author?: {
    did: string;
    handle: string;
  };
  isReply?: boolean;
  isQuote?: boolean;
}

const SAMPLE_RATES = [
  { label: '100%', value: 1 },
  { label: '50%', value: 0.5 },
  { label: '25%', value: 0.25 },
  { label: '10%', value: 0.1 },
] as const;

export default function Dashboard() {
  const [filters, setFilters] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sampleRate, setSampleRate] = useState(1);
  const [feedFullScreen, setFeedFullScreen] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [chartCollapsed, setChartCollapsed] = useState(false);

  const { connected: socketConnected, stats: socketStats, latestPost } = useSocket(sampleRate);

  // Fullscreen API listener
  useEffect(() => {
    const handler = () => setIsFullScreenMode(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullScreen = useCallback(async () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    try {
      if (isMobile) {
        setFeedFullScreen(prev => !prev);
      } else if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFeedFullScreen(true);
      } else {
        await document.exitFullscreen();
        setFeedFullScreen(false);
      }
    } catch {
      setFeedFullScreen(prev => !prev);
    }
  }, []);

  // Exit fullscreen on ESC (CSS-only mode)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && feedFullScreen && !document.fullscreenElement) {
        setFeedFullScreen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [feedFullScreen]);

  // Sentiment timeline tracking
  const [postTimestamps, setPostTimestamps] = useState<Array<{
    timestamp: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>>([]);
  const [sentimentTimeline, setSentimentTimeline] = useState<Array<{
    timestamp: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  }>>([]);

  // Track post timestamps for sentiment timeline
  useEffect(() => {
    if (!latestPost) return;
    const now = Date.now();
    setPostTimestamps(prev => {
      const twoMinutesAgo = now - 2 * 60 * 1000;
      return [...prev.filter(d => d.timestamp >= twoMinutesAgo), { timestamp: now, sentiment: latestPost.sentiment }];
    });
  }, [latestPost]);

  // Calculate sentiment rates every second
  useEffect(() => {
    const interval = setInterval(() => {
      setPostTimestamps(current => {
        const now = Date.now();
        const recent = current.filter(p => p.timestamp >= now - 60_000);
        if (recent.length > 0) {
          const total = recent.length;
          const positive = recent.filter(p => p.sentiment === 'positive').length;
          const neutral = recent.filter(p => p.sentiment === 'neutral').length;
          const negative = recent.filter(p => p.sentiment === 'negative').length;
          setSentimentTimeline(prev => {
            const oneHourAgo = now - 60 * 60 * 1000;
            return [...prev.filter(d => d.timestamp >= oneHourAgo), {
              timestamp: now,
              positivePercent: (positive / total) * 100,
              neutralPercent: (neutral / total) * 100,
              negativePercent: (negative / total) * 100,
            }];
          });
        }
        return current;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const statsQuery = trpc.firehose.stats.useQuery(undefined, {
    refetchInterval: false,
    enabled: !socketConnected,
  });

  const recentPostsQuery = trpc.firehose.recentPosts.useQuery({ limit: 50 }, {
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (recentPostsQuery.data) setPosts(recentPostsQuery.data as Post[]);
  }, [recentPostsQuery.data]);

  useEffect(() => {
    if (latestPost) setPosts(prev => [latestPost, ...prev].slice(0, 50));
  }, [latestPost]);

  const utils = trpc.useUtils();
  const startMutation = trpc.firehose.startStream.useMutation();
  const stopMutation = trpc.firehose.stopStream.useMutation();

  const handleToggleFirehose = () => {
    if (stats.running) stopMutation.mutate();
    else startMutation.mutate();
  };

  const handleExportCSV = async () => {
    try {
      const result = await utils.firehose.exportCSV.fetch();
      if (result?.csv) {
        const blob = new Blob([result.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bluesky-firehose-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters.split(',').map(f => f.toLowerCase().trim()).filter(f => f.length > 0));
  };

  const handleResetFilters = () => {
    setFilters('');
    setAppliedFilters([]);
  };

  const stats = socketConnected && socketStats ? socketStats : (statsQuery.data || {
    totalPosts: 0,
    inDatabase: 0,
    postsPerMinute: 0,
    sentimentCounts: { positive: 0, negative: 0, neutral: 0 },
    duration: 0,
    running: false,
  });

  const total = (stats.sentimentCounts?.positive || 0) + (stats.sentimentCounts?.neutral || 0) + (stats.sentimentCounts?.negative || 0);
  const posPercent = total > 0 ? ((stats.sentimentCounts?.positive || 0) / total) * 100 : 0;
  const neuPercent = total > 0 ? ((stats.sentimentCounts?.neutral || 0) / total) * 100 : 0;
  const negPercent = total > 0 ? ((stats.sentimentCounts?.negative || 0) / total) * 100 : 0;

  const sentimentTimelineData = sentimentTimeline.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    positive: d.positivePercent,
    neutral: d.neutralPercent,
    negative: d.negativePercent,
  }));

  const hasActiveFilters = appliedFilters.length > 0;
  const canResetFilters = filters.trim().length > 0 || hasActiveFilters;
  const postMatchesFilters = (post: Post) => {
    if (!hasActiveFilters) return true;
    const haystack = `${post.text || ''} ${post.author?.handle || ''}`.toLowerCase();
    return appliedFilters.some(filter => haystack.includes(filter));
  };

  const isFullscreen = feedFullScreen || isFullScreenMode;

  // Fullscreen: only show header + feed
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        {/* Minimal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-foreground shrink-0">
          <h1 className="text-lg font-bold tracking-tight uppercase">BLUESKY FIREHOSE</h1>
          <button
            onClick={toggleFullScreen}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-foreground bg-background hover:bg-foreground hover:text-background transition-colors"
            style={{ borderRadius: 0 }}
          >
            EXIT FULLSCREEN
          </button>
        </div>
        {/* Full-height feed */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 md:px-8 space-y-3">
          {posts.filter(postMatchesFilters).slice(0, 20).map((post, idx) => (
            <PostCard key={post.uri || `post-${idx}-${post.createdAt}`} post={post} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <header className="border-b-2 border-foreground px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight uppercase">BLUESKY FIREHOSE</h1>
            <p className="text-xs sm:text-sm uppercase tracking-widest mt-1" style={{ color: '#01AAFF' }}>
              REAL-TIME SENTIMENT ANALYSIS
            </p>
          </div>
          <div className="flex gap-2 sm:gap-3 items-center self-start sm:self-auto flex-wrap">
            {/* Sample Rate */}
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value))}
              className="px-3 py-2 font-bold uppercase text-xs tracking-wider border-2 border-foreground bg-background text-foreground min-h-[44px]"
              style={{ borderRadius: 0 }}
              title="Stream sample rate — lower values show fewer posts"
            >
              {SAMPLE_RATES.map(r => (
                <option key={r.value} value={r.value}>STREAM {r.label}</option>
              ))}
            </select>
            {/* Fullscreen */}
            <button
              onClick={toggleFullScreen}
              className="px-3 py-2 font-bold uppercase text-xs tracking-wider border-2 border-foreground bg-background text-foreground hover:bg-foreground hover:text-background transition-colors min-h-[44px]"
              style={{ borderRadius: 0 }}
              title="Enter fullscreen mode"
            >
              FULLSCREEN
            </button>
            {/* Play/Pause */}
            <button
              onClick={handleToggleFirehose}
              disabled={startMutation.isPending || stopMutation.isPending}
              className={`px-4 py-2 border-2 cursor-pointer transition-all hover:opacity-80 active:scale-95 min-h-[44px] ${stats.running ? 'bg-[#01AAFF]/10' : 'bg-red-500/10'}`}
              style={{ borderColor: stats.running ? '#01AAFF' : '#ef4444' }}
              title={stats.running ? 'Click to pause firehose' : 'Click to resume firehose'}
            >
              <span className="text-xs font-bold uppercase tracking-widest">
                {startMutation.isPending || stopMutation.isPending
                  ? '... UPDATING'
                  : stats.running ? '▶ RUNNING' : '⏸ PAUSED'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar — compact horizontal */}
      <div className="border-b-2 border-foreground px-4 py-3 sm:px-6 md:px-8 shrink-0">
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-baseline">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold uppercase tracking-widest opacity-60">POSTS/MIN</span>
            <span className="text-lg font-bold tabular-nums">{(stats.postsPerMinute || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="w-2.5 h-2.5" style={{ background: 'oklch(0.75 0.22 145)' }} />
            <span className="text-xs font-bold uppercase tracking-wider">+{posPercent.toFixed(0)}%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="w-2.5 h-2.5" style={{ background: 'oklch(0.65 0.06 90)' }} />
            <span className="text-xs font-bold uppercase tracking-wider">{neuPercent.toFixed(0)}%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="w-2.5 h-2.5" style={{ background: 'oklch(0.6 0.23 25)' }} />
            <span className="text-xs font-bold uppercase tracking-wider">-{negPercent.toFixed(0)}%</span>
          </div>
          <div className="flex items-baseline gap-2 ml-auto">
            <span className="text-xs uppercase tracking-wider opacity-60">TOTAL</span>
            <span className="text-sm font-bold tabular-nums">{(stats.totalPosts || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b-2 border-foreground px-4 py-3 sm:px-6 md:px-8 shrink-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Input
            placeholder="KEYWORD FILTERS (COMMA SEPARATED)"
            value={filters}
            onChange={(e) => setFilters(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyFilters(); } }}
            className="flex-1 uppercase text-xs border-2 min-h-[44px]"
            style={{ borderRadius: 0 }}
          />
          <Button onClick={handleApplyFilters} variant="outline" className="px-4 py-3 sm:px-6 font-bold uppercase text-xs tracking-wider min-h-[44px]" style={{ borderRadius: 0, borderWidth: '2px' }}>
            SEARCH
          </Button>
          <Button onClick={handleResetFilters} variant="outline" disabled={!canResetFilters} className="px-4 py-3 sm:px-6 text-xs font-bold uppercase tracking-widest min-h-[44px]" style={{ borderRadius: 0, borderWidth: '2px' }}>
            RESET
          </Button>
        </div>
        {hasActiveFilters && (
          <div className="text-xs uppercase tracking-wider opacity-70 mt-2">
            ACTIVE FILTERS: {appliedFilters.join(', ')}
          </div>
        )}
      </div>

      {/* Live Feed — fills remaining viewport */}
      <div className="flex-1 min-h-0 overflow-y-auto border-b-2 border-foreground">
        <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 space-y-3 sm:space-y-4">
          {posts.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-xs uppercase tracking-wider opacity-40">
              NO POSTS YET. DATA WILL APPEAR AUTOMATICALLY.
            </div>
          ) : (
            posts.filter(postMatchesFilters).slice(0, 20).map((post, idx) => (
              <PostCard key={post.uri || `post-${idx}-${post.createdAt}`} post={post} />
            ))
          )}
        </div>
      </div>

      {/* Sentiment Timeline — collapsible */}
      <div className="border-b-2 border-foreground shrink-0">
        <button
          onClick={() => setChartCollapsed(prev => !prev)}
          className="w-full px-4 py-3 sm:px-6 md:px-8 flex items-center justify-between hover:bg-foreground/5 transition-colors"
        >
          <div className="text-xs font-bold uppercase tracking-widest">
            SENTIMENT TIMELINE (LAST 60 MIN)
            <span className="ml-2 sm:ml-4 text-xs font-normal opacity-60">● LIVE</span>
          </div>
          <span className="text-xs opacity-60">{chartCollapsed ? '▼ SHOW' : '▲ HIDE'}</span>
        </button>
        {!chartCollapsed && (
          <div className="px-4 pb-4 sm:px-6 md:px-8 sm:pb-6">
            {sentimentTimeline.length === 0 ? (
              <div className="py-8 text-center text-xs uppercase tracking-wider opacity-40">
                WAITING FOR DATA
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sentimentTimelineData}>
                  <defs>
                    <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.7 0.2 145)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="oklch(0.7 0.2 145)" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.6 0.05 90)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="oklch(0.6 0.05 90)" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.55 0.22 25)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="oklch(0.55 0.22 25)" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="time" tick={{ fontSize: 8 }} stroke="currentColor" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8 }} stroke="currentColor" />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke="oklch(0.7 0.2 145)" strokeWidth={2} fill="url(#colorPositive)" animationDuration={800} />
                  <Area type="monotone" dataKey="neutral" stackId="1" stroke="oklch(0.6 0.05 90)" strokeWidth={2} fill="url(#colorNeutral)" animationDuration={800} />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke="oklch(0.55 0.22 25)" strokeWidth={2} fill="url(#colorNegative)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t-2 border-foreground px-4 py-3 sm:px-6 md:px-8 flex items-center justify-between shrink-0">
        <Button onClick={handleExportCSV} variant="outline" className="px-6 py-3 text-xs font-bold uppercase tracking-widest min-h-[44px]" style={{ borderRadius: 0, borderWidth: '2px' }}>
          EXPORT CSV
        </Button>
        <span className="text-xs uppercase tracking-wider opacity-40">dr.eamer.dev</span>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <div
      className="border border-border rounded-xl p-3 sm:p-4 md:p-5 hover:shadow-lg transition-all duration-200"
      style={{
        backgroundColor: post.sentiment === 'positive'
          ? 'oklch(0.7 0.2 145 / 0.12)'
          : post.sentiment === 'negative'
          ? 'oklch(0.55 0.22 25 / 0.12)'
          : 'oklch(0.6 0.05 90 / 0.08)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
    >
      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {post.author?.handle ? (
              <>
                <span className="font-semibold text-xs sm:text-sm">@{post.author.handle}</span>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{
                  backgroundColor: post.sentiment === 'positive'
                    ? 'oklch(0.7 0.2 145 / 0.3)'
                    : post.sentiment === 'negative'
                    ? 'oklch(0.55 0.22 25 / 0.3)'
                    : 'oklch(0.6 0.05 90 / 0.2)',
                }}>
                  {post.sentiment}
                </span>
              </>
            ) : (
              <span className="font-semibold text-sm">
                {post.sentiment === 'positive' ? 'Positive' : post.sentiment === 'negative' ? 'Negative' : 'Neutral'}
              </span>
            )}
            {post.language && <span className="text-xs text-muted-foreground">{post.language}</span>}
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm sm:text-base leading-relaxed mb-2 sm:mb-3">{post.text}</div>

      <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
        {post.isReply && <span className="flex items-center gap-1"><ReplyIcon /> Reply</span>}
        {post.isQuote && <span className="flex items-center gap-1"><QuoteIcon /> Quote</span>}
        {post.hasImages && <span className="flex items-center gap-1"><ImageIcon /> Image</span>}
        {post.hasVideo && <span className="flex items-center gap-1"><VideoIcon /> Video</span>}
        {post.hasLink && <span className="flex items-center gap-1"><LinkIcon /> Link</span>}
        {post.uri && (
          <a
            href={`https://bsky.app/profile/${post.uri.split('/')[2]}/post/${post.uri.split('/')[4]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs hover:text-primary transition-colors flex items-center gap-1"
          >
            <ExternalLinkIcon /> View on Bluesky
          </a>
        )}
      </div>
    </div>
  );
}

// Inline SVG icons (small, no external deps)
const ReplyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);
const QuoteIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const ImageIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const VideoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
const LinkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);
