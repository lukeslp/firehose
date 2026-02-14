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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Crimson+Text:wght@400;600&family=Special+Elite&display=swap');

        /* Brass texture utility */
        .brass-texture {
          background: linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%);
          filter: brightness(0.9);
        }

        /* Embossed effect */
        .embossed {
          box-shadow: inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1);
        }

        /* Riveted border pattern */
        .riveted-border {
          border: 3px solid #4a4a4a;
          background-image: radial-gradient(circle, #4a4a4a 40%, transparent 41%);
          background-size: 30px 30px;
          background-position: 0 0, 15px 15px;
          background-clip: padding-box;
        }

        /* Gear rotation animation */
        @keyframes rotate {
          to { transform: rotate(360deg); }
        }

        .rotating-gear {
          animation: rotate 20s linear infinite;
        }

        /* Edison glow effect */
        .edison-glow {
          box-shadow: 0 0 20px rgba(255, 165, 0, 0.3), inset 0 0 10px rgba(255, 165, 0, 0.1);
        }

        /* Leather texture */
        .leather-texture {
          background: #8b4513;
          background-image:
            repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px),
            repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px);
        }
      `}</style>

      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Ornate Header Frame */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '32px',
        background: 'linear-gradient(180deg, rgba(44,24,16,0.95) 0%, transparent 100%)',
        borderBottom: '4px solid #4a4a4a',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px',
          background: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
          border: '6px solid #4a4a4a',
          borderRadius: '8px',
          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Decorative gear */}
            <div style={{
              width: '48px',
              height: '48px',
              background: 'radial-gradient(circle, #4a4a4a 30%, #daa520 31%, #daa520 40%, transparent 41%)',
              borderRadius: '50%',
              position: 'relative',
            }} className="rotating-gear">
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '8px',
                height: '8px',
                background: '#2c1810',
                borderRadius: '50%',
              }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '42px',
                fontWeight: 700,
                color: '#2c1810',
                margin: 0,
                fontFamily: '"Cinzel", serif',
                letterSpacing: '0.05em',
                textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              }}>
                INDUSTRIAL NEXUS
              </h1>
              <p style={{
                fontSize: '16px',
                color: '#4a4a4a',
                margin: '4px 0 0 0',
                fontFamily: '"Special Elite", monospace',
                letterSpacing: '0.15em',
              }}>
                BLUESKY MECHANICAL APPARATUS
              </p>
            </div>
          </div>
          <Link href="/variants">
            <a style={{
              padding: '12px 32px',
              background: '#4a4a4a',
              border: '3px solid #2c1810',
              color: '#ffa500',
              textDecoration: 'none',
              fontSize: '14px',
              fontFamily: '"Special Elite", monospace',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              borderRadius: '4px',
              boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), 0 2px 10px rgba(0,0,0,0.3)',
              transition: 'all 0.3s',
            }}>
              ⟵ DISENGAGE
            </a>
          </Link>
        </div>
      </div>

      {/* Brass Instrument Panel - Left Side */}
      <div style={{
        position: 'absolute',
        top: '180px',
        left: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        zIndex: 10,
      }}>
        {/* Connection Gauge */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
          border: '5px solid #4a4a4a',
          borderRadius: '8px',
          minWidth: '260px',
          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
          {/* Rivets */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />

          <div style={{
            fontSize: '11px',
            color: '#2c1810',
            marginBottom: '12px',
            fontFamily: '"Special Elite", monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}>
            TELEGRAPH STATUS
          </div>
          <div style={{
            fontSize: '32px',
            color: connected ? '#ffa500' : '#8b4513',
            fontWeight: 700,
            fontFamily: '"Cinzel", serif',
            textShadow: connected ? '0 0 10px rgba(255,165,0,0.5)' : 'none',
            textAlign: 'center',
            padding: '16px',
            background: '#2c1810',
            borderRadius: '4px',
            border: '2px solid #4a4a4a',
            boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5)',
          }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        {/* Particle Counter - Circular Gauge */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
          border: '5px solid #4a4a4a',
          borderRadius: '8px',
          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
          {/* Rivets */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />

          <div style={{
            fontSize: '11px',
            color: '#2c1810',
            marginBottom: '12px',
            fontFamily: '"Special Elite", monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            GEARS IN MOTION
          </div>

          {/* Circular pressure gauge */}
          <div style={{
            width: '160px',
            height: '160px',
            margin: '0 auto',
            borderRadius: '50%',
            background: '#2c1810',
            border: '4px solid #4a4a4a',
            boxShadow: 'inset 4px 4px 12px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            {/* Gauge markings */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
              <div key={angle} style={{
                position: 'absolute',
                width: '2px',
                height: angle % 90 === 0 ? '16px' : '8px',
                background: '#b8860b',
                top: '50%',
                left: '50%',
                transformOrigin: 'center',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-70px)`,
              }} />
            ))}

            <div style={{
              fontSize: '48px',
              color: '#ffa500',
              fontWeight: 700,
              fontFamily: '"Cinzel", serif',
              textShadow: '0 0 15px rgba(255,165,0,0.6)',
              zIndex: 1,
            }}>
              {particles.length}
            </div>

            {/* Needle */}
            <div style={{
              position: 'absolute',
              width: '4px',
              height: '60px',
              background: '#ff0000',
              bottom: '50%',
              left: '50%',
              transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${(particles.length / 80) * 270 - 135}deg)`,
              boxShadow: '0 0 8px rgba(255,0,0,0.8)',
            }} />
          </div>
        </div>

        {/* Sentiment Distribution Panel */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
          border: '5px solid #4a4a4a',
          borderRadius: '8px',
          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
          {/* Rivets */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />

          <div style={{
            fontSize: '11px',
            color: '#2c1810',
            marginBottom: '16px',
            fontFamily: '"Special Elite", monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            SENTIMENT APPARATUS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Positive */}
            <div style={{
              padding: '12px',
              background: '#2c1810',
              border: '2px solid #4a4a4a',
              borderRadius: '4px',
              boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#ffa500',
                    border: '2px solid #4a4a4a',
                    boxShadow: '0 0 8px rgba(255,165,0,0.6)',
                  }} />
                  <span style={{
                    fontSize: '13px',
                    color: '#b8860b',
                    fontFamily: '"Special Elite", monospace',
                    fontWeight: 'bold',
                  }}>
                    POSITIVE
                  </span>
                </div>
                <span style={{
                  fontSize: '18px',
                  color: '#ffa500',
                  fontWeight: 700,
                  fontFamily: '"Cinzel", serif',
                }}>
                  {(stats as any)?.sentimentCounts?.positive || 0}
                </span>
              </div>
            </div>

            {/* Neutral */}
            <div style={{
              padding: '12px',
              background: '#2c1810',
              border: '2px solid #4a4a4a',
              borderRadius: '4px',
              boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#b8860b',
                    border: '2px solid #4a4a4a',
                    boxShadow: '0 0 8px rgba(184,134,11,0.6)',
                  }} />
                  <span style={{
                    fontSize: '13px',
                    color: '#b8860b',
                    fontFamily: '"Special Elite", monospace',
                    fontWeight: 'bold',
                  }}>
                    NEUTRAL
                  </span>
                </div>
                <span style={{
                  fontSize: '18px',
                  color: '#b8860b',
                  fontWeight: 700,
                  fontFamily: '"Cinzel", serif',
                }}>
                  {(stats as any)?.sentimentCounts?.neutral || 0}
                </span>
              </div>
            </div>

            {/* Negative */}
            <div style={{
              padding: '12px',
              background: '#2c1810',
              border: '2px solid #4a4a4a',
              borderRadius: '4px',
              boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#8b4513',
                    border: '2px solid #4a4a4a',
                    boxShadow: '0 0 8px rgba(139,69,19,0.6)',
                  }} />
                  <span style={{
                    fontSize: '13px',
                    color: '#b8860b',
                    fontFamily: '"Special Elite", monospace',
                    fontWeight: 'bold',
                  }}>
                    NEGATIVE
                  </span>
                </div>
                <span style={{
                  fontSize: '18px',
                  color: '#8b4513',
                  fontWeight: 700,
                  fontFamily: '"Cinzel", serif',
                }}>
                  {(stats as any)?.sentimentCounts?.negative || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls - Right Side */}
      <div style={{
        position: 'absolute',
        top: '180px',
        right: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        zIndex: 10,
        maxWidth: '320px',
      }}>
        {/* Language Filter */}
        <div style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
          border: '5px solid #4a4a4a',
          borderRadius: '8px',
          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
          {/* Rivets */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />

          <label style={{
            fontSize: '11px',
            color: '#2c1810',
            marginBottom: '12px',
            display: 'block',
            fontFamily: '"Special Elite", monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}>
            LANGUAGE SELECTOR
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              background: '#2c1810',
              border: '3px solid #4a4a4a',
              color: '#ffa500',
              fontSize: '14px',
              fontFamily: '"Special Elite", monospace',
              borderRadius: '4px',
              boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5)',
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
          background: 'linear-gradient(135deg, #8b4513 0%, #a0522d 50%, #8b4513 100%)',
          border: '5px solid #4a4a4a',
          borderRadius: '8px',
          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
          position: 'relative',
        }}>
          {/* Rivets */}
          <div style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4a4a4a',
            boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.5)',
          }} />

          <label style={{
            fontSize: '11px',
            color: '#2c1810',
            marginBottom: '12px',
            display: 'block',
            fontFamily: '"Special Elite", monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}>
            KEYWORD APPARATUS
          </label>
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="Enter keyword..."
            style={{
              width: '100%',
              padding: '14px',
              background: '#2c1810',
              border: '3px solid #4a4a4a',
              color: '#ffa500',
              fontSize: '14px',
              fontFamily: '"Special Elite", monospace',
              borderRadius: '4px',
              boxShadow: 'inset 2px 2px 8px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </div>

      {/* Victorian Instructions Plaque */}
      <div style={{
        position: 'absolute',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '16px 40px',
        background: 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
        border: '4px solid #4a4a4a',
        borderRadius: '32px',
        color: '#2c1810',
        fontSize: '13px',
        fontFamily: '"Crimson Text", serif',
        fontStyle: 'italic',
        zIndex: 10,
        boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
      }}>
        ◆ Guide your pointer to influence the mechanical apparatus ◆
      </div>

      {/* Analytics Toggle - Ornate Lever */}
      <button
        onClick={() => setShowCardWall(!showCardWall)}
        style={{
          position: 'absolute',
          bottom: '32px',
          right: '32px',
          padding: '16px 32px',
          background: showCardWall
            ? 'linear-gradient(135deg, #ffa500 0%, #ff8c00 50%, #ffa500 100%)'
            : 'linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%)',
          border: '4px solid #4a4a4a',
          borderRadius: '8px',
          color: '#2c1810',
          fontSize: '13px',
          fontFamily: '"Special Elite", monospace',
          fontWeight: 'bold',
          letterSpacing: '0.15em',
          cursor: 'pointer',
          transition: 'all 0.3s',
          zIndex: 10,
          boxShadow: showCardWall
            ? 'inset 2px 2px 5px rgba(0,0,0,0.3), 0 0 20px rgba(255,165,0,0.5)'
            : 'inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {showCardWall ? '◀ CLOSE ANALYTICS' : 'ANALYTICS ▶'}
      </button>

      {/* CardWall Overlay - Leather-bound Panel */}
      {showCardWall && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100vh',
          background: 'linear-gradient(90deg, transparent 0%, rgba(44,24,16,0.98) 5%, rgba(44,24,16,0.98) 100%)',
          borderLeft: '6px solid #4a4a4a',
          overflowY: 'auto',
          padding: '32px',
          zIndex: 5,
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)',
        }}>
          <style>{`
            /* Steampunk theme overrides for DataCard components */
            .steampunk-cardwall .border-foreground {
              border-color: #4a4a4a !important;
              border-width: 4px !important;
            }
            .steampunk-cardwall .bg-background {
              background: linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%) !important;
              box-shadow: inset 2px 2px 5px rgba(0,0,0,0.3), inset -2px -2px 5px rgba(255,255,255,0.1) !important;
            }
            .steampunk-cardwall .text-foreground {
              color: #2c1810 !important;
            }
            .steampunk-cardwall h3 {
              color: #2c1810 !important;
              font-family: 'Cinzel', serif !important;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
              letter-spacing: 0.05em;
            }
            .steampunk-cardwall .text-muted-foreground {
              color: #4a4a4a !important;
              font-family: 'Special Elite', monospace !important;
            }
            /* Recharts theming - brass gauges */
            .steampunk-cardwall .recharts-text {
              fill: #2c1810 !important;
              font-family: 'Special Elite', monospace !important;
              font-size: 11px !important;
            }
            .steampunk-cardwall .recharts-cartesian-grid-horizontal line,
            .steampunk-cardwall .recharts-cartesian-grid-vertical line {
              stroke: rgba(74,74,74,0.2) !important;
            }
            /* Edison glow on hover */
            .steampunk-cardwall > div {
              transition: all 0.3s ease;
              position: relative;
            }
            .steampunk-cardwall > div:hover {
              box-shadow: inset 2px 2px 5px rgba(0,0,0,0.3), 0 0 20px rgba(255,165,0,0.4) !important;
            }
            /* Add rivets to cards */
            .steampunk-cardwall > div::before,
            .steampunk-cardwall > div::after {
              content: '';
              position: absolute;
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #4a4a4a;
              box-shadow: inset 1px 1px 2px rgba(0,0,0,0.5);
            }
            .steampunk-cardwall > div::before {
              top: 8px;
              left: 8px;
            }
            .steampunk-cardwall > div::after {
              top: 8px;
              right: 8px;
            }
          `}</style>
          <div style={{
            marginTop: '140px', // Account for ornate header
          }}>
            <CardWall className="steampunk-cardwall">
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
