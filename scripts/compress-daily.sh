#!/bin/bash
#
# Daily compression and archival of Bluesky corpus data
# Runs at 4 AM daily to compress previous day's collection
#

set -e

DB_PATH="/home/coolhand/html/firehose/firehose.db"
ARCHIVE_DIR="/home/coolhand/html/firehose/archives/daily"
LOG_FILE="/home/coolhand/html/firehose/scripts/compression.log"

# Create archive directory if it doesn't exist
mkdir -p "$ARCHIVE_DIR"

# Get yesterday's date
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting daily compression for $YESTERDAY" | tee -a "$LOG_FILE"

# Export yesterday's posts to JSON
EXPORT_FILE="$ARCHIVE_DIR/$YESTERDAY.json"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Exporting posts from $YESTERDAY..." | tee -a "$LOG_FILE"

sqlite3 "$DB_PATH" <<EOF > "$EXPORT_FILE"
.mode json
SELECT * FROM posts 
WHERE DATE(timestamp) = '$YESTERDAY'
ORDER BY timestamp;
EOF

# Check if export has data
EXPORT_SIZE=$(stat -f%z "$EXPORT_FILE" 2>/dev/null || stat -c%s "$EXPORT_FILE")
POST_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts WHERE DATE(timestamp) = '$YESTERDAY';")

if [ "$EXPORT_SIZE" -lt 100 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] No posts from $YESTERDAY, skipping compression" | tee -a "$LOG_FILE"
  rm -f "$EXPORT_FILE"
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Exported $POST_COUNT posts ($EXPORT_SIZE bytes)" | tee -a "$LOG_FILE"

# Compress the JSON file
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Compressing..." | tee -a "$LOG_FILE"
gzip -9 "$EXPORT_FILE"

COMPRESSED_SIZE=$(stat -f%z "$EXPORT_FILE.gz" 2>/dev/null || stat -c%s "$EXPORT_FILE.gz")
RATIO=$(echo "scale=1; 100 * (1 - $COMPRESSED_SIZE / $EXPORT_SIZE)" | bc)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Compressed to $COMPRESSED_SIZE bytes (${RATIO}% reduction)" | tee -a "$LOG_FILE"

# Run VACUUM on database to reclaim space (if posts are being deleted elsewhere)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running VACUUM on database..." | tee -a "$LOG_FILE"
DB_SIZE_BEFORE=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH")

sqlite3 "$DB_PATH" "VACUUM;"

DB_SIZE_AFTER=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH")
DB_SAVED=$(echo "scale=2; ($DB_SIZE_BEFORE - $DB_SIZE_AFTER) / 1024 / 1024" | bc)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ VACUUM complete (saved ${DB_SAVED} MB)" | tee -a "$LOG_FILE"

# Summary stats
TOTAL_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts;")
DB_SIZE_MB=$(echo "scale=2; $DB_SIZE_AFTER / 1024 / 1024" | bc)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database status: $TOTAL_POSTS posts, ${DB_SIZE_MB} MB" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

