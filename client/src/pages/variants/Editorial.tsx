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

        {/* Filter Controls - Newspaper style */}
        <div style={{
          background: '#fafafa',
          borderBottom: '2px solid #000',
          padding: '20px 24px',
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
          }}>
            {/* Language Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '8px',
                color: '#666',
              }} className="editorial-sans">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d0d0d0',
                  background: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1a1a1a',
                }}
                className="editorial-sans"
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
              <label style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '8px',
                color: '#666',
              }} className="editorial-sans">
                Search Keywords
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Filter by keyword..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d0d0d0',
                  background: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1a1a1a',
                }}
                className="editorial-sans"
              />
            </div>
          </div>
        </div>

        {/* Data Analytics Section */}
        <section style={{
          background: '#fff',
          borderBottom: '3px solid #000',
          padding: '32px 24px',
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{
                fontSize: '36px',
                fontWeight: 700,
                marginBottom: '8px',
                color: '#000',
              }} className="editorial-serif">
                Statistical Overview
              </h2>
              <div className="editorial-rule" style={{ width: '100px', margin: '12px auto', background: '#8B0000', height: '2px' }} />
              <p style={{
                fontSize: '13px',
                color: '#666',
                fontStyle: 'italic',
                maxWidth: '600px',
                margin: '0 auto',
              }} className="editorial-serif">
                Real-time analytics and metrics from the Bluesky network
              </p>
            </div>
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

        {/* Main content area - Newspaper layout */}
        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 24px' }}>
          {/* Lead story - Above the fold */}
          {filteredPosts.length > 0 && (
            <article
              className="editorial-card"
              style={{
                marginBottom: '40px',
                paddingBottom: '32px',
                borderBottom: '3px solid #000',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedPost(filteredPosts[0])}
            >
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: '#8B0000',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px',
                color: '#fff',
              }} className="editorial-sans">
                {getSentimentLabel(filteredPosts[0].sentiment)}
              </div>
              <h2 style={{
                fontSize: '48px',
                fontWeight: 700,
                lineHeight: '1.1',
                marginBottom: '16px',
                color: '#000',
              }} className="editorial-serif">
                {filteredPosts[0].text.length > 120 ? `${filteredPosts[0].text.slice(0, 120)}...` : filteredPosts[0].text}
              </h2>
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '8px',
                fontWeight: 500,
              }} className="editorial-sans">
                By <span style={{ fontWeight: 700, color: '#000' }}>@{filteredPosts[0].author?.handle || 'Anonymous'}</span> • {formatTime(filteredPosts[0].createdAt)}
              </div>
              {filteredPosts[0].language && (
                <div style={{
                  fontSize: '11px',
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }} className="editorial-sans">
                  {filteredPosts[0].language}
                </div>
              )}
            </article>
          )}

          {/* Three-column layout - Classic newspaper columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '32px',
            marginBottom: '40px',
          }}>
            {filteredPosts.slice(1, 10).map((post, index) => (
              <article
                key={post.uri || index}
                className="editorial-card"
                style={{
                  paddingBottom: '20px',
                  borderBottom: '1px solid #d0d0d0',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedPost(post)}
              >
                <div style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  background: post.sentiment === 'positive' ? '#2d6a2d' : post.sentiment === 'negative' ? '#8B0000' : '#666',
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                  color: '#fff',
                }} className="editorial-sans">
                  {getSentimentLabel(post.sentiment)}
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  lineHeight: '1.3',
                  marginBottom: '10px',
                  color: '#000',
                }} className="editorial-serif">
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
                  fontSize: '11px',
                  color: '#999',
                  fontWeight: 500,
                }} className="editorial-sans">
                  @{post.author?.handle || 'Anonymous'} • {formatTime(post.createdAt)}
                  {post.images?.some(img => !img.alt) && (
                    <span style={{ color: '#8B0000', marginLeft: '8px', fontWeight: 600 }}>⚠ No alt text</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Archive section - Compact list */}
          <div style={{ borderTop: '2px solid #000', paddingTop: '32px' }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              color: '#000',
            }} className="editorial-serif">
              Earlier Today
            </h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {filteredPosts.slice(10, 30).map((post, index) => (
                <div
                  key={post.uri || index}
                  className="editorial-card"
                  style={{
                    display: 'flex',
                    gap: '16px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #e0e0e0',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedPost(post)}
                >
                  <div style={{
                    width: '4px',
                    background: post.sentiment === 'positive' ? '#2d6a2d' : post.sentiment === 'negative' ? '#8B0000' : '#666',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      lineHeight: '1.4',
                      marginBottom: '6px',
                      color: '#000',
                    }} className="editorial-serif">
                      {post.text.length > 100 ? `${post.text.slice(0, 100)}...` : post.text}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#999',
                      fontWeight: 500,
                    }} className="editorial-sans">
                      @{post.author?.handle || 'Anonymous'} • {formatTime(post.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '4px solid #000',
          background: '#f5f5f5',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#000' }} className="editorial-serif">
              The Bluesky Times
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }} className="editorial-sans">
              All content sourced from the AT Protocol network
            </div>
            <div style={{ fontSize: '10px', color: '#999', marginTop: '12px' }} className="editorial-sans">
              Real-time editorial coverage • Established 2025
            </div>
          </div>
        </footer>

        {/* Modal for selected post */}
        {selectedPost && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              zIndex: 1000,
            }}
            onClick={() => setSelectedPost(null)}
          >
            <div
              style={{
                background: '#fff',
                maxWidth: '700px',
                width: '100%',
                padding: '48px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                border: '2px solid #000',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '20px',
                color: '#666',
              }} className="editorial-sans">
                {getSentimentLabel(selectedPost.sentiment)} • {formatDate(selectedPost.createdAt)}
              </div>
              <h2 style={{
                fontSize: '32px',
                fontWeight: 700,
                lineHeight: '1.2',
                marginBottom: '20px',
                color: '#000',
              }} className="editorial-serif">
                {selectedPost.text}
              </h2>
              <div className="editorial-rule" />
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '24px',
                fontWeight: 500,
              }} className="editorial-sans">
                By <span style={{ fontWeight: 700, color: '#000' }}>@{selectedPost.author?.handle || 'Anonymous'}</span> • {formatTime(selectedPost.createdAt)}
              </div>
              {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e0e0e0' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#666',
                    marginBottom: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }} className="editorial-sans">
                    Topics
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedPost.hashtags.map(tag => (
                      <span key={tag} style={{
                        padding: '4px 12px',
                        background: '#f5f5f5',
                        fontSize: '12px',
                        color: '#666',
                        border: '1px solid #d0d0d0',
                        fontWeight: 500,
                      }} className="editorial-sans">
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
                  background: '#8B0000',
                  color: '#fff',
                  border: 'none',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'background 0.2s ease',
                }}
                className="editorial-sans"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#6d0000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#8B0000';
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
