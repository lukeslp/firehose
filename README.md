# Bluesky Firehose

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A real-time Bluesky analytics dashboard. It reads the Jetstream WebSocket and shows a live post feed, sentiment analysis, rate tracking, and a rolling sentiment timeline.

**[Open the live dashboard.](https://dr.eamer.dev/bluesky/firehose/)**

<img width="2250" height="1424" alt="Bluesky Firehose dashboard showing a live post feed, stream controls, and sentiment analytics." src="https://github.com/user-attachments/assets/dfd16755-0a5c-45d7-8fce-bcac5583c493" />

## What it does

- **Live post feed** from Bluesky's Jetstream WebSocket; English-tagged posts carry sentiment and other languages remain unscored
- **Rolling English sentiment** using the AFINN lexicon, with a five-minute mood signal and up to 48 hours of history
- **Full-rate public stream** with no default sampling
- **Historical timelines** for event rate, sentiment, languages, content types, and moderation labels
- **Keyword and sentiment filters** that affect only the viewer's feed
- **SQLite persistence** for 48 hours of lightweight minute aggregates
- **Optional raw archive** as bounded, rotated NDJSON.zst segments with cursor recovery; separate from the filtered research corpus
- **Accessibility pulse and observatory** with exact image-description coverage, declared-language aggregates, and a delayed deterministic description sample

## Quick start

```bash
git clone https://github.com/lukeslp/firehose.git
cd firehose
pnpm install
pnpm dev
```

Open `http://localhost:3000/`. The firehose starts automatically.

<img width="2616" height="1410" alt="Bluesky Firehose dashboard showing the sentiment timeline, post feed, and stream statistics." src="https://github.com/user-attachments/assets/bb32286f-ce01-4066-ba8b-51408ece0d1e" />

## Stack

**Frontend**: React 19, Recharts, shadcn/ui (Radix), Tailwind CSS 4, Socket.IO client

**Backend**: Express, tRPC, Drizzle ORM + SQLite, Socket.IO, `sentiment` (NLP)

**Build**: Vite, esbuild, pnpm

## How it works

```
Bluesky Jetstream WebSocket
  → FirehoseService (English AFINN sentiment + feature extraction)
    ├→ In-memory stats (real-time)
    ├→ SQLite minute aggregates (always on, 48-hour retention)
    ├→ Filtered raw-post corpus (operator-controlled, off by default)
    └→ Socket.IO broadcast
         → React Dashboard

Separate resumable Jetstream connection (optional)
  → RawArchiveRecorder
    → post commits plus account/identity markers
    → 15-minute archive-format-v2 NDJSON.zst segments
    → atomic manifests + durable cursor checkpoint
    → 24-hour / 2 GiB local safety envelope by default

Sealed format-v2 segments (separate Python publisher)
  → exact daily accessibility aggregates
  → 48-hour correction window and bottom-k sample
  → atomic public dashboard snapshot
  → monthly Parquet shards on Hugging Face
```

The server connects to `wss://jetstream2.us-east.bsky.network`, analyzes explicitly English-tagged posts with the bundled AFINN lexicon, persists aggregate minute buckets every 10 seconds, broadcasts statistics every second, and forwards every received post to connected clients. Posts in every language remain in the unsampled public stream; non-English and untagged posts are marked unscored rather than treated as neutral.

## Environment

```bash
PORT=5052               # Server port (default: 3000)
DATABASE_URL=./firehose.db
RAW_ARCHIVE_ENABLED=0   # Explicit opt-in
RAW_ARCHIVE_DIR=./raw-archive
RAW_ARCHIVE_RETENTION_HOURS=24
RAW_ARCHIVE_MAX_BYTES=2147483648
RAW_ARCHIVE_MIN_FREE_BYTES=10737418240
```

## Production

```bash
pnpm build && pnpm start
```

Behind a reverse proxy, set `base` in `vite.config.ts` to match your path prefix.

## tRPC endpoints

All at `/api/trpc`:

| Endpoint | Description |
|----------|-------------|
| `firehose.startStream` | Start Jetstream connection (admin or direct loopback only) |
| `firehose.stopStream` | Stop Jetstream connection (admin or direct loopback only) |
| `firehose.stats` | Current statistics |
| `firehose.recentPosts` | Last 100 posts |
| `firehose.archiveStatus` | Raw archive health and byte counts; never returns content or filesystem paths |
| `firehose.exportCSV` | Raw corpus CSV (admin or direct loopback only) |
| `stats.timeline` | Persisted minute event-rate and sentiment history |
| `stats.timelineByLanguage` | Persisted minute language trends |
| `stats.timelineForLanguage` | Persisted minute history for one base language, including regional tags |
| `stats.timelineByContentType` | Persisted minute content-type trends |
| `stats.timelineByLabel` | Persisted minute moderation-label trends |
| `stats.accessibilityTimeline` | Exact image-description counts from the bounded 48-hour minute history |
| `stats.accessibilityDaily` | Public-safe longitudinal daily aggregates from the atomic publisher snapshot |
| `stats.accessibilityLanguages` | Public-safe declared-language aggregate coverage |
| `stats.observatoryStatus` | Redacted freshness, coverage, and publication state |
| `stats.hourly` | Hourly time-series |
| `stats.languages` | Language distribution |
| `stats.hashtags` | Hashtag trends |

## Socket.IO events

Connect to `/socket.io`:

- `post` - emitted for every processed post (not sampled)
- `stats` - every 1 second, always full accuracy

## Accessibility Observatory

The same observatory page is designed to be served at
`/bluesky/firehose/accessibility/` and `/downloads/bluesky-alt-text/`. The live
dashboard process reads only `public-snapshot.json`; it never opens publisher
SQLite state and never exposes sampled descriptions through tRPC.

The publisher lives in `observatory/`, with pinned PyArrow and Hugging Face
dependencies. Its local state defaults to
`/home/coolhand/firehose-data/observatory`. See `OPERATIONS.md` before enabling
its ingest or publish timers.

## License

MIT - Luke Steuber

## Author

**Luke Steuber** · [lukesteuber.com](https://lukesteuber.com) · [@lukesteuber.com](https://bsky.app/profile/lukesteuber.com) · [github.com/lukeslp](https://github.com/lukeslp)
