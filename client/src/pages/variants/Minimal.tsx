/**
 * Minimal.tsx - BRUTALIST CONCRETE design variant
 *
 * Aesthetic: Raw concrete, harsh angles, utilitarian forms
 * Theme: Intentional "ugliness" through brutal honesty
 * Typography: Courier New monospace ONLY, no font variation
 * Layout: Harsh grid with visible lines, NO rounded corners
 * Effects: Concrete texture (noise), embossed stamps, thick borders
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
        return '#f5f5f5';
      case 'negative':
        return '#ff0000';
      case 'neutral':
        return '#808080';
      default:
        return '#808080';
    }
  };

  const getSentimentBg = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return '#1a1a1a';
      case 'negative':
        return '#1a1a1a';
      case 'neutral':
        return '#1a1a1a';
      default:
        return '#1a1a1a';
    }
  };

  // Concrete texture background style
  const concreteTexture = {
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(128, 128, 128, 0.03) 2px,
        rgba(128, 128, 128, 0.03) 4px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        rgba(128, 128, 128, 0.03) 2px,
        rgba(128, 128, 128, 0.03) 4px
      ),
      linear-gradient(
        180deg,
        #808080 0%,
        #6b6b6b 100%
      )
    `,
  };

  return (
    <div
      className={`brutalist-minimal min-h-screen text-white ${className || ''}`}
      style={{
        fontFamily: '"Courier New", Courier, monospace',
        backgroundColor: '#808080',
        ...concreteTexture,
      }}
    >
      {/* Header - CONCRETE SLAB */}
      <header
        style={{
          borderBottom: '2px solid #1a1a1a',
          backgroundColor: '#808080',
          boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.8)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'start', gap: '24px' }}>
            <div>
              <h1
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#1a1a1a',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                BLUESKY FIREHOSE
              </h1>
              <p
                style={{
                  fontSize: '14px',
                  color: '#1a1a1a',
                  marginTop: '8px',
                  letterSpacing: '1px',
                }}
              >
                REAL-TIME SOCIAL STREAM
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '2px solid #1a1a1a',
                padding: '8px 16px',
                backgroundColor: connected ? '#1a1a1a' : '#f5f5f5',
              }}
            >
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: connected ? '#ff0000' : '#808080',
                  border: '2px solid #1a1a1a',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  color: connected ? '#ff0000' : '#1a1a1a',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                }}
              >
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - CONCRETE FOUNDATION */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats Bar - STAMPED DATA */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2px',
            marginBottom: '32px',
            border: '2px solid #1a1a1a',
            backgroundColor: '#1a1a1a',
          }}
        >
          {[
            { label: 'TOTAL POSTS', value: (stats?.totalPosts || 0).toLocaleString() },
            { label: 'POSTS / MIN', value: Math.round(stats?.postsPerMinute || 0).toString() },
            { label: 'SHOWING', value: filteredPosts.length.toString() },
            { label: 'SENTIMENT', value: null },
          ].map((stat, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: '#808080',
                padding: '16px',
                border: '2px solid #1a1a1a',
                boxShadow: 'inset 2px 2px 4px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: '#1a1a1a',
                  letterSpacing: '1px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                {stat.label}
              </div>
              {stat.value !== null ? (
                <div
                  style={{
                    fontSize: '28px',
                    color: '#1a1a1a',
                    fontWeight: 'bold',
                  }}
                >
                  {stat.value}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  {[
                    { color: '#f5f5f5', count: stats?.sentimentCounts?.positive || 0 },
                    { color: '#808080', count: stats?.sentimentCounts?.neutral || 0 },
                    { color: '#ff0000', count: stats?.sentimentCounts?.negative || 0 },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: s.color,
                          border: '2px solid #1a1a1a',
                        }}
                      />
                      <span style={{ fontSize: '14px', color: '#1a1a1a', fontWeight: 'bold' }}>
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Filter Controls - BRUTAL FIELDSET */}
        <fieldset
          style={{
            border: '2px solid #1a1a1a',
            padding: '24px',
            marginBottom: '32px',
            backgroundColor: '#6b6b6b',
          }}
        >
          <legend
            style={{
              fontSize: '12px',
              color: '#1a1a1a',
              letterSpacing: '2px',
              fontWeight: 'bold',
              padding: '0 8px',
              backgroundColor: '#808080',
              border: '2px solid #1a1a1a',
            }}
          >
            FILTERS
          </legend>
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
                  fontSize: '10px',
                  color: '#1a1a1a',
                  letterSpacing: '1px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                LANGUAGE
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #1a1a1a',
                  color: '#f5f5f5',
                  fontSize: '14px',
                  fontFamily: '"Courier New", Courier, monospace',
                  cursor: 'pointer',
                }}
              >
                <option value="all">ALL LANGUAGES</option>
                <option value="en">ENGLISH</option>
                <option value="es">SPANISH</option>
                <option value="fr">FRENCH</option>
                <option value="de">GERMAN</option>
                <option value="ja">JAPANESE</option>
                <option value="pt">PORTUGUESE</option>
              </select>
            </div>

            {/* Keyword Filter */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color: '#1a1a1a',
                  letterSpacing: '1px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                KEYWORD
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="FILTER BY KEYWORD..."
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  border: '2px solid #1a1a1a',
                  color: '#f5f5f5',
                  fontSize: '14px',
                  fontFamily: '"Courier New", Courier, monospace',
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
                  fontSize: '10px',
                  color: '#1a1a1a',
                  letterSpacing: '1px',
                  fontWeight: 'bold',
                  marginTop: '24px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={hideNSFW}
                  onChange={(e) => setHideNSFW(e.target.checked)}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                  }}
                />
                HIDE NSFW
              </label>
            </div>
          </div>
        </fieldset>

        {/* Data Visualization Cards - COLLAPSIBLE CONCRETE BLOCKS */}
        <fieldset
          style={{
            border: '2px solid #1a1a1a',
            padding: '24px',
            marginBottom: '32px',
            backgroundColor: '#6b6b6b',
          }}
        >
          <legend
            style={{
              fontSize: '12px',
              color: '#1a1a1a',
              letterSpacing: '2px',
              fontWeight: 'bold',
              padding: '0 8px',
              backgroundColor: '#808080',
              border: '2px solid #1a1a1a',
            }}
          >
            ANALYTICS
          </legend>

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
              { label: 'SENTIMENT DIST', state: showSentimentDist, setState: setShowSentimentDist },
              { label: 'SENTIMENT TIME', state: showSentimentTimeline, setState: setShowSentimentTimeline },
              { label: 'POST RATE', state: showPostRate, setState: setShowPostRate },
              { label: 'LANGUAGES', state: showLanguages, setState: setShowLanguages },
              { label: 'CONTENT TYPES', state: showContentTypes, setState: setShowContentTypes },
            ].map((toggle, idx) => (
              <button
                key={idx}
                onClick={() => toggle.setState(!toggle.state)}
                style={{
                  padding: '12px',
                  backgroundColor: toggle.state ? '#1a1a1a' : '#808080',
                  border: '2px solid #1a1a1a',
                  color: toggle.state ? '#ff0000' : '#1a1a1a',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  fontFamily: '"Courier New", Courier, monospace',
                  transition: 'none',
                }}
              >
                {toggle.state ? '▼' : '▶'} {toggle.label}
              </button>
            ))}
          </div>

          {/* Card Wall - Only show enabled cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {showSentimentDist && (
              <div style={{ border: '2px solid #1a1a1a', backgroundColor: '#1a1a1a', boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.6)' }}>
                <SentimentDistributionCard
                  sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
                />
              </div>
            )}
            {showSentimentTimeline && (
              <div style={{ border: '2px solid #1a1a1a', backgroundColor: '#1a1a1a', boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.6)' }}>
                <SentimentTimelineCard data={sentimentTimeline} />
              </div>
            )}
            {showPostRate && (
              <div style={{ border: '2px solid #1a1a1a', backgroundColor: '#1a1a1a', boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.6)' }}>
                <PostsPerMinuteCard
                  timelineData={postsPerMinuteTimeline}
                  currentRate={stats?.postsPerMinute || 0}
                />
              </div>
            )}
            {showLanguages && (
              <div style={{ border: '2px solid #1a1a1a', backgroundColor: '#1a1a1a', boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.6)' }}>
                <LanguagesCard languageCounts={languageCounts} />
              </div>
            )}
            {showContentTypes && (
              <div style={{ border: '2px solid #1a1a1a', backgroundColor: '#1a1a1a', boxShadow: '4px 4px 0 rgba(0, 0, 0, 0.6)' }}>
                <ContentTypesCard contentTypeCounts={contentTypeCounts} />
              </div>
            )}
          </div>
        </fieldset>

        {/* Posts Feed - STAMPED CONCRETE POSTS */}
        <div style={{ display: 'grid', gap: '2px', backgroundColor: '#1a1a1a' }}>
          {filteredPosts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '64px 24px',
                backgroundColor: '#808080',
                border: '2px solid #1a1a1a',
              }}
            >
              <p
                style={{
                  color: '#1a1a1a',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  letterSpacing: '2px',
                }}
              >
                NO POSTS MATCH YOUR FILTERS
              </p>
            </div>
          ) : (
            filteredPosts.map((post, index) => (
              <article
                key={post.uri || index}
                style={{
                  backgroundColor: getSentimentBg(post.sentiment),
                  border: '2px solid #1a1a1a',
                  padding: '24px',
                  boxShadow: 'inset 2px 2px 4px rgba(0, 0, 0, 0.4)',
                }}
              >
                {/* Post Header - STAMPED */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '16px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid ' + getSentimentColor(post.sentiment),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: getSentimentColor(post.sentiment),
                        letterSpacing: '1px',
                      }}
                    >
                      @{post.author?.handle || 'ANONYMOUS'}
                    </span>
                    {post.language && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#808080',
                          letterSpacing: '1px',
                          border: '1px solid #808080',
                          padding: '2px 6px',
                        }}
                      >
                        {post.language.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <time
                    style={{
                      fontSize: '10px',
                      color: '#808080',
                      letterSpacing: '1px',
                    }}
                  >
                    {new Date(post.createdAt).toLocaleTimeString()}
                  </time>
                </div>

                {/* Post Content */}
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: getSentimentColor(post.sentiment),
                    marginBottom: '16px',
                    wordBreak: 'break-word',
                  }}
                >
                  {post.text}
                </p>

                {/* Media */}
                {(post.images || post.videos) && (
                  <div style={{ marginBottom: '16px', border: '2px solid #808080' }}>
                    <MediaDisplay
                      images={post.images}
                      videos={post.videos}
                      variant="standard"
                      sensitive={post.sensitive}
                    />
                  </div>
                )}

                {/* Post Meta - EMBOSSED STAMPS */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '10px',
                  }}
                >
                  {post.hasImages && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#808080',
                        padding: '4px 8px',
                        border: '1px solid #1a1a1a',
                        letterSpacing: '1px',
                      }}
                    >
                      IMAGE
                    </span>
                  )}
                  {post.hasVideo && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#808080',
                        padding: '4px 8px',
                        border: '1px solid #1a1a1a',
                        letterSpacing: '1px',
                      }}
                    >
                      VIDEO
                    </span>
                  )}
                  {post.hasLink && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#808080',
                        padding: '4px 8px',
                        border: '1px solid #1a1a1a',
                        letterSpacing: '1px',
                      }}
                    >
                      LINK
                    </span>
                  )}
                  {post.isReply && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#808080',
                        padding: '4px 8px',
                        border: '1px solid #1a1a1a',
                        letterSpacing: '1px',
                      }}
                    >
                      REPLY
                    </span>
                  )}
                  {post.isQuote && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#808080',
                        padding: '4px 8px',
                        border: '1px solid #1a1a1a',
                        letterSpacing: '1px',
                      }}
                    >
                      QUOTE
                    </span>
                  )}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#808080',
                        padding: '4px 8px',
                        border: '1px solid #1a1a1a',
                        letterSpacing: '1px',
                      }}
                    >
                      {post.hashtags.length} HASHTAG{post.hashtags.length !== 1 ? 'S' : ''}
                    </span>
                  )}
                  {post.images?.some(img => !img.alt) && (
                    <span
                      style={{
                        color: '#1a1a1a',
                        backgroundColor: '#ff0000',
                        padding: '4px 8px',
                        border: '2px solid #1a1a1a',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                      }}
                    >
                      ⚠ NO ALT TEXT
                    </span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {/* Footer - FOUNDATION STAMP */}
      <footer
        style={{
          borderTop: '2px solid #1a1a1a',
          marginTop: '64px',
          backgroundColor: '#1a1a1a',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
          <p
            style={{
              fontSize: '10px',
              color: '#808080',
              textAlign: 'center',
              fontWeight: 'bold',
              letterSpacing: '3px',
            }}
          >
            BRUTALIST CONCRETE DESIGN
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Minimal;
