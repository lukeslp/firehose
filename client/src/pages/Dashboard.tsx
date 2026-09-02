import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { useSocket } from '@/hooks/useSocket';
import type { BskyProfile, FirehosePost, FirehoseStats, MediaBundle } from '@/variants/types';

const TREND_MINUTES = 60;
const TIMEFRAMES = [
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '24h', minutes: 1440 },
  { label: '48h', minutes: 2880 },
];

type Sentiment = FirehosePost['sentiment'];
type SentimentFilter = Sentiment | 'all';

const languageNames: Record<string, string> = {
  ar: 'Arabic', de: 'German', en: 'English', es: 'Spanish', fr: 'French',
  hi: 'Hindi', id: 'Indonesian', it: 'Italian', ja: 'Japanese', ko: 'Korean',
  nl: 'Dutch', pl: 'Polish', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish',
  uk: 'Ukrainian', vi: 'Vietnamese', zh: 'Chinese', unknown: 'Unknown',
};

const sensitiveLabels = new Set(['porn', 'sexual', 'nudity', 'graphic-media', 'self-harm']);

function languageName(code: string) {
  const normalized = (code || 'unknown').toLowerCase().split('-')[0];
  return languageNames[normalized] ?? code.toUpperCase();
}

function sum<T>(values: T[], read: (value: T) => number) {
  return values.reduce((total, value) => total + read(value), 0);
}

function bskyUrl(uri: string) {
  const match = uri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/);
  return match ? `https://bsky.app/profile/${match[1]}/post/${match[2]}` : 'https://bsky.app';
}

function compactTime(value: Date | string | number) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function postKey(post: FirehosePost) {
  return post.uri || `${post.author?.did}:${post.createdAt}:${post.text}`;
}

