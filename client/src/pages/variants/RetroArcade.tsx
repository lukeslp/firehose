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
          padding: '40px',
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          marginBottom: '20px',
        }}>
          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Bluesky Firehose
            </div>
            <div style={{
              fontSize: '52px',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '-2px',
              background: 'linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.9) 100%)',
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
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '16px',
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
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
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

        {/* Filter Controls - Glassmorphic Cards */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '20px',
        }}>
          {/* Language Filter */}
          <div style={{
            padding: '28px',
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '16px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              Language Filter
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                fontSize: '14px',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontWeight: 500,
                borderRadius: '12px',
                appearance: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              }}
            >
              <option value="all" style={{ background: '#764ba2', color: '#ffffff' }}>All Languages</option>
              <option value="en" style={{ background: '#764ba2', color: '#ffffff' }}>English</option>
              <option value="es" style={{ background: '#764ba2', color: '#ffffff' }}>Spanish</option>
              <option value="fr" style={{ background: '#764ba2', color: '#ffffff' }}>French</option>
              <option value="de" style={{ background: '#764ba2', color: '#ffffff' }}>German</option>
              <option value="ja" style={{ background: '#764ba2', color: '#ffffff' }}>Japanese</option>
              <option value="pt" style={{ background: '#764ba2', color: '#ffffff' }}>Portuguese</option>
            </select>
          </div>

          {/* Keyword Filter */}
          <div style={{
            padding: '28px',
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '16px',
              color: 'rgba(255, 255, 255, 0.9)',
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
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                fontSize: '14px',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                fontWeight: 500,
                borderRadius: '12px',
                boxSizing: 'border-box',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              }}
            />
          </div>
        </div>

        {/* Data Visualization - Glassmorphic Analytics */}
        <div style={{
          gridColumn: '1 / -1',
          padding: '40px',
          marginBottom: '20px',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '32px',
            color: 'rgba(255, 255, 255, 0.95)',
            paddingBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            Analytics Dashboard
          </div>
          <CardWall className="gradient-cards">
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

        {/* Post Feed - Gradient Cards */}
        <div style={{
          gridColumn: '1 / -1',
          padding: '40px',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          minHeight: '400px',
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '32px',
            color: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            <span>Data Stream</span>
            <span style={{
              fontFamily: 'monospace',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '8px 16px',
              borderRadius: '8px',
            }}>
              {posts.length.toString().padStart(3, '0')} Items
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '16px',
          }}>
            {posts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 32px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '14px',
                fontWeight: 500,
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}>
                Awaiting Data Transmission
              </div>
            ) : (
              posts.map((post, index) => {
                const isHighlighted = index === 0;
                const sentimentColor =
                  post.sentiment === 'positive' ? 'rgba(56, 239, 125, 0.3)' :
                  post.sentiment === 'negative' ? 'rgba(255, 107, 157, 0.3)' :
                  'rgba(255, 255, 255, 0.15)';

                return (
                  <div
                    key={post.uri || index}
                    style={{
                      padding: '28px',
                      background: isHighlighted
                        ? `linear-gradient(135deg, ${sentimentColor}, rgba(255, 255, 255, 0.1))`
                        : 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(20px)',
                      borderRadius: '20px',
                      border: `1px solid ${isHighlighted ? sentimentColor : 'rgba(255, 255, 255, 0.2)'}`,
                      boxShadow: isHighlighted
                        ? '0 8px 32px rgba(0, 0, 0, 0.15)'
                        : '0 4px 16px rgba(0, 0, 0, 0.1)',
                      position: 'relative',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = isHighlighted
                        ? '0 8px 32px rgba(0, 0, 0, 0.15)'
                        : '0 4px 16px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    {/* Sentiment Geometry Indicator */}
                    <div style={{
                      position: 'absolute',
                      top: '28px',
                      right: '28px',
                      fontSize: '36px',
                      color: '#ffffff',
                      lineHeight: 1,
                      textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    }}>
                      {getSentimentGeometry(post.sentiment)}
                    </div>

                    {/* Author */}
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      marginBottom: '16px',
                      color: 'rgba(255, 255, 255, 0.8)',
                    }}>
                      {post.author?.handle || 'Anonymous'}
                    </div>

                    {/* Content */}
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 400,
                      lineHeight: 1.6,
                      color: '#ffffff',
                      marginBottom: '16px',
                      paddingRight: '56px',
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

                    {/* Hashtags - Modern Rounded Tags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        paddingTop: '16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                      }}>
                        {post.hashtags.slice(0, 5).map(tag => (
                          <span key={tag} style={{
                            padding: '8px 16px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 500,
                            letterSpacing: '1px',
                            color: '#ffffff',
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
          padding: '32px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          marginTop: '20px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.8)',
          }}>
            Real-Time Data Visualization System
          </div>
        </footer>
      </div>

      {/* Modern Gradient Chart Styles */}
      <style>{`
        /* Gradient-themed DataCard overrides */
        .gradient-cards [class*="DataCard"] {
          background: rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 20px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          padding: 28px !important;
          transition: all 0.3s ease !important;
        }

        /* Card titles - Modern, clean */
        .gradient-cards [class*="DataCard"] h3,
        .gradient-cards [class*="DataCard"] h2 {
          color: rgba(255, 255, 255, 0.95) !important;
          text-transform: uppercase !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          letter-spacing: 2px !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          margin-bottom: 20px !important;
          padding-bottom: 16px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
        }

        /* Card text - White on gradient */
        .gradient-cards [class*="DataCard"] p,
        .gradient-cards [class*="DataCard"] span,
        .gradient-cards [class*="DataCard"] div {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          font-size: 13px !important;
          line-height: 1.6 !important;
          color: rgba(255, 255, 255, 0.9) !important;
        }

        /* Numbers - Bold, modern */
        .gradient-cards [class*="DataCard"] [class*="text-lg"],
        .gradient-cards [class*="DataCard"] [class*="text-xl"],
        .gradient-cards [class*="DataCard"] [class*="text-2xl"] {
          color: #ffffff !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          font-weight: 700 !important;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        }

        /* Legend items - Glassmorphic */
        .gradient-cards [class*="DataCard"] [class*="flex items-center"] {
          padding: 10px !important;
          background: rgba(255, 255, 255, 0.08) !important;
          backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 12px !important;
          margin: 6px 0 !important;
        }

        /* Chart SVG elements - Light colors for dark background */
        .gradient-cards svg text {
          fill: rgba(255, 255, 255, 0.9) !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          font-size: 11px !important;
          font-weight: 500 !important;
        }

        .gradient-cards svg line,
        .gradient-cards svg path[class*="CartesianGrid"] {
          stroke: rgba(255, 255, 255, 0.15) !important;
          stroke-width: 1 !important;
        }

        /* Recharts - Vibrant gradient palette */
        .gradient-cards svg path[class*="area"],
        .gradient-cards svg path[class*="line"] {
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2)) !important;
        }

        /* Vibrant color scheme */
        .gradient-cards svg path[class*="area"]:nth-of-type(1),
        .gradient-cards svg rect[class*="recharts-bar"]:nth-of-type(1) {
          fill: rgba(56, 239, 125, 0.6) !important;
          stroke: #38ef7d !important;
        }

        .gradient-cards svg path[class*="area"]:nth-of-type(2),
        .gradient-cards svg rect[class*="recharts-bar"]:nth-of-type(2) {
          fill: rgba(255, 107, 157, 0.6) !important;
          stroke: #ff6b9d !important;
        }

        .gradient-cards svg path[class*="area"]:nth-of-type(3),
        .gradient-cards svg rect[class*="recharts-bar"]:nth-of-type(3) {
          fill: rgba(102, 126, 234, 0.6) !important;
          stroke: #667eea !important;
        }

        .gradient-cards svg path[class*="line"]:nth-of-type(1) {
          stroke: #38ef7d !important;
          stroke-width: 3 !important;
        }

        .gradient-cards svg path[class*="line"]:nth-of-type(2) {
          stroke: #ff6b9d !important;
          stroke-width: 2 !important;
        }

        .gradient-cards svg path[class*="line"]:nth-of-type(3) {
          stroke: #667eea !important;
          stroke-width: 2 !important;
        }

        /* Bar chart bars - Gradient fills */
        .gradient-cards svg rect[class*="recharts-bar"] {
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2)) !important;
        }

        /* Hover effects - Lift and glow */
        .gradient-cards [class*="DataCard"]:hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
        }

        /* Percentage text - Lighter */
        .gradient-cards [class*="DataCard"] [class*="opacity-60"] {
          color: rgba(255, 255, 255, 0.7) !important;
          opacity: 1 !important;
          font-weight: 400 !important;
        }

        /* Color squares in legends - Rounded with glow */
        .gradient-cards [class*="DataCard"] [class*="w-4 h-4"],
        .gradient-cards [class*="DataCard"] [class*="w-3 h-3"] {
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 6px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        }

        /* Tooltip styling - Glassmorphic */
        .recharts-tooltip-wrapper {
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          background: rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(20px) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
        }

        .recharts-default-tooltip {
          background: rgba(255, 255, 255, 0.15) !important;
          backdrop-filter: blur(20px) !important;
          border: 1px solid rgba(255, 255, 255, 0.25) !important;
          border-radius: 12px !important;
          padding: 16px !important;
        }

        /* Smooth animations */
        .gradient-cards [class*="DataCard"] * {
          transition: all 0.3s ease !important;
        }
      `}</style>
    </div>
  );
}
