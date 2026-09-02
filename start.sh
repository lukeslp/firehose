#!/bin/bash
# Firehose Service Startup Script
# Starts the Bluesky Firehose Dashboard on port 5052

set -e

cd /home/coolhand/servers/firehose

# Runtime configuration belongs to the systemd unit/environment file. Pin the
# executable so native modules are loaded by the same Node ABI used to build
# and verify them instead of whichever `node` happens to be first on PATH.
exec /home/coolhand/.nvm/versions/node/v24.18.0/bin/node dist/index.js
