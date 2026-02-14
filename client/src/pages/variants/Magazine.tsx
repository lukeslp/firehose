/**
 * Magazine.tsx - Editorial magazine layout variant
 *
 * Aesthetic: High-end print magazine (Vogue, Monocle, Kinfolk)
 * Theme: Sophisticated typography, editorial grid, elegant serif
 * Typography: Playfair Display (display), Lora (body), precise hierarchy
 * Layout: Editorial columns, pull quotes, featured content
 */

import { useSocket } from '@/hooks/useSocket';
import { useState, useEffect, useMemo } from 'react';
import type { FirehosePost, VariantProps } from './types';
import { MediaDisplay } from '@/components/MediaDisplay';

export function Magazine({ className }: VariantProps) {
  const { connected, stats, latestPost } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const maxPosts = 20;
  const [featuredPost, setFeaturedPost] = useState<FirehosePost | null>(null);

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [keywordFilter, setKeywordFilter] = useState<string>('');

  // Update posts feed
  useEffect(() => {
    if (latestPost) {
      setPosts(prev => {
        const updated = [latestPost, ...prev].slice(0, maxPosts);
        // Feature first positive post with hashtags
        const featured = updated.find(p => p.sentiment === 'positive' && p.hashtags && p.hashtags.length > 0);
        if (featured && !featuredPost) {
          setFeaturedPost(featured);
        }
        return updated;
      });
    }
  }, [latestPost, maxPosts, featuredPost]);

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

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return { border: 'border-l-4 border-emerald-700', text: 'text-emerald-900' };
      case 'negative':
        return { border: 'border-l-4 border-rose-700', text: 'text-rose-900' };
      default:
        return { border: 'border-l-4 border-stone-400', text: 'text-stone-900' };
    }
  };

  return (
    <div
      className={`magazine min-h-screen bg-stone-50 text-stone-900 ${className || ''}`}
    >
      {/* Masthead */}
      <header className="border-b-2 border-stone-900 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-end justify-between">
            <div>
              <h1
                className="text-5xl tracking-tight text-stone-900 mb-1"
                style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 700 }}
              >
                Bluesky
              </h1>
              <p
                className="text-sm tracking-widest uppercase text-stone-600"
                style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.2em' }}
              >
                Live Social Stream — Vol. I
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  connected ? 'bg-emerald-700' : 'bg-stone-400'
                }`}
              />
              <span className="text-xs uppercase tracking-wider text-stone-600">
                {connected ? 'Live Edition' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Editorial Layout */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Issue Info Bar */}
        <div className="border-y border-stone-300 py-4 mb-12">
          <div className="grid grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                Articles
              </div>
              <div
                className="text-2xl tabular-nums text-stone-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {(stats?.totalPosts || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                Per Minute
              </div>
              <div
                className="text-2xl tabular-nums text-stone-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {Math.round(stats?.postsPerMinute || 0)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                Featured
              </div>
              <div
                className="text-2xl tabular-nums text-stone-900"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {filteredPosts.length}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-stone-500 mb-1">
                Sentiment
              </div>
              <div className="flex justify-center gap-3 mt-2">
                <span className="text-emerald-700 text-sm">
                  {stats?.sentimentCounts?.positive || 0}
                </span>
                <span className="text-stone-400">·</span>
                <span className="text-rose-700 text-sm">
                  {stats?.sentimentCounts?.negative || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial Controls */}
        <div className="bg-white border border-stone-200 p-6 mb-12">
          <h2
            className="text-lg mb-6 text-stone-900"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600 }}
          >
            Filter Articles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Language */}
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-600 block mb-2">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 text-stone-900 text-sm focus:outline-none focus:border-stone-500"
                style={{ fontFamily: 'Lora, Georgia, serif' }}
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

            {/* Keyword */}
            <div>
              <label className="text-xs uppercase tracking-widest text-stone-600 block mb-2">
                Keyword
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
                placeholder="Search articles..."
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-500"
                style={{ fontFamily: 'Lora, Georgia, serif' }}
              />
            </div>
          </div>
        </div>

        {/* Featured Article */}
        {featuredPost && (
          <div className="bg-white border-2 border-stone-900 p-8 mb-12">
            <div className="text-xs uppercase tracking-widest text-emerald-700 mb-4">
              Featured Article
            </div>
            <h2
              className="text-3xl leading-tight mb-4 text-stone-900"
              style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 600 }}
            >
              {featuredPost.text.slice(0, 120)}
              {featuredPost.text.length > 120 && '...'}
            </h2>
            <div className="flex items-center gap-4 text-sm text-stone-600 mb-4">
              <span style={{ fontFamily: 'Lora, Georgia, serif' }}>
                @{featuredPost.author?.handle || 'anonymous'}
              </span>
              <span>·</span>
              <time>{new Date(featuredPost.createdAt).toLocaleDateString()}</time>
            </div>
            {featuredPost.hashtags && featuredPost.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {featuredPost.hashtags.slice(0, 5).map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-stone-100 text-xs uppercase tracking-wider text-stone-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Articles Grid */}
        <div className="space-y-8">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200">
              <p
                className="text-stone-400 italic"
                style={{ fontFamily: 'Lora, Georgia, serif' }}
              >
                No articles match your selection
              </p>
            </div>
          ) : (
            filteredPosts.map((post, index) => {
              const style = getSentimentStyle(post.sentiment);

              return (
                <article
                  key={post.uri || index}
                  className={`bg-white ${style.border} pl-6 pr-6 py-6 hover:shadow-md transition-shadow`}
                >
                  {/* Byline */}
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-sm text-stone-900"
                        style={{ fontFamily: 'Lora, Georgia, serif', fontWeight: 600 }}
                      >
                        {post.author?.displayName || post.author?.handle || 'Anonymous'}
                      </span>
                      {post.language && (
                        <span className="text-xs uppercase tracking-wider text-stone-500">
                          {post.language}
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-stone-400">
                      {new Date(post.createdAt).toLocaleTimeString()}
                    </time>
                  </div>

                  {/* Article Text */}
                  <p
                    className={`text-base leading-relaxed ${style.text} mb-4`}
                    style={{ fontFamily: 'Lora, Georgia, serif' }}
                  >
                    {post.text}
                  </p>

                  {/* Media */}
                  {(post.images || post.videos) && (
                    <div className="mb-4">
                      <MediaDisplay
                        images={post.images}
                        videos={post.videos}
                        variant="large"
                        sensitive={post.sensitive}
                      />
                    </div>
                  )}

                  {/* Article Meta */}
                  <div className="flex items-center gap-4 text-xs uppercase tracking-wider text-stone-500">
                    {post.hasImages && <span>Photography</span>}
                    {post.hasVideo && <span>Video</span>}
                    {post.hasLink && <span>External</span>}
                    {post.isReply && <span>Correspondence</span>}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <span>Tagged · {post.hashtags.length}</span>
                    )}
                    {post.images?.some(img => !img.alt) && (
                      <span className="text-rose-700">Missing Alt Text</span>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      {/* Colophon */}
      <footer className="border-t-2 border-stone-900 mt-20 bg-white">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <p
            className="text-center text-xs uppercase tracking-widest text-stone-500"
          >
            Magazine Edition — Real-time Publishing
          </p>
        </div>
      </footer>

      {/* Load Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
      `}</style>
    </div>
  );
}

export default Magazine;
