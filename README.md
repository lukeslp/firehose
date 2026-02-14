# Bluesky Firehose

Real-time analytics dashboard for the Bluesky social network. Connects to the Bluesky Jetstream WebSocket API to ingest, analyze, and visualize posts with sentiment analysis, hashtag tracking, and language distribution.

**Live Demo**: [https://dr.eamer.dev/bluesky/firehose/](https://dr.eamer.dev/bluesky/firehose/)

<!-- TODO: Add screenshot here -->
<!-- ![Firehose Dashboard](docs/screenshot.png) -->

## Features

- **Real-time Post Stream**: Live feed of Bluesky posts via Jetstream WebSocket
- **Sentiment Analysis**: Automatic classification of posts as positive, negative, or neutral using natural language processing
- **Language Detection**: Track posts across 100+ languages with distribution statistics
- **Hashtag Trends**: Real-time tracking of trending hashtags
- **Network Health**: Monitor Jetstream connection status and posts-per-minute
- **Historical Data**: SQLite persistence with hourly/daily aggregations
- **CSV Export**: Download filtered data with sentiment and language breakdowns
- **Swiss Design UI**: Minimalist, high-contrast interface with geometric layouts

## Technology Stack

### Frontend
- React 19 with hooks
- Socket.IO client for real-time updates
- Recharts for data visualization
- shadcn/ui components (Radix UI primitives)
- Tailwind CSS 4
- TypeScript

### Backend
- Node.js with Express
- tRPC for type-safe APIs
- WebSocket client for Jetstream connection
- Drizzle ORM with SQLite
- Socket.IO server for real-time broadcasts
- Sentiment analysis with `sentiment` npm package

### Build Tools
- Vite for frontend bundling
- esbuild for server bundling
- tsx for TypeScript development
- pnpm package manager

## Installation

### Prerequisites

- Node.js 18+ and pnpm
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/lukeslp/firehose.git
cd firehose

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000/`

## Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
NODE_ENV=development          # production | development
PORT=5052                     # Server port (defaults to 3000)

# Database
DATABASE_URL=./firehose.db    # SQLite database path

# Optional: OAuth configuration
OAUTH_SERVER_URL=             # OAuth endpoint URL
JWT_SECRET=                   # Session signing secret
```

## Development

```bash
# Start development server with hot reload
pnpm dev

# Type checking
pnpm check

# Run tests
pnpm test

# Format code
pnpm format
```

## Production Deployment

```bash
# Build both client and server
pnpm build

# Start production server
pnpm start
```

The production server expects the `base` path to be `/bluesky/firehose/` when served behind a reverse proxy. Update `vite.config.ts` if deploying at a different path.

### Database Migrations

```bash
# Generate and apply schema changes
pnpm db:push

# Direct database inspection
sqlite3 firehose.db
```

## Architecture

### Data Flow

```
Bluesky Jetstream WebSocket
    ↓
FirehoseService (singleton)
    ↓ sentiment + feature extraction
    ├─→ In-memory stats (realtime)
    ├─→ SQLite database (persistence)
    └─→ Socket.IO broadcast
            ↓
        React Dashboard
            ├─→ Live charts
            ├─→ Real-time feed
            └─→ Statistics panels
```

### Key Components

- **FirehoseService** (`server/firehose.ts`): Singleton WebSocket client managing Jetstream connection, auto-reconnects on failure
- **Sentiment Analysis** (`server/sentiment.ts`): NLP-powered post classification and feature extraction
- **Database Layer** (`server/db.ts`): SQLite with Drizzle ORM, batched writes for performance
- **tRPC API** (`server/routers.ts`): Type-safe endpoints for stats, filters, and CSV export
- **Socket.IO** (`server/socketio.ts`): Real-time broadcast layer (posts + stats every 1 second)
- **React Dashboard** (`client/src/pages/Dashboard.tsx`): Real-time visualization with Recharts

## API Endpoints

All tRPC endpoints are available at `/api/trpc`:

- `firehose.start()` - Start Jetstream connection
- `firehose.stop()` - Stop Jetstream connection
- `firehose.stats()` - Get current statistics
- `firehose.recentPosts()` - Fetch last 100 posts
- `firehose.exportCSV()` - Export posts as CSV
- `stats.global()` - All-time aggregates
- `stats.hourly()` - Hourly time-series data
- `stats.languages()` - Language distribution
- `stats.hashtags()` - Hashtag trends

## Real-time Events (Socket.IO)

Connect to `/socket.io` to receive:

- `post` - Emitted on every processed post
- `stats` - Sent every 1 second with current statistics

## Database Schema

SQLite database with the following tables:

- `posts` - Full post data with metadata
- `statsGlobal` - All-time aggregates
- `statsHourly` / `statsDaily` - Time-series aggregations
- `statsLanguage` - Language distribution
- `statsHashtag` - Hashtag trends
- `authorInteractions` - Network analysis data
- `sessions` - Firehose session tracking

## Performance Optimizations

- **Rolling window**: Posts-per-minute calculated from timestamps within last 60 seconds
- **Memory limits**: Only last 100 posts kept in memory
- **Batch updates**: Stats persisted every 100 posts (not every post)
- **Async saves**: Database writes are non-blocking

## Troubleshooting

### Firehose Not Connecting
- Verify Jetstream endpoint: `curl -I https://jetstream2.us-east.bsky.network`
- Check logs for WebSocket errors
- Ensure no firewall blocking outbound WSS connections

### Database Lock Errors
- SQLite has limited concurrency; avoid simultaneous writes
- Check for orphaned processes: `lsof firehose.db`

### Build Failures
- Clear node_modules: `rm -rf node_modules && pnpm install`
- Check TypeScript errors: `pnpm check`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License

Copyright (c) 2026 Luke Steuber

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Author

**Luke Steuber**
- Website: [lukesteuber.com](https://lukesteuber.com)
- Bluesky: [@lukesteuber.com](https://bsky.app/profile/lukesteuber.com)
- GitHub: [lukeslp](https://github.com/lukeslp)

## Acknowledgments

- Built with the [Bluesky AT Protocol](https://atproto.com/)
- Powered by [Jetstream](https://github.com/ericvolp12/jetstream) WebSocket API
- Sentiment analysis using the [sentiment](https://github.com/thisandagain/sentiment) library
