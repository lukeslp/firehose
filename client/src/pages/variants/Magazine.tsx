/**
 * Magazine.tsx - EDITORIAL variant
 *
 * Aesthetic: Modern editorial magazine, bold typography, asymmetric grid
 * Theme: Black on white with vibrant accent (electric blue #0047FF)
 * Typography: Serif headings (Playfair Display), sans-serif body (Inter)
 * Layout: Asymmetric grid with intentional white space, clear visual hierarchy
 * Effects: Clean, professional, readable with magazine-style sectioning
 */

import { useSocket } from '@/hooks/useSocket';
import { useState, useEffect, useMemo } from 'react';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';
import { CardWall } from '@/components/CardWall';
import { SentimentDistributionCard } from '@/components/cards/SentimentDistributionCard';
import { SentimentTimelineCard } from '@/components/cards/SentimentTimelineCard';
import { PostsPerMinuteCard } from '@/components/cards/PostsPerMinuteCard';
import { LanguagesCard } from '@/components/cards/LanguagesCard';
import { ContentTypesCard } from '@/components/cards/ContentTypesCard';

export function Magazine({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 20;
  const [featuredPost, setFeaturedPost] = useState<FirehosePost | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Data tracking for CardWall (same pattern as Dashboard.tsx)
  const [postTimestamps, setPostTimestamps] = useState<Array<{ timestamp: number; sentiment: string }>>([]);
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });

  // Timeline data (sampled every 1 second)
  const [sentimentTimeline, setSentimentTimeline] = useState<Array<{
    timestamp: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  }>>([]);

  const [postsPerMinuteTimeline, setPostsPerMinuteTimeline] = useState<Array<{
    timestamp: number;
    rate: number;
  }>>([]);

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => {
        const updated = [latestPost, ...prev].slice(0, maxPosts);
        // Feature first positive post with hashtags or media
        const featured = updated.find(p =>
          p.sentiment === 'positive' &&
          ((p.hashtags && p.hashtags.length > 0) || p.hasImages || p.hasVideo)
        );
        if (featured && !featuredPost) {
          setFeaturedPost(featured);
        }
        return updated;
      });
    }
  }, [latestPost, maxPosts, featuredPost]);

  // Track post data for analytics
  useEffect(() => {
    if (!latestPost) return;

    const now = Date.now();

    setPostTimestamps(prev => {
      const twoMinutesAgo = now - 2 * 60 * 1000;
      const filtered = prev.filter(d => d.timestamp >= twoMinutesAgo);
      return [...filtered, {
        timestamp: now,
        sentiment: latestPost.sentiment
      }];
    });

    if (latestPost.language) {
      setLanguageCounts(prev => ({
        ...prev,
        [latestPost.language!]: (prev[latestPost.language!] || 0) + 1
      }));
    }

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

  // Sample rate every 1 second for timeline charts
  useEffect(() => {
    const calculateRates = () => {
      setPostTimestamps(currentTimestamps => {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const recentPosts = currentTimestamps.filter(p => p.timestamp >= oneMinuteAgo);

        if (recentPosts.length > 0) {
          const oldestTimestamp = Math.min(...recentPosts.map(p => p.timestamp));
          const timeWindowSeconds = (now - oldestTimestamp) / 1000;

          if (timeWindowSeconds > 0) {
            const rate = Math.round((recentPosts.length / timeWindowSeconds) * 60);

            const positive = recentPosts.filter(p => p.sentiment === 'positive').length;
            const neutral = recentPosts.filter(p => p.sentiment === 'neutral').length;
            const negative = recentPosts.filter(p => p.sentiment === 'negative').length;
            const total = recentPosts.length;

            const positivePercent = total > 0 ? (positive / total) * 100 : 0;
            const neutralPercent = total > 0 ? (neutral / total) * 100 : 0;
            const negativePercent = total > 0 ? (negative / total) * 100 : 0;

            setPostsPerMinuteTimeline(prev => {
              const oneHourAgo = now - 60 * 60 * 1000;
              const filtered = prev.filter(d => d.timestamp >= oneHourAgo);
              return [...filtered, { timestamp: now, rate }];
            });

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

        return currentTimestamps;
      });
    };

    const interval = setInterval(calculateRates, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) {
        return false;
      }
      if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [posts, selectedLanguage, keywordFilter]);

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return {
          border: 'border-l-4 border-emerald-600',
          accent: 'bg-emerald-600',
          text: 'text-emerald-600',
          label: 'Positive'
        };
      case 'negative':
        return {
          border: 'border-l-4 border-rose-600',
          accent: 'bg-rose-600',
          text: 'text-rose-600',
          label: 'Negative'
        };
      default:
        return {
          border: 'border-l-4 border-neutral-400',
          accent: 'bg-neutral-400',
          text: 'text-neutral-600',
          label: 'Neutral'
        };
    }
  };

  const togglePostExpanded = (uri: string) => {
    setExpandedPosts(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  return (
    <div
      className={`magazine min-h-screen bg-white text-black ${className || ''}`}
    >
      {/* Masthead */}
      <header className="border-b-2 border-black sticky top-0 z-30 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8">
          <div className="flex items-end justify-between gap-8">
            <div className="flex-1">
              <h1 className="magazine-title text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.85] mb-3">
                Bluesky
              </h1>
              <p className="text-xs md:text-sm uppercase tracking-[0.3em] text-neutral-500 font-sans font-medium">
                Live Social Stream — Real Time
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full transition-colors ${
                    connected ? 'bg-[#0047FF]' : 'bg-neutral-400'
                  }`}
                />
                <span className="text-xs uppercase tracking-wider font-sans font-medium">
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>
              <time className="text-xs text-neutral-500 font-sans">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </time>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 md:px-12 pb-20">
        {/* Stats Bar - Asymmetric grid */}
        <div className="py-16 border-b-2 border-black">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            {/* Large stat */}
            <div className="md:col-span-5">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-3 font-sans font-medium">
                Total Posts
              </div>
              <div className="magazine-stat text-7xl md:text-8xl font-black tabular-nums leading-none">
                {(stats?.totalPosts || 0).toLocaleString()}
              </div>
            </div>

            {/* Medium stats */}
            <div className="md:col-span-3">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-3 font-sans font-medium">
                Per Minute
              </div>
              <div className="magazine-stat text-5xl md:text-6xl font-black tabular-nums leading-none">
                {Math.round(stats?.postsPerMinute || 0)}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-3 font-sans font-medium">
                Showing
              </div>
              <div className="magazine-stat text-5xl md:text-6xl font-black tabular-nums leading-none">
                {filteredPosts.length}
              </div>
            </div>

            {/* Sentiment */}
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-3 font-sans font-medium">
                Sentiment
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black tabular-nums text-emerald-600">
                    {stats?.sentimentCounts?.positive || 0}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-emerald-600 font-sans">Pos</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black tabular-nums text-rose-600">
                    {stats?.sentimentCounts?.negative || 0}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-rose-600 font-sans">Neg</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="py-12 border-b border-neutral-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
            <div className="md:col-span-5">
              <label className="block text-xs uppercase tracking-[0.25em] text-neutral-500 mb-3 font-sans font-medium">
                Language Filter
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-4 py-3 border-2 border-black bg-white text-sm font-sans focus:outline-none focus:border-[#0047FF] transition-colors"
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

            <div className="md:col-span-7">
              <label className="block text-xs uppercase tracking-[0.25em] text-neutral-500 mb-3 font-sans font-medium">
                Keyword Search
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Enter keyword..."
                className="w-full px-4 py-3 border-2 border-black bg-white text-sm font-sans focus:outline-none focus:border-[#0047FF] transition-colors placeholder:text-neutral-400"
              />
            </div>
          </div>
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <div className="py-16 border-b border-neutral-200">
            <div className="flex items-baseline gap-4 mb-6">
              <h2 className="magazine-section text-2xl md:text-3xl font-black uppercase tracking-tight">
                Featured
              </h2>
              <div className="h-px bg-[#0047FF] flex-1" />
            </div>

            <div className="grid md:grid-cols-12 gap-8">
              <div className="md:col-span-8">
                <article className={`${getSentimentStyle(featuredPost.sentiment).border} pl-6 py-4`}>
                  {featuredPost.author && (
                    <div className="mb-4">
                      <div className="text-sm font-sans font-bold">
                        {featuredPost.author.displayName || featuredPost.author.handle}
                      </div>
                      <div className="text-xs text-neutral-500 font-sans">
                        @{featuredPost.author.handle}
                      </div>
                    </div>
                  )}

                  <div className="text-xl md:text-2xl leading-relaxed mb-4 font-serif">
                    {featuredPost.text}
                  </div>

                  {(featuredPost.images || featuredPost.videos) && (
                    <div className="mb-4">
                      <MediaDisplay
                        images={featuredPost.images}
                        videos={featuredPost.videos}
                        variant="large"
                        sensitive={featuredPost.sensitive}
                      />
                    </div>
                  )}

                  {featuredPost.hashtags && featuredPost.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {featuredPost.hashtags.slice(0, 5).map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-black text-white text-xs uppercase tracking-wider font-sans font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              </div>

              <div className="md:col-span-4">
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-2 font-sans font-medium">
                  Posted
                </div>
                <div className="text-sm text-neutral-700 font-sans mb-4">
                  {new Date(featuredPost.createdAt).toLocaleString()}
                </div>

                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 mb-2 font-sans font-medium">
                  Sentiment
                </div>
                <div className={`text-sm font-sans font-bold ${getSentimentStyle(featuredPost.sentiment).text}`}>
                  {getSentimentStyle(featuredPost.sentiment).label}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts Stream */}
        <div className="py-16">
          <div className="flex items-baseline gap-4 mb-8">
            <h2 className="magazine-section text-2xl md:text-3xl font-black uppercase tracking-tight">
              Latest Posts
            </h2>
            <div className="h-px bg-black flex-1" />
          </div>

          {filteredPosts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl font-black text-neutral-200 mb-4 magazine-title">
                No Posts
              </div>
              <p className="text-neutral-500 text-sm font-sans">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {filteredPosts.map((post, index) => {
                const style = getSentimentStyle(post.sentiment);
                const isExpanded = expandedPosts.has(post.uri || `${index}`);
                const postId = post.uri || `${index}`;

                return (
                  <article
                    key={postId}
                    className={`${style.border} border-t-2 border-neutral-200 pl-6 py-6 transition-all hover:bg-neutral-50`}
                  >
                    {/* Post Header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        {post.author && (
                          <div className="flex items-baseline gap-3">
                            <span className="text-sm font-sans font-bold">
                              {post.author.displayName || post.author.handle}
                            </span>
                            <span className="text-xs text-neutral-500 font-sans">
                              @{post.author.handle}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <time className="text-xs text-neutral-500 font-sans">
                          {new Date(post.createdAt).toLocaleTimeString()}
                        </time>
                        <div className={`w-2 h-2 rounded-full ${style.accent}`} />
                      </div>
                    </div>

                    {/* Post Content */}
                    <div
                      className={`text-base leading-relaxed mb-3 font-serif ${
                        !isExpanded && post.text.length > 200 ? 'line-clamp-3' : ''
                      }`}
                    >
                      {post.text}
                    </div>

                    {post.text.length > 200 && (
                      <button
                        onClick={() => togglePostExpanded(postId)}
                        className="text-xs uppercase tracking-wider text-[#0047FF] font-sans font-medium hover:underline mb-3"
                      >
                        {isExpanded ? 'Show Less' : 'Read More'}
                      </button>
                    )}

                    {/* Media */}
                    {(post.images || post.videos) && isExpanded && (
                      <div className="mb-3">
                        <MediaDisplay
                          images={post.images}
                          videos={post.videos}
                          variant="large"
                          sensitive={post.sensitive}
                        />
                      </div>
                    )}

                    {/* Post Meta */}
                    <div className="flex flex-wrap gap-3 text-xs text-neutral-500 font-sans">
                      {post.language && (
                        <span className="uppercase tracking-wider">
                          {post.language}
                        </span>
                      )}
                      {post.hasImages && <span>📷 Image</span>}
                      {post.hasVideo && <span>🎬 Video</span>}
                      {post.hasLink && <span>🔗 Link</span>}
                      {post.isReply && <span>💬 Reply</span>}
                      {post.hashtags && post.hashtags.length > 0 && (
                        <span># {post.hashtags.length} tags</span>
                      )}
                      {post.images?.some(img => !img.alt) && (
                        <span className="text-rose-600 font-medium">⚠ Missing alt text</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Analytics Section */}
        <section className="py-16 border-t-2 border-black">
          <div className="flex items-baseline gap-4 mb-12">
            <h2 className="magazine-section text-3xl md:text-4xl font-black uppercase tracking-tight">
              Analytics
            </h2>
            <div className="h-px bg-[#0047FF] flex-1" />
          </div>

          <CardWall>
            <SentimentDistributionCard sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }} />
            <SentimentTimelineCard data={sentimentTimeline} />
            <PostsPerMinuteCard
              data={postsPerMinuteTimeline}
              currentRate={stats?.postsPerMinute || 0}
            />
            <LanguagesCard languageCounts={languageCounts} />
            <ContentTypesCard contentTypeCounts={contentTypeCounts} />
          </CardWall>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black py-8">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 font-sans">
              Magazine View
            </div>
            <div className="text-xs text-neutral-500 font-sans">
              {new Date().getFullYear()} — Real-time social stream
            </div>
          </div>
        </div>
      </footer>

      {/* Styles */}
      <style>{`
        /* Magazine-specific typography */
        .magazine-title {
          font-family: 'Playfair Display', Georgia, serif;
          letter-spacing: -0.02em;
        }

        .magazine-stat {
          font-family: 'Playfair Display', Georgia, serif;
          letter-spacing: -0.03em;
        }

        .magazine-section {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Smooth transitions */
        .magazine * {
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Line clamp utility */
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

export default Magazine;
