import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';

export default function RetroArcade({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  

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

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😠';
      default: return '😐';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0033 0%, #000000 100%)',
      fontFamily: '"Press Start 2P", monospace',
      color: '#00ff00',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* CRT Scanlines */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 100,
      }} />

      {/* Vignette */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.7) 100%)',
        pointerEvents: 'none',
        zIndex: 99,
      }} />

      {/* Header */}
      <div style={{
        border: '4px solid #ff00ff',
        padding: '16px',
        marginBottom: '16px',
        background: 'rgba(0, 0, 0, 0.7)',
        boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#ff00ff', marginBottom: '8px' }}>
              BLUESKY ARCADE
            </div>
            <div style={{ fontSize: '24px', color: '#00ffff', textShadow: '0 0 10px #00ffff' }}>
              POST CATCHER
            </div>
          </div>
          <Link href="/variants">
            <a style={{
              padding: '8px 16px',
              border: '2px solid #ffff00',
              background: 'rgba(255, 255, 0, 0.2)',
              color: '#ffff00',
              textDecoration: 'none',
              fontSize: '8px',
              textShadow: '0 0 5px #ffff00',
            }}>
              EXIT
            </a>
          </Link>
        </div>
      </div>

      {/* Score Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '16px',
      }}>
        <div style={{
          border: '2px solid #00ff00',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)',
        }}>
          <div style={{ fontSize: '8px', color: '#00ff00', marginBottom: '4px' }}>SCORE</div>
          <div style={{ fontSize: '20px', color: '#00ffff', fontFamily: 'monospace', textShadow: '0 0 10px #00ffff' }}>
            {formatScore(score)}
          </div>
        </div>

        <div style={{
          border: '2px solid #ff00ff',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: '0 0 10px rgba(255, 0, 255, 0.3)',
        }}>
          <div style={{ fontSize: '8px', color: '#ff00ff', marginBottom: '4px' }}>COMBO</div>
          <div style={{ fontSize: '20px', color: '#ff00ff', fontFamily: 'monospace', textShadow: '0 0 10px #ff00ff' }}>
            x{combo}
          </div>
        </div>

        <div style={{
          border: '2px solid #ffff00',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: '0 0 10px rgba(255, 255, 0, 0.3)',
        }}>
          <div style={{ fontSize: '8px', color: '#ffff00', marginBottom: '4px' }}>POSTS/MIN</div>
          <div style={{ fontSize: '20px', color: '#ffff00', fontFamily: 'monospace', textShadow: '0 0 10px #ffff00' }}>
            {Math.round(stats?.postsPerMinute || 0)}
          </div>
        </div>

        <div style={{
          border: `2px solid ${connected ? '#00ff00' : '#ff0000'}`,
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: `0 0 10px ${connected ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'}`,
        }}>
          <div style={{ fontSize: '8px', color: connected ? '#00ff00' : '#ff0000', marginBottom: '4px' }}>
            STATUS
          </div>
          <div style={{
            fontSize: '12px',
            color: connected ? '#00ff00' : '#ff0000',
            textShadow: `0 0 10px ${connected ? '#00ff00' : '#ff0000'}`,
          }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '32px',
          border: '4px solid #ff0000',
          background: 'rgba(0, 0, 0, 0.95)',
          boxShadow: '0 0 30px rgba(255, 0, 0, 0.8)',
          textAlign: 'center',
          zIndex: 200,
          animation: 'pulse 1s ease-in-out infinite',
        }}>
          <div style={{ fontSize: '32px', color: '#ff0000', marginBottom: '24px', textShadow: '0 0 20px #ff0000' }}>
            GAME OVER
          </div>
          <div style={{ fontSize: '12px', color: '#ffff00', marginBottom: '16px' }}>
            CONNECTION LOST
          </div>
          <div style={{ fontSize: '16px', color: '#00ffff' }}>
            FINAL SCORE
          </div>
          <div style={{ fontSize: '24px', color: '#00ff00', marginTop: '8px', textShadow: '0 0 10px #00ff00' }}>
            {formatScore(score)}
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '16px',
      }}>
        {/* Language Filter */}
        <div style={{
          border: '2px solid #ff00ff',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: '0 0 10px rgba(255, 0, 255, 0.3)',
        }}>
          <label style={{ fontSize: '8px', color: '#ff00ff', display: 'block', marginBottom: '4px' }}>
            LANGUAGE
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '4px',
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid #ff00ff',
              color: '#ff00ff',
              fontSize: '10px',
              fontFamily: '"Press Start 2P", monospace',
            }}
          >
            <option value="all">ALL</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
            <option value="ja">JA</option>
            <option value="pt">PT</option>
          </select>
        </div>

        {/* Keyword Filter */}
        <div style={{
          border: '2px solid #00ffff',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)',
        }}>
          <label style={{ fontSize: '8px', color: '#00ffff', display: 'block', marginBottom: '4px' }}>
            KEYWORD
          </label>
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="SEARCH..."
            style={{
              width: '100%',
              padding: '4px',
              background: 'rgba(0, 0, 0, 0.9)',
              border: '1px solid #00ffff',
              color: '#00ffff',
              fontSize: '10px',
              fontFamily: '"Press Start 2P", monospace',
            }}
          />
        </div>

        {/* Likes Threshold */}
        <div style={{
          border: '2px solid #ffff00',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.7)',
          boxShadow: '0 0 10px rgba(255, 255, 0, 0.3)',
        }}>
          <label style={{ fontSize: '8px', color: '#ffff00', display: 'block', marginBottom: '4px' }}>
            MIN LIKES: {likesThreshold}
          </label>
          <input
            type="range"
            min="0"
            max="1000"
            step="10"
            value={likesThreshold}
            onChange={(e) => setLikesThreshold(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#ffff00',
            }}
          />
        </div>
      </div>

      {/* Post Feed - Arcade Style */}
      <div style={{
        border: '2px solid #00ffff',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.7)',
        boxShadow: '0 0 10px rgba(0, 255, 255, 0.3)',
        minHeight: '400px',
      }}>
        <div style={{ fontSize: '8px', color: '#00ffff', marginBottom: '16px', textTransform: 'uppercase' }}>
          === INCOMING TRANSMISSIONS ({posts.length}) ===
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#666', fontSize: '8px' }}>
              WAITING FOR DATA...
            </div>
          ) : (
            posts.map((post, index) => (
              <div
                key={post.uri || index}
                style={{
                  border: `2px solid ${
                    post.sentiment === 'positive' ? '#00ff00' :
                    post.sentiment === 'negative' ? '#ff0000' : '#ffff00'
                  }`,
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  boxShadow: `0 0 5px ${
                    post.sentiment === 'positive' ? 'rgba(0, 255, 0, 0.3)' :
                    post.sentiment === 'negative' ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 0, 0.3)'
                  }`,
                  animation: index === 0 ? 'slideIn 0.3s ease-out' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '8px', color: '#ff00ff' }}>
                    @{post.author?.handle?.slice(0, 20) || 'ANON'}
                  </div>
                  <div style={{ fontSize: '16px' }}>
                    {getSentimentEmoji(post.sentiment)}
                  </div>
                </div>
                <div style={{
                  fontSize: '10px',
                  color: post.sentiment === 'positive' ? '#00ff00' :
                          post.sentiment === 'negative' ? '#ff0000' : '#ffff00',
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                }}>
                  {post.text.length > 150 ? `${post.text.slice(0, 150)}...` : post.text}
                </div>
                {(post.images || post.videos) && (
                  <div style={{ marginTop: '8px' }}>
                    <MediaDisplay
                      images={post.images}
                      videos={post.videos}
                      variant="compact"
                      sensitive={post.sensitive}
                    />
                  </div>
                )}
                {post.hashtags && post.hashtags.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {post.hashtags.slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        padding: '2px 6px',
                        border: '1px solid #00ffff',
                        fontSize: '6px',
                        color: '#00ffff',
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '8px',
        color: '#666',
      }}>
        PRESS START TO CONTINUE • INSERT COIN
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
