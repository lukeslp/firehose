import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';
import { CardWall } from '@/components/CardWall';
import { SentimentDistributionCard } from '@/components/cards/SentimentDistributionCard';
import { SentimentTimelineCard } from '@/components/cards/SentimentTimelineCard';
import { PostsPerMinuteCard } from '@/components/cards/PostsPerMinuteCard';
import { LanguagesCard } from '@/components/cards/LanguagesCard';
import { ContentTypesCard } from '@/components/cards/ContentTypesCard';

export default function Editorial({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FirehosePost | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Track post timestamps for rate calculation (rolling window)
  const [postTimestamps, setPostTimestamps] = useState<Array<{
    timestamp: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>>([]);

  // Sampled timeline data
  const [sentimentTimeline, setSentimentTimeline] = useState<Array<{
    timestamp: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  }>>([]);

  // Posts per minute rate timeline
  const [postsPerMinuteTimeline, setPostsPerMinuteTimeline] = useState<Array<{
    timestamp: number;
    rate: number;
  }>>([]);

  // Real-time language tracking
  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});

  // Real-time content type tracking
  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });

  const toggleCard = (cardId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Add new posts to feed and track metrics
  useEffect(() => {
    if (!latestPost) return;

    // Add to feed
    setPosts(prev => [latestPost as FirehosePost, ...prev].slice(0, 100));

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'Opinion';
      case 'negative': return 'Analysis';
      default: return 'News';
    }
  };

  // Filter posts
  const filteredPosts = React.useMemo(() => {
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

  return (
    <>
      {/* Google Fonts - Professional Newspaper Typography */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        .editorial-serif {
          font-family: 'Libre Baskerville', serif;
        }
        .editorial-sans {
          font-family: 'Libre Franklin', sans-serif;
        }
        .editorial-rule {
          height: 1px;
          background: #d0d0d0;
          margin: 16px 0;
        }
        .editorial-double-rule {
          border-top: 3px double #000;
          margin: 24px 0;
        }
        .editorial-section-rule {
          height: 2px;
          background: #8B0000;
          margin: 32px 0;
        }
        .editorial-card:hover {
          background: #f9f9f9;
          transition: background 0.2s ease;
        }
        .editorial-link {
          color: #8B0000;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-bottom 0.2s ease;
        }
        .editorial-link:hover {
          border-bottom: 1px solid #8B0000;
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#fff',
        fontFamily: "'Libre Franklin', sans-serif",
        color: '#1a1a1a',
      }}>
        {/* Header - Newspaper Masthead */}
        <header style={{
          borderBottom: '4px solid #000',
          padding: '32px 24px 16px',
          background: '#fff',
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Top bar with date and navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#666',
              }} className="editorial-sans">
                {formatDate(new Date().toISOString())}
              </div>
              <Link href="/variants">
                <a className="editorial-link" style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  ← All Editions
                </a>
              </Link>
            </div>

            {/* Main masthead */}
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <h1 style={{
                fontSize: '72px',
                fontWeight: 700,
                margin: '0',
                letterSpacing: '-2px',
                lineHeight: '1',
              }} className="editorial-serif">
                The Bluesky Times
              </h1>
              <div style={{
                fontSize: '11px',
                fontWeight: 400,
                fontStyle: 'italic',
                marginTop: '8px',
                color: '#666',
              }} className="editorial-serif">
                "All the Posts Fit to Stream"
              </div>
            </div>

            {/* Edition info bar */}
            <div style={{
              textAlign: 'center',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              borderTop: '1px solid #000',
              borderBottom: '3px double #000',
              padding: '6px 0',
              margin: '16px 0 0',
              letterSpacing: '1.5px',
              display: 'flex',
              justifyContent: 'center',
              gap: '32px',
            }} className="editorial-sans">
              <span>Real-Time Edition</span>
              <span style={{ color: '#8B0000' }}>•</span>
              <span>Live Coverage</span>
              <span style={{ color: '#8B0000' }}>•</span>
              <span>{connected ? 'Connected' : 'Offline'}</span>
            </div>
          </div>
        </header>

        {/* Stats Bar - Newspaper style */}
        <div style={{
          background: '#f5f5f5',
          borderBottom: '1px solid #d0d0d0',
          padding: '12px 24px',
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'flex',
            gap: '48px',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }} className="editorial-sans">
            <div>
              <span style={{ color: '#666' }}>Total: </span>
              <span style={{ fontWeight: 700, color: '#000' }}>{(stats?.totalPosts || 0).toLocaleString()}</span>
            </div>
            <div style={{ color: '#d0d0d0' }}>|</div>
            <div>
              <span style={{ color: '#666' }}>Filtered: </span>
              <span style={{ fontWeight: 700, color: '#000' }}>{filteredPosts.length}</span>
            </div>
            <div style={{ color: '#d0d0d0' }}>|</div>
            <div>
              <span style={{ color: '#666' }}>Rate: </span>
              <span style={{ fontWeight: 700, color: '#8B0000' }}>{Math.round(stats?.postsPerMinute || 0)}/min</span>
            </div>
            <div style={{ color: '#d0d0d0' }}>|</div>
            <div>
              <span style={{ color: '#666' }}>Status: </span>
              <span style={{ fontWeight: 700, color: connected ? '#2d6a2d' : '#8B0000' }}>
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls - Cyberpunk Interface */}
        <div style={{
          background: 'rgba(26, 10, 46, 0.6)',
          borderBottom: '1px solid #7b2cbf',
          padding: '24px',
          backdropFilter: 'blur(5px)',
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
          }}>
            {/* Language Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px',
                color: '#ff0080',
              }} className="neon-text">
                LANGUAGE
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #00d9ff',
                  background: 'rgba(10, 14, 26, 0.9)',
                  fontSize: '13px',
                  fontFamily: "'Share Tech Mono', monospace",
                  color: '#00d9ff',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 10px rgba(0, 217, 255, 0.3)',
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
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px',
                color: '#ff0080',
              }} className="neon-text">
                SEARCH_KEYWORDS
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="FILTER BY KEYWORD..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #00d9ff',
                  background: 'rgba(10, 14, 26, 0.9)',
                  fontSize: '13px',
                  fontFamily: "'Share Tech Mono', monospace",
                  color: '#00d9ff',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 10px rgba(0, 217, 255, 0.3)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Data Analytics Section - Neon Grid */}
        <section style={{
          background: 'rgba(10, 14, 26, 0.7)',
          borderBottom: '3px solid #ff0080',
          padding: '32px 24px',
          boxShadow: '0 0 40px rgba(255, 0, 128, 0.2)',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Japanese decoration */}
            <div style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#7b2cbf',
              opacity: 0.5,
              marginBottom: '8px',
            }}>
              データ分析
            </div>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 900,
              fontFamily: "'Orbitron', sans-serif",
              marginBottom: '8px',
              textAlign: 'center',
              borderBottom: '2px solid #ff0080',
              paddingBottom: '12px',
              color: '#ff0080',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }} className="neon-text">
              DATA_BUREAU
            </h2>
            <p style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#00d9ff',
              fontFamily: "'Share Tech Mono', monospace",
              textTransform: 'uppercase',
              marginBottom: '32px',
              letterSpacing: '0.05em',
            }} className="neon-cyan">
              LIVE STATISTICAL ANALYSIS FROM THE NEURAL STREAM
            </p>
            <CardWall>
              <SentimentDistributionCard
                sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
              />
              <SentimentTimelineCard
                data={sentimentTimeline}
              />
              <PostsPerMinuteCard
                data={postsPerMinuteTimeline}
                currentRate={stats?.postsPerMinute || 0}
              />
              <LanguagesCard
                languageCounts={languageCounts}
              />
              <ContentTypesCard
                contentTypeCounts={contentTypeCounts}
              />
            </CardWall>
          </div>
        </section>

        {/* Main content area - Holographic cards */}
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
          {/* Lead story - Large holographic card */}
          {filteredPosts.length > 0 && (
            <article
              className="holographic-card perspective-card"
              style={{
                marginBottom: '48px',
                paddingBottom: '32px',
                borderBottom: '2px solid #ff0080',
                padding: '24px',
                background: 'rgba(10, 14, 26, 0.8)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px rgba(255, 0, 128, 0.3)',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => setSelectedPost(filteredPosts[0])}
            >
              {/* Japanese decoration */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                fontSize: '10px',
                color: '#7b2cbf',
                opacity: 0.4,
              }}>
                {getRandomJapanese()}
              </div>

              <div style={{
                display: 'inline-block',
                padding: '4px 16px',
                background: filteredPosts[0].sentiment === 'positive' ? 'rgba(0, 255, 0, 0.2)' : filteredPosts[0].sentiment === 'negative' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 217, 255, 0.2)',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '16px',
                color: filteredPosts[0].sentiment === 'positive' ? '#00ff00' : filteredPosts[0].sentiment === 'negative' ? '#ff0000' : '#00d9ff',
                border: `1px solid ${filteredPosts[0].sentiment === 'positive' ? '#00ff00' : filteredPosts[0].sentiment === 'negative' ? '#ff0000' : '#00d9ff'}`,
                boxShadow: `0 0 10px ${filteredPosts[0].sentiment === 'positive' ? 'rgba(0, 255, 0, 0.3)' : filteredPosts[0].sentiment === 'negative' ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 217, 255, 0.3)'}`,
              }}>
                {getSentimentLabel(filteredPosts[0].sentiment)} • JUST_NOW
              </div>
              <h2 style={{
                fontSize: '42px',
                fontWeight: 900,
                fontFamily: "'Orbitron', sans-serif",
                lineHeight: '1.2',
                marginBottom: '16px',
                color: '#ff0080',
                textTransform: 'uppercase',
              }} className="neon-text">
                {filteredPosts[0].text.length > 120 ? `${filteredPosts[0].text.slice(0, 120)}...` : filteredPosts[0].text}
              </h2>
              <div style={{
                fontSize: '14px',
                color: '#00d9ff',
                fontFamily: "'Share Tech Mono', monospace",
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}>
                BY <span style={{ fontWeight: 700, color: '#ffff00' }} className="neon-yellow">@{filteredPosts[0].author?.handle || 'ANONYMOUS'}</span> • {formatTime(filteredPosts[0].createdAt)}
              </div>
              {filteredPosts[0].language && (
                <div style={{
                  fontSize: '12px',
                  color: '#7b2cbf',
                  fontFamily: "'Share Tech Mono', monospace",
                  textTransform: 'uppercase',
                }}>
                  LANGUAGE: {filteredPosts[0].language.toUpperCase()}
                </div>
              )}
            </article>
          )}

          {/* Three-column layout - Holographic cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px',
            marginBottom: '48px',
          }}>
            {filteredPosts.slice(1, 10).map((post, index) => (
              <article
                key={post.uri || index}
                className="holographic-card perspective-card"
                style={{
                  paddingBottom: '24px',
                  borderBottom: '2px solid #00d9ff',
                  cursor: 'pointer',
                  padding: '20px',
                  background: 'rgba(10, 14, 26, 0.7)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 20px rgba(0, 217, 255, 0.2)',
                  position: 'relative',
                }}
                onClick={() => setSelectedPost(post)}
              >
                {/* Random Japanese decoration */}
                {index % 3 === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    fontSize: '8px',
                    color: '#7b2cbf',
                    opacity: 0.3,
                  }}>
                    {getRandomJapanese()}
                  </div>
                )}

                <div style={{
                  display: 'inline-block',
                  padding: '2px 12px',
                  background: post.sentiment === 'positive' ? 'rgba(0, 255, 0, 0.2)' : post.sentiment === 'negative' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 217, 255, 0.2)',
                  fontSize: '9px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '12px',
                  color: post.sentiment === 'positive' ? '#00ff00' : post.sentiment === 'negative' ? '#ff0000' : '#00d9ff',
                  border: `1px solid ${post.sentiment === 'positive' ? '#00ff00' : post.sentiment === 'negative' ? '#ff0000' : '#00d9ff'}`,
                }}>
                  {getSentimentLabel(post.sentiment)}
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  fontFamily: "'Orbitron', sans-serif",
                  lineHeight: '1.3',
                  marginBottom: '8px',
                  color: '#00d9ff',
                  textTransform: 'uppercase',
                }}>
                  {post.text.length > 80 ? `${post.text.slice(0, 80)}...` : post.text}
                </h3>
                {(post.images || post.videos) && (
                  <div style={{ marginBottom: '12px' }}>
                    <MediaDisplay
                      images={post.images}
                      videos={post.videos}
                      variant="standard"
                      sensitive={post.sensitive}
                    />
                  </div>
                )}
                <div style={{
                  fontSize: '12px',
                  color: '#7b2cbf',
                  fontFamily: "'Share Tech Mono', monospace",
                  textTransform: 'uppercase',
                }}>
                  @{post.author?.handle || 'ANONYMOUS'} • {formatTime(post.createdAt)}
                  {post.images?.some(img => !img.alt) && (
                    <span style={{ color: '#ff0000', marginLeft: '8px' }}>⚠ NO_ALT</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Archive section - Diagonal skew design */}
          <div style={{ borderTop: '2px solid #ff0080', paddingTop: '32px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 900,
              fontFamily: "'Orbitron', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '24px',
              color: '#ff0080',
            }} className="neon-text">
              EARLIER_TODAY
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {filteredPosts.slice(10, 30).map((post, index) => (
                <div
                  key={post.uri || index}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid #7b2cbf',
                    cursor: 'pointer',
                    padding: '16px',
                    background: 'rgba(10, 14, 26, 0.5)',
                    border: '1px solid #7b2cbf',
                    boxShadow: '0 2px 10px rgba(123, 44, 191, 0.2)',
                    transform: 'skewY(-1deg)',
                    transition: 'all 0.3s ease',
                  }}
                  onClick={() => setSelectedPost(post)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'skewY(0deg) translateX(8px)';
                    e.currentTarget.style.borderColor = '#00d9ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'skewY(-1deg)';
                    e.currentTarget.style.borderColor = '#7b2cbf';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      fontFamily: "'Share Tech Mono', monospace",
                      lineHeight: '1.4',
                      marginBottom: '4px',
                      color: '#00d9ff',
                      textTransform: 'uppercase',
                    }}>
                      {post.text.length > 100 ? `${post.text.slice(0, 100)}...` : post.text}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#7b2cbf',
                      fontFamily: "'Share Tech Mono', monospace",
                      textTransform: 'uppercase',
                    }}>
                      @{post.author?.handle || 'ANONYMOUS'} • {formatTime(post.createdAt)}
                    </div>
                  </div>
                  <div style={{
                    width: '4px',
                    background: post.sentiment === 'positive' ? '#00ff00' : post.sentiment === 'negative' ? '#ff0000' : '#00d9ff',
                    flexShrink: 0,
                    boxShadow: `0 0 10px ${post.sentiment === 'positive' ? 'rgba(0, 255, 0, 0.5)' : post.sentiment === 'negative' ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 217, 255, 0.5)'}`,
                  }} />
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '4px solid #ff0080',
          background: 'rgba(10, 14, 26, 0.95)',
          padding: '32px 24px',
          textAlign: 'center',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '12px',
          color: '#00d9ff',
          textTransform: 'uppercase',
          boxShadow: '0 -5px 30px rgba(255, 0, 128, 0.3)',
        }}>
          <div className="neon-text" style={{ color: '#ff0080', fontSize: '14px', marginBottom: '8px' }}>
            THE_BLUESKY_CHRONICLE
          </div>
          <div style={{ color: '#7b2cbf' }}>ALL CONTENT SOURCED FROM THE AT_PROTOCOL NETWORK</div>
          <div style={{ marginTop: '8px', color: '#00d9ff' }}>
            REAL-TIME EDITORIAL VARIANT • 東京_NIGHTS • BLADE_RUNNER_AESTHETIC
          </div>
        </footer>

        {/* Modal for selected post - Holographic display */}
        {selectedPost && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              zIndex: 1000,
              backdropFilter: 'blur(10px)',
            }}
            onClick={() => setSelectedPost(null)}
          >
            <div
              className="holographic-card"
              style={{
                background: 'rgba(10, 14, 26, 0.95)',
                maxWidth: '700px',
                width: '100%',
                padding: '48px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 0 60px rgba(255, 0, 128, 0.5)',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Japanese decoration */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                fontSize: '12px',
                color: '#7b2cbf',
                opacity: 0.5,
              }}>
                {getRandomJapanese()}
              </div>

              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '24px',
                color: '#ffff00',
              }} className="neon-yellow">
                {getSentimentLabel(selectedPost.sentiment)} • {formatDate(selectedPost.createdAt)}
              </div>
              <h2 style={{
                fontSize: '36px',
                fontWeight: 900,
                fontFamily: "'Orbitron', sans-serif",
                lineHeight: '1.2',
                marginBottom: '24px',
                color: '#ff0080',
                textTransform: 'uppercase',
              }} className="neon-text">
                {selectedPost.text}
              </h2>
              <div style={{
                fontSize: '14px',
                color: '#00d9ff',
                fontFamily: "'Share Tech Mono', monospace",
                marginBottom: '32px',
                textTransform: 'uppercase',
              }}>
                BY <span style={{ fontWeight: 700, color: '#ffff00' }}>@{selectedPost.author?.handle || 'ANONYMOUS'}</span> • {formatTime(selectedPost.createdAt)}
              </div>
              {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #7b2cbf' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#7b2cbf',
                    marginBottom: '8px',
                    fontFamily: "'Share Tech Mono', monospace",
                    textTransform: 'uppercase',
                  }}>
                    TOPICS:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedPost.hashtags.map(tag => (
                      <span key={tag} style={{
                        padding: '4px 12px',
                        background: 'rgba(0, 217, 255, 0.2)',
                        fontSize: '12px',
                        fontFamily: "'Share Tech Mono', monospace",
                        color: '#00d9ff',
                        border: '1px solid #00d9ff',
                        textTransform: 'uppercase',
                        boxShadow: '0 0 5px rgba(0, 217, 255, 0.3)',
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setSelectedPost(null)}
                style={{
                  marginTop: '32px',
                  padding: '12px 32px',
                  background: 'rgba(255, 0, 128, 0.2)',
                  color: '#ff0080',
                  border: '2px solid #ff0080',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 0 20px rgba(255, 0, 128, 0.4)',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 128, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 0, 128, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 128, 0.2)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 0, 128, 0.4)';
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
