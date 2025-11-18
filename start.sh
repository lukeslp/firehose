#!/bin/bash
# Firehose Service Startup Script
# Starts the Bluesky Firehose Dashboard on port 5052

set -e

cd /home/coolhand/html/firehose

# Set environment variables
export NODE_ENV=production
export PORT=5052
export OAUTH_SERVER_URL=
export JWT_SECRET=firehose_secret_key_default

# Start the server using the compiled bundle
exec node dist/index.js
