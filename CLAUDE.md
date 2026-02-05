# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Firehose application is a real-time Bluesky social network analytics dashboard that ingests, analyzes, and visualizes posts from the Bluesky firehose (via Jetstream WebSocket API). It performs sentiment analysis, tracks language distribution, hashtag trends, and provides live statistics.

**Access URL**: `https://dr.eamer.dev/bluesky/firehose/`
**Production Port**: 5052
**Architecture**: Full-stack TypeScript with tRPC, Socket.IO real-time updates, and SQLite persistence

## Common Commands

### Development
```bash
# Start development server (hot reload)
pnpm dev

# Type checking
pnpm check

# Run tests
pnpm test

# Format code
pnpm format
```

### Building & Production
```bash
# Build both client and server
pnpm build

# Start production server
pnpm start

# Production startup via service manager
./start.sh
```

### Database Operations
```bash
# Generate migrations and apply schema
pnpm db:push

# Direct database inspection (SQLite)
sqlite3 firehose.db
```

## Architecture Overview

### High-Level Data Flow

```
Bluesky Jetstream WebSocket (wss://jetstream2.us-east.bsky.network)
    ↓
FirehoseService (server/firehose.ts)
    ↓ sentiment analysis + feature extraction
    ├─→ In-memory stats (realtime)
    ├─→ SQLite database (persistence via Drizzle ORM)
    └─→ Socket.IO broadcast
            ↓
        React Dashboard (client/src/pages/Dashboard.tsx)
            ├─→ Live charts (Recharts)
            ├─→ Real-time feed
            └─→ Statistics panels
```

### Key Components

#### 1. **Firehose Service** (`server/firehose.ts`)
- Singleton service connecting to Bluesky Jetstream WebSocket
- Maintains in-memory stats and recent posts buffer (last 100)
- Auto-reconnects on connection loss (5s delay)
- Event-driven architecture (extends EventEmitter)
- Filters posts by keywords (case-insensitive)
- Builds DID→handle cache from identity events

#### 2. **Sentiment Analysis** (`server/sentiment.ts`)
- Uses `sentiment` npm package for natural language processing
- Classifies posts as positive/negative/neutral
- Extracts features: language detection, hashtags, mentions, links
- Calculates char/word counts and identifies media types

#### 3. **Database Layer** (`server/db.ts` + `drizzle/schema.ts`)
- SQLite database with Drizzle ORM
- **Core tables**:
  - `posts`: Full post data with metadata
  - `statsGlobal`: All-time aggregates
  - `statsHourly`/`statsDaily`: Time-series aggregations
  - `statsLanguage`: Language distribution
  - `statsHashtag`: Hashtag trends
  - `authorInteractions`: Network analysis data
  - `sessions`: Firehose session tracking
- Handles duplicate posts gracefully (unique constraint on `uri`)
- Updates stats every 100 posts for performance

#### 4. **tRPC API** (`server/routers.ts`)
- Type-safe API endpoints under `/api/trpc`
- Main routers:
  - `firehose`: start/stop/stats/filters/recentPosts/exportCSV
  - `posts`: list with filtering
  - `stats`: global/hourly/languages/hashtags/contentTypes/sentimentByKeyword
  - `auth`: OAuth flow (optional)
- CSV export with sentiment/language filtering

#### 5. **Socket.IO Real-time** (`server/socketio.ts`)
- Broadcasts `post` events on every processed post
- Sends `stats` updates every 1 second
- Path: `/socket.io` (Caddy strips `/bluesky/firehose` prefix)

#### 6. **React Dashboard** (`client/src/pages/Dashboard.tsx`)
- Real-time visualization with Recharts (line/area/bar charts)
- Live post feed with language filtering
- Fullscreen mode support
- Rolling window calculations for posts-per-minute
- Topic sentiment analysis component

### Technology Stack

**Frontend**:
- React 19 with hooks
- Recharts for data visualization
- shadcn/ui components (Radix primitives)
- Tailwind CSS 4
- Wouter for routing
- Socket.IO client for real-time updates

**Backend**:
- Express + tRPC
- WebSocket client (`ws` package)
- Drizzle ORM with SQLite
- Natural language processing (`sentiment`, `natural`)
- Socket.IO server

**Build Tools**:
- Vite for frontend bundling
- esbuild for server bundling
- tsx for TypeScript development
- pnpm package manager

## Key Implementation Details

### Caddy Integration
The app is served behind Caddy with URL prefix `/bluesky/firehose/`:
- **Vite config** sets `base: '/bluesky/firehose/'`
- **OAuth routes** are at root level (Caddy strips prefix)
- **tRPC API** expects `/api/trpc` (also prefix-stripped)
- **Socket.IO path** is `/socket.io` (no `/bluesky/firehose` prefix)

### Auto-start Behavior
The firehose automatically starts 2 seconds after server launch (`server/_core/index.ts:74`). This ensures continuous data collection without manual intervention.

### Port Allocation Strategy
- **Preferred port**: 5052 (set in `.env` and `start.sh`)
- **Fallback**: Auto-scans ports 3000-3019 if preferred port is busy
- Uses `net.createServer()` to test port availability

