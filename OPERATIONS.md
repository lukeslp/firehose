# Firehose Operations Guide

This guide provides operational procedures for managing the Bluesky Firehose real-time analytics service.

**Production URL**: https://dr.eamer.dev/bluesky/firehose/
**Port**: 5052 (loopback)
**Service**: `firehose.service` (native systemd on drummer)
**Database**: SQLite at `/home/coolhand/servers/firehose/firehose.db`

## Quick Reference

```bash
# Service Control
sudo systemctl start firehose
sudo systemctl stop firehose
sudo systemctl restart firehose
sudo systemctl status firehose
journalctl -u firehose -f

# Database Management
sqlite3 firehose.db        # Direct database access
pnpm db:push              # Apply schema migrations

# Health Check
curl -sS http://127.0.0.1:5052/
curl -sS https://dr.eamer.dev/bluesky/firehose/ | head
```

---

## 1. Kill Switches & Collection Controls

### 1.1 Collection Pause (Firehose Keeps Running)

**Use case**: Stop saving posts to database while keeping real-time dashboard active.

**tRPC API** (direct loopback or authenticated admin only):
```typescript
// Disable collection
POST /api/trpc/firehose.disableCollection

// Enable collection for specific time window
POST /api/trpc/firehose.enableCollection
Body: { window: "02:00" | "08:00" | "13:00" | "19:00" }

// Check collection status
GET /api/trpc/firehose.collectionStatus
Response: { enabled: boolean, currentWindow: string | null }
```

**Shell scripts**:
```bash
# Enable collection (starts saving to database)
./scripts/start-collection.sh [window]

# Disable collection (logs final stats)
./scripts/stop-collection.sh
```

**Effect**: Firehose continues ingesting and displaying posts in real-time. The
48-hour aggregate minute history continues to be saved; only filtered raw rows
in `posts` are paused.

### 1.2 Full Service Stop

**Native systemd** (authoritative on drummer):
```bash
sudo systemctl stop firehose      # Graceful shutdown
sudo systemctl restart firehose   # Full restart
```

**tRPC API**:
```typescript
POST /api/trpc/firehose.stopStream
// Closes WebSocket connection, clears reconnect timer, emits 'stopped' event
```

**Effect**: Stops WebSocket connection, collection, and all dashboard updates. Service must be restarted to resume.

### 1.3 Emergency Kill Switch

If service is unresponsive:

```bash
# Find process
lsof -i :5052

# Kill process
kill -9 <PID>

# Restart via systemd
sudo systemctl start firehose
```

### 1.4 Database Truncation (Extreme)

**Warning**: Deletes all data. Only use in emergency or for testing.

```bash
# Stop service first
sudo systemctl stop firehose

# Backup database
cp firehose.db firehose.db.backup

# Truncate (delete all posts)
sqlite3 firehose.db "DELETE FROM posts; VACUUM;"

# Or full reset (drop all data)
rm firehose.db
pnpm db:push  # Recreate schema

# Restart service
sudo systemctl start firehose
```

---

## 2. Collection Limits & Safety Parameters

### 2.1 Full-stream policy

The public Socket.IO feed forwards every Jetstream post received by the
service. There is no sampling parameter or percentage selector. Raw corpus
storage remains independently controlled by collection windows and the content
filters below.

### 2.2 Content Filtering

**Automatic filters** (configured in `server/firehose.ts`):

| Filter | Threshold | Purpose | Metric |
|--------|-----------|---------|--------|
| **Language** | English only (`startsWith('en')`) | Corpus linguistics focus | `filteredCounts.nonEnglish` |
| **Post type** | Original posts only (no replies/quotes/reposts) | Quality over quantity | `filteredCounts.quotesReplies` |
| **Word count** | 10-500 words | Meaningful content window | `filteredCounts.wordCount` |
| **Link saturation** | Max 3 links | Prevent spam | `filteredCounts.tooManyLinks` |
| **Mention saturation** | Max 5 mentions | Prevent spam | `filteredCounts.tooManyLinks` |

**Typical save rate**: ~0.3% (99.7% rejection rate)

**Filter statistics**: Logged every 60 seconds with breakdown:
```
[Filtering] Stats (last minute): {
  total: 45000,
  saved: 120,
  saveRate: "0.3%",
  notCollecting: 0,
  nonEnglish: 28000,
  quotesReplies: 15000,
  wordCount: 1750,
  tooManyLinks: 130
}
```

### 2.3 Keyword Filtering

Add keyword filters via tRPC API:

