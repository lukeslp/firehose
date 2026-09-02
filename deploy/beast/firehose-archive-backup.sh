#!/bin/bash
# Pull sealed Bluesky firehose segments from drummer to the Galactus backup tier.

set -euo pipefail

SOURCE_HOST=drummer
SOURCE_DIR=/home/coolhand/firehose-data/raw/
DEST_DIR=/Volumes/Galactus/Data/Backups/Firehose/raw
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/firehose-archive-backup.log"
RETENTION_DAYS=30

mkdir -p "$LOG_DIR"
if [ -f "$LOG_FILE" ] && [ "$(/usr/bin/stat -f '%z' "$LOG_FILE")" -gt 5242880 ]; then
  /bin/mv -f "$LOG_FILE" "$LOG_FILE.1"
fi

log() {
  echo "[$(/bin/date '+%Y-%m-%d %H:%M:%S')] $*" | /usr/bin/tee -a "$LOG_FILE"
}

if ! /sbin/mount | /usr/bin/grep -q ' on /Volumes/Galactus '; then
  log 'ERROR: Galactus is not mounted; refusing to use the internal disk'
  exit 1
fi

if ! /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=15 "$SOURCE_HOST" \
  /usr/bin/test -d /home/coolhand/firehose-data/raw; then
  log 'ERROR: drummer archive source is unavailable'
  exit 1
fi

/bin/mkdir -p "$DEST_DIR"
/bin/chmod 700 /Volumes/Galactus/Data/Backups/Firehose "$DEST_DIR"

log 'Starting sealed firehose archive pull'
if /usr/bin/rsync -a --ignore-existing \
  -e '/usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=15' \
  --include='*/' \
  --include='*.ndjson.zst' \
  --include='*.manifest.json' \
  --exclude='*' \
  "$SOURCE_HOST:$SOURCE_DIR" "$DEST_DIR/" >> "$LOG_FILE" 2>&1; then
  log 'Transfer complete'
else
  transfer_status=$?
  log "ERROR: rsync exited $transfer_status"
  exit "$transfer_status"
fi

verified=0
failures=0
while IFS= read -r -d '' manifest; do
  marker="$manifest.verified"
  [ -f "$marker" ] && continue

  segment="${manifest%.manifest.json}.ndjson.zst"
  if [ ! -f "$segment" ]; then
    log "ERROR: segment missing for ${manifest#"$DEST_DIR/"}"
    failures=$((failures + 1))
    continue
  fi

  if ! expected_sha=$(/usr/bin/plutil -extract sha256 raw "$manifest" 2>/dev/null); then
    log "ERROR: manifest SHA-256 missing for ${manifest#"$DEST_DIR/"}"
    failures=$((failures + 1))
    continue
  fi
  if ! expected_bytes=$(/usr/bin/plutil -extract compressedBytes raw "$manifest" 2>/dev/null); then
    log "ERROR: manifest byte count missing for ${manifest#"$DEST_DIR/"}"
    failures=$((failures + 1))
    continue
  fi

  actual_sha=$(/usr/bin/shasum -a 256 "$segment" | /usr/bin/awk '{print $1}')
  actual_bytes=$(/usr/bin/stat -f '%z' "$segment")
  if [ "$actual_sha" != "$expected_sha" ] || [ "$actual_bytes" != "$expected_bytes" ]; then
    log "ERROR: verification failed for ${segment#"$DEST_DIR/"}"
    failures=$((failures + 1))
    continue
  fi

  marker_tmp="$marker.$$.tmp"
  /usr/bin/printf 'sha256=%s\nbytes=%s\nverified_at=%s\n' \
    "$actual_sha" "$actual_bytes" "$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$marker_tmp"
  /bin/chmod 600 "$marker_tmp"
  /bin/mv -f "$marker_tmp" "$marker"
  verified=$((verified + 1))
done < <(/usr/bin/find "$DEST_DIR" -type f -name '*.manifest.json' -print0)

if [ "$failures" -ne 0 ]; then
  log "ERROR: $failures archive pair(s) failed verification"
  exit 1
fi

deleted=0
while IFS= read -r -d '' expired; do
  /bin/rm -f -- "$expired"
  deleted=$((deleted + 1))
done < <(/usr/bin/find "$DEST_DIR" -type f -mtime "+$RETENTION_DAYS" \( \
  -name '*.ndjson.zst' -o \
  -name '*.manifest.json' -o \
  -name '*.manifest.json.verified' -o \
  -name '*.corrupt-*' \
\) -print0)

log "Backup complete: $verified newly verified file(s), $deleted expired file(s) removed"
