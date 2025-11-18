import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { APP_TITLE } from "@/const";
import { useSocket } from "@/hooks/useSocket";
import { getLanguageName } from "@shared/languages";
import { TopicSentiment } from "@/components/TopicSentiment";

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

export default function Dashboard() {
  const [filters, setFilters] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const [samplingRate, setSamplingRate] = useState(1);
  const [posts, setPosts] = useState<Post[]>([]);
  
  // Live feed filters
  const [feedLanguageFilter, setFeedLanguageFilter] = useState("all");
  const [feedFullScreen, setFeedFullScreen] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);

  // Use Socket.IO for real-time updates
  const { connected: socketConnected, stats: socketStats, latestPost } = useSocket();

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreenMode(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle full screen mode
  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFeedFullScreen(true);
      } else {
        await document.exitFullscreen();
        setFeedFullScreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      // Fallback to CSS-only full screen if Fullscreen API fails
      setFeedFullScreen(!feedFullScreen);
    }
  };

  // Track post timestamps for rate calculation (rolling window)
  useEffect(() => {
    if (!latestPost) return;

    const now = Date.now();

    // Add timestamp to rolling window, remove old entries
    setPostTimestamps(prev => {
      const twoMinutesAgo = now - 2 * 60 * 1000; // Keep 2 minutes for smooth calculation
      const filtered = prev.filter(d => d.timestamp >= twoMinutesAgo);
      return [...filtered, {
        timestamp: now,
        sentiment: latestPost.sentiment
      }];
    });

    // Track language
    if (latestPost.language) {
      setLanguageCounts(prev => ({
        ...prev,
        [latestPost.language!]: (prev[latestPost.language!] || 0) + 1
      }));
    }
    
    // Extract and track hashtags
    const hashtagMatches = latestPost.text.match(/#[\w\u0080-\uFFFF]+/g);
    if (hashtagMatches) {
      setHashtagCounts(prev => {
        const updated = { ...prev };
        hashtagMatches.forEach(tag => {
          const normalized = tag.toLowerCase();
          updated[normalized] = (updated[normalized] || 0) + 1;
        });
        return updated;
      });
    }
    
    // Track content types from post metadata
    const hasImages = latestPost.hasImages || false;
    const hasVideo = latestPost.hasVideo || false;
    const hasLinks = latestPost.hasLink || false;
    const isTextOnly = !hasImages && !hasVideo && !hasLinks;
    
    setContentTypeCounts(prev => ({
      textOnly: isTextOnly ? prev.textOnly + 1 : prev.textOnly,
      withImages: hasImages ? prev.withImages + 1 : prev.withImages,
      withVideo: hasVideo ? prev.withVideo + 1 : prev.withVideo,
      withLinks: hasLinks ? prev.withLinks + 1 : prev.withLinks,
    }));
  }, [latestPost]);

  // Load historical timeline data on mount
  // TEMPORARILY DISABLED - debugging circular dependency issue
  // useEffect(() => {
  //   if (timelineDataQuery.isSuccess && timelineDataQuery.data) {
  //     try {
  //       const historicalData = Array.isArray(timelineDataQuery.data) ? timelineDataQuery.data : [];
  //       if (historicalData.length > 0) {
  //         console.log(`[Timeline] Loading ${historicalData.length} historical posts`);
  //         setPostTimestamps(historicalData.map(p => ({
  //           timestamp: p.timestamp || Date.now(),
  //           sentiment: p.sentiment || 'neutral'
  //         })));
  //       }
  //     } catch (error) {
  //       console.error('[Timeline] Error loading historical data:', error);
  //     }
  //   }
  // }, [timelineDataQuery.isSuccess, timelineDataQuery.data]);

  // Sample rate every 1 second for timeline charts
  useEffect(() => {
    const calculateRates = () => {
      setPostTimestamps(currentTimestamps => {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;

        // Filter posts from last 60 seconds
        const recentPosts = currentTimestamps.filter(p => p.timestamp >= oneMinuteAgo);

        if (recentPosts.length > 0) {
          // Calculate time window
          const oldestTimestamp = Math.min(...recentPosts.map(p => p.timestamp));
          const timeWindowSeconds = (now - oldestTimestamp) / 1000;

          if (timeWindowSeconds > 0) {
            // Calculate posts per minute rate
            const rate = Math.round((recentPosts.length / timeWindowSeconds) * 60);

            // Calculate sentiment percentages
            const positive = recentPosts.filter(p => p.sentiment === 'positive').length;
            const neutral = recentPosts.filter(p => p.sentiment === 'neutral').length;
            const negative = recentPosts.filter(p => p.sentiment === 'negative').length;
            const total = recentPosts.length;

            const positivePercent = total > 0 ? (positive / total) * 100 : 0;
            const neutralPercent = total > 0 ? (neutral / total) * 100 : 0;
            const negativePercent = total > 0 ? (negative / total) * 100 : 0;

            // Update posts per minute timeline
            setPostsPerMinuteTimeline(prev => {
              const oneHourAgo = now - 60 * 60 * 1000;
              const filtered = prev.filter(d => d.timestamp >= oneHourAgo);
              return [...filtered, { timestamp: now, rate }];
            });

            // Update sentiment timeline
            setSentimentTimeline(prev => {
              const oneHourAgo = now - 60 * 60 * 1000;
              const filtered = prev.filter(d => d.timestamp >= oneHourAgo);
              return [...filtered, {
                timestamp: now,
                positivePercent,
                neutralPercent,
                negativePercent
              }];
            });
          }
        }

        return currentTimestamps; // Return unchanged
      });
    };

    const interval = setInterval(calculateRates, 1000); // Sample every 1 second for smooth updates
    return () => clearInterval(interval);
  }, []);

  const statsQuery = trpc.firehose.stats.useQuery(undefined, {
    refetchInterval: false,
    enabled: !socketConnected,
  });

  const languagesQuery = trpc.stats.languages.useQuery({ limit: 10 }, {
    refetchInterval: 10000,
  });

  const hashtagsQuery = trpc.stats.hashtags.useQuery({ limit: 20 }, {
    refetchInterval: 10000,
  });

  const contentTypesQuery = trpc.stats.contentTypes.useQuery(undefined, {
    refetchInterval: 10000,
  });
  
  // Track individual post timestamps for rate calculation (rolling window)
  const [postTimestamps, setPostTimestamps] = useState<Array<{
    timestamp: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>>([]);

  // Sampled timeline data (updates every 5 seconds with current rate)
  const [sentimentTimeline, setSentimentTimeline] = useState<Array<{
    timestamp: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  }>>([]);

  // Track total posts in timeline for stability check
  const totalTimelinePosts = postTimestamps.length;

  // Timeline shows immediately (no delay)
  const MIN_POSTS_FOR_STABILITY = 0;
  const MIN_MINUTES_FOR_STABILITY = 0;
  const timelineIsStable = true; // Always show timeline

  // Posts per minute rate timeline (sampled every 5 seconds)
  const [postsPerMinuteTimeline, setPostsPerMinuteTimeline] = useState<Array<{
    timestamp: number;
    rate: number;
  }>>([]);

  // Real-time language tracking
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  
  // Real-time hashtag tracking
  const [hashtagCounts, setHashtagCounts] = useState<Record<string, number>>({});
  
  // Real-time content type tracking
  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });
  
  const hourlyStatsQuery = trpc.stats.hourly.useQuery({ hours: 24 }, {
    refetchInterval: 30000,
  });

  const recentPostsQuery = trpc.firehose.recentPosts.useQuery({ limit: 50 }, {
    refetchInterval: 2000,
  });

  // Fetch historical timeline data on mount (last 60 minutes)
  // TEMPORARILY DISABLED - debugging circular dependency issue
  const timelineDataQuery = trpc.firehose.timelineData.useQuery(undefined, {
    refetchInterval: false,
    enabled: false, // DISABLED
    retry: false,
  });

  useEffect(() => {
    if (recentPostsQuery.data) {
      setPosts(recentPostsQuery.data as Post[]);
    }
  }, [recentPostsQuery.data]);

  // Handle incoming posts from Socket.IO with sampling
  useEffect(() => {
    if (latestPost) {
      if (Math.random() < (1 / samplingRate)) {
        setPosts(prev => [latestPost, ...prev].slice(0, 50));
      }
    }
  }, [latestPost, samplingRate]);

  const utils = trpc.useUtils();
  
  const handleExportCSV = async () => {
    try {
      const result = await utils.firehose.exportCSV.fetch();
      if (result && result.csv) {
        // Create blob and download
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
    const filterArray = filters
      .split(',')
      .map(f => f.toLowerCase().trim())
      .filter(f => f.length > 0);

    setAppliedFilters(filterArray);
  };

  const handleResetFilters = () => {
    setFilters('');
    setAppliedFilters([]);
  };

  // Use socket stats if available, otherwise use query data
  const stats = socketConnected && socketStats ? socketStats : (statsQuery.data || {
    totalPosts: 0,
    inDatabase: 0,
    postsPerMinute: 0,
    sentimentCounts: { positive: 0, negative: 0, neutral: 0 },
    duration: 0,
    running: false,
  });

  // Calculate sentiment percentages for gradient bars
  const total = (stats.sentimentCounts?.positive || 0) + (stats.sentimentCounts?.neutral || 0) + (stats.sentimentCounts?.negative || 0);
  const posPercent = total > 0 ? ((stats.sentimentCounts?.positive || 0) / total) * 100 : 0;
  const neuPercent = total > 0 ? ((stats.sentimentCounts?.neutral || 0) / total) * 100 : 0;
  const negPercent = total > 0 ? ((stats.sentimentCounts?.negative || 0) / total) * 100 : 0;
  
  // Prepare hourly chart data for isometric visualization
  const hourlyChartData = hourlyStatsQuery.data?.map((h: any) => {
    const timestamp = h.hourTimestamp ? new Date(h.hourTimestamp) : new Date();
    return {
      hour: timestamp.getHours() + ":00",
      positive: h.positiveCount || 0,
      neutral: h.neutralCount || 0,
      negative: h.negativeCount || 0,
    };
  }) || [];
  
  // Prepare real-time sentiment timeline data (last 60 minutes)
  const sentimentTimelineData = sentimentTimeline.map(d => {
    const date = new Date(d.timestamp);
    return {
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      positive: d.positivePercent,
      neutral: d.neutralPercent,
      negative: d.negativePercent,
    };
  });

  // Prepare posts per minute timeline data
  const postsPerMinuteData = postsPerMinuteTimeline.map(d => {
    const date = new Date(d.timestamp);
    return {
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      rate: d.rate,
    };
  });

  // Prepare language data from real-time counts
  const languageData = Object.entries(languageCounts)
    .map(([language, count]) => ({ language, postsCount: count }))
    .sort((a, b) => b.postsCount - a.postsCount)
    .slice(0, 10)
    .map((lang, idx) => {
    const maxCount = Object.values(languageCounts).sort((a, b) => b - a)[0] || 1;
    const intensity = (lang.postsCount || 0) / maxCount;
    return {
      ...lang,
      color: `oklch(${0.65 - intensity * 0.2} ${0.15 + intensity * 0.15} ${200 - idx * 20})`,
    };
  }) || [];

  const hasActiveFilters = appliedFilters.length > 0;
  const canResetFilters = filters.trim().length > 0 || hasActiveFilters;
  const postMatchesLocalFilters = (post: Post) => {
    if (!hasActiveFilters) {
      return true;
    }

    const haystack = `${post.text || ''} ${post.author?.handle || ''}`.toLowerCase();
    return appliedFilters.some(filter => haystack.includes(filter));
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <header className="border-b-2 border-foreground px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight uppercase">BLUESKY FIREHOSE</h1>
            <p className="text-xs sm:text-sm uppercase tracking-widest mt-1" style={{ color: '#01AAFF' }}>
              REAL-TIME SENTIMENT ANALYSIS · AT PROTOCOL NETWORK
            </p>
          </div>
          <div className={`px-4 py-2 border-2 self-start sm:self-auto ${stats.running ? 'bg-[#01AAFF]/10' : ''}`} style={{ borderColor: stats.running ? '#01AAFF' : 'currentColor' }}>
            <span className="text-xs font-bold uppercase tracking-widest">
              {stats.running ? '● RUNNING' : '○ STOPPED'}
            </span>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="border-b-2 border-foreground px-4 py-4 sm:px-6 md:px-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest font-bold">
            FIREHOSE STREAM IS ALWAYS LIVE · SEARCH FILTERS ONLY IMPACT YOUR VIEW
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Input
              placeholder="KEYWORD FILTERS (COMMA SEPARATED)"
              value={filters}
              onChange={(e) => setFilters(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyFilters();
                }
              }}
              className="flex-1 uppercase text-xs border-2 min-h-[44px]"
              style={{ borderRadius: 0 }}
            />
            <Button
              onClick={handleApplyFilters}
              variant="outline"
              className="px-4 py-3 sm:px-6 font-bold uppercase text-xs tracking-wider min-h-[44px]"
              style={{ borderRadius: 0, borderWidth: '2px' }}
            >
              SEARCH
            </Button>
            <Button
              onClick={handleResetFilters}
              variant="outline"
              disabled={!canResetFilters}
              className="px-4 py-3 sm:px-6 text-xs font-bold uppercase tracking-widest min-h-[44px]"
              style={{ borderRadius: 0, borderWidth: '2px' }}
            >
              RESET
            </Button>
          </div>

          {hasActiveFilters && (
            <div className="text-xs uppercase tracking-wider opacity-70">
              ACTIVE FILTERS: {appliedFilters.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout: 1/4 left sidebar + 3/4 right content */}
      <div className="flex flex-col lg:flex-row">
        {/* Left Sidebar - Hidden in full screen mode, full width on mobile (order-2), 1/4 on desktop */}
        {!feedFullScreen && (
        <div className="w-full lg:w-1/4 border-b-2 lg:border-b-0 lg:border-r-2 border-foreground order-2 lg:order-1">
          {/* Posts/Minute */}
          <div className="border-b-2 border-foreground p-4 sm:p-6">
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">
                POSTS/MINUTE
              </div>
              <div className="text-2xl sm:text-3xl font-bold tabular-nums">
                {(stats.postsPerMinute || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Single Stacked Vertical Bar - Swiss Style */}
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6">SENTIMENT</div>

            <div className="flex flex-col items-center gap-4 sm:gap-6">
              {/* Single Stacked Bar - Always vertical */}
              <div className="w-24 h-64 sm:h-96 border-2 border-foreground relative flex flex-col">
                {/* Positive (top) */}
                <div
                  className="w-full transition-all duration-500 border-b border-foreground"
                  style={{
                    height: `${posPercent}%`,
                    background: 'linear-gradient(180deg, oklch(0.8 0.25 145) 0%, oklch(0.7 0.2 145) 100%)'
                  }}
                />
                {/* Neutral (middle) */}
                <div
                  className="w-full transition-all duration-500 border-b border-foreground"
                  style={{
                    height: `${neuPercent}%`,
                    background: 'linear-gradient(180deg, oklch(0.7 0.08 90) 0%, oklch(0.6 0.05 90) 100%)'
                  }}
                />
                {/* Negative (bottom) */}
                <div
                  className="w-full transition-all duration-500"
                  style={{
                    height: `${negPercent}%`,
                    background: 'linear-gradient(180deg, oklch(0.65 0.25 25) 0%, oklch(0.55 0.22 25) 100%)'
                  }}
                />
              </div>
              
              {/* Legend */}
              <div className="space-y-2 sm:space-y-3 w-full">
                <div className="flex justify-between items-baseline">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4" style={{ background: 'oklch(0.75 0.22 145)' }} />
                    <span className="text-xs font-bold uppercase tracking-wider">POSITIVE</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base sm:text-lg font-bold tabular-nums">{(stats.sentimentCounts?.positive || 0).toLocaleString()}</div>
                    <div className="text-xs opacity-60">{posPercent.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4" style={{ background: 'oklch(0.65 0.06 90)' }} />
                    <span className="text-xs font-bold uppercase tracking-wider">NEUTRAL</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base sm:text-lg font-bold tabular-nums">{(stats.sentimentCounts?.neutral || 0).toLocaleString()}</div>
                    <div className="text-xs opacity-60">{neuPercent.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="flex justify-between items-baseline">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4" style={{ background: 'oklch(0.6 0.23 25)' }} />
                    <span className="text-xs font-bold uppercase tracking-wider">NEGATIVE</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base sm:text-lg font-bold tabular-nums">{(stats.sentimentCounts?.negative || 0).toLocaleString()}</div>
                    <div className="text-xs opacity-60">{negPercent.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Languages - English + Non-English Pie Chart */}
          <div className="border-t-2 border-foreground p-4 sm:p-6 lg:p-8">
            <div className="text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6">TOP LANGUAGES</div>
            {(languageData.length === 0) ? (
              <div className="py-8 text-center text-xs uppercase tracking-wider opacity-40">
                WAITING FOR DATA
              </div>
            ) : (
              <div className="space-y-6">
                {/* English Count */}
                {(() => {
                  const englishData = languageData.find((l: any) => l.language === 'en' || l.language === 'en-US');
                  const englishCount = englishData?.postsCount || 0;
                  const totalCount = languageData.reduce((sum: number, l: any) => sum + (l.postsCount || 0), 0);
                  const englishPercent = totalCount > 0 ? (englishCount / totalCount) * 100 : 0;

                  return (
                    <div className="border-2 border-foreground p-4">
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider">ENGLISH</span>
                        <span className="text-xs opacity-60">{englishPercent.toFixed(1)}%</span>
                      </div>
                      <div className="text-3xl font-bold tabular-nums">
                        {englishCount.toLocaleString()}
                      </div>
                    </div>
                  );
                })()}

                {/* Non-English Languages - Simple Pie Visualization */}
                {(() => {
                  const nonEnglish = languageData.filter((l: any) => l.language !== 'en' && l.language !== 'en-US').slice(0, 4);
                  if (nonEnglish.length === 0) return null;

                  const total = nonEnglish.reduce((sum: number, l: any) => sum + (l.postsCount || 0), 0);

                  return (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-4 opacity-60">NON-ENGLISH</div>
                      <div className="space-y-3">
                        {nonEnglish.map((lang: any) => {
                          const percent = total > 0 ? (lang.postsCount / total) * 100 : 0;
                          return (
                            <div key={lang.language} className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 flex-shrink-0"
                                style={{ backgroundColor: lang.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-xs uppercase tracking-wider">
                                    {getLanguageName(lang.language)}
                                  </span>
                                  <span className="text-sm font-bold tabular-nums">
                                    {lang.postsCount.toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-xs opacity-60">{percent.toFixed(1)}%</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Content Types */}
          <div className="border-t-2 border-foreground p-4 sm:p-6 lg:p-8">
            <div className="text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6">CONTENT TYPES</div>
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider">TEXT ONLY</span>
                <span className="text-2xl font-bold tabular-nums">{contentTypeCounts.textOnly.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider">WITH IMAGES</span>
                <span className="text-2xl font-bold tabular-nums">{contentTypeCounts.withImages.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider">WITH VIDEO</span>
                <span className="text-2xl font-bold tabular-nums">{contentTypeCounts.withVideo.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider">WITH LINKS</span>
                <span className="text-2xl font-bold tabular-nums">{contentTypeCounts.withLinks.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        )}

        {/* Right Content - 3/4 width (full width in full screen mode), order-1 on mobile to appear first */}
        <div className={feedFullScreen ? "w-full" : "w-full lg:w-3/4 order-1 lg:order-2"}>
          {/* Live Feed - Full Height */}
          <div className="border-b-2 border-foreground">
            <div className="px-4 py-3 sm:px-6 sm:py-4 md:px-8 border-b-2 border-foreground flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs font-bold uppercase tracking-widest">LIVE FEED</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <select
                  value={feedLanguageFilter}
                  onChange={(e) => setFeedLanguageFilter(e.target.value)}
                  className="px-3 py-2 font-bold uppercase text-xs tracking-wider border-2 border-foreground bg-background text-foreground min-h-[44px]"
                  style={{ borderRadius: 0 }}
                >
                  <option value="all">ALL LANGUAGES</option>
                  <option value="en">ENGLISH</option>
                  <option value="ja">JAPANESE</option>
                  <option value="es">SPANISH</option>
                  <option value="fr">FRENCH</option>
                  <option value="de">GERMAN</option>
                  <option value="it">ITALIAN</option>
                  <option value="pt">PORTUGUESE</option>
                  <option value="ko">KOREAN</option>
                  <option value="zh">CHINESE</option>
                </select>
                <select
                  value={samplingRate}
                  onChange={(e) => setSamplingRate(Number(e.target.value))}
                  className="px-3 py-2 font-bold uppercase text-xs tracking-wider border-2 border-foreground bg-background text-foreground min-h-[44px]"
                  style={{ borderRadius: 0 }}
                >
                  <option value={1}>SHOW ALL</option>
                  <option value={10}>1/10</option>
                  <option value={100}>1/100</option>
                  <option value={1000}>1/1000</option>
                  <option value={10000}>1/10000</option>
                  <option value={50000}>1/50000</option>
                </select>
                <button
                  onClick={toggleFullScreen}
                  className="px-3 py-2 font-bold uppercase text-xs tracking-wider border-2 border-foreground bg-background text-foreground hover:bg-foreground hover:text-background transition-colors min-h-[44px]"
                  style={{ borderRadius: 0 }}
                >
                  {isFullScreenMode || feedFullScreen ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}
                </button>
              </div>
            </div>
            
            <div className={`px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6 space-y-3 sm:space-y-4 overflow-y-auto ${feedFullScreen ? 'max-h-[calc(100vh-150px)]' : 'max-h-[800px] sm:max-h-[1000px] md:max-h-[1200px]'}`}>
              {posts.length === 0 ? (
                <div className="py-12 sm:py-16 text-center text-xs uppercase tracking-wider opacity-40">
                  NO POSTS YET. DATA WILL APPEAR AUTOMATICALLY.
                </div>
              ) : (
                posts
                  .filter((post) => {
                    if (feedLanguageFilter !== 'all' && post.language && !post.language.startsWith(feedLanguageFilter)) {
                      return false;
                    }
                    return postMatchesLocalFilters(post);
                  })
                  .slice(0, 20)
                  .map((post, idx) => (
                    <div
                      key={post.uri || `post-${idx}-${post.createdAt}`}
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
                      {/* Post Header - Bluesky Style */}
                      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">

                        {/* Name and Handle */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            {post.author?.handle ? (
                              <>
                                <span className="font-semibold text-xs sm:text-sm">
                                  @{post.author.handle}
                                </span>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: post.sentiment === 'positive' 
                                      ? 'oklch(0.7 0.2 145 / 0.3)' 
                                      : post.sentiment === 'negative' 
                                      ? 'oklch(0.55 0.22 25 / 0.3)' 
                                      : 'oklch(0.6 0.05 90 / 0.2)',
                                  }}
                                >
                                  {post.sentiment}
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold text-sm">
                                {post.sentiment === 'positive' ? 'Positive' : post.sentiment === 'negative' ? 'Negative' : 'Neutral'}
                              </span>
                            )}
                            {post.language && (
                              <span className="text-xs text-muted-foreground">
                                {post.language}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.createdAt).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Post Text */}
                      <div className="text-sm sm:text-base leading-relaxed mb-2 sm:mb-3">
                        {post.text}
                      </div>

                      {/* Engagement & Media Indicators */}
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 text-xs text-muted-foreground flex-wrap">
                        {post.isReply && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Reply
                          </span>
                        )}
                        {post.isQuote && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Quote
                          </span>
                        )}
                        {post.hasImages && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Image
                          </span>
                        )}
                        {post.hasVideo && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Video
                          </span>
                        )}
                        {post.hasLink && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Link
                          </span>
                        )}
                      </div>
                      
                      {/* Post Actions - Bluesky Style */}
                      {post.uri && (
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <a 
                            href={`https://bsky.app/profile/${post.uri.split('/')[2]}/post/${post.uri.split('/')[4]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View on Bluesky
                          </a>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Real-Time Sentiment Timeline (1 Hour) */}
          <div className="border-b-2 border-foreground p-4 sm:p-6 md:p-8">
            <div className="text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6">
              SENTIMENT TIMELINE (LAST 60 MIN)
              <span className="ml-2 sm:ml-4 text-xs font-normal opacity-60">● LIVE</span>
            </div>
            {sentimentTimeline.length === 0 ? (
              <div className="py-12 sm:py-16 text-center text-xs uppercase tracking-wider opacity-40">
                WAITING FOR DATA
              </div>
            ) : !timelineIsStable ? (
              <div className="py-12 sm:py-16">
                <div className="text-center mb-8">
                  <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#01AAFF' }}>
                    ● COLLECTING DATA FOR STABILITY
                  </div>
                  <div className="text-sm uppercase tracking-wider opacity-60 mb-6">
                    ACCUMULATING SENTIMENT SAMPLES
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="max-w-md mx-auto space-y-4">
                  {/* Posts Progress */}
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">POSTS ANALYZED</span>
                      <span className="text-xs tabular-nums">{totalTimelinePosts} / {MIN_POSTS_FOR_STABILITY}</span>
                    </div>
                    <div className="h-2 border-2 border-foreground relative overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min((totalTimelinePosts / MIN_POSTS_FOR_STABILITY) * 100, 100)}%`,
                          background: 'linear-gradient(90deg, oklch(0.7 0.2 145) 0%, oklch(0.6 0.25 200) 100%)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Time Progress */}
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider">TIME ELAPSED</span>
                      <span className="text-xs tabular-nums">{sentimentTimeline.length} / {MIN_MINUTES_FOR_STABILITY} MIN</span>
                    </div>
                    <div className="h-2 border-2 border-foreground relative overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min((sentimentTimeline.length / MIN_MINUTES_FOR_STABILITY) * 100, 100)}%`,
                          background: 'linear-gradient(90deg, oklch(0.7 0.2 145) 0%, oklch(0.6 0.25 200) 100%)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Preview mini chart with current data */}
                <div className="mt-6 sm:mt-8 opacity-40">
                  <div className="text-xs text-center mb-2 uppercase tracking-wider">PREVIEW (UNSTABLE)</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={sentimentTimelineData}>
                      <defs>
                        <linearGradient id="colorPositivePreview" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.7 0.2 145)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.7 0.2 145)" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorNeutralPreview" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.6 0.05 90)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.6 0.05 90)" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorNegativePreview" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.55 0.22 25)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.55 0.22 25)" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="0" stroke="currentColor" strokeOpacity={0.05} />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 8 }}
                        stroke="currentColor"
                        strokeOpacity={0.3}
                      />
                      <YAxis
                        tick={{ fontSize: 8 }}
                        stroke="currentColor"
                        strokeOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="positive"
                        stackId="1"
                        stroke="oklch(0.7 0.2 145)"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        fill="url(#colorPositivePreview)"
                      />
                      <Area
                        type="monotone"
                        dataKey="neutral"
                        stackId="1"
                        stroke="oklch(0.6 0.05 90)"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        fill="url(#colorNeutralPreview)"
                      />
                      <Area
                        type="monotone"
                        dataKey="negative"
                        stackId="1"
                        stroke="oklch(0.55 0.22 25)"
                        strokeWidth={1}
                        strokeOpacity={0.5}
                        fill="url(#colorNegativePreview)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200} className="sm:h-[250px] md:h-[300px]">
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
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 8 }}
                    stroke="currentColor"
                    interval="preserveStartEnd"
                    className="text-xs sm:text-sm"
                  />
                  <YAxis
                    tick={{ fontSize: 8 }}
                    stroke="currentColor"
                    className="text-xs sm:text-sm"
                  />
                  <Area
                    type="monotone"
                    dataKey="positive"
                    stackId="1"
                    stroke="oklch(0.7 0.2 145)"
                    strokeWidth={2}
                    fill="url(#colorPositive)"
                    animationDuration={800}
                  />
                  <Area
                    type="monotone"
                    dataKey="neutral"
                    stackId="1"
                    stroke="oklch(0.6 0.05 90)"
                    strokeWidth={2}
                    fill="url(#colorNeutral)"
                    animationDuration={800}
                  />
                  <Area
                    type="monotone"
                    dataKey="negative"
                    stackId="1"
                    stroke="oklch(0.55 0.22 25)"
                    strokeWidth={2}
                    fill="url(#colorNegative)"
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Posts Per Minute Timeline */}
          <div className="border-b-2 border-foreground p-4 sm:p-6 md:p-8">
            <div className="text-xs font-bold uppercase tracking-widest mb-6">POSTS PER MINUTE</div>
            {postsPerMinuteData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                WAITING FOR DATA
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200} className="sm:h-[250px] md:h-[300px]">
                <LineChart data={postsPerMinuteData}>
                  <defs>
                    <linearGradient id="colorPostsPerMinute" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#01AAFF" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#01AAFF" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 8 }}
                    stroke="currentColor"
                    interval="preserveStartEnd"
                    className="text-xs sm:text-sm"
                  />
                  <YAxis
                    tick={{ fontSize: 8 }}
                    stroke="currentColor"
                    className="text-xs sm:text-sm"
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#01AAFF"
                    strokeWidth={3}
                    dot={false}
                    fill="url(#colorPostsPerMinute)"
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>



        </div>
      </div>
      {/* Footer */}
      <div className="border-t-2 border-foreground p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <Button
          onClick={handleExportCSV}
          variant="outline"
          className="px-6 py-3 sm:px-8 sm:py-4 text-xs font-bold uppercase tracking-widest min-h-[44px]"
          style={{ borderRadius: 0, borderWidth: '2px' }}
        >
          EXPORT CSV
        </Button>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
          <a
            href="https://dr.eamer.dev/bluesky"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 sm:px-8 sm:py-4 border-2 border-foreground text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors text-center min-h-[44px] flex items-center justify-center"
            style={{ borderRadius: 0 }}
          >
            OTHER TOOLS
          </a>
          <a
            href="https://dr.eamer.dev/luke"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 sm:px-8 sm:py-4 border-2 border-foreground text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors text-center min-h-[44px] flex items-center justify-center"
            style={{ borderRadius: 0 }}
          >
            ME
          </a>
        </div>
      </div>
    </div>
  );
}
