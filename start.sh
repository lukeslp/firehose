#!/bin/bash
# Firehose Service Startup Script
# Starts the Bluesky Firehose Dashboard on port 5052

set -e

cd /home/coolhand/servers/firehose

# Set environment variables
export NODE_ENV=production
export HOST=127.0.0.1
export PORT=5052
export OAUTH_SERVER_URL=
export JWT_SECRET=firehose_secret_key_default
export DATABASE_URL=/home/coolhand/servers/firehose/firehose.db

# Enrichment toggles (defaults match production-desired behavior)
export ENRICH_MEDIA=1
export ENRICH_PROFILES=1
export PROFILE_CACHE_MAX=20000
export PROFILE_CACHE_TTL_MS=3600000
export BSKY_APPVIEW_URL=https://public.api.bsky.app

# Start the server using the compiled bundle
exec node dist/index.js
