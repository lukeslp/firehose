/**
 * Minimal.tsx - GLASSMORPHISM design variant
 *
 * Aesthetic: Frosted glass cards with soft transparency
 * Theme: Modern, professional, clean
 * Typography: Inter/system sans-serif, refined hierarchy
 * Layout: Gentle spacing, subtle rounded corners
 * Effects: Backdrop blur, soft shadows, layered depth
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

export function Minimal({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 20;

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  const [hideNSFW, setHideNSFW] = useState<boolean>(true);

  // Card visibility toggles
  const [showSentimentDist, setShowSentimentDist] = useState<boolean>(true);
  const [showSentimentTimeline, setShowSentimentTimeline] = useState<boolean>(true);
  const [showPostRate, setShowPostRate] = useState<boolean>(true);
  const [showLanguages, setShowLanguages] = useState<boolean>(true);
  const [showContentTypes, setShowContentTypes] = useState<boolean>(true);

  // Timeline data for visualization cards
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

  // Track post timestamps for rate calculation (rolling window)
  const [postTimestamps, setPostTimestamps] = useState<Array<{
    timestamp: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>>([]);

  // Real-time language and content type tracking
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});
  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });

  // Update posts feed and track analytics data
  useEffect(() => {
    if (!latestPost) return;

    // Update posts feed
    setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));

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
  }, [latestPost, maxPosts]);

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
      if (hideNSFW && post.sensitive) {
        return false;
      }
      return true;
    });
  }, [posts, selectedLanguage, keywordFilter, hideNSFW]);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'rgba(34, 197, 94, 0.8)'; // Green
      case 'negative':
        return 'rgba(239, 68, 68, 0.8)'; // Red
      case 'neutral':
        return 'rgba(156, 163, 175, 0.8)'; // Gray
      default:
        return 'rgba(156, 163, 175, 0.8)';
    }
  };

  const getSentimentBg = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'rgba(34, 197, 94, 0.05)';
      case 'negative':
        return 'rgba(239, 68, 68, 0.05)';
      case 'neutral':
        return 'rgba(156, 163, 175, 0.05)';
      default:
        return 'rgba(156, 163, 175, 0.05)';
    }
  };

  // Glassmorphism card style
  const glassCard = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div
      className={`glassmorphism-minimal min-h-screen ${className || ''}`}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Header - Frosted Glass */}
      <header
        style={{
          ...glassCard,
          position: 'sticky',
          top: '16px',
          margin: '16px',
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '24px' }}>
            <div>
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: '600',
                  color: 'rgba(31, 41, 55, 0.95)',
                  letterSpacing: '-0.025em',
                  margin: 0,
                }}
              >
                Bluesky Firehose
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(75, 85, 99, 0.8)',
                  marginTop: '4px',
                  fontWeight: '400',
                }}
              >
                Real-time social stream
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                background: connected
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(156, 163, 175, 0.15)',
                borderRadius: '12px',
                border: connected
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(156, 163, 175, 0.3)',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: connected ? '#22c55e' : '#9ca3af',
                  borderRadius: '50%',
                  boxShadow: connected
                    ? '0 0 8px rgba(34, 197, 94, 0.6)'
                    : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  color: connected
                    ? 'rgba(22, 163, 74, 0.9)'
                    : 'rgba(107, 114, 128, 0.9)',
                  fontWeight: '600',
                  letterSpacing: '0.025em',
                }}
              >
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 32px' }}>
        {/* Stats Bar - Glass Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {[
            { label: 'Total Posts', value: (stats?.totalPosts || 0).toLocaleString() },
            { label: 'Posts / Min', value: Math.round(stats?.postsPerMinute || 0).toString() },
            { label: 'Showing', value: filteredPosts.length.toString() },
            { label: 'Sentiment', value: null },
          ].map((stat, idx) => (
            <div
              key={idx}
              style={{
                ...glassCard,
                padding: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(107, 114, 128, 0.8)',
                  fontWeight: '500',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {stat.label}
              </div>
              {stat.value !== null ? (
                <div
                  style={{
                    fontSize: '32px',
                    color: 'rgba(31, 41, 55, 0.95)',
                    fontWeight: '600',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {stat.value}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  {[
                    { color: 'rgba(34, 197, 94, 0.8)', count: stats?.sentimentCounts?.positive || 0, label: 'Pos' },
                    { color: 'rgba(156, 163, 175, 0.8)', count: stats?.sentimentCounts?.neutral || 0, label: 'Neu' },
                    { color: 'rgba(239, 68, 68, 0.8)', count: stats?.sentimentCounts?.negative || 0, label: 'Neg' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          backgroundColor: s.color,
                          borderRadius: '50%',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                      <span style={{ fontSize: '14px', color: 'rgba(31, 41, 55, 0.9)', fontWeight: '600' }}>
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Filter Controls - Glassmorphic */}
        <div
          style={{
            ...glassCard,
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              color: 'rgba(75, 85, 99, 0.9)',
              fontWeight: '600',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Filters
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Language Filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'rgba(107, 114, 128, 0.8)',
                  fontWeight: '500',
                  marginBottom: '8px',
                }}
              >
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(209, 213, 219, 0.3)',
                  borderRadius: '8px',
                  color: 'rgba(31, 41, 55, 0.9)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
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

            {/* Keyword Filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'rgba(107, 114, 128, 0.8)',
                  fontWeight: '500',
                  marginBottom: '8px',
                }}
              >
                Keyword
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Filter by keyword..."
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(209, 213, 219, 0.3)',
                  borderRadius: '8px',
                  color: 'rgba(31, 41, 55, 0.9)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            {/* NSFW Filter */}
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '12px',
                  color: 'rgba(107, 114, 128, 0.8)',
                  fontWeight: '500',
                  marginTop: '28px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={hideNSFW}
                  onChange={(e) => setHideNSFW(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: 'rgba(124, 58, 237, 0.8)',
                  }}
                />
                Hide NSFW Content
              </label>
            </div>
          </div>
        </div>

        {/* Data Visualization Cards - Glassmorphic */}
        <div
          style={{
            ...glassCard,
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              color: 'rgba(75, 85, 99, 0.9)',
              fontWeight: '600',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Analytics
          </h2>

          {/* Toggle Controls */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '8px',
              marginBottom: '24px',
            }}
          >
            {[
              { label: 'Sentiment Distribution', state: showSentimentDist, setState: setShowSentimentDist },
              { label: 'Sentiment Timeline', state: showSentimentTimeline, setState: setShowSentimentTimeline },
              { label: 'Post Rate', state: showPostRate, setState: setShowPostRate },
              { label: 'Languages', state: showLanguages, setState: setShowLanguages },
              { label: 'Content Types', state: showContentTypes, setState: setShowContentTypes },
            ].map((toggle, idx) => (
              <button
                key={idx}
                onClick={() => toggle.setState(!toggle.state)}
                style={{
                  padding: '12px',
                  backgroundColor: toggle.state ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255, 255, 255, 0.4)',
                  border: '1px solid rgba(209, 213, 219, 0.3)',
                  borderRadius: '8px',
                  color: toggle.state ? 'rgba(124, 58, 237, 0.95)' : 'rgba(107, 114, 128, 0.8)',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {toggle.state ? '▼' : '▶'} {toggle.label}
              </button>
            ))}
          </div>

          {/* Card Wall - Only show enabled cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {showSentimentDist && (
              <div style={{ ...glassCard }}>
                <SentimentDistributionCard
                  sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
                />
              </div>
            )}
            {showSentimentTimeline && (
              <div style={{ ...glassCard }}>
                <SentimentTimelineCard data={sentimentTimeline} />
              </div>
            )}
            {showPostRate && (
              <div style={{ ...glassCard }}>
                <PostsPerMinuteCard
                  timelineData={postsPerMinuteTimeline}
                  currentRate={stats?.postsPerMinute || 0}
                />
              </div>
            )}
            {showLanguages && (
              <div style={{ ...glassCard }}>
                <LanguagesCard languageCounts={languageCounts} />
              </div>
            )}
            {showContentTypes && (
              <div style={{ ...glassCard }}>
                <ContentTypesCard contentTypeCounts={contentTypeCounts} />
              </div>
            )}
          </div>
        </div>

        {/* Posts Feed - Glassmorphic Cards */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredPosts.length === 0 ? (
            <div
              style={{
                ...glassCard,
                textAlign: 'center',
                padding: '64px 24px',
              }}
            >
              <p
                style={{
                  color: 'rgba(107, 114, 128, 0.8)',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                No posts match your filters
              </p>
            </div>
          ) : (
            filteredPosts.map((post, index) => (
              <article
                key={post.uri || index}
                style={{
                  ...glassCard,
                  padding: '24px',
                  borderLeft: `4px solid ${getSentimentColor(post.sentiment)}`,
                }}
              >
                {/* Post Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid rgba(209, 213, 219, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: 'rgba(31, 41, 55, 0.9)',
                      }}
                    >
                      @{post.author?.handle || 'Anonymous'}
                    </span>
                    {post.language && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'rgba(107, 114, 128, 0.7)',
                          backgroundColor: 'rgba(209, 213, 219, 0.2)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: '500',
                        }}
                      >
                        {post.language.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <time
                    style={{
                      fontSize: '12px',
                      color: 'rgba(107, 114, 128, 0.7)',
                      fontWeight: '400',
                    }}
                  >
                    {new Date(post.createdAt).toLocaleTimeString()}
                  </time>
                </div>

                {/* Post Content */}
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.65',
                    color: 'rgba(31, 41, 55, 0.85)',
                    marginBottom: '16px',
                    wordBreak: 'break-word',
                  }}
                >
                  {post.text}
                </p>

                {/* Media */}
                {(post.images || post.videos) && (
                  <div style={{
                    marginBottom: '16px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid rgba(209, 213, 219, 0.2)'
                  }}>
                    <MediaDisplay
                      images={post.images}
                      videos={post.videos}
                      variant="standard"
                      sensitive={post.sensitive}
                    />
                  </div>
                )}

                {/* Post Meta - Soft Pills */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '11px',
                  }}
                >
                  {post.hasImages && (
                    <span
                      style={{
                        color: 'rgba(59, 130, 246, 0.8)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '500',
                      }}
                    >
                      📷 Image
                    </span>
                  )}
                  {post.hasVideo && (
                    <span
                      style={{
                        color: 'rgba(139, 92, 246, 0.8)',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '500',
                      }}
                    >
                      🎬 Video
                    </span>
                  )}
                  {post.hasLink && (
                    <span
                      style={{
                        color: 'rgba(14, 165, 233, 0.8)',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '500',
                      }}
                    >
                      🔗 Link
                    </span>
                  )}
                  {post.isReply && (
                    <span
                      style={{
                        color: 'rgba(107, 114, 128, 0.8)',
                        backgroundColor: 'rgba(107, 114, 128, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '500',
                      }}
                    >
                      💬 Reply
                    </span>
                  )}
                  {post.isQuote && (
                    <span
                      style={{
                        color: 'rgba(107, 114, 128, 0.8)',
                        backgroundColor: 'rgba(107, 114, 128, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '500',
                      }}
                    >
                      🔄 Quote
                    </span>
                  )}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <span
                      style={{
                        color: 'rgba(16, 185, 129, 0.8)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '500',
                      }}
                    >
                      # {post.hashtags.length} tag{post.hashtags.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {post.images?.some(img => !img.alt) && (
                    <span
                      style={{
                        color: 'rgba(239, 68, 68, 0.9)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      ⚠ No alt text
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {/* Footer - Glassmorphic */}
      <footer
        style={{
          marginTop: '64px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 32px' }}>
          <div
            style={{
              ...glassCard,
              padding: '20px',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(107, 114, 128, 0.7)',
                textAlign: 'center',
                fontWeight: '400',
              }}
            >
              Glassmorphic Design
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Minimal;
