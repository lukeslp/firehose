import React, { useState, useEffect } from 'react';
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

export default function RetroArcade({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Timeline data tracking (matching Dashboard.tsx pattern)
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

  const [postsPerMinuteTimeline, setPostsPerMinuteTimeline] = useState<Array<{
    timestamp: number;
    rate: number;
  }>>([]);

  const [languageCounts, setLanguageCounts] = useState<Record<string, number>>({});

  const [contentTypeCounts, setContentTypeCounts] = useState({
    textOnly: 0,
    withImages: 0,
    withVideo: 0,
    withLinks: 0,
  });


  // Track timeline data (matching Dashboard.tsx pattern)
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

  // Sample rate every 1 second for timeline charts (matching Dashboard.tsx)
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

  // Add new posts with arcade effects
  useEffect(() => {
    if (latestPost) {
      const post = latestPost as FirehosePost;

      // Apply filters
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) return;
      if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) return;

      setPosts(prev => [post, ...prev].slice(0, 20));

      // Score system based on sentiment
      let points = 10;
      if (post.sentiment === 'positive') points = 50;
      else if (post.sentiment === 'negative') points = 25;

      setScore(prev => prev + (points * combo));
      setCombo(prev => Math.min(prev + 1, 99));
    }
  }, [latestPost, combo, selectedLanguage, keywordFilter]);

  // Game over when disconnected
  useEffect(() => {
    if (!connected && stats?.totalPosts && stats.totalPosts > 0) {
      setGameOver(true);
    } else if (connected) {
      setGameOver(false);
    }
  }, [connected, stats]);

  const formatScore = (num: number) => {
    return String(num).padStart(8, '0');
  };

  const getSentimentGeometry = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return '●'; // Circle
      case 'negative': return '■'; // Square
      default: return '▲'; // Triangle
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#ffffff',
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      {/* Modern Gradient Grid Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px',
        maxWidth: '1600px',
        margin: '0 auto',
      }}>
        {/* Header - Full Width with Glassmorphism */}
        <header style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '32px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          marginBottom: '20px',
        }}>
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: '8px',
              color: 'rgba(255, 255, 255, 0.8)',
            }}>
              Bluesky Firehose
            </div>
            <div style={{
              fontSize: '48px',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-2px',
              background: 'linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.8) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Data Stream
            </div>
          </div>
          <Link href="/variants">
            <a style={{
              padding: '16px 32px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
            }}>
              Exit
            </a>
          </Link>
        </header>

        {/* Metrics Grid - Gradient Cards */}
        <div style={{
          gridColumn: '1 / 8',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '20px',
        }}>
          {/* Score */}
          <div style={{
            padding: '28px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}>
              Score
            </div>
            <div style={{
              fontSize: '36px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}>
              {formatScore(score)}
            </div>
          </div>

          {/* Combo */}
          <div style={{
            padding: '28px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}>
              Combo
            </div>
            <div style={{
              fontSize: '36px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}>
              ×{combo}
            </div>
          </div>

          {/* Posts/Min - Vibrant Accent */}
          <div style={{
            padding: '28px',
            background: 'linear-gradient(135deg, #ff6b9d 0%, #c06c84 100%)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(255, 107, 157, 0.3)',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 107, 157, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 107, 157, 0.3)';
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              marginBottom: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Posts/Min
            </div>
            <div style={{
              fontSize: '36px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}>
              {Math.round(stats?.postsPerMinute || 0)}
            </div>
          </div>
        </div>

        {/* Status Box - Right Side with Dynamic Gradient */}
        <div style={{
          gridColumn: '8 / -1',
          padding: '32px',
          background: connected
            ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: `1px solid ${connected ? 'rgba(56, 239, 125, 0.3)' : 'rgba(255, 255, 255, 0.2)'}`,
          boxShadow: connected
            ? '0 8px 32px rgba(56, 239, 125, 0.3)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          marginBottom: '20px',
          transition: 'all 0.5s ease',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
          }}>
            Status
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '1px',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
          <div style={{
            marginTop: '16px',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? '#38ef7d' : 'rgba(255, 255, 255, 0.3)',
              boxShadow: connected ? '0 0 12px rgba(56, 239, 125, 0.8)' : 'none',
            }} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Game Over Overlay */}
        {gameOver && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(255, 255, 255, 0.98)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              width: '61.8%', // Golden ratio
              maxWidth: '800px',
              padding: '64px',
              border: '2px solid #000000',
              background: '#ffffff',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '72px',
                fontWeight: 700,
                marginBottom: '32px',
                letterSpacing: '-2px',
                color: '#000000',
              }}>
                SESSION END
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: 100,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: '24px',
                color: '#000000',
              }}>
                Connection Lost
              </div>
              <div style={{
                width: '200px',
                height: '2px',
                background: '#ff0000',
                margin: '0 auto 24px',
              }} />
              <div style={{
                fontSize: '16px',
                fontWeight: 400,
                marginBottom: '8px',
                color: '#000000',
              }}>
                Final Score
              </div>
              <div style={{
                fontSize: '56px',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: '#000000',
              }}>
                {formatScore(score)}
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls - Full Width */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          marginBottom: '16px',
        }}>
          {/* Language Filter */}
          <div style={{
            padding: '24px',
            border: '1px solid #000000',
            background: '#f5f5f5',
          }}>
            <label style={{
              fontSize: '10px',
              fontWeight: 100,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '16px',
              color: '#000000',
            }}>
              Language Filter
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '16px',
                background: '#ffffff',
                border: '1px solid #000000',
                color: '#000000',
                fontSize: '14px',
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontWeight: 400,
                borderRadius: 0,
                appearance: 'none',
                cursor: 'pointer',
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
          <div style={{
            padding: '24px',
            border: '1px solid #000000',
            background: '#f5f5f5',
          }}>
            <label style={{
              fontSize: '10px',
              fontWeight: 100,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '16px',
              color: '#000000',
            }}>
              Keyword Filter
            </label>
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="Search content..."
              style={{
                width: '100%',
                padding: '16px',
                background: '#ffffff',
                border: '1px solid #000000',
                color: '#000000',
                fontSize: '14px',
                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                fontWeight: 400,
                borderRadius: 0,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Data Visualization - Swiss Modernism */}
        <div style={{
          gridColumn: '1 / -1',
          border: '2px solid #000000',
          padding: '32px',
          marginBottom: '16px',
          background: '#ffffff',
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 100,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '32px',
            color: '#000000',
            paddingBottom: '16px',
            borderBottom: '1px solid #000000',
          }}>
            Analytics Dashboard
          </div>
          <CardWall className="swiss-cards">
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

        {/* Post Feed - Swiss Grid */}
        <div style={{
          gridColumn: '1 / -1',
          padding: '32px',
          border: '1px solid #000000',
          background: '#f5f5f5',
          minHeight: '400px',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 100,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '24px',
            color: '#000000',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '16px',
            borderBottom: '1px solid #000000',
          }}>
            <span>Data Stream</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>
              {posts.length.toString().padStart(3, '0')} Items
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '8px',
          }}>
            {posts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '64px 32px',
                color: '#000000',
                fontSize: '14px',
                fontWeight: 100,
                letterSpacing: '2px',
              }}>
                AWAITING DATA TRANSMISSION
              </div>
            ) : (
              posts.map((post, index) => {
                // Golden ratio for post width/height relationship
                const isHighlighted = index === 0;

                return (
                  <div
                    key={post.uri || index}
                    style={{
                      border: `${isHighlighted ? '2' : '1'}px solid ${
                        isHighlighted && post.sentiment === 'positive' ? '#ff0000' : '#000000'
                      }`,
                      padding: '24px',
                      background: '#ffffff',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {/* Sentiment Geometry Indicator */}
                    <div style={{
                      position: 'absolute',
                      top: '24px',
                      right: '24px',
                      fontSize: '32px',
                      color: '#000000',
                      lineHeight: 1,
                    }}>
                      {getSentimentGeometry(post.sentiment)}
                    </div>

                    {/* Author */}
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 100,
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      marginBottom: '16px',
                      color: '#000000',
                    }}>
                      {post.author?.handle || 'Anonymous'}
                    </div>

                    {/* Content */}
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.618, // Golden ratio
                      color: '#000000',
                      marginBottom: '16px',
                      paddingRight: '48px', // Space for geometry
                    }}>
                      {post.text.length > 280 ? `${post.text.slice(0, 280)}...` : post.text}
                    </div>

                    {/* Media */}
                    {(post.images || post.videos) && (
                      <div style={{ marginBottom: '16px' }}>
                        <MediaDisplay
                          images={post.images}
                          videos={post.videos}
                          variant="compact"
                          sensitive={post.sensitive}
                        />
                      </div>
                    )}

                    {/* Hashtags - Minimal Geometric Tags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        paddingTop: '16px',
                        borderTop: '1px solid #000000',
                      }}>
                        {post.hashtags.slice(0, 5).map(tag => (
                          <span key={tag} style={{
                            padding: '8px 16px',
                            border: '1px solid #000000',
                            fontSize: '10px',
                            fontWeight: 100,
                            letterSpacing: '1px',
                            color: '#000000',
                            background: '#f5f5f5',
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer - Full Width */}
        <footer style={{
          gridColumn: '1 / -1',
          textAlign: 'center',
          padding: '24px',
          borderTop: '1px solid #000000',
          marginTop: '16px',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 100,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#000000',
          }}>
            Real-Time Data Visualization System
          </div>
        </footer>
      </div>

      {/* Swiss Modernism Chart Styles */}
      <style>{`
        /* Swiss-themed DataCard overrides - Mathematical Precision */
        .swiss-cards [class*="DataCard"] {
          background: #ffffff !important;
          border: 1px solid #000000 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
          padding: 24px !important;
        }

        /* Card titles - Helvetica, uppercase, thin weight */
        .swiss-cards [class*="DataCard"] h3,
        .swiss-cards [class*="DataCard"] h2 {
          color: #000000 !important;
          text-transform: uppercase !important;
          font-size: 10px !important;
          font-weight: 100 !important;
          letter-spacing: 2px !important;
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
          margin-bottom: 24px !important;
          padding-bottom: 16px !important;
          border-bottom: 1px solid #000000 !important;
        }

        /* Card text - Clean, minimal */
        .swiss-cards [class*="DataCard"] p,
        .swiss-cards [class*="DataCard"] span,
        .swiss-cards [class*="DataCard"] div {
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
          font-size: 12px !important;
          line-height: 1.618 !important; /* Golden ratio */
          color: #000000 !important;
        }

        /* Numbers - Bold, monospace for precision */
        .swiss-cards [class*="DataCard"] [class*="text-lg"],
        .swiss-cards [class*="DataCard"] [class*="text-xl"],
        .swiss-cards [class*="DataCard"] [class*="text-2xl"] {
          color: #000000 !important;
          font-family: monospace !important;
          font-weight: 700 !important;
        }

        /* Legend items - Minimal borders */
        .swiss-cards [class*="DataCard"] [class*="flex items-center"] {
          padding: 8px !important;
          border: 1px solid #f5f5f5 !important;
          background: #ffffff !important;
          margin: 4px 0 !important;
        }

        /* Chart SVG elements - Monochrome with single red accent */
        .swiss-cards svg text {
          fill: #000000 !important;
          font-family: 'Helvetica Neue', Arial, sans-serif !important;
          font-size: 10px !important;
          font-weight: 100 !important;
        }

        .swiss-cards svg line,
        .swiss-cards svg path[class*="CartesianGrid"] {
          stroke: #f5f5f5 !important;
          stroke-width: 1 !important;
        }

        /* Recharts - Monochrome palette with RED ACCENT */
        .swiss-cards svg path[class*="area"],
        .swiss-cards svg path[class*="line"] {
          filter: none !important;
        }

        /* First area/bar gets red, others black/gray */
        .swiss-cards svg path[class*="area"]:first-of-type,
        .swiss-cards svg rect[class*="recharts-bar"]:first-of-type {
          fill: #ff0000 !important;
          stroke: #ff0000 !important;
        }

        .swiss-cards svg path[class*="area"]:not(:first-of-type),
        .swiss-cards svg rect[class*="recharts-bar"]:not(:first-of-type) {
          fill: #000000 !important;
          stroke: #000000 !important;
        }

        .swiss-cards svg path[class*="line"]:first-of-type {
          stroke: #ff0000 !important;
          stroke-width: 2 !important;
        }

        .swiss-cards svg path[class*="line"]:not(:first-of-type) {
          stroke: #000000 !important;
          stroke-width: 1 !important;
        }

        /* Bar chart bars - Flat, no effects */
        .swiss-cards svg rect[class*="recharts-bar"] {
          filter: none !important;
        }

        /* Hover effects - Minimal, geometric */
        .swiss-cards [class*="DataCard"]:hover {
          border: 2px solid #000000 !important;
          box-shadow: none !important;
          transform: none !important;
          padding: 23px !important; /* Compensate for border change */
        }

        /* Percentage text - Regular weight */
        .swiss-cards [class*="DataCard"] [class*="opacity-60"] {
          color: #000000 !important;
          opacity: 0.6 !important;
          font-weight: 100 !important;
        }

        /* Color squares in legends - Pure geometric shapes */
        .swiss-cards [class*="DataCard"] [class*="w-4 h-4"],
        .swiss-cards [class*="DataCard"] [class*="w-3 h-3"] {
          border: 1px solid #000000 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        /* Tooltip styling - Clean, minimal */
        .recharts-tooltip-wrapper {
          border: 1px solid #000000 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        .recharts-default-tooltip {
          background: #ffffff !important;
          border: 1px solid #000000 !important;
          border-radius: 0 !important;
          padding: 16px !important;
        }

        /* Remove all gradients and rounded corners */
        * {
          border-radius: 0 !important;
        }

        /* Ensure 8px grid alignment */
        .swiss-cards [class*="DataCard"] > * {
          margin-bottom: 8px !important;
        }

        /* Last element no margin */
        .swiss-cards [class*="DataCard"] > *:last-child {
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
}
