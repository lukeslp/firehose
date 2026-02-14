import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';

export default function Editorial({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FirehosePost | null>(null);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');
  

  // Add new posts to feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost as FirehosePost, ...prev].slice(0, 100));
    }
  }, [latestPost]);

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
      case 'positive': return 'Optimistic';
      case 'negative': return 'Critical';
      default: return 'Neutral';
    }
  };

  // Filter posts
  const filteredPosts = React.useMemo(() => {
    return posts.filter(post => {
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) {
        
      if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) {
        
        
      return true;
    });
  }, [posts, selectedLanguage, keywordFilter]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f0',
      fontFamily: 'Georgia, serif',
      color: '#1a1a1a',
    }}>
      {/* Header - Editorial masthead */}
      <header style={{
        borderBottom: '4px double #1a1a1a',
        padding: '32px 24px 24px',
        background: '#ffffff',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#666', fontFamily: 'Libre Franklin, sans-serif' }}>
              {formatDate(new Date().toISOString())}
            </div>
            <Link href="/variants">
              <a style={{
                fontSize: '12px',
                color: '#1a1a1a',
                textDecoration: 'none',
                fontFamily: 'Libre Franklin, sans-serif',
                borderBottom: '1px solid #1a1a1a',
                paddingBottom: '2px',
              }}>
                ← Return to Variants
              </a>
            </Link>
          </div>
          <h1 style={{
            fontSize: '72px',
            fontWeight: 700,
            fontFamily: 'Playfair Display, serif',
            margin: '16px 0',
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}>
            The Bluesky Chronicle
          </h1>
          <div style={{
            textAlign: 'center',
            fontSize: '14px',
            color: '#666',
            fontFamily: 'Libre Franklin, sans-serif',
            fontStyle: 'italic',
            borderTop: '1px solid #ccc',
            borderBottom: '1px solid #ccc',
            padding: '8px 0',
            margin: '16px 0 0',
          }}>
            Real-time coverage of the social stream • All voices preserved
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #ddd',
        padding: '16px 24px',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '48px',
          justifyContent: 'center',
          fontFamily: 'Libre Franklin, sans-serif',
          fontSize: '13px',
        }}>
          <div>
            <span style={{ color: '#666' }}>Total Articles: </span>
            <span style={{ fontWeight: 600 }}>{(stats?.totalPosts || 0).toLocaleString()}</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>Filtered: </span>
            <span style={{ fontWeight: 600 }}>{filteredPosts.length}</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>Rate: </span>
            <span style={{ fontWeight: 600 }}>{Math.round(stats?.postsPerMinute || 0)}/min</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>Connection: </span>
            <span style={{ fontWeight: 600, color: connected ? '#2e7d32' : '#d32f2f' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{
        background: '#f9f9f4',
        borderBottom: '1px solid #ddd',
        padding: '24px',
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
              fontWeight: 600,
              fontFamily: 'Libre Franklin, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
              color: '#666',
            }}>
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                background: '#ffffff',
                fontSize: '13px',
                fontFamily: 'Libre Franklin, sans-serif',
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
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'Libre Franklin, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
              color: '#666',
            }}>
              Search Keywords
            </label>
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="Filter by keyword..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                background: '#ffffff',
                fontSize: '13px',
                fontFamily: 'Libre Franklin, sans-serif',
              }}
            />
          </div>

          {/* Likes Threshold */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'Libre Franklin, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
              color: '#666',
            }}>
              Minimum Engagement: {likesThreshold} likes
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
                accentColor: '#1a1a1a',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#999',
              marginTop: '4px',
              fontFamily: 'Libre Franklin, sans-serif',
            }}>
              <span>0</span>
              <span>1000+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px' }}>
        {/* "Above the fold" - Lead story */}
        {filteredPosts.length > 0 && (
          <article style={{
            marginBottom: '48px',
            paddingBottom: '48px',
            borderBottom: '1px solid #ddd',
          }}>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              background: posts[0].sentiment === 'positive' ? '#e8f5e9' : posts[0].sentiment === 'negative' ? '#ffebee' : '#f5f5f5',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'Libre Franklin, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '16px',
              color: '#666',
            }}>
              {getSentimentLabel(filteredPosts[0].sentiment)} • Just Now
            </div>
            <h2 style={{
              fontSize: '42px',
              fontWeight: 700,
              fontFamily: 'Playfair Display, serif',
              lineHeight: '1.2',
              marginBottom: '16px',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedPost(filteredPosts[0])}
            >
              {filteredPosts[0].text.length > 120 ? `${filteredPosts[0].text.slice(0, 120)}...` : filteredPosts[0].text}
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#666',
              fontFamily: 'Libre Franklin, sans-serif',
              marginBottom: '8px',
            }}>
              By <span style={{ fontWeight: 600 }}>@{filteredPosts[0].author?.handle || 'Anonymous'}</span> • {formatTime(filteredPosts[0].createdAt)}
            </div>
            {filteredPosts[0].language && (
              <div style={{
                fontSize: '12px',
                color: '#999',
                fontFamily: 'Libre Franklin, sans-serif',
                fontStyle: 'italic',
              }}>
                Language: {filteredPosts[0].language.toUpperCase()}
              </div>
            )}
          </article>
        )}

        {/* Three-column layout for recent stories */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          marginBottom: '48px',
        }}>
          {filteredPosts.slice(1, 10).map((post, index) => (
            <article
              key={post.uri || index}
              style={{
                paddingBottom: '24px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedPost(post)}
            >
              <div style={{
                display: 'inline-block',
                padding: '2px 8px',
                background: post.sentiment === 'positive' ? '#e8f5e9' : post.sentiment === 'negative' ? '#ffebee' : '#f5f5f5',
                fontSize: '9px',
                fontWeight: 600,
                fontFamily: 'Libre Franklin, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                color: '#666',
              }}>
                {getSentimentLabel(post.sentiment)}
              </div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'Playfair Display, serif',
                lineHeight: '1.3',
                marginBottom: '8px',
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
                color: '#999',
                fontFamily: 'Libre Franklin, sans-serif',
              }}>
                @{post.author?.handle || 'Anonymous'} • {formatTime(post.createdAt)}
                {post.images?.some(img => !img.alt) && (
                  <span style={{ color: '#d32f2f', marginLeft: '8px' }}>⚠️ No alt</span>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Archive section - smaller items */}
        <div style={{ borderTop: '2px solid #1a1a1a', paddingTop: '32px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            fontFamily: 'Libre Franklin, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '24px',
            color: '#666',
          }}>
            Earlier Today
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            {filteredPosts.slice(10, 30).map((post, index) => (
              <div
                key={post.uri || index}
                style={{
                  display: 'flex',
                  gap: '16px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedPost(post)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    fontFamily: 'Lora, serif',
                    lineHeight: '1.4',
                    marginBottom: '4px',
                  }}>
                    {post.text.length > 100 ? `${post.text.slice(0, 100)}...` : post.text}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#999',
                    fontFamily: 'Libre Franklin, sans-serif',
                  }}>
                    @{post.author?.handle || 'Anonymous'} • {formatTime(post.createdAt)}
                  </div>
                </div>
                <div style={{
                  width: '3px',
                  background: post.sentiment === 'positive' ? '#4caf50' : post.sentiment === 'negative' ? '#f44336' : '#999',
                  flexShrink: 0,
                }} />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '4px double #1a1a1a',
        background: '#ffffff',
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: 'Libre Franklin, sans-serif',
        fontSize: '12px',
        color: '#999',
      }}>
        <div>The Bluesky Chronicle • All content sourced from the AT Protocol network</div>
        <div style={{ marginTop: '8px' }}>
          Real-time editorial variant • Designed for clarity and comprehension
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
            background: 'rgba(0, 0, 0, 0.8)',
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
              background: '#ffffff',
              maxWidth: '700px',
              width: '100%',
              padding: '48px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'Libre Franklin, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '24px',
              color: '#666',
            }}>
              {getSentimentLabel(selectedPost.sentiment)} • {formatDate(selectedPost.createdAt)}
            </div>
            <h2 style={{
              fontSize: '36px',
              fontWeight: 700,
              fontFamily: 'Playfair Display, serif',
              lineHeight: '1.2',
              marginBottom: '24px',
            }}>
              {selectedPost.text}
            </h2>
            <div style={{
              fontSize: '14px',
              color: '#666',
              fontFamily: 'Libre Franklin, sans-serif',
              marginBottom: '32px',
            }}>
              By <span style={{ fontWeight: 600 }}>@{selectedPost.author?.handle || 'Anonymous'}</span> • {formatTime(selectedPost.createdAt)}
            </div>
            {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px', fontFamily: 'Libre Franklin, sans-serif' }}>
                  Topics:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedPost.hashtags.map(tag => (
                    <span key={tag} style={{
                      padding: '4px 12px',
                      background: '#f5f5f5',
                      fontSize: '12px',
                      fontFamily: 'Libre Franklin, sans-serif',
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
                padding: '12px 24px',
                background: '#1a1a1a',
                color: '#ffffff',
                border: 'none',
                fontFamily: 'Libre Franklin, sans-serif',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
