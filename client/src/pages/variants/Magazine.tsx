/**
 * Magazine.tsx - VAPORWAVE DREAMS variant
 *
 * Aesthetic: 80s-90s internet nostalgia, Windows 95, VHS glitch
 * Theme: Hot pink, cyan, purple, mint, pastel yellow chaos
 * Typography: Comic Sans (ironic headers), Courier New (computer text), Impact (statements)
 * Layout: Chaotic overlapping grids, intentionally misaligned, scan lines, RGB chromatic aberration
 * Effects: VHS glitch, animated gradients, Windows 95 dialog boxes, email chain aesthetic
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
        // Feature first positive post with hashtags
        const featured = updated.find(p => p.sentiment === 'positive' && p.hashtags && p.hashtags.length > 0);
        if (featured && !featuredPost) {
          setFeaturedPost(featured);
        }
        return updated;
      });
    }
  }, [latestPost, maxPosts, featuredPost]);

  // Track post data for analytics (same pattern as Dashboard.tsx lines 80-128)
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

  // Sample rate every 1 second for timeline charts (same pattern as Dashboard.tsx lines 149-205)
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
          border: 'border-l-4 border-[#05ffa1]',
          text: 'text-[#05ffa1]',
          glow: 'vaporwave-glow-mint'
        };
      case 'negative':
        return {
          border: 'border-l-4 border-[#ff71ce]',
          text: 'text-[#ff71ce]',
          glow: 'vaporwave-glow-pink'
        };
      default:
        return {
          border: 'border-l-4 border-[#b967ff]',
          text: 'text-[#b967ff]',
          glow: 'vaporwave-glow-purple'
        };
    }
  };

  return (
    <div
      className={`magazine min-h-screen relative overflow-hidden ${className || ''}`}
    >
      {/* Animated gradient background */}
      <div className="vaporwave-gradient fixed inset-0 z-0" />

      {/* Scan lines overlay */}
      <div className="scan-lines fixed inset-0 z-10 pointer-events-none" />

      {/* VHS glitch overlay */}
      <div className="vhs-glitch fixed inset-0 z-10 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-20">
        {/* Masthead - Windows 95 style */}
        <header className="win95-window sticky top-4 z-30 mx-4 mb-8 shadow-2xl">
          <div className="win95-titlebar">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#ff71ce] border-2 border-black" />
              <span className="chromatic-text-cyan" style={{ fontFamily: "'Comic Sans MS', cursive", fontWeight: 'bold' }}>
                BLUESKY.EXE - VAPORWAVE DREAMS v1.0
              </span>
            </div>
            <div className="flex gap-1">
              <div className={`win95-button ${connected ? 'bg-[#05ffa1]' : 'bg-gray-400'}`}>
                {connected ? '●' : '○'}
              </div>
            </div>
          </div>
          <div className="win95-content">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1
                  className="chromatic-text text-4xl md:text-6xl mb-2"
                  style={{ fontFamily: "'Comic Sans MS', cursive", fontWeight: 'bold' }}
                >
                  ✨ Bluesky ✨
                </h1>
                <p
                  className="text-[#fffb96] text-sm"
                  style={{ fontFamily: "'Courier New', monospace", letterSpacing: '0.15em' }}
                >
                  &gt;&gt;&gt; LIVE SOCIAL STREAM // VOL. ∞ &lt;&lt;&lt;
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full animate-pulse ${
                      connected ? 'bg-[#05ffa1] shadow-lg shadow-[#05ffa1]' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-[#fffb96] text-xs" style={{ fontFamily: "'Courier New', monospace" }}>
                    {connected ? '[ONLINE]' : '[OFFLINE]'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content container */}
        <main className="max-w-7xl mx-auto px-4 pb-12">
          {/* Stats Bar - Intentionally chaotic layout */}
          <div className="win95-window mb-8 transform -rotate-1">
            <div className="win95-titlebar">
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: '12px' }}>
                ► STATS.TXT
              </span>
            </div>
            <div className="win95-content">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="transform rotate-1">
                  <div className="text-xs text-[#01cdfe] mb-1" style={{ fontFamily: "'Courier New', monospace" }}>
                    POSTS_TOTAL:
                  </div>
                  <div
                    className="text-3xl chromatic-text-pink tabular-nums"
                    style={{ fontFamily: 'Impact, sans-serif' }}
                  >
                    {(stats?.totalPosts || 0).toLocaleString()}
                  </div>
                </div>
                <div className="transform -rotate-2">
                  <div className="text-xs text-[#b967ff] mb-1" style={{ fontFamily: "'Courier New', monospace" }}>
                    RATE_PER_MIN:
                  </div>
                  <div
                    className="text-3xl chromatic-text-cyan tabular-nums"
                    style={{ fontFamily: 'Impact, sans-serif' }}
                  >
                    {Math.round(stats?.postsPerMinute || 0)}
                  </div>
                </div>
                <div className="transform rotate-2">
                  <div className="text-xs text-[#05ffa1] mb-1" style={{ fontFamily: "'Courier New', monospace" }}>
                    FILTERED_SHOW:
                  </div>
                  <div
                    className="text-3xl chromatic-text-purple tabular-nums"
                    style={{ fontFamily: 'Impact, sans-serif' }}
                  >
                    {filteredPosts.length}
                  </div>
                </div>
                <div className="transform -rotate-1">
                  <div className="text-xs text-[#fffb96] mb-1" style={{ fontFamily: "'Courier New', monospace" }}>
                    SENTIMENT_MIX:
                  </div>
                  <div className="flex gap-3 mt-2">
                    <span className="text-[#05ffa1] text-lg vaporwave-glow-mint" style={{ fontFamily: 'Impact, sans-serif' }}>
                      {stats?.sentimentCounts?.positive || 0}
                    </span>
                    <span className="text-[#fffb96]">|</span>
                    <span className="text-[#ff71ce] text-lg vaporwave-glow-pink" style={{ fontFamily: 'Impact, sans-serif' }}>
                      {stats?.sentimentCounts?.negative || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Controls - Windows 95 Dialog */}
          <div className="win95-window mb-8 transform rotate-1">
            <div className="win95-titlebar">
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: '12px' }}>
                ► FILTER_OPTIONS.DLG
              </span>
            </div>
            <div className="win95-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Language */}
                <div>
                  <label className="text-xs text-[#01cdfe] block mb-2" style={{ fontFamily: "'Courier New', monospace" }}>
                    &gt; SELECT_LANGUAGE:
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full win95-select"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  >
                    <option value="all">ALL_LANGUAGES.LNG</option>
                    <option value="en">ENGLISH.ENG</option>
                    <option value="es">SPANISH.ESP</option>
                    <option value="fr">FRENCH.FRA</option>
                    <option value="de">GERMAN.DEU</option>
                    <option value="ja">JAPANESE.JPN</option>
                    <option value="pt">PORTUGUESE.POR</option>
                  </select>
                </div>

                {/* Keyword */}
                <div>
                  <label className="text-xs text-[#b967ff] block mb-2" style={{ fontFamily: "'Courier New', monospace" }}>
                    &gt; SEARCH_KEYWORD:
                  </label>
                  <input
                    type="text"
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    placeholder="type_here.txt"
                    className="w-full win95-input"
                    style={{ fontFamily: "'Courier New', monospace" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Featured Post - Email chain aesthetic */}
          {featuredPost && (
            <div className="win95-window mb-8 transform -rotate-2 border-4 border-[#ff71ce] shadow-2xl shadow-[#ff71ce]/50">
              <div className="win95-titlebar bg-[#ff71ce]">
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: '12px', color: '#000' }}>
                  ► FEATURED_POST.EML ⭐
                </span>
              </div>
              <div className="win95-content bg-[#fffb96] text-black">
                <div className="mb-4" style={{ fontFamily: "'Courier New', monospace", fontSize: '11px' }}>
                  <div>&gt;&gt;&gt; FROM: {featuredPost.author?.handle || 'anonymous'}@bsky.social</div>
                  <div>&gt;&gt;&gt; DATE: {new Date(featuredPost.createdAt).toLocaleString()}</div>
                  <div>&gt;&gt;&gt; SUBJECT: FEATURED MESSAGE</div>
                  <div className="border-t-2 border-black my-2" />
                </div>
                <div
                  className="text-lg leading-relaxed mb-4"
                  style={{ fontFamily: "'Comic Sans MS', cursive" }}
                >
                  &gt;&gt;&gt; {featuredPost.text}
                </div>
                {featuredPost.hashtags && featuredPost.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {featuredPost.hashtags.slice(0, 5).map(tag => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-[#01cdfe] text-black border-2 border-black font-bold"
                        style={{ fontFamily: "'Courier New', monospace", fontSize: '10px' }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Posts Grid - Email chain aesthetic */}
          <div className="space-y-6">
            {filteredPosts.length === 0 ? (
              <div className="win95-window transform rotate-1">
                <div className="win95-titlebar">
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: '12px' }}>
                    ► ERROR_404.TXT
                  </span>
                </div>
                <div className="win95-content text-center py-12">
                  <p
                    className="text-[#ff71ce] text-xl chromatic-text-pink"
                    style={{ fontFamily: 'Impact, sans-serif' }}
                  >
                    NO POSTS FOUND
                  </p>
                  <p className="text-[#01cdfe] text-sm mt-2" style={{ fontFamily: "'Courier New', monospace" }}>
                    &gt;&gt;&gt; Try different filters...
                  </p>
                </div>
              </div>
            ) : (
              filteredPosts.map((post, index) => {
                const style = getSentimentStyle(post.sentiment);
                const rotation = index % 3 === 0 ? 'rotate-1' : index % 3 === 1 ? '-rotate-1' : 'rotate-0';

                return (
                  <article
                    key={post.uri || index}
                    className={`win95-window transform ${rotation} ${style.border} hover:scale-[1.02] transition-transform`}
                  >
                    <div className="win95-titlebar">
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: '11px' }}>
                        ► POST_{(index + 1).toString().padStart(3, '0')}.MSG
                      </span>
                      <div className={`w-3 h-3 rounded-full ${style.glow}`} style={{ background: style.text.replace('text-', '') }} />
                    </div>
                    <div className="win95-content">
                      {/* Email-style header */}
                      <div className="mb-3" style={{ fontFamily: "'Courier New', monospace", fontSize: '10px' }}>
                        <div className="text-[#01cdfe]">
                          &gt;&gt;&gt; FROM: {post.author?.displayName || post.author?.handle || 'Anonymous'}
                        </div>
                        <div className="text-[#b967ff]">
                          &gt;&gt;&gt; TIME: {new Date(post.createdAt).toLocaleTimeString()}
                        </div>
                        {post.language && (
                          <div className="text-[#05ffa1]">
                            &gt;&gt;&gt; LANG: {post.language.toUpperCase()}
                          </div>
                        )}
                        <div className="border-t border-[#fffb96] my-2" />
                      </div>

                      {/* Post Text with email quote style */}
                      <div
                        className={`text-base leading-relaxed mb-4 ${style.text}`}
                        style={{ fontFamily: "'Comic Sans MS', cursive" }}
                      >
                        &gt;&gt;&gt; {post.text}
                      </div>

                      {/* Media */}
                      {(post.images || post.videos) && (
                        <div className="mb-4 border-4 border-[#01cdfe] p-2">
                          <MediaDisplay
                            images={post.images}
                            videos={post.videos}
                            variant="large"
                            sensitive={post.sensitive}
                          />
                        </div>
                      )}

                      {/* Post Meta - Computer terminal style */}
                      <div className="flex flex-wrap gap-3 text-xs text-[#fffb96]" style={{ fontFamily: "'Courier New', monospace" }}>
                        {post.hasImages && <span>[IMG]</span>}
                        {post.hasVideo && <span>[VID]</span>}
                        {post.hasLink && <span>[LINK]</span>}
                        {post.isReply && <span>[REPLY]</span>}
                        {post.hashtags && post.hashtags.length > 0 && (
                          <span>[TAGS:{post.hashtags.length}]</span>
                        )}
                        {post.images?.some(img => !img.alt) && (
                          <span className="text-[#ff71ce] vaporwave-glow-pink">[NO_ALT_TEXT]</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Analytics Section */}
          <section className="mt-20">
            <div className="win95-window transform -rotate-1 mb-8">
              <div className="win95-titlebar">
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: '12px' }}>
                  ► ANALYTICS.SYS
                </span>
              </div>
              <div className="win95-content">
                <h2
                  className="text-4xl chromatic-text mb-2"
                  style={{ fontFamily: 'Impact, sans-serif' }}
                >
                  DATA VISUALIZATION
                </h2>
                <p
                  className="text-[#01cdfe] text-sm"
                  style={{ fontFamily: "'Courier New', monospace" }}
                >
                  &gt;&gt;&gt; Real-time social feed analytics in MAXIMUM VAPORWAVE...
                </p>
              </div>
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

        {/* Footer - Kitschy credits */}
        <footer className="win95-window mx-4 mb-8 transform rotate-1">
          <div className="win95-content text-center">
            <p
              className="text-[#ff71ce] text-sm chromatic-text-pink"
              style={{ fontFamily: "'Comic Sans MS', cursive" }}
            >
              ✨ VAPORWAVE DREAMS ✨ Crafted with nostalgia ✨ 1995-2026 ✨
            </p>
            <p className="text-[#01cdfe] text-xs mt-2" style={{ fontFamily: "'Courier New', monospace" }}>
              &gt;&gt;&gt; Best viewed in Netscape Navigator 2.0
            </p>
          </div>
        </footer>
      </div>

      {/* Inline styles for vaporwave effects */}
      <style>{`
        /* Animated gradient background */
        .vaporwave-gradient {
          background: linear-gradient(180deg, #ff71ce 0%, #b967ff 50%, #01cdfe 100%);
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }

        @keyframes gradient {
          0% { background-position: 0% 0%; }
          50% { background-position: 0% 100%; }
          100% { background-position: 0% 0%; }
        }

        /* Scan lines */
        .scan-lines {
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          );
          animation: scan 8s linear infinite;
        }

        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(10px); }
        }

        /* VHS glitch effect */
        .vhs-glitch {
          background: transparent;
          animation: vhs-glitch 3s infinite;
        }

        @keyframes vhs-glitch {
          0%, 90%, 100% { opacity: 0; }
          92%, 94%, 96% {
            opacity: 1;
            background: repeating-linear-gradient(
              90deg,
              rgba(255, 113, 206, 0.1) 0px,
              rgba(1, 205, 254, 0.1) 2px,
              rgba(185, 103, 255, 0.1) 4px
            );
            transform: translateX(2px);
          }
        }

        /* RGB Chromatic aberration */
        .chromatic-text {
          text-shadow: 2px 0 #ff71ce, -2px 0 #01cdfe;
          animation: chromatic-shift 2s ease-in-out infinite;
        }

        .chromatic-text-pink {
          text-shadow: 2px 0 #ff71ce, -2px 0 #01cdfe;
        }

        .chromatic-text-cyan {
          text-shadow: 2px 0 #01cdfe, -2px 0 #b967ff;
        }

        .chromatic-text-purple {
          text-shadow: 2px 0 #b967ff, -2px 0 #05ffa1;
        }

        @keyframes chromatic-shift {
          0%, 100% { text-shadow: 2px 0 #ff71ce, -2px 0 #01cdfe; }
          50% { text-shadow: -2px 0 #ff71ce, 2px 0 #01cdfe; }
        }

        /* Windows 95 window chrome */
        .win95-window {
          background: #c0c0c0;
          border: 2px solid;
          border-color: #ffffff #000000 #000000 #ffffff;
          box-shadow:
            inset 1px 1px 0 #dfdfdf,
            inset -1px -1px 0 #808080,
            2px 2px 0 rgba(0,0,0,0.2);
        }

        .win95-titlebar {
          background: linear-gradient(90deg, #000080, #1084d0);
          padding: 3px 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
        }

        .win95-content {
          padding: 16px;
          background: #c0c0c0;
          color: #000;
        }

        .win95-button {
          width: 16px;
          height: 16px;
          border: 1px solid;
          border-color: #ffffff #000000 #000000 #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          cursor: pointer;
        }

        .win95-button:active {
          border-color: #000000 #ffffff #ffffff #000000;
        }

        .win95-input,
        .win95-select {
          background: white;
          border: 2px solid;
          border-color: #808080 #ffffff #ffffff #808080;
          padding: 4px 8px;
          color: #000;
          outline: none;
        }

        .win95-input:focus,
        .win95-select:focus {
          border-color: #000080 #ffffff #ffffff #000080;
        }

        /* Vaporwave glows */
        .vaporwave-glow-pink {
          box-shadow: 0 0 10px #ff71ce, 0 0 20px #ff71ce;
        }

        .vaporwave-glow-cyan {
          box-shadow: 0 0 10px #01cdfe, 0 0 20px #01cdfe;
        }

        .vaporwave-glow-purple {
          box-shadow: 0 0 10px #b967ff, 0 0 20px #b967ff;
        }

        .vaporwave-glow-mint {
          box-shadow: 0 0 10px #05ffa1, 0 0 20px #05ffa1;
        }

        /* Ensure text contrast on gradient */
        .magazine * {
          text-rendering: optimizeLegibility;
        }
      `}</style>
    </div>
  );
}

export default Magazine;