### Real-time Performance Optimization
- **Rolling window**: Posts-per-minute calculated from timestamps within last 60 seconds
- **Memory limits**: Only last 100 posts kept in memory
- **Batch updates**: Stats persisted every 100 posts (not every post)
- **Async saves**: Database writes are non-blocking

### Sentiment Classification Logic
```typescript
// Threshold-based classification
comparative > 0.1  → positive
comparative < -0.1 → negative
else               → neutral
```

### Database Schema Patterns
- **Timestamps**: Stored as integers in SQLite, converted to Date objects via Drizzle
- **JSON columns**: Arrays stored as JSON strings (hashtags, mentions, links, facets)
- **Unique constraints**: `uri` field prevents duplicate posts
- **Indexes**: Should be added for `timestamp`, `sentiment`, `language` for query performance

## Development Workflow

### Adding New Features
1. Define schema changes in `drizzle/schema.ts`
2. Run `pnpm db:push` to apply migrations
3. Update database functions in `server/db.ts`
4. Add tRPC procedures in `server/routers.ts`
5. Consume in React components via `trpc` hook

### Testing Real-time Updates
1. Start dev server: `pnpm dev`
2. Open browser to `http://localhost:3000/`
3. Watch firehose logs: `tail -f firehose.log`
4. Monitor WebSocket in browser DevTools (Network → WS tab)

### Debugging Firehose Connection
- Check WebSocket URI: `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&wantedEvents=identity`
- Verify identity events are building handle cache (logged to console)
- Monitor reconnection attempts (5-second delay on disconnect)
- Inspect `FirehoseService` event emissions

## Configuration

### Environment Variables (`.env`)
```bash
NODE_ENV=production          # production | development
PORT=5052                    # Server port
OAUTH_SERVER_URL=            # Optional OAuth endpoint
JWT_SECRET=                  # Session signing secret
DATABASE_URL=./firehose.db   # SQLite database path (optional)
```

### Service Manager Integration
This service is managed via `/home/coolhand/service_manager.py`:
```bash
python service_manager.py start firehose
python service_manager.py logs firehose
python service_manager.py restart firehose
```

Service definition includes:
- Script: `/home/coolhand/html/firehose/start.sh`
- Working dir: `/home/coolhand/html/firehose`
- Port: 5052
- Health endpoint: `http://localhost:5052/api/trpc/system.health`

## Common Issues

### Firehose Not Connecting
- Verify Jetstream endpoint is accessible: `curl -I https://jetstream2.us-east.bsky.network`
- Check for WebSocket errors in logs: `grep WebSocket firehose.log`
- Ensure no firewall blocking outbound WSS connections

### Database Lock Errors
- SQLite has limited concurrency; avoid simultaneous writes
- Check for orphaned processes: `lsof firehose.db`
- Consider WAL mode for better concurrency (edit `drizzle.config.ts`)

### Socket.IO Connection Issues
- Verify Caddy routing: `curl https://dr.eamer.dev/bluesky/firehose/socket.io/`
- Check CORS configuration in `server/socketio.ts`
- Inspect browser console for Socket.IO connection errors

### Build Failures
- Clear node_modules and rebuild: `rm -rf node_modules && pnpm install`
- Check for TypeScript errors: `pnpm check`
- Verify Vite base path matches Caddy routing

## File Structure Reference

```
firehose/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/Dashboard.tsx    # Main analytics dashboard
│   │   ├── components/            # UI components (shadcn/ui)
│   │   ├── hooks/useSocket.ts     # Socket.IO hook
│   │   └── lib/trpc.ts           # tRPC client setup
│   └── public/
├── server/                    # Express backend
│   ├── _core/
│   │   ├── index.ts              # Server entry point
│   │   ├── trpc.ts               # tRPC configuration
│   │   ├── context.ts            # Request context
│   │   └── oauth.ts              # OAuth routes
│   ├── firehose.ts               # Firehose service (singleton)
│   ├── sentiment.ts              # NLP analysis
│   ├── db.ts                     # Database queries
│   ├── routers.ts                # tRPC API routes
│   └── socketio.ts               # Socket.IO setup
├── drizzle/
│   ├── schema.ts                 # Database schema
│   └── meta/                     # Migration metadata
├── shared/                    # Shared types/constants
│   ├── types.ts
│   ├── languages.ts
│   └── const.ts
├── firehose.db               # SQLite database
├── start.sh                  # Production startup script
├── vite.config.ts            # Frontend build config
└── drizzle.config.ts         # Database config
```

## Performance Considerations

- **Memory usage**: Unbounded handle cache; consider LRU eviction for long-running sessions
- **Database growth**: `posts` table grows indefinitely; implement archival strategy
- **WebSocket backpressure**: No flow control on high-volume firehose; posts may be dropped
- **SQLite concurrency**: Single-writer limitation; consider PostgreSQL for multi-user scenarios

## Future Enhancements (from todo.md)

- Implement post search with full-text indexing
- Add user authentication and personalized dashboards
- Create author network graph visualization
- Implement topic clustering and trend detection
- Add export to multiple formats (JSON, Parquet)
- Optimize database with proper indexes
