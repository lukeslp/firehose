#!/bin/bash
# Disable firehose collection
curl -s -X POST "http://localhost:5052/api/trpc/firehose.disableCollection" \
  -H "Content-Type: application/json" \
  -d '{}'
echo ""
echo "[$(date)] Collection disabled"
