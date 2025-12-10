#!/bin/bash
#
# Start Bluesky firehose collection window
# Part of stratified sampling system for corpus linguistics research
#
# Usage: ./start-collection.sh [window]
# Windows: 02:00, 08:00, 13:00, 19:00 (auto-detected if not specified)
#

set -e

# Determine collection window based on current hour (CST)
HOUR=$(date +%H)
case "$HOUR" in
  02) WINDOW="02:00" ;;
  08) WINDOW="08:00" ;;
  13) WINDOW="13:00" ;;
  19) WINDOW="19:00" ;;
  *)
    # Allow manual override
    if [ -n "$1" ]; then
      WINDOW="$1"
    else
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Not a scheduled collection window (hour=$HOUR)"
      echo "Scheduled windows: 02:00, 08:00, 13:00, 19:00 CST"
      exit 1
    fi
    ;;
esac

# Check if firehose service is running
if ! pgrep -f "node.*firehose" > /dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Firehose service not running"
  echo "Start the main service first: python /home/coolhand/service_manager.py start firehose"
  exit 1
fi

# Enable collection via API
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting collection window: $WINDOW"

RESPONSE=$(curl -s -X POST "http://localhost:5052/api/trpc/firehose.enableCollection" \
  -H "Content-Type: application/json" \
  -d '{"json":{"window":"'"$WINDOW"'"}}' 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Collection enabled for window $WINDOW"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Filters: English only, original posts, 10-500 words, minimal URLs/mentions"
  
  # Log to collection manifest
  MANIFEST="/home/coolhand/html/firehose/collection-manifest.log"
  echo "$(date '+%Y-%m-%d %H:%M:%S'),window_start,$WINDOW" >> "$MANIFEST"
  
  exit 0
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Failed to enable collection"
  echo "Response: $RESPONSE"
  exit 1
fi