export default function Dashboard() {
  const { connected, stats: socketStats, postBatch, acknowledgePostBatch, profiles } = useSocket();
  const [posts, setPosts] = useState<FirehosePost[]>([]);
  const [query, setQuery] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [timeframe, setTimeframe] = useState(60);
  const [viewPaused, setViewPaused] = useState(false);
  const [, setTick] = useState(0);
  const seenPostKeys = useRef(new Set<string>());
  const feedRef = useRef<VirtuosoHandle>(null);
  const historySeeded = useRef(false);

  const statsQuery = trpc.firehose.stats.useQuery(undefined, { enabled: !connected, refetchInterval: 5_000 });
  const recentPostsQuery = trpc.firehose.recentPosts.useQuery({ limit: 100 }, { refetchOnWindowFocus: false });
  const coverageQuery = trpc.stats.coverage.useQuery(undefined, { refetchInterval: 60_000 });
  const timelineQuery = trpc.stats.timeline.useQuery({ minutes: timeframe }, { refetchInterval: 10_000 });
  const englishSentimentQuery = trpc.stats.timelineForLanguage.useQuery(
    { minutes: timeframe, language: 'en' },
    { refetchInterval: 10_000 },
  );
  const languageQuery = trpc.stats.timelineByLanguage.useQuery(
    { minutes: TREND_MINUTES, top: 8 },
    { refetchInterval: 15_000 },
  );
  const contentQuery = trpc.stats.timelineByContentType.useQuery(
    { minutes: TREND_MINUTES },
    { refetchInterval: 15_000 },
  );
  const labelQuery = trpc.stats.timelineByLabel.useQuery(
    { minutes: TREND_MINUTES, top: 8 },
    { refetchInterval: 15_000 },
  );
  const accessibilityQuery = trpc.stats.accessibilityTimeline.useQuery(
    { minutes: 10 },
    { refetchInterval: 10_000 },
  );

  useEffect(() => {
    const interval = window.setInterval(() => setTick(value => value + 1), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recentPostsQuery.data || historySeeded.current) return;
    historySeeded.current = true;
    const historicalPosts = (recentPostsQuery.data as FirehosePost[]).filter(post => {
      const key = postKey(post);
      if (seenPostKeys.current.has(key)) return false;
      seenPostKeys.current.add(key);
      return true;
    });
    if (historicalPosts.length > 0) setPosts(previous => previous.concat(historicalPosts));
  }, [recentPostsQuery.data]);

  useEffect(() => {
    if (postBatch.length === 0) return;
    const batchSize = postBatch.length;
    if (viewPaused) {
      acknowledgePostBatch(batchSize);
      return;
    }
    const freshPosts = [...postBatch].reverse().filter(post => {
      const key = postKey(post);
      if (seenPostKeys.current.has(key)) return false;
      seenPostKeys.current.add(key);
      return true;
    });
    if (freshPosts.length > 0) setPosts(previous => freshPosts.concat(previous));
    acknowledgePostBatch(batchSize);
  }, [acknowledgePostBatch, postBatch, viewPaused]);

  const stats: FirehoseStats = socketStats ?? statsQuery.data ?? {
    totalPosts: 0,
    postsPerMinute: 0,
    sentimentCounts: { positive: 0, neutral: 0, negative: 0 },
    duration: 0,
    running: false,
    connected: false,
    lastEventAt: null,
  };

  const timeline = useMemo(() => (timelineQuery.data ?? []).map(row => {
    return {
      timestamp: new Date(row.minuteTimestamp).getTime(),
      time: compactTime(row.minuteTimestamp),
      rate: row.postsCount,
    };
  }), [timelineQuery.data]);

  const englishSentimentTimeline = useMemo(() => (englishSentimentQuery.data ?? []).map(row => {
    const analyzed = row.positiveCount + row.neutralCount + row.negativeCount;
    return {
      timestamp: new Date(row.minuteTimestamp).getTime(),
      time: compactTime(row.minuteTimestamp),
      count: analyzed,
      positive: analyzed ? row.positiveCount / analyzed * 100 : 0,
      neutral: analyzed ? row.neutralCount / analyzed * 100 : 0,
      negative: analyzed ? row.negativeCount / analyzed * 100 : 0,
      positiveCount: row.positiveCount,
      neutralCount: row.neutralCount,
      negativeCount: row.negativeCount,
    };
  }), [englishSentimentQuery.data]);

  const recentEnglishCounts = useMemo(() => {
    const cutoff = Date.now() - 5 * 60_000;
    const recent = englishSentimentTimeline.filter(point => point.timestamp >= cutoff);
    return {
      positive: sum(recent, point => point.positiveCount),
      neutral: sum(recent, point => point.neutralCount),
      negative: sum(recent, point => point.negativeCount),
    };
  }, [englishSentimentTimeline]);
  const recentEnglishTotal = Object.values(recentEnglishCounts).reduce((total, count) => total + count, 0);
  const recentEnglishPercentages = {
    positive: recentEnglishTotal ? recentEnglishCounts.positive / recentEnglishTotal * 100 : 0,
    neutral: recentEnglishTotal ? recentEnglishCounts.neutral / recentEnglishTotal * 100 : 0,
    negative: recentEnglishTotal ? recentEnglishCounts.negative / recentEnglishTotal * 100 : 0,
  };

  const fiveMinuteDelta = useMemo(() => {
    const target = Date.now() - 5 * 60_000;
    const baseline = [...timeline].reverse().find(point => point.timestamp <= target)?.rate;
    if (!baseline) return null;
    return Math.round((stats.postsPerMinute - baseline) / Math.max(1, baseline) * 100);
  }, [stats.postsPerMinute, timeline]);

  const accessibilityPulse = useMemo(() => {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60_000) * 60_000;
    const currentStart = currentMinute - 4 * 60_000;
    const previousStart = currentStart - 5 * 60_000;
    const rows = accessibilityQuery.data ?? [];
    const count = (from: number, until: number) => rows.filter(row => {
      const timestamp = new Date(row.minuteTimestamp).getTime();
      return timestamp >= from && timestamp < until;
    }).reduce((value, row) => ({ images: value.images + row.images, withAlt: value.withAlt + row.imagesWithAlt }), { images: 0, withAlt: 0 });
    const current = count(currentStart, currentMinute + 60_000);
    const previous = count(previousStart, currentStart);
    const currentRate = current.images ? current.withAlt / current.images : null;
    const previousRate = previous.images ? previous.withAlt / previous.images : null;
    return { ...current, currentRate, delta: currentRate != null && previousRate != null ? (currentRate - previousRate) * 100 : null };
  }, [accessibilityQuery.data]);

  const languageTrends = useMemo(() => (languageQuery.data ?? []).map(item => ({
    key: item.language,
    label: languageName(item.language),
    count: sum(item.series, point => point.postsCount),
    series: item.series.map(point => point.postsCount),
  })).sort((a, b) => b.count - a.count).slice(0, 6), [languageQuery.data]);

  const contentTrends = useMemo(() => {
    const labels: Record<string, string> = { text: 'Text only', image: 'With images', video: 'With video', link: 'With links' };
    return (contentQuery.data ?? []).map(item => ({
      key: item.contentType,
      label: labels[item.contentType] ?? item.contentType,
      count: sum(item.series, point => point.postsCount),
      series: item.series.map(point => point.postsCount),
    })).sort((a, b) => b.count - a.count);
  }, [contentQuery.data]);

  const labelTrends = useMemo(() => (labelQuery.data ?? []).map(item => ({
    key: item.label,
    label: item.label,
    count: sum(item.series, point => point.postsCount),
    series: item.series.map(point => point.postsCount),
  })).sort((a, b) => b.count - a.count).slice(0, 6), [labelQuery.data]);

  const availableLanguages = useMemo(() => {
    const values = new Set(posts.map(post => post.language).filter(Boolean) as string[]);
    return Array.from(values).sort((a, b) => languageName(a).localeCompare(languageName(b)));
  }, [posts]);

  const visiblePosts = useMemo(() => posts.filter(post => {
    if (sentimentFilter !== 'all' && (post.sentimentAnalyzed === false || post.sentiment !== sentimentFilter)) return false;
    if (languageFilter !== 'all' && post.language !== languageFilter) return false;
    if (keywords.length === 0) return true;
    const haystack = `${post.text} ${post.author?.handle ?? ''}`.toLowerCase();
    return keywords.some(keyword => haystack.includes(keyword));
  }), [keywords, languageFilter, posts, sentimentFilter]);

  useEffect(() => {
    if (viewPaused || visiblePosts.length === 0) return;
    feedRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'auto' });
  }, [viewPaused, visiblePosts.length]);

  const applySearch = () => setKeywords(query.split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  const resetFilters = () => {
    setQuery('');
    setKeywords([]);
    setSentimentFilter('all');
    setLanguageFilter('all');
  };
  const filtersActive = keywords.length > 0 || sentimentFilter !== 'all' || languageFilter !== 'all';
  const freshness = stats.lastEventAt
    ? Math.max(0, Math.floor((Date.now() - new Date(stats.lastEventAt).getTime()) / 1_000))
    : null;
  const minutesAvailable = coverageQuery.data?.minutesAvailable ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background px-3 py-2 sm:px-4 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">Bluesky Firehose</h1>
        <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--bsky-blue)' }}>
          Full AT Protocol stream · English-tagged sentiment analysis
        </p>
      </header>

      <section aria-labelledby="filters-title" className="border-b border-border px-3 py-2 sm:px-4 sm:py-3 md:px-6">
        <h2 id="filters-title" className="sr-only">Filter the live feed</h2>
        <p className="mb-2 text-xs text-muted-foreground">Stream is live · filters only affect your view</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="inline-flex self-start overflow-hidden rounded-md border border-border text-xs" aria-label="Filter by sentiment">
            {(['all', 'positive', 'neutral', 'negative'] as SentimentFilter[]).map((value, index) => (
              <button
                key={value}
                type="button"
                aria-pressed={sentimentFilter === value}
                onClick={() => setSentimentFilter(value)}
                className={`min-h-10 px-3 py-2 font-medium capitalize transition-colors ${index ? 'border-l border-border' : ''}`}
                style={{
                  backgroundColor: sentimentFilter === value ? 'var(--muted)' : 'transparent',
                  color: value === 'all' ? 'var(--foreground)' : `var(--sentiment-${value})`,
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applySearch(); } }}
            placeholder="Filter by keyword (comma-separated)"
            aria-label="Filter posts by keyword"
            className="min-h-10 flex-1 text-sm"
          />
          <button type="button" onClick={applySearch} className="min-h-10 rounded-md border border-border px-5 text-sm font-medium hover:bg-muted">Search</button>
          <button type="button" onClick={resetFilters} disabled={!filtersActive && !query} className="min-h-10 rounded-md border border-border px-5 text-sm font-medium hover:bg-muted disabled:opacity-40">Reset</button>
        </div>
        {filtersActive && <p className="mt-2 text-xs text-muted-foreground">Showing {visiblePosts.length.toLocaleString()} matching posts received since page load.</p>}
      </section>

      <section aria-label="Live network summary" className="border-b border-border px-3 py-2 sm:px-4 sm:py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Posts/min</span>
            <strong className="text-2xl tabular-nums sm:text-3xl" style={{ color: 'var(--bsky-blue)' }}>{stats.postsPerMinute.toLocaleString()}</strong>
          </div>
          <MoodMeter {...recentEnglishPercentages} sampleSize={recentEnglishTotal} />
          <a
            href="/bluesky/firehose/accessibility/"
            className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
            aria-label={accessibilityPulse.currentRate == null
              ? 'Open Accessibility Observatory; waiting for observed image posts'
              : `Open Accessibility Observatory. Images with alt in the last five minutes: ${(accessibilityPulse.currentRate * 100).toFixed(1)} percent, ${accessibilityPulse.withAlt} of ${accessibilityPulse.images} images.`}
          >
            <span className="block text-muted-foreground">Images with alt · 5m</span>
            <strong className="tabular-nums" style={{ color: 'var(--bsky-blue)' }}>{accessibilityPulse.currentRate == null ? 'Waiting for images' : `${(accessibilityPulse.currentRate * 100).toFixed(1)}% · n=${accessibilityPulse.images.toLocaleString()}`}</strong>
            {accessibilityPulse.delta != null && <span className="ml-1 tabular-nums text-muted-foreground">{accessibilityPulse.delta >= 0 ? '▲' : '▼'} {Math.abs(accessibilityPulse.delta).toFixed(1)} pp</span>}
          </a>
          <div className="ml-auto text-xs font-medium tabular-nums text-muted-foreground" aria-hidden="true">
            FULL STREAM · {connected ? 'LIVE' : 'RECONNECTING'} · {freshness == null ? 'WAITING FOR EVENT' : `${freshness}s AGO`}
            {fiveMinuteDelta != null && <> · {fiveMinuteDelta >= 0 ? '▲' : '▼'}{Math.abs(fiveMinuteDelta)}% VS 5M</>}
          </div>
          <span className="sr-only" aria-live="polite">{connected ? 'Live stream connected' : 'Live stream reconnecting'}</span>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row">
        <aside aria-labelledby="sentiment-title" className="order-2 w-full border-b border-border lg:order-1 lg:w-64 lg:flex-shrink-0 lg:border-b-0 lg:border-r xl:w-72">
          <div className="p-4 lg:p-5">
            <h2 id="sentiment-title" className="mb-1 text-xs font-bold">English sentiment</h2>
            <p className="mb-5 text-[11px] text-muted-foreground">Rolling 5 minutes · AFINN lexicon</p>
            <SentimentColumn counts={recentEnglishCounts} percentages={recentEnglishPercentages} />
          </div>
        </aside>

        <main className="order-1 min-w-0 flex-1 lg:order-2">
          <section aria-labelledby="feed-title" className="border-b border-border">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 sm:px-4">
              <button
                type="button"
                onClick={() => setViewPaused(value => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border"
                style={{ borderColor: 'var(--bsky-blue)', color: 'var(--bsky-blue)', background: 'color-mix(in oklab, var(--bsky-blue) 10%, transparent)' }}
                aria-label={viewPaused ? 'Resume live feed view' : 'Pause live feed view'}
                title={viewPaused ? 'Resume live feed view' : 'Pause live feed view'}
              >
                {viewPaused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <h2 id="feed-title" className="text-sm font-semibold">Live feed</h2>
              <select
                value={languageFilter}
                onChange={event => setLanguageFilter(event.target.value)}
                aria-label="Filter live feed by language"
                className="ml-auto min-h-10 rounded-md border border-border bg-background px-3 text-xs"
              >
                <option value="all">All languages</option>
                {availableLanguages.map(language => <option key={language} value={language}>{languageName(language)}</option>)}
              </select>
              <button type="button" onClick={() => document.getElementById('feed-stream')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="min-h-10 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted">Focus feed</button>
            </div>
            <div id="feed-stream" className="h-[70vh] min-h-[34rem] max-h-[58rem]" aria-label="Live Bluesky posts">
              {visiblePosts.length === 0 ? (
                <p className="py-20 text-center text-sm text-muted-foreground">Waiting for matching posts…</p>
              ) : (
                <Virtuoso
                  ref={feedRef}
                  data={visiblePosts}
                  initialTopMostItemIndex={0}
                  computeItemKey={(_index, post) => postKey(post)}
                  aria-label="Unsampled live Bluesky post stream"
                  itemContent={(_index, post) => (
                    <div className="px-3 pb-3 first:pt-3 sm:px-4">
                      <PostCard post={post} profile={profiles[post.author.did]} />
                    </div>
                  )}
                />
              )}
            </div>
          </section>

          <section aria-label="One-hour trends" className="grid border-b border-border md:grid-cols-3 md:divide-x md:divide-border">
            <LanguageTrends rows={languageTrends} />
            <TrendList title="Content types" rows={contentTrends} color="var(--bsky-blue)" />
            <TrendList title="Moderation labels" rows={labelTrends} labelColors />
          </section>

          <ChartSection title={`English sentiment · last ${TIMEFRAMES.find(item => item.minutes === timeframe)?.label ?? `${timeframe}m`}`} timeframe={timeframe} onTimeframe={setTimeframe} minutesAvailable={minutesAvailable}>
            <div role="img" aria-label="Stacked area chart of positive, neutral, and negative sentiment for English-tagged posts over time">
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={englishSentimentTimeline} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.65} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis width={36} domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={value => String(Math.round(Number(value)))} />
                  <Tooltip />
                  <Area type="monotone" dataKey="positive" stackId="sentiment" stroke="var(--sentiment-positive)" fill="var(--sentiment-positive)" fillOpacity={0.24} isAnimationActive={false} />
                  <Area type="monotone" dataKey="neutral" stackId="sentiment" stroke="var(--sentiment-neutral)" fill="var(--sentiment-neutral)" fillOpacity={0.28} isAnimationActive={false} />
                  <Area type="monotone" dataKey="negative" stackId="sentiment" stroke="var(--sentiment-negative)" fill="var(--sentiment-negative)" fillOpacity={0.2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartSection>

          <ChartSection title={`Posts per minute · last ${TIMEFRAMES.find(item => item.minutes === timeframe)?.label ?? `${timeframe}m`}`} timeframe={timeframe} onTimeframe={setTimeframe} minutesAvailable={minutesAvailable}>
            <div role="img" aria-label="Line chart of posts per minute over time">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={timeline} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeOpacity={0.65} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={24} />
                  <YAxis width={44} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" stroke="var(--bsky-blue)" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartSection>
        </main>
      </div>

      <footer className="flex justify-end gap-3 border-t-2 border-foreground px-4 py-4 text-xs font-semibold sm:px-6">
        <a className="min-h-11 border border-border px-7 py-3 hover:bg-muted" href="https://lukesteuber.com">lukesteuber.com</a>
        <a className="min-h-11 border border-border px-7 py-3 hover:bg-muted" href="https://datapoems.io">datapoems.io</a>
      </footer>
    </div>
  );
}

function SentimentColumn({ counts, percentages }: { counts: FirehoseStats['sentimentCounts']; percentages: Record<Sentiment, number> }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex h-64 w-14 flex-col overflow-hidden rounded-md border border-border" role="img" aria-label={`Positive ${percentages.positive.toFixed(1)} percent, neutral ${percentages.neutral.toFixed(1)} percent, negative ${percentages.negative.toFixed(1)} percent`}>
        <div style={{ height: `${percentages.positive}%`, background: 'var(--sentiment-positive)' }} />
        <div style={{ height: `${percentages.neutral}%`, background: 'var(--sentiment-neutral)' }} />
        <div style={{ height: `${percentages.negative}%`, background: 'var(--sentiment-negative)' }} />
      </div>
      <div className="w-full space-y-4">
        {(['positive', 'neutral', 'negative'] as Sentiment[]).map(value => (
          <div key={value} className="grid grid-cols-[1fr_auto] gap-x-3">
            <span className="flex items-center gap-2 text-xs font-semibold capitalize"><i className="h-3 w-3" style={{ background: `var(--sentiment-${value})` }} />{value}</span>
            <strong className="text-lg tabular-nums">{counts[value].toLocaleString()}</strong>
            <span />
            <span className="text-xs tabular-nums text-muted-foreground">{percentages[value].toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoodMeter({ positive, neutral, negative, sampleSize }: Record<Sentiment, number> & { sampleSize: number }) {
  const net = positive - negative;
  const position = Math.min(100, Math.max(0, (net + 100) / 2));
  const color = net > 2 ? 'var(--sentiment-positive)' : net < -2 ? 'var(--sentiment-negative)' : 'var(--muted-foreground)';
  return (
    <div className="flex items-center gap-3" role="img" aria-label={sampleSize ? `English mood over the last 5 minutes: ${net >= 0 ? 'plus ' : 'minus '}${Math.abs(net).toFixed(0)}; neutral ${neutral.toFixed(0)} percent; ${sampleSize} posts analyzed` : 'Waiting for English sentiment samples'}>
      <span className="hidden text-xs font-medium text-muted-foreground sm:block">English mood · 5m</span>
      <div className="relative h-2 w-28 rounded-full sm:w-40" style={{ background: 'linear-gradient(90deg, var(--sentiment-negative), var(--sentiment-neutral), var(--sentiment-positive))' }}>
        <i className="absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--background)]" style={{ left: `calc(${position}% - 1.5px)`, background: color }} />
      </div>
      <strong className="min-w-[3ch] text-sm tabular-nums" style={{ color }}>{sampleSize ? `${net >= 0 ? '+' : ''}${net.toFixed(0)}` : '—'}</strong>
    </div>
  );
}

function PostCard({ post, profile }: { post: FirehosePost; profile?: BskyProfile }) {
  const handle = profile?.handle || post.author.handle;
  const resolving = !profile && handle.startsWith('did:');
  const labels = profile?.labels?.filter(label => !label.neg).map(label => label.val) ?? [];
  const sentimentColor = post.sentimentAnalyzed === false ? 'var(--muted-foreground)' : `var(--sentiment-${post.sentiment})`;
  const sentimentLabel = post.sentimentAnalyzed === false ? 'not scored' : post.sentiment;
  return (
    <article className="feed-card border-l-2 py-2 pl-3" style={{ borderColor: sentimentColor }}>
      <div className="flex items-start gap-2">
        <Avatar profile={profile} seed={post.author.did} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`max-w-52 truncate ${resolving ? 'italic' : 'font-semibold text-foreground'}`}>{resolving ? 'resolving…' : (profile?.displayName || `@${handle}`)}</span>
            <span className="rounded-sm px-1.5 py-0.5 text-foreground" style={{ background: `color-mix(in oklab, ${sentimentColor} 18%, transparent)` }}>{sentimentLabel}</span>
            <span>{post.language || '—'}</span><span>·</span><time dateTime={post.createdAt}>{compactTime(post.createdAt)}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-snug sm:text-[15px]">{post.text}</p>
          <PostMedia media={post.media} />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {post.isReply && <span>↩ Reply</span>}
            {post.isQuote && <span>▢ Quote</span>}
            {labels.slice(0, 3).map(label => <span key={label} className="rounded-sm bg-muted px-1">{label}</span>)}
            <a className="hover:text-foreground" href={bskyUrl(post.uri)} target="_blank" rel="noreferrer">↗ View on Bluesky</a>
          </div>
        </div>
      </div>
    </article>
  );
}

function Avatar({ profile, seed }: { profile?: BskyProfile; seed: string }) {
  const initials = (profile?.displayName || profile?.handle || seed).split(/[.\s:_-]+/).filter(Boolean).slice(0, 2).map(value => value[0]).join('').toUpperCase();
  return profile?.avatar ? (
    <img className="h-8 w-8 flex-none rounded-full object-cover" src={profile.avatar} alt="" loading="lazy" />
  ) : (
    <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: 'var(--bsky-blue)' }} aria-hidden="true">{initials || 'BS'}</span>
  );
}

function PostMedia({ media }: { media?: MediaBundle }) {
  if (!media) return null;
  return (
    <div className="mt-2 max-w-2xl">
      {media.images && <div className={`grid gap-1 overflow-hidden rounded-md ${media.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {media.images.map((image, index) => <a key={image.fullsize} href={image.fullsize} target="_blank" rel="noreferrer"><img className="max-h-72 w-full object-cover" src={image.thumb} alt={image.alt || `Attached image ${index + 1}`} loading="lazy" /></a>)}
      </div>}
      {media.linkCard && <a href={media.linkCard.uri} target="_blank" rel="noreferrer" className="grid grid-cols-[5rem_1fr] overflow-hidden rounded-md border border-border hover:bg-muted">
        {media.linkCard.thumb ? <img className="h-full min-h-20 w-20 object-cover" src={media.linkCard.thumb} alt="" loading="lazy" /> : <span className="min-h-20 bg-muted" />}
        <span className="min-w-0 p-2"><strong className="block truncate text-xs">{media.linkCard.title || media.linkCard.uri}</strong><span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{media.linkCard.description}</span></span>
      </a>}
      {media.video && <a href={media.video.playlist} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-md"><img className="max-h-72 w-full object-cover" src={media.video.thumb} alt="Video thumbnail" loading="lazy" /><span className="absolute inset-0 grid place-items-center text-3xl text-white drop-shadow">▶</span></a>}
    </div>
  );
}

function LanguageTrends({ rows }: { rows: Array<{ key: string; label: string; count: number; series: number[] }> }) {
  const total = sum(rows, row => row.count);
  return <div className="p-3 sm:p-4"><h2 className="mb-3 text-xs font-semibold">Top languages</h2><div className="space-y-2">{rows.map(row => <div key={row.key} className="flex items-center gap-2"><span className="flex-1 truncate text-xs">{row.label}</span><Sparkline data={row.series} color="var(--bsky-blue)" label={`Post volume trend for ${row.label}`} /><strong className="w-16 text-right text-sm tabular-nums">{row.count.toLocaleString()}</strong><span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{total ? (row.count / total * 100).toFixed(1) : '0.0'}%</span></div>)}</div></div>;
}

function TrendList({ title, rows, color = 'var(--muted-foreground)', labelColors = false }: { title: string; rows: Array<{ key: string; label: string; count: number; series: number[] }>; color?: string; labelColors?: boolean }) {
  const total = sum(rows, row => row.count);
  return <div className="p-3 sm:p-4"><h2 className="mb-3 text-xs font-semibold">{title}</h2>{rows.length === 0 ? <p className="py-4 text-xs text-muted-foreground">No labels attributed yet</p> : <div className="space-y-2">{rows.map(row => { const rowColor = labelColors && sensitiveLabels.has(row.key) ? 'var(--destructive)' : color; return <div key={row.key} className="flex items-center gap-2"><span className="flex-1 truncate text-xs" style={{ color: labelColors && sensitiveLabels.has(row.key) ? rowColor : undefined }} title={row.label}>{row.label}</span><Sparkline data={row.series} color={rowColor} label={`${title} trend for ${row.label}`} /><strong className="w-16 text-right text-sm tabular-nums">{row.count.toLocaleString()}</strong>{!labelColors && <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{total ? (row.count / total * 100).toFixed(1) : '0.0'}%</span>}</div>; })}</div>}</div>;
}

function Sparkline({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(1, ...data);
  const points = data.map((value, index) => `${data.length === 1 ? 28 : index / (data.length - 1) * 56},${16 - value / max * 14}`).join(' ');
  return <svg viewBox="0 0 56 16" className="h-4 w-14" role="img" aria-label={label}><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>;
}

function ChartSection({ title, timeframe, onTimeframe, minutesAvailable, children }: { title: string; timeframe: number; onTimeframe: (minutes: number) => void; minutesAvailable: number; children: ReactNode }) {
  return <section className="border-b border-border p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xs font-semibold">{title} <span className="ml-2 font-normal text-muted-foreground">● Live</span></h2><div className="inline-flex overflow-hidden rounded-md border border-border text-xs" role="tablist" aria-label="Select chart timeframe">{TIMEFRAMES.map((item, index) => { const unavailable = minutesAvailable > 0 && item.minutes > minutesAvailable + 2; return <button key={item.minutes} type="button" role="tab" aria-selected={timeframe === item.minutes} disabled={unavailable} onClick={() => onTimeframe(item.minutes)} className={`min-h-10 px-3 font-medium ${index ? 'border-l border-border' : ''} disabled:cursor-not-allowed disabled:opacity-35`} style={{ color: timeframe === item.minutes ? 'var(--bsky-blue)' : 'var(--muted-foreground)', background: timeframe === item.minutes ? 'var(--muted)' : 'transparent' }} title={unavailable ? `Only ${minutesAvailable} minutes of history available` : `Show ${item.label}`}>{item.label}</button>; })}</div></div>{children}</section>;
}

function PauseIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>; }
function PlayIcon() { return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>; }
