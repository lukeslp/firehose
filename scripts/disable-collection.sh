#!/bin/bash
# Disable firehose collection and log it
LOG_FILE="/home/coolhand/html/firehose/scripts/collection.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Disabling 24-hour collection..." >> "$LOG_FILE"

RESPONSE=$(curl -s -X POST "http://localhost:5052/api/trpc/firehose.disableCollection")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Response: $RESPONSE" >> "$LOG_FILE"

# Get final stats
STATS=$(curl -s "http://localhost:5052/api/trpc/firehose.stats")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Final stats: $STATS" >> "$LOG_FILE"

# Remove this cron job after execution
crontab -l 2>/dev/null | grep -v "disable-collection.sh" | crontab -
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cron job removed" >> "$LOG_FILE"
