/**
 * MissionControl.tsx - Dark Geometric Command Center Variant
 *
 * Aesthetic: Dark mode with geometric precision
 * Theme: Dark grays (#1a1a1a - #2d2d2d), electric blue/cyan accents (#00d9ff, #0080ff)
 * Typography: Sharp sans-serif (Inter, system fonts), monospace for data
 * Layout: Angular grid-based design with sharp corners and defined edges
 * Design: Professional command center feel with geometric shapes
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
        return 'text-[#00d9ff]'; // Electric cyan
      case 'negative':
        return 'text-[#ff4d6d]'; // Electric red
      case 'neutral':
        return 'text-[#a0a0a0]'; // Cool gray
      default:
        return 'text-[#00d9ff]';
    }
  };

  const getSentimentBg = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'bg-[#00d9ff]'; // Electric cyan
      case 'negative':
        return 'bg-[#ff4d6d]'; // Electric red
      case 'neutral':
        return 'bg-[#a0a0a0]'; // Cool gray
      default:
        return 'bg-[#00d9ff]';
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

  // Sharp, precise transitions for geometric aesthetic
  const springTransition = { type: "tween", duration: 0.3, ease: "easeOut" };

  return (
    <div
      className={`mission-control min-h-screen relative overflow-hidden ${className || ''}`}
      style={{
        background: `
          linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)
        `,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Geometric grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, #00d9ff 1px, transparent 1px),
              linear-gradient(to bottom, #00d9ff 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Angular accent elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 right-0 w-96 h-96 opacity-10"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, #00d9ff 50%)',
            clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 opacity-10"
          style={{
            background: 'linear-gradient(45deg, #0080ff 50%, transparent 50%)',
            clipPath: 'polygon(0 100%, 100% 100%, 0 0)',
          }}
        />
      </div>

      {/* Main content with precise spacing */}
      <div className="relative z-10 p-8 max-w-[1600px] mx-auto">
        {/* Header - sharp geometric style */}
        <motion.div
          initial={!prefersReducedMotion ? { y: -20, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={springTransition}
          className="mb-12 relative"
        >
          {/* Geometric accent lines */}
          <div className="absolute -top-4 left-0 w-32 h-1 bg-gradient-to-r from-[#00d9ff] to-transparent" />

          <div className="flex items-center gap-4 mb-6">
            {/* Angular icon */}
            <div className="w-12 h-12 bg-[#00d9ff] clip-hexagon flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#1a1a1a]" fill="currentColor">
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l8 4v8.64l-8 4-8-4V8.18l8-4z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>

            <div>
              <h1
                className="text-5xl font-bold text-white mb-2 tracking-tight"
                style={{
                  textShadow: '0 0 20px rgba(0, 217, 255, 0.3)',
                }}
              >
                MISSION CONTROL
              </h1>
              <p className="text-lg text-[#00d9ff] font-mono tracking-wide">
                BLUESKY FIREHOSE COMMAND CENTER
              </p>
            </div>
          </div>

          {/* Connection status - geometric indicator */}
          <motion.div
            className="flex items-center gap-3 bg-[#2d2d2d] px-6 py-3 border-l-4 border-[#00d9ff]"
            initial={!prefersReducedMotion ? { x: -20, opacity: 0 } : {}}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...springTransition, delay: 0.1 }}
          >
            <span className="text-sm text-gray-400 font-mono uppercase tracking-wider">
              System Status:
            </span>
            <motion.div
              className={`w-3 h-3 ${connected ? 'bg-[#00d9ff]' : 'bg-gray-600'}`}
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                boxShadow: connected
                  ? '0 0 15px rgba(0, 217, 255, 0.8)'
                  : '0 0 5px rgba(160, 160, 160, 0.3)',
              }}
              animate={
                !prefersReducedMotion && connected
                  ? {
                      rotate: [0, 360],
                    }
                  : {}
              }
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <span
              className={`text-sm font-mono uppercase ${connected ? 'text-[#00d9ff]' : 'text-gray-600'}`}
            >
              {connected ? 'ONLINE' : 'OFFLINE'}
            </span>
            {connected && (
              <div className="ml-auto flex items-center gap-2">
                <div className="w-1 h-1 bg-[#00d9ff] animate-pulse" />
                <span className="text-xs text-gray-500 font-mono">LIVE</span>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* System Metrics - geometric cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Uptime */}
          <motion.div
            initial={!prefersReducedMotion ? { x: -50, opacity: 0 } : {}}
            animate={{ x: 0, opacity: 1 }}
            transition={springTransition}
            className="relative p-6 bg-[#2d2d2d] border-2 border-[#00d9ff]/30 overflow-hidden"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)',
            }}
          >
            {/* Corner accent */}
            <div className="absolute bottom-0 right-0 w-12 h-12 bg-[#00d9ff]/10" />

            <div className="text-xs mb-2 text-gray-400 uppercase tracking-widest font-mono">
              SYSTEM UPTIME
            </div>
            <div className="text-5xl font-bold text-white tabular-nums mb-2 font-mono">
              {gardenTime}
            </div>
            <div className="text-xs text-[#00d9ff] font-mono">
              {stats?.running ? '▸ ACTIVE' : '■ STANDBY'}
            </div>
          </motion.div>

          {/* Total Posts */}
          <motion.div
            initial={!prefersReducedMotion ? { y: -50, opacity: 0 } : {}}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...springTransition, delay: 0.1 }}
            className="relative p-6 bg-[#2d2d2d] border-2 border-[#0080ff]/30 overflow-hidden"
            style={{
              clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)',
            }}
          >
            {/* Corner accent */}
            <div className="absolute top-0 left-0 w-12 h-12 bg-[#0080ff]/10" />

            <div className="text-xs mb-2 text-gray-400 uppercase tracking-widest font-mono">
              POSTS PROCESSED
            </div>
            <motion.div
              className="text-5xl font-bold text-white tabular-nums mb-2 font-mono"
              key={stats?.totalPosts || 0}
              initial={!prefersReducedMotion ? { scale: 1.2 } : {}}
              animate={{ scale: 1 }}
              transition={springTransition}
            >
              {(stats?.totalPosts || 0).toLocaleString()}
            </motion.div>
            <div className="text-xs text-[#0080ff] font-mono">
              DB: {(stats?.inDatabase || 0).toLocaleString()}
            </div>
          </motion.div>

          {/* Data Rate */}
          <motion.div
            initial={!prefersReducedMotion ? { x: 50, opacity: 0 } : {}}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...springTransition, delay: 0.2 }}
            className="relative p-6 bg-[#2d2d2d] border-2 border-[#00d9ff]/30 overflow-hidden"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
            }}
          >
            {/* Corner accent */}
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#00d9ff]/10" />

            <div className="text-xs mb-2 text-gray-400 uppercase tracking-widest font-mono">
              DATA RATE
            </div>
            <div className="text-5xl font-bold text-white tabular-nums mb-2 font-mono">
              {Math.round(stats?.postsPerMinute || 0)}
            </div>
            <div className="text-xs text-[#00d9ff] font-mono">
              POSTS/MIN
            </div>
          </motion.div>
        </div>

        {/* Filter Controls - angular panels */}
        <motion.div
          initial={!prefersReducedMotion ? { y: 20, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.3 }}
          className="mb-12 p-6 bg-[#2d2d2d] border-2 border-[#00d9ff]/20"
          style={{
            clipPath: 'polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)',
          }}
        >
          <h2 className="text-2xl font-bold text-white mb-6 tracking-wide uppercase">
            FILTER CONTROLS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Language Selector */}
            <div>
              <label className="block mb-3 text-xs text-gray-400 uppercase tracking-widest font-mono">
                LANGUAGE
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-3 bg-[#1a1a1a] border border-[#00d9ff]/30 text-white focus:outline-none focus:border-[#00d9ff] transition-colors font-mono"
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

            {/* Keyword Search */}
            <div>
              <label className="block mb-3 text-xs text-gray-400 uppercase tracking-widest font-mono">
                KEYWORD FILTER
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="ENTER SEARCH TERM..."
                className="w-full p-3 bg-[#1a1a1a] border border-[#00d9ff]/30 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00d9ff] transition-colors font-mono"
              />
            </div>
          </div>
        </motion.div>

        {/* Sentiment Analysis - geometric bars */}
        <motion.div
          initial={!prefersReducedMotion ? { scale: 0.95, opacity: 0 } : {}}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.4 }}
          className="mb-12 p-6 bg-[#2d2d2d] border-2 border-[#0080ff]/20"
        >
          <h2 className="text-2xl font-bold text-white mb-8 tracking-wide uppercase">
            SENTIMENT ANALYSIS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Positive */}
            <div className="relative">
              <div className="text-xs mb-3 text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <div className="w-3 h-3 bg-[#00d9ff]" />
                POSITIVE
              </div>
              <div className="text-4xl font-bold text-white mb-4 tabular-nums font-mono">
                {(stats?.sentimentCounts?.positive || 0).toLocaleString()}
              </div>
              <div className="h-2 bg-[#1a1a1a] overflow-hidden relative">
                <motion.div
                  className="h-full bg-[#00d9ff] absolute top-0 left-0"
                  initial={{ width: 0 }}
                  animate={{
                    width: stats?.totalPosts
                      ? `${((stats.sentimentCounts?.positive || 0) / stats.totalPosts) * 100}%`
                      : '0%',
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    boxShadow: '0 0 10px rgba(0, 217, 255, 0.5)',
                  }}
                />
                {/* Geometric notches */}
                <div className="absolute inset-0 flex">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex-1 border-r border-[#2d2d2d]" />
                  ))}
                </div>
              </div>
            </div>

            {/* Neutral */}
            <div className="relative">
              <div className="text-xs mb-3 text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <div className="w-3 h-3 bg-[#a0a0a0]" />
                NEUTRAL
              </div>
              <div className="text-4xl font-bold text-white mb-4 tabular-nums font-mono">
                {(stats?.sentimentCounts?.neutral || 0).toLocaleString()}
              </div>
              <div className="h-2 bg-[#1a1a1a] overflow-hidden relative">
                <motion.div
                  className="h-full bg-[#a0a0a0] absolute top-0 left-0"
                  initial={{ width: 0 }}
                  animate={{
                    width: stats?.totalPosts
                      ? `${((stats.sentimentCounts?.neutral || 0) / stats.totalPosts) * 100}%`
                      : '0%',
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    boxShadow: '0 0 10px rgba(160, 160, 160, 0.5)',
                  }}
                />
                {/* Geometric notches */}
                <div className="absolute inset-0 flex">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex-1 border-r border-[#2d2d2d]" />
                  ))}
                </div>
              </div>
            </div>

            {/* Negative */}
            <div className="relative">
              <div className="text-xs mb-3 text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                <div className="w-3 h-3 bg-[#ff4d6d]" />
                NEGATIVE
              </div>
              <div className="text-4xl font-bold text-white mb-4 tabular-nums font-mono">
                {(stats?.sentimentCounts?.negative || 0).toLocaleString()}
              </div>
              <div className="h-2 bg-[#1a1a1a] overflow-hidden relative">
                <motion.div
                  className="h-full bg-[#ff4d6d] absolute top-0 left-0"
                  initial={{ width: 0 }}
                  animate={{
                    width: stats?.totalPosts
                      ? `${((stats.sentimentCounts?.negative || 0) / stats.totalPosts) * 100}%`
                      : '0%',
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    boxShadow: '0 0 10px rgba(255, 77, 109, 0.5)',
                  }}
                />
                {/* Geometric notches */}
                <div className="absolute inset-0 flex">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex-1 border-r border-[#2d2d2d]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Visualization - geometric grid */}
        <motion.div
          initial={!prefersReducedMotion ? { y: 30, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.5 }}
          className="mb-12 p-6 bg-[#2d2d2d] border-2 border-[#00d9ff]/20"
        >
          <h2 className="text-2xl font-bold text-white mb-8 tracking-wide uppercase">
            DATA ANALYTICS
          </h2>
          <CardWall className="geometric-analytics-grid">
            <SentimentDistributionCard
              sentimentCounts={stats?.sentimentCounts || { positive: 0, neutral: 0, negative: 0 }}
              className="bg-[#1a1a1a] border border-[#00d9ff]/30 shadow-lg"
            />
            <SentimentTimelineCard
              data={sentimentTimeline}
              className="bg-[#1a1a1a] border border-[#0080ff]/30 shadow-lg"
            />
            <PostsPerMinuteCard
              data={postsPerMinuteTimeline}
              currentRate={stats?.postsPerMinute}
              className="bg-[#1a1a1a] border border-[#00d9ff]/30 shadow-lg"
            />
            <LanguagesCard
              languageCounts={languageCounts}
              className="bg-[#1a1a1a] border border-[#0080ff]/30 shadow-lg"
            />
            <ContentTypesCard
              contentTypeCounts={contentTypeCounts}
              className="bg-[#1a1a1a] border border-[#00d9ff]/30 shadow-lg"
            />
          </CardWall>
        </motion.div>

        {/* Live Data Feed */}
        <motion.div
          initial={!prefersReducedMotion ? { y: 30, opacity: 0 } : {}}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...springTransition, delay: 0.6 }}
          className="p-6 bg-[#2d2d2d] border-2 border-[#0080ff]/20"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white tracking-wide uppercase">
              LIVE DATA FEED
            </h2>
            <span className="text-xs text-gray-400 font-mono">
              {filteredPosts.length} / {posts.length} ENTRIES
            </span>
          </div>

          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 geometric-scrollbar">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.uri || index}
                  initial={!prefersReducedMotion ? { x: -20, opacity: 0 } : {}}
                  animate={{ x: 0, opacity: 1 }}
                  exit={!prefersReducedMotion ? { x: 20, opacity: 0 } : {}}
                  transition={springTransition}
                  className="p-4 bg-[#1a1a1a] border-l-4"
                  style={{
                    borderLeftColor: post.sentiment === 'positive'
                      ? '#00d9ff'
                      : post.sentiment === 'negative'
                      ? '#ff4d6d'
                      : '#a0a0a0',
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Sentiment indicator - geometric */}
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <motion.div
                        className={`w-2 h-2 flex-shrink-0 ${getSentimentBg(post.sentiment)}`}
                        style={{
                          boxShadow: `0 0 10px ${
                            post.sentiment === 'positive'
                              ? 'rgba(0, 217, 255, 0.6)'
                              : post.sentiment === 'negative'
                              ? 'rgba(255, 77, 109, 0.6)'
                              : 'rgba(160, 160, 160, 0.6)'
                          }`,
                        }}
                        animate={
                          !prefersReducedMotion
                            ? {
                                opacity: [0.5, 1, 0.5],
                              }
                            : {}
                        }
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                    </div>

                    {/* Post content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] mb-2 text-gray-500 uppercase tracking-wider font-mono">
                        {new Date(post.createdAt).toLocaleString()}
                        {' | '}
                        {post.author?.handle || 'UNKNOWN'}
                        {post.language && ` | ${post.language.toUpperCase()}`}
                      </div>
                      <div className={`${getSentimentColor(post.sentiment)} leading-relaxed text-sm mb-3`}>
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

                      {/* Post metadata tags - geometric badges */}
                      <div className="flex flex-wrap gap-2">
                        {post.hasImages && (
                          <span className="px-2 py-1 bg-[#00d9ff]/10 text-[#00d9ff] text-[10px] uppercase tracking-wider font-mono border border-[#00d9ff]/30">
                            IMG
                          </span>
                        )}
                        {post.hasVideo && (
                          <span className="px-2 py-1 bg-[#0080ff]/10 text-[#0080ff] text-[10px] uppercase tracking-wider font-mono border border-[#0080ff]/30">
                            VID
                          </span>
                        )}
                        {post.hasLink && (
                          <span className="px-2 py-1 bg-[#00d9ff]/10 text-[#00d9ff] text-[10px] uppercase tracking-wider font-mono border border-[#00d9ff]/30">
                            LINK
                          </span>
                        )}
                        {post.isReply && (
                          <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-[10px] uppercase tracking-wider font-mono border border-gray-600">
                            REPLY
                          </span>
                        )}
                        {post.isQuote && (
                          <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-[10px] uppercase tracking-wider font-mono border border-gray-600">
                            QUOTE
                          </span>
                        )}
                        {post.images?.some(img => !img.alt) && (
                          <span className="px-2 py-1 bg-[#ff4d6d]/10 text-[#ff4d6d] text-[10px] uppercase tracking-wider font-mono border border-[#ff4d6d]/30">
                            NO ALT
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

        {/* Footer - technical */}
        <motion.div
          initial={!prefersReducedMotion ? { opacity: 0 } : {}}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-12 text-center text-xs text-gray-600 font-mono uppercase tracking-widest"
        >
          <div className="flex items-center justify-center gap-3">
            <div className="w-1 h-1 bg-[#00d9ff]" />
            <span>BLUESKY FIREHOSE MONITORING SYSTEM</span>
            <div className="w-1 h-1 bg-[#00d9ff]" />
          </div>
        </motion.div>
      </div>

      {/* Geometric styling */}
      <style>{`
        /* Custom scrollbar - geometric */
        .geometric-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .geometric-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
        }

        .geometric-scrollbar::-webkit-scrollbar-thumb {
          background: #00d9ff;
          border: 2px solid #1a1a1a;
        }

        .geometric-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0080ff;
        }

        /* Precise animations for geometric grid */
        .geometric-analytics-grid > * {
          transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }

        /* Hexagon clip path utility */
        .clip-hexagon {
          clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
        }
      `}</style>
    </div>
  );
}

export default MissionControl;
