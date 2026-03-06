/**
 * DashboardPro.tsx - Art Deco Luxury Analytics Dashboard
 *
 * Aesthetic: Gatsby-era opulence meets financial data
 * Theme: Art Deco luxury, geometric patterns, gold accents
 * Typography: 'Playfair Display' (headers), 'Cormorant Garamond' (body)
 * Colors: Midnight navy (#0a0e27), gold (#d4af37), deep emerald (#1b4332), champagne (#f8f9fa)
 */

import { useSocket } from '@/hooks/useSocket';
import { useState, useEffect, useMemo } from 'react';
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

export function DashboardPro({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 50;

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Analytics state
  const [postsPerSecond, setPostsPerSecond] = useState<number[]>([]);

  // Timeline data tracking (for cards)
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

  // Rolling window for rate calculation
  const [postTimestamps, setPostTimestamps] = useState<Array<{
    timestamp: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>>([]);

  // Content tracking
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));

      // Track posts per second for sparkline
      const now = Math.floor(Date.now() / 1000);
      setPostsPerSecond(prev => {
        const updated = [...prev];
        updated[now] = (updated[now] || 0) + 1;
        // Keep last 60 seconds
        const cutoff = now - 60;
        Object.keys(updated).forEach(key => {
          if (parseInt(key) < cutoff) delete updated[parseInt(key)];
        });
        return updated;
      });
    }
  }, [latestPost, maxPosts]);

  // Track timeline data for cards
  useEffect(() => {
    if (!latestPost) return;

    const now = Date.now();

    // Add timestamp to rolling window, remove old entries
    setPostTimestamps(prev => {
      const twoMinutesAgo = now - 2 * 60 * 1000;
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

  // Analytics calculations
  const analytics = useMemo(() => {
    const positive = filteredPosts.filter(p => p.sentiment === 'positive').length;
    const negative = filteredPosts.filter(p => p.sentiment === 'negative').length;
    const neutral = filteredPosts.filter(p => p.sentiment === 'neutral').length;
    const total = filteredPosts.length || 1;

    const withMedia = filteredPosts.filter(p => p.hasImages || p.hasVideo).length;
    const withLinks = filteredPosts.filter(p => p.hasLink).length;
    const replies = filteredPosts.filter(p => p.isReply).length;

    return {
      sentimentPercent: {
        positive: ((positive / total) * 100).toFixed(1),
        negative: ((negative / total) * 100).toFixed(1),
        neutral: ((neutral / total) * 100).toFixed(1),
      },
      mediaPercent: ((withMedia / total) * 100).toFixed(1),
      linksPercent: ((withLinks / total) * 100).toFixed(1),
      repliesPercent: ((replies / total) * 100).toFixed(1),
    };
  }, [filteredPosts]);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-[#1b4332] bg-[#1b4332]/10 border-[#1b4332]/30';
      case 'negative':
        return 'text-[#8b0000] bg-[#8b0000]/10 border-[#8b0000]/30';
      case 'neutral':
        return 'text-[#d4af37] bg-[#d4af37]/10 border-[#d4af37]/30';
      default:
        return 'text-[#f8f9fa] bg-[#f8f9fa]/10 border-[#f8f9fa]/30';
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Cormorant+Garamond:wght@300;400;600;700&display=swap');

        .dashboard-pro {
          font-family: 'Cormorant Garamond', serif;
        }

        .art-deco-heading {
          font-family: 'Playfair Display', serif;
        }

        /* Art Deco geometric sunburst background */
        .art-deco-bg {
          background:
            radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.15) 0%, transparent 50%),
            linear-gradient(135deg, #0a0e27 0%, #0d1230 50%, #0a0e27 100%);
          position: relative;
        }

        .art-deco-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212, 175, 55, 0.03) 2px, rgba(212, 175, 55, 0.03) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(212, 175, 55, 0.03) 2px, rgba(212, 175, 55, 0.03) 4px);
          pointer-events: none;
        }

        /* Beveled card effect with gold foil emboss */
        .art-deco-card {
          background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
          border: 2px solid transparent;
          background-clip: padding-box;
          position: relative;
          box-shadow:
            inset 2px 2px 4px rgba(212, 175, 55, 0.3),
            inset -2px -2px 4px rgba(0, 0, 0, 0.1),
            0 8px 16px rgba(0, 0, 0, 0.2);
        }

        .art-deco-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(135deg, #d4af37, #f4d03f, #d4af37);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        /* Chevron pattern divider */
        .art-deco-divider {
          position: relative;
          height: 3px;
          background: linear-gradient(90deg,
            transparent 0%,
            #d4af37 20%,
            #d4af37 50%,
            #d4af37 80%,
            transparent 100%
          );
          clip-path: polygon(
            0% 50%, 10% 0%, 20% 50%, 30% 0%, 40% 50%, 50% 0%,
            60% 50%, 70% 0%, 80% 50%, 90% 0%, 100% 50%,
            90% 100%, 80% 50%, 70% 100%, 60% 50%, 50% 100%,
            40% 50%, 30% 100%, 20% 50%, 10% 100%
          );
        }

        /* Gold shimmer animation */
        @keyframes shimmer {
          0% {
            background-position: -100% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        .art-deco-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(212, 175, 55, 0.4) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }

        /* Geometric header accent */
        .art-deco-header {
          background: linear-gradient(180deg, #0a0e27 0%, #0d1230 100%);
          border-bottom: 3px solid #d4af37;
          position: relative;
        }

        .art-deco-header::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #f4d03f, transparent);
        }

        /* Sunburst data visualization */
        .art-deco-sunburst {
          background:
            repeating-conic-gradient(
              from 0deg at 50% 50%,
              #d4af37 0deg 2deg,
              transparent 2deg 10deg
            ),
            radial-gradient(circle, #f8f9fa 30%, transparent 70%);
        }

        /* Table with art deco styling */
        .art-deco-table {
          border: 2px solid #d4af37;
        }

        .art-deco-table thead {
          background: linear-gradient(180deg, #0a0e27 0%, #0d1230 100%);
          border-bottom: 3px solid #d4af37;
        }

        .art-deco-table tbody tr {
          border-bottom: 1px solid rgba(212, 175, 55, 0.2);
          transition: background 0.2s ease;
        }

        .art-deco-table tbody tr:hover {
          background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.1), transparent);
        }

        /* Geometric number display */
        .art-deco-metric {
          font-family: 'Playfair Display', serif;
          font-weight: 900;
          letter-spacing: 0.05em;
          background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        /* Status indicator */
        .art-deco-status {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          box-shadow: 0 0 12px currentColor;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* Input fields */
        .art-deco-input {
          background: #f8f9fa;
          border: 2px solid #d4af37;
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.125rem;
          transition: all 0.3s ease;
        }

        .art-deco-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
          background: #ffffff;
        }

        /* Fan-shaped accent */
        .art-deco-fan {
          clip-path: polygon(50% 100%, 0% 0%, 100% 0%);
          background: linear-gradient(180deg, #d4af37 0%, transparent 100%);
        }
      `}</style>

      <div
        className={`dashboard-pro min-h-screen art-deco-bg text-[#f8f9fa] ${className || ''}`}
      >
        {/* Art Deco Header */}
        <header className="art-deco-header sticky top-0 z-10 shadow-2xl">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h1 className="art-deco-heading text-3xl font-black tracking-wider text-[#d4af37]">
                  BLUESKY
                  <span className="block text-xl font-normal tracking-[0.3em] text-[#f8f9fa]/80">
                    ANALYTICS SALON
                  </span>
                </h1>
                <div className="flex items-center gap-3">
                  <div
                    className={`art-deco-status ${
                      connected ? 'bg-[#1b4332]' : 'bg-[#8b0000]'
                    }`}
                  />
                  <span className="art-deco-heading text-sm tracking-[0.2em] uppercase">
                    {connected ? 'Live Broadcast' : 'Signal Lost'}
                  </span>
                </div>
              </div>
              <div className="art-deco-heading text-sm text-[#d4af37]/80 tracking-wider">
                {new Date().toLocaleString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>
          <div className="art-deco-divider"></div>
        </header>

        {/* Main Dashboard */}
        <main className="p-8">
          {/* Premier Metrics - Art Deco KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
            {/* Total Posts */}
            <div className="art-deco-card p-6 text-center">
              <div className="art-deco-heading text-xs text-[#0a0e27]/60 uppercase tracking-[0.15em] mb-2">
                Total Posts
              </div>
              <div className="art-deco-metric text-4xl mb-2">
                {(stats?.totalPosts || 0).toLocaleString()}
              </div>
              <div className="art-deco-shimmer h-0.5 w-full mb-2"></div>
              <div className="text-sm text-[#1b4332] font-semibold">
                ↑ {Math.round(stats?.postsPerMinute || 0)}/min
              </div>
            </div>

            {/* Filtered View */}
            <div className="art-deco-card p-6 text-center">
              <div className="art-deco-heading text-xs text-[#0a0e27]/60 uppercase tracking-[0.15em] mb-2">
                Filtered
              </div>
              <div className="art-deco-metric text-4xl mb-2">
                {filteredPosts.length}
              </div>
              <div className="art-deco-shimmer h-0.5 w-full mb-2"></div>
              <div className="text-sm text-[#0a0e27]/70 font-semibold">
                {((filteredPosts.length / posts.length) * 100 || 0).toFixed(1)}% visible
              </div>
            </div>

            {/* Positive Sentiment */}
            <div className="art-deco-card p-6 text-center">
              <div className="art-deco-heading text-xs text-[#0a0e27]/60 uppercase tracking-[0.15em] mb-2">
                Positive
              </div>
              <div className="text-4xl font-black text-[#1b4332] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                {analytics.sentimentPercent.positive}%
              </div>
              <div className="art-deco-shimmer h-0.5 w-full mb-2"></div>
              <div className="text-sm text-[#0a0e27]/70 font-semibold">
                {stats?.sentimentCounts?.positive || 0} posts
              </div>
            </div>

            {/* Negative Sentiment */}
            <div className="art-deco-card p-6 text-center">
              <div className="art-deco-heading text-xs text-[#0a0e27]/60 uppercase tracking-[0.15em] mb-2">
                Negative
              </div>
              <div className="text-4xl font-black text-[#8b0000] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                {analytics.sentimentPercent.negative}%
              </div>
              <div className="art-deco-shimmer h-0.5 w-full mb-2"></div>
              <div className="text-sm text-[#0a0e27]/70 font-semibold">
                {stats?.sentimentCounts?.negative || 0} posts
              </div>
            </div>

            {/* Media Posts */}
            <div className="art-deco-card p-6 text-center">
              <div className="art-deco-heading text-xs text-[#0a0e27]/60 uppercase tracking-[0.15em] mb-2">
                Media
              </div>
              <div className="art-deco-metric text-4xl mb-2">
                {analytics.mediaPercent}%
              </div>
              <div className="art-deco-shimmer h-0.5 w-full mb-2"></div>
              <div className="text-sm text-[#0a0e27]/70 font-semibold">
                Images/Videos
              </div>
            </div>

            {/* Engagement */}
            <div className="art-deco-card p-6 text-center">
              <div className="art-deco-heading text-xs text-[#0a0e27]/60 uppercase tracking-[0.15em] mb-2">
                Replies
              </div>
              <div className="art-deco-metric text-4xl mb-2">
                {analytics.repliesPercent}%
              </div>
              <div className="art-deco-shimmer h-0.5 w-full mb-2"></div>
              <div className="text-sm text-[#0a0e27]/70 font-semibold">
                Conversations
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="art-deco-card p-6 mb-8">
            <div className="art-deco-heading text-sm font-bold text-[#0a0e27] uppercase tracking-[0.2em] mb-4 text-center">
              Refinement Controls
            </div>
            <div className="art-deco-divider mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Language */}
              <div>
                <label className="art-deco-heading text-sm text-[#0a0e27]/80 block mb-2 tracking-wider">
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="art-deco-input w-full px-4 py-3"
                >
                  <option value="all">All Languages</option>
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                  <option value="fr">FR</option>
                  <option value="de">DE</option>
                  <option value="ja">JA</option>
                  <option value="pt">PT</option>
                </select>
              </div>

              {/* Keyword */}
              <div>
                <label className="art-deco-heading text-sm text-[#0a0e27]/80 block mb-2 tracking-wider">
                  Keyword
                </label>
                <input
                  type="text"
                  value={keywordFilter}
                  onChange={(e) => setKeywordFilter(e.target.value)}
                  placeholder="Filter content..."
                  className="art-deco-input w-full px-4 py-3 placeholder:text-[#0a0e27]/40"
                />
              </div>
            </div>
          </div>

          {/* Data Visualization Cards */}
          <div className="mb-8">
            <CardWall>
              <SentimentDistributionCard
                sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
              />
              <SentimentTimelineCard data={sentimentTimeline} />
              <PostsPerMinuteCard
                data={postsPerMinuteTimeline}
                currentRate={stats?.postsPerMinute || 0}
              />
              <LanguagesCard languageCounts={languageCounts} />
              <ContentTypesCard contentTypeCounts={contentTypeCounts} />
            </CardWall>
          </div>

          {/* Live Feed Table */}
          <div className="art-deco-card overflow-hidden">
            <div className="p-6 border-b-2 border-[#d4af37] flex items-center justify-between bg-gradient-to-b from-[#0a0e27] to-[#0d1230]">
              <div className="art-deco-heading text-lg font-bold text-[#d4af37] uppercase tracking-[0.2em]">
                Live Broadcast Feed
              </div>
              <div className="art-deco-heading text-sm text-[#f8f9fa]/70 tracking-wider">
                Showing {filteredPosts.length} of {posts.length}
              </div>
            </div>
            <div className="overflow-auto max-h-[600px]">
              <table className="art-deco-table w-full">
                <thead className="sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-left art-deco-heading text-xs text-[#d4af37] uppercase tracking-[0.15em]">
                      Time
                    </th>
                    <th className="px-6 py-4 text-left art-deco-heading text-xs text-[#d4af37] uppercase tracking-[0.15em]">
                      Author
                    </th>
                    <th className="px-6 py-4 text-left art-deco-heading text-xs text-[#d4af37] uppercase tracking-[0.15em]">
                      Content
                    </th>
                    <th className="px-6 py-4 text-left art-deco-heading text-xs text-[#d4af37] uppercase tracking-[0.15em]">
                      Sentiment
                    </th>
                    <th className="px-6 py-4 text-left art-deco-heading text-xs text-[#d4af37] uppercase tracking-[0.15em]">
                      Meta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="art-deco-heading text-[#0a0e27]/50 text-lg tracking-wider">
                          No posts match your refinement criteria
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPosts.map((post, index) => (
                      <tr key={post.uri || index}>
                        <td className="px-6 py-4 text-sm text-[#0a0e27]/70 whitespace-nowrap" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                          {new Date(post.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-[#0a0e27] whitespace-nowrap" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                          @{(post.author?.handle || 'anon').slice(0, 15)}
                        </td>
                        <td className="px-6 py-4 text-base text-[#0a0e27] max-w-md" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                          <div className="line-clamp-2 mb-2 leading-relaxed">{post.text}</div>
                          {(post.images || post.videos) && (
                            <MediaDisplay
                              images={post.images}
                              videos={post.videos}
                              variant="compact"
                              sensitive={post.sensitive}
                              className="mt-2"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1.5 text-xs font-semibold rounded border-2 ${getSentimentColor(
                              post.sentiment
                            )}`}
                            style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '0.1em' }}
                          >
                            {post.sentiment.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#0a0e27]/70 whitespace-nowrap">
                          <div className="flex gap-3">
                            {post.hasImages && <span title="Has images">🖼️</span>}
                            {post.hasVideo && <span title="Has video">🎥</span>}
                            {post.hasLink && <span title="Has link">🔗</span>}
                            {post.isReply && <span title="Reply">💬</span>}
                            {post.images?.some(img => !img.alt) && (
                              <span title="Missing alt text" className="text-[#8b0000]">⚠️</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Art Deco Footer Accent */}
        <div className="art-deco-divider mt-12"></div>
        <div className="h-4 bg-gradient-to-b from-[#d4af37]/20 to-transparent"></div>
      </div>
    </>
  );
}

export default DashboardPro;
