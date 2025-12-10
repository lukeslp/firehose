#!/bin/bash
#
# Weekly archival of Bluesky corpus collection
# Consolidates daily archives and clears old data from live database
# Runs Sunday at 5 AM
#

set -e

DB_PATH="/home/coolhand/html/firehose/firehose.db"
DAILY_DIR="/home/coolhand/html/firehose/archives/daily"
WEEKLY_DIR="/home/coolhand/html/firehose/archives/weekly"
LOG_FILE="/home/coolhand/html/firehose/scripts/compression.log"

# Create archive directories
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

# Get current week number
WEEK=$(date +%Y-W%U)
WEEK_START=$(date -d "7 days ago" +%Y-%m-%d)
WEEK_END=$(date -d "yesterday" +%Y-%m-%d)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting weekly archive for $WEEK ($WEEK_START to $WEEK_END)" | tee -a "$LOG_FILE"

# Count posts in date range
POST_COUNT=$(sqlite3 "$DB_PATH" \
  "SELECT COUNT(*) FROM posts WHERE DATE(timestamp) BETWEEN '$WEEK_START' AND '$WEEK_END';" 2>/dev/null || echo "0")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Posts in week: $POST_COUNT" | tee -a "$LOG_FILE"

if [ "$POST_COUNT" -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] No posts to archive, skipping" | tee -a "$LOG_FILE"
  exit 0
fi

# Create weekly archive from daily JSON files
ARCHIVE_FILE="$WEEKLY_DIR/$WEEK.tar.gz"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating weekly archive: $ARCHIVE_FILE" | tee -a "$LOG_FILE"

# Find all daily archives from this week
DAILY_FILES=$(find "$DAILY_DIR" -name "*.json.gz" -newermt "$WEEK_START" ! -newermt "$WEEK_END" 2>/dev/null | sort)

if [ -z "$DAILY_FILES" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: No daily archives found for this week" | tee -a "$LOG_FILE"
else
  # Create tar.gz of daily archives
  echo "$DAILY_FILES" | tar -czf "$ARCHIVE_FILE" -T - 2>/dev/null || {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: tar creation failed, trying alternative method" | tee -a "$LOG_FILE"
    tar -czf "$ARCHIVE_FILE" -C "$DAILY_DIR" $(basename -a $DAILY_FILES) 2>/dev/null
  }
  
  ARCHIVE_SIZE=$(stat -f%z "$ARCHIVE_FILE" 2>/dev/null || stat -c%s "$ARCHIVE_FILE")
  ARCHIVE_MB=$(echo "scale=2; $ARCHIVE_SIZE / 1024 / 1024" | bc)
  
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Weekly archive created: ${ARCHIVE_MB} MB" | tee -a "$LOG_FILE"
fi

# Delete old posts from live database (keep last 7 days)
CUTOFF_DATE=$(date -d "7 days ago" +%Y-%m-%d)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deleting posts older than $CUTOFF_DATE..." | tee -a "$LOG_FILE"

DELETED=$(sqlite3 "$DB_PATH" \
  "DELETE FROM posts WHERE DATE(timestamp) < '$CUTOFF_DATE'; SELECT changes();" | tail -1)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Deleted $DELETED old posts" | tee -a "$LOG_FILE"

# Vacuum database to reclaim space
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running VACUUM..." | tee -a "$LOG_FILE"
DB_SIZE_BEFORE=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH")

sqlite3 "$DB_PATH" "VACUUM; PRAGMA optimize;"

DB_SIZE_AFTER=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH")
DB_SAVED_MB=$(echo "scale=2; ($DB_SIZE_BEFORE - $DB_SIZE_AFTER) / 1024 / 1024" | bc)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Reclaimed ${DB_SAVED_MB} MB" | tee -a "$LOG_FILE"

# Final stats
REMAINING_POSTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM posts;")
FINAL_SIZE_MB=$(echo "scale=2; $DB_SIZE_AFTER / 1024 / 1024" | bc)

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current database: $REMAINING_POSTS posts, ${FINAL_SIZE_MB} MB" | tee -a "$LOG_FILE"

# Log breakdown by collection window
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Posts by collection window:" | tee -a "$LOG_FILE"
sqlite3 "$DB_PATH" "SELECT collectionWindow, COUNT(*) FROM posts GROUP BY collectionWindow;" | \
  while read -r line; do
    echo "  $line" | tee -a "$LOG_FILE"
  done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly archival complete" | tee -a "$LOG_FILE"
echo "===" | tee -a "$LOG_FILE"

