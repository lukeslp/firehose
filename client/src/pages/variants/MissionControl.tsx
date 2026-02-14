/**
 * MissionControl.tsx - Organic Garden Dashboard Variant
 *
 * Aesthetic: Nature-inspired, handwritten, organic garden
 * Theme: Forest greens, sage, terracotta with watercolor washes
 * Typography: Handwritten headers (Caveat/Indie Flower), organic serif body (Lora)
 * Layout: Flowing asymmetric design with organic blob shapes
 */

import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
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

export function MissionControl({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 20;
  const [gardenTime, setGardenTime] = useState('00:00:00');

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Data tracking state (following Dashboard.tsx pattern lines 225-264)
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

  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));
    }
  }, [latestPost, maxPosts]);

  // Track post timestamps and counts for timeline data (following Dashboard.tsx lines 80-128)
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

  // Sample rate every 1 second for timeline charts (following Dashboard.tsx lines 149-205)
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

  // Format garden elapsed time
  useEffect(() => {
    if (!stats?.duration) {
      setGardenTime('00:00:00');
      return;
    }
    const hours = Math.floor(stats.duration / 3600);
    const minutes = Math.floor((stats.duration % 3600) / 60);
    const seconds = stats.duration % 60;
    setGardenTime(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    );
  }, [stats?.duration]);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-[#2d4a2b]'; // Forest green
      case 'negative':
        return 'text-[#d4a574]'; // Terracotta
      case 'neutral':
        return 'text-[#5f7161]'; // Moss
      default:
        return 'text-[#2d4a2b]';
    }
  };

  const getSentimentBg = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'bg-[#2d4a2b]'; // Forest green
      case 'negative':
        return 'bg-[#d4a574]'; // Terracotta
      case 'neutral':
        return 'bg-[#5f7161]'; // Moss
      default:
        return 'bg-[#2d4a2b]';
    }
  };

  // Filter posts based on criteria
  const filteredPosts = useMemo(() => {
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

  // Spring physics for organic motion
  const springTransition = { type: "spring", stiffness: 50, damping: 15 };

  return (
    <div
      className={`organic-garden min-h-screen relative overflow-hidden ${className || ''}`}
      style={{
        background: `
          radial-gradient(ellipse at 20% 30%, rgba(143, 188, 143, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, rgba(95, 113, 97, 0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(212, 165, 116, 0.08) 0%, transparent 60%),
          #f0ead6
        `,
        fontFamily: '"Lora", Georgia, serif',
      }}
    >
      {/* Watercolor wash backgrounds - layered for depth */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(143, 188, 143, 0.3) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(212, 165, 116, 0.25) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(95, 113, 97, 0.15) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Main content with organic padding */}
      <div className="relative z-10 p-8 max-w-[1600px] mx-auto">
        {/* Header - flowing handwritten style */}
        <motion.div
          initial={!prefersReducedMotion ? { y: -20, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={springTransition}
          className="mb-12 text-center relative"
        >
          {/* Decorative leaf shadows */}
          <div className="absolute -top-8 left-1/4 w-16 h-16 opacity-20 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full text-[#2d4a2b]">
              <path
                d="M50,10 Q70,30 80,50 Q70,70 50,90 Q30,70 20,50 Q30,30 50,10 Z"
                fill="currentColor"
              />
            </svg>
          </div>

          <h1
            className="text-6xl font-bold text-[#2d4a2b] mb-4"
            style={{
              fontFamily: '"Caveat", cursive',
              textShadow: '2px 2px 4px rgba(45, 74, 43, 0.1)',
            }}
          >
            Garden of Voices
          </h1>
          <p
            className="text-xl text-[#5f7161]"
            style={{ fontFamily: '"Indie Flower", cursive' }}
          >
            Bluesky Firehose ~ where ideas grow
          </p>

          {/* Connection status - organic indicator */}
          <motion.div
            className="mt-6 flex items-center justify-center gap-3"
            initial={!prefersReducedMotion ? { scale: 0 } : {}}
            animate={{ scale: 1 }}
            transition={{ ...springTransition, delay: 0.2 }}
          >
            <span className="text-sm text-[#5f7161]" style={{ fontFamily: '"Indie Flower", cursive' }}>
              Garden Status:
            </span>
            <motion.div
              className={`w-4 h-4 ${connected ? 'bg-[#8fbc8f]' : 'bg-[#d4a574]'}`}
              style={{
                borderRadius: '63% 37% 54% 46% / 55% 48% 52% 45%',
                boxShadow: connected
                  ? '0 0 20px rgba(143, 188, 143, 0.6)'
                  : '0 0 20px rgba(212, 165, 116, 0.4)',
              }}
              animate={
                !prefersReducedMotion && connected
                  ? {
                      scale: [1, 1.15, 1],
                      boxShadow: [
                        '0 0 20px rgba(143, 188, 143, 0.6)',
                        '0 0 30px rgba(143, 188, 143, 0.8)',
                        '0 0 20px rgba(143, 188, 143, 0.6)',
                      ]
                    }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span
              className={`text-sm ${connected ? 'text-[#2d4a2b]' : 'text-[#d4a574]'}`}
              style={{ fontFamily: '"Indie Flower", cursive' }}
            >
              {connected ? 'Growing' : 'Resting'}
            </span>
          </motion.div>
        </motion.div>

        {/* Seed Packet Stats - organic blob cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Growing Time Seed Packet */}
          <motion.div
            initial={!prefersReducedMotion ? { x: -50, opacity: 0, rotate: -5 } : {}}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={springTransition}
            className="relative p-6 bg-white/80 backdrop-blur-sm"
            style={{
              borderRadius: '58% 42% 61% 39% / 48% 53% 47% 52%',
              boxShadow: '0 8px 32px rgba(45, 74, 43, 0.15)',
              border: '3px solid #8fbc8f',
            }}
          >
            <div
              className="text-sm mb-2 text-[#5f7161] uppercase tracking-wider"
              style={{ fontFamily: '"Indie Flower", cursive' }}
            >
              Growing Time
            </div>
            <div
              className="text-5xl font-bold text-[#2d4a2b] tabular-nums mb-2"
              style={{ fontFamily: '"Caveat", cursive' }}
            >
              {gardenTime}
            </div>
            <div className="text-xs text-[#5f7161]">
              {stats?.running ? '🌱 Seeds sprouting' : '🌙 Garden resting'}
            </div>
          </motion.div>

          {/* Total Seeds Planted */}
          <motion.div
            initial={!prefersReducedMotion ? { y: -50, opacity: 0 } : {}}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...springTransition, delay: 0.1 }}
            className="relative p-6 bg-white/80 backdrop-blur-sm"
            style={{
              borderRadius: '43% 57% 46% 54% / 61% 48% 52% 39%',
              boxShadow: '0 8px 32px rgba(95, 113, 97, 0.15)',
              border: '3px solid #2d4a2b',
            }}
          >
            <div
              className="text-sm mb-2 text-[#5f7161] uppercase tracking-wider"
              style={{ fontFamily: '"Indie Flower", cursive' }}
            >
              Seeds Planted
            </div>
            <motion.div
              className="text-5xl font-bold text-[#2d4a2b] tabular-nums mb-2"
              style={{ fontFamily: '"Caveat", cursive' }}
              key={stats?.totalPosts || 0}
              initial={!prefersReducedMotion ? { scale: 1.3 } : {}}
              animate={{ scale: 1 }}
              transition={springTransition}
            >
              {(stats?.totalPosts || 0).toLocaleString()}
            </motion.div>
            <div className="text-xs text-[#5f7161]">
              🌾 In garden: {(stats?.inDatabase || 0).toLocaleString()}
            </div>
          </motion.div>

          {/* Growth Rate */}
          <motion.div
            initial={!prefersReducedMotion ? { x: 50, opacity: 0, rotate: 5 } : {}}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            transition={{ ...springTransition, delay: 0.2 }}
            className="relative p-6 bg-white/80 backdrop-blur-sm"
            style={{
              borderRadius: '51% 49% 38% 62% / 57% 44% 56% 43%',
              boxShadow: '0 8px 32px rgba(212, 165, 116, 0.15)',
              border: '3px solid #d4a574',
            }}
          >
            <div
              className="text-sm mb-2 text-[#5f7161] uppercase tracking-wider"
              style={{ fontFamily: '"Indie Flower", cursive' }}
            >
              Growth Rate
            </div>
            <div
              className="text-5xl font-bold text-[#2d4a2b] tabular-nums mb-2"
              style={{ fontFamily: '"Caveat", cursive' }}
            >
              {Math.round(stats?.postsPerMinute || 0)}
            </div>
            <div className="text-xs text-[#5f7161]">
              🌻 seeds per minute
            </div>
          </motion.div>
        </div>

        {/* Garden Tools - Filter Controls */}
        <motion.div
          initial={!prefersReducedMotion ? { y: 20, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.3 }}
          className="mb-12 p-8 bg-white/70 backdrop-blur-sm"
          style={{
            borderRadius: '48% 52% 43% 57% / 51% 49% 51% 49%',
            boxShadow: '0 8px 32px rgba(45, 74, 43, 0.12)',
            border: '2px dashed #8fbc8f',
          }}
        >
          <h2
            className="text-3xl font-bold text-[#2d4a2b] mb-6"
            style={{ fontFamily: '"Caveat", cursive' }}
          >
            Garden Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Language Selector */}
            <div>
              <label
                className="block mb-3 text-lg text-[#5f7161]"
                style={{ fontFamily: '"Indie Flower", cursive' }}
              >
                🌍 Language Filter
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-4 bg-white/90 border-2 border-[#8fbc8f] text-[#2d4a2b] focus:outline-none focus:ring-2 focus:ring-[#2d4a2b]/30"
                style={{
                  borderRadius: '12px',
                  fontFamily: '"Lora", serif',
                  boxShadow: 'inset 0 2px 8px rgba(45, 74, 43, 0.05)',
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

            {/* Keyword Search */}
            <div>
              <label
                className="block mb-3 text-lg text-[#5f7161]"
                style={{ fontFamily: '"Indie Flower", cursive' }}
              >
                🔍 Keyword Search
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Search the garden..."
                className="w-full p-4 bg-white/90 border-2 border-[#8fbc8f] text-[#2d4a2b] placeholder:text-[#8fbc8f]/60 focus:outline-none focus:ring-2 focus:ring-[#2d4a2b]/30"
                style={{
                  borderRadius: '12px',
                  fontFamily: '"Lora", serif',
                  boxShadow: 'inset 0 2px 8px rgba(45, 74, 43, 0.05)',
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Garden Sentiment - Plant labels style */}
        <motion.div
          initial={!prefersReducedMotion ? { scale: 0.9, opacity: 0 } : {}}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.4 }}
          className="mb-12 p-8 bg-white/70 backdrop-blur-sm"
          style={{
            borderRadius: '55% 45% 58% 42% / 49% 56% 44% 51%',
            boxShadow: '0 8px 32px rgba(95, 113, 97, 0.12)',
            border: '2px solid #5f7161',
          }}
        >
          <h2
            className="text-3xl font-bold text-[#2d4a2b] mb-8"
            style={{ fontFamily: '"Caveat", cursive' }}
          >
            Garden Sentiment
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Positive - Growing */}
            <div className="text-center">
              <div
                className="text-sm mb-2 text-[#5f7161] uppercase"
                style={{ fontFamily: '"Indie Flower", cursive' }}
              >
                🌻 Growing
              </div>
              <div
                className="text-5xl font-bold text-[#2d4a2b] mb-4"
                style={{ fontFamily: '"Caveat", cursive' }}
              >
                {(stats?.sentimentCounts?.positive || 0).toLocaleString()}
              </div>
              <div className="h-3 bg-[#8fbc8f]/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#2d4a2b] rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: stats?.totalPosts
                      ? `${((stats.sentimentCounts?.positive || 0) / stats.totalPosts) * 100}%`
                      : '0%',
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    boxShadow: '0 2px 8px rgba(45, 74, 43, 0.3)',
                  }}
                />
              </div>
            </div>

            {/* Neutral - Sprouting */}
            <div className="text-center">
              <div
                className="text-sm mb-2 text-[#5f7161] uppercase"
                style={{ fontFamily: '"Indie Flower", cursive' }}
              >
                🌿 Sprouting
              </div>
              <div
                className="text-5xl font-bold text-[#5f7161] mb-4"
                style={{ fontFamily: '"Caveat", cursive' }}
              >
                {(stats?.sentimentCounts?.neutral || 0).toLocaleString()}
              </div>
              <div className="h-3 bg-[#5f7161]/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#5f7161] rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: stats?.totalPosts
                      ? `${((stats.sentimentCounts?.neutral || 0) / stats.totalPosts) * 100}%`
                      : '0%',
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    boxShadow: '0 2px 8px rgba(95, 113, 97, 0.3)',
                  }}
                />
              </div>
            </div>

            {/* Negative - Wilting */}
            <div className="text-center">
              <div
                className="text-sm mb-2 text-[#5f7161] uppercase"
                style={{ fontFamily: '"Indie Flower", cursive' }}
              >
                🍂 Wilting
              </div>
              <div
                className="text-5xl font-bold text-[#d4a574] mb-4"
                style={{ fontFamily: '"Caveat", cursive' }}
              >
                {(stats?.sentimentCounts?.negative || 0).toLocaleString()}
              </div>
              <div className="h-3 bg-[#d4a574]/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#d4a574] rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: stats?.totalPosts
                      ? `${((stats.sentimentCounts?.negative || 0) / stats.totalPosts) * 100}%`
                      : '0%',
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    boxShadow: '0 2px 8px rgba(212, 165, 116, 0.3)',
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Visualization Garden Beds */}
        <motion.div
          initial={!prefersReducedMotion ? { y: 30, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.5 }}
          className="mb-12 p-8 bg-white/60 backdrop-blur-sm"
          style={{
            borderRadius: '42% 58% 51% 49% / 56% 47% 53% 44%',
            boxShadow: '0 8px 32px rgba(143, 188, 143, 0.12)',
            border: '2px dashed #2d4a2b',
          }}
        >
          <h2
            className="text-3xl font-bold text-[#2d4a2b] mb-8"
            style={{ fontFamily: '"Caveat", cursive' }}
          >
            Garden Analytics
          </h2>
          <CardWall className="organic-garden-cards">
            <SentimentDistributionCard
              sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
              className="bg-white/80 backdrop-blur-sm border-2 border-[#8fbc8f] rounded-3xl shadow-lg"
            />
            <SentimentTimelineCard
              data={sentimentTimeline}
              className="bg-white/80 backdrop-blur-sm border-2 border-[#5f7161] rounded-3xl shadow-lg"
            />
            <PostsPerMinuteCard
              data={postsPerMinuteTimeline}
              currentRate={stats?.postsPerMinute}
              className="bg-white/80 backdrop-blur-sm border-2 border-[#2d4a2b] rounded-3xl shadow-lg"
            />
            <LanguagesCard
              languageCounts={languageCounts}
              className="bg-white/80 backdrop-blur-sm border-2 border-[#d4a574] rounded-3xl shadow-lg"
            />
            <ContentTypesCard
              contentTypeCounts={contentTypeCounts}
              className="bg-white/80 backdrop-blur-sm border-2 border-[#8fbc8f] rounded-3xl shadow-lg"
            />
          </CardWall>
        </motion.div>

        {/* Living Garden Feed */}
        <motion.div
          initial={!prefersReducedMotion ? { y: 30, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.6 }}
          className="p-8 bg-white/70 backdrop-blur-sm"
          style={{
            borderRadius: '46% 54% 49% 51% / 52% 48% 52% 48%',
            boxShadow: '0 8px 32px rgba(45, 74, 43, 0.15)',
            border: '2px solid #8fbc8f',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-3xl font-bold text-[#2d4a2b]"
              style={{ fontFamily: '"Caveat", cursive' }}
            >
              Living Garden Feed
            </h2>
            <span
              className="text-sm text-[#5f7161]"
              style={{ fontFamily: '"Indie Flower", cursive' }}
            >
              Showing {filteredPosts.length} of {posts.length} seeds
            </span>
          </div>

          <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.uri || index}
                  initial={!prefersReducedMotion ? { x: -30, opacity: 0, scale: 0.95 } : {}}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={!prefersReducedMotion ? { x: 30, opacity: 0, scale: 0.95 } : {}}
                  transition={springTransition}
                  className="p-5 bg-white/90 backdrop-blur-sm"
                  style={{
                    borderRadius: '20px',
                    boxShadow: '0 4px 16px rgba(45, 74, 43, 0.1)',
                    border: '1px solid #8fbc8f',
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Sentiment indicator - organic blob */}
                    <motion.div
                      className={`w-3 h-3 mt-1.5 flex-shrink-0 ${getSentimentBg(post.sentiment)}`}
                      style={{
                        borderRadius: '63% 37% 54% 46% / 55% 48% 52% 45%',
                        boxShadow: `0 2px 8px ${
                          post.sentiment === 'positive'
                            ? 'rgba(45, 74, 43, 0.3)'
                            : post.sentiment === 'negative'
                            ? 'rgba(212, 165, 116, 0.3)'
                            : 'rgba(95, 113, 97, 0.3)'
                        }`,
                      }}
                      animate={
                        !prefersReducedMotion
                          ? {
                              rotate: [0, 360],
                            }
                          : {}
                      }
                      transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />

                    {/* Post content */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs mb-2 text-[#5f7161]"
                        style={{ fontFamily: '"Indie Flower", cursive' }}
                      >
                        {new Date(post.createdAt).toLocaleString()}
                        {' ~ '}
                        {post.author?.handle || 'unknown'}
                        {post.language && ` ~ ${post.language.toUpperCase()}`}
                      </div>
                      <div className={`${getSentimentColor(post.sentiment)} leading-relaxed text-base mb-3`}>
                        {post.text}
                      </div>

                      {(post.images || post.videos) && (
                        <div className="mb-3">
                          <MediaDisplay
                            images={post.images}
                            videos={post.videos}
                            variant="compact"
                            sensitive={post.sensitive}
                          />
                        </div>
                      )}

                      {/* Post metadata tags */}
                      <div className="flex flex-wrap gap-2">
                        {post.hasImages && (
                          <span
                            className="px-2 py-1 bg-[#8fbc8f]/20 text-[#2d4a2b] text-xs rounded-full"
                            style={{ fontFamily: '"Indie Flower", cursive' }}
                          >
                            📷 Image
                          </span>
                        )}
                        {post.hasVideo && (
                          <span
                            className="px-2 py-1 bg-[#5f7161]/20 text-[#2d4a2b] text-xs rounded-full"
                            style={{ fontFamily: '"Indie Flower", cursive' }}
                          >
                            🎥 Video
                          </span>
                        )}
                        {post.hasLink && (
                          <span
                            className="px-2 py-1 bg-[#d4a574]/20 text-[#2d4a2b] text-xs rounded-full"
                            style={{ fontFamily: '"Indie Flower", cursive' }}
                          >
                            🔗 Link
                          </span>
                        )}
                        {post.isReply && (
                          <span
                            className="px-2 py-1 bg-[#8fbc8f]/30 text-[#2d4a2b] text-xs rounded-full"
                            style={{ fontFamily: '"Indie Flower", cursive' }}
                          >
                            💬 Reply
                          </span>
                        )}
                        {post.isQuote && (
                          <span
                            className="px-2 py-1 bg-[#5f7161]/30 text-[#2d4a2b] text-xs rounded-full"
                            style={{ fontFamily: '"Indie Flower", cursive' }}
                          >
                            ✨ Quote
                          </span>
                        )}
                        {post.images?.some(img => !img.alt) && (
                          <span
                            className="px-2 py-1 bg-[#d4a574]/40 text-[#2d4a2b] text-xs rounded-full"
                            style={{ fontFamily: '"Indie Flower", cursive' }}
                          >
                            ⚠️ No Alt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer - handwritten */}
        <motion.div
          initial={!prefersReducedMotion ? { opacity: 0 } : {}}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-12 text-center text-sm text-[#5f7161]"
          style={{ fontFamily: '"Indie Flower", cursive' }}
        >
          <p>🌱 Cultivated with care ~ where every voice blooms 🌻</p>
        </motion.div>
      </div>

      {/* Add font imports via inline style tag */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Indie+Flower&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');

        /* Custom scrollbar for organic feel */
        .organic-garden ::-webkit-scrollbar {
          width: 12px;
        }

        .organic-garden ::-webkit-scrollbar-track {
          background: rgba(143, 188, 143, 0.1);
          border-radius: 10px;
        }

        .organic-garden ::-webkit-scrollbar-thumb {
          background: #8fbc8f;
          border-radius: 10px;
          border: 2px solid #f0ead6;
        }

        .organic-garden ::-webkit-scrollbar-thumb:hover {
          background: #2d4a2b;
        }

        /* Smooth spring animations for card wall */
        .organic-garden-cards > * {
          transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
}

export default MissionControl;
