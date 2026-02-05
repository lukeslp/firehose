#!/bin/bash
# Enable firehose collection with state persistence
WINDOW="${1:-24hr-$(date +%Y-%m-%d)}"
curl -s -X POST "http://localhost:5052/api/trpc/firehose.enableCollection" \
  -H "Content-Type: application/json" \
  -d "{\"json\":{\"window\":\"$WINDOW\"}}"
echo ""
echo "[$(date)] Collection enabled: $WINDOW"
