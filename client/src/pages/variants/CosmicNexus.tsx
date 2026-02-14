import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useSocket } from '@/hooks/useSocket';
import type { FirehosePost, VariantProps } from './types';

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  text: string;
  author: string;
  opacity: number;
  size: number;
}

export default function CosmicNexus({ onNavigateBack }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>(0);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>('all');
  const [keywordFilter, setKeywordFilter] = React.useState<string>('');
  

  // Add new particles from posts
  useEffect(() => {
    if (latestPost) {
      const post = latestPost as FirehosePost;

      // Apply filters
      if (selectedLanguage !== 'all' && post.language !== selectedLanguage) return;
      if (keywordFilter && !post.text.toLowerCase().includes(keywordFilter.toLowerCase())) return;

      const newParticle: Particle = {
        id: post.uri || `${Date.now()}-${Math.random()}`,
        x: Math.random() * (window.innerWidth - 200) + 100,
        y: Math.random() * (window.innerHeight - 200) + 100,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        sentiment: post.sentiment,
        text: post.text.slice(0, 100),
        author: post.author?.handle || 'unknown',
        opacity: 1,
        size: 3 + Math.random() * 3,
      };

      setParticles(prev => [...prev, newParticle].slice(-100)); // Keep last 100
    }
  }, [latestPost, selectedLanguage, keywordFilter]);

  // Mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      // Clear with fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw particles
      particles.forEach((particle, index) => {
        // Gravity toward mouse
        const dx = mousePos.x - particle.x;
        const dy = mousePos.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          particle.vx += (dx / dist) * 0.02;
          particle.vy += (dy / dist) * 0.02;
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Damping
        particle.vx *= 0.99;
        particle.vy *= 0.99;

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Fade out old particles (slowly - last ~5min)
        particle.opacity = Math.max(0, particle.opacity - 0.0002);

        // Get sentiment color
        let color;
        switch (particle.sentiment) {
          case 'positive':
            color = `rgba(96, 239, 255, ${particle.opacity})`;
            break;
          case 'negative':
            color = `rgba(255, 107, 157, ${particle.opacity})`;
            break;
          default:
            color = `rgba(167, 139, 250, ${particle.opacity})`;
        }

        // Draw glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;

        // Draw particle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;
      });

      // Remove faded particles
      setParticles(prev => prev.filter(p => p.opacity > 0.05));

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [particles, mousePos]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '#60efff';
      case 'negative': return '#ff6b9d';
      default: return '#a78bfa';
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#000000',
      fontFamily: 'Space Grotesk, system-ui, sans-serif',
    }}>
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

      {/* HUD Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '24px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#ffffff',
              margin: 0,
              textShadow: '0 0 20px rgba(96, 239, 255, 0.5)',
            }}>
              COSMIC NEXUS
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#a0a0a0',
              margin: '4px 0 0 0',
              fontFamily: 'Share Tech Mono, monospace',
            }}>
              BLUESKY PARTICLE FIELD
            </p>
          </div>
          <Link href="/variants">
            <a style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '12px',
              fontFamily: 'Share Tech Mono, monospace',
              transition: 'all 0.3s',
            }}>
              ← EXIT
            </a>
          </Link>
        </div>
      </div>

      {/* Stats HUD */}
      <div style={{
        position: 'absolute',
        top: '120px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        zIndex: 10,
      }}>
        <div style={{
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(96, 239, 255, 0.3)',
          borderRadius: '8px',
          minWidth: '200px',
        }}>
          <div style={{
            fontSize: '10px',
            color: '#60efff',
            marginBottom: '8px',
            fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: '0.1em',
          }}>
            CONNECTION STATUS
          </div>
          <div style={{
            fontSize: '24px',
            color: connected ? '#60efff' : '#ff6b9d',
            fontWeight: 700,
            fontFamily: 'Orbitron, monospace',
          }}>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(96, 239, 255, 0.3)',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '10px',
            color: '#60efff',
            marginBottom: '8px',
            fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: '0.1em',
          }}>
            PARTICLES IN FIELD
          </div>
          <div style={{
            fontSize: '36px',
            color: '#ffffff',
            fontWeight: 700,
            fontFamily: 'Orbitron, monospace',
            textShadow: '0 0 10px rgba(96, 239, 255, 0.5)',
          }}>
            {particles.length}
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(96, 239, 255, 0.3)',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '10px',
            color: '#60efff',
            marginBottom: '12px',
            fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: '0.1em',
          }}>
            SENTIMENT NEBULA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#60efff',
                  boxShadow: '0 0 10px #60efff',
                }} />
                <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'Share Tech Mono, monospace' }}>
                  POS
                </span>
              </div>
              <span style={{ fontSize: '14px', color: '#60efff', fontWeight: 700, fontFamily: 'Orbitron, monospace' }}>
                {(stats as any)?.sentimentDistribution?.positive || 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#a78bfa',
                  boxShadow: '0 0 10px #a78bfa',
                }} />
                <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'Share Tech Mono, monospace' }}>
                  NEU
                </span>
              </div>
              <span style={{ fontSize: '14px', color: '#a78bfa', fontWeight: 700, fontFamily: 'Orbitron, monospace' }}>
                {(stats as any)?.sentimentDistribution?.neutral || 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ff6b9d',
                  boxShadow: '0 0 10px #ff6b9d',
                }} />
                <span style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'Share Tech Mono, monospace' }}>
                  NEG
                </span>
              </div>
              <span style={{ fontSize: '14px', color: '#ff6b9d', fontWeight: 700, fontFamily: 'Orbitron, monospace' }}>
                {(stats as any)?.sentimentDistribution?.negative || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{
        position: 'absolute',
        top: '120px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        zIndex: 10,
        maxWidth: '280px',
      }}>
        {/* Language Filter */}
        <div style={{
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(96, 239, 255, 0.3)',
          borderRadius: '8px',
        }}>
          <label style={{
            fontSize: '10px',
            color: '#60efff',
            marginBottom: '8px',
            display: 'block',
            fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: '0.1em',
          }}>
            LANGUAGE FILTER
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(96, 239, 255, 0.5)',
              color: '#60efff',
              fontSize: '12px',
              fontFamily: 'Share Tech Mono, monospace',
              borderRadius: '4px',
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
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(167, 139, 250, 0.3)',
          borderRadius: '8px',
        }}>
          <label style={{
            fontSize: '10px',
            color: '#a78bfa',
            marginBottom: '8px',
            display: 'block',
            fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: '0.1em',
          }}>
            KEYWORD SEARCH
          </label>
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="Enter keyword..."
            style={{
              width: '100%',
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(167, 139, 250, 0.5)',
              color: '#a78bfa',
              fontSize: '12px',
              fontFamily: 'Share Tech Mono, monospace',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Likes Threshold */}
        <div style={{
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 107, 157, 0.3)',
          borderRadius: '8px',
        }}>
          <label style={{
            fontSize: '10px',
            color: '#ff6b9d',
            marginBottom: '8px',
            display: 'block',
            fontFamily: 'Share Tech Mono, monospace',
            letterSpacing: '0.1em',
          }}>
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
              accentColor: '#ff6b9d',
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: '#666',
            marginTop: '4px',
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            <span>0</span>
            <span>1000+</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        background: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '24px',
        color: '#a0a0a0',
        fontSize: '12px',
        fontFamily: 'Share Tech Mono, monospace',
        zIndex: 10,
      }}>
        Move your cursor to attract particles
      </div>
    </div>
  );
}
