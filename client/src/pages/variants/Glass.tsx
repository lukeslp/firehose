/**
 * Glass.tsx - Modern Glassmorphism Variant
 *
 * Aesthetic: Clean, contemporary glassmorphism
 * Theme: Frosted glass cards, backdrop blur, subtle shadows
 * Typography: SF Pro / System UI
 * Layout: Familiar, comfortable modern design
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';
import { CardWall } from '@/components/CardWall';
import {
  SentimentDistributionCard,
  SentimentTimelineCard,
  PostsPerMinuteCard,
  LanguagesCard,
  ContentTypesCard,
} from '@/components/cards';

export default function Glass({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 20;

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Data tracking state (following Dashboard.tsx pattern)
  const [postTimestamps, setPostTimestamps] = useState<
    Array<{
      timestamp: number;
      sentiment: 'positive' | 'negative' | 'neutral';
    }>
  >([]);
  const [sentimentTimeline, setSentimentTimeline] = useState<
    Array<{
      timestamp: number;
      positivePercent: number;
      neutralPercent: number;
      negativePercent: number;
    }>
  >([]);
  const [postsPerMinuteTimeline, setPostsPerMinuteTimeline] = useState<
    Array<{
      timestamp: number;
      rate: number;
    }>
  >([]);
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });

  // Track incoming posts (following Dashboard.tsx lines 80-128)
  useEffect(() => {
    if (!latestPost) return;

    const now = Date.now();

    // Add timestamp to rolling window
    setPostTimestamps((prev) => {
      const twoMinutesAgo = now - 2 * 60 * 1000;
      const filtered = prev.filter((d) => d.timestamp >= twoMinutesAgo);
      return [
        ...filtered,
        {
          timestamp: now,
          sentiment: latestPost.sentiment,
        },
      ];
    });

    // Track language
    if (latestPost.language) {
      setLanguageCounts((prev) => ({
        ...prev,
        [latestPost.language!]: (prev[latestPost.language!] || 0) + 1,
      }));
    }

    // Track content types
    const hasImages = latestPost.hasImages || false;
    const hasVideo = latestPost.hasVideo || false;
    const hasLinks = latestPost.hasLink || false;
    const isTextOnly = !hasImages && !hasVideo && !hasLinks;

    setContentTypeCounts((prev) => ({
      textOnly: isTextOnly ? prev.textOnly + 1 : prev.textOnly,
      withImages: hasImages ? prev.withImages + 1 : prev.withImages,
      withVideo: hasVideo ? prev.withVideo + 1 : prev.withVideo,
      withLinks: hasLinks ? prev.withLinks + 1 : prev.withLinks,
    }));
  }, [latestPost]);

  // Sample rate every 1 second for timeline charts (following Dashboard.tsx lines 149-205)
  useEffect(() => {
    const calculateRates = () => {
      setPostTimestamps((currentTimestamps) => {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;

        const recentPosts = currentTimestamps.filter(
          (p) => p.timestamp >= oneMinuteAgo
        );

        if (recentPosts.length > 0) {
          const oldestTimestamp = Math.min(
            ...recentPosts.map((p) => p.timestamp)
          );
          const timeWindowSeconds = (now - oldestTimestamp) / 1000;

          if (timeWindowSeconds > 0) {
            const rate = Math.round(
              (recentPosts.length / timeWindowSeconds) * 60
            );

            const positive = recentPosts.filter(
              (p) => p.sentiment === 'positive'
            ).length;
            const neutral = recentPosts.filter(
              (p) => p.sentiment === 'neutral'
            ).length;
            const negative = recentPosts.filter(
              (p) => p.sentiment === 'negative'
            ).length;
            const total = recentPosts.length;

            const positivePercent = total > 0 ? (positive / total) * 100 : 0;
            const neutralPercent = total > 0 ? (neutral / total) * 100 : 0;
            const negativePercent = total > 0 ? (negative / total) * 100 : 0;

            setPostsPerMinuteTimeline((prev) => {
              const oneHourAgo = now - 60 * 60 * 1000;
              const filtered = prev.filter((d) => d.timestamp >= oneHourAgo);
              return [...filtered, { timestamp: now, rate }];
            });

            setSentimentTimeline((prev) => {
              const oneHourAgo = now - 60 * 60 * 1000;
              const filtered = prev.filter((d) => d.timestamp >= oneHourAgo);
              return [
                ...filtered,
                {
                  timestamp: now,
                  positivePercent,
                  neutralPercent,
                  negativePercent,
                },
              ];
            });
          }
        }

        return currentTimestamps;
      });
    };

    const interval = setInterval(calculateRates, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts((prev) => [latestPost, ...prev].slice(0, maxPosts));
    }
  }, [latestPost]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) {
        return false;
      }
      if (
        keywordFilter &&
        !post.text.toLowerCase().includes(keywordFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [posts, selectedLanguage, keywordFilter]);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'rgb(52, 211, 153)'; // Emerald
      case 'negative':
        return 'rgb(248, 113, 113)'; // Rose
      case 'neutral':
        return 'rgb(148, 163, 184)'; // Slate
      default:
        return 'rgb(148, 163, 184)';
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Ambient background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
            top: '-10%',
            right: '-10%',
          }}
        />
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            bottom: '-10%',
            left: '-10%',
          }}
        />
      </div>

      <div className="relative z-10 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div
            className="rounded-2xl p-6 sm:p-8 backdrop-blur-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                  Bluesky Firehose
                </h1>
                <p className="text-white/80 text-sm sm:text-base">
                  Real-time social stream with sentiment analysis
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connected ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                    style={{
                      boxShadow: connected
                        ? '0 0 8px rgba(52, 211, 153, 0.6)'
                        : '0 0 8px rgba(248, 113, 113, 0.6)',
                    }}
                  />
                  <span className="text-white text-sm font-medium">
                    {connected ? 'Live' : 'Offline'}
                  </span>
                </div>
                <Link href="/variants">
                  <a
                    className="px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/30 transition-all"
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    ← Back
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="mb-6">
          <div
            className="rounded-2xl p-6 backdrop-blur-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                >
                  <option value="all">All Languages</option>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Keyword Search
                </label>
                <input
                  type="text"
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  placeholder="Filter posts..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/50 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Visualization Cards */}
        <div className="mb-6">
          <h2 className="text-white text-xl font-semibold mb-4">Analytics</h2>
          <div className="glass-cards">
            <CardWall>
              <SentimentDistributionCard sentimentCounts={stats.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }} />
              <SentimentTimelineCard data={sentimentTimeline} />
              <PostsPerMinuteCard
                data={postsPerMinuteTimeline}
                currentRate={stats?.postsPerMinute || 0}
              />
              <LanguagesCard languageCounts={languageCounts} />
              <ContentTypesCard contentTypeCounts={contentTypeCounts} />
            </CardWall>
          </div>
        </div>

        {/* Live Feed */}
        <div>
          <h2 className="text-white text-xl font-semibold mb-4">
            Live Feed ({filteredPosts.length})
          </h2>
          <div className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div
                className="rounded-2xl p-12 text-center backdrop-blur-xl"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <p className="text-white/60">
                  {posts.length === 0
                    ? 'Waiting for posts...'
                    : 'No posts match your filters'}
                </p>
              </div>
            ) : (
              filteredPosts.map((post, index) => (
                <div
                  key={post.uri || index}
                  className="rounded-2xl p-5 backdrop-blur-xl transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {/* Post Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                      style={{
                        background: getSentimentColor(post.sentiment),
                      }}
                    >
                      {post.author?.handle?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        @{post.author?.handle || 'unknown'}
                      </div>
                      <div className="flex items-center gap-2 text-white/60 text-sm">
                        <span>{new Date(post.createdAt).toLocaleTimeString()}</span>
                        {post.language && (
                          <>
                            <span>•</span>
                            <span>{post.language.toUpperCase()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{
                        background: `${getSentimentColor(post.sentiment)}33`,
                        border: `1px solid ${getSentimentColor(post.sentiment)}66`,
                      }}
                    >
                      {post.sentiment}
                    </div>
                  </div>

                  {/* Post Content */}
                  <p className="text-white leading-relaxed mb-3">{post.text}</p>

                  {/* Media */}
                  {(post.images || post.videos) && (
                    <div className="mb-3">
                      <MediaDisplay
                        images={post.images}
                        videos={post.videos}
                        variant="standard"
                        sensitive={post.sensitive}
                      />
                    </div>
                  )}

                  {/* Post Metadata */}
                  <div className="flex items-center gap-3 text-white/50 text-sm">
                    {post.isReply && <span>↩ Reply</span>}
                    {post.isQuote && <span>💬 Quote</span>}
                    {post.hasImages && <span>🖼 Images</span>}
                    {post.hasVideo && <span>🎥 Video</span>}
                    {post.hasLink && <span>🔗 Link</span>}
                    {post.images?.some((img) => !img.alt) && (
                      <span className="text-rose-400">⚠️ No alt text</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphism card styling */}
      <style>{`
        .glass-cards .border-2 {
          background: rgba(255, 255, 255, 0.15) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          backdrop-filter: blur(20px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          border-radius: 16px;
          color: white;
        }

        .glass-cards .border-foreground {
          border-color: rgba(255, 255, 255, 0.3) !important;
        }

        .glass-cards button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .glass-cards svg {
          color: white;
        }

        .glass-cards select option {
          background: #667eea;
          color: white;
        }
      `}</style>
    </div>
  );
}
