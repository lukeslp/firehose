import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, VariantProps } from './types';
import { CardWall } from '@/components/CardWall';
import { SentimentDistributionCard } from '@/components/cards/SentimentDistributionCard';
import { SentimentTimelineCard } from '@/components/cards/SentimentTimelineCard';
import { PostsPerMinuteCard } from '@/components/cards/PostsPerMinuteCard';
import { LanguagesCard } from '@/components/cards/LanguagesCard';
import { ContentTypesCard } from '@/components/cards/ContentTypesCard';

interface PostCard {
  id: string;
  text: string;
  author: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  opacity: number;
  hasImages?: boolean;
  hasVideo?: boolean;
  hasLink?: boolean;
  y?: number;
  vy?: number;
}

export default function CosmicNexus({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [recentPosts, setRecentPosts] = useState<PostCard[]>([]);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>('all');
  const [keywordFilter, setKeywordFilter] = React.useState<string>('');

  // Data tracking state (from Dashboard.tsx pattern)
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

  // CardWall visibility toggle
  const [showCardWall, setShowCardWall] = useState(false);

  // Collapsed cards state
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  // Add new posts AND track data for CardWall (Dashboard.tsx pattern)
  useEffect(() => {
    if (latestPost) {
      const post = latestPost as FirehosePost;
      const now = Date.now();

      // Track timestamps for rate calculation
      setPostTimestamps(prev => {
        const twoMinutesAgo = now - 2 * 60 * 1000;
        const filtered = prev.filter(d => d.timestamp >= twoMinutesAgo);
        return [...filtered, {
          timestamp: now,
          sentiment: post.sentiment
        }];
      });

      // Track language
      if (post.language) {
        setLanguageCounts(prev => ({
          ...prev,
          [post.language!]: (prev[post.language!] || 0) + 1
        }));
      }

      // Track content types
      const hasImages = post.hasImages || false;
      const hasVideo = post.hasVideo || false;
      const hasLinks = post.hasLink || false;
      const isTextOnly = !hasImages && !hasVideo && !hasLinks;

      setContentTypeCounts(prev => ({
        textOnly: isTextOnly ? prev.textOnly + 1 : prev.textOnly,
        withImages: hasImages ? prev.withImages + 1 : prev.withImages,
        withVideo: hasVideo ? prev.withVideo + 1 : prev.withVideo,
        withLinks: hasLinks ? prev.withLinks + 1 : prev.withLinks,
      }));

      // Apply filters for recent posts display
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) return;
      if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) return;

      const newPostCard: PostCard = {
        id: post.uri || `${Date.now()}-${Math.random()}`,
        text: post.text.slice(0, 200),
        author: post.author?.handle || 'unknown',
        sentiment: post.sentiment,
        opacity: 1,
        hasImages,
        hasVideo,
        hasLink: hasLinks,
        y: -100, // Start above viewport
        vy: 2, // Fall speed
      };

      setRecentPosts(prev => [...prev, newPostCard].slice(-20)); // Keep last 20 posts
    }
  }, [latestPost, selectedLanguage, keywordFilter]);

  // Animate falling posts
  useEffect(() => {
    const interval = setInterval(() => {
      setRecentPosts(prev =>
        prev.map(p => {
          const newY = (p.y || 0) + (p.vy || 2);
          const newOpacity = newY > window.innerHeight - 200 ? Math.max(0, p.opacity - 0.02) : p.opacity;
          return { ...p, y: newY, opacity: newOpacity };
        }).filter(p => p.opacity > 0.05)
      );
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Sample rate every 1 second for timeline charts (Dashboard.tsx pattern)
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

    const interval = setInterval(calculateRates, 1000); // Sample every 1 second
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '#06b6d4'; // Teal
      case 'negative': return '#e879f9'; // Violet
      default: return '#64748b'; // Slate
    }
  };

  const toggleCard = (id: string) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#0a0a0a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '24px 32px',
        background: 'rgba(10, 10, 10, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '-0.5px',
            }}>
              Cosmic Nexus
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#64748b',
              margin: '4px 0 0 0',
            }}>
              Real-time Bluesky stream
            </p>
          </div>
          <Link href="/variants">
            <a style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              transition: 'all 0.2s',
            }}>
              ← Back
            </a>
          </Link>
        </div>
      </div>

      {/* Left Sidebar - Stats */}
      <div style={{
        position: 'absolute',
        top: '100px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        zIndex: 10,
        width: '240px',
      }}>
        {/* Connection Status */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 500,
          }}>
            Connection
          </div>
          <div style={{
            fontSize: '16px',
            color: connected ? '#06b6d4' : '#64748b',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? '#06b6d4' : '#64748b',
              boxShadow: connected ? '0 0 10px rgba(6, 182, 212, 0.5)' : 'none',
            }} />
            {connected ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Post Counter */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 500,
          }}>
            Active Posts
          </div>
          <div style={{
            fontSize: '32px',
            color: '#ffffff',
            fontWeight: 700,
          }}>
            {recentPosts.length}
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 500,
          }}>
            Sentiment
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Positive */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#06b6d4',
                }} />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Positive</span>
              </div>
              <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600 }}>
                {(stats as any)?.sentimentCounts?.positive || 0}
              </span>
            </div>

            {/* Neutral */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#64748b',
                }} />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Neutral</span>
              </div>
              <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600 }}>
                {(stats as any)?.sentimentCounts?.neutral || 0}
              </span>
            </div>

            {/* Negative */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#e879f9',
                }} />
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Negative</span>
              </div>
              <span style={{ fontSize: '14px', color: '#ffffff', fontWeight: 600 }}>
                {(stats as any)?.sentimentCounts?.negative || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Filters */}
      <div style={{
        position: 'absolute',
        top: '100px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        zIndex: 10,
        width: '240px',
      }}>
        {/* Language Filter */}
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        }}>
          <label style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '8px',
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 500,
          }}>
            Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '14px',
              borderRadius: '6px',
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
        <div style={{
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        }}>
          <label style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '8px',
            display: 'block',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: 500,
          }}>
            Keyword
          </label>
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="Filter by keyword..."
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '14px',
              borderRadius: '6px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Falling Posts */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        {recentPosts.map((post, i) => (
          <div
            key={post.id}
            onClick={() => toggleCard(post.id)}
            style={{
              position: 'absolute',
              left: `${20 + (i % 3) * 30}%`,
              top: `${post.y}px`,
              width: '280px',
              padding: collapsedCards.has(post.id) ? '12px' : '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${getSentimentColor(post.sentiment)}33`,
              borderRadius: '8px',
              opacity: post.opacity,
              transition: 'padding 0.2s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Card Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: collapsedCards.has(post.id) ? 0 : '12px',
            }}>
              <div style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
              }}>
                @{post.author}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                {post.hasImages && <span style={{ fontSize: '14px' }}>📷</span>}
                {post.hasVideo && <span style={{ fontSize: '14px' }}>🎥</span>}
                {post.hasLink && <span style={{ fontSize: '14px' }}>🔗</span>}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: getSentimentColor(post.sentiment),
                }} />
              </div>
            </div>

            {/* Card Content */}
            {!collapsedCards.has(post.id) && (
              <div style={{
                fontSize: '14px',
                color: '#e2e8f0',
                lineHeight: '1.5',
              }}>
                {post.text}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Analytics Toggle */}
      <button
        onClick={() => setShowCardWall(!showCardWall)}
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          padding: '12px 24px',
          background: showCardWall ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${showCardWall ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '6px',
          color: showCardWall ? '#06b6d4' : '#ffffff',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s',
          zIndex: 10,
        }}
      >
        {showCardWall ? '← Close Analytics' : 'Analytics →'}
      </button>

      {/* CardWall Overlay */}
      {showCardWall && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100vh',
          background: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          overflowY: 'auto',
          padding: '32px',
          zIndex: 5,
        }}>
          <div style={{ marginTop: '80px' }}>
            <CardWall>
              <SentimentDistributionCard
                sentimentCounts={(stats as any)?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
              />
              <SentimentTimelineCard
                data={sentimentTimeline}
              />
              <PostsPerMinuteCard
                data={postsPerMinuteTimeline}
                currentRate={(stats as any)?.postsPerMinute || 0}
              />
              <LanguagesCard
                languageCounts={languageCounts}
              />
              <ContentTypesCard
                contentTypeCounts={contentTypeCounts}
              />
            </CardWall>
          </div>
        </div>
      )}
    </div>
  );
}
