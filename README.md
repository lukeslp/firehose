# Bluesky Firehose

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Real-time analytics dashboard for the Bluesky social network. Taps into the Jetstream WebSocket to show a live feed of posts with sentiment analysis, rate tracking, and a sentiment timeline — all updating in real time.

**Live**: [dr.eamer.dev/bluesky/firehose/](https://dr.eamer.dev/bluesky/firehose/)

<!-- TODO: screenshot -->

## What it does

- **Live post feed** from Bluesky's Jetstream WebSocket, with sentiment-colored cards
- **Sentiment analysis** — classifies each post as positive, negative, or neutral
- **Sampling control** — slow the stream to 100% / 50% / 25% / 10% without losing stats accuracy
- **Sentiment timeline** — stacked area chart tracking mood over the last 60 minutes
- **Keyword filters** — search the live feed by keyword, comma-separated
- **Fullscreen mode** — just the feed, nothing else
- **CSV export** — download the collected data with sentiment and language metadata
- **SQLite persistence** — hourly/daily aggregations, hashtag trends, language distribution

## Quick start

```bash
git clone https://github.com/lukeslp/firehose.git
cd firehose
pnpm install
pnpm dev
```

Opens at `http://localhost:3000/`. The firehose starts automatically.

## Stack

**Frontend**: React 19, Recharts, shadcn/ui (Radix), Tailwind CSS 4, Socket.IO client

**Backend**: Express, tRPC, Drizzle ORM + SQLite, Socket.IO, `sentiment` (NLP)

**Build**: Vite, esbuild, pnpm

## How it works

```
Bluesky Jetstream WebSocket
  → FirehoseService (sentiment analysis + feature extraction)
    ├→ In-memory stats (real-time)
    ├→ SQLite (persistence, batched every 100 posts)
    └→ Socket.IO broadcast
         → React Dashboard
```

The server connects to `wss://jetstream2.us-east.bsky.network` and processes every post through sentiment analysis. Stats broadcast every second. Posts broadcast in real time (or sampled, per client preference).

## Environment

```bash
PORT=5052               # Server port (default: 3000)
DATABASE_URL=./firehose.db
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
| `firehose.startStream` | Start Jetstream connection |
| `firehose.stopStream` | Stop Jetstream connection |
| `firehose.stats` | Current statistics |
| `firehose.recentPosts` | Last 100 posts |
| `firehose.exportCSV` | CSV download |
| `stats.hourly` | Hourly time-series |
| `stats.languages` | Language distribution |
| `stats.hashtags` | Hashtag trends |

## Socket.IO events

Connect to `/socket.io`:

- `post` — emitted per processed post (respects client sample rate)
- `stats` — every 1 second, always full accuracy

## License

MIT — Luke Steuber

## Author

**Luke Steuber** · [lukesteuber.com](https://lukesteuber.com) · [@lukesteuber.com](https://bsky.app/profile/lukesteuber.com) · [github.com/lukeslp](https://github.com/lukeslp)