```typescript
POST /api/trpc/filters.update
Body: {
  keywords: string[]  // Max 50 keywords
}

// Each keyword:
// - Max 100 characters
// - Alphanumeric + spaces, hyphens, underscores only
// - Case-insensitive matching
```

**Validation**: Regex whitelist `[a-zA-Z0-9\s\-_]` prevents injection attacks

**Effect**: Only posts containing at least one keyword are saved (AND with other filters)

### 2.4 Memory Limits

**Fixed buffers** (prevent unbounded growth):

| Buffer | Size | Purpose | Location |
|--------|------|---------|----------|
| Recent posts | 100 posts | Reconnect/feed warm-up | `FirehoseService.recentPosts` |
| Minute aggregates | 48 hours | Historical dashboard hydration | `statsMinute*` tables |
| Posts/minute timestamps | 60-second rolling window | Exact live throughput | `postsLastMinute` |

**Text truncation**:
- `MAX_TEXT_LENGTH = 10000` characters (prevents memory bloat from extremely long posts)

**Handle cache**: capped at 20,000 DIDs. Enriched profiles use a separate
20,000-entry TTL/LRU cache and a 10,000-DID queue cap.

### 2.5 Performance Limits

| Limit | Value | Location | Purpose |
|-------|-------|----------|---------|
| Stats batch size | 100 posts | `firehose.ts:423` | Write optimization |
| Reconnect delay | 5 seconds | `firehose.ts:15` | Connection stability |
| WebSocket timeout | 30 seconds | (default) | Hang detection |
| Recent posts query | 1-100 | `routers.ts:108` | API limit |
| CSV export limit | 1-1000 | `routers.ts:53` | Query bound |
| Minute history retention | 48 hours | `FirehoseService.MINUTE_RETENTION_HOURS` | Dashboard history |
| Hourly stats query | 1-168 hours | `routers.ts:203` | Query performance |
| Language/hashtag stats | 1-50 | `routers.ts:212,221` | Response size |

---

## 3. Retention Policies

### 3.1 Dashboard aggregates

`statsMinute`, `statsMinuteLanguage`, `statsMinuteContentType`, and
`statsMinuteLabel` are always written every 10 seconds and kept for 48 hours.
They contain counts only, not post text or author identifiers.

### 3.2 Raw corpus: 7-Day Rolling Window

**Strategy**: Keep last 7 days in live database, archive older data.

**Automated scripts**:

#### Weekly Archival (Sundays 5 AM)
**Script**: `scripts/archive-weekly.sh`

**Process**:
1. Export posts from previous week to `archives/weekly/YYYY-W##.tar.gz`
2. Delete posts older than 7 days: `DELETE FROM posts WHERE timestamp < datetime('now', '-7 days')`
3. Run `VACUUM` to reclaim disk space
4. Log deletion count and database size

**Cron schedule**: `0 5 * * 0` (5 AM every Sunday)

#### Daily Compression (Every 4 AM)
**Script**: `scripts/compress-daily.sh`

**Process**:
1. Export yesterday's posts to `archives/daily/YYYY-MM-DD.json`
2. Compress with gzip-9 to `.json.gz` (typical ~90% compression)
3. Run `VACUUM` to optimize database
4. Log compression ratio and database size

**Cron schedule**: `0 4 * * *` (4 AM daily)

### 3.2 Archive Structure

```
archives/
├── daily/
│   ├── 2025-12-01.json.gz    # Single day exports
│   ├── 2025-12-02.json.gz
│   └── ...
└── weekly/
    ├── 2025-W48.tar.gz       # Weekly rollups
    ├── 2025-W49.tar.gz
    └── ...
```

**Archive format**: JSON with full post objects including all metadata

**Storage location**: `/home/coolhand/servers/firehose/archives/`

### 3.3 Manual Retention Procedures

#### Delete posts by date range:
```bash
sqlite3 firehose.db

# Delete posts before specific date
DELETE FROM posts WHERE timestamp < '2025-12-01';

# Delete posts in date range
DELETE FROM posts WHERE timestamp BETWEEN '2025-11-01' AND '2025-11-30';

# Reclaim space
VACUUM;

.quit
```

#### Export before deletion:
```bash
# Export to JSON
sqlite3 firehose.db <<EOF
.mode json
.output backup_$(date +%Y%m%d).json
SELECT * FROM posts WHERE timestamp < '2025-12-01';
.quit
EOF

# Compress
gzip backup_$(date +%Y%m%d).json

# Then delete
sqlite3 firehose.db "DELETE FROM posts WHERE timestamp < '2025-12-01'; VACUUM;"
```

