/**
 * Minimal.tsx - Ultra-clean minimalist design variant
 *
 * Aesthetic: Japanese minimalism meets Swiss typography
 * Theme: Generous whitespace, neutral palette, focus on content
 * Typography: Clean sans-serif (Inter), precise spacing
 * Layout: Spacious grid, subtle dividers, breathing room
 */

import { useSocket } from '@/hooks/useSocket';
import { useState, useEffect, useMemo } from 'react';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';

export function Minimal({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 20;

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => [latestPost, ...prev].slice(0, maxPosts));
    }
  }, [latestPost, maxPosts]);

  // Filter posts
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

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'text-emerald-600';
      case 'negative':
        return 'text-rose-600';
      case 'neutral':
        return 'text-slate-600';
      default:
        return 'text-slate-600';
    }
  };

  const getSentimentBg = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-50 border-emerald-200';
      case 'negative':
        return 'bg-rose-50 border-rose-200';
      case 'neutral':
        return 'bg-slate-50 border-slate-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div
      className={`minimal min-h-screen bg-white text-slate-900 ${className || ''}`}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-light tracking-tight text-slate-900">
                Bluesky Firehose
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-normal">
                Real-time social stream
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <span className="text-sm text-slate-600 font-normal">
                {connected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Total Posts
            </div>
            <div className="text-3xl font-light tabular-nums text-slate-900">
              {(stats?.totalPosts || 0).toLocaleString()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Posts / Minute
            </div>
            <div className="text-3xl font-light tabular-nums text-slate-900">
              {Math.round(stats?.postsPerMinute || 0)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Showing
            </div>
            <div className="text-3xl font-light tabular-nums text-slate-900">
              {filteredPosts.length}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Sentiment
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">
                  {stats?.sentimentCounts?.positive || 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-sm text-slate-600">
                  {stats?.sentimentCounts?.neutral || 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-sm text-slate-600">
                  {stats?.sentimentCounts?.negative || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="border-y border-slate-200 py-8 mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Language Filter */}
            <div className="space-y-3">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium block">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-900 text-sm font-normal focus:outline-none focus:border-slate-400 transition-colors"
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
            <div className="space-y-3">
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium block">
                Keyword
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Filter by keyword..."
                className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-900 text-sm font-normal placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Posts Feed */}
        <div className="space-y-8">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-slate-400 text-sm font-normal">
                No posts match your filters
              </p>
            </div>
          ) : (
            filteredPosts.map((post, index) => (
              <article
                key={post.uri || index}
                className={`border ${getSentimentBg(post.sentiment)} p-8 transition-all hover:shadow-sm`}
              >
                {/* Post Header */}
                <div className="flex items-baseline justify-between mb-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-medium text-slate-900">
                      @{post.author?.handle || 'anonymous'}
                    </span>
                    {post.language && (
                      <span className="text-xs text-slate-500 uppercase tracking-wider">
                        {post.language}
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-slate-400 font-normal">
                    {new Date(post.createdAt).toLocaleTimeString()}
                  </time>
                </div>

                {/* Post Content */}
                <p className={`text-base leading-relaxed ${getSentimentColor(post.sentiment)} mb-4`}>
                  {post.text}
                </p>

                {/* Media */}
                {(post.images || post.videos) && (
                  <div className="mb-4">
                    <MediaDisplay
                      images={post.images}
                      videos={post.videos}
                      variant="standard"
                      sensitive={post.sensitive}
                    />
                  </div>
                )}

                {/* Post Meta */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {post.hasImages && <span>Image</span>}
                  {post.hasVideo && <span>Video</span>}
                  {post.hasLink && <span>Link</span>}
                  {post.isReply && <span>Reply</span>}
                  {post.isQuote && <span>Quote</span>}
                  {post.hashtags && post.hashtags.length > 0 && (
                    <span>{post.hashtags.length} hashtags</span>
                  )}
                  {post.images?.some(img => !img.alt) && (
                    <span className="text-rose-600 font-medium">⚠️ No alt text</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-24">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <p className="text-xs text-slate-400 text-center font-normal tracking-wider uppercase">
            Minimal Design
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Minimal;
