import React from 'react';
import { Link } from 'wouter';

interface Variant {
  id: string;
  name: string;
  description: string;
  aesthetic: string;
  tags: string[];
  color: string;
}

const variants: Variant[] = [
  {
    id: 'mission-control',
    name: 'Mission Control',
    description: 'NASA control room meets Bloomberg terminal. Monitor the Bluesky firehose like a living system.',
    aesthetic: 'Dark theme, monospace fonts, modular panels, terminal-inspired',
    tags: ['Professional', 'Data Observatory', 'Tech'],
    color: '#00f0ff'
  },
  {
    id: 'cosmic-nexus',
    name: 'Cosmic Nexus',
    description: 'Posts become stars in a nebula. Sentiment creates color fields. Data as art.',
    aesthetic: 'Deep space, particle system, glowing halos, ethereal',
    tags: ['Visual', 'Immersive', 'Artistic'],
    color: '#60efff'
  },
  {
    id: 'editorial',
    name: 'Editorial',
    description: 'The New York Times meets real-time data. Posts presented as headlines in a refined reading experience.',
    aesthetic: 'Elegant serif typography, columns layout, newspaper design',
    tags: ['Classic', 'Reading', 'Sophisticated'],
    color: '#1a1a1a'
  },
  {
    id: 'retro-arcade',
    name: 'Retro Arcade',
    description: 'Posts are game sprites. 8-bit nostalgia meets real-time analytics. Fun and unexpected.',
    aesthetic: 'Pixel art, chiptune sounds, score counters, gaming UI',
    tags: ['Fun', 'Nostalgic', 'Playful'],
    color: '#ff00ff'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean minimalist design with generous whitespace. Japanese minimalism meets Swiss typography.',
    aesthetic: 'Generous whitespace, neutral palette, clean sans-serif, focus on content',
    tags: ['Minimal', 'Modern', 'Clean'],
    color: '#000000'
  },
  {
    id: 'dashboard-pro',
    name: 'Dashboard Pro',
    description: 'Professional analytics dashboard. Bloomberg Terminal meets Tableau with data-dense metrics and real-time charts.',
    aesthetic: 'Data-dense grid, KPI panels, charts, professional layout',
    tags: ['Analytics', 'Professional', 'Data-Driven'],
    color: '#1e40af'
  },
  {
    id: 'magazine',
    name: 'Magazine',
    description: 'High-end editorial magazine layout. Sophisticated typography and refined reading experience.',
    aesthetic: 'Serif typography, editorial columns, featured articles, magazine design',
    tags: ['Editorial', 'Elegant', 'Reading'],
    color: '#78350f'
  }
];

export default function VariantIndex() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Link href="/">
            <a className="text-sm text-white/60 hover:text-white transition mb-4 inline-block">
              ← Back to Dashboard
            </a>
          </Link>
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Firehose UX Variants
          </h1>
          <p className="text-xl text-white/70 max-w-3xl">
            Seven completely different approaches to visualizing the Bluesky real-time post stream.
            Each with a unique personality, aesthetic, and interaction model.
          </p>
        </div>
      </header>

      {/* Variants Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {variants.map((variant) => (
            <Link key={variant.id} href={`/variants/${variant.id}`}>
              <a className="group block">
                <div
                  className="relative h-96 rounded-xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl"
                  style={{
                    boxShadow: `0 0 40px ${variant.color}20`
                  }}
                >
                  {/* Preview placeholder - will be replaced with actual screenshots */}
                  <div
                    className="absolute inset-0 bg-gradient-to-br opacity-20"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${variant.color}40, transparent)`
                    }}
                  />

                  {/* Content */}
                  <div className="absolute inset-0 p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: variant.color }}
                        />
                        <h2 className="text-3xl font-bold">{variant.name}</h2>
                      </div>
                      <p className="text-white/80 text-lg mb-4">
                        {variant.description}
                      </p>
                      <p className="text-sm text-white/50 italic">
                        {variant.aesthetic}
                      </p>
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {variant.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 rounded-full bg-white/10 text-sm border border-white/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/60">
                          Click to explore →
                        </span>
                        <div className="text-sm text-white/60 group-hover:text-white transition">
                          Launch
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hover effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at center, ${variant.color}15, transparent 70%)`
                    }}
                  />
                </div>
              </a>
            </Link>
          ))}
        </div>

        {/* Info Footer */}
        <div className="mt-16 p-8 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-xl font-bold mb-3">About These Variants</h3>
          <p className="text-white/70 mb-4">
            Each variant connects to the same real-time Bluesky Jetstream WebSocket and displays
            the same data - posts, sentiment analysis, language distribution, and hashtag trends.
            The difference is entirely in the presentation and user experience.
          </p>
          <p className="text-white/60 text-sm">
            All variants are built with React, TypeScript, and Socket.IO. Choose the aesthetic
            that resonates with you or matches your use case.
          </p>
        </div>
      </main>
    </div>
  );
}
