#!/bin/bash
# Pull sealed Bluesky firehose segments from drummer to the Galactus backup tier.

set -euo pipefail

SOURCE_HOST=drummer
SOURCE_DIR=/home/coolhand/firehose-data/raw/
DEST_DIR=/Volumes/Galactus/Data/Backups/Firehose/raw
LOG_DIR="$HOME/Library/Logs"
LOG_FILE="$LOG_DIR/firehose-archive-backup.log"
RETENTION_DAYS=30
MIN_DEST_FREE_BYTES=${FIREHOSE_BACKUP_MIN_FREE_BYTES:-107374182400}
MODE=${1:-backup}

case "$MODE" in
  backup|audit|restore-drill) ;;
  *)
    echo "usage: $0 [backup|audit|restore-drill]" >&2
    exit 2
    ;;
esac

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

available_kib=$(/bin/df -Pk /Volumes/Galactus | /usr/bin/awk 'NR == 2 {print $4}')
available_bytes=$((available_kib * 1024))
if [ "$available_bytes" -lt "$MIN_DEST_FREE_BYTES" ]; then
  log "ERROR: Galactus has $available_bytes free bytes; minimum is $MIN_DEST_FREE_BYTES"
  exit 1
fi

if ! /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=15 "$SOURCE_HOST" \
  /usr/bin/test -d /home/coolhand/firehose-data/raw; then
  log 'ERROR: drummer archive source is unavailable'
  exit 1
fi

/bin/mkdir -p "$DEST_DIR"
/bin/chmod 700 /Volumes/Galactus/Data/Backups/Firehose "$DEST_DIR"

audit_tmp=
if [ "$MODE" != backup ]; then
  audit_tmp=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/firehose-archive-audit.XXXXXX")
  trap '/bin/rm -rf "$audit_tmp"' EXIT
  /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=15 "$SOURCE_HOST" \
    "/usr/bin/find /home/coolhand/firehose-data/raw -type f -name '*.manifest.json' -printf '%P\\n'" \
    | /usr/bin/sort > "$audit_tmp/source-manifests"
  /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=15 "$SOURCE_HOST" \
    "/usr/bin/find /home/coolhand/firehose-data/raw -type f -name '*.ndjson.zst' -printf '%P\\n'" \
    | /usr/bin/sed 's/\.ndjson\.zst$/.manifest.json/' \
    | /usr/bin/sort > "$audit_tmp/source-segment-pairs"
  if ! /usr/bin/cmp -s "$audit_tmp/source-manifests" "$audit_tmp/source-segment-pairs"; then
    log 'ERROR: drummer has an unpaired sealed segment or manifest'
    exit 1
  fi
fi

if [ "$MODE" = backup ]; then
  log 'Starting sealed firehose archive pull'
else
  log "Starting sealed firehose archive sync and $MODE"
fi
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
audited=0
failures=0
while IFS= read -r -d '' manifest; do
  marker="$manifest.verified"
  if [ "$MODE" = backup ] && [ -f "$marker" ]; then
    continue
  fi

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

  if [ ! -f "$marker" ]; then
    marker_tmp="$marker.$$.tmp"
    /usr/bin/printf 'sha256=%s\nbytes=%s\nverified_at=%s\n' \
      "$actual_sha" "$actual_bytes" "$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$marker_tmp"
    /bin/chmod 600 "$marker_tmp"
    /bin/mv -f "$marker_tmp" "$marker"
    verified=$((verified + 1))
  fi
  audited=$((audited + 1))
done < <(/usr/bin/find "$DEST_DIR" -type f -name '*.manifest.json' -print0)

if [ "$failures" -ne 0 ]; then
  log "ERROR: $failures archive pair(s) failed verification"
  exit 1
fi

if [ "$MODE" != backup ]; then
  /usr/bin/find "$DEST_DIR" -type f -name '*.manifest.json' -print \
    | /usr/bin/sed "s#^$DEST_DIR/##" \
    | /usr/bin/sort > "$audit_tmp/destination-manifests"
  /usr/bin/find "$DEST_DIR" -type f -name '*.ndjson.zst' -print \
    | /usr/bin/sed "s#^$DEST_DIR/##" \
    | /usr/bin/sed 's/\.ndjson\.zst$/.manifest.json/' \
    | /usr/bin/sort > "$audit_tmp/destination-segment-pairs"
  source_count=$(/usr/bin/wc -l < "$audit_tmp/source-manifests" | /usr/bin/tr -d ' ')
  destination_count=$(/usr/bin/wc -l < "$audit_tmp/destination-manifests" | /usr/bin/tr -d ' ')
  missing_count=$(/usr/bin/comm -23 \
    "$audit_tmp/source-manifests" "$audit_tmp/destination-manifests" \
    | /usr/bin/wc -l | /usr/bin/tr -d ' ')
  if [ "$missing_count" -ne 0 ]; then
    log "ERROR: $missing_count source manifest(s) are absent from Galactus"
    exit 1
  fi
  if ! /usr/bin/cmp -s "$audit_tmp/destination-manifests" "$audit_tmp/destination-segment-pairs"; then
    log 'ERROR: Galactus has an unpaired sealed segment or manifest'
    exit 1
  fi
  log "Integrity audit: $source_count source manifest(s), $destination_count destination manifest(s), $audited checksum pair(s) passed"

  if [ "$MODE" = restore-drill ]; then
    restore_source=$(/usr/bin/find "$DEST_DIR" -type f -name '*.ndjson.zst' -print \
      | /usr/bin/sort | /usr/bin/tail -1)
    if [ -z "$restore_source" ]; then
      log 'ERROR: no sealed segment is available for the restore drill'
      exit 1
    fi
    restore_manifest="${restore_source%.ndjson.zst}.manifest.json"
    restore_dir="$audit_tmp/restore"
    /bin/mkdir -m 700 "$restore_dir"
    /bin/cp "$restore_source" "$restore_manifest" "$restore_dir/"
    restored_segment="$restore_dir/$(/usr/bin/basename "$restore_source")"
    restored_manifest="$restore_dir/$(/usr/bin/basename "$restore_manifest")"
    restored_sha=$(/usr/bin/shasum -a 256 "$restored_segment" | /usr/bin/awk '{print $1}')
    restored_bytes=$(/usr/bin/stat -f '%z' "$restored_segment")
    expected_sha=$(/usr/bin/plutil -extract sha256 raw "$restored_manifest")
    expected_bytes=$(/usr/bin/plutil -extract compressedBytes raw "$restored_manifest")
    if [ "$restored_sha" != "$expected_sha" ] || [ "$restored_bytes" != "$expected_bytes" ]; then
      log 'ERROR: sealed-segment restore drill failed verification'
      exit 1
    fi
    /bin/rm -f "$restored_segment" "$restored_manifest"
    /bin/rmdir "$restore_dir"
    log "Restore drill passed for $(/usr/bin/basename "$restore_source")"
  fi
fi

deleted=0
if [ "$MODE" = backup ]; then
  while IFS= read -r -d '' expired; do
    /bin/rm -f -- "$expired"
    deleted=$((deleted + 1))
  done < <(/usr/bin/find "$DEST_DIR" -type f -mtime "+$RETENTION_DAYS" \( \
    -name '*.ndjson.zst' -o \
    -name '*.manifest.json' -o \
    -name '*.manifest.json.verified' -o \
    -name '*.corrupt-*' \
  \) -print0)
fi

if [ "$MODE" = backup ]; then
  log "Backup complete: $verified newly verified file(s), $deleted expired file(s) removed"
else
  log "$MODE complete: $verified newly verified file(s), $deleted expired file(s) removed"
fi