#### Restore from archive:
```bash
# Extract archive
gunzip archives/daily/2025-12-01.json.gz

# Import to database
python scripts/import-from-json.py archives/daily/2025-12-01.json
```

---

## 4. Monitoring & Health Checks

### 4.1 Service Health

**Service Manager**:
```bash
sm status                 # All services overview
sm logs firehose         # Real-time logs
sm health firehose       # Health endpoint check
```

**Health endpoint**:
```bash
curl https://dr.eamer.dev/bluesky/firehose/api/trpc/system.health

# Response:
{
  "status": "healthy" | "degraded" | "down",
  "uptime": 123456,          # seconds
  "version": "1.0.0",
  "database": {
    "connected": true,
    "size": "15.2 GB",
    "posts": 1234567
  },
  "firehose": {
    "connected": true,
    "postsPerMinute": 450,
    "collectionEnabled": true
  }
}
```

### 4.2 Real-Time Metrics

**Dashboard** (https://dr.eamer.dev/bluesky/firehose/):
- Posts per minute (live)
- Sentiment distribution (positive/negative/neutral %)
- Language distribution (top 10 languages)
- Trending hashtags (top 20)
- Total posts in database
- Collection duration (uptime)

**tRPC stats endpoint**:
```typescript
GET /api/trpc/firehose.stats

Response: {
  totalPosts: number,
  postsPerMinute: number,
  sentimentCounts: {
    positive: number,
    negative: number,
    neutral: number
  },
  duration: number,  // milliseconds
  running: boolean,
  inDatabase: number
}
```

**Socket.IO real-time events**:
- `post` - Individual post broadcast (immediate)
- `stats` - Stats update (every 1 second)

### 4.3 Database Size Monitoring

**Check current size**:
```bash
# Via service manager logs
sm logs firehose | grep "Database size"

# Direct check
ls -lh firehose.db

# Detailed breakdown
sqlite3 firehose.db <<EOF
SELECT
  'posts' as table_name,
  COUNT(*) as row_count,
  pg_size_pretty(pg_total_relation_size('posts')) as size
FROM posts
UNION ALL
SELECT 'statsGlobal', COUNT(*), ... FROM statsGlobal;
EOF
```

**Size alerts**:
- **Warning**: 50GB - consider archival acceleration
- **Critical**: 75GB - imminent performance degradation
- **Emergency**: 100GB - immediate action required (truncate or migrate)

### 4.4 Filter Statistics

Logged every 60 seconds to console/logs:

```
[Filtering] Stats (last minute): {
  total: 45000,              # Posts processed
  saved: 120,                # Posts saved to database
  saveRate: "0.3%",         # Percentage saved
  notCollecting: 0,          # Posts filtered during collection pause
  nonEnglish: 28000,         # Non-English posts
  quotesReplies: 15000,      # Replies/quotes/reposts
  wordCount: 1750,           # Outside 10-500 word range
  tooManyLinks: 130          # >3 links or >5 mentions
}
```

**Anomaly detection**:
- **Save rate suddenly drops to 0%**: Check if collection disabled or filters too aggressive
- **Save rate jumps above 5%**: Filters may not be working, check logs
- **All posts marked "notCollecting"**: Collection is paused

### 4.5 Performance Monitoring

**Memory usage**:
```bash
# Via service manager
sm status | grep firehose

# Direct process inspection
ps aux | grep "node.*firehose"

# Detailed Node.js heap
curl http://localhost:5052/api/trpc/system.memory
```

**Connection status**:
```bash
# Check WebSocket connection to Jetstream
sm logs firehose | grep "WebSocket"

# Look for:
# - "Connected to Jetstream" (healthy)
# - "Connection error" (issue)
# - "Reconnecting in 5s" (automatic retry)
```

**Typical resource usage**:
- Memory: 200-500 MB (depends on buffer sizes)
- CPU: 5-15% (during active collection)
- Network: 100-500 KB/s (firehose ingestion)

---

## 5. Performance Tuning

### 5.1 Database Configuration

**WAL Mode** (Write-Ahead Logging):
- **Status**: Enabled by default in Drizzle config
- **Benefit**: Allows concurrent reads during writes
- **Check**: `sqlite3 firehose.db "PRAGMA journal_mode;"`  (should return `wal`)

**Index Strategy**:

**Existing indexes**:
- Primary keys (auto-indexed)
- Unique constraint on `posts.uri` (prevents duplicates)

**Recommended additional indexes** (not yet implemented):
```sql
-- Composite index for time-based sentiment queries
CREATE INDEX idx_posts_timestamp_sentiment
ON posts(timestamp DESC, sentiment);

-- Composite index for language analytics
CREATE INDEX idx_posts_language_timestamp
ON posts(language, timestamp DESC);

-- Covered index for common queries
CREATE INDEX idx_posts_timestamp_sentiment_language
ON posts(timestamp DESC, sentiment, language);
```

**Apply indexes**:
```bash
# Add to drizzle/schema.ts, then:
pnpm db:push
```

### 5.2 Connection & Reconnect Behavior

**WebSocket configuration**:
- **Reconnect delay**: 5 seconds (fixed)
- **Timeout**: 30 seconds default
- **Auto-reconnect**: Yes (indefinite retries)

**Tuning reconnect delay**:
```typescript
// In server/firehose.ts, modify:
const RECONNECT_DELAY = 5000;  // Increase to 10000 for unstable connections
```

**Disable auto-reconnect** (for maintenance):
```typescript
// Temporary modification, not recommended for production
firehose.stop();  // Prevents reconnect
```

### 5.3 Batch Processing

**Stats updates**:
- **Current**: Every 100 posts
- **Tuning**: Increase batch size to reduce database writes

```typescript
// In server/firehose.ts, modify:
if (postsProcessed % 100 === 0) {  // Change to 250 or 500
  await updateGlobalStats(...);
}
```

**Trade-off**: Larger batches = less frequent writes (better performance) but slightly delayed dashboard stats

### 5.4 Memory Optimization

**Reduce buffer sizes** (if memory constrained):
```typescript
// In server/firehose.ts, modify:
const MAX_POSTS_BUFFER = 100;  // Reduce to 50
```

**Clear handle cache** (if growing unbounded):
```typescript
// Add periodic cleanup in processFirehose():
if (postsProcessed % 100000 === 0) {
  handleCache.clear();
  logger.info('Handle cache cleared');
}
```

### 5.5 Query Performance

**Analyze slow queries**:
```bash
sqlite3 firehose.db

# Enable query plan
.eqp on

# Test query
SELECT * FROM posts WHERE timestamp > datetime('now', '-7 days');

# Look for "SCAN TABLE" (bad) vs "SEARCH TABLE USING INDEX" (good)
```

**Optimize with ANALYZE**:
```sql
-- Update query planner statistics
ANALYZE;

-- Schedule after large deletes
VACUUM; ANALYZE;
```

---

## 6. Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for comprehensive runbook.

**Quick diagnostics**:

```bash
# Service won't start
sm logs firehose | tail -50        # Check recent errors
lsof -i :5052                      # Port conflict?
ls -lh firehose.db*                # Database corruption?

# High resource usage
ps aux | grep firehose             # Memory/CPU check
sm logs firehose | grep "Filter"   # Abnormal save rates?

# Database locked
sm stop firehose                   # Stop service
rm firehose.db-shm firehose.db-wal # Remove stale lock files
sm start firehose                  # Restart

# No posts being saved
sm logs firehose | grep "enabled"  # Collection disabled?
sm logs firehose | grep "saveRate" # Check filter statistics
```

---

## 7. Common Operations Cheat Sheet

```bash
# STARTING & STOPPING
sm start firehose                  # Start service
sm stop firehose                   # Stop service
sm restart firehose                # Restart
./scripts/start-collection.sh      # Enable collection only
./scripts/stop-collection.sh       # Pause collection

# MONITORING
sm status                          # All services
sm logs firehose                   # Live logs
sm logs firehose | grep "Filter"   # Filter statistics
curl https://dr.eamer.dev/bluesky/firehose/api/trpc/system.health

# DATABASE
sqlite3 firehose.db                # Direct access
ls -lh firehose.db                 # Check size
pnpm db:push                       # Apply migrations

# ARCHIVAL
./scripts/archive-weekly.sh        # Manual weekly archive
./scripts/compress-daily.sh        # Manual daily compression
ls -lh archives/daily/             # View archives

# EMERGENCY
kill -9 $(lsof -ti :5052)         # Force kill
rm firehose.db && pnpm db:push    # Full reset
```

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide
- [DATABASE_ADMIN.md](./DATABASE_ADMIN.md) - Scaling and migration strategies
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Detailed troubleshooting runbook
- [MOBILE_READINESS_EXECUTIVE_SUMMARY.md](./MOBILE_READINESS_EXECUTIVE_SUMMARY.md) - Mobile optimization plan
