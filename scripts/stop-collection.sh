#!/bin/bash
#
# Stop Bluesky firehose collection window
# Logs statistics from the completed collection period
#

set -e

# Get current status before stopping
STATUS=$(curl -s http://localhost:5052/api/trpc/firehose.collectionStatus 2>&1)

if echo "$STATUS" | grep -q '"enabled":true'; then
  WINDOW=$(echo "$STATUS" | grep -o '"currentWindow":"[^"]*"' | cut -d'"' -f4)
  
  # Get database stats
  DB_COUNT=$(sqlite3 /home/coolhand/html/firehose/firehose.db \
    "SELECT COUNT(*) FROM posts WHERE collectionWindow='$WINDOW';" 2>/dev/null || echo "0")
  
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopping collection window: $WINDOW"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Posts collected in this window: $DB_COUNT"
fi

# Disable collection via API
RESPONSE=$(curl -s -X POST http://localhost:5052/api/trpc/firehose.disableCollection 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Collection disabled"
  
  # Log to collection manifest
  if [ -n "$WINDOW" ]; then
    MANIFEST="/home/coolhand/html/firehose/collection-manifest.log"
    echo "$(date '+%Y-%m-%d %H:%M:%S'),window_stop,$WINDOW,$DB_COUNT" >> "$MANIFEST"
  fi
  
  exit 0
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: Stop request may have failed"
  echo "Response: $RESPONSE"
  exit 0  # Don't fail - collection is stopped anyway
fi

